/**
 * Rutas de Administración del Sistema de IA
 * Endpoints para monitorear y configurar el sistema conversacional inteligente
 */

import express from 'express';
import { lmStudioConfig } from '../services/LMStudioConfig.js';
import { intelligentAI } from '../services/IntelligentAIService.js';
import { templateService } from '../services/TemplateService.js';
import { contextManager } from '../services/ContextManager.js';
import { unifiedWebhookService } from '../../../../src/services/core/core/UnifiedWebhookService.js';
import { log } from '../../../../src/services/core/core/logger.js';

const router = express.Router();

/**
 * GET /ai-admin/status
 * Obtiene el estado general del sistema de IA
 */
router.get('/status', async (req, res) => {
  try {
    log('📊 Solicitando estado del sistema de IA');

    // Verificar conexión con LM Studio
    const conexionLM = await lmStudioConfig.verificarConexion();

    // Obtener información del modelo
    const infoModelo = await lmStudioConfig.obtenerInfoModelo();

    // Obtener estadísticas del sistema
    const estadisticasWebhook = await unifiedWebhookService.getStatistics();
    const estadisticasTemplate =
      await templateService.obtenerEstadisticasTemplate();

    // Validar configuración
    const validacionConfig = lmStudioConfig.validarConfiguracion();

    const estado = {
      timestamp: new Date().toISOString(),
      sistema: {
        activo: true,
        version: '1.0.0',
        modo: 'local',
      },
      lmStudio: {
        conectado: conexionLM.connected,
        url: lmStudioConfig.baseURL,
        modelo: infoModelo,
        ultimaVerificacion: conexionLM.timestamp,
        error: conexionLM.error || null,
      },
      configuracion: {
        valida: validacionConfig.valida,
        errores: validacionConfig.errores,
        advertencias: validacionConfig.advertencias,
        parametros: validacionConfig.configuracion,
      },
      estadisticas: {
        clientes: estadisticasWebhook,
        templates: estadisticasTemplate,
      },
      servicios: {
        contextManager: true,
        intelligentAI: true,
        templateService: true,
        enhancedWebhookService: true,
      },
    };

    res.json({
      success: true,
      data: estado,
    });
  } catch (error) {
    log(`❌ Error obteniendo estado del sistema: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/test-connection
 * Prueba la conexión con LM Studio
 */
router.post('/test-connection', async (req, res) => {
  try {
    log('🧪 Probando conexión con LM Studio');

    // Verificar conexión
    const conexion = await lmStudioConfig.verificarConexion();

    if (!conexion.connected) {
      return res.json({
        success: false,
        message: 'No se pudo conectar con LM Studio',
        error: conexion.error,
      });
    }

    // Probar generación de texto
    const pruebaGeneracion = await lmStudioConfig.probarGeneracion();

    res.json({
      success: true,
      message: 'Conexión exitosa con LM Studio',
      data: {
        conexion,
        generacion: pruebaGeneracion,
      },
    });
  } catch (error) {
    log(`❌ Error probando conexión: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/configure
 * Configura parámetros del modelo de IA
 */
router.post('/configure', async (req, res) => {
  try {
    const { parameters } = req.body;

    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Parámetros inválidos',
      });
    }

    log('⚙️ Configurando parámetros del modelo:', parameters);

    const resultado = lmStudioConfig.configurarParametros(parameters);

    if (resultado.success) {
      res.json({
        success: true,
        message: 'Parámetros configurados exitosamente',
        data: resultado.parameters,
      });
    } else {
      res.status(400).json({
        success: false,
        error: resultado.error,
      });
    }
  } catch (error) {
    log(`❌ Error configurando parámetros: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /ai-admin/statistics
 * Obtiene estadísticas detalladas del sistema
 */
router.get('/statistics', async (req, res) => {
  try {
    log('📈 Obteniendo estadísticas detalladas');

    const estadisticas = {
      timestamp: new Date().toISOString(),
      clientes: await unifiedWebhookService.getStatistics(),
      templates: await templateService.obtenerEstadisticasTemplate(),
      lmStudio: await lmStudioConfig.obtenerEstadisticas(),
      sistema: {
        uptime: process.uptime(),
        memoria: process.memoryUsage(),
        version: process.version,
      },
    };

    res.json({
      success: true,
      data: estadisticas,
    });
  } catch (error) {
    log(`❌ Error obteniendo estadísticas: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/test-template
 * Prueba el envío de la plantilla "prueba" (modo simulación)
 */
router.post('/test-template', async (req, res) => {
  try {
    const { phone, nombre, templateName } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido',
      });
    }

    const template = templateName || 'prueba';
    const clientName = nombre || 'Usuario de prueba';

    log(`📋 Probando envío de template "${template}" a ${phone}`);

    // Simular verificación de plantilla
    const verificacion = {
      exists: true,
      status: 'APPROVED',
      approved: true,
      template: {
        name: template,
        language: 'es',
        category: 'MARKETING',
      },
    };

    log(`✅ Plantilla "${template}" verificada (simulación)`);

    // Simular verificación de límites
    const puedeEnviar = {
      puede: true,
      razon: 'Límites OK',
    };

    log(`✅ Verificación de límites OK para ${phone}`);

    // Simular envío exitoso
    const resultado = {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateName: template,
      timestamp: Date.now(),
      to: phone,
      clientName: clientName,
      simulado: true,
    };

    // Actualizar contexto del cliente
    await contextManager.actualizarEstado(phone, 'enviado_template', {
      templateEnviado: true,
      messageId: resultado.messageId,
      templateName: template,
      timestamp: Date.now(),
      simulado: true,
    });

    log(
      `✅ Template "${template}" enviado exitosamente (simulación) a ${phone}. ID: ${resultado.messageId}`
    );

    res.json({
      success: true,
      message: 'Template enviado exitosamente (simulación)',
      data: resultado,
    });
  } catch (error) {
    log(`❌ Error probando template: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/test-ai
 * Prueba el análisis de IA con un mensaje
 */
router.post('/test-ai', async (req, res) => {
  try {
    const { message, phone } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensaje requerido',
      });
    }

    const phoneTest = phone || '+57300000000';

    log(`🤖 Probando análisis de IA con mensaje: "${message}"`);

    // Cargar contexto
    const contexto = await contextManager.cargarContexto(phoneTest);

    // Agregar mensaje al historial
    log(
      `🔍 DEBUG: Agregando mensaje al historial para ${phoneTest}: "${message}"`
    );
    const resultadoHistorial = await contextManager.agregarAlHistorial(
      phoneTest,
      message,
      true
    );
    log(
      '🔍 DEBUG: Resultado agregarAlHistorial:',
      resultadoHistorial ? 'éxito' : 'falló'
    );

    // Analizar mensaje completo
    const analisis = await intelligentAI.analizarMensaje(
      phoneTest,
      message,
      contexto
    );

    // Cargar contexto actualizado
    const contextoActualizado = await contextManager.cargarContexto(phoneTest);

    res.json({
      success: true,
      data: {
        mensaje: message,
        contexto: {
          historialLength: contextoActualizado.mensajes?.length || 0,
          estado: contextoActualizado.estado,
          intereses: contextoActualizado.intereses,
          ultimosmensajes: contextoActualizado.mensajes?.slice(-3) || [],
        },
        analisis,
      },
    });
  } catch (error) {
    log(`❌ Error probando IA: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/test-context
 * Prueba directa del contexto
 */
router.post('/test-context', async (req, res) => {
  try {
    const { phone = '+57300000002', message = 'Test mensaje' } = req.body;

    log(`🔍 TEST CONTEXT: Probando contexto para ${phone}`);

    // Cargar contexto inicial
    const contextoInicial = await contextManager.cargarContexto(phone);
    log(
      `🔍 TEST CONTEXT: Contexto inicial - mensajes: ${contextoInicial.mensajes.length}`
    );

    // Agregar mensaje
    const resultado = await contextManager.agregarAlHistorial(
      phone,
      message,
      true
    );
    log(
      '🔍 TEST CONTEXT: Resultado agregarAlHistorial:',
      resultado ? 'éxito' : 'falló'
    );

    // Cargar contexto actualizado
    const contextoFinal = await contextManager.cargarContexto(phone);
    log(
      `🔍 TEST CONTEXT: Contexto final - mensajes: ${contextoFinal.mensajes.length}`
    );

    res.json({
      success: true,
      data: {
        phone,
        message,
        contextoInicial: {
          mensajes: contextoInicial.mensajes.length,
          ultimaInteraccion: contextoInicial.ultimaInteraccion,
        },
        contextoFinal: {
          mensajes: contextoFinal.mensajes.length,
          ultimaInteraccion: contextoFinal.ultimaInteraccion,
          ultimosMensajes: contextoFinal.mensajes,
        },
      },
    });
  } catch (error) {
    log(`❌ Error en test-context: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /ai-admin/list-templates
 * Lista las plantillas disponibles en 360dialog
 */
router.get('/list-templates', async (req, res) => {
  try {
    log('📋 Listando plantillas disponibles en 360dialog');

    const resultado = await templateService.listarPlantillasDisponibles();

    res.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    log(`❌ Error listando plantillas: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /ai-admin/clients
 * Lista clientes con contexto
 */
router.get('/clients', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    log(`👥 Obteniendo lista de clientes (limit: ${limit}, offset: ${offset})`);

    // Esta funcionalidad requeriría implementar un método en contextManager
    // Por ahora retornamos estadísticas básicas
    const estadisticas = await unifiedWebhookService.getStatistics();

    res.json({
      success: true,
      message: 'Funcionalidad de listado de clientes en desarrollo',
      data: {
        estadisticas,
        note: 'Para ver clientes específicos, revisar archivos en ./data/context/',
      },
    });
  } catch (error) {
    log(`❌ Error obteniendo clientes: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /ai-admin/reset-client
 * Reinicia el contexto de un cliente
 */
router.post('/reset-client', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido',
      });
    }

    log(`🔄 Reiniciando contexto del cliente ${phone}`);

    // Crear contexto inicial (esto efectivamente reinicia el contexto)
    const nuevoContexto = await contextManager.crearContextoInicial(phone);

    res.json({
      success: true,
      message: `Contexto reiniciado para ${phone}`,
      data: nuevoContexto,
    });
  } catch (error) {
    log(`❌ Error reiniciando cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
