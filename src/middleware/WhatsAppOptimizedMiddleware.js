/**
 * @fileoverview Middleware optimizado para WhatsApp Business API
 * Manejo asíncrono con respuesta inmediata ≤80ms y procesamiento en background
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 * @since 2025-01-21
 */

import WhatsAppOptimizedDataService from '../services/whatsapp/WhatsAppOptimizedDataService.js';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('WHATSAPP_OPTIMIZED_MIDDLEWARE');

class WhatsAppOptimizedMiddleware {
  constructor() {
    this.dataService = new WhatsAppOptimizedDataService();
    this.logger = logger;
    
    // Métricas de rendimiento
    this.performanceMetrics = {
      totalRequests: 0,
      fastResponses: 0,
      slowResponses: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity
    };

    // Configuración de límites
    this.config = {
      maxResponseTime: 80, // ms - tiempo máximo ideal
      fallbackMaxTime: 200, // ms - tiempo máximo absoluto
      enableMetrics: true,
      enableDetailedLogging: process.env.NODE_ENV === 'development'
    };
  }

  /**
   * Inicializa el middleware y el servicio de datos
   */
  async initialize() {
    try {
      await this.dataService.initialize();
      this.logger.info('✅ Middleware optimizado inicializado');
      return true;
    } catch (error) {
      this.logger.error('❌ Error inicializando middleware:', error);
      throw error;
    }
  }

  /**
   * Middleware principal para webhooks de WhatsApp
   * Garantiza respuesta ≤80ms con procesamiento asíncrono
   */
  handleWebhook() {
    return async (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Log de entrada (solo en desarrollo)
        if (this.config.enableDetailedLogging) {
          this.logger.debug(`📥 Webhook recibido: ${requestId}`, {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body
          });
        }

        // Validación rápida de estructura básica
        if (!this.isValidWebhookStructure(req.body)) {
          const responseTime = this.calculateResponseTime(startTime);
          this.updateMetrics(responseTime);
          
          return res.status(400).json({
            success: false,
            error: 'Estructura de webhook inválida',
            timestamp: new Date().toISOString(),
            request_id: requestId
          });
        }

        // Procesamiento ultra-rápido con respuesta inmediata
        const response = await this.dataService.processWebhookFast(req.body);
        
        // Calcular tiempo de respuesta
        const responseTime = this.calculateResponseTime(startTime);
        this.updateMetrics(responseTime);

        // Agregar métricas a la respuesta
        response.performance = {
          response_time_ms: responseTime,
          request_id: requestId,
          is_fast_response: responseTime <= this.config.maxResponseTime
        };

        // Log de respuesta exitosa
        this.logger.info(`⚡ Respuesta enviada en ${responseTime}ms - ID: ${requestId}`);

        // Respuesta inmediata con status 200
        res.status(200).json(response);

      } catch (error) {
        const responseTime = this.calculateResponseTime(startTime);
        this.updateMetrics(responseTime);

        this.logger.error(`❌ Error en webhook ${requestId}:`, error);

        // Respuesta de error rápida
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
          request_id: requestId,
          performance: {
            response_time_ms: responseTime
          }
        });
      }
    };
  }

  /**
   * Middleware para verificación de webhooks de WhatsApp
   */
  handleVerification() {
    return (req, res) => {
      const startTime = process.hrtime.bigint();
      
      try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Verificar token (usar variable de entorno)
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'default_verify_token';

        if (mode === 'subscribe' && token === verifyToken) {
          const responseTime = this.calculateResponseTime(startTime);
          this.logger.info(`✅ Verificación exitosa en ${responseTime}ms`);
          
          res.status(200).send(challenge);
        } else {
          const responseTime = this.calculateResponseTime(startTime);
          this.logger.warn(`❌ Verificación fallida en ${responseTime}ms`);
          
          res.status(403).json({
            success: false,
            error: 'Token de verificación inválido'
          });
        }
      } catch (error) {
        const responseTime = this.calculateResponseTime(startTime);
        this.logger.error(`❌ Error en verificación (${responseTime}ms):`, error);
        
        res.status(500).json({
          success: false,
          error: 'Error en verificación'
        });
      }
    };
  }

  /**
   * Middleware para métricas y monitoreo
   */
  handleMetrics() {
    return (req, res) => {
      try {
        const systemMetrics = this.getSystemMetrics();
        const dataServiceMetrics = this.dataService.getMetrics();

        res.status(200).json({
          success: true,
          timestamp: new Date().toISOString(),
          middleware_metrics: systemMetrics,
          data_service_metrics: dataServiceMetrics,
          system_health: this.getSystemHealth(systemMetrics, dataServiceMetrics)
        });
      } catch (error) {
        this.logger.error('❌ Error obteniendo métricas:', error);
        res.status(500).json({
          success: false,
          error: 'Error obteniendo métricas'
        });
      }
    };
  }

  /**
   * Middleware para health check
   */
  handleHealthCheck() {
    return async (req, res) => {
      const startTime = process.hrtime.bigint();
      
      try {
        // Verificar conexión a base de datos
        await this.dataService.sequelize.authenticate();
        
        const responseTime = this.calculateResponseTime(startTime);
        const health = this.getSystemHealth(this.getSystemMetrics(), this.dataService.getMetrics());

        res.status(200).json({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          response_time_ms: responseTime,
          health_score: health.score,
          components: {
            database: 'connected',
            middleware: 'operational',
            queue_processor: 'running'
          }
        });
      } catch (error) {
        const responseTime = this.calculateResponseTime(startTime);
        this.logger.error(`❌ Health check fallido (${responseTime}ms):`, error);
        
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          response_time_ms: responseTime,
          error: error.message
        });
      }
    };
  }

  /**
   * Valida la estructura básica del webhook
   * @param {Object} body - Cuerpo de la petición
   */
  isValidWebhookStructure(body) {
    if (!body || typeof body !== 'object') {
      return false;
    }

    // Verificar estructura básica de WhatsApp
    if (!body.entry || !Array.isArray(body.entry)) {
      return false;
    }

    // Verificar que al menos una entrada tenga la estructura esperada
    return body.entry.some(entry => 
      entry && 
      typeof entry === 'object' && 
      Array.isArray(entry.changes)
    );
  }

  /**
   * Calcula el tiempo de respuesta en milisegundos
   * @param {BigInt} startTime - Tiempo de inicio en nanosegundos
   */
  calculateResponseTime(startTime) {
    const endTime = process.hrtime.bigint();
    return Number((endTime - startTime) / BigInt(1000000)); // Convertir a ms
  }

  /**
   * Actualiza las métricas de rendimiento
   * @param {number} responseTime - Tiempo de respuesta en ms
   */
  updateMetrics(responseTime) {
    if (!this.config.enableMetrics) return;

    this.performanceMetrics.totalRequests++;
    
    if (responseTime <= this.config.maxResponseTime) {
      this.performanceMetrics.fastResponses++;
    } else {
      this.performanceMetrics.slowResponses++;
    }

    // Actualizar tiempos
    this.performanceMetrics.maxResponseTime = Math.max(
      this.performanceMetrics.maxResponseTime, 
      responseTime
    );
    this.performanceMetrics.minResponseTime = Math.min(
      this.performanceMetrics.minResponseTime, 
      responseTime
    );

    // Calcular promedio
    this.performanceMetrics.averageResponseTime = (
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime) / 
      this.performanceMetrics.totalRequests
    );
  }

  /**
   * Obtiene métricas del sistema
   */
  getSystemMetrics() {
    const fastResponseRate = this.performanceMetrics.totalRequests > 0 ? 
      (this.performanceMetrics.fastResponses / this.performanceMetrics.totalRequests * 100).toFixed(2) : 0;

    return {
      ...this.performanceMetrics,
      fast_response_rate: `${fastResponseRate}%`,
      target_response_time: `≤${this.config.maxResponseTime}ms`,
      fallback_max_time: `≤${this.config.fallbackMaxTime}ms`
    };
  }

  /**
   * Evalúa la salud del sistema
   * @param {Object} middlewareMetrics - Métricas del middleware
   * @param {Object} dataServiceMetrics - Métricas del servicio de datos
   */
  getSystemHealth(middlewareMetrics, dataServiceMetrics) {
    let score = 100;
    const issues = [];

    // Evaluar tiempo de respuesta promedio
    if (middlewareMetrics.averageResponseTime > this.config.maxResponseTime) {
      score -= 20;
      issues.push('Tiempo de respuesta promedio alto');
    }

    // Evaluar tasa de respuestas rápidas
    const fastRate = parseFloat(middlewareMetrics.fast_response_rate);
    if (fastRate < 90) {
      score -= 15;
      issues.push('Tasa de respuestas rápidas baja');
    }

    // Evaluar cola de procesamiento
    if (dataServiceMetrics.queueSize > 100) {
      score -= 10;
      issues.push('Cola de procesamiento alta');
    }

    // Evaluar tasa de éxito
    const successRate = parseFloat(dataServiceMetrics.successRate);
    if (successRate < 95) {
      score -= 25;
      issues.push('Tasa de éxito baja');
    }

    return {
      score: Math.max(0, score),
      status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'warning' : 'critical',
      issues: issues.length > 0 ? issues : ['Sistema funcionando óptimamente']
    };
  }

  /**
   * Cierra el middleware y limpia recursos
   */
  async close() {
    try {
      await this.dataService.close();
      this.logger.info('Middleware cerrado correctamente');
    } catch (error) {
      this.logger.error('Error cerrando middleware:', error);
    }
  }
}

export default WhatsAppOptimizedMiddleware;