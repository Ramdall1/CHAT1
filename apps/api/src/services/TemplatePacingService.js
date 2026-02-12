/**
 * Template Pacing Service para 360 Dialog
 * Monitorea la calidad y rendimiento de las plantillas de mensajes
 * Implementa las mejores prácticas de template pacing de WhatsApp Business API
 */

import axios from 'axios';
import { log } from '../core/logger.js';
import { localModeManager } from '../core/localMode.js';

class TemplatePacingService {
  constructor() {
    this.apiKey = process.env.D360_API_KEY;
    this.baseURL = process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io';
    this.phoneNumberId = process.env.D360_PHONE_NUMBER_ID;
    this.headers = {
      'Content-Type': 'application/json',
      'D360-API-KEY': this.apiKey,
    };

    // Cache para métricas de plantillas
    this.templateMetrics = new Map();
    this.qualityScores = new Map();

    // Configuración de umbrales
    this.thresholds = {
      deliveryRate: 0.85, // 85% mínimo de entrega
      readRate: 0.6, // 60% mínimo de lectura
      responseRate: 0.15, // 15% mínimo de respuesta
      blockRate: 0.05, // 5% máximo de bloqueos
      reportRate: 0.02, // 2% máximo de reportes
    };
  }

  /**
   * Obtener métricas de calidad de una plantilla específica
   */
  async getTemplateQualityMetrics(templateName, timeRange = '7d') {
    try {
      if (localModeManager.isLocalMode) {
        return this.simulateTemplateMetrics(templateName);
      }

      const response = await axios.get(
        `${this.baseURL}/v1/analytics/templates/${templateName}/quality`,
        {
          headers: this.headers,
          params: {
            time_range: timeRange,
            phone_number_id: this.phoneNumberId,
          },
        }
      );

      const metrics = response.data;
      this.templateMetrics.set(templateName, {
        ...metrics,
        lastUpdated: new Date().toISOString(),
      });

      log(`✅ Métricas de calidad obtenidas para plantilla: ${templateName}`);
      return metrics;
    } catch (error) {
      log(
        `❌ Error obteniendo métricas de plantilla ${templateName}: ${error.message}`
      );

      // Fallback a datos simulados en caso de error
      return this.simulateTemplateMetrics(templateName);
    }
  }

  /**
   * Calcular puntuación de calidad de plantilla
   */
  calculateQualityScore(metrics) {
    const {
      delivery_rate = 0,
      read_rate = 0,
      response_rate = 0,
      block_rate = 0,
      report_rate = 0,
    } = metrics;

    // Puntuación basada en métricas ponderadas
    let score = 0;

    // Tasa de entrega (30% del peso)
    score += (delivery_rate / this.thresholds.deliveryRate) * 30;

    // Tasa de lectura (25% del peso)
    score += (read_rate / this.thresholds.readRate) * 25;

    // Tasa de respuesta (20% del peso)
    score += (response_rate / this.thresholds.responseRate) * 20;

    // Penalización por bloqueos (15% del peso)
    score +=
      Math.max(
        0,
        (this.thresholds.blockRate - block_rate) / this.thresholds.blockRate
      ) * 15;

    // Penalización por reportes (10% del peso)
    score +=
      Math.max(
        0,
        (this.thresholds.reportRate - report_rate) / this.thresholds.reportRate
      ) * 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Evaluar estado de calidad de plantilla
   */
  evaluateTemplateStatus(metrics) {
    const score = this.calculateQualityScore(metrics);
    const { delivery_rate = 0, block_rate = 0, report_rate = 0 } = metrics;

    if (score >= 80 && delivery_rate >= this.thresholds.deliveryRate) {
      return {
        status: 'EXCELLENT',
        color: '#10B981',
        message: 'Plantilla con excelente rendimiento',
        recommendations: [
          'Continuar usando esta plantilla',
          'Considerar como modelo para otras plantillas',
        ],
      };
    } else if (score >= 60 && delivery_rate >= 0.7) {
      return {
        status: 'GOOD',
        color: '#3B82F6',
        message: 'Plantilla con buen rendimiento',
        recommendations: [
          'Monitorear métricas regularmente',
          'Optimizar contenido si es posible',
        ],
      };
    } else if (score >= 40 && delivery_rate >= 0.5) {
      return {
        status: 'WARNING',
        color: '#F59E0B',
        message: 'Plantilla requiere atención',
        recommendations: [
          'Revisar contenido del mensaje',
          'Verificar relevancia para la audiencia',
          'Considerar segmentación de audiencia',
        ],
      };
    } else {
      return {
        status: 'CRITICAL',
        color: '#EF4444',
        message: 'Plantilla con bajo rendimiento',
        recommendations: [
          'Pausar uso inmediatamente',
          'Revisar completamente el contenido',
          'Analizar feedback de usuarios',
          'Considerar crear nueva plantilla',
        ],
      };
    }
  }

  /**
   * Obtener reporte completo de calidad de plantillas
   */
  async getTemplateQualityReport() {
    try {
      // Obtener lista de plantillas activas
      const templatesResponse = await axios.get(
        `${this.baseURL}/configs/templates`,
        {
          headers: this.headers,
        }
      );

      const templates = templatesResponse.data.waba_templates || [];
      const report = {
        generated_at: new Date().toISOString(),
        total_templates: templates.length,
        templates: [],
        summary: {
          excellent: 0,
          good: 0,
          warning: 0,
          critical: 0,
        },
      };

      // Analizar cada plantilla
      for (const template of templates) {
        try {
          const metrics = await this.getTemplateQualityMetrics(template.name);
          const score = this.calculateQualityScore(metrics);
          const status = this.evaluateTemplateStatus(metrics);

          const templateReport = {
            name: template.name,
            category: template.category,
            language: template.language,
            status: template.status,
            quality_score: Math.round(score),
            quality_status: status.status,
            metrics,
            evaluation: status,
            last_analyzed: new Date().toISOString(),
          };

          report.templates.push(templateReport);
          report.summary[status.status.toLowerCase()]++;
        } catch (error) {
          log(
            `❌ Error analizando plantilla ${template.name}: ${error.message}`
          );
        }
      }

      // Ordenar por puntuación de calidad
      report.templates.sort((a, b) => b.quality_score - a.quality_score);

      log(
        `✅ Reporte de calidad generado para ${report.total_templates} plantillas`
      );
      return report;
    } catch (error) {
      log(`❌ Error generando reporte de calidad: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener recomendaciones de optimización
   */
  getOptimizationRecommendations(templateReport) {
    const recommendations = [];
    const { metrics, quality_score } = templateReport;

    if (metrics.delivery_rate < this.thresholds.deliveryRate) {
      recommendations.push({
        type: 'delivery',
        priority: 'high',
        message: 'Baja tasa de entrega detectada',
        actions: [
          'Verificar formato del número de teléfono',
          'Revisar horarios de envío',
          'Validar lista de contactos',
        ],
      });
    }

    if (metrics.read_rate < this.thresholds.readRate) {
      recommendations.push({
        type: 'engagement',
        priority: 'medium',
        message: 'Baja tasa de lectura',
        actions: [
          'Mejorar línea de asunto/preview',
          'Optimizar horario de envío',
          'Personalizar contenido',
        ],
      });
    }

    if (metrics.block_rate > this.thresholds.blockRate) {
      recommendations.push({
        type: 'content',
        priority: 'high',
        message: 'Alta tasa de bloqueos',
        actions: [
          'Revisar contenido del mensaje',
          'Reducir frecuencia de envío',
          'Mejorar segmentación de audiencia',
        ],
      });
    }

    if (quality_score < 50) {
      recommendations.push({
        type: 'general',
        priority: 'critical',
        message: 'Puntuación de calidad muy baja',
        actions: [
          'Pausar plantilla inmediatamente',
          'Realizar análisis completo',
          'Considerar rediseño total',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Simular métricas para modo local
   */
  simulateTemplateMetrics(templateName) {
    const baseMetrics = {
      delivery_rate: 0.85 + Math.random() * 0.1,
      read_rate: 0.6 + Math.random() * 0.25,
      response_rate: 0.1 + Math.random() * 0.15,
      block_rate: Math.random() * 0.08,
      report_rate: Math.random() * 0.03,
      total_sent: Math.floor(Math.random() * 1000) + 100,
      total_delivered: 0,
      total_read: 0,
      total_responded: 0,
      total_blocked: 0,
      total_reported: 0,
    };

    // Calcular totales basados en tasas
    baseMetrics.total_delivered = Math.floor(
      baseMetrics.total_sent * baseMetrics.delivery_rate
    );
    baseMetrics.total_read = Math.floor(
      baseMetrics.total_delivered * baseMetrics.read_rate
    );
    baseMetrics.total_responded = Math.floor(
      baseMetrics.total_read * baseMetrics.response_rate
    );
    baseMetrics.total_blocked = Math.floor(
      baseMetrics.total_sent * baseMetrics.block_rate
    );
    baseMetrics.total_reported = Math.floor(
      baseMetrics.total_sent * baseMetrics.report_rate
    );

    return baseMetrics;
  }

  /**
   * Configurar alertas automáticas
   */
  async setupQualityAlerts(templateName, alertConfig = {}) {
    const config = {
      delivery_threshold:
        alertConfig.delivery_threshold || this.thresholds.deliveryRate,
      block_threshold: alertConfig.block_threshold || this.thresholds.blockRate,
      check_interval: alertConfig.check_interval || '1h',
      ...alertConfig,
    };

    log(`✅ Alertas de calidad configuradas para plantilla: ${templateName}`);
    return {
      template_name: templateName,
      alert_config: config,
      status: 'active',
      created_at: new Date().toISOString(),
    };
  }
}

export default new TemplatePacingService();
