/**
 * AnalyticsService - Sistema avanzado de métricas y analytics
 * Recopila, procesa y almacena métricas del chatbot en tiempo real
 */

import fs from 'fs/promises';
import path from 'path';

class AnalyticsService {
  constructor() {
    this.metrics = {
      messages: {
        total: 0,
        sent: 0,
        received: 0,
        failed: 0,
        templates: 0,
      },
      conversations: {
        total: 0,
        active: 0,
        completed: 0,
        abandoned: 0,
      },
      ai: {
        intentDetections: 0,
        successfulResponses: 0,
        failedResponses: 0,
        averageConfidence: 0,
        emotionalPersuasionUsed: 0,
      },
      performance: {
        averageResponseTime: 0,
        uptime: Date.now(),
        errors: 0,
        webhookProcessingTime: [],
      },
      users: {
        unique: new Set(),
        returning: 0,
        newUsers: 0,
      },
      flows: {
        completed: 0,
        abandoned: 0,
        mostUsed: {},
        conversionRate: 0,
      },
    };

    this.dailyMetrics = {};
    this.hourlyMetrics = {};
    this.realTimeEvents = [];
    this.dataPath = path.join(process.cwd(), 'data', 'analytics');

    this.initializeStorage();
    this.startPeriodicSave();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadStoredMetrics();
    } catch (error) {
      console.error('Error initializing analytics storage:', error);
    }
  }

  async loadStoredMetrics() {
    try {
      const metricsFile = path.join(this.dataPath, 'metrics.json');
      const data = await fs.readFile(metricsFile, 'utf8');
      const stored = JSON.parse(data);

      // Merge stored metrics with current ones
      this.metrics = { ...this.metrics, ...stored };
      this.metrics.users.unique = new Set(stored.users?.uniqueArray || []);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('Starting with fresh analytics data');
    }
  }

  async saveMetrics() {
    try {
      const metricsToSave = {
        ...this.metrics,
        users: {
          ...this.metrics.users,
          uniqueArray: Array.from(this.metrics.users.unique),
        },
      };
      delete metricsToSave.users.unique;

      const metricsFile = path.join(this.dataPath, 'metrics.json');
      await fs.writeFile(metricsFile, JSON.stringify(metricsToSave, null, 2));
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  startPeriodicSave() {
    // Save metrics every 5 minutes
    setInterval(
      () => {
        this.saveMetrics();
      },
      5 * 60 * 1000
    );
  }

  // Tracking methods
  trackMessage(type, status, phoneNumber, metadata = {}) {
    this.metrics.messages.total++;
    this.metrics.messages[status]++;

    if (type === 'template') {
      this.metrics.messages.templates++;
    }

    // Track unique users
    if (phoneNumber) {
      const wasNew = !this.metrics.users.unique.has(phoneNumber);
      this.metrics.users.unique.add(phoneNumber);

      if (wasNew) {
        this.metrics.users.newUsers++;
      } else {
        this.metrics.users.returning++;
      }
    }

    this.addRealTimeEvent('message', {
      type,
      status,
      phoneNumber: phoneNumber ? phoneNumber.slice(-4) : 'unknown',
      timestamp: Date.now(),
      ...metadata,
    });

    this.updateHourlyMetrics('messages', 1);
  }

  trackConversation(action, phoneNumber, metadata = {}) {
    this.metrics.conversations[action]++;

    if (action === 'started') {
      this.metrics.conversations.total++;
      this.metrics.conversations.active++;
    } else if (action === 'completed' || action === 'abandoned') {
      this.metrics.conversations.active = Math.max(
        0,
        this.metrics.conversations.active - 1
      );
    }

    this.addRealTimeEvent('conversation', {
      action,
      phoneNumber: phoneNumber ? phoneNumber.slice(-4) : 'unknown',
      timestamp: Date.now(),
      ...metadata,
    });
  }

  trackAIInteraction(intent, confidence, success, emotionalPersuasion = false) {
    this.metrics.ai.intentDetections++;

    if (success) {
      this.metrics.ai.successfulResponses++;
    } else {
      this.metrics.ai.failedResponses++;
    }

    if (emotionalPersuasion) {
      this.metrics.ai.emotionalPersuasionUsed++;
    }

    // Update average confidence
    const total =
      this.metrics.ai.successfulResponses + this.metrics.ai.failedResponses;
    this.metrics.ai.averageConfidence =
      (this.metrics.ai.averageConfidence * (total - 1) + confidence) / total;

    this.addRealTimeEvent('ai_interaction', {
      intent,
      confidence,
      success,
      emotionalPersuasion,
      timestamp: Date.now(),
    });
  }

  trackPerformance(responseTime, operation = 'general') {
    // Update average response time
    const currentAvg = this.metrics.performance.averageResponseTime;
    const totalOps = this.metrics.messages.total || 1;
    this.metrics.performance.averageResponseTime =
      (currentAvg * (totalOps - 1) + responseTime) / totalOps;

    if (operation === 'webhook') {
      this.metrics.performance.webhookProcessingTime.push(responseTime);
      // Keep only last 100 webhook times
      if (this.metrics.performance.webhookProcessingTime.length > 100) {
        this.metrics.performance.webhookProcessingTime.shift();
      }
    }
  }

  trackError(error, context = '') {
    this.metrics.performance.errors++;

    this.addRealTimeEvent('error', {
      message: error.message || error,
      context,
      timestamp: Date.now(),
    });
  }

  trackFlow(flowName, action, phoneNumber) {
    if (!this.metrics.flows.mostUsed[flowName]) {
      this.metrics.flows.mostUsed[flowName] = { started: 0, completed: 0 };
    }

    this.metrics.flows.mostUsed[flowName][action]++;
    this.metrics.flows[action]++;

    // Calculate conversion rate
    const total = this.metrics.flows.completed + this.metrics.flows.abandoned;
    if (total > 0) {
      this.metrics.flows.conversionRate =
        (this.metrics.flows.completed / total) * 100;
    }
  }

  addRealTimeEvent(type, data) {
    this.realTimeEvents.push({
      type,
      data,
      timestamp: Date.now(),
    });

    // Keep only last 1000 events
    if (this.realTimeEvents.length > 1000) {
      this.realTimeEvents.shift();
    }
  }

  updateHourlyMetrics(metric, value) {
    const hour = new Date().getHours();
    const today = new Date().toDateString();

    if (!this.hourlyMetrics[today]) {
      this.hourlyMetrics[today] = {};
    }

    if (!this.hourlyMetrics[today][hour]) {
      this.hourlyMetrics[today][hour] = {};
    }

    if (!this.hourlyMetrics[today][hour][metric]) {
      this.hourlyMetrics[today][hour][metric] = 0;
    }

    this.hourlyMetrics[today][hour][metric] += value;
  }

  // Getter methods for dashboard
  getMetrics() {
    return {
      ...this.metrics,
      users: {
        ...this.metrics.users,
        unique: this.metrics.users.unique.size,
      },
      performance: {
        ...this.metrics.performance,
        uptime: Date.now() - this.metrics.performance.uptime,
        averageWebhookTime: this.getAverageWebhookTime(),
      },
    };
  }

  getAverageWebhookTime() {
    const times = this.metrics.performance.webhookProcessingTime;
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  getRealTimeEvents(limit = 50) {
    return this.realTimeEvents.slice(-limit).reverse();
  }

  getHourlyMetrics(date = new Date().toDateString()) {
    return this.hourlyMetrics[date] || {};
  }

  getDailyTrends(days = 7) {
    const trends = {};
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      trends[dateStr] = this.hourlyMetrics[dateStr] || {};
    }

    return trends;
  }

  getTopFlows(limit = 10) {
    const flows = Object.entries(this.metrics.flows.mostUsed)
      .map(([name, stats]) => ({
        name,
        ...stats,
        conversionRate:
          stats.started > 0 ? (stats.completed / stats.started) * 100 : 0,
      }))
      .sort((a, b) => b.started - a.started)
      .slice(0, limit);

    return flows;
  }

  // Export methods
  async exportMetrics(format = 'json') {
    const data = this.getMetrics();
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const filename = `analytics-export-${timestamp}.json`;
      const filepath = path.join(this.dataPath, filename);
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      return filepath;
    }

    // Add CSV export if needed
    return null;
  }

  // Método para verificar alertas automáticas
  checkAlerts() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Verificar tasa de errores alta
    const recentErrors = this.realTimeEvents.filter(
      e => e.type === 'error' && now - e.timestamp < oneHour
    );
    if (recentErrors.length > 10) {
      console.warn(
        `⚠️ Alta tasa de errores: ${recentErrors.length} errores en la última hora`
      );

      // Enviar notificación de alerta
      if (global.io && global.notificationService) {
        global.notificationService.sendNotification({
          type: 'error',
          title: 'Alerta: Alta tasa de errores',
          body: `Se han detectado ${recentErrors.length} errores en la última hora`,
          data: {
            errorCount: recentErrors.length,
            timestamp: new Date().toISOString(),
            severity: 'high',
          },
        });
      }
    }

    // Verificar rendimiento degradado
    if (this.metrics.performance.averageResponseTime > 5000) {
      console.warn(
        `⚠️ Rendimiento degradado: tiempo promedio de respuesta ${this.metrics.performance.averageResponseTime}ms`
      );

      // Enviar notificación de alerta
      if (global.io && global.notificationService) {
        global.notificationService.sendNotification({
          type: 'system',
          title: 'Alerta: Rendimiento degradado',
          body: `Tiempo promedio de respuesta: ${Math.round(this.metrics.performance.averageResponseTime)}ms`,
          data: {
            avgResponseTime: Math.round(
              this.metrics.performance.averageResponseTime
            ),
            timestamp: new Date().toISOString(),
            severity: 'medium',
          },
        });
      }
    }
  }

  // Reset methods (for testing or maintenance)
  resetMetrics() {
    this.metrics = {
      messages: { total: 0, sent: 0, received: 0, failed: 0, templates: 0 },
      conversations: { total: 0, active: 0, completed: 0, abandoned: 0 },
      ai: {
        intentDetections: 0,
        successfulResponses: 0,
        failedResponses: 0,
        averageConfidence: 0,
        emotionalPersuasionUsed: 0,
      },
      performance: {
        averageResponseTime: 0,
        uptime: Date.now(),
        errors: 0,
        webhookProcessingTime: [],
      },
      users: { unique: new Set(), returning: 0, newUsers: 0 },
      flows: { completed: 0, abandoned: 0, mostUsed: {}, conversionRate: 0 },
    };
    this.realTimeEvents = [];
  }
}

// Singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;
