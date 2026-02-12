import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { EventEmitter } from 'events';

class ThirdPartyIntegrationService extends EventEmitter {
  constructor() {
    super();
    this.integrations = new Map();
    this.apiKeys = new Map();
    this.webhooks = new Map();
    this.rateLimits = new Map();
    this.isInitialized = false;
    this.dataDir = path.join(process.cwd(), 'data', 'integrations');
    this.secretKey =
      process.env.INTEGRATION_SECRET_KEY ||
      'default-secret-key-change-in-production';

    // Configuración por defecto
    this.config = {
      maxApiKeys: 100,
      defaultRateLimit: {
        requests: 1000,
        window: 3600000, // 1 hora en ms
      },
      webhookTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    };
  }

  async initialize() {
    try {
      await fs.ensureDir(this.dataDir);
      await this.loadIntegrations();
      await this.loadApiKeys();
      await this.loadWebhooks();

      this.isInitialized = true;
      console.log('✅ ThirdPartyIntegrationService inicializado correctamente');

      // Limpiar rate limits cada hora
      setInterval(() => {
        this.cleanupRateLimits();
      }, 3600000);

      return { success: true };
    } catch (error) {
      console.error(
        '❌ Error inicializando ThirdPartyIntegrationService:',
        error
      );
      throw error;
    }
  }

  // Gestión de API Keys
  async createApiKey(options = {}) {
    try {
      const {
        name,
        description,
        permissions = ['read'],
        rateLimit = this.config.defaultRateLimit,
        expiresAt = null,
        metadata = {},
      } = options;

      if (this.apiKeys.size >= this.config.maxApiKeys) {
        throw new Error('Límite máximo de API keys alcanzado');
      }

      const apiKey = this.generateApiKey();
      const keyData = {
        id: this.generateId(),
        key: apiKey,
        name: name || `API Key ${Date.now()}`,
        description,
        permissions,
        rateLimit,
        expiresAt,
        metadata,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        isActive: true,
      };

      this.apiKeys.set(apiKey, keyData);
      await this.saveApiKeys();

      this.emit('apiKeyCreated', keyData);

      return {
        success: true,
        apiKey: {
          ...keyData,
          key: apiKey, // Solo devolver la key en la creación
        },
      };
    } catch (error) {
      console.error('Error creando API key:', error);
      throw error;
    }
  }

  async validateApiKey(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);

      if (!keyData) {
        return { valid: false, reason: 'API key no encontrada' };
      }

      if (!keyData.isActive) {
        return { valid: false, reason: 'API key desactivada' };
      }

      if (keyData.expiresAt && new Date() > new Date(keyData.expiresAt)) {
        return { valid: false, reason: 'API key expirada' };
      }

      // Verificar rate limit
      const rateLimitCheck = this.checkRateLimit(apiKey, keyData.rateLimit);
      if (!rateLimitCheck.allowed) {
        return {
          valid: false,
          reason: 'Rate limit excedido',
          retryAfter: rateLimitCheck.retryAfter,
        };
      }

      // Actualizar estadísticas de uso
      keyData.lastUsed = new Date().toISOString();
      keyData.usageCount++;
      await this.saveApiKeys();

      return {
        valid: true,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          permissions: keyData.permissions,
          metadata: keyData.metadata,
        },
      };
    } catch (error) {
      console.error('Error validando API key:', error);
      return { valid: false, reason: 'Error interno' };
    }
  }

  async revokeApiKey(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);

      if (!keyData) {
        throw new Error('API key no encontrada');
      }

      keyData.isActive = false;
      keyData.revokedAt = new Date().toISOString();

      await this.saveApiKeys();
      this.emit('apiKeyRevoked', keyData);

      return { success: true, message: 'API key revocada exitosamente' };
    } catch (error) {
      console.error('Error revocando API key:', error);
      throw error;
    }
  }

  async listApiKeys() {
    try {
      const keys = Array.from(this.apiKeys.values()).map(keyData => ({
        id: keyData.id,
        name: keyData.name,
        description: keyData.description,
        permissions: keyData.permissions,
        createdAt: keyData.createdAt,
        lastUsed: keyData.lastUsed,
        usageCount: keyData.usageCount,
        isActive: keyData.isActive,
        expiresAt: keyData.expiresAt,
        key: keyData.key.substring(0, 8) + '...', // Solo mostrar primeros 8 caracteres
      }));

      return { success: true, apiKeys: keys };
    } catch (error) {
      console.error('Error listando API keys:', error);
      throw error;
    }
  }

  // Gestión de Webhooks
  async registerWebhook(options = {}) {
    try {
      const {
        url,
        events = [],
        secret = null,
        headers = {},
        metadata = {},
        isActive = true,
      } = options;

      if (!url) {
        throw new Error('URL del webhook es requerida');
      }

      // Validar URL
      try {
        new URL(url);
      } catch {
        throw new Error('URL del webhook inválida');
      }

      const webhookId = this.generateId();
      const webhookData = {
        id: webhookId,
        url,
        events,
        secret: secret || this.generateSecret(),
        headers,
        metadata,
        isActive,
        createdAt: new Date().toISOString(),
        lastTriggered: null,
        successCount: 0,
        failureCount: 0,
        lastError: null,
      };

      this.webhooks.set(webhookId, webhookData);
      await this.saveWebhooks();

      this.emit('webhookRegistered', webhookData);

      return { success: true, webhook: webhookData };
    } catch (error) {
      console.error('Error registrando webhook:', error);
      throw error;
    }
  }

  async triggerWebhook(event, data) {
    try {
      const webhooks = Array.from(this.webhooks.values()).filter(
        webhook =>
          webhook.isActive &&
          (webhook.events.length === 0 || webhook.events.includes(event))
      );

      const results = [];

      for (const webhook of webhooks) {
        try {
          const result = await this.sendWebhook(webhook, event, data);
          results.push({ webhookId: webhook.id, success: true, result });
        } catch (error) {
          console.error(`Error enviando webhook ${webhook.id}:`, error);
          results.push({
            webhookId: webhook.id,
            success: false,
            error: error.message,
          });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error disparando webhooks:', error);
      throw error;
    }
  }

  async sendWebhook(webhook, event, data, attempt = 1) {
    try {
      const payload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        webhookId: webhook.id,
      };

      const signature = this.generateWebhookSignature(payload, webhook.secret);

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-ID': webhook.id,
        'User-Agent': 'ChatBot-Webhook/1.0',
        ...webhook.headers,
      };

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: this.config.webhookTimeout,
        validateStatus: status => status < 500, // Retry en errores 5xx
      });

      // Actualizar estadísticas
      webhook.lastTriggered = new Date().toISOString();
      webhook.successCount++;
      webhook.lastError = null;
      await this.saveWebhooks();

      this.emit('webhookSuccess', {
        webhook,
        event,
        data,
        response: response.data,
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      webhook.failureCount++;
      webhook.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
        attempt,
      };

      // Retry logic
      if (
        attempt < this.config.retryAttempts &&
        (!error.response || error.response.status >= 500)
      ) {
        console.log(
          `Reintentando webhook ${webhook.id}, intento ${attempt + 1}`
        );

        await new Promise(resolve =>
          setTimeout(resolve, this.config.retryDelay * attempt)
        );

        return this.sendWebhook(webhook, event, data, attempt + 1);
      }

      await this.saveWebhooks();
      this.emit('webhookFailure', { webhook, event, data, error });

      throw error;
    }
  }

  async listWebhooks() {
    try {
      const webhooks = Array.from(this.webhooks.values());
      return { success: true, webhooks };
    } catch (error) {
      console.error('Error listando webhooks:', error);
      throw error;
    }
  }

  async deleteWebhook(webhookId) {
    try {
      const webhook = this.webhooks.get(webhookId);

      if (!webhook) {
        throw new Error('Webhook no encontrado');
      }

      this.webhooks.delete(webhookId);
      await this.saveWebhooks();

      this.emit('webhookDeleted', webhook);

      return { success: true, message: 'Webhook eliminado exitosamente' };
    } catch (error) {
      console.error('Error eliminando webhook:', error);
      throw error;
    }
  }

  // Gestión de Integraciones
  async createIntegration(options = {}) {
    try {
      const {
        name,
        type,
        config = {},
        apiKey,
        webhookUrl,
        events = [],
        metadata = {},
      } = options;

      if (!name || !type) {
        throw new Error('Nombre y tipo de integración son requeridos');
      }

      const integrationId = this.generateId();
      const integrationData = {
        id: integrationId,
        name,
        type,
        config,
        apiKey,
        webhookUrl,
        events,
        metadata,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastSync: null,
        syncCount: 0,
        errorCount: 0,
        lastError: null,
      };

      this.integrations.set(integrationId, integrationData);
      await this.saveIntegrations();

      // Registrar webhook si se proporciona
      if (webhookUrl) {
        await this.registerWebhook({
          url: webhookUrl,
          events,
          metadata: { integrationId },
        });
      }

      this.emit('integrationCreated', integrationData);

      return { success: true, integration: integrationData };
    } catch (error) {
      console.error('Error creando integración:', error);
      throw error;
    }
  }

  async syncIntegration(integrationId, data) {
    try {
      const integration = this.integrations.get(integrationId);

      if (!integration) {
        throw new Error('Integración no encontrada');
      }

      if (!integration.isActive) {
        throw new Error('Integración desactivada');
      }

      // Actualizar estadísticas
      integration.lastSync = new Date().toISOString();
      integration.syncCount++;

      // Procesar según el tipo de integración
      let result;
      switch (integration.type) {
        case 'crm':
          result = await this.syncCRM(integration, data);
          break;
        case 'ecommerce':
          result = await this.syncEcommerce(integration, data);
          break;
        case 'analytics':
          result = await this.syncAnalytics(integration, data);
          break;
        default:
          result = await this.syncGeneric(integration, data);
      }

      await this.saveIntegrations();
      this.emit('integrationSynced', { integration, data, result });

      return { success: true, result };
    } catch (error) {
      console.error('Error sincronizando integración:', error);

      const integration = this.integrations.get(integrationId);
      if (integration) {
        integration.errorCount++;
        integration.lastError = {
          message: error.message,
          timestamp: new Date().toISOString(),
        };
        await this.saveIntegrations();
      }

      throw error;
    }
  }

  // Métodos de sincronización específicos
  async syncCRM(integration, data) {
    // Implementar lógica específica para CRM
    return { type: 'crm', processed: true, data };
  }

  async syncEcommerce(integration, data) {
    // Implementar lógica específica para ecommerce
    return { type: 'ecommerce', processed: true, data };
  }

  async syncAnalytics(integration, data) {
    // Implementar lógica específica para analytics
    return { type: 'analytics', processed: true, data };
  }

  async syncGeneric(integration, data) {
    // Lógica genérica de sincronización
    return { type: 'generic', processed: true, data };
  }

  // Rate Limiting - DESACTIVADO
  checkRateLimit(identifier, limit) {
    return { allowed: true, remaining: 999999 }; // Siempre permitir con límite muy alto
  }

  cleanupRateLimits() {
    const now = Date.now();
    const maxWindow = Math.max(
      ...Object.values(this.config.defaultRateLimit).map(limit =>
        typeof limit === 'object'
          ? limit.window
          : this.config.defaultRateLimit.window
      )
    );

    for (const [identifier, requests] of this.rateLimits.entries()) {
      const validRequests = requests.filter(
        timestamp => timestamp > now - maxWindow
      );

      if (validRequests.length === 0) {
        this.rateLimits.delete(identifier);
      } else {
        this.rateLimits.set(identifier, validRequests);
      }
    }
  }

  // Utilidades
  generateApiKey() {
    const prefix = 'cbapi_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return prefix + randomBytes;
  }

  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateWebhookSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = this.generateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Persistencia
  async saveIntegrations() {
    try {
      const filePath = path.join(this.dataDir, 'integrations.json');
      const data = Array.from(this.integrations.entries());
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Error guardando integraciones:', error);
    }
  }

  async loadIntegrations() {
    try {
      const filePath = path.join(this.dataDir, 'integrations.json');

      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        this.integrations = new Map(data);
      }
    } catch (error) {
      console.error('Error cargando integraciones:', error);
    }
  }

  async saveApiKeys() {
    try {
      const filePath = path.join(this.dataDir, 'api-keys.json');
      const data = Array.from(this.apiKeys.entries());
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Error guardando API keys:', error);
    }
  }

  async loadApiKeys() {
    try {
      const filePath = path.join(this.dataDir, 'api-keys.json');

      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        this.apiKeys = new Map(data);
      }
    } catch (error) {
      console.error('Error cargando API keys:', error);
    }
  }

  async saveWebhooks() {
    try {
      const filePath = path.join(this.dataDir, 'webhooks.json');
      const data = Array.from(this.webhooks.entries());
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Error guardando webhooks:', error);
    }
  }

  async loadWebhooks() {
    try {
      const filePath = path.join(this.dataDir, 'webhooks.json');

      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        this.webhooks = new Map(data);
      }
    } catch (error) {
      console.error('Error cargando webhooks:', error);
    }
  }

  // Estadísticas
  getStats() {
    return {
      integrations: {
        total: this.integrations.size,
        active: Array.from(this.integrations.values()).filter(i => i.isActive)
          .length,
        byType: this.getIntegrationsByType(),
      },
      apiKeys: {
        total: this.apiKeys.size,
        active: Array.from(this.apiKeys.values()).filter(k => k.isActive)
          .length,
        totalUsage: Array.from(this.apiKeys.values()).reduce(
          (sum, k) => sum + k.usageCount,
          0
        ),
      },
      webhooks: {
        total: this.webhooks.size,
        active: Array.from(this.webhooks.values()).filter(w => w.isActive)
          .length,
        totalSuccess: Array.from(this.webhooks.values()).reduce(
          (sum, w) => sum + w.successCount,
          0
        ),
        totalFailures: Array.from(this.webhooks.values()).reduce(
          (sum, w) => sum + w.failureCount,
          0
        ),
      },
    };
  }

  getIntegrationsByType() {
    const byType = {};
    for (const integration of this.integrations.values()) {
      byType[integration.type] = (byType[integration.type] || 0) + 1;
    }
    return byType;
  }
}

export default ThirdPartyIntegrationService;
