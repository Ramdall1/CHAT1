/**
 * =====================================================
 * ChatBot Enterprise - Report Service
 * =====================================================
 * 
 * Servicio para generar reportes detallados de métricas,
 * KPIs y análisis de negocio en múltiples formatos.
 */

import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getPrismaService } from '../../infrastructure/database/PrismaService.js';
import BusinessMetricsService from './BusinessMetricsService.js';

class ReportService {
    constructor() {
        this.prismaService = getPrismaService();
        this.metricsService = new BusinessMetricsService();
        this.reportsDir = path.join(process.cwd(), 'reports');
        
        this.initializeReportsDirectory();
    }

    /**
     * Inicializar directorio de reportes
     */
    async initializeReportsDirectory() {
        try {
            await fs.mkdir(this.reportsDir, { recursive: true });
        } catch (error) {
            logger.error('Error creando directorio de reportes:', error);
        }
    }

    /**
     * Generar reporte completo de métricas
     */
    async generateMetricsReport(options = {}) {
        const {
            timeRange = '30d',
            format = 'excel',
            includeCharts = true,
            includeDetails = true,
            filters = {}
        } = options;

        try {
            // Obtener datos para el reporte
            const data = await this.collectReportData(timeRange, filters);
            
            // Generar reporte según formato
            switch (format.toLowerCase()) {
                case 'excel':
                    return await this.generateExcelReport(data, options);
                case 'pdf':
                    return await this.generatePDFReport(data, options);
                case 'json':
                    return await this.generateJSONReport(data, options);
                case 'csv':
                    return await this.generateCSVReport(data, options);
                default:
                    throw new Error(`Formato ${format} no soportado`);
            }

        } catch (error) {
            logger.error('Error generando reporte de métricas:', error);
            throw error;
        }
    }

    /**
     * Recopilar datos para el reporte
     */
    async collectReportData(timeRange, filters) {
        const { startDate, endDate } = this.getTimeRange(timeRange);
        
        // Obtener métricas principales
        const dashboardMetrics = await this.metricsService.getDashboardMetrics(timeRange);
        const kpis = await this.metricsService.getKPIs(timeRange);
        
        // Obtener métricas detalladas
        const conversationMetrics = await this.metricsService.getConversationMetrics(timeRange);
        const messageMetrics = await this.metricsService.getMessageMetrics(timeRange);
        const agentMetrics = await this.metricsService.getAgentPerformanceMetrics(timeRange);
        const channelMetrics = await this.metricsService.getChannelDistribution(timeRange);
        
        // Obtener tendencias
        const trends = await this.getTrendData(startDate, endDate);
        
        // Obtener datos de satisfacción
        const satisfactionData = await this.getSatisfactionData(startDate, endDate);
        
        // Obtener alertas del período
        const alerts = await this.getAlertsData(startDate, endDate);

        return {
            period: { startDate, endDate, timeRange },
            summary: {
                dashboardMetrics,
                kpis
            },
            detailed: {
                conversations: conversationMetrics,
                messages: messageMetrics,
                agents: agentMetrics,
                channels: channelMetrics
            },
            trends,
            satisfaction: satisfactionData,
            alerts,
            generatedAt: new Date()
        };
    }

    /**
     * Generar reporte en Excel
     */
    async generateExcelReport(data, options) {
        const workbook = new ExcelJS.Workbook();
        
        // Configurar propiedades del workbook
        workbook.creator = 'ChatBot Enterprise';
        workbook.created = new Date();
        workbook.title = `Reporte de Métricas - ${data.period.timeRange}`;

        // Hoja de resumen
        await this.createSummarySheet(workbook, data);
        
        // Hoja de KPIs
        await this.createKPIsSheet(workbook, data);
        
        // Hoja de conversaciones
        await this.createConversationsSheet(workbook, data);
        
        // Hoja de agentes
        await this.createAgentsSheet(workbook, data);
        
        // Hoja de canales
        await this.createChannelsSheet(workbook, data);
        
        // Hoja de tendencias
        await this.createTrendsSheet(workbook, data);
        
        // Hoja de alertas
        await this.createAlertsSheet(workbook, data);

        // Guardar archivo
        const filename = `metrics-report-${data.period.timeRange}-${Date.now()}.xlsx`;
        const filepath = path.join(this.reportsDir, filename);
        
        await workbook.xlsx.writeFile(filepath);
        
        return {
            filename,
            filepath,
            format: 'excel',
            size: (await fs.stat(filepath)).size
        };
    }

    /**
     * Crear hoja de resumen
     */
    async createSummarySheet(workbook, data) {
        const worksheet = workbook.addWorksheet('Resumen');
        
        // Título
        worksheet.mergeCells('A1:F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `Reporte de Métricas - ${data.period.timeRange}`;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center' };
        
        // Información del período
        worksheet.getCell('A3').value = 'Período:';
        worksheet.getCell('B3').value = `${data.period.startDate.toLocaleDateString()} - ${data.period.endDate.toLocaleDateString()}`;
        worksheet.getCell('A4').value = 'Generado:';
        worksheet.getCell('B4').value = data.generatedAt.toLocaleString();
        
        // Métricas principales
        let row = 6;
        worksheet.getCell(`A${row}`).value = 'MÉTRICAS PRINCIPALES';
        worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        row += 2;
        
        const metrics = data.summary.dashboardMetrics;
        const metricsData = [
            ['Total Conversaciones', metrics.totalConversations],
            ['Total Mensajes', metrics.totalMessages],
            ['Usuarios Activos', metrics.activeUsers],
            ['Tiempo Promedio Respuesta', `${Math.round(metrics.averageResponseTime)}s`],
            ['Satisfacción Promedio', `${metrics.averageSatisfaction.toFixed(1)}/5`]
        ];
        
        for (const [label, value] of metricsData) {
            worksheet.getCell(`A${row}`).value = label;
            worksheet.getCell(`B${row}`).value = value;
            row++;
        }
        
        // KPIs
        row += 2;
        worksheet.getCell(`A${row}`).value = 'KPIS PRINCIPALES';
        worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        row += 2;
        
        const kpis = data.summary.kpis;
        const kpisData = [
            ['Tasa de Resolución', `${Math.round(kpis.conversationResolutionRate.value)}%`],
            ['Tiempo Promedio Respuesta', `${Math.round(kpis.averageResponseTime.value)}s`],
            ['CSAT', `${kpis.customerSatisfactionScore.value.toFixed(1)}/5`],
            ['Utilización de Agentes', `${Math.round(kpis.agentUtilization.value)}%`],
            ['Resolución Primer Contacto', `${Math.round(kpis.firstContactResolution.value)}%`]
        ];
        
        for (const [label, value] of kpisData) {
            worksheet.getCell(`A${row}`).value = label;
            worksheet.getCell(`B${row}`).value = value;
            row++;
        }
        
        // Aplicar estilos
        worksheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
    }

    /**
     * Crear hoja de KPIs
     */
    async createKPIsSheet(workbook, data) {
        const worksheet = workbook.addWorksheet('KPIs');
        
        // Headers
        const headers = ['KPI', 'Valor Actual', 'Objetivo', 'Estado', 'Tendencia', 'Descripción'];
        worksheet.addRow(headers);
        
        // Aplicar estilos a headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Datos de KPIs
        const kpis = data.summary.kpis;
        const kpiRows = [
            [
                'Tasa de Resolución',
                `${Math.round(kpis.conversationResolutionRate.value)}%`,
                '85%',
                kpis.conversationResolutionRate.value >= 85 ? 'Bueno' : 'Necesita Mejora',
                kpis.conversationResolutionRate.trend,
                'Porcentaje de conversaciones resueltas exitosamente'
            ],
            [
                'Tiempo Promedio Respuesta',
                `${Math.round(kpis.averageResponseTime.value)}s`,
                '< 300s',
                kpis.averageResponseTime.value <= 300 ? 'Bueno' : 'Necesita Mejora',
                kpis.averageResponseTime.trend,
                'Tiempo promedio para responder a un mensaje'
            ],
            [
                'CSAT',
                `${kpis.customerSatisfactionScore.value.toFixed(1)}/5`,
                '> 4.0',
                kpis.customerSatisfactionScore.value >= 4.0 ? 'Bueno' : 'Necesita Mejora',
                kpis.customerSatisfactionScore.trend,
                'Puntuación de satisfacción del cliente'
            ],
            [
                'Utilización de Agentes',
                `${Math.round(kpis.agentUtilization.value)}%`,
                '70-85%',
                (kpis.agentUtilization.value >= 70 && kpis.agentUtilization.value <= 85) ? 'Bueno' : 'Necesita Ajuste',
                kpis.agentUtilization.trend,
                'Porcentaje de tiempo que los agentes están activos'
            ]
        ];
        
        for (const row of kpiRows) {
            worksheet.addRow(row);
        }
        
        // Configurar columnas
        worksheet.columns = [
            { width: 25 },
            { width: 15 },
            { width: 12 },
            { width: 15 },
            { width: 12 },
            { width: 40 }
        ];
    }

    /**
     * Generar reporte en PDF
     */
    async generatePDFReport(data, options) {
        const doc = new PDFDocument();
        const filename = `metrics-report-${data.period.timeRange}-${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        
        doc.pipe(createWriteStream(filepath));
        
        // Título
        doc.fontSize(20).text('Reporte de Métricas - ChatBot Enterprise', 50, 50);
        doc.fontSize(12).text(`Período: ${data.period.startDate.toLocaleDateString()} - ${data.period.endDate.toLocaleDateString()}`, 50, 80);
        doc.text(`Generado: ${data.generatedAt.toLocaleString()}`, 50, 95);
        
        // Métricas principales
        let y = 130;
        doc.fontSize(16).text('Métricas Principales', 50, y);
        y += 30;
        
        const metrics = data.summary.dashboardMetrics;
        const metricsText = [
            `Total Conversaciones: ${metrics.totalConversations}`,
            `Total Mensajes: ${metrics.totalMessages}`,
            `Usuarios Activos: ${metrics.activeUsers}`,
            `Tiempo Promedio Respuesta: ${Math.round(metrics.averageResponseTime)}s`,
            `Satisfacción Promedio: ${metrics.averageSatisfaction.toFixed(1)}/5`
        ];
        
        doc.fontSize(12);
        for (const text of metricsText) {
            doc.text(text, 50, y);
            y += 20;
        }
        
        // KPIs
        y += 20;
        doc.fontSize(16).text('KPIs Principales', 50, y);
        y += 30;
        
        const kpis = data.summary.kpis;
        const kpisText = [
            `Tasa de Resolución: ${Math.round(kpis.conversationResolutionRate.value)}%`,
            `Tiempo Promedio Respuesta: ${Math.round(kpis.averageResponseTime.value)}s`,
            `CSAT: ${kpis.customerSatisfactionScore.value.toFixed(1)}/5`,
            `Utilización de Agentes: ${Math.round(kpis.agentUtilization.value)}%`,
            `Resolución Primer Contacto: ${Math.round(kpis.firstContactResolution.value)}%`
        ];
        
        doc.fontSize(12);
        for (const text of kpisText) {
            doc.text(text, 50, y);
            y += 20;
        }
        
        doc.end();
        
        return new Promise((resolve, reject) => {
            doc.on('end', async () => {
                try {
                    const stats = await fs.stat(filepath);
                    resolve({
                        filename,
                        filepath,
                        format: 'pdf',
                        size: stats.size
                    });
                } catch (error) {
                    reject(error);
                }
            });
            
            doc.on('error', reject);
        });
    }

    /**
     * Generar reporte en JSON
     */
    async generateJSONReport(data, options) {
        const filename = `metrics-report-${data.period.timeRange}-${Date.now()}.json`;
        const filepath = path.join(this.reportsDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        
        const stats = await fs.stat(filepath);
        
        return {
            filename,
            filepath,
            format: 'json',
            size: stats.size
        };
    }

    /**
     * Obtener datos de tendencias
     */
    async getTrendData(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();
            
            // Obtener métricas por día
            const dailyMetrics = await prisma.$queryRaw`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as conversations,
                    AVG(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) * 100 as resolution_rate
                FROM conversations 
                WHERE created_at BETWEEN ${startDate} AND ${endDate}
                GROUP BY DATE(created_at)
                ORDER BY date
            `;
            
            return {
                daily: dailyMetrics.map(metric => ({
                    date: metric.date,
                    conversations: parseInt(metric.conversations),
                    resolutionRate: parseFloat(metric.resolution_rate) || 0
                }))
            };
            
        } catch (error) {
            logger.error('Error obteniendo datos de tendencias:', error);
            return { daily: [] };
        }
    }

    /**
     * Obtener datos de satisfacción
     */
    async getSatisfactionData(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();
            
            const satisfactionData = await prisma.conversationMetric.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    },
                    satisfactionScore: { not: null }
                },
                select: {
                    satisfactionScore: true,
                    createdAt: true,
                    conversation: {
                        select: {
                            channel: true,
                            assignedAgent: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                }
            });
            
            return {
                total: satisfactionData.length,
                average: satisfactionData.length > 0 ? 
                    satisfactionData.reduce((sum, item) => sum + item.satisfactionScore, 0) / satisfactionData.length : 0,
                byChannel: this.groupSatisfactionByChannel(satisfactionData),
                byAgent: this.groupSatisfactionByAgent(satisfactionData)
            };
            
        } catch (error) {
            logger.error('Error obteniendo datos de satisfacción:', error);
            return { total: 0, average: 0, byChannel: {}, byAgent: {} };
        }
    }

    /**
     * Obtener datos de alertas
     */
    async getAlertsData(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();
            
            const alerts = await prisma.auditLog.findMany({
                where: {
                    action: 'ALERT_TRIGGERED',
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            
            return {
                total: alerts.length,
                bySeverity: this.groupAlertsBySeverity(alerts),
                recent: alerts.slice(0, 10)
            };
            
        } catch (error) {
            logger.error('Error obteniendo datos de alertas:', error);
            return { total: 0, bySeverity: {}, recent: [] };
        }
    }

    /**
     * Agrupar satisfacción por canal
     */
    groupSatisfactionByChannel(data) {
        const grouped = {};
        
        for (const item of data) {
            const channel = item.conversation.channel;
            if (!grouped[channel]) {
                grouped[channel] = { total: 0, sum: 0, average: 0 };
            }
            grouped[channel].total++;
            grouped[channel].sum += item.satisfactionScore;
        }
        
        for (const channel in grouped) {
            grouped[channel].average = grouped[channel].sum / grouped[channel].total;
        }
        
        return grouped;
    }

    /**
     * Agrupar satisfacción por agente
     */
    groupSatisfactionByAgent(data) {
        const grouped = {};
        
        for (const item of data) {
            const agentName = item.conversation.assignedAgent?.name || 'Sin asignar';
            if (!grouped[agentName]) {
                grouped[agentName] = { total: 0, sum: 0, average: 0 };
            }
            grouped[agentName].total++;
            grouped[agentName].sum += item.satisfactionScore;
        }
        
        for (const agent in grouped) {
            grouped[agent].average = grouped[agent].sum / grouped[agent].total;
        }
        
        return grouped;
    }

    /**
     * Agrupar alertas por severidad
     */
    groupAlertsBySeverity(alerts) {
        const grouped = { critical: 0, warning: 0, info: 0 };
        
        for (const alert of alerts) {
            try {
                const details = JSON.parse(alert.details);
                const severity = details.severity || 'info';
                if (grouped[severity] !== undefined) {
                    grouped[severity]++;
                }
            } catch (error) {
                grouped.info++;
            }
        }
        
        return grouped;
    }

    /**
     * Obtener rango de tiempo
     */
    getTimeRange(timeRange) {
        const endDate = new Date();
        let startDate;

        switch (timeRange) {
            case '24h':
                startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        return { startDate, endDate };
    }

    /**
     * Listar reportes generados
     */
    async listReports() {
        try {
            const files = await fs.readdir(this.reportsDir);
            const reports = [];
            
            for (const file of files) {
                const filepath = path.join(this.reportsDir, file);
                const stats = await fs.stat(filepath);
                
                reports.push({
                    filename: file,
                    filepath,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                });
            }
            
            return reports.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Error listando reportes:', error);
            return [];
        }
    }

    /**
     * Eliminar reportes antiguos
     */
    async cleanupOldReports(daysToKeep = 30) {
        try {
            const files = await fs.readdir(this.reportsDir);
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            let deletedCount = 0;
            
            for (const file of files) {
                const filepath = path.join(this.reportsDir, file);
                const stats = await fs.stat(filepath);
                
                if (stats.birthtime < cutoffDate) {
                    await fs.unlink(filepath);
                    deletedCount++;
                }
            }
            
            return { deletedCount };
            
        } catch (error) {
            logger.error('Error limpiando reportes antiguos:', error);
            throw error;
        }
    }
}

export default ReportService;