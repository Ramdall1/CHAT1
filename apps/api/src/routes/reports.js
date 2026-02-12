import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import ReportsService from '../services/ReportsService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware para validar parámetros
const validateReportParams = (req, res, next) => {
  const { templateId } = req.body;
  if (!templateId) {
    return res.status(400).json({
      success: false,
      error: 'templateId is required',
    });
  }
  next();
};

const validateScheduleParams = (req, res, next) => {
  const { templateId, schedule } = req.body;
  if (!templateId || !schedule) {
    return res.status(400).json({
      success: false,
      error: 'templateId and schedule are required',
    });
  }
  next();
};

// Middleware para manejo de errores
const handleError = (error, req, res, next) => {
  logger.error('Reports API Error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
};

// ==================== PLANTILLAS DE REPORTES ====================

// Obtener todas las plantillas de reportes
router.get('/templates', async (req, res) => {
  try {
    const templates = await ReportsService.getReportTemplates();
    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Crear nueva plantilla de reporte
router.post('/templates', async (req, res) => {
  try {
    const { id, name, description, type, fields, filters, charts } = req.body;

    if (!id || !name || !type) {
      return res.status(400).json({
        success: false,
        error: 'id, name, and type are required',
      });
    }

    const template = await ReportsService.createReportTemplate({
      id,
      name,
      description,
      type,
      fields,
      filters,
      charts,
    });

    res.status(201).json({
      success: true,
      template,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== GENERACIÓN DE REPORTES ====================

// Crear nuevo reporte
router.post('/generate', validateReportParams, async (req, res) => {
  try {
    const { templateId, options = {} } = req.body;

    const report = await ReportsService.createReport(templateId, options);

    res.status(201).json({
      success: true,
      report: {
        id: report.id,
        templateId: report.templateId,
        templateName: report.template.name,
        createdAt: report.createdAt,
        recordCount: report.data ? report.data.length : 0,
        status: report.status,
      },
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Obtener lista de reportes
router.get('/', async (req, res) => {
  try {
    const { limit, offset, templateId } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      templateId,
    };

    const result = await ReportsService.getReports(options);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Obtener reporte específico
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { includeData = 'false' } = req.query;

    const reportPath = path.join(
      ReportsService.reportsDir,
      'exports',
      `${reportId}.json`
    );

    if (!(await fs.pathExists(reportPath))) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const report = await fs.readJson(reportPath);

    // Si no se solicitan los datos, excluirlos para reducir el tamaño de respuesta
    if (includeData !== 'true') {
      delete report.data;
    }

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Eliminar reporte
router.delete('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    await ReportsService.deleteReport(reportId);

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== EXPORTACIÓN ====================

// Exportar reporte en formato específico
router.post('/:reportId/export', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'csv', options = {} } = req.body;

    if (!['csv', 'excel', 'pdf', 'json'].includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export format. Supported: csv, excel, pdf, json',
      });
    }

    const result = await ReportsService.exportReport(reportId, format, options);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Descargar archivo exportado
router.get('/:reportId/download/:format', async (req, res) => {
  try {
    const { reportId, format } = req.params;

    let filename;
    switch (format.toLowerCase()) {
      case 'csv':
        filename = `${reportId}.csv`;
        break;
      case 'excel':
        filename = `${reportId}.xlsx`;
        break;
      case 'pdf':
        filename = `${reportId}.pdf`;
        break;
      case 'json':
        filename = `${reportId}_export.json`;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid format',
        });
    }

    const filePath = path.join(ReportsService.reportsDir, 'exports', filename);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found',
      });
    }

    res.download(filePath, filename);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Exportación masiva
router.post('/bulk-export', async (req, res) => {
  try {
    const { reportIds, format = 'zip' } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reportIds array is required',
      });
    }

    const result = await ReportsService.createBulkExport(reportIds, format);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Descargar exportación masiva
router.get('/bulk-export/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(ReportsService.reportsDir, 'exports', filename);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: 'Bulk export file not found',
      });
    }

    res.download(filePath, filename);
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== REPORTES PROGRAMADOS ====================

// Obtener reportes programados
router.get('/scheduled/list', async (req, res) => {
  try {
    const scheduledReports = await ReportsService.getScheduledReports();

    res.json({
      success: true,
      scheduledReports,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Crear reporte programado
router.post('/scheduled', validateScheduleParams, async (req, res) => {
  try {
    const { templateId, schedule, options = {} } = req.body;

    const scheduledReport = await ReportsService.scheduleReport(
      templateId,
      schedule,
      options
    );

    res.status(201).json({
      success: true,
      scheduledReport: {
        id: scheduledReport.id,
        templateId: scheduledReport.templateId,
        schedule: scheduledReport.schedule,
        options: scheduledReport.options,
        createdAt: scheduledReport.createdAt,
        isActive: scheduledReport.isActive,
      },
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Actualizar reporte programado
router.put('/scheduled/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;

    const scheduledReport = await ReportsService.updateScheduledReport(
      scheduleId,
      updates
    );

    res.json({
      success: true,
      scheduledReport: {
        id: scheduledReport.id,
        templateId: scheduledReport.templateId,
        schedule: scheduledReport.schedule,
        options: scheduledReport.options,
        createdAt: scheduledReport.createdAt,
        lastRun: scheduledReport.lastRun,
        isActive: scheduledReport.isActive,
      },
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Eliminar reporte programado
router.delete('/scheduled/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;

    await ReportsService.deleteScheduledReport(scheduleId);

    res.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Activar/desactivar reporte programado
router.post('/scheduled/:scheduleId/toggle', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { isActive } = req.body;

    const scheduledReport = await ReportsService.updateScheduledReport(
      scheduleId,
      { isActive }
    );

    res.json({
      success: true,
      scheduledReport: {
        id: scheduledReport.id,
        isActive: scheduledReport.isActive,
      },
      message: `Scheduled report ${isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== ESTADÍSTICAS Y MONITOREO ====================

// Obtener estadísticas de reportes
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await ReportsService.getReportStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Obtener estadísticas de uso por plantilla
router.get('/stats/templates', async (req, res) => {
  try {
    const reports = await ReportsService.getReports({ limit: 1000 });

    // Agrupar por templateId
    const templateStats = {};
    reports.reports.forEach(report => {
      if (!templateStats[report.templateId]) {
        templateStats[report.templateId] = {
          templateId: report.templateId,
          templateName: report.templateName,
          count: 0,
          lastGenerated: null,
        };
      }

      templateStats[report.templateId].count++;

      if (
        !templateStats[report.templateId].lastGenerated ||
        new Date(report.createdAt) >
          new Date(templateStats[report.templateId].lastGenerated)
      ) {
        templateStats[report.templateId].lastGenerated = report.createdAt;
      }
    });

    res.json({
      success: true,
      templateStats: Object.values(templateStats),
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Obtener estadísticas de exportación por formato
router.get('/stats/exports', async (req, res) => {
  try {
    const exportDir = path.join(ReportsService.reportsDir, 'exports');
    const files = await fs.readdir(exportDir);

    const formatStats = {
      csv: 0,
      excel: 0,
      pdf: 0,
      json: 0,
      zip: 0,
    };

    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      switch (ext) {
        case '.csv':
          formatStats.csv++;
          break;
        case '.xlsx':
          formatStats.excel++;
          break;
        case '.pdf':
          formatStats.pdf++;
          break;
        case '.json':
          if (file.endsWith('_export.json')) {
            formatStats.json++;
          }
          break;
        case '.zip':
          formatStats.zip++;
          break;
      }
    });

    res.json({
      success: true,
      formatStats,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== UTILIDADES ====================

// Validar formato de cron
router.post('/validate-cron', async (req, res) => {
  try {
    const { schedule } = req.body;

    if (!schedule) {
      return res.status(400).json({
        success: false,
        error: 'schedule is required',
      });
    }

    const cron = await import('node-cron');
    const isValid = cron.validate(schedule);

    res.json({
      success: true,
      isValid,
      schedule,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Obtener formatos de exportación disponibles
router.get('/export-formats', async (req, res) => {
  try {
    const formats = [
      {
        id: 'csv',
        name: 'CSV',
        description: 'Comma-separated values',
        extension: '.csv',
        mimeType: 'text/csv',
      },
      {
        id: 'excel',
        name: 'Excel',
        description: 'Microsoft Excel spreadsheet',
        extension: '.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      {
        id: 'pdf',
        name: 'PDF',
        description: 'Portable Document Format',
        extension: '.pdf',
        mimeType: 'application/pdf',
      },
      {
        id: 'json',
        name: 'JSON',
        description: 'JavaScript Object Notation',
        extension: '.json',
        mimeType: 'application/json',
      },
    ];

    res.json({
      success: true,
      formats,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Health check del servicio de reportes
router.get('/health', async (req, res) => {
  try {
    const isInitialized = ReportsService.isInitialized;
    const stats = await ReportsService.getReportStats();

    res.json({
      success: true,
      status: isInitialized ? 'healthy' : 'initializing',
      service: 'ReportsService',
      timestamp: new Date(),
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      service: 'ReportsService',
      timestamp: new Date(),
      error: error.message,
    });
  }
});

// Limpiar archivos antiguos
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );

    const exportDir = path.join(ReportsService.reportsDir, 'exports');
    const files = await fs.readdir(exportDir);

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(exportDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.remove(filePath);
        deletedCount++;
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old files`,
      deletedCount,
      cutoffDate,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==================== PREVIEW DE DATOS ====================

// Vista previa de datos para una plantilla
router.post('/preview', async (req, res) => {
  try {
    const { templateId, options = {} } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId is required',
      });
    }

    // Generar datos de muestra (limitados)
    const previewOptions = {
      ...options,
      limit: 10, // Limitar a 10 registros para preview
    };

    const report = await ReportsService.createReport(
      templateId,
      previewOptions
    );

    // Tomar solo los primeros 10 registros para preview
    const previewData = report.data ? report.data.slice(0, 10) : [];

    res.json({
      success: true,
      preview: {
        templateId,
        templateName: report.template.name,
        sampleData: previewData,
        totalFields:
          report.data && report.data.length > 0
            ? Object.keys(report.data[0]).length
            : 0,
        estimatedRecords: report.data ? report.data.length : 0,
      },
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;
