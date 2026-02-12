/**
 * Rutas para Template Pacing Service
 * Endpoints para monitorear calidad y rendimiento de plantillas
 */

import express from 'express';
import TemplatePacingService from '../services/TemplatePacingService.js';
import { log } from '../core/logger.js';

const router = express.Router();

/**
 * GET /api/template-pacing/metrics/:templateName
 * Obtener métricas de calidad de una plantilla específica
 */
router.get('/metrics/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { timeRange = '7d' } = req.query;

    log(`📊 Obteniendo métricas de calidad para plantilla: ${templateName}`);

    const metrics = await TemplatePacingService.getTemplateQualityMetrics(
      templateName,
      timeRange
    );
    const qualityScore = TemplatePacingService.calculateQualityScore(metrics);
    const status = TemplatePacingService.evaluateTemplateStatus(metrics);
    const recommendations =
      TemplatePacingService.getOptimizationRecommendations({
        metrics,
        quality_score: qualityScore,
      });

    res.json({
      success: true,
      data: {
        template_name: templateName,
        time_range: timeRange,
        quality_score: Math.round(qualityScore),
        status: status,
        metrics: metrics,
        recommendations: recommendations,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    log(`❌ Error obteniendo métricas de plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas de plantilla',
      details: error.message,
    });
  }
});

/**
 * GET /api/template-pacing/report
 * Obtener reporte completo de calidad de todas las plantillas
 */
router.get('/report', async (req, res) => {
  try {
    log('📋 Generando reporte completo de calidad de plantillas');

    const report = await TemplatePacingService.getTemplateQualityReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    log(`❌ Error generando reporte de calidad: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error generando reporte de calidad',
      details: error.message,
    });
  }
});

/**
 * POST /api/template-pacing/alerts/:templateName
 * Configurar alertas de calidad para una plantilla
 */
router.post('/alerts/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const alertConfig = req.body;

    log(`🔔 Configurando alertas para plantilla: ${templateName}`);

    const alertSetup = await TemplatePacingService.setupQualityAlerts(
      templateName,
      alertConfig
    );

    res.json({
      success: true,
      data: alertSetup,
      message: `Alertas configuradas exitosamente para ${templateName}`,
    });
  } catch (error) {
    log(`❌ Error configurando alertas: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error configurando alertas',
      details: error.message,
    });
  }
});

/**
 * GET /api/template-pacing/dashboard
 * Obtener datos para dashboard de calidad de plantillas
 */
router.get('/dashboard', async (req, res) => {
  try {
    log('📊 Generando datos para dashboard de calidad');

    const report = await TemplatePacingService.getTemplateQualityReport();

    // Preparar datos para dashboard
    const dashboardData = {
      overview: {
        total_templates: report.total_templates,
        summary: report.summary,
        average_quality:
          report.templates.length > 0
            ? Math.round(
                report.templates.reduce((sum, t) => sum + t.quality_score, 0) /
                  report.templates.length
              )
            : 0,
      },
      top_performers: report.templates
        .filter(
          t => t.quality_status === 'EXCELLENT' || t.quality_status === 'GOOD'
        )
        .slice(0, 5),
      needs_attention: report.templates
        .filter(
          t => t.quality_status === 'WARNING' || t.quality_status === 'CRITICAL'
        )
        .slice(0, 5),
      metrics_trends: {
        delivery_rates: report.templates.map(t => ({
          name: t.name,
          rate: Math.round(t.metrics.delivery_rate * 100),
        })),
        engagement_rates: report.templates.map(t => ({
          name: t.name,
          rate: Math.round(t.metrics.read_rate * 100),
        })),
      },
      generated_at: report.generated_at,
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    log(`❌ Error generando dashboard: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error generando dashboard',
      details: error.message,
    });
  }
});

/**
 * GET /api/template-pacing/recommendations/:templateName
 * Obtener recomendaciones específicas para una plantilla
 */
router.get('/recommendations/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;

    log(`💡 Obteniendo recomendaciones para plantilla: ${templateName}`);

    const metrics =
      await TemplatePacingService.getTemplateQualityMetrics(templateName);
    const qualityScore = TemplatePacingService.calculateQualityScore(metrics);
    const recommendations =
      TemplatePacingService.getOptimizationRecommendations({
        metrics,
        quality_score: qualityScore,
      });

    res.json({
      success: true,
      data: {
        template_name: templateName,
        quality_score: Math.round(qualityScore),
        recommendations: recommendations,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    log(`❌ Error obteniendo recomendaciones: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo recomendaciones',
      details: error.message,
    });
  }
});

/**
 * POST /api/template-pacing/analyze
 * Analizar múltiples plantillas específicas
 */
router.post('/analyze', async (req, res) => {
  try {
    const { template_names, time_range = '7d' } = req.body;

    if (!template_names || !Array.isArray(template_names)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de nombres de plantillas',
      });
    }

    log(`🔍 Analizando ${template_names.length} plantillas específicas`);

    const results = [];

    for (const templateName of template_names) {
      try {
        const metrics = await TemplatePacingService.getTemplateQualityMetrics(
          templateName,
          time_range
        );
        const qualityScore =
          TemplatePacingService.calculateQualityScore(metrics);
        const status = TemplatePacingService.evaluateTemplateStatus(metrics);

        results.push({
          template_name: templateName,
          quality_score: Math.round(qualityScore),
          status: status.status,
          metrics: metrics,
          evaluation: status,
        });
      } catch (error) {
        results.push({
          template_name: templateName,
          error: error.message,
          status: 'ERROR',
        });
      }
    }

    res.json({
      success: true,
      data: {
        analyzed_templates: results.length,
        time_range: time_range,
        results: results,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    log(`❌ Error en análisis de plantillas: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error en análisis de plantillas',
      details: error.message,
    });
  }
});

export default router;
