/**
 * Servicio de Seguimiento de Respuestas
 * Rastrea y analiza las respuestas a plantillas y flujos enviados
 */

import fs from 'fs/promises';
import path from 'path';

class ResponseTrackingService {
  constructor() {
    this.sentMessages = new Map();
    this.responses = new Map();
    this.analytics = new Map();
    this.dataPath = path.join(process.cwd(), 'apps/api/src/data/response-tracking.json');
    this.init();
  }

  async init() {
    try {
      await this.loadTrackingData();
      console.log('ResponseTrackingService inicializado');
    } catch (error) {
      console.error('Error inicializando ResponseTrackingService:', error);
    }
  }

  // Cargar datos de seguimiento
  async loadTrackingData() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      const trackingData = JSON.parse(data);

      this.sentMessages = new Map(trackingData.sentMessages || []);
      this.responses = new Map(trackingData.responses || []);
      this.analytics = new Map(trackingData.analytics || []);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error cargando datos de seguimiento:', error);
      }
      await this.saveTrackingData();
    }
  }

  // Guardar datos de seguimiento
  async saveTrackingData() {
    try {
      const trackingData = {
        sentMessages: Array.from(this.sentMessages.entries()),
        responses: Array.from(this.responses.entries()),
        analytics: Array.from(this.analytics.entries()),
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeFile(this.dataPath, JSON.stringify(trackingData, null, 2));
    } catch (error) {
      console.error('Error guardando datos de seguimiento:', error);
    }
  }

  // Registrar mensaje enviado
  async trackSentMessage(messageData) {
    const trackingId = this.generateTrackingId();
    const timestamp = new Date().toISOString();

    const sentMessage = {
      id: trackingId,
      messageId: messageData.messageId,
      type: messageData.type, // 'template' o 'flow'
      templateId: messageData.templateId,
      templateName: messageData.templateName,
      flowId: messageData.flowId,
      flowName: messageData.flowName,
      recipient: messageData.recipient,
      sentAt: timestamp,
      status: 'sent',
      campaign: messageData.campaign || null,
      segment: messageData.segment || null,
      expectedResponseTypes: messageData.expectedResponseTypes || [],
      metadata: messageData.metadata || {},
    };

    this.sentMessages.set(trackingId, sentMessage);
    await this.saveTrackingData();

    console.log(`Mensaje rastreado: ${trackingId} -> ${messageData.recipient}`);
    return trackingId;
  }

  // Registrar respuesta recibida
  async trackResponse(responseData) {
    const responseId = this.generateResponseId();
    const timestamp = new Date().toISOString();

    // Buscar mensaje original
    const originalMessage = this.findOriginalMessage(responseData);

    const response = {
      id: responseId,
      originalTrackingId: originalMessage?.id || null,
      originalMessageId: responseData.originalMessageId,
      responseMessageId: responseData.messageId,
      from: responseData.from,
      responseType: responseData.responseType,
      responseData: responseData.responseData,
      receivedAt: timestamp,
      processed: false,
      responseTime: originalMessage
        ? new Date(timestamp) - new Date(originalMessage.sentAt)
        : null,
      metadata: responseData.metadata || {},
    };

    this.responses.set(responseId, response);

    // Actualizar estado del mensaje original
    if (originalMessage) {
      originalMessage.status = 'responded';
      originalMessage.responseId = responseId;
      originalMessage.respondedAt = timestamp;
      this.sentMessages.set(originalMessage.id, originalMessage);
    }

    await this.saveTrackingData();
    await this.updateAnalytics(response);

    console.log(`Respuesta rastreada: ${responseId} de ${responseData.from}`);
    return responseId;
  }

  // Buscar mensaje original
  findOriginalMessage(responseData) {
    // Buscar por ID de mensaje original
    if (responseData.originalMessageId) {
      for (const [id, message] of this.sentMessages.entries()) {
        if (message.messageId === responseData.originalMessageId) {
          return message;
        }
      }
    }

    // Buscar por remitente y tiempo reciente
    const recentMessages = Array.from(this.sentMessages.values())
      .filter(
        msg =>
          msg.recipient === responseData.from &&
          msg.status === 'sent' &&
          new Date() - new Date(msg.sentAt) < 24 * 60 * 60 * 1000 // 24 horas
      )
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    return recentMessages[0] || null;
  }

  // Actualizar analytics
  async updateAnalytics(response) {
    const date = new Date(response.receivedAt).toISOString().split('T')[0];
    const analyticsKey = `${date}_${response.responseType}`;

    const existing = this.analytics.get(analyticsKey) || {
      date,
      responseType: response.responseType,
      count: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      responses: [],
    };

    existing.count++;
    if (response.responseTime) {
      existing.totalResponseTime += response.responseTime;
      existing.averageResponseTime =
        existing.totalResponseTime / existing.count;
    }
    existing.responses.push(response.id);

    this.analytics.set(analyticsKey, existing);
  }

  // Obtener estadísticas de respuestas
  getResponseStats(filters = {}) {
    const {
      startDate,
      endDate,
      templateId,
      flowId,
      responseType,
      campaign,
      segment,
    } = filters;

    let messages = Array.from(this.sentMessages.values());
    let responses = Array.from(this.responses.values());

    // Aplicar filtros
    if (startDate) {
      const start = new Date(startDate);
      messages = messages.filter(msg => new Date(msg.sentAt) >= start);
      responses = responses.filter(resp => new Date(resp.receivedAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      messages = messages.filter(msg => new Date(msg.sentAt) <= end);
      responses = responses.filter(resp => new Date(resp.receivedAt) <= end);
    }

    if (templateId) {
      messages = messages.filter(msg => msg.templateId === templateId);
    }

    if (flowId) {
      messages = messages.filter(msg => msg.flowId === flowId);
    }

    if (responseType) {
      responses = responses.filter(resp => resp.responseType === responseType);
    }

    if (campaign) {
      messages = messages.filter(msg => msg.campaign === campaign);
    }

    if (segment) {
      messages = messages.filter(msg => msg.segment === segment);
    }

    // Calcular estadísticas
    const totalSent = messages.length;
    const totalResponses = responses.length;
    const responseRate =
      totalSent > 0 ? ((totalResponses / totalSent) * 100).toFixed(2) : 0;

    const responseTimes = responses
      .filter(resp => resp.responseTime)
      .map(resp => resp.responseTime);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    // Agrupar por tipo de respuesta
    const responsesByType = responses.reduce((acc, resp) => {
      acc[resp.responseType] = (acc[resp.responseType] || 0) + 1;
      return acc;
    }, {});

    // Agrupar por día
    const responsesByDay = responses.reduce((acc, resp) => {
      const day = new Date(resp.receivedAt).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    return {
      totalSent,
      totalResponses,
      responseRate: parseFloat(responseRate),
      averageResponseTime: Math.round(averageResponseTime / 1000 / 60), // minutos
      responsesByType,
      responsesByDay,
      topPerformingTemplates: this.getTopPerformingTemplates(
        messages,
        responses
      ),
      topPerformingFlows: this.getTopPerformingFlows(messages, responses),
    };
  }

  // Obtener plantillas con mejor rendimiento
  getTopPerformingTemplates(messages, responses) {
    const templateStats = {};

    messages.forEach(msg => {
      if (msg.templateId) {
        if (!templateStats[msg.templateId]) {
          templateStats[msg.templateId] = {
            templateId: msg.templateId,
            templateName: msg.templateName,
            sent: 0,
            responses: 0,
          };
        }
        templateStats[msg.templateId].sent++;
      }
    });

    responses.forEach(resp => {
      const originalMessage = this.sentMessages.get(resp.originalTrackingId);
      if (originalMessage && originalMessage.templateId) {
        if (templateStats[originalMessage.templateId]) {
          templateStats[originalMessage.templateId].responses++;
        }
      }
    });

    return Object.values(templateStats)
      .map(stat => ({
        ...stat,
        responseRate:
          stat.sent > 0 ? ((stat.responses / stat.sent) * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => parseFloat(b.responseRate) - parseFloat(a.responseRate))
      .slice(0, 10);
  }

  // Obtener flows con mejor rendimiento
  getTopPerformingFlows(messages, responses) {
    const flowStats = {};

    messages.forEach(msg => {
      if (msg.flowId) {
        if (!flowStats[msg.flowId]) {
          flowStats[msg.flowId] = {
            flowId: msg.flowId,
            flowName: msg.flowName,
            sent: 0,
            responses: 0,
          };
        }
        flowStats[msg.flowId].sent++;
      }
    });

    responses.forEach(resp => {
      const originalMessage = this.sentMessages.get(resp.originalTrackingId);
      if (originalMessage && originalMessage.flowId) {
        if (flowStats[originalMessage.flowId]) {
          flowStats[originalMessage.flowId].responses++;
        }
      }
    });

    return Object.values(flowStats)
      .map(stat => ({
        ...stat,
        responseRate:
          stat.sent > 0 ? ((stat.responses / stat.sent) * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => parseFloat(b.responseRate) - parseFloat(a.responseRate))
      .slice(0, 10);
  }

  // Obtener respuestas por mensaje
  getResponsesForMessage(trackingId) {
    return Array.from(this.responses.values())
      .filter(resp => resp.originalTrackingId === trackingId)
      .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
  }

  // Obtener mensajes sin respuesta
  getUnrespondedMessages(hoursOld = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    return Array.from(this.sentMessages.values())
      .filter(msg => msg.status === 'sent' && new Date(msg.sentAt) < cutoffTime)
      .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
  }

  // Marcar respuesta como procesada
  async markResponseProcessed(responseId, processingNotes = '') {
    const response = this.responses.get(responseId);
    if (response) {
      response.processed = true;
      response.processedAt = new Date().toISOString();
      response.processingNotes = processingNotes;

      this.responses.set(responseId, response);
      await this.saveTrackingData();
    }
  }

  // Obtener respuestas no procesadas
  getUnprocessedResponses() {
    return Array.from(this.responses.values())
      .filter(resp => !resp.processed)
      .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
  }

  // Exportar datos para análisis
  async exportData(format = 'json', filters = {}) {
    const stats = this.getResponseStats(filters);
    const messages = Array.from(this.sentMessages.values());
    const responses = Array.from(this.responses.values());

    const exportData = {
      summary: stats,
      messages,
      responses,
      exportedAt: new Date().toISOString(),
      filters,
    };

    if (format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return exportData;
  }

  // Convertir a CSV
  convertToCSV(data) {
    const csvLines = [];

    // Headers para mensajes
    csvLines.push(
      'Tipo,ID Mensaje,Plantilla/Flow,Destinatario,Enviado,Estado,Respondido'
    );

    // Datos de mensajes
    data.messages.forEach(msg => {
      csvLines.push(
        [
          msg.type,
          msg.messageId,
          msg.templateName || msg.flowName,
          msg.recipient,
          msg.sentAt,
          msg.status,
          msg.respondedAt || '',
        ].join(',')
      );
    });

    csvLines.push(''); // Línea vacía

    // Headers para respuestas
    csvLines.push(
      'ID Respuesta,De,Tipo Respuesta,Recibido,Tiempo Respuesta (ms)'
    );

    // Datos de respuestas
    data.responses.forEach(resp => {
      csvLines.push(
        [
          resp.id,
          resp.from,
          resp.responseType,
          resp.receivedAt,
          resp.responseTime || '',
        ].join(',')
      );
    });

    return csvLines.join('\n');
  }

  // Generar ID de seguimiento
  generateTrackingId() {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generar ID de respuesta
  generateResponseId() {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Limpiar datos antiguos
  async cleanupOldData(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleaned = 0;

    // Limpiar mensajes antiguos
    for (const [id, message] of this.sentMessages.entries()) {
      const sentDate = new Date(message.sentAt);
      if (sentDate < cutoffDate) {
        this.sentMessages.delete(id);
        cleaned++;
      }
    }

    // Limpiar respuestas antiguas
    for (const [id, response] of this.responses.entries()) {
      const receivedDate = new Date(response.receivedAt);
      if (receivedDate < cutoffDate) {
        this.responses.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveTrackingData();
      console.log(`Limpiados ${cleaned} registros antiguos`);
    }

    return cleaned;
  }
}

export default ResponseTrackingService;
