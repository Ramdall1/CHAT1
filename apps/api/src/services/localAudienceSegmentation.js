import fs from 'fs-extra';
import path from 'path';

class LocalAudienceSegmentation {
  constructor(dataDir, contactManager) {
    this.dataDir = dataDir;
    this.contactManager = contactManager;
    this.segmentsFile = path.join(dataDir, 'audience_segments.json');
    this.rulesFile = path.join(dataDir, 'segmentation_rules.json');

    this.segments = new Map();
    this.rules = new Map();
    this.segmentCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos

    this.init();
  }

  async init() {
    await fs.ensureDir(this.dataDir);
    await this.loadSegments();
    await this.loadRules();
    this.startCacheCleanup();
  }

  // ===== GESTIÓN DE SEGMENTOS =====
  async loadSegments() {
    try {
      if (await fs.pathExists(this.segmentsFile)) {
        const data = await fs.readJson(this.segmentsFile);
        this.segments = new Map(Object.entries(data));
      } else {
        await this.createDefaultSegments();
      }
    } catch (error) {
      console.log('⚠️ Error cargando segmentos:', error.message);
    }
  }

  async saveSegments() {
    try {
      const data = Object.fromEntries(this.segments);
      await fs.writeJson(this.segmentsFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando segmentos:', error.message);
    }
  }

  async createDefaultSegments() {
    const defaultSegments = [
      {
        name: 'Todos los contactos',
        description: 'Todos los contactos en la base de datos',
        type: 'static',
        criteria: { type: 'all' },
        isDefault: true,
      },
      {
        name: 'Contactos activos',
        description: 'Contactos que han interactuado en los últimos 30 días',
        type: 'dynamic',
        criteria: {
          type: 'last_interaction',
          operator: 'within',
          value: 30,
          unit: 'days',
        },
      },
      {
        name: 'Nuevos contactos',
        description: 'Contactos creados en los últimos 7 días',
        type: 'dynamic',
        criteria: {
          type: 'created_date',
          operator: 'within',
          value: 7,
          unit: 'days',
        },
      },
      {
        name: 'VIP',
        description: 'Contactos con etiqueta VIP',
        type: 'dynamic',
        criteria: {
          type: 'has_tag',
          value: 'VIP',
        },
      },
    ];

    for (const segment of defaultSegments) {
      const segmentData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        ...segment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contactCount: 0,
        lastCalculated: null,
      };
      this.segments.set(segmentData.id, segmentData);
    }

    await this.saveSegments();
    console.log('✅ Segmentos por defecto creados');
  }

  createSegment(name, description, criteria, type = 'dynamic') {
    const segment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name,
      description,
      type, // 'static' o 'dynamic'
      criteria,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactCount: 0,
      lastCalculated: null,
      isActive: true,
    };

    this.segments.set(segment.id, segment);
    this.saveSegments();

    // Calcular contactos inmediatamente
    this.calculateSegmentContacts(segment.id);

    return segment;
  }

  updateSegment(segmentId, updates) {
    const segment = this.segments.get(segmentId);
    if (!segment) return null;

    const updated = {
      ...segment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.segments.set(segmentId, updated);
    this.saveSegments();

    // Limpiar cache y recalcular
    this.segmentCache.delete(segmentId);
    this.calculateSegmentContacts(segmentId);

    return updated;
  }

  getSegment(segmentId) {
    return this.segments.get(segmentId) || null;
  }

  getAllSegments() {
    return Array.from(this.segments.values());
  }

  deleteSegment(segmentId) {
    const segment = this.segments.get(segmentId);
    if (!segment || segment.isDefault) return false;

    const deleted = this.segments.delete(segmentId);
    if (deleted) {
      this.segmentCache.delete(segmentId);
      this.saveSegments();
    }
    return deleted;
  }

  // ===== CÁLCULO DE SEGMENTOS =====
  async calculateSegmentContacts(segmentId) {
    const segment = this.segments.get(segmentId);
    if (!segment) return [];

    // Verificar cache
    const cached = this.segmentCache.get(segmentId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.contacts;
    }

    const allContacts = this.contactManager.getAllContacts();
    const segmentContacts = this.filterContactsByCriteria(
      allContacts,
      segment.criteria
    );

    // Actualizar estadísticas del segmento
    segment.contactCount = segmentContacts.length;
    segment.lastCalculated = new Date().toISOString();
    this.saveSegments();

    // Guardar en cache
    this.segmentCache.set(segmentId, {
      contacts: segmentContacts,
      timestamp: Date.now(),
    });

    console.log(
      `📊 Segmento "${segment.name}": ${segmentContacts.length} contactos`
    );
    return segmentContacts;
  }

  filterContactsByCriteria(contacts, criteria) {
    if (!criteria || !contacts) return [];

    switch (criteria.type) {
      case 'all':
        return contacts;

      case 'has_tag':
        return contacts.filter(
          contact => contact.tags && contact.tags.includes(criteria.value)
        );

      case 'missing_tag':
        return contacts.filter(
          contact => !contact.tags || !contact.tags.includes(criteria.value)
        );

      case 'custom_field_equals':
        return contacts.filter(
          contact =>
            contact.customFields &&
            contact.customFields[criteria.field] === criteria.value
        );

      case 'custom_field_contains':
        return contacts.filter(
          contact =>
            contact.customFields &&
            contact.customFields[criteria.field] &&
            contact.customFields[criteria.field]
              .toLowerCase()
              .includes(criteria.value.toLowerCase())
        );

      case 'created_date':
        return this.filterByDate(contacts, criteria, 'createdAt');

      case 'last_interaction':
        return this.filterByDate(contacts, criteria, 'lastContact');

      case 'phone_starts_with':
        return contacts.filter(contact =>
          contact.phone.startsWith(criteria.value)
        );

      case 'name_contains':
        return contacts.filter(
          contact =>
            contact.name &&
            contact.name.toLowerCase().includes(criteria.value.toLowerCase())
        );

      case 'and':
        return criteria.conditions.reduce(
          (filtered, condition) =>
            this.filterContactsByCriteria(filtered, condition),
          contacts
        );

      case 'or':
        const results = new Set();
        criteria.conditions.forEach(condition => {
          const filtered = this.filterContactsByCriteria(contacts, condition);
          filtered.forEach(contact => results.add(contact));
        });
        return Array.from(results);

      case 'not':
        const excluded = this.filterContactsByCriteria(
          contacts,
          criteria.condition
        );
        const excludedPhones = new Set(excluded.map(c => c.phone));
        return contacts.filter(contact => !excludedPhones.has(contact.phone));

      default:
        console.log(`⚠️ Tipo de criterio no soportado: ${criteria.type}`);
        return [];
    }
  }

  filterByDate(contacts, criteria, dateField) {
    const now = new Date();
    let targetDate;

    switch (criteria.operator) {
      case 'within':
        targetDate = new Date(
          now - criteria.value * this.getMilliseconds(criteria.unit)
        );
        return contacts.filter(contact => {
          const contactDate = new Date(contact[dateField]);
          return contactDate >= targetDate;
        });

      case 'before':
        targetDate = new Date(
          now - criteria.value * this.getMilliseconds(criteria.unit)
        );
        return contacts.filter(contact => {
          const contactDate = new Date(contact[dateField]);
          return contactDate < targetDate;
        });

      case 'after':
        targetDate = new Date(criteria.value);
        return contacts.filter(contact => {
          const contactDate = new Date(contact[dateField]);
          return contactDate > targetDate;
        });

      case 'between':
        const startDate = new Date(criteria.startDate);
        const endDate = new Date(criteria.endDate);
        return contacts.filter(contact => {
          const contactDate = new Date(contact[dateField]);
          return contactDate >= startDate && contactDate <= endDate;
        });

      default:
        return contacts;
    }
  }

  getMilliseconds(unit) {
    switch (unit) {
      case 'minutes':
        return 60 * 1000;
      case 'hours':
        return 60 * 60 * 1000;
      case 'days':
        return 24 * 60 * 60 * 1000;
      case 'weeks':
        return 7 * 24 * 60 * 60 * 1000;
      case 'months':
        return 30 * 24 * 60 * 60 * 1000;
      case 'years':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // días por defecto
    }
  }

  // ===== REGLAS DE SEGMENTACIÓN AUTOMÁTICA =====
  async loadRules() {
    try {
      if (await fs.pathExists(this.rulesFile)) {
        const data = await fs.readJson(this.rulesFile);
        this.rules = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando reglas:', error.message);
    }
  }

  async saveRules() {
    try {
      const data = Object.fromEntries(this.rules);
      await fs.writeJson(this.rulesFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando reglas:', error.message);
    }
  }

  createRule(name, trigger, actions) {
    const rule = {
      id: Date.now().toString(),
      name,
      trigger, // Evento que activa la regla
      actions, // Acciones a ejecutar
      isActive: true,
      createdAt: new Date().toISOString(),
      stats: {
        triggered: 0,
        executed: 0,
        failed: 0,
      },
    };

    this.rules.set(rule.id, rule);
    this.saveRules();
    return rule;
  }

  async processRules(eventType, contactData) {
    const activeRules = Array.from(this.rules.values()).filter(
      rule => rule.isActive && rule.trigger.type === eventType
    );

    for (const rule of activeRules) {
      if (this.evaluateRuleTrigger(rule.trigger, contactData)) {
        rule.stats.triggered++;

        try {
          await this.executeRuleActions(rule.actions, contactData);
          rule.stats.executed++;
          console.log(
            `✅ Regla "${rule.name}" ejecutada para ${contactData.phone}`
          );
        } catch (error) {
          rule.stats.failed++;
          console.log(
            `❌ Error ejecutando regla "${rule.name}":`,
            error.message
          );
        }

        this.saveRules();
      }
    }
  }

  evaluateRuleTrigger(trigger, contactData) {
    switch (trigger.type) {
      case 'contact_created':
        return true;

      case 'tag_added':
        return contactData.tagName === trigger.tagName;

      case 'custom_field_changed':
        return contactData.fieldName === trigger.fieldName;

      case 'message_received':
        return trigger.keywords
          ? trigger.keywords.some(keyword =>
              contactData.message.toLowerCase().includes(keyword.toLowerCase())
            )
          : true;

      default:
        return false;
    }
  }

  async executeRuleActions(actions, contactData) {
    for (const action of actions) {
      switch (action.type) {
        case 'add_to_segment':
          // Agregar contacto a segmento estático
          await this.addContactToStaticSegment(
            action.segmentId,
            contactData.phone
          );
          break;

        case 'add_tag':
          this.contactManager.addTagToContact(
            contactData.phone,
            action.tagName
          );
          break;

        case 'remove_tag':
          this.contactManager.removeTagFromContact(
            contactData.phone,
            action.tagName
          );
          break;

        case 'set_custom_field':
          this.contactManager.setCustomFieldValue(
            contactData.phone,
            action.fieldName,
            action.fieldValue
          );
          break;

        case 'send_message':
          // Integrar con servicio de mensajería
          console.log(
            `📱 Enviar mensaje automático a ${contactData.phone}: ${action.message}`
          );
          break;
      }
    }
  }

  // ===== SEGMENTOS ESTÁTICOS =====
  async addContactToStaticSegment(segmentId, phone) {
    const segment = this.segments.get(segmentId);
    if (!segment || segment.type !== 'static') return false;

    if (!segment.contacts) {
      segment.contacts = [];
    }

    if (!segment.contacts.includes(phone)) {
      segment.contacts.push(phone);
      segment.contactCount = segment.contacts.length;
      segment.updatedAt = new Date().toISOString();

      // Limpiar cache
      this.segmentCache.delete(segmentId);

      await this.saveSegments();
      console.log(
        `➕ Contacto ${phone} agregado al segmento "${segment.name}"`
      );
    }

    return true;
  }

  async removeContactFromStaticSegment(segmentId, phone) {
    const segment = this.segments.get(segmentId);
    if (!segment || segment.type !== 'static' || !segment.contacts)
      return false;

    const index = segment.contacts.indexOf(phone);
    if (index > -1) {
      segment.contacts.splice(index, 1);
      segment.contactCount = segment.contacts.length;
      segment.updatedAt = new Date().toISOString();

      // Limpiar cache
      this.segmentCache.delete(segmentId);

      await this.saveSegments();
      console.log(
        `➖ Contacto ${phone} removido del segmento "${segment.name}"`
      );
    }

    return true;
  }

  // ===== ANÁLISIS Y ESTADÍSTICAS =====
  getSegmentAnalytics(segmentId) {
    const segment = this.segments.get(segmentId);
    if (!segment) return null;

    const contacts = this.calculateSegmentContacts(segmentId);

    // Análisis de etiquetas
    const tagAnalysis = {};
    contacts.forEach(contact => {
      if (contact.tags) {
        contact.tags.forEach(tag => {
          tagAnalysis[tag] = (tagAnalysis[tag] || 0) + 1;
        });
      }
    });

    // Análisis de campos personalizados
    const customFieldAnalysis = {};
    contacts.forEach(contact => {
      if (contact.customFields) {
        Object.keys(contact.customFields).forEach(field => {
          if (!customFieldAnalysis[field]) {
            customFieldAnalysis[field] = {};
          }
          const value = contact.customFields[field];
          customFieldAnalysis[field][value] =
            (customFieldAnalysis[field][value] || 0) + 1;
        });
      }
    });

    // Análisis temporal
    const now = new Date();
    const timeAnalysis = {
      last24h: 0,
      last7d: 0,
      last30d: 0,
      older: 0,
    };

    contacts.forEach(contact => {
      const lastContact = contact.lastContact
        ? new Date(contact.lastContact)
        : new Date(contact.createdAt);
      const daysDiff = (now - lastContact) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 1) timeAnalysis.last24h++;
      else if (daysDiff <= 7) timeAnalysis.last7d++;
      else if (daysDiff <= 30) timeAnalysis.last30d++;
      else timeAnalysis.older++;
    });

    return {
      segment,
      totalContacts: contacts.length,
      tagAnalysis,
      customFieldAnalysis,
      timeAnalysis,
      lastCalculated: segment.lastCalculated,
    };
  }

  getOverallAnalytics() {
    const allSegments = this.getAllSegments();
    const totalContacts = this.contactManager.getAllContacts().length;

    return {
      totalSegments: allSegments.length,
      totalContacts,
      segmentSummary: allSegments.map(segment => ({
        id: segment.id,
        name: segment.name,
        type: segment.type,
        contactCount: segment.contactCount,
        lastCalculated: segment.lastCalculated,
      })),
      activeRules: Array.from(this.rules.values()).filter(rule => rule.isActive)
        .length,
    };
  }

  // ===== EXPORTACIÓN =====
  async exportSegment(segmentId, format = 'json') {
    const contacts = await this.calculateSegmentContacts(segmentId);
    const segment = this.getSegment(segmentId);

    if (format === 'csv') {
      return this.convertContactsToCSV(contacts);
    }

    return {
      segment,
      contacts,
      exportedAt: new Date().toISOString(),
    };
  }

  convertContactsToCSV(contacts) {
    if (contacts.length === 0) return '';

    const headers = [
      'phone',
      'name',
      'email',
      'tags',
      'createdAt',
      'lastContact',
    ];
    const csvContent = [
      headers.join(','),
      ...contacts.map(contact =>
        [
          contact.phone,
          `"${(contact.name || '').replace(/"/g, '""')}"`,
          contact.email || '',
          `"${(contact.tags || []).join(', ')}"`,
          contact.createdAt,
          contact.lastContact || '',
        ].join(',')
      ),
    ].join('\n');

    return csvContent;
  }

  // ===== LIMPIEZA Y MANTENIMIENTO =====
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [segmentId, cached] of this.segmentCache.entries()) {
        if (now - cached.timestamp > this.cacheExpiry) {
          this.segmentCache.delete(segmentId);
        }
      }
    }, this.cacheExpiry);
  }

  async recalculateAllSegments() {
    console.log('🔄 Recalculando todos los segmentos...');

    for (const segment of this.segments.values()) {
      if (segment.type === 'dynamic') {
        await this.calculateSegmentContacts(segment.id);
      }
    }

    console.log('✅ Recálculo de segmentos completado');
  }

  // ===== BÚSQUEDA Y FILTROS AVANZADOS =====
  searchSegments(query) {
    const segments = this.getAllSegments();

    if (!query) return segments;

    return segments.filter(
      segment =>
        segment.name.toLowerCase().includes(query.toLowerCase()) ||
        segment.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  getSegmentsByType(type) {
    return this.getAllSegments().filter(segment => segment.type === type);
  }

  getActiveSegments() {
    return this.getAllSegments().filter(segment => segment.isActive);
  }
}

export default LocalAudienceSegmentation;
