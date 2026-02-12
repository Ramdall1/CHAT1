/**
 * Configuración y Verificación de LM Studio
 * Maneja la conexión y configuración del modelo de IA local
 */

import axios from 'axios';
import { log } from '../core/logger.js';

export class LMStudioConfig {
  constructor() {
    // Configuración por defecto de LM Studio
    this.baseURL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    this.apiKey = process.env.LM_STUDIO_API_KEY || 'lm-studio';
    this.model = process.env.LM_STUDIO_MODEL || 'local-model';

    // Parámetros del modelo
    this.defaultParams = {
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      stream: false,
    };

    // Configuración de timeouts
    this.timeout = 30000; // 30 segundos
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 segundos

    // Estado de conexión
    this.isConnected = false;
    this.lastCheck = null;
    this.modelInfo = null;
  }

  /**
   * Verifica la conexión con LM Studio
   */
  async verificarConexion() {
    try {
      log(`🔍 Verificando conexión con LM Studio en ${this.baseURL}`);

      const response = await axios.get(`${this.baseURL}/v1/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      if (response.status === 200 && response.data) {
        this.isConnected = true;
        this.lastCheck = Date.now();
        this.modelInfo = response.data;

        log('✅ Conexión exitosa con LM Studio');
        log(
          '📊 Modelos disponibles:',
          response.data.data?.map(m => m.id) || []
        );

        return {
          connected: true,
          models: response.data.data || [],
          timestamp: this.lastCheck,
        };
      }

      throw new Error('Respuesta inválida del servidor');
    } catch (error) {
      this.isConnected = false;
      log(`❌ Error conectando con LM Studio: ${error.message}`);

      return {
        connected: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Obtiene información del modelo actual
   */
  async obtenerInfoModelo() {
    try {
      if (!this.isConnected) {
        await this.verificarConexion();
      }

      if (!this.isConnected) {
        throw new Error('No hay conexión con LM Studio');
      }

      const response = await axios.get(`${this.baseURL}/v1/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      const models = response.data.data || [];
      const currentModel = models.find(m => m.id === this.model) || models[0];

      if (currentModel) {
        log(`📋 Información del modelo actual: ${currentModel.id}`);
        return {
          id: currentModel.id,
          object: currentModel.object,
          created: currentModel.created,
          owned_by: currentModel.owned_by,
          available: true,
        };
      }

      throw new Error('No se encontró el modelo especificado');
    } catch (error) {
      log(`❌ Error obteniendo información del modelo: ${error.message}`);
      return {
        id: this.model,
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Prueba la generación de texto con el modelo
   */
  async probarGeneracion() {
    try {
      const mensajePrueba = 'Hola, ¿cómo estás?';

      log(`🧪 Probando generación de texto con mensaje: "${mensajePrueba}"`);

      const response = await axios.post(
        `${this.baseURL}/v1/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'Eres un asistente comercial amigable. Responde de manera breve y cordial.',
            },
            {
              role: 'user',
              content: mensajePrueba,
            },
          ],
          ...this.defaultParams,
          max_tokens: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const respuestaGenerada = response.data.choices[0].message.content;

        log('✅ Generación de texto exitosa');
        log(`🤖 Respuesta generada: "${respuestaGenerada}"`);

        return {
          success: true,
          input: mensajePrueba,
          output: respuestaGenerada,
          usage: response.data.usage,
          timestamp: Date.now(),
        };
      }

      throw new Error('Respuesta inválida del modelo');
    } catch (error) {
      log(`❌ Error en prueba de generación: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Configura parámetros del modelo
   */
  configurarParametros(nuevosParams) {
    try {
      const parametrosValidos = [
        'temperature',
        'max_tokens',
        'top_p',
        'frequency_penalty',
        'presence_penalty',
        'stream',
      ];

      const parametrosActualizados = {};

      for (const [key, value] of Object.entries(nuevosParams)) {
        if (parametrosValidos.includes(key)) {
          parametrosActualizados[key] = value;
        } else {
          log(`⚠️ Parámetro ignorado: ${key}`);
        }
      }

      this.defaultParams = { ...this.defaultParams, ...parametrosActualizados };

      log('⚙️ Parámetros actualizados:', this.defaultParams);

      return {
        success: true,
        parameters: this.defaultParams,
      };
    } catch (error) {
      log(`❌ Error configurando parámetros: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene estadísticas de uso
   */
  async obtenerEstadisticas() {
    try {
      // Simular estadísticas básicas
      const stats = {
        conexion: {
          estado: this.isConnected ? 'conectado' : 'desconectado',
          ultimaVerificacion: this.lastCheck,
          url: this.baseURL,
        },
        modelo: {
          id: this.model,
          parametros: this.defaultParams,
        },
        configuracion: {
          timeout: this.timeout,
          reintentos: this.retryAttempts,
          delayReintentos: this.retryDelay,
        },
      };

      return stats;
    } catch (error) {
      log(`❌ Error obteniendo estadísticas: ${error.message}`);
      return {
        error: error.message,
      };
    }
  }

  /**
   * Reinicia la conexión
   */
  async reiniciarConexion() {
    try {
      log('🔄 Reiniciando conexión con LM Studio');

      this.isConnected = false;
      this.lastCheck = null;
      this.modelInfo = null;

      const resultado = await this.verificarConexion();

      if (resultado.connected) {
        log('✅ Conexión reiniciada exitosamente');
      } else {
        log(`❌ Error reiniciando conexión: ${resultado.error}`);
      }

      return resultado;
    } catch (error) {
      log(`❌ Error reiniciando conexión: ${error.message}`);
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Valida la configuración actual
   */
  validarConfiguracion() {
    const errores = [];
    const advertencias = [];

    // Validar URL
    if (!this.baseURL || !this.baseURL.startsWith('http')) {
      errores.push('URL de LM Studio inválida');
    }

    // Validar parámetros
    if (
      this.defaultParams.temperature < 0 ||
      this.defaultParams.temperature > 2
    ) {
      advertencias.push('Temperature fuera del rango recomendado (0-2)');
    }

    if (
      this.defaultParams.max_tokens < 1 ||
      this.defaultParams.max_tokens > 4096
    ) {
      advertencias.push('max_tokens fuera del rango recomendado (1-4096)');
    }

    // Validar timeout
    if (this.timeout < 5000) {
      advertencias.push('Timeout muy bajo, puede causar errores');
    }

    const esValida = errores.length === 0;

    log(`🔍 Validación de configuración: ${esValida ? 'VÁLIDA' : 'INVÁLIDA'}`);

    if (errores.length > 0) {
      log('❌ Errores:', errores);
    }

    if (advertencias.length > 0) {
      log('⚠️ Advertencias:', advertencias);
    }

    return {
      valida: esValida,
      errores,
      advertencias,
      configuracion: {
        baseURL: this.baseURL,
        model: this.model,
        parameters: this.defaultParams,
        timeout: this.timeout,
      },
    };
  }
}

// Instancia singleton
export const lmStudioConfig = new LMStudioConfig();
