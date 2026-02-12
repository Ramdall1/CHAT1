/**
 * Gestor de Contexto Inteligente por Cliente
 * Mantiene memoria persistente de conversaciones con solo los últimos 5 mensajes relevantes
 */

import fs from 'fs-extra';
import path from 'path';
import { log } from '../core/logger.js';

export class ContextManager {
  constructor() {
    this.contextDir = path.join(process.cwd(), 'data', 'context');
    this.maxRelevantMessages = 5;
    this.contextCache = new Map(); // Cache en memoria para acceso rápido
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutos

    this.ensureContextDirectory();
  }

  /**
   * Asegura que el directorio de contexto existe
   */
  async ensureContextDirectory() {
    try {
      await fs.ensureDir(this.contextDir);
      log(`📁 Directorio de contexto inicializado: ${this.contextDir}`);
    } catch (error) {
      log(`❌ Error creando directorio de contexto: ${error.message}`);
    }
  }

  /**
   * Normaliza el número de teléfono para usar como nombre de archivo
   */
  normalizePhone(phone) {
    return phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  }

  /**
   * Obtiene la ruta del archivo de contexto para un cliente
   */
  getContextFilePath(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    return path.join(this.contextDir, `${normalizedPhone}.json`);
  }

  /**
   * Carga el contexto de un cliente desde el archivo
   */
  async cargarContexto(phone) {
    try {
      const normalizedPhone = this.normalizePhone(phone);

      // Verificar cache primero
      if (this.contextCache.has(normalizedPhone)) {
        const cached = this.contextCache.get(normalizedPhone);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.context;
        }
      }

      const filePath = this.getContextFilePath(phone);

      if (await fs.pathExists(filePath)) {
        const contextData = await fs.readJson(filePath);

        // Actualizar cache
        this.contextCache.set(normalizedPhone, {
          context: contextData,
          timestamp: Date.now(),
        });

        log(
          `📖 Contexto cargado para ${normalizedPhone}: ${contextData.mensajes.length} mensajes`
        );
        return contextData;
      }

      // Si no existe, crear contexto inicial
      const newContext = this.createInitialContext(phone);
      await this.guardarContexto(phone, newContext);
      return newContext;
    } catch (error) {
      log(`❌ Error cargando contexto para ${phone}: ${error.message}`);
      return this.createInitialContext(phone);
    }
  }

  /**
   * Crea un contexto inicial para un nuevo cliente
   */
  createInitialContext(phone) {
    return {
      telefono: phone,
      nombre: null,
      estado: 'nuevo', // nuevo, interesado, enviado_template, completado, rechazado
      mensajes: [],
      intencionCompra: {
        detectada: false,
        confianza: 0,
        palabrasClave: [],
        timestamp: null,
      },
      datosFormulario: null,
      intereses: [],
      preguntas: [],
      nivelEngagement: 0,
      ultimaInteraccion: Date.now(),
      contadorRechazos: 0,
      templateEnviado: false,
      fechaCreacion: Date.now(),
      ultimaActualizacion: Date.now(),
    };
  }

  /**
   * Guarda el contexto de un cliente en el archivo
   */
  async guardarContexto(phone, contexto) {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const filePath = this.getContextFilePath(phone);

      // Actualizar timestamp de última actualización
      contexto.ultimaActualizacion = Date.now();

      await fs.writeJson(filePath, contexto, { spaces: 2 });

      // Actualizar cache
      this.contextCache.set(normalizedPhone, {
        context: contexto,
        timestamp: Date.now(),
      });

      log(`💾 Contexto guardado para ${normalizedPhone}`);
      return true;
    } catch (error) {
      log(`❌ Error guardando contexto para ${phone}: ${error.message}`);
      return false;
    }
  }

  /**
   * Actualiza el estado del cliente
   */
  async actualizarEstado(phone, nuevoEstado, datos = {}) {
    try {
      const contexto = await this.cargarContexto(phone);

      contexto.estado = nuevoEstado;
      contexto.ultimaInteraccion = Date.now();

      // Agregar datos adicionales según el estado
      if (datos.nombre) contexto.nombre = datos.nombre;
      if (datos.datosFormulario)
        contexto.datosFormulario = datos.datosFormulario;
      if (datos.templateEnviado !== undefined)
        contexto.templateEnviado = datos.templateEnviado;
      if (datos.intencionCompra)
        contexto.intencionCompra = {
          ...contexto.intencionCompra,
          ...datos.intencionCompra,
        };

      await this.guardarContexto(phone, contexto);

      log(`🔄 Estado actualizado para ${phone}: ${nuevoEstado}`);
      return contexto;
    } catch (error) {
      log(`❌ Error actualizando estado para ${phone}: ${error.message}`);
      return null;
    }
  }

  /**
   * Agrega un mensaje al historial manteniendo solo los 5 más relevantes
   */
  async agregarAlHistorial(phone, mensaje, esRelevante = true) {
    try {
      const contexto = await this.cargarContexto(phone);

      const nuevoMensaje = {
        texto: mensaje,
        timestamp: Date.now(),
        relevante: esRelevante,
        tipo: 'entrante',
      };

      // Agregar el nuevo mensaje
      contexto.mensajes.push(nuevoMensaje);

      // Mantener solo los mensajes relevantes más recientes
      const mensajesRelevantes = contexto.mensajes
        .filter(m => m.relevante)
        .slice(-this.maxRelevantMessages);

      // Mantener algunos mensajes no relevantes recientes para contexto
      const mensajesNoRelevantes = contexto.mensajes
        .filter(m => !m.relevante)
        .slice(-2);

      contexto.mensajes = [...mensajesRelevantes, ...mensajesNoRelevantes].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      // Actualizar métricas
      contexto.ultimaInteraccion = Date.now();
      this.actualizarMetricas(contexto);

      await this.guardarContexto(phone, contexto);

      log(
        `📝 Mensaje agregado al historial de ${phone}. Total: ${contexto.mensajes.length}`
      );
      return contexto;
    } catch (error) {
      log(
        `❌ Error agregando mensaje al historial para ${phone}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Actualiza las métricas del contexto basado en los mensajes
   */
  actualizarMetricas(contexto) {
    const mensajes = contexto.mensajes;

    // Extraer intereses
    contexto.intereses = this.extraerIntereses(mensajes);

    // Extraer preguntas
    contexto.preguntas = this.extraerPreguntas(mensajes);

    // Calcular nivel de engagement
    contexto.nivelEngagement = this.calcularNivelEngagement(mensajes);
  }

  /**
   * Extrae intereses de los mensajes
   */
  extraerIntereses(mensajes) {
    const palabrasInteres = [
      'dinero',
      'ganar',
      'premio',
      'sorteo',
      'lotería',
      'números',
      'participar',
      'inscribir',
      'apuntar',
      'interesa',
      'quiero',
    ];

    const intereses = new Set();

    mensajes.forEach(mensaje => {
      const texto = mensaje.texto.toLowerCase();
      palabrasInteres.forEach(palabra => {
        if (texto.includes(palabra)) {
          intereses.add(palabra);
        }
      });
    });

    return Array.from(intereses);
  }

  /**
   * Extrae preguntas de los mensajes
   */
  extraerPreguntas(mensajes) {
    const preguntas = [];

    mensajes.forEach(mensaje => {
      const texto = mensaje.texto;
      if (
        texto.includes('?') ||
        texto
          .toLowerCase()
          .match(/^(cómo|qué|cuándo|dónde|por qué|para qué|cuánto)/)
      ) {
        preguntas.push({
          pregunta: texto,
          timestamp: mensaje.timestamp,
        });
      }
    });

    return preguntas.slice(-3); // Últimas 3 preguntas
  }

  /**
   * Calcula el nivel de engagement basado en la actividad
   */
  calcularNivelEngagement(mensajes) {
    if (mensajes.length === 0) return 0;

    let score = 0;

    // Puntos por cantidad de mensajes
    score += Math.min(mensajes.length * 10, 50);

    // Puntos por preguntas
    const preguntas = mensajes.filter(m => m.texto.includes('?')).length;
    score += preguntas * 15;

    // Puntos por palabras de interés
    const palabrasPositivas = [
      'sí',
      'si',
      'ok',
      'vale',
      'perfecto',
      'genial',
      'interesa',
    ];
    const mensajesPositivos = mensajes.filter(m =>
      palabrasPositivas.some(p => m.texto.toLowerCase().includes(p))
    ).length;
    score += mensajesPositivos * 20;

    // Penalización por palabras negativas
    const palabrasNegativas = ['no', 'nunca', 'jamás', 'imposible', 'no puedo'];
    const mensajesNegativos = mensajes.filter(m =>
      palabrasNegativas.some(p => m.texto.toLowerCase().includes(p))
    ).length;
    score -= mensajesNegativos * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Obtiene estadísticas del contexto
   */
  async obtenerEstadisticas(phone) {
    try {
      const contexto = await this.cargarContexto(phone);

      return {
        telefono: phone,
        estado: contexto.estado,
        totalMensajes: contexto.mensajes.length,
        nivelEngagement: contexto.nivelEngagement,
        intereses: contexto.intereses,
        ultimaInteraccion: contexto.ultimaInteraccion,
        templateEnviado: contexto.templateEnviado,
        intencionCompra: contexto.intencionCompra,
      };
    } catch (error) {
      log(`❌ Error obteniendo estadísticas para ${phone}: ${error.message}`);
      return null;
    }
  }

  /**
   * Limpia contextos antiguos (más de 30 días sin actividad)
   */
  async limpiarContextosAntiguos() {
    try {
      const files = await fs.readdir(this.contextDir);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      let cleaned = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.contextDir, file);
          const contexto = await fs.readJson(filePath);

          if (contexto.ultimaInteraccion < thirtyDaysAgo) {
            await fs.remove(filePath);
            cleaned++;
          }
        }
      }

      log(`🧹 Limpieza completada: ${cleaned} contextos antiguos eliminados`);
      return cleaned;
    } catch (error) {
      log(`❌ Error en limpieza de contextos: ${error.message}`);
      return 0;
    }
  }
}

// Instancia singleton
export const contextManager = new ContextManager();
