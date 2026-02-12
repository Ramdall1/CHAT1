/**
 * Client Hub Service
 *
 * Servicio para gestionar múltiples clientes y sus configuraciones WABA
 */

import fs from 'fs-extra';
import path from 'path';
import { CONFIG } from '../core/config.js';
import PartnerAPIService from './PartnerAPIService.js';
import logger from '../utils/logger.js';

export class ClientHubService {
  constructor() {
    this.clientsDataPath = path.join(process.cwd(), 'data', 'clients.json');
    this.configsDataPath = path.join(
      process.cwd(),
      'data',
      'client-configs.json'
    );

    // Asegurar que los archivos de datos existan
    this.initializeDataFiles();
  }

  /**
   * Inicializar archivos de datos
   */
  async initializeDataFiles() {
    try {
      // Crear directorio data si no existe
      await fs.ensureDir(path.dirname(this.clientsDataPath));

      // Inicializar archivo de clientes
      if (!(await fs.pathExists(this.clientsDataPath))) {
        await fs.writeJson(
          this.clientsDataPath,
          {
            clients: [],
            lastUpdated: new Date().toISOString(),
          },
          { spaces: 2 }
        );
      }

      // Inicializar archivo de configuraciones
      if (!(await fs.pathExists(this.configsDataPath))) {
        await fs.writeJson(
          this.configsDataPath,
          {
            configs: {},
            lastUpdated: new Date().toISOString(),
          },
          { spaces: 2 }
        );
      }
    } catch (error) {
      logger.error('Error initializing Client Hub data files:', error);
    }
  }

  /**
   * Obtener todos los clientes
   */
  async getAllClients() {
    try {
      const data = await fs.readJson(this.clientsDataPath);
      return {
        success: true,
        clients: data.clients || [],
        lastUpdated: data.lastUpdated,
      };
    } catch (error) {
      logger.error('Error getting all clients:', error);
      return {
        success: false,
        error: error.message,
        clients: [],
      };
    }
  }

  /**
   * Obtener un cliente específico
   */
  async getClient(clientId) {
    try {
      const data = await fs.readJson(this.clientsDataPath);
      const client = data.clients.find(c => c.id === clientId);

      if (!client) {
        return {
          success: false,
          error: 'Cliente no encontrado',
        };
      }

      return {
        success: true,
        client,
      };
    } catch (error) {
      logger.error('Error getting client:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Crear un nuevo cliente con WABA automatizada
   */
  async createClient(clientData) {
    try {
      // Validar datos requeridos
      const requiredFields = ['businessName', 'businessEmail', 'businessPhone'];
      for (const field of requiredFields) {
        if (!clientData[field]) {
          return {
            success: false,
            error: `Campo requerido: ${field}`,
          };
        }
      }

      // Generar ID único para el cliente
      const clientId = this.generateClientId();

      // Crear cuenta WABA a través del Partner API
      const wabaResult = await PartnerAPIService.createWABAAccount({
        ...clientData,
        webhookUrl: `${process.env.NGROK_URL || 'https://your-domain.com'}/api/webhook/client/${clientId}`,
        webhookVerifyToken: this.generateWebhookToken(),
      });

      if (!wabaResult.success) {
        return {
          success: false,
          error: `Error creando WABA: ${wabaResult.error}`,
        };
      }

      // Crear objeto cliente
      const newClient = {
        id: clientId,
        businessName: clientData.businessName,
        businessEmail: clientData.businessEmail,
        businessPhone: clientData.businessPhone,
        businessWebsite: clientData.businessWebsite,
        businessDescription: clientData.businessDescription,
        businessCategory: clientData.businessCategory || 'OTHER',
        timezone: clientData.timezone || 'America/Mexico_City',
        locale: clientData.locale || 'es_MX',
        waba: {
          wabaId: wabaResult.data.wabaId,
          accountId: wabaResult.data.accountId,
          phoneNumberId: wabaResult.data.phoneNumberId,
          namespace: wabaResult.data.namespace,
          status: wabaResult.data.status,
        },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Guardar cliente
      const data = await fs.readJson(this.clientsDataPath);
      data.clients.push(newClient);
      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.clientsDataPath, data, { spaces: 2 });

      // Crear configuración inicial del cliente
      await this.createClientConfig(clientId, {
        apiKey: wabaResult.data.apiKey || CONFIG.D360_API_KEY,
        webhookUrl: newClient.webhookUrl,
        webhookVerifyToken: newClient.webhookVerifyToken,
        messageTemplates: [],
        automationRules: [],
        contactTags: [],
        customFields: [],
      });

      logger.info(`Client created successfully: ${clientId}`, {
        businessName: clientData.businessName,
        wabaId: wabaResult.data.wabaId,
      });

      return {
        success: true,
        client: newClient,
        waba: wabaResult.data,
      };
    } catch (error) {
      logger.error('Error creating client:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualizar un cliente
   */
  async updateClient(clientId, updateData) {
    try {
      const data = await fs.readJson(this.clientsDataPath);
      const clientIndex = data.clients.findIndex(c => c.id === clientId);

      if (clientIndex === -1) {
        return {
          success: false,
          error: 'Cliente no encontrado',
        };
      }

      // Actualizar datos del cliente
      data.clients[clientIndex] = {
        ...data.clients[clientIndex],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.clientsDataPath, data, { spaces: 2 });

      logger.info(`Client updated successfully: ${clientId}`, updateData);

      return {
        success: true,
        client: data.clients[clientIndex],
      };
    } catch (error) {
      logger.error('Error updating client:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Eliminar un cliente
   */
  async deleteClient(clientId) {
    try {
      const data = await fs.readJson(this.clientsDataPath);
      const clientIndex = data.clients.findIndex(c => c.id === clientId);

      if (clientIndex === -1) {
        return {
          success: false,
          error: 'Cliente no encontrado',
        };
      }

      const client = data.clients[clientIndex];

      // Eliminar WABA del Partner API si existe
      if (client.waba?.wabaId) {
        await PartnerAPIService.deleteWABAAccount(client.waba.wabaId);
      }

      // Eliminar cliente de la lista
      data.clients.splice(clientIndex, 1);
      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.clientsDataPath, data, { spaces: 2 });

      // Eliminar configuración del cliente
      await this.deleteClientConfig(clientId);

      logger.info(`Client deleted successfully: ${clientId}`, {
        businessName: client.businessName,
      });

      return {
        success: true,
        message: 'Cliente eliminado exitosamente',
      };
    } catch (error) {
      logger.error('Error deleting client:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Crear configuración para un cliente
   */
  async createClientConfig(clientId, config) {
    try {
      const data = await fs.readJson(this.configsDataPath);

      data.configs[clientId] = {
        ...config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.configsDataPath, data, { spaces: 2 });

      return {
        success: true,
        config: data.configs[clientId],
      };
    } catch (error) {
      logger.error('Error creating client config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtener configuración de un cliente
   */
  async getClientConfig(clientId) {
    try {
      const data = await fs.readJson(this.configsDataPath);
      const config = data.configs[clientId];

      if (!config) {
        return {
          success: false,
          error: 'Configuración no encontrada',
        };
      }

      return {
        success: true,
        config,
      };
    } catch (error) {
      logger.error('Error getting client config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualizar configuración de un cliente
   */
  async updateClientConfig(clientId, updateData) {
    try {
      const data = await fs.readJson(this.configsDataPath);

      if (!data.configs[clientId]) {
        return {
          success: false,
          error: 'Configuración no encontrada',
        };
      }

      data.configs[clientId] = {
        ...data.configs[clientId],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.configsDataPath, data, { spaces: 2 });

      return {
        success: true,
        config: data.configs[clientId],
      };
    } catch (error) {
      logger.error('Error updating client config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Eliminar configuración de un cliente
   */
  async deleteClientConfig(clientId) {
    try {
      const data = await fs.readJson(this.configsDataPath);

      if (data.configs[clientId]) {
        delete data.configs[clientId];
        data.lastUpdated = new Date().toISOString();
        await fs.writeJson(this.configsDataPath, data, { spaces: 2 });
      }

      return {
        success: true,
        message: 'Configuración eliminada exitosamente',
      };
    } catch (error) {
      logger.error('Error deleting client config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtener estadísticas del Client Hub
   */
  async getHubStats() {
    try {
      const clientsData = await fs.readJson(this.clientsDataPath);
      const clients = clientsData.clients || [];

      const stats = {
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'active').length,
        inactiveClients: clients.filter(c => c.status === 'inactive').length,
        pendingClients: clients.filter(c => c.waba?.status === 'pending')
          .length,
        clientsByCategory: {},
        clientsByTimezone: {},
        recentClients: clients
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5),
      };

      // Agrupar por categoría
      clients.forEach(client => {
        const category = client.businessCategory || 'OTHER';
        stats.clientsByCategory[category] =
          (stats.clientsByCategory[category] || 0) + 1;
      });

      // Agrupar por zona horaria
      clients.forEach(client => {
        const timezone = client.timezone || 'Unknown';
        stats.clientsByTimezone[timezone] =
          (stats.clientsByTimezone[timezone] || 0) + 1;
      });

      return {
        success: true,
        stats,
      };
    } catch (error) {
      logger.error('Error getting hub stats:', error);
      return {
        success: false,
        error: error.message,
        stats: {},
      };
    }
  }

  /**
   * Generar ID único para cliente
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generar token de webhook
   */
  generateWebhookToken() {
    return `webhook_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Validar configuración de cliente
   */
  validateClientData(clientData) {
    const errors = [];

    if (!clientData.businessName || clientData.businessName.trim().length < 2) {
      errors.push('Nombre del negocio debe tener al menos 2 caracteres');
    }

    if (
      !clientData.businessEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientData.businessEmail)
    ) {
      errors.push('Email del negocio debe ser válido');
    }

    if (
      !clientData.businessPhone ||
      clientData.businessPhone.trim().length < 10
    ) {
      errors.push('Teléfono del negocio debe tener al menos 10 dígitos');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default new ClientHubService();
