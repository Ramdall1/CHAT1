import fs from 'fs-extra';
import path from 'path';
import cron from 'node-cron';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import archiver from 'archiver';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class ReportsService {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'data', 'reports');
    this.scheduledReports = new Map();
    this.reportTemplates = new Map();
    this.exportFormats = ['csv', 'excel', 'pdf', 'json'];
    this.emailTransporter = null;
    this.isInitialized = false;

    this.initializeService();
  }

  async initializeService() {
    try {
      // Crear directorio de reportes
      await fs.ensureDir(this.reportsDir);
      await fs.ensureDir(path.join(this.reportsDir, 'scheduled'));
      await fs.ensureDir(path.join(this.reportsDir, 'exports'));
      await fs.ensureDir(path.join(this.reportsDir, 'templates'));

      // Cargar configuraciones guardadas
      await this.loadScheduledReports();
      await this.loadReportTemplates();

      // Configurar transporter de email
      await this.setupEmailTransporter();

      // Inicializar plantillas predeterminadas
      await this.initializeDefaultTemplates();

      this.isInitialized = true;
      logger.info('ReportsService initialized successfully');
    } catch (error) {
      logger.error('Error initializing ReportsService:', error);
      throw error;
    }
  }

  async setupEmailTransporter() {
    try {
      // Configuración básica para desarrollo/testing
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'localhost',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
    } catch (error) {
      logger.warn('Email transporter setup failed:', error.message);
    }
  }

  async initializeDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'messages_summary',
        name: 'Resumen de Mensajes',
        description:
          'Resumen diario/semanal/mensual de mensajes enviados y recibidos',
        type: 'messages',
        fields: [
          'date',
          'sent_count',
          'received_count',
          'failed_count',
          'success_rate',
        ],
        filters: ['date_range', 'status', 'contact_group'],
        charts: ['line_chart', 'pie_chart'],
      },
      {
        id: 'contacts_report',
        name: 'Reporte de Contactos',
        description: 'Análisis de contactos activos, nuevos y segmentación',
        type: 'contacts',
        fields: ['name', 'phone', 'last_interaction', 'tags', 'status'],
        filters: ['tags', 'status', 'date_range'],
        charts: ['bar_chart', 'pie_chart'],
      },
      {
        id: 'templates_usage',
        name: 'Uso de Plantillas',
        description: 'Estadísticas de uso de plantillas de mensajes',
        type: 'templates',
        fields: ['template_name', 'usage_count', 'success_rate', 'last_used'],
        filters: ['template_type', 'date_range'],
        charts: ['bar_chart', 'line_chart'],
      },
      {
        id: 'performance_analytics',
        name: 'Análisis de Rendimiento',
        description: 'Métricas de rendimiento del sistema y APIs',
        type: 'performance',
        fields: ['endpoint', 'response_time', 'success_rate', 'error_count'],
        filters: ['endpoint', 'date_range', 'status_code'],
        charts: ['line_chart', 'heatmap'],
      },
      {
        id: 'automation_report',
        name: 'Reporte de Automatización',
        description: 'Estadísticas de flujos automatizados y respuestas',
        type: 'automation',
        fields: ['flow_name', 'triggers', 'completions', 'conversion_rate'],
        filters: ['flow_type', 'date_range'],
        charts: ['funnel_chart', 'bar_chart'],
      },
    ];

    for (const template of defaultTemplates) {
      this.reportTemplates.set(template.id, template);
    }

    await this.saveReportTemplates();
  }

  async createReport(templateId, options = {}) {
    try {
      const template = this.reportTemplates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      const reportData = await this.generateReportData(template, options);
      const reportId = `${templateId}_${Date.now()}`;

      const report = {
        id: reportId,
        templateId,
        template,
        data: reportData,
        options,
        createdAt: new Date(),
        status: 'completed',
      };

      // Guardar reporte
      const reportPath = path.join(
        this.reportsDir,
        'exports',
        `${reportId}.json`
      );
      await fs.writeJson(reportPath, report, { spaces: 2 });

      logger.info(`Report ${reportId} created successfully`);
      return report;
    } catch (error) {
      logger.error('Error creating report:', error);
      throw error;
    }
  }

  async generateReportData(template, options) {
    const { type, fields, filters } = template;
    const { dateRange, customFilters = {} } = options;

    let data = [];

    switch (type) {
      case 'messages':
        data = await this.getMessagesData(dateRange, customFilters);
        break;
      case 'contacts':
        data = await this.getContactsData(dateRange, customFilters);
        break;
      case 'templates':
        data = await this.getTemplatesData(dateRange, customFilters);
        break;
      case 'performance':
        data = await this.getPerformanceData(dateRange, customFilters);
        break;
      case 'automation':
        data = await this.getAutomationData(dateRange, customFilters);
        break;
      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    // Aplicar filtros de campos
    if (fields && fields.length > 0) {
      data = data.map(item => {
        const filteredItem = {};
        fields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filteredItem[field] = item[field];
          }
        });
        return filteredItem;
      });
    }

    return data;
  }

  async getMessagesData(dateRange, filters) {
    // Simular datos de mensajes
    const data = [];
    const startDate = dateRange?.start
      ? new Date(dateRange.start)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end ? new Date(dateRange.end) : new Date();

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      data.push({
        date: d.toISOString().split('T')[0],
        sent_count: Math.floor(Math.random() * 100) + 50,
        received_count: Math.floor(Math.random() * 80) + 30,
        failed_count: Math.floor(Math.random() * 10),
        success_rate: (Math.random() * 0.2 + 0.8).toFixed(2),
      });
    }

    return data;
  }

  async getContactsData(dateRange, filters) {
    // Simular datos de contactos
    const contacts = [];
    for (let i = 1; i <= 100; i++) {
      contacts.push({
        name: `Contact ${i}`,
        phone: `+1234567${String(i).padStart(3, '0')}`,
        last_interaction: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        tags: ['customer', 'active'].slice(
          0,
          Math.floor(Math.random() * 2) + 1
        ),
        status: Math.random() > 0.2 ? 'active' : 'inactive',
      });
    }
    return contacts;
  }

  async getTemplatesData(dateRange, filters) {
    // Simular datos de plantillas
    const templates = [
      'welcome_message',
      'order_confirmation',
      'support_response',
      'promotional_offer',
      'appointment_reminder',
      'feedback_request',
    ];

    return templates.map(name => ({
      template_name: name,
      usage_count: Math.floor(Math.random() * 500) + 100,
      success_rate: (Math.random() * 0.3 + 0.7).toFixed(2),
      last_used: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    }));
  }

  async getPerformanceData(dateRange, filters) {
    // Simular datos de rendimiento
    const endpoints = [
      '/api/send',
      '/api/contacts',
      '/api/templates',
      '/api/automation',
    ];

    return endpoints.map(endpoint => ({
      endpoint,
      response_time: Math.floor(Math.random() * 500) + 50,
      success_rate: (Math.random() * 0.1 + 0.9).toFixed(2),
      error_count: Math.floor(Math.random() * 20),
    }));
  }

  async getAutomationData(dateRange, filters) {
    // Simular datos de automatización
    const flows = [
      'Welcome Flow',
      'Support Flow',
      'Sales Flow',
      'Feedback Flow',
    ];

    return flows.map(flow_name => ({
      flow_name,
      triggers: Math.floor(Math.random() * 200) + 50,
      completions: Math.floor(Math.random() * 150) + 30,
      conversion_rate: (Math.random() * 0.4 + 0.6).toFixed(2),
    }));
  }

  async exportReport(reportId, format, options = {}) {
    try {
      const reportPath = path.join(
        this.reportsDir,
        'exports',
        `${reportId}.json`
      );
      const report = await fs.readJson(reportPath);

      let exportPath;
      let exportData;

      switch (format.toLowerCase()) {
        case 'csv':
          exportPath = await this.exportToCSV(report, options);
          break;
        case 'excel':
          exportPath = await this.exportToExcel(report, options);
          break;
        case 'pdf':
          exportPath = await this.exportToPDF(report, options);
          break;
        case 'json':
          exportPath = await this.exportToJSON(report, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        exportPath,
        format,
        reportId,
      };
    } catch (error) {
      logger.error('Error exporting report:', error);
      throw error;
    }
  }

  async exportToCSV(report, options) {
    const filename = `${report.id}.csv`;
    const exportPath = path.join(this.reportsDir, 'exports', filename);

    if (!report.data || report.data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(report.data[0]).map(key => ({
      id: key,
      title: key.replace(/_/g, ' ').toUpperCase(),
    }));

    const csvWriter = createObjectCsvWriter({
      path: exportPath,
      header: headers,
    });

    await csvWriter.writeRecords(report.data);
    return exportPath;
  }

  async exportToExcel(report, options) {
    const filename = `${report.id}.xlsx`;
    const exportPath = path.join(this.reportsDir, 'exports', filename);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(report.template.name);

    if (report.data && report.data.length > 0) {
      // Agregar headers
      const headers = Object.keys(report.data[0]);
      worksheet.addRow(headers.map(h => h.replace(/_/g, ' ').toUpperCase()));

      // Agregar datos
      report.data.forEach(row => {
        worksheet.addRow(headers.map(h => row[h]));
      });

      // Formatear headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    await workbook.xlsx.writeFile(exportPath);
    return exportPath;
  }

  async exportToPDF(report, options) {
    const filename = `${report.id}.pdf`;
    const exportPath = path.join(this.reportsDir, 'exports', filename);

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(exportPath));

    // Título
    doc.fontSize(20).text(report.template.name, 50, 50);
    doc
      .fontSize(12)
      .text(`Generado: ${new Date(report.createdAt).toLocaleString()}`, 50, 80);
    doc.text(`Descripción: ${report.template.description}`, 50, 100);

    // Datos
    if (report.data && report.data.length > 0) {
      let y = 140;
      const headers = Object.keys(report.data[0]);

      // Headers
      doc.fontSize(10).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header.replace(/_/g, ' ').toUpperCase(), 50 + i * 100, y);
      });

      y += 20;
      doc.font('Helvetica');

      // Datos (primeros 50 registros)
      report.data.slice(0, 50).forEach(row => {
        headers.forEach((header, i) => {
          doc.text(String(row[header] || ''), 50 + i * 100, y);
        });
        y += 15;

        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });

      if (report.data.length > 50) {
        doc.text(`... y ${report.data.length - 50} registros más`, 50, y + 20);
      }
    }

    doc.end();
    return exportPath;
  }

  async exportToJSON(report, options) {
    const filename = `${report.id}_export.json`;
    const exportPath = path.join(this.reportsDir, 'exports', filename);

    const exportData = {
      report: {
        id: report.id,
        template: report.template,
        createdAt: report.createdAt,
        options: report.options,
      },
      data: report.data,
      metadata: {
        totalRecords: report.data ? report.data.length : 0,
        exportedAt: new Date(),
        format: 'json',
      },
    };

    await fs.writeJson(exportPath, exportData, { spaces: 2 });
    return exportPath;
  }

  async scheduleReport(templateId, schedule, options = {}) {
    try {
      const template = this.reportTemplates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      const scheduleId = `${templateId}_${Date.now()}`;
      const scheduledReport = {
        id: scheduleId,
        templateId,
        schedule,
        options,
        createdAt: new Date(),
        lastRun: null,
        nextRun: null,
        isActive: true,
      };

      // Validar y programar cron job
      if (!cron.validate(schedule)) {
        throw new Error('Invalid cron schedule format');
      }

      const task = cron.schedule(
        schedule,
        async () => {
          try {
            logger.info(`Running scheduled report: ${scheduleId}`);
            const report = await this.createReport(templateId, options);

            // Exportar en formatos especificados
            if (options.exportFormats) {
              for (const format of options.exportFormats) {
                await this.exportReport(report.id, format);
              }
            }

            // Enviar por email si está configurado
            if (options.emailRecipients && this.emailTransporter) {
              await this.sendReportByEmail(
                report,
                options.emailRecipients,
                options.exportFormats
              );
            }

            scheduledReport.lastRun = new Date();
            await this.saveScheduledReports();

            logger.info(
              `Scheduled report ${scheduleId} completed successfully`
            );
          } catch (error) {
            logger.error(`Error in scheduled report ${scheduleId}:`, error);
          }
        },
        {
          scheduled: false,
        }
      );

      scheduledReport.task = task;
      this.scheduledReports.set(scheduleId, scheduledReport);

      task.start();
      await this.saveScheduledReports();

      logger.info(`Report scheduled successfully: ${scheduleId}`);
      return scheduledReport;
    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw error;
    }
  }

  async sendReportByEmail(report, recipients, formats = ['pdf']) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const attachments = [];

      // Exportar y adjuntar archivos
      for (const format of formats) {
        const exportPath = await this.exportReport(report.id, format);
        attachments.push({
          filename: path.basename(exportPath),
          path: exportPath,
        });
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'reports@chatbot.com',
        to: recipients.join(', '),
        subject: `Reporte Automático: ${report.template.name}`,
        html: `
                    <h2>${report.template.name}</h2>
                    <p><strong>Descripción:</strong> ${report.template.description}</p>
                    <p><strong>Generado:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
                    <p><strong>Registros:</strong> ${report.data ? report.data.length : 0}</p>
                    <p>Los archivos del reporte están adjuntos a este email.</p>
                `,
        attachments,
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Report sent by email to: ${recipients.join(', ')}`);
    } catch (error) {
      logger.error('Error sending report by email:', error);
      throw error;
    }
  }

  async getScheduledReports() {
    const reports = Array.from(this.scheduledReports.values()).map(report => ({
      id: report.id,
      templateId: report.templateId,
      schedule: report.schedule,
      options: report.options,
      createdAt: report.createdAt,
      lastRun: report.lastRun,
      isActive: report.isActive,
    }));

    return reports;
  }

  async updateScheduledReport(scheduleId, updates) {
    const scheduledReport = this.scheduledReports.get(scheduleId);
    if (!scheduledReport) {
      throw new Error(`Scheduled report ${scheduleId} not found`);
    }

    // Detener tarea actual
    if (scheduledReport.task) {
      scheduledReport.task.stop();
    }

    // Actualizar configuración
    Object.assign(scheduledReport, updates);

    // Reprogramar si el schedule cambió
    if (updates.schedule) {
      if (!cron.validate(updates.schedule)) {
        throw new Error('Invalid cron schedule format');
      }

      const task = cron.schedule(
        updates.schedule,
        async () => {
          // Lógica de ejecución (igual que en scheduleReport)
        },
        { scheduled: false }
      );

      scheduledReport.task = task;
      if (scheduledReport.isActive) {
        task.start();
      }
    }

    await this.saveScheduledReports();
    return scheduledReport;
  }

  async deleteScheduledReport(scheduleId) {
    const scheduledReport = this.scheduledReports.get(scheduleId);
    if (!scheduledReport) {
      throw new Error(`Scheduled report ${scheduleId} not found`);
    }

    // Detener tarea
    if (scheduledReport.task) {
      scheduledReport.task.stop();
    }

    this.scheduledReports.delete(scheduleId);
    await this.saveScheduledReports();

    logger.info(`Scheduled report ${scheduleId} deleted`);
    return true;
  }

  async createReportTemplate(template) {
    const { id, name, description, type, fields, filters, charts } = template;

    if (this.reportTemplates.has(id)) {
      throw new Error(`Template ${id} already exists`);
    }

    const newTemplate = {
      id,
      name,
      description,
      type,
      fields: fields || [],
      filters: filters || [],
      charts: charts || [],
      createdAt: new Date(),
      isCustom: true,
    };

    this.reportTemplates.set(id, newTemplate);
    await this.saveReportTemplates();

    logger.info(`Report template ${id} created`);
    return newTemplate;
  }

  async getReportTemplates() {
    return Array.from(this.reportTemplates.values());
  }

  async getReports(options = {}) {
    const { limit = 50, offset = 0, templateId } = options;
    const reportsDir = path.join(this.reportsDir, 'exports');

    try {
      const files = await fs.readdir(reportsDir);
      const jsonFiles = files.filter(
        f => f.endsWith('.json') && !f.endsWith('_export.json')
      );

      const reports = [];
      for (const file of jsonFiles) {
        try {
          const reportPath = path.join(reportsDir, file);
          const report = await fs.readJson(reportPath);

          if (!templateId || report.templateId === templateId) {
            reports.push({
              id: report.id,
              templateId: report.templateId,
              templateName: report.template.name,
              createdAt: report.createdAt,
              recordCount: report.data ? report.data.length : 0,
              status: report.status,
            });
          }
        } catch (error) {
          logger.warn(`Error reading report file ${file}:`, error.message);
        }
      }

      // Ordenar por fecha de creación (más recientes primero)
      reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Aplicar paginación
      const paginatedReports = reports.slice(offset, offset + limit);

      return {
        reports: paginatedReports,
        total: reports.length,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Error getting reports:', error);
      return { reports: [], total: 0, limit, offset };
    }
  }

  async deleteReport(reportId) {
    try {
      const reportPath = path.join(
        this.reportsDir,
        'exports',
        `${reportId}.json`
      );
      await fs.remove(reportPath);

      // Eliminar archivos exportados relacionados
      const exportFiles = [
        `${reportId}.csv`,
        `${reportId}.xlsx`,
        `${reportId}.pdf`,
        `${reportId}_export.json`,
      ];

      for (const file of exportFiles) {
        const filePath = path.join(this.reportsDir, 'exports', file);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      logger.info(`Report ${reportId} deleted`);
      return true;
    } catch (error) {
      logger.error('Error deleting report:', error);
      throw error;
    }
  }

  async getReportStats() {
    try {
      const reports = await this.getReports({ limit: 1000 });
      const scheduledReports = await this.getScheduledReports();
      const templates = await this.getReportTemplates();

      const stats = {
        totalReports: reports.total,
        scheduledReports: scheduledReports.length,
        activeScheduledReports: scheduledReports.filter(r => r.isActive).length,
        templates: templates.length,
        customTemplates: templates.filter(t => t.isCustom).length,
        reportsThisMonth: reports.reports.filter(r => {
          const reportDate = new Date(r.createdAt);
          const now = new Date();
          return (
            reportDate.getMonth() === now.getMonth() &&
            reportDate.getFullYear() === now.getFullYear()
          );
        }).length,
      };

      return stats;
    } catch (error) {
      logger.error('Error getting report stats:', error);
      return {
        totalReports: 0,
        scheduledReports: 0,
        activeScheduledReports: 0,
        templates: 0,
        customTemplates: 0,
        reportsThisMonth: 0,
      };
    }
  }

  async saveScheduledReports() {
    try {
      const data = Array.from(this.scheduledReports.entries()).map(
        ([id, report]) => ({
          id,
          templateId: report.templateId,
          schedule: report.schedule,
          options: report.options,
          createdAt: report.createdAt,
          lastRun: report.lastRun,
          isActive: report.isActive,
        })
      );

      const filePath = path.join(this.reportsDir, 'scheduled_reports.json');
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      logger.error('Error saving scheduled reports:', error);
    }
  }

  async loadScheduledReports() {
    try {
      const filePath = path.join(this.reportsDir, 'scheduled_reports.json');
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);

        for (const report of data) {
          if (report.isActive && cron.validate(report.schedule)) {
            // Recrear cron job
            const task = cron.schedule(
              report.schedule,
              async () => {
                // Lógica de ejecución
              },
              { scheduled: false }
            );

            report.task = task;
            task.start();
          }

          this.scheduledReports.set(report.id, report);
        }
      }
    } catch (error) {
      logger.error('Error loading scheduled reports:', error);
    }
  }

  async saveReportTemplates() {
    try {
      const data = Array.from(this.reportTemplates.values());
      const filePath = path.join(this.reportsDir, 'templates.json');
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      logger.error('Error saving report templates:', error);
    }
  }

  async loadReportTemplates() {
    try {
      const filePath = path.join(this.reportsDir, 'templates.json');
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);

        for (const template of data) {
          this.reportTemplates.set(template.id, template);
        }
      }
    } catch (error) {
      logger.error('Error loading report templates:', error);
    }
  }

  async createBulkExport(reportIds, format = 'zip') {
    try {
      const timestamp = Date.now();
      const exportDir = path.join(this.reportsDir, 'exports');
      const zipPath = path.join(exportDir, `bulk_export_${timestamp}.zip`);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      for (const reportId of reportIds) {
        const reportPath = path.join(exportDir, `${reportId}.json`);
        if (await fs.pathExists(reportPath)) {
          const report = await fs.readJson(reportPath);

          // Agregar JSON del reporte
          archive.append(JSON.stringify(report, null, 2), {
            name: `${reportId}/${reportId}.json`,
          });

          // Agregar exportaciones existentes
          const exportFormats = ['csv', 'xlsx', 'pdf'];
          for (const fmt of exportFormats) {
            const exportPath = path.join(
              exportDir,
              `${reportId}.${fmt === 'xlsx' ? 'xlsx' : fmt}`
            );
            if (await fs.pathExists(exportPath)) {
              archive.file(exportPath, {
                name: `${reportId}/${reportId}.${fmt}`,
              });
            }
          }
        }
      }

      await archive.finalize();

      return {
        success: true,
        exportPath: zipPath,
        filename: `bulk_export_${timestamp}.zip`,
      };
    } catch (error) {
      logger.error('Error creating bulk export:', error);
      throw error;
    }
  }
}

export default new ReportsService();
