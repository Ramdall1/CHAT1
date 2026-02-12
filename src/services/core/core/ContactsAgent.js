/**
 * ContactsAgent - Agente Event-Driven para Gestión Inteligente de Contactos
 * 
 * Transforma el módulo de contactos en un agente inteligente que maneja:
 * - Gestión inteligente de contactos y duplicados
 * - Segmentación automática y dinámica
 * - Análisis de comportamiento y patrones
 * - Sincronización con fuentes externas
 * - Enriquecimiento automático de datos
 * - Validación y normalización
 * - Monitoreo de calidad de datos
 * - Alertas y notificaciones
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { getDatabase } from './database.js';
import { createLogger } from './logger.js';
import { Contact } from '../core/Contact.js';

const logger = createLogger('CONTACTS_AGENT');

/**
 * Agente inteligente para gestión de contactos
 */
export class ContactsAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuraciones evolutivas del agente
    this.config = {
      // Configuración de duplicados
      duplicateDetection: {
        enabled: true,
        threshold: 0.85, // Umbral de similitud
        autoMerge: false,
        fields: ['phone', 'email', 'name']
      },
      
      // Configuración de segmentación
      segmentation: {
        enabled: true,
        autoUpdate: true,
        updateInterval: 60 * 60 * 1000, // 1 hora
        maxSegments: 100
      },
      
      // Configuración de enriquecimiento
      enrichment: {
        enabled: true,
        sources: ['social', 'business', 'location'],
        autoEnrich: true,
        batchSize: 10
      },
      
      // Configuración de validación
      validation: {
        phoneValidation: true,
        emailValidation: true,
        nameNormalization: true,
        addressValidation: false
      },
      
      // Configuración de sincronización
      sync: {
        enabled: false,
        sources: [],
        interval: 24 * 60 * 60 * 1000, // 24 horas
        conflictResolution: 'manual'
      },
      
      // Configuración de análisis
      analytics: {
        enabled: true,
        trackInteractions: true,
        behaviorAnalysis: true,
        retentionPeriod: 90 * 24 * 60 * 60 * 1000 // 90 días
      },
      
      // Configuración de alertas
      alerts: {
        duplicateThreshold: 10,
        inactiveContactDays: 30,
        dataQualityThreshold: 0.8,
        segmentSizeThreshold: 1000
      },
      
      // Configuración de optimización
      optimization: {
        enabled: true,
        interval: 6 * 60 * 60 * 1000, // 6 horas
        autoCleanup: true,
        archiveInactive: true
      },
      
      ...options
    };
    
    // Estado del agente
    this.state = {
      isActive: false,
      isProcessing: false,
      lastSync: null,
      lastOptimization: null,
      lastAnalysis: null,
      totalContacts: 0,
      duplicatesFound: 0,
      segmentsUpdated: 0
    };
    
    // Gestión de contactos y datos
    this.contacts = new Map();
    this.segments = new Map();
    this.tags = new Map();
    this.customFields = new Map();
    this.duplicateCandidates = new Map();
    
    // Sistema de análisis y patrones
    this.behaviorPatterns = new Map();
    this.interactionHistory = [];
    this.segmentationRules = new Map();
    this.enrichmentQueue = [];
    
    // Métricas evolutivas
    this.metrics = {
      contacts: {
        total: 0,
        active: 0,
        inactive: 0,
        duplicates: 0,
        enriched: 0,
        validated: 0
      },
      segments: {
        total: 0,
        dynamic: 0,
        static: 0,
        avgSize: 0
      },
      quality: {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        validity: 0
      },
      operations: {
        created: 0,
        updated: 0,
        deleted: 0,
        merged: 0,
        enriched: 0
      }
    };
    
    // Colas de procesamiento
    this.processingQueues = {
      validation: [],
      enrichment: [],
      segmentation: [],
      deduplication: []
    };
    
    // Timers y procesos
    this.timers = {
      segmentation: null,
      optimization: null,
      sync: null,
      analytics: null,
      cleanup: null
    };
    
    // Mutex para operaciones críticas
    this.mutex = {
      processing: false,
      segmentation: false,
      sync: false,
      persistence: false
    };
    
    // Dependencias
    this.db = getDatabase();
    this.files = this.db.files;
    
    // Configurar manejo de errores
    this.setMaxListeners(100);
    this.on('error', this.handleError.bind(this));
    
    logger.info('ContactsAgent inicializado');
  }
  
  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      logger.info('Inicializando ContactsAgent...');
      
      // Cargar estado persistente
      await this.loadState();
      
      // Cargar datos de contactos
      await this.loadContacts();
      
      // Cargar segmentos y reglas
      await this.loadSegments();
      
      // Cargar patrones de comportamiento
      await this.loadBehaviorPatterns();
      
      // Configurar eventos del sistema
      this.setupSystemEvents();
      
      // Configurar eventos de contactos
      this.setupContactEvents();
      
      this.state.isActive = true;
      this.emit('agent:initialized', { agent: 'ContactsAgent' });
      
      logger.info('ContactsAgent inicializado exitosamente');
    } catch (error) {
      logger.error('Error inicializando ContactsAgent:', error);
      throw error;
    }
  }
  
  /**
   * Activar el agente
   */
  async activate() {
    if (this.state.isActive) return;
    
    try {
      logger.info('Activando ContactsAgent...');
      
      // Iniciar segmentación automática
      if (this.config.segmentation.enabled) {
        this.startAutoSegmentation();
      }
      
      // Iniciar optimización
      if (this.config.optimization.enabled) {
        this.startOptimization();
      }
      
      // Iniciar sincronización
      if (this.config.sync.enabled) {
        this.startSync();
      }
      
      // Iniciar análisis
      if (this.config.analytics.enabled) {
        this.startAnalytics();
      }
      
      // Iniciar limpieza automática
      this.startCleanup();
      
      this.state.isActive = true;
      this.emit('agent:activated', { agent: 'ContactsAgent' });
      
      logger.info('ContactsAgent activado');
    } catch (error) {
      logger.error('Error activando ContactsAgent:', error);
      throw error;
    }
  }
  
  /**
   * Desactivar el agente
   */
  async deactivate() {
    if (!this.state.isActive) return;
    
    try {
      logger.info('Desactivando ContactsAgent...');
      
      // Detener timers
      this.stopTimers();
      
      // Procesar colas pendientes
      await this.processRemainingQueues();
      
      // Guardar estado
      await this.saveState();
      
      this.state.isActive = false;
      this.emit('agent:deactivated', { agent: 'ContactsAgent' });
      
      logger.info('ContactsAgent desactivado');
    } catch (error) {
      logger.error('Error desactivando ContactsAgent:', error);
      throw error;
    }
  }
  
  /**
   * Configurar eventos del sistema
   */
  setupSystemEvents() {
    // Eventos de otros agentes
    this.on('system:shutdown', this.handleSystemShutdown.bind(this));
    this.on('system:restart', this.handleSystemRestart.bind(this));
    this.on('system:optimization', this.handleOptimizationTrigger.bind(this));
    
    // Eventos de configuración
    this.on('config:updated', this.handleConfigUpdate.bind(this));
    this.on('data:sync', this.handleDataSync.bind(this));
    
    // Eventos de monitoreo
    this.on('metrics:alert', this.handleMetricsAlert.bind(this));
    this.on('quality:degradation', this.handleQualityDegradation.bind(this));
  }
  
  /**
   * Configurar eventos de contactos
   */
  setupContactEvents() {
    // Eventos de gestión de contactos
    this.on('contact:create', this.handleCreateContact.bind(this));
    this.on('contact:update', this.handleUpdateContact.bind(this));
    this.on('contact:delete', this.handleDeleteContact.bind(this));
    this.on('contact:merge', this.handleMergeContacts.bind(this));
    
    // Eventos de interacción
    this.on('contact:interaction', this.handleContactInteraction.bind(this));
    this.on('contact:message', this.handleContactMessage.bind(this));
    this.on('contact:activity', this.handleContactActivity.bind(this));
    
    // Eventos de segmentación
    this.on('segment:create', this.handleCreateSegment.bind(this));
    this.on('segment:update', this.handleUpdateSegment.bind(this));
    this.on('contact:segment_changed', this.handleSegmentChange.bind(this));
    
    // Eventos de enriquecimiento
    this.on('contact:enrich', this.handleEnrichContact.bind(this));
    this.on('contact:validate', this.handleValidateContact.bind(this));
    
    // Eventos de duplicados
    this.on('duplicate:detected', this.handleDuplicateDetected.bind(this));
    this.on('duplicate:resolved', this.handleDuplicateResolved.bind(this));
  }
  
  /**
   * Manejar creación de contacto
   */
  async handleCreateContact(event) {
    try {
      const { contactData, options = {} } = event;
      
      // Validar datos del contacto
      const validatedData = await this.validateContactData(contactData);
      
      // Verificar duplicados
      if (this.config.duplicateDetection.enabled) {
        const duplicates = await this.findDuplicates(validatedData);
        if (duplicates.length > 0) {
          this.emit('duplicate:detected', { 
            contact: validatedData, 
            duplicates,
            action: 'create'
          });
          
          if (!options.ignoreDuplicates) {
            throw new Error('Contacto duplicado detectado');
          }
        }
      }
      
      // Crear contacto
      const contact = new Contact(validatedData);
      
      // Guardar en base de datos
      const savedContact = await this.db.append(this.files.CONTACTS, contact.toJSON());
      const contactInstance = Contact.fromJSON(savedContact);
      
      // Añadir a caché local
      this.contacts.set(contactInstance.id, contactInstance);
      
      // Añadir a cola de enriquecimiento
      if (this.config.enrichment.enabled && this.config.enrichment.autoEnrich) {
        this.addToEnrichmentQueue(contactInstance);
      }
      
      // Actualizar segmentos
      await this.updateContactSegments(contactInstance);
      
      // Actualizar métricas
      this.updateMetrics('contact_created', contactInstance);
      
      // Emitir evento de creación
      this.emit('contact:created', { 
        contact: contactInstance,
        source: options.source || 'manual'
      });
      
      logger.info(`Contacto creado: ${contactInstance.id} (${contactInstance.name})`);
      
      return contactInstance;
      
    } catch (error) {
      logger.error('Error creando contacto:', error);
      this.emit('error', { type: 'contact_creation', error });
      throw error;
    }
  }
  
  /**
   * Manejar actualización de contacto
   */
  async handleUpdateContact(event) {
    try {
      const { contactId, updates, options = {} } = event;
      
      // Obtener contacto actual
      const currentContact = this.contacts.get(contactId) || 
        await this.getContactById(contactId);
      
      if (!currentContact) {
        throw new Error(`Contacto ${contactId} no encontrado`);
      }
      
      // Validar actualizaciones
      const validatedUpdates = await this.validateContactData(updates, true);
      
      // Verificar duplicados si se cambian campos críticos
      if (this.config.duplicateDetection.enabled && 
          (validatedUpdates.phone || validatedUpdates.email)) {
        const testData = { ...currentContact.toJSON(), ...validatedUpdates };
        const duplicates = await this.findDuplicates(testData, contactId);
        
        if (duplicates.length > 0) {
          this.emit('duplicate:detected', { 
            contact: testData, 
            duplicates,
            action: 'update'
          });
          
          if (!options.ignoreDuplicates) {
            throw new Error('Actualización crearía contacto duplicado');
          }
        }
      }
      
      // Crear contacto actualizado
      const updatedContact = new Contact({ 
        ...currentContact.toJSON(), 
        ...validatedUpdates 
      });
      
      // Actualizar en base de datos
      const savedContact = await this.db.update(this.files.CONTACTS, contactId, updatedContact.toJSON());
      const contactInstance = Contact.fromJSON(savedContact);
      
      // Actualizar caché local
      this.contacts.set(contactId, contactInstance);
      
      // Analizar cambios significativos
      const significantChanges = this.analyzeContactChanges(currentContact, contactInstance);
      
      // Actualizar segmentos si hay cambios relevantes
      if (significantChanges.affectsSegmentation) {
        await this.updateContactSegments(contactInstance);
      }
      
      // Añadir a cola de enriquecimiento si es necesario
      if (significantChanges.needsEnrichment && this.config.enrichment.enabled) {
        this.addToEnrichmentQueue(contactInstance);
      }
      
      // Actualizar métricas
      this.updateMetrics('contact_updated', contactInstance);
      
      // Emitir evento de actualización
      this.emit('contact:updated', { 
        contact: contactInstance,
        previousContact: currentContact,
        changes: significantChanges,
        source: options.source || 'manual'
      });
      
      logger.info(`Contacto actualizado: ${contactId}`);
      
      return contactInstance;
      
    } catch (error) {
      logger.error('Error actualizando contacto:', error);
      this.emit('error', { type: 'contact_update', error });
      throw error;
    }
  }
  
  /**
   * Validar datos de contacto
   */
  async validateContactData(data, isUpdate = false) {
    const validated = { ...data };
    
    // Validación de teléfono
    if (validated.phone && this.config.validation.phoneValidation) {
      validated.phone = this.normalizePhoneNumber(validated.phone);
      if (!this.isValidPhoneNumber(validated.phone)) {
        throw new Error('Número de teléfono inválido');
      }
    }
    
    // Validación de email
    if (validated.email && this.config.validation.emailValidation) {
      validated.email = validated.email.toLowerCase().trim();
      if (!this.isValidEmail(validated.email)) {
        throw new Error('Email inválido');
      }
    }
    
    // Normalización de nombre
    if (validated.name && this.config.validation.nameNormalization) {
      validated.name = this.normalizeName(validated.name);
    }
    
    // Validar campos requeridos para nuevos contactos
    if (!isUpdate) {
      if (!validated.phone) {
        throw new Error('Teléfono es requerido');
      }
    }
    
    return validated;
  }
  
  /**
   * Encontrar contactos duplicados
   */
  async findDuplicates(contactData, excludeId = null) {
    const duplicates = [];
    const threshold = this.config.duplicateDetection.threshold;
    
    for (const [id, contact] of this.contacts) {
      if (excludeId && id === excludeId) continue;
      
      const similarity = this.calculateContactSimilarity(contactData, contact.toJSON());
      
      if (similarity >= threshold) {
        duplicates.push({
          contact,
          similarity,
          matchingFields: this.getMatchingFields(contactData, contact.toJSON())
        });
      }
    }
    
    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * Calcular similitud entre contactos
   */
  calculateContactSimilarity(contact1, contact2) {
    let totalWeight = 0;
    let matchWeight = 0;
    
    const weights = {
      phone: 0.4,
      email: 0.3,
      name: 0.3
    };
    
    for (const field of this.config.duplicateDetection.fields) {
      const weight = weights[field] || 0.1;
      totalWeight += weight;
      
      const value1 = contact1[field]?.toLowerCase().trim() || '';
      const value2 = contact2[field]?.toLowerCase().trim() || '';
      
      if (value1 && value2) {
        if (field === 'phone') {
          // Comparación exacta para teléfonos
          if (this.normalizePhoneNumber(value1) === this.normalizePhoneNumber(value2)) {
            matchWeight += weight;
          }
        } else if (field === 'email') {
          // Comparación exacta para emails
          if (value1 === value2) {
            matchWeight += weight;
          }
        } else if (field === 'name') {
          // Comparación de similitud para nombres
          const similarity = this.calculateStringSimilarity(value1, value2);
          matchWeight += weight * similarity;
        }
      }
    }
    
    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }
  
  /**
   * Calcular similitud entre strings
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Calcular distancia de Levenshtein
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Normalizar número de teléfono
   */
  normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    // Remover caracteres no numéricos excepto +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Si no empieza con +, añadir código de país por defecto
    if (!normalized.startsWith('+')) {
      normalized = '+1' + normalized; // Código de país por defecto
    }
    
    return normalized;
  }
  
  /**
   * Validar número de teléfono
   */
  isValidPhoneNumber(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }
  
  /**
   * Validar email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Normalizar nombre
   */
  normalizeName(name) {
    if (!name) return '';
    
    return name
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Analizar cambios en contacto
   */
  analyzeContactChanges(oldContact, newContact) {
    const changes = {
      affectsSegmentation: false,
      needsEnrichment: false,
      significantFields: [],
      minorFields: []
    };
    
    const significantFields = ['phone', 'email', 'name', 'status', 'tags', 'segments'];
    const oldData = oldContact.toJSON();
    const newData = newContact.toJSON();
    
    for (const field in newData) {
      if (oldData[field] !== newData[field]) {
        if (significantFields.includes(field)) {
          changes.significantFields.push(field);
          
          if (['tags', 'status', 'customFields'].includes(field)) {
            changes.affectsSegmentation = true;
          }
          
          if (['phone', 'email', 'name'].includes(field)) {
            changes.needsEnrichment = true;
          }
        } else {
          changes.minorFields.push(field);
        }
      }
    }
    
    return changes;
  }
  
  /**
   * Cargar contactos desde base de datos
   */
  async loadContacts() {
    try {
      const contactsData = await this.db.read(this.files.CONTACTS) || [];
      
      for (const data of contactsData) {
        const contact = Contact.fromJSON(data);
        this.contacts.set(contact.id, contact);
      }
      
      this.state.totalContacts = this.contacts.size;
      logger.info(`${this.contacts.size} contactos cargados`);
      
    } catch (error) {
      logger.error('Error cargando contactos:', error);
      throw error;
    }
  }
  
  /**
   * Obtener contacto por ID
   */
  async getContactById(id) {
    // Primero buscar en caché
    if (this.contacts.has(id)) {
      return this.contacts.get(id);
    }
    
    // Buscar en base de datos
    const contactData = await this.db.findOne(this.files.CONTACTS, item => item.id === id);
    if (contactData) {
      const contact = Contact.fromJSON(contactData);
      this.contacts.set(id, contact);
      return contact;
    }
    
    return null;
  }
  
  /**
   * Actualizar métricas
   */
  updateMetrics(type, data) {
    switch (type) {
    case 'contact_created':
      this.metrics.contacts.total++;
      this.metrics.operations.created++;
      break;
    case 'contact_updated':
      this.metrics.operations.updated++;
      break;
    case 'contact_deleted':
      this.metrics.contacts.total--;
      this.metrics.operations.deleted++;
      break;
    case 'contact_enriched':
      this.metrics.contacts.enriched++;
      this.metrics.operations.enriched++;
      break;
    case 'contact_merged':
      this.metrics.operations.merged++;
      this.metrics.contacts.duplicates--;
      break;
    }
  }
  
  /**
   * Detener timers
   */
  stopTimers() {
    for (const [name, timer] of Object.entries(this.timers)) {
      if (timer) {
        clearInterval(timer);
        this.timers[name] = null;
      }
    }
    
    logger.info('Timers detenidos');
  }
  
  /**
   * Procesar colas restantes
   */
  async processRemainingQueues() {
    try {
      logger.info('Procesando colas restantes...');
    } catch (error) {
      logger.error('Error procesando colas restantes:', error);
    }
  }
  
  /**
   * Guardar estado del agente
   */
  async saveState() {
    try {
      if (this.mutex.persistence) return;
      this.mutex.persistence = true;
      
      const stateDir = path.join(process.cwd(), 'storage', 'agents');
      await fs.ensureDir(stateDir);
      
      // Guardar estado principal
      const statePath = path.join(stateDir, 'contacts_agent_state.json');
      const state = {
        config: this.config,
        state: this.state,
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeJson(statePath, state, { spaces: 2 });
      
      logger.debug('Estado del agente guardado');
      
    } catch (error) {
      logger.error('Error guardando estado:', error);
    } finally {
      this.mutex.persistence = false;
    }
  }
  
  /**
   * Cargar estado del agente
   */
  async loadState() {
    try {
      const statePath = path.join(process.cwd(), 'storage', 'agents', 'contacts_agent_state.json');
      
      if (await fs.pathExists(statePath)) {
        const savedState = await fs.readJson(statePath);
        
        // Restaurar configuración
        this.config = { ...this.config, ...savedState.config };
        
        // Restaurar estado
        this.state = { ...this.state, ...savedState.state };
        
        // Restaurar métricas
        this.metrics = { ...this.metrics, ...savedState.metrics };
        
        logger.info('Estado del agente cargado');
      }
    } catch (error) {
      logger.warn('Error cargando estado:', error);
    }
  }
  
  /**
   * Cargar segmentos
   */
  async loadSegments() {
    try {
      logger.debug('Cargando segmentos...');
    } catch (error) {
      logger.error('Error cargando segmentos:', error);
    }
  }
  
  /**
   * Cargar patrones de comportamiento
   */
  async loadBehaviorPatterns() {
    try {
      logger.debug('Cargando patrones de comportamiento...');
    } catch (error) {
      logger.warn('Error cargando patrones de comportamiento:', error);
    }
  }
  
  /**
   * Manejar apagado del sistema
   */
  async handleSystemShutdown(event) {
    try {
      logger.info('Manejando apagado del sistema...');
      await this.deactivate();
    } catch (error) {
      logger.error('Error en apagado del sistema:', error);
    }
  }
  
  /**
   * Obtener información del agente
   */
  getAgentInfo() {
    return {
      name: 'ContactsAgent',
      version: '2.0.0',
      status: this.state.isActive ? 'active' : 'inactive',
      state: this.state,
      metrics: this.metrics,
      contactsCount: this.contacts.size,
      segmentsCount: this.segments.size,
      queueSizes: {
        enrichment: this.processingQueues.enrichment.length,
        validation: this.processingQueues.validation.length,
        segmentation: this.processingQueues.segmentation.length,
        deduplication: this.processingQueues.deduplication.length
      }
    };
  }
  
  /**
   * Obtener estadísticas del agente
   */
  getAgentStats() {
    return {
      totalContacts: this.contacts.size,
      metrics: this.metrics,
      qualityScore: (
        this.metrics.quality.completeness +
        this.metrics.quality.validity +
        this.metrics.quality.consistency +
        this.metrics.quality.accuracy
      ) / 4,
      uptime: this.state.isActive ? Date.now() - new Date(this.state.lastOptimization || Date.now()).getTime() : 0
    };
  }
  
  /**
   * Destruir el agente
   */
  async destroy() {
    try {
      logger.info('Destruyendo ContactsAgent...');
      
      await this.deactivate();
      
      // Limpiar referencias
      this.contacts.clear();
      this.segments.clear();
      this.tags.clear();
      this.customFields.clear();
      this.duplicateCandidates.clear();
      this.behaviorPatterns.clear();
      this.interactionHistory = [];
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('ContactsAgent destruido');
    } catch (error) {
      logger.error('Error destruyendo ContactsAgent:', error);
    }
  }
  
  /**
   * Manejar errores del agente
   */
  handleError(error) {
    logger.error('Error en ContactsAgent:', error);
    
    // Emitir evento de error crítico si es necesario
    if (error.critical) {
      this.emit('agent:critical_error', { error, agent: 'ContactsAgent' });
    }
  }
}

// Instancia singleton del agente
let agentInstance = null;

/**
 * Obtener instancia del agente de contactos
 * @param {object} options - Opciones de configuración
 * @returns {ContactsAgent} Instancia del agente
 */
export function getContactsAgent(options = {}) {
  if (!agentInstance) {
    agentInstance = new ContactsAgent(options);
  }
  return agentInstance;
}

export default ContactsAgent;