import fs from 'fs-extra';
import path from 'path';

class BulkMessagingService {
  constructor(dataDir, whatsappService, tagManager) {
    this.dataDir = dataDir;
    this.whatsappService = whatsappService;
    this.tagManager = tagManager;
    this.campaignsFile = path.join(dataDir, 'bulk_campaigns.json');
    this.scheduledFile = path.join(dataDir, 'scheduled_messages.json');

    this.campaigns = new Map();
    this.scheduledMessages = new Map();
    this.activeJobs = new Map();

    this.init();
  }

  async init() {
    await fs.ensureDir(this.dataDir);
    await this.loadCampaigns();
    await this.loadScheduledMessages();
    this.startScheduler();
  }

  // ===== GESTIÓN DE CAMPAÑAS =====
  async loadCampaigns() {
    try {
      if (await fs.pathExists(this.campaignsFile)) {
        const data = await fs.readJson(this.campaignsFile);
        this.campaigns = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando campañas:', error.message);
    }
  }

  async saveCampaigns() {
    try {
      const data = Object.fromEntries(this.campaigns);
      await fs.writeJson(this.campaignsFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando campañas:', error.message);
    }
  }

  createCampaign(name, message, targetCriteria, options = {}) {
    const id = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const campaign = {
      id,
      name,
      message: {
        type: message.type || 'text',
        content: message.content,
        template: message.template || null,
        variables: message.variables || {},
        media: message.media || null,
      },
      targetCriteria: {
        type: targetCriteria.type, // 'all', 'tags', 'segments', 'custom'
        tags: targetCriteria.tags || [],
        segments: targetCriteria.segments || [],
        customFilter: targetCriteria.customFilter || null,
        excludeTags: targetCriteria.excludeTags || [],
        operator: targetCriteria.operator || 'AND', // AND/OR para múltiples criterios
      },
      options: {
        sendImmediately: options.sendImmediately || false,
        scheduledTime: options.scheduledTime || null,
        respectDoNotDisturb: options.respectDoNotDisturb !== false,
        rateLimitPerMinute: options.rateLimitPerMinute || 30,
        personalizeMessage: options.personalizeMessage || false,
        trackDelivery: options.trackDelivery !== false,
        trackReads: options.trackReads || false,
        trackClicks: options.trackClicks || false,
      },
      status: 'draft', // draft, scheduled, sending, completed, failed, paused
      stats: {
        targetCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        clickCount: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      errors: [],
    };

    this.campaigns.set(id, campaign);
    this.saveCampaigns();
    return campaign;
  }

  updateCampaign(campaignId, updates) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    // No permitir editar campañas que ya están enviándose
    if (['sending', 'completed'].includes(campaign.status)) {
      throw new Error(
        'No se puede editar una campaña que ya está enviándose o completada'
      );
    }

    const updatedCampaign = {
      ...campaign,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.campaigns.set(campaignId, updatedCampaign);
    this.saveCampaigns();
    return updatedCampaign;
  }

  // ===== SELECCIÓN DE DESTINATARIOS =====
  async getTargetContacts(targetCriteria, contactManager) {
    let contacts = [];

    switch (targetCriteria.type) {
      case 'all':
        contacts = contactManager.getAllContacts();
        break;

      case 'tags':
        if (targetCriteria.tags.length > 0) {
          contacts = this.tagManager
            .getContactsByMultipleTags(
              targetCriteria.tags,
              targetCriteria.operator
            )
            .map(phone => contactManager.getContact(phone))
            .filter(Boolean);
        }
        break;

      case 'segments':
        // Implementar lógica de segmentos
        for (const segmentId of targetCriteria.segments) {
          const segmentContacts = contactManager.getSegmentContacts(segmentId);
          contacts = contacts.concat(segmentContacts);
        }
        // Remover duplicados
        contacts = contacts.filter(
          (contact, index, self) =>
            index === self.findIndex(c => c.phone === contact.phone)
        );
        break;

      case 'custom':
        if (targetCriteria.customFilter) {
          contacts = contactManager
            .getAllContacts()
            .filter(contact =>
              this.evaluateCustomFilter(contact, targetCriteria.customFilter)
            );
        }
        break;
    }

    // Aplicar exclusiones por etiquetas
    if (targetCriteria.excludeTags && targetCriteria.excludeTags.length > 0) {
      const excludeContacts = this.tagManager.getContactsByMultipleTags(
        targetCriteria.excludeTags,
        'OR'
      );
      contacts = contacts.filter(
        contact => !excludeContacts.includes(contact.phone)
      );
    }

    // Filtrar contactos que no quieren ser molestados
    contacts = contacts.filter(contact => {
      const tags = this.tagManager.getContactTags(contact.phone);
      return !tags.some(tag => tag.name === 'No Molestar');
    });

    return contacts;
  }

  evaluateCustomFilter(contact, filter) {
    // Implementar lógica de filtros personalizados
    // Por ejemplo: last_seen > 30 days, custom_field = value, etc.
    try {
      switch (filter.field) {
        case 'last_seen':
          const lastSeen = new Date(contact.lastSeen || 0);
          const daysAgo =
            (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
          return this.compareValues(daysAgo, filter.operator, filter.value);

        case 'created_at':
          const createdAt = new Date(contact.createdAt || 0);
          const daysOld =
            (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return this.compareValues(daysOld, filter.operator, filter.value);

        case 'custom_field':
          const fieldValue = contact.customFields?.[filter.fieldName];
          return this.compareValues(fieldValue, filter.operator, filter.value);

        default:
          return true;
      }
    } catch (error) {
      console.log('Error evaluando filtro personalizado:', error);
      return false;
    }
  }

  compareValues(actual, operator, expected) {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return String(actual)
          .toLowerCase()
          .includes(String(expected).toLowerCase());
      case 'not_contains':
        return !String(actual)
          .toLowerCase()
          .includes(String(expected).toLowerCase());
      default:
        return true;
    }
  }

  // ===== ENVÍO DE MENSAJES =====
  async startCampaign(campaignId, contactManager) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('La campaña ya está en proceso o completada');
    }

    // Obtener contactos objetivo
    const targetContacts = await this.getTargetContacts(
      campaign.targetCriteria,
      contactManager
    );

    // Actualizar estadísticas
    campaign.stats.targetCount = targetContacts.length;
    campaign.status = 'sending';
    campaign.startedAt = new Date().toISOString();

    this.campaigns.set(campaignId, campaign);
    this.saveCampaigns();

    // Iniciar envío
    this.sendToContacts(campaignId, targetContacts);

    return {
      campaignId,
      targetCount: targetContacts.length,
      status: 'sending',
    };
  }

  async sendToContacts(campaignId, contacts) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    const rateLimit = campaign.options.rateLimitPerMinute || 30;
    const delayBetweenMessages = (60 * 1000) / rateLimit; // ms entre mensajes

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        // Personalizar mensaje si está habilitado
        let messageContent = campaign.message.content;
        if (campaign.options.personalizeMessage) {
          messageContent = this.personalizeMessage(messageContent, contact);
        }

        // Enviar mensaje
        const result = await this.sendSingleMessage(contact.phone, {
          ...campaign.message,
          content: messageContent,
        });

        if (result.success) {
          campaign.stats.sentCount++;
        } else {
          campaign.stats.failedCount++;
          campaign.errors.push({
            phone: contact.phone,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
        }

        // Actualizar progreso cada 10 mensajes
        if (i % 10 === 0) {
          campaign.updatedAt = new Date().toISOString();
          this.campaigns.set(campaignId, campaign);
          this.saveCampaigns();
        }

        // Aplicar rate limiting
        if (i < contacts.length - 1) {
          await this.delay(delayBetweenMessages);
        }
      } catch (error) {
        campaign.stats.failedCount++;
        campaign.errors.push({
          phone: contact.phone,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Marcar campaña como completada
    campaign.status = 'completed';
    campaign.completedAt = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();

    this.campaigns.set(campaignId, campaign);
    this.saveCampaigns();

    console.log(
      `✅ Campaña ${campaignId} completada: ${campaign.stats.sentCount}/${campaign.stats.targetCount} mensajes enviados`
    );
  }

  async sendSingleMessage(phone, message) {
    try {
      switch (message.type) {
        case 'text':
          await this.whatsappService.sendMessage(phone, message.content);
          break;

        case 'template':
          await this.whatsappService.sendTemplate(
            phone,
            message.template,
            message.variables
          );
          break;

        case 'media':
          await this.whatsappService.sendMedia(
            phone,
            message.media.type,
            message.media.url,
            message.content
          );
          break;

        default:
          throw new Error(`Tipo de mensaje no soportado: ${message.type}`);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  personalizeMessage(template, contact) {
    let personalized = template;

    // Reemplazar variables comunes
    const variables = {
      '{name}': contact.name || 'Estimado/a',
      '{first_name}': (contact.name || '').split(' ')[0] || 'Estimado/a',
      '{phone}': contact.phone,
      '{last_message}': contact.lastMessage || '',
    };

    // Reemplazar campos personalizados
    if (contact.customFields) {
      for (const [field, value] of Object.entries(contact.customFields)) {
        variables[`{${field}}`] = value;
      }
    }

    for (const [variable, value] of Object.entries(variables)) {
      personalized = personalized.replace(new RegExp(variable, 'g'), value);
    }

    return personalized;
  }

  // ===== PROGRAMACIÓN =====
  async loadScheduledMessages() {
    try {
      if (await fs.pathExists(this.scheduledFile)) {
        const data = await fs.readJson(this.scheduledFile);
        this.scheduledMessages = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando mensajes programados:', error.message);
    }
  }

  async saveScheduledMessages() {
    try {
      const data = Object.fromEntries(this.scheduledMessages);
      await fs.writeJson(this.scheduledFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando mensajes programados:', error.message);
    }
  }

  scheduleCampaign(campaignId, scheduledTime) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    campaign.options.scheduledTime = scheduledTime;
    campaign.status = 'scheduled';
    campaign.updatedAt = new Date().toISOString();

    this.campaigns.set(campaignId, campaign);
    this.saveCampaigns();

    return campaign;
  }

  startScheduler() {
    // Revisar mensajes programados cada minuto
    setInterval(() => {
      this.checkScheduledCampaigns();
    }, 60000);
  }

  async checkScheduledCampaigns() {
    const now = new Date();

    for (const campaign of this.campaigns.values()) {
      if (campaign.status === 'scheduled' && campaign.options.scheduledTime) {
        const scheduledTime = new Date(campaign.options.scheduledTime);

        if (now >= scheduledTime) {
          console.log(`🚀 Iniciando campaña programada: ${campaign.name}`);
          try {
            await this.startCampaign(campaign.id, this.contactManager);
          } catch (error) {
            console.log(
              `❌ Error iniciando campaña programada ${campaign.id}:`,
              error.message
            );
            campaign.status = 'failed';
            campaign.errors.push({
              error: error.message,
              timestamp: new Date().toISOString(),
            });
            this.campaigns.set(campaign.id, campaign);
            this.saveCampaigns();
          }
        }
      }
    }
  }

  // ===== CONTROL DE CAMPAÑAS =====
  pauseCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    if (campaign.status === 'sending') {
      campaign.status = 'paused';
      campaign.updatedAt = new Date().toISOString();
      this.campaigns.set(campaignId, campaign);
      this.saveCampaigns();
    }

    return campaign;
  }

  resumeCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    if (campaign.status === 'paused') {
      campaign.status = 'sending';
      campaign.updatedAt = new Date().toISOString();
      this.campaigns.set(campaignId, campaign);
      this.saveCampaigns();
    }

    return campaign;
  }

  cancelCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    campaign.status = 'cancelled';
    campaign.completedAt = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();

    this.campaigns.set(campaignId, campaign);
    this.saveCampaigns();

    return campaign;
  }

  // ===== ESTADÍSTICAS =====
  getCampaignStats(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    return {
      ...campaign.stats,
      deliveryRate:
        campaign.stats.targetCount > 0
          ? (
              (campaign.stats.sentCount / campaign.stats.targetCount) *
              100
            ).toFixed(2)
          : 0,
      readRate:
        campaign.stats.sentCount > 0
          ? (
              (campaign.stats.readCount / campaign.stats.sentCount) *
              100
            ).toFixed(2)
          : 0,
      clickRate:
        campaign.stats.sentCount > 0
          ? (
              (campaign.stats.clickCount / campaign.stats.sentCount) *
              100
            ).toFixed(2)
          : 0,
    };
  }

  getAllCampaigns() {
    return Array.from(this.campaigns.values());
  }

  getCampaign(campaignId) {
    return this.campaigns.get(campaignId) || null;
  }

  // ===== UTILIDADES =====
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BulkMessagingService;
