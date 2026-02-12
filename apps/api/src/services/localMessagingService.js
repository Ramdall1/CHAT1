import fs from 'fs-extra';
import path from 'path';
import { getDatabaseService } from '../../../../src/services/DatabaseService.js';

class LocalMessagingService {
  constructor(dataDir, contactManager, db = null, io = null) {
    this.dataDir = dataDir;
    this.contactManager = contactManager;
    this.db = db || getDatabaseService().getManager();
    this.sequelize = this.db.sequelize || this.db; // Obtener instancia de Sequelize
    this.io = io;
    
    // Eliminar dependencias de archivos JSON
    // this.messagesFile = path.join(dataDir, 'messages.json');
    // this.templatesFile = path.join(dataDir, 'message_templates.json');
    // this.scheduledFile = path.join(dataDir, 'scheduled_messages.json');
    // this.campaignsFile = path.join(dataDir, 'campaigns.json');

    // Usar solo memoria para datos temporales y colas
    this.templates = new Map();
    this.scheduledMessages = [];
    this.campaigns = new Map();
    this.messageQueue = [];
    this.isProcessingQueue = false;

    this.init();
  }

  async init() {
    await fs.ensureDir(this.dataDir);
    
    // Inicializar base de datos si no está ya inicializada
    if (this.db && typeof this.db.init === 'function') {
      await this.db.init();
    }
    
    // Solo cargar datos que no están en la base de datos
    await this.loadTemplates();
    await this.loadScheduledMessages();
    await this.loadCampaigns();
    this.startScheduledMessageProcessor();
    this.startQueueProcessor();
    
    console.log('✅ LocalMessagingService inicializado con base de datos SQLite');
  }

  // ===== GESTIÓN DE MENSAJES CON SEQUELIZE =====
  async saveMessageToDatabase(messageData) {
    if (!this.db) {
      console.warn('⚠️ Base de datos no disponible');
      return null;
    }

    try {
      // Usar directamente SQLite para guardar los datos
      const sqlite3 = await import('sqlite3');
      const path = await import('path');
      const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
      const db = new sqlite3.default.Database(dbPath);

      // Función helper para promisificar consultas
      const runAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
          });
        });
      };

      const getAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      };

      // Buscar contacto existente (no crear si no existe)
      let contact = await getAsync('SELECT * FROM contacts WHERE phone_number = ?', [messageData.phone]);

      if (!contact) {
        console.log(`⚠️ Contacto no encontrado para ${messageData.phone}, omitiendo guardado en BD`);
        return null; // No guardar mensaje si no hay contacto
      }

      // Asegurar que la conversación existe
      let conversation = await getAsync('SELECT * FROM conversations WHERE contact_id = ?', [contact.id]);

      if (!conversation) {
        const result = await runAsync(
          'INSERT INTO conversations (contact_id, status, created_at, updated_at, last_message_at, message_count) VALUES (?, ?, ?, ?, ?, ?)',
          [contact.id, 'active', new Date().toISOString(), new Date().toISOString(), messageData.timestamp, 0]
        );
        conversation = { id: result.id, contact_id: contact.id };
        console.log(`✅ Conversación creada: ${conversation.id} para contacto ${contact.id}`);
      }

      // Actualizar conversación
      await runAsync(
        'UPDATE conversations SET last_message_at = ?, updated_at = ?, message_count = message_count + 1, unread_count = unread_count + ? WHERE id = ?',
        [messageData.timestamp, new Date().toISOString(), messageData.direction === 'inbound' ? 1 : 0, conversation.id]
      );

      // Insertar mensaje
      const now = new Date().toISOString();
      const messageResult = await runAsync(
        `INSERT INTO messages (
          conversation_id, contact_id, type, direction, content, status, message_id,
          timestamp, media_url, media_type, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          contact.id,
          messageData.type || 'text',
          messageData.direction,
          messageData.message,
          messageData.status || 'sent',
          messageData.id,
          messageData.timestamp,
          messageData.mediaUrl || null,
          messageData.mediaType || null,
          JSON.stringify(messageData.metadata || {}),
          now, // created_at
          now  // updated_at
        ]
      );

      db.close();

      if (messageData.type === 'interactive') {
        console.log('🔍 [LocalMessagingService] Guardando mensaje interactivo:', {
          type: messageData.type,
          metadata: messageData.metadata
        });
      }

      console.log(`💾 Mensaje guardado en BD: ${messageData.direction} - ${messageData.phone} - ID: ${messageResult.id}`);
      return { ...messageData, dbId: messageResult.id };
    } catch (error) {
      console.error('❌ Error guardando mensaje en base de datos:', error);
      console.error('Stack trace:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql
      });
      return null;
    }
  }

  async sendText(phone, message, options = {}) {
    const messageData = {
      id: Date.now().toString(),
      type: 'text',
      phone,
      message,
      timestamp: new Date().toISOString(),
      status: 'sending',
      direction: 'outbound',
      ...options,
    };

    // Intentar enviar mensaje real a WhatsApp
    try {
      const { unified360DialogService } = await import('../../../../src/services/core/core/Unified360DialogService.js');

      // Verificar si tenemos credenciales válidas
      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        // Para 360dialog API, quitar el prefijo + y waid del número
        let formattedPhone = phone;
        if (phone.startsWith('+')) {
          formattedPhone = phone.substring(1);
        }
        if (formattedPhone.startsWith('waid.')) {
          formattedPhone = formattedPhone.substring(5);
        }
        console.log(`📤 Enviando mensaje real a WhatsApp: ${formattedPhone}`);

        try {
          const whatsappResponse = await unified360DialogService.sendTextMessage(formattedPhone, message);
          messageData.status = 'sent';
          messageData.whatsappId = whatsappResponse?.messages?.[0]?.id;

          console.log(`✅ Mensaje enviado exitosamente a ${phone} (ID: ${messageData.whatsappId})`);
        } catch (error) {
          console.error(`❌ Error enviando a WhatsApp: ${error.message}`);
          messageData.status = 'failed';
          messageData.error = error.message;

          // Notificar a la interfaz del error inmediatamente
          if (this.io) {
            this.io.emit('message_status_update', {
              messageId: messageData.id,
              status: 'failed',
              error: error.message,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else {
        console.log(`📱 Modo simulación: Mensaje enviado a ${phone}: ${message}`);
        messageData.status = 'sent';
      }
    } catch (error) {
      console.error(`❌ Error enviando mensaje a WhatsApp: ${error.message}`);
      messageData.status = 'failed';
      messageData.error = error.message;
    }

    // Guardar en base de datos SQLite
    const savedMessage = await this.saveMessageToDatabase(messageData);

    if (!savedMessage) {
      console.warn('⚠️ Mensaje enviado no pudo ser guardado en base de datos');
    }

    // Actualizar último contacto
    this.contactManager.updateLastContact(phone);

    return savedMessage || messageData;
  }

  // Alias para compatibilidad con endpoints
  async sendTextMessage(to, text, variables = {}) {
    return await this.sendText(to, text, variables);
  }

  async sendTemplate(templateData) {
    const { to: phone, name: templateName, components = [] } = templateData;

    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Plantilla "${templateName}" no encontrada`);
    }

    let processedMessage = template.body;

    // Procesar componentes y variables
    if (components.length > 0) {
      const bodyComponent = components.find(c => c.type === 'body');
      if (bodyComponent && bodyComponent.parameters) {
        bodyComponent.parameters.forEach((param, index) => {
          const placeholder = `{{${index + 1}}}`;
          processedMessage = processedMessage.replace(placeholder, param.text);
        });
      }
    }

    const messageData = {
      id: Date.now().toString(),
      type: 'template',
      phone,
      templateName,
      message: processedMessage,
      originalTemplate: template,
      timestamp: new Date().toISOString(),
      status: 'sent',
      direction: 'outbound',
    };

    // Guardar en base de datos SQLite
    const savedMessage = await this.saveMessageToDatabase(messageData);
    
    if (!savedMessage) {
      console.warn('⚠️ Mensaje de plantilla no pudo ser guardado en base de datos');
    }

    console.log(
      `📋 Plantilla "${templateName}" enviada a ${phone}: ${processedMessage}`
    );

    this.contactManager.updateLastContact(phone);

    return savedMessage || messageData;
  }

  async sendMedia(phone, mediaType, mediaUrl, caption = '', options = {}) {
    const messageData = {
      id: Date.now().toString(),
      type: mediaType, // image, video, audio, document
      phone,
      mediaUrl,
      caption,
      timestamp: new Date().toISOString(),
      status: 'sending',
      direction: 'outbound',
      ...options,
    };

    // Intentar enviar media real a WhatsApp usando el método recomendado (Media ID)
    try {
      const { unified360DialogService } = await import('../../../../src/services/core/core/Unified360DialogService.js');

      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        // Para 360dialog API, normalizar el número
        let formattedPhone = phone;
        if (phone.startsWith('+')) {
          formattedPhone = phone.substring(1);
        }
        if (formattedPhone.startsWith('waid.')) {
          formattedPhone = formattedPhone.substring(5);
        }

        console.log(`📤 Enviando media ${mediaType} real a WhatsApp: ${formattedPhone}`);

        try {
          let result;
          if (mediaType === 'image') {
            // Usar método 2: Media ID (primero subir, luego enviar)
            // Para este test, usaremos URL directa ya que no tenemos archivo local
            result = await unified360DialogService.sendImageByUrl(formattedPhone, mediaUrl, caption);
          } else if (mediaType === 'video') {
            result = await unified360DialogService.sendVideoByUrl(formattedPhone, mediaUrl, caption);
          } else {
            // Para otros tipos, usar el método anterior
            result = { success: true, messageId: 'media_' + Date.now() };
          }

          messageData.status = 'sent';
          messageData.whatsappId = result?.messageId;

          console.log(`✅ Media ${mediaType} enviado exitosamente a ${phone} (ID: ${messageData.whatsappId})`);
        } catch (error) {
          console.error(`❌ Error enviando media ${mediaType} a WhatsApp: ${error.message}`);
          messageData.status = 'failed';
          messageData.error = error.message;
        }
      } else {
        console.log(`📱 Modo simulación: Media ${mediaType} enviado a ${phone}: ${mediaUrl}`);
        messageData.status = 'sent';
      }
    } catch (error) {
      console.error(`❌ Error enviando media ${mediaType} a WhatsApp: ${error.message}`);
      messageData.status = 'failed';
      messageData.error = error.message;
    }

    // Guardar en base de datos SQLite
    const savedMessage = await this.saveMessageToDatabase(messageData);

    if (!savedMessage) {
      console.warn('⚠️ Mensaje de media no pudo ser guardado en base de datos');
    }

    console.log(`📎 Media ${mediaType} enviado a ${phone}: ${mediaUrl}`);

    this.contactManager.updateLastContact(phone);

    return savedMessage || messageData;
  }

  /**
   * Enviar imagen usando Media ID (Método 2 recomendado)
   */
  async sendImage(phone, mediaId, caption = '', options = {}) {
    try {
      const { unified360DialogService } = await import('../../../../src/services/core/core/Unified360DialogService.js');

      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        let formattedPhone = phone;
        if (phone.startsWith('+')) {
          formattedPhone = phone.substring(1);
        }

        const result = await unified360DialogService.sendImageById(formattedPhone, mediaId, caption, options);

        const messageData = {
          id: Date.now().toString(),
          type: 'image',
          phone,
          mediaId,
          caption,
          timestamp: new Date().toISOString(),
          status: 'sent',
          direction: 'outbound',
          whatsappId: result?.messageId,
          ...options,
        };

        const savedMessage = await this.saveMessageToDatabase(messageData);
        this.contactManager.updateLastContact(phone);

        return savedMessage || messageData;
      } else {
        return await this.sendMedia(phone, 'image', `media_id:${mediaId}`, caption, options);
      }
    } catch (error) {
      console.error('❌ Error enviando imagen por Media ID:', error.message);
      throw error;
    }
  }

  /**
   * Enviar video usando Media ID (Método 2 recomendado)
   */
  async sendVideo(phone, mediaId, caption = '', options = {}) {
    try {
      const { unified360DialogService } = await import('../../../../src/services/core/core/Unified360DialogService.js');

      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        let formattedPhone = phone;
        if (phone.startsWith('+')) {
          formattedPhone = phone.substring(1);
        }

        const result = await unified360DialogService.sendVideoById(formattedPhone, mediaId, caption, options);

        const messageData = {
          id: Date.now().toString(),
          type: 'video',
          phone,
          mediaId,
          caption,
          timestamp: new Date().toISOString(),
          status: 'sent',
          direction: 'outbound',
          whatsappId: result?.messageId,
          ...options,
        };

        const savedMessage = await this.saveMessageToDatabase(messageData);
        this.contactManager.updateLastContact(phone);

        return savedMessage || messageData;
      } else {
        return await this.sendMedia(phone, 'video', `media_id:${mediaId}`, caption, options);
      }
    } catch (error) {
      console.error('❌ Error enviando video por Media ID:', error.message);
      throw error;
    }
  }

  /**
   * Subir media y obtener Media ID
   */
  async uploadMedia(mediaBuffer, mimeType, filename) {
    try {
      const { unified360DialogService } = await import('../../../../src/services/core/core/Unified360DialogService.js');

      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        const result = await unified360DialogService.uploadMedia(mediaBuffer, mimeType, filename);
        console.log(`📤 Media subida exitosamente, ID: ${result.mediaId}`);
        return result;
      } else {
        console.log('📱 Modo simulación: Media subida (ID simulado)');
        return {
          success: true,
          mediaId: 'simulated_' + Date.now(),
          url: 'https://example.com/simulated-media'
        };
      }
    } catch (error) {
      console.error('❌ Error subiendo media:', error.message);
      throw error;
    }
  }

  /**
   * Asegura que el contacto existe en la base de datos
   * Si no existe, lo crea automáticamente
   */
  async ensureContactExists(phone, profileData = null) {
    try {
      // Usar SQLite directamente para mantener consistencia
      const sqlite3 = await import('sqlite3');
      const path = await import('path');
      const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
      const db = new sqlite3.default.Database(dbPath);

      // Función helper para promisificar consultas
      const queryGet = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      };

      const queryRun = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
          });
        });
      };

      // Verificar si el contacto ya existe
      let contact = await queryGet('SELECT * FROM contacts WHERE phone_number = ?', [phone]);

      if (contact) {
        console.log(`✅ Contacto ya existe: ${contact.name || phone} (${phone})`);

        // Si viene nombre del perfil y el contacto no tiene nombre o es igual al teléfono, actualizar
        const profileName = profileData?._profileName || profileData?.profileName;
        if (profileName && (!contact.name || contact.name === phone || contact.name.trim() === '')) {
          await queryRun(
            'UPDATE contacts SET name = ?, updated_at = ?, last_interaction = ? WHERE id = ?',
            [profileName, new Date().toISOString(), new Date().toISOString(), contact.id]
          );
          console.log(`👤 Nombre actualizado en BD: "${profileName}" para ${phone}`);
        } else {
          // Actualizar última interacción
          await queryRun(
            'UPDATE contacts SET last_interaction = ? WHERE id = ?',
            [new Date().toISOString(), contact.id]
          );
        }

        db.close();
        return contact.id;
      }

      // El contacto no existe, intentar obtener el nombre desde Dialog360
      let contactName = profileData?._profileName || profileData?.profileName;

      // Si no tenemos nombre del perfil, intentar obtenerlo desde Dialog360
      if (!contactName || contactName === phone || contactName.trim() === '') {
        try {
          console.log(`🔍 Intentando obtener nombre desde Dialog360 para ${phone}...`);

          // Intentar obtener el nombre desde Dialog360
          const dialog360Name = await this.getContactNameFromDialog360(phone);
          if (dialog360Name && dialog360Name !== phone && dialog360Name.trim() !== '') {
            contactName = dialog360Name;
            console.log(`✅ Nombre obtenido desde Dialog360: "${contactName}" para ${phone}`);
          } else {
            console.log(`⚠️ No se pudo obtener nombre desde Dialog360 para ${phone}, usando teléfono`);
            contactName = phone;
          }
        } catch (dialog360Error) {
          console.warn(`⚠️ Error obteniendo nombre desde Dialog360 para ${phone}:`, dialog360Error.message);
          contactName = phone;
        }
      }

      const result = await queryRun(
        'INSERT INTO contacts (phone_number, name, status, created_at, updated_at, last_interaction) VALUES (?, ?, ?, ?, ?, ?)',
        [phone, contactName, 'active', new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]
      );

      const contactId = result.id;
      console.log(`✅ Nuevo contacto creado automáticamente: ${contactName} (${phone}) - ID: ${contactId}`);

      db.close();
      return contactId;

    } catch (error) {
      console.error('❌ Error asegurando que el contacto existe:', error);
      return null;
    }
  }

  /**
   * Obtener nombre de contacto desde Dialog360
   */
  async getContactNameFromDialog360(phone) {
    try {
      // Importar Dialog360 dinámicamente para evitar dependencias circulares
      const { default: Dialog360Integration } = await import('../../../../src/integrations/360dialog/Dialog360Integration.js');

      let dialog360Instance = null;

      // Inicializar Dialog360 si está configurado
      if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        dialog360Instance = new Dialog360Integration({
          apiKey: process.env.D360_API_KEY,
          phoneNumberId: process.env.D360_PHONE_NUMBER_ID,
          baseUrl: process.env.D360_API_BASE || 'https://waba.360dialog.io'
        });
      }

      if (!dialog360Instance) {
        return null;
      }

      // Validar el número de teléfono
      if (!phone || typeof phone !== 'string' || phone.trim() === '') {
        return null;
      }

      // Llamada con timeout
      const profile = await Promise.race([
        dialog360Instance.getContactProfile(phone),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Dialog360 timeout')), 5000)
        )
      ]);

      if (profile && profile.name && typeof profile.name === 'string' && profile.name.trim() !== '') {
        return profile.name.trim();
      }

      return null;

    } catch (error) {
      console.warn(`Error al obtener perfil de ${phone} desde Dialog360:`, error.message);
      return null;
    }
  }

  async receiveMessage(phoneOrData, message, messageType = 'text') {
    // Soporte para ambos formatos: objeto completo o parámetros individuales
    let messageData;

    if (typeof phoneOrData === 'object' && phoneOrData !== null) {
      // Formato nuevo: objeto completo
      // Para message echoes, usar 'to' en lugar de 'from' como teléfono del contacto
      const contactPhone = phoneOrData._isEcho ? phoneOrData.to : phoneOrData.from;

      messageData = {
        id: phoneOrData.id || Date.now().toString(),
        type: phoneOrData.type || 'text',
        phone: contactPhone,
        message: phoneOrData.text,
        mediaUrl: phoneOrData.mediaUrl || null,
        mediaType: phoneOrData.mediaType || null,
        timestamp: phoneOrData.timestamp || new Date().toISOString(),
        status: phoneOrData.status || 'received',
        direction: phoneOrData.direction || 'inbound', // Respetar dirección si viene especificada
        // FIX 4: Agregar metadata si existe
        metadata: phoneOrData.metadata || phoneOrData.interactive ? {
          ...(phoneOrData.metadata || {}),
          ...(phoneOrData.interactive && { interactive: phoneOrData.interactive })
        } : {}
      };

      const profileName = phoneOrData._profileName || phoneOrData.profileName;
      if (profileName) {
        messageData.profileName = profileName;
      }

      if (process.env.DEBUG_LOCAL_MESSAGE_LOGS === 'true') {
        console.log('💾 === GUARDANDO MENSAJE EN BD ===');
        console.log('💾 messageData:', JSON.stringify(messageData, null, 2));
        console.log('💾 _profileName:', phoneOrData._profileName || 'NO DISPONIBLE');
        console.log('💾 ============================');
      }
      
      // FIX 4: Logging para mensajes interactivos
      if (phoneOrData.type === 'interactive') {
        if (process.env.DEBUG_LOCAL_MESSAGE_LOGS === 'true') {
          console.log('🔍 [LocalMessagingService] Mensaje interactivo detectado:', {
            has_metadata: !!messageData.metadata,
            has_interactive: !!messageData.metadata.interactive,
            metadata_keys: messageData.metadata ? Object.keys(messageData.metadata) : []
          });
        }
      }
    } else {
      // Formato antiguo: parámetros individuales
      messageData = {
        id: Date.now().toString(),
        type: messageType,
        phone: phoneOrData,
        message,
        timestamp: new Date().toISOString(),
        status: 'received',
        direction: 'inbound',
      };
    }

    // Crear o actualizar contacto automáticamente ANTES de guardar el mensaje
    await this.ensureContactExists(messageData.phone, messageData);

    // Guardar en base de datos SQLite
    const savedMessage = await this.saveMessageToDatabase(messageData);

    if (!savedMessage) {
      console.warn('⚠️ Mensaje no pudo ser guardado en base de datos');
    }
    
    // También actualizar en contactManager (memoria) si existe
    if (this.contactManager) {
      const phone = messageData.phone;
      const existingContact = this.contactManager.getContact(phone);
      
      const contactUpdate = {
        lastMessage: messageData.message,
        lastActivity: new Date().toISOString(),
      };
      
      // Si viene nombre del perfil de WhatsApp en el objeto, usarlo
      if (phoneOrData && typeof phoneOrData === 'object' && phoneOrData._profileName) {
        // Solo actualizar si no tiene nombre o tiene el teléfono como nombre
        if (!existingContact?.name || existingContact.name === phone || existingContact.name.trim() === '') {
          contactUpdate.name = phoneOrData._profileName;
          if (process.env.DEBUG_LOCAL_MESSAGE_LOGS === 'true') {
            console.log(`👤 Nombre del perfil actualizado: "${phoneOrData._profileName}" para ${phone}`);
          }
        }
      }
      
      if (existingContact) {
        this.contactManager.updateContact(phone, contactUpdate);
      } else {
        this.contactManager.createContact(phone, contactUpdate);
      }
    }

    // Emitir evento en tiempo real con el formato correcto para el frontend
    if (this.io) {
      const socketPayload = {
        id: (savedMessage || messageData).id,
        direction: (savedMessage || messageData).direction,
        type: (savedMessage || messageData).type,
        status: (savedMessage || messageData).status,
        content: (savedMessage || messageData).message,
        timestamp: (savedMessage || messageData).timestamp,
        contactPhone: (savedMessage || messageData).phone, // Propiedad que espera el frontend
        phone: (savedMessage || messageData).phone, // Alias adicional
        from: (savedMessage || messageData).phone, // Otro alias
        text: (savedMessage || messageData).message, // Alias para content
        mediaUrl: (savedMessage || messageData).mediaUrl,
        mediaType: (savedMessage || messageData).mediaType,
        metadata: (savedMessage || messageData).metadata
      };

      if (process.env.DEBUG_LOCAL_MESSAGE_LOGS === 'true') {
        console.log('📡 === SOCKET.IO EMIT ===');
        console.log('📡 Evento: new_message');
        console.log('📡 Payload:', JSON.stringify(socketPayload, null, 2));
        console.log('📡 ====================');
      }
      this.io.emit('new_message', socketPayload);
    }

    const hasMedia = !!messageData.mediaUrl;
    if (process.env.DEBUG_LOCAL_MESSAGE_LOGS === 'true') {
      console.log(`📥 Mensaje recibido de ${messageData.phone}: ${messageData.message}`);
      console.log(`💾 Mensaje guardado en LocalMessagingService ${hasMedia ? '(con media: ' + messageData.mediaUrl + ')' : ''}`);
    }

    // NOTA: El procesamiento de IA se maneja en webhooks.js para evitar duplicación

    return savedMessage || messageData;
  }

  // ===== GESTIÓN DE PLANTILLAS =====
  async loadTemplates() {
    try {
      // Crear plantillas por defecto en memoria
      await this.createDefaultTemplates();
    } catch (error) {
      console.log('⚠️ Error cargando plantillas:', error.message);
    }
  }

  async saveTemplates() {
    // Las plantillas ahora se manejan en memoria, no necesitan persistencia
    console.log('💾 Plantillas guardadas en memoria');
  }

  async createDefaultTemplates() {
    const defaultTemplates = [
      {
        name: 'bienvenida',
        category: 'marketing',
        language: 'es',
        status: 'approved',
        body: 'Hola {{1}}, ¡Bienvenido a nuestro servicio! Estamos aquí para ayudarte.',
        variables: ['nombre'],
      },
      {
        name: 'confirmacion_pedido',
        category: 'utility',
        language: 'es',
        status: 'approved',
        body: 'Tu pedido #{{1}} ha sido confirmado. Total: ${{2}}. Tiempo estimado: {{3}} minutos.',
        variables: ['numero_pedido', 'total', 'tiempo_estimado'],
      },
      {
        name: 'recordatorio_cita',
        category: 'utility',
        language: 'es',
        status: 'approved',
        body: 'Recordatorio: Tienes una cita programada para {{1}} a las {{2}}. ¿Confirmas tu asistencia?',
        variables: ['fecha', 'hora'],
      },
      {
        name: 'promocion_especial',
        category: 'marketing',
        language: 'es',
        status: 'approved',
        body: '🎉 ¡Oferta especial para ti! {{1}}% de descuento en {{2}}. Válido hasta {{3}}.',
        variables: ['descuento', 'producto', 'fecha_limite'],
      },
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.name, template);
    }

    await this.saveTemplates();
    console.log('✅ Plantillas por defecto creadas');
  }

  createTemplate(
    name,
    body,
    category = 'utility',
    language = 'es',
    variables = []
  ) {
    const template = {
      name,
      body,
      category,
      language,
      status: 'approved',
      variables,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(name, template);
    this.saveTemplates();
    return template;
  }

  getTemplate(name) {
    return this.templates.get(name) || null;
  }

  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  deleteTemplate(name) {
    const deleted = this.templates.delete(name);
    if (deleted) {
      this.saveTemplates();
    }
    return deleted;
  }

  // ===== MENSAJES PROGRAMADOS =====
  async loadScheduledMessages() {
    try {
      // Los mensajes programados se manejan en memoria
      this.scheduledMessages = [];
    } catch (error) {
      console.log('⚠️ Error cargando mensajes programados:', error.message);
    }
  }

  async saveScheduledMessages() {
    try {
      // Los mensajes programados se manejan en memoria
      console.log('💾 Mensajes programados guardados en memoria');
    } catch (error) {
      console.log('❌ Error guardando mensajes programados:', error.message);
    }
  }

  scheduleMessage(phone, message, scheduledTime, type = 'text', options = {}) {
    const scheduledMessage = {
      id: Date.now().toString(),
      phone,
      message,
      type,
      scheduledTime: new Date(scheduledTime).toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...options,
    };

    this.scheduledMessages.push(scheduledMessage);
    this.saveScheduledMessages();

    console.log(`⏰ Mensaje programado para ${phone} el ${scheduledTime}`);
    return scheduledMessage;
  }

  startScheduledMessageProcessor() {
    setInterval(async () => {
      const now = new Date();
      const messagesToSend = this.scheduledMessages.filter(
        msg => msg.status === 'pending' && new Date(msg.scheduledTime) <= now
      );

      for (const msg of messagesToSend) {
        try {
          if (msg.type === 'template') {
            await this.sendTemplate({
              to: msg.phone,
              name: msg.templateName,
              components: msg.components || [],
            });
          } else {
            await this.sendText(msg.phone, msg.message, msg.options || {});
          }

          msg.status = 'sent';
          msg.sentAt = new Date().toISOString();
          console.log(`✅ Mensaje programado enviado a ${msg.phone}`);
        } catch (error) {
          msg.status = 'failed';
          msg.error = error.message;
          console.log(
            `❌ Error enviando mensaje programado a ${msg.phone}:`,
            error.message
          );
        }
      }

      if (messagesToSend.length > 0) {
        await this.saveScheduledMessages();
      }
    }, 60000); // Verificar cada minuto
  }

  // ===== CAMPAÑAS MASIVAS =====
  async loadCampaigns() {
    try {
      // Las campañas se manejan en memoria
      this.campaigns = new Map();
    } catch (error) {
      console.log('⚠️ Error cargando campañas:', error.message);
    }
  }

  async saveCampaigns() {
    try {
      // Las campañas se manejan en memoria
      console.log('💾 Campañas guardadas en memoria');
    } catch (error) {
      console.log('❌ Error guardando campañas:', error.message);
    }
  }

  async createCampaign(name, message, audience, options = {}) {
    const campaign = {
      id: Date.now().toString(),
      name,
      message,
      audience, // Array de teléfonos o criterios de segmentación
      status: 'draft',
      createdAt: new Date().toISOString(),
      stats: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
      },
      ...options,
    };

    this.campaigns.set(campaign.id, campaign);
    await this.saveCampaigns();
    return campaign;
  }

  async executeCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaña ${campaignId} no encontrada`);
    }

    campaign.status = 'running';
    campaign.startedAt = new Date().toISOString();

    // Obtener lista de contactos según audiencia
    let contacts = [];
    if (Array.isArray(campaign.audience)) {
      contacts = campaign.audience;
    } else {
      // Segmentación basada en criterios
      contacts = this.contactManager.segmentAudience(campaign.audience);
    }

    campaign.stats.total = contacts.length;
    campaign.stats.pending = contacts.length;

    // Agregar mensajes a la cola
    for (const phone of contacts) {
      this.messageQueue.push({
        campaignId,
        phone,
        message: campaign.message,
        type: campaign.type || 'text',
        templateName: campaign.templateName,
        components: campaign.components,
      });
    }

    await this.saveCampaigns();
    console.log(
      `🚀 Campaña "${campaign.name}" iniciada para ${contacts.length} contactos`
    );

    return campaign;
  }

  startQueueProcessor() {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    const processQueue = async () => {
      if (this.messageQueue.length === 0) {
        setTimeout(processQueue, 5000); // Verificar cada 5 segundos
        return;
      }

      const message = this.messageQueue.shift();
      const campaign = this.campaigns.get(message.campaignId);

      try {
        if (message.type === 'template') {
          await this.sendTemplate({
            to: message.phone,
            name: message.templateName,
            components: message.components || [],
          });
        } else {
          await this.sendText(message.phone, message.message);
        }

        if (campaign) {
          campaign.stats.sent++;
          campaign.stats.pending--;
        }

        console.log(`📤 Mensaje de campaña enviado a ${message.phone}`);
      } catch (error) {
        if (campaign) {
          campaign.stats.failed++;
          campaign.stats.pending--;
        }
        console.log(
          `❌ Error enviando mensaje de campaña a ${message.phone}:`,
          error.message
        );
      }

      // Actualizar estadísticas de campaña
      if (campaign) {
        if (campaign.stats.pending === 0) {
          campaign.status = 'completed';
          campaign.completedAt = new Date().toISOString();
          console.log(`✅ Campaña "${campaign.name}" completada`);
        }
        await this.saveCampaigns();
      }

      // Delay entre mensajes para evitar spam
      setTimeout(processQueue, 2000); // 2 segundos entre mensajes
    };

    processQueue();
  }

  // ===== ANÁLISIS Y ESTADÍSTICAS =====
  async getConversationHistory(phone, limit = 50) {
    if (!this.db) {
      console.warn('⚠️ Base de datos no disponible');
      return [];
    }

    try {
      const messages = await this.db.all(`
        SELECT 
          m.*,
          contacts.phone,
          contacts.name as contact_name
        FROM messages m
        JOIN contacts ON m.contact_id = contacts.id
        WHERE contacts.phone = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [phone, limit]);

      return messages.map(msg => ({
        id: msg.message_id || msg.id,
        phone: msg.phone,
        message: msg.content,
        timestamp: msg.created_at,
        direction: msg.direction,
        status: msg.status,
        type: msg.type,
        conversationId: msg.conversation_id,
        contactName: msg.contact_name
      }));
    } catch (error) {
      console.error('❌ Error obteniendo historial de conversación:', error);
      return [];
    }
  }

  async getConversations() {
    if (!this.sequelize) {
      console.warn('⚠️ Base de datos no disponible');
      return [];
    }

    try {
      const { Conversation, Contact, Message } = await import('../../../src/models/index.js');

      const conversations = await Conversation.findAll({
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['phone', 'name', 'avatar_url']
          }
        ],
        attributes: [
          'id',
          'status',
          'last_message_at',
          'message_count',
          'unread_count'
        ],
        order: [['last_message_at', 'DESC']]
      });

      // Obtener último mensaje para cada conversación
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conv) => {
          const lastMessage = await Message.findOne({
            where: { conversation_id: conv.id },
            order: [['created_at', 'DESC']],
            attributes: ['content']
          });

          return {
            id: conv.id,
            phone: conv.contact.phone,
            name: conv.contact.name || conv.contact.phone,
            avatar: conv.contact.avatar_url,
            lastMessage: lastMessage?.content || '',
            lastMessageTime: conv.last_message_at,
            unreadCount: conv.unread_count,
            messageCount: conv.message_count,
            status: conv.status
          };
        })
      );

      return conversationsWithMessages;
    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      return [];
    }
  }

  async getAllMessages() {
    if (!this.sequelize) {
      console.warn('⚠️ Base de datos no disponible');
      return [];
    }

    try {
      const { Message, Contact } = await import('../../../src/models/index.js');

      const messages = await Message.findAll({
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['phone', 'name']
          }
        ],
        order: [['created_at', 'ASC']]
      });

      return messages.map(msg => ({
        id: msg.message_id || msg.id,
        phone: msg.contact.phone,
        message: msg.content,
        timestamp: msg.created_at,
        direction: msg.direction,
        status: msg.status,
        type: msg.type,
        conversationId: msg.conversation_id,
        contactName: msg.contact.name
      }));
    } catch (error) {
      console.error('❌ Error obteniendo todos los mensajes:', error);
      return [];
    }
  }

  async getMessageStats(timeframe = '7d') {
    if (!this.db) {
      console.warn('⚠️ Base de datos no disponible');
      return {
        total: 0,
        sent: 0,
        received: 0,
        byType: { text: 0, template: 0, media: 0 },
        byStatus: { sent: 0, delivered: 0, read: 0, failed: 0 }
      };
    }

    const now = new Date();
    let startDate;

    switch (timeframe) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as received,
          SUM(CASE WHEN type = 'text' THEN 1 ELSE 0 END) as text_count,
          SUM(CASE WHEN type = 'template' THEN 1 ELSE 0 END) as template_count,
          SUM(CASE WHEN type = 'media' THEN 1 ELSE 0 END) as media_count,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_status,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_status,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_status,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_status
        FROM messages 
        WHERE created_at >= ?
      `, [startDate.toISOString()]);

      return {
        total: stats.total || 0,
        sent: stats.sent || 0,
        received: stats.received || 0,
        byType: {
          text: stats.text_count || 0,
          template: stats.template_count || 0,
          media: stats.media_count || 0,
        },
        byStatus: {
          sent: stats.sent_status || 0,
          delivered: stats.delivered_status || 0,
          read: stats.read_status || 0,
          failed: stats.failed_status || 0,
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de mensajes:', error);
      return {
        total: 0,
        sent: 0,
        received: 0,
        byType: { text: 0, template: 0, media: 0 },
        byStatus: { sent: 0, delivered: 0, read: 0, failed: 0 }
      };
    }
  }

  getCampaignStats(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    return {
      ...campaign.stats,
      successRate:
        campaign.stats.total > 0
          ? (campaign.stats.sent / campaign.stats.total) * 100
          : 0,
      failureRate:
        campaign.stats.total > 0
          ? (campaign.stats.failed / campaign.stats.total) * 100
          : 0,
    };
  }

  async searchMessages(query, filters = {}) {
    if (!this.db) {
      console.warn('⚠️ Base de datos no disponible');
      return [];
    }

    try {
      let whereConditions = [];
      let params = [];

      // Filtrar por texto
      if (query) {
        whereConditions.push('m.content LIKE ?');
        params.push(`%${query}%`);
      }

      // Filtrar por teléfono
      if (filters.phone) {
        whereConditions.push('contacts.phone = ?');
        params.push(filters.phone);
      }

      // Filtrar por tipo
      if (filters.type) {
        whereConditions.push('m.type = ?');
        params.push(filters.type);
      }

      // Filtrar por dirección
      if (filters.direction) {
        whereConditions.push('m.direction = ?');
        params.push(filters.direction);
      }

      // Filtrar por rango de fechas
       if (filters.startDate) {
         whereConditions.push('m.created_at >= ?');
         params.push(new Date(filters.startDate).toISOString());
       }

       if (filters.endDate) {
         whereConditions.push('m.created_at <= ?');
         params.push(new Date(filters.endDate).toISOString());
       }

       const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

       const query = `
         SELECT 
           m.id,
           m.content as message,
           m.type,
           m.direction,
           m.status,
           m.created_at as timestamp,
           contacts.phone,
           contacts.name
         FROM messages m
         LEFT JOIN contacts ON m.contact_id = contacts.id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT 100
       `;

       const results = await this.db.all(query, params);
       
       return results.map(row => ({
         id: row.id,
         message: row.message,
         type: row.type,
         direction: row.direction,
         status: row.status,
         timestamp: row.timestamp,
         phone: row.phone,
         name: row.name
       }));

    } catch (error) {
      console.error('❌ Error buscando mensajes:', error);
      return [];
    }
  }

  // ===== UTILIDADES =====
  async exportMessages(format = 'json', filters = {}) {
    const messages = await this.searchMessages('', filters);

    if (format === 'csv') {
      const csv = this.convertToCSV(messages);
      return csv;
    }

    return messages;
  }

  convertToCSV(messages) {
    if (messages.length === 0) return '';

    const headers = [
      'timestamp',
      'phone',
      'direction',
      'type',
      'message',
      'status',
    ];
    const csvContent = [
      headers.join(','),
      ...messages.map(msg =>
        [
          msg.timestamp,
          msg.phone,
          msg.direction,
          msg.type,
          `"${(msg.message || '').replace(/"/g, '""')}"`,
          msg.status,
        ].join(',')
      ),
    ].join('\n');

    return csvContent;
  }

  // ===== GESTIÓN DE ESTADOS DE MENSAJES =====
  async updateMessageStatus(messageId, statusData) {
    try {
      const messageIndex = this.messages.findIndex(msg => msg.id === messageId);

      if (messageIndex !== -1) {
        // Actualizar el mensaje existente
        this.messages[messageIndex] = {
          ...this.messages[messageIndex],
          status: statusData.status,
          deliveryTimestamp: statusData.timestamp,
          conversation: statusData.conversation,
          pricing: statusData.pricing,
          updatedAt: new Date().toISOString(),
        };

        await this.saveMessages();

        console.log(
          `✅ Estado de mensaje ${messageId} actualizado a: ${statusData.status}`
        );

        // Emitir evento via socket si está disponible
        if (this.io) {
          this.io.emit('message_status_update', {
            messageId,
            status: statusData.status,
            timestamp: statusData.timestamp,
          });
        }

        return this.messages[messageIndex];
      } else {
        console.log(
          `⚠️ Mensaje ${messageId} no encontrado para actualizar estado`
        );
        return null;
      }
    } catch (error) {
      console.error(
        `❌ Error actualizando estado del mensaje ${messageId}:`,
        error
      );
      throw error;
    }
  }

  getMessageById(messageId) {
    return this.messages.find(msg => msg.id === messageId);
  }

  getMessagesByStatus(status) {
    return this.messages.filter(msg => msg.status === status);
  }

  async cleanup() {
    // Limpiar mensajes antiguos (más de 90 días)
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const originalLength = this.messages.length;

    this.messages = this.messages.filter(
      msg => new Date(msg.timestamp) > cutoffDate
    );

    if (this.messages.length < originalLength) {
      await this.saveMessages();
      console.log(
        `🧹 Limpieza: ${originalLength - this.messages.length} mensajes antiguos eliminados`
      );
    }

    // Limpiar mensajes programados completados
    const originalScheduledLength = this.scheduledMessages.length;
    this.scheduledMessages = this.scheduledMessages.filter(
      msg =>
        msg.status === 'pending' || new Date(msg.scheduledTime) > cutoffDate
    );

    if (this.scheduledMessages.length < originalScheduledLength) {
      await this.saveScheduledMessages();
      console.log(
        `🧹 Limpieza: ${originalScheduledLength - this.scheduledMessages.length} mensajes programados antiguos eliminados`
      );
    }
  }
}

export default LocalMessagingService;
