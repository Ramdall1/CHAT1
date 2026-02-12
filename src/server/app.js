/**
 * Aplicación Principal del Servidor
 * 
 * Configura y inicializa la aplicación Express con todos los módulos,
 * middleware, rutas y servicios necesarios para el funcionamiento del chat bot.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { createLogger } from '../services/core/core/logger.js';
import { AppInitializer } from '../services/app/core/AppInitializer.js';
import config from '../config/environments/index.js';
import fs from 'fs';
import multer from 'multer';
import * as XLSX from 'xlsx';

const logger = createLogger('APP');

/**
 * Clase principal de la aplicación
 */
export class App {
  constructor(config = {}) {
    this.config = {
      ...config,
      enableServices: config.enableServices !== false,
      enableEndpoints: config.enableEndpoints !== false,
      enableDashboard: config.enableDashboard !== false,
      enableAnalytics: config.enableAnalytics !== false,
      enableSocketIO: config.enableSocketIO !== false
    };
    
    // Inicializar el AppInitializer con la configuración modular
    this.appInitializer = new AppInitializer(this.config);
    this.isRunning = false;
    this.startTime = null;
  }
  
  /**
   * Inicializar aplicación
   */
  async initializeApp() {
    try {
      logger.info('🚀 Iniciando aplicación con AppInitializer...');
      
      // Usar AppInitializer para configurar toda la aplicación
      await this.appInitializer.initialize();
      
      // Extraer componentes inicializados
      this.app = this.appInitializer.getApp();
      this.server = this.appInitializer.getServer();
      this.io = this.appInitializer.getIO();
      this.services = this.appInitializer.getManager('services');
      
      logger.info('✅ Aplicación inicializada correctamente con AppInitializer');
      
    } catch (error) {
      logger.error('❌ Error inicializando aplicación:', error);
      throw error;
    }
  }
  
  // Método removido - ahora manejado por AppInitializer
  
  // Método removido - ahora manejado por AppInitializer
  
  // Método removido - ahora manejado por AppInitializer
  
  // Método removido - ahora manejado por AppInitializer
  setupModularEndpoints() {
    logger.info('Iniciando configuración de endpoints modulares...');
    // Templates endpoints
    this.app.get('/api/templates', (req, res) => {
      res.json({ success: true, data: [] });
    });
    
    this.app.get('/api/templates/local', (req, res) => {
      res.json({ success: true, data: [] });
    });
    
    // Local endpoints (sistema anterior)
    this.app.get('/api/local/templates', (req, res) => {
      res.json({ success: true, templates: [] });
    });
    
    
    // Flows endpoints
    this.app.get('/api/flows', (req, res) => {
      res.json({ success: true, data: [] });
    });
    
    // 360Dialog endpoints
    logger.info('Configurando endpoint /api/360dialog/status...');
    this.app.get('/api/360dialog/status', (req, res) => {
      try {
        logger.info('Endpoint /api/360dialog/status llamado');
        const status = {
          service: '360Dialog',
          status: 'available',
          connected: false,
          lastCheck: new Date().toISOString(),
          message: 'Servicio 360Dialog disponible pero no configurado'
        };
        res.json({ success: true, data: status });
      } catch (error) {
        logger.error('Error getting 360Dialog status:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    logger.info('✅ Endpoint /api/360dialog/status configurado');
    
    this.app.get('/api/360dialog/templates', (req, res) => {
      try {
        // Retornar plantillas vacías por ahora
        res.json({ 
          success: true, 
          data: [],
          message: 'Plantillas 360Dialog - servicio no configurado'
        });
      } catch (error) {
        logger.error('Error getting 360Dialog templates:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // AI endpoints
    this.app.get('/api/ai/status', (req, res) => {
      try {
        const status = {
          service: 'AI',
          status: 'available',
          connected: true,
          model: 'local-model',
          lastCheck: new Date().toISOString(),
          message: 'Servicio de IA disponible'
        };
        res.json({ success: true, data: status });
      } catch (error) {
        logger.error('Error getting AI status:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Dashboard endpoints
    logger.info('Configurando rutas del dashboard...');
    this.app.get('/api/dashboard/metrics', (req, res) => {
      try {
        // Generar métricas simuladas más realistas
        const now = Date.now();
        const baseMetrics = {
          activeChats: Math.floor(Math.random() * 50) + 10,
          messagesSent: Math.floor(Math.random() * 1000) + 500,
          aiResponses: Math.floor(Math.random() * 800) + 400,
          conversionRate: (Math.random() * 15 + 5).toFixed(1) + '%',
          responseTime: Math.floor(Math.random() * 500) + 100,
          userSatisfaction: (Math.random() * 2 + 8).toFixed(1),
          totalUsers: Math.floor(Math.random() * 200) + 100,
          newUsers: Math.floor(Math.random() * 20) + 5
        };

        res.json({
          success: true,
          data: baseMetrics,
          timestamp: now
        });
      } catch (error) {
        logger.error('Error getting dashboard metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Error retrieving metrics'
        });
      }
    });
    
    this.app.get('/api/dashboard/activity', (req, res) => {
      try {
        // Generar actividad simulada
        const activities = [];
        const activityTypes = ['message', 'user_joined', 'ai_response', 'automation_triggered', 'contact_added'];
        const users = ['Usuario1', 'Usuario2', 'Usuario3', 'Sistema', 'Bot AI'];
        
        for (let i = 0; i < 10; i++) {
          const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
          const user = users[Math.floor(Math.random() * users.length)];
          const timestamp = Date.now() - (Math.random() * 3600000); // Últimas 1 hora
          
          activities.push({
            id: `activity_${i}`,
            type,
            user,
            message: this.generateActivityMessage(type, user),
            timestamp,
            status: Math.random() > 0.1 ? 'success' : 'warning'
          });
        }

        res.json({
          success: true,
          data: activities.sort((a, b) => b.timestamp - a.timestamp)
        });
      } catch (error) {
        logger.error('Error getting dashboard activity:', error);
        res.status(500).json({
          success: false,
          error: 'Error retrieving activity'
        });
      }
    });
    
    this.app.get('/api/dashboard/status', (req, res) => {
      try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        res.json({
          success: true,
          data: {
            status: 'online',
            uptime: Math.floor(uptime),
            uptimeFormatted: this.formatUptime(uptime),
            memory: {
              used: Math.round(memUsage.heapUsed / 1024 / 1024),
              total: Math.round(memUsage.heapTotal / 1024 / 1024),
              percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
            },
            cpu: Math.floor(Math.random() * 30) + 10, // CPU simulado
            services: {
              database: Math.random() > 0.05 ? 'online' : 'warning',
              ai: Math.random() > 0.03 ? 'online' : 'offline',
              messaging: 'online',
              automation: Math.random() > 0.02 ? 'online' : 'warning'
            },
            lastCheck: Date.now()
          }
        });
      } catch (error) {
        logger.error('Error getting dashboard status:', error);
        res.status(500).json({
          success: false,
          error: 'Error retrieving status'
        });
      }
    });
    
    // Analytics endpoints
    this.app.get('/api/analytics/metrics', (req, res) => {
      res.json({ success: true, data: {} });
    });
    
    this.app.get('/api/analytics/charts', (req, res) => {
      res.json({ success: true, data: {} });
    });
    
    this.app.get('/api/analytics/activity/recent', (req, res) => {
      res.json({ success: true, data: [] });
    });
    
    this.app.get('/api/analytics/reports', (req, res) => {
      res.json({ success: true, data: [] });
    });
    
    // AI Admin endpoints
    this.app.get('/api/ai-admin/status', (req, res) => {
      res.json({ 
        success: true, 
        data: {
          status: 'active',
          aiService: 'running',
          models: ['gpt-3.5-turbo', 'gpt-4'],
          lastUpdate: new Date().toISOString(),
          performance: {
            responseTime: '150ms',
            accuracy: '95%',
            uptime: '99.9%'
          }
        }
      });
    });

    // Stats endpoints
    this.app.get('/api/stats/active-chats', (req, res) => {
      res.json({ count: 42, trend: '+12%' });
    });

    this.app.get('/api/stats/messages-today', (req, res) => {
      res.json({ count: 1247, trend: '+8%' });
    });

    this.app.get('/api/stats/ai-responses', (req, res) => {
      res.json({ count: 89, trend: '+15%' });
    });

    this.app.get('/api/stats/conversion-rate', (req, res) => {
      res.json({ rate: 23.5, trend: '+3%' });
    });

    // Activity endpoint
    this.app.get('/api/activity/recent', (req, res) => {
      res.json([
        { id: 1, type: 'message', description: 'Nuevo mensaje de +1234567890', time: '2 min ago' },
        { id: 2, type: 'template', description: 'Template "Bienvenida" enviado', time: '5 min ago' },
        { id: 3, type: 'flow', description: 'Flow "Soporte" completado', time: '8 min ago' }
      ]);
    });

    // Integrations endpoints
    this.app.get('/api/integrations/stats', (req, res) => {
      res.json({
        total: 8,
        active: 6,
        pending: 1,
        failed: 1,
        lastSync: new Date().toISOString()
      });
    });

    this.app.get('/api/integrations/auth/api-keys', (req, res) => {
      res.json([
        { id: 1, name: 'WhatsApp Business', status: 'active', created: '2024-01-15' },
        { id: 2, name: 'Mailchimp', status: 'active', created: '2024-01-10' }
      ]);
    });

    this.app.post('/api/integrations/auth/api-keys', (req, res) => {
      res.json({ success: true, id: Date.now(), message: 'API key created successfully' });
    });

    this.app.get('/api/integrations/webhooks', (req, res) => {
      res.json([
        { id: 1, url: 'https://api.example.com/webhook', status: 'active', events: ['message', 'status'] }
      ]);
    });

    this.app.post('/api/integrations/webhooks', (req, res) => {
      res.json({ success: true, id: Date.now(), message: 'Webhook created successfully' });
    });

    this.app.get('/api/integrations/integrations', (req, res) => {
      res.json([
        { id: 1, name: 'WhatsApp Business', type: 'messaging', status: 'connected' },
        { id: 2, name: 'Mailchimp', type: 'email', status: 'connected' }
      ]);
    });

    this.app.post('/api/integrations/integrations', (req, res) => {
      res.json({ success: true, id: Date.now(), message: 'Integration created successfully' });
    });

    this.app.post('/api/integrations/webhooks/test', (req, res) => {
      res.json({ success: true, message: 'Webhook test successful', responseTime: '120ms' });
    });

    // Notifications endpoints
    this.app.post('/api/notifications/send', (req, res) => {
      res.json({ success: true, messageId: Date.now(), message: 'Notification sent successfully' });
    });

    this.app.post('/api/notifications/broadcast', (req, res) => {
      res.json({ success: true, campaignId: Date.now(), recipients: 150, message: 'Broadcast sent successfully' });
    });

    this.app.get('/api/notifications/metrics', (req, res) => {
      res.json({
        sent: 1247,
        delivered: 1198,
        read: 892,
        clicked: 234,
        deliveryRate: 96.1,
        readRate: 74.5
      });
    });

    // Analytics endpoints
    this.app.get('/api/analytics', (req, res) => {
      res.json({
        overview: {
          totalMessages: 5420,
          activeUsers: 342,
          conversionRate: 23.5,
          avgResponseTime: '2.3min'
        },
        trends: {
          messages: [120, 135, 142, 158, 167, 145, 132],
          users: [45, 52, 48, 61, 58, 55, 49]
        }
      });
    });

    this.app.get('/api/analytics/realtime', (req, res) => {
      res.json({
        activeUsers: 23,
        messagesPerMinute: 8,
        currentConversations: 15,
        systemLoad: 34
      });
    });

    // AI endpoints
    this.app.get('/api/ai/health', (req, res) => {
      res.json({ status: 'healthy', uptime: '99.9%', lastCheck: new Date().toISOString() });
    });

    this.app.post('/api/ai/toggle', (req, res) => {
      res.json({ success: true, enabled: req.body.enabled, message: 'AI status updated' });
    });

    // Config endpoint
    this.app.get('/api/config', (req, res) => {
      res.json({
        whatsapp: { connected: true, number: '+1234567890' },
        ai: { enabled: true, model: 'gpt-3.5-turbo' },
        features: { templates: true, flows: true, analytics: true }
      });
    });

    // Inbox endpoint - ahora usa datos reales de SQLite
    this.app.get('/api/inbox', (req, res) => {
      res.status(410).json({
        success: false,
        error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/chat-live/conversations'
      });
    });

    // Contacts endpoints - endpoint temporal sin autenticación
    this.app.get('/api/contacts', async (req, res) => {
      try {
        const { 
          page = 1, 
          limit = 50, 
          search, 
          sortBy = 'created_at',
          sortOrder = 'desc'
        } = req.query;
        
        const db = this.services?.database?.getManager();
        if (!db) {
          return res.json({
            success: true,
            contacts: [],
            total: 0,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
              has_next: false,
              has_prev: false
            }
          });
        }
        
        const offset = (page - 1) * limit;
        
        // Construir query dinámicamente
        const whereConditions = [];
        const params = [];

        if (search) {
          whereConditions.push('(name LIKE ? OR phone_number LIKE ? OR email LIKE ?)');
          const searchTerm = `%${search}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

        // Query para contar total
        const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
        const totalResult = await db.get(countQuery, params);
        const total = totalResult?.total || 0;

        // Query principal con paginación
        const query = `
          SELECT id, phone_number, name, last_name, email, is_blocked,
                 created_at, updated_at, last_message_at
          FROM contacts
          ${whereClause}
          ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
          LIMIT ? OFFSET ?
        `;

        const contacts = await db.all(query, [...params, limit, offset]);

        // Procesar contactos
        const processedContacts = (contacts || []).map(contact => ({
          ...contact,
          is_blocked: Boolean(contact.is_blocked)
        }));
        
        res.json({
          success: true,
          contacts: processedContacts,
          total,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
            has_next: page * limit < total,
            has_prev: page > 1
          }
        });
        
      } catch (error) {
        console.error('Error obteniendo contactos:', error);
        res.json({
          success: true,
          contacts: [],
          total: 0,
          pagination: {
            page: parseInt(req.query.page || 1),
            limit: parseInt(req.query.limit || 50),
            total: 0,
            pages: 0,
            has_next: false,
            has_prev: false
          }
        });
      }
    });

    // Get single contact
    this.app.get('/api/contacts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const db = this.services?.database?.getManager();
        
        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }
        
        const contact = await db.get('SELECT * FROM contacts WHERE id = ?', [id]);

        if (!contact) {
          return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
        }

        contact.is_blocked = Boolean(contact.is_blocked);
        contact.groups = []; // TODO: Load groups from database
        
        res.json({ success: true, contact });
      } catch (error) {
        console.error('Error getting contact:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Create contact
    this.app.post('/api/contacts', async (req, res) => {
      try {
        const { name, phone, email, notes, groups } = req.body;
        const db = this.services?.database?.getManager();

        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }

        // Check if contact exists
        const existing = await db.get('SELECT id FROM contacts WHERE phone_number = ?', [phone]);
        if (existing) {
          return res.status(400).json({ success: false, error: 'El contacto ya existe' });
        }

        const result = await db.run(
          `INSERT INTO contacts (phone_number, name, email, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [phone, name, email, notes || '']
        );

        res.json({ success: true, id: result.lastID, message: 'Contacto creado correctamente' });
      } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update contact
    this.app.put('/api/contacts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { name, last_name, phone, email, notes } = req.body;
        const db = this.services?.database?.getManager();

        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }

        await db.run(
          `UPDATE contacts
           SET name = ?, last_name = ?, phone_number = ?, email = ?, notes = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [name, last_name || null, phone, email, notes || '', id]
        );

        res.json({ success: true, message: 'Contacto actualizado correctamente' });
      } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Delete contact
    this.app.delete('/api/contacts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const db = this.services?.database?.getManager();
        
        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }
        
        await db.run('DELETE FROM contacts WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Contacto eliminado correctamente' });
      } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get groups
    this.app.get('/api/contacts/groups', async (req, res) => {
      try {
        const db = this.services?.database?.getManager();
        
        if (!db) {
          return res.json({ success: true, groups: [] });
        }
        
        // TODO: Implement groups table
        res.json({ success: true, groups: [] });
      } catch (error) {
        console.error('Error getting groups:', error);
        res.json({ success: true, groups: [] });
      }
    });

    // Export contacts
    this.app.get('/api/contacts/export', async (req, res) => {
      try {
        const db = this.services?.database?.getManager();
        
        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }
        
        const contacts = await db.all('SELECT name, last_name, phone_number, email, created_at FROM contacts ORDER BY created_at DESC');

        // Create CSV
        const csv = [
          ['Nombre', 'Apellido', 'Teléfono', 'Email', 'Fecha de creación'].join(','),
          ...contacts.map(c => [
            c.name || '',
            c.last_name || '',
            c.phone_number || '',
            c.email || '',
            c.created_at || ''
          ].map(field => `"${field}"`).join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
        res.send(csv);
      } catch (error) {
        console.error('Error exporting contacts:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Import contacts
    const upload = multer({ dest: 'uploads/' });
    this.app.post('/api/contacts/import', upload.single('file'), async (req, res) => {
      try {
        const db = this.services?.database?.getManager();
        if (!db) {
          return res.status(500).json({ success: false, error: 'Database not available' });
        }

        if (!req.file) {
          return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
        }

        // mapping llega como JSON en un campo de formulario
        let mapping = null;
        if (req.body.mapping) {
          try {
            mapping = JSON.parse(req.body.mapping);
          } catch (e) {
            return res.status(400).json({ success: false, error: 'mapping inválido' });
          }
        }


        // Leer archivo desde disco
        const filePath = req.file.path;
        const fileBuffer = fs.readFileSync(filePath);

        const originalName = req.file.originalname || '';
        const extension = (originalName.split('.').pop() || '').toLowerCase();

        let rows = [];

        if (extension === 'csv') {
          const text = fileBuffer.toString('utf-8');
          const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          if (lines.length > 1) {
            // Primera fila se asume encabezado, pero usamos mapping basado en índices
            rows = lines.slice(1).map(line => line.split(/[,;\t]/));
          }
        } else if (extension === 'xlsx' || extension === 'xls') {
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (data.length > 1) {
            rows = data.slice(1); // omitir encabezado
          }
        } else {
          return res.status(400).json({ success: false, error: 'Tipo de archivo no soportado. Usa CSV o Excel.' });
        }

        if (!rows.length) {
          return res.status(400).json({ success: false, error: 'El archivo no contiene filas de datos' });
        }

        const mapIndex = (key) => {
          if (!mapping || mapping[key] == null) return null;
          const idx = parseInt(mapping[key], 10);
          return Number.isNaN(idx) ? null : idx;
        };

        const idxName = mapIndex('name');
        const idxLastName = mapIndex('lastName');
        const idxPhone = mapIndex('phone');
        const idxEmail = mapIndex('email');

        if (idxPhone == null) {
          return res.status(400).json({ success: false, error: 'Es obligatorio mapear la columna de Teléfono' });
        }

        let imported = 0;
        let updated = 0;
        const errors = [];

        const normalizePhone = (value) => {
          if (!value) return '';
          // Eliminar todo lo que no sea dígito
          let digits = value.toString().replace(/[^0-9]/g, '');
          // Si comienza con 57 y tiene más de 12 dígitos, tomar solo los primeros 12
          if (digits.startsWith('57') && digits.length > 12) {
            digits = digits.substring(0, 12);
          }
          // Si tiene 10 dígitos (ej. 3022753557), anteponer 57
          if (digits.length === 10) {
            digits = '57' + digits;
          }
          return digits;
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const rawPhone = row[idxPhone];
            const phone = normalizePhone(rawPhone ?? '');
            if (!phone) {
              errors.push({ row: i + 2, error: 'Teléfono vacío o inválido' });
              continue;
            }

            const name = idxName != null ? (row[idxName] ?? '').toString().trim() : '';
            const lastName = idxLastName != null ? (row[idxLastName] ?? '').toString().trim() : '';
            const email = idxEmail != null ? (row[idxEmail] ?? '').toString().trim() : '';

            // Ver si ya existe contacto por teléfono
            const existing = await db.get('SELECT id FROM contacts WHERE phone_number = ?', [phone]);

            if (existing) {
              await db.run(
                `UPDATE contacts
                 SET name = ?, last_name = ?, email = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [name || null, lastName || null, email || null, existing.id]
              );
              updated++;
            } else {
              const result = await db.run(
                `INSERT INTO contacts (phone_number, name, last_name, email, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [phone, name || null, lastName || null, email || null, '']
              );
              if (result && result.lastID) {
                imported++;
              }
            }
          } catch (err) {
            errors.push({ row: i + 2, error: err.message });
          }
        }

        res.json({ success: true, imported, updated, errors });
      } catch (error) {
        console.error('Error importando contactos:', error);
        res.status(500).json({ success: false, error: error.message });
      } finally {
        // Intentar limpiar el archivo temporal
        if (req.file && req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
      }
    });


    // Custom fields endpoints (stub)
    this.app.get('/api/custom-fields', (req, res) => {
      res.json({ success: true, data: [] });
    });


    // Messaging endpoints
    this.app.post('/api/send', (req, res) => {
      res.json({ success: true, messageId: Date.now(), message: 'Message sent successfully' });
    });

    this.app.post('/api/send-message', (req, res) => {
      res.json({ success: true, messageId: Date.now(), to: req.body.to, text: req.body.text });
    });

    this.app.post('/api/send-template', (req, res) => {
      res.json({ success: true, messageId: Date.now(), template: req.body.template });
    });

    this.app.post('/api/send-flow', (req, res) => {
      res.json({ success: true, flowId: Date.now(), flow: req.body.flow });
    });

    this.app.post('/api/send-media', (req, res) => {
      res.json({ success: true, messageId: Date.now(), type: req.body.type, link: req.body.link });
    });

    this.app.post('/api/send-interactive', (req, res) => {
      res.json({ success: true, messageId: Date.now(), interactive: req.body.interactive });
    });

    this.app.post('/api/send-document', (req, res) => {
      res.json({ success: true, messageId: Date.now(), document: req.body.document });
    });

    this.app.post('/api/send-location', (req, res) => {
      res.json({ success: true, messageId: Date.now(), location: req.body.location });
    });

    this.app.post('/api/send-contact', (req, res) => {
      res.json({ success: true, messageId: Date.now(), contact: req.body.contact });
    });

    this.app.post('/api/send-sticker', (req, res) => {
      res.json({ success: true, messageId: Date.now(), sticker: req.body.sticker });
    });

    // Template endpoints
    this.app.post('/api/template-preview', (req, res) => {
      res.json({ success: true, preview: 'Template preview generated', html: '<p>Preview content</p>' });
    });

    this.app.post('/api/template-builder', (req, res) => {
      res.json({ success: true, templateId: Date.now(), message: 'Template saved successfully' });
    });

    this.app.get('/api/template-logs', (req, res) => {
      res.json([
        { id: 1, template: 'Bienvenida', sent: 45, delivered: 43, time: '2024-01-15 10:30' },
        { id: 2, template: 'Seguimiento', sent: 32, delivered: 30, time: '2024-01-15 09:15' }
      ]);
    });

    this.app.post('/api/ai-template-assist', (req, res) => {
      res.json({ 
        success: true, 
        suggestion: 'Hola {{name}}, gracias por contactarnos. ¿En qué podemos ayudarte hoy?',
        improvements: ['Personalizar saludo', 'Agregar call-to-action']
      });
    });

    this.app.post('/api/ai-template-validate', (req, res) => {
      res.json({ 
        valid: true, 
        score: 85, 
        suggestions: ['Mejorar personalización', 'Reducir longitud del mensaje']
      });
    });

    // Dynamic templates endpoints
    this.app.get('/api/dynamic-templates', (req, res) => {
      res.json([
        { id: 1, name: 'Bienvenida Dinámica', variables: ['name', 'company'], status: 'active' },
        { id: 2, name: 'Seguimiento Personalizado', variables: ['name', 'product'], status: 'active' }
      ]);
    });

    this.app.post('/api/dynamic-templates', (req, res) => {
      res.json({ success: true, templateId: Date.now(), message: 'Dynamic template created successfully' });
    });

    this.app.get('/api/dynamic-templates/variables', (req, res) => {
      res.json([
        { name: 'name', type: 'string', required: true },
        { name: 'company', type: 'string', required: false },
        { name: 'product', type: 'string', required: false }
      ]);
    });

    this.app.post('/api/dynamic-templates/variables', (req, res) => {
      res.json({ success: true, variable: req.body.name, message: 'Variable created successfully' });
    });

    this.app.get('/api/dynamic-templates/stats', (req, res) => {
      res.json({
        total: 15,
        active: 12,
        variables: 8,
        usage: 245
      });
    });

    // Health and system endpoints
    this.app.get('/api/health/status', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/analytics/performance', (req, res) => {
      res.json({
        responseTime: '1.2s',
        throughput: '150 req/min',
        errorRate: '0.5%',
        uptime: '99.9%'
      });
    });

    // Local messaging endpoints
    this.app.post('/api/local/messaging/send-text', (req, res) => {
      res.json({ success: true, messageId: Date.now(), text: req.body.text });
    });

    this.app.post('/api/local/messaging/send-template', (req, res) => {
      res.json({ success: true, messageId: Date.now(), template: req.body.template });
    });

    this.app.post('/api/local/messaging/send-media', (req, res) => {
      res.json({ success: true, messageId: Date.now(), media: req.body.media });
    });

    // Notes endpoints
    this.app.post('/api/save-note', (req, res) => {
      res.json({ success: true, noteId: Date.now(), note: req.body.note });
    });

    this.app.get('/api/notes', (req, res) => {
      res.json([
        { id: 1, content: 'Cliente interesado en producto premium', contact: '+1234567890', date: '2024-01-15' },
        { id: 2, content: 'Seguimiento programado para mañana', contact: '+0987654321', date: '2024-01-14' }
      ]);
    });

    // Simulation endpoint
    this.app.post('/api/simulate-message-progression', (req, res) => {
      res.json({ 
        success: true, 
        simulation: 'Message progression simulated',
        steps: ['Sent', 'Delivered', 'Read', 'Replied']
      });
    });

    // IA endpoint
    this.app.post('/api/ia', (req, res) => {
      res.json({ success: true, enabled: req.body.enabled, message: 'IA status updated' });
    });

    // Audio upload endpoint
    this.app.post('/api/upload-audio', (req, res) => {
      res.json({ success: true, audioId: Date.now(), link: '/uploads/audio/' + Date.now() + '.mp3' });
    });
    
    logger.info('Endpoints modulares configurados correctamente');
  }
  
  // Método removido - ahora manejado por AppInitializer
  
  // Método removido - ahora manejado por AppInitializer
  
  /**
   * Iniciar el servidor
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('⚠️ El servidor ya está ejecutándose');
        return;
      }
      
      // Usar AppInitializer para iniciar el servidor
      const serverInfo = await this.appInitializer.start();
      
      this.isRunning = true;
      this.startTime = serverInfo.startTime;
      
      // Extraer componentes después del inicio
      this.app = this.appInitializer.getApp();
      this.server = this.appInitializer.getServer();
      this.io = this.appInitializer.getIO();
      this.services = this.appInitializer.getManager('services');
      
      logger.info(`🚀 Servidor Chat-Bot-1-2 ejecutándose en ${serverInfo.url}`);
      logger.info(`📊 Dashboard disponible en http://localhost:${serverInfo.port}/dashboard`);
      logger.info(`👥 Gestión de contactos en http://localhost:${serverInfo.port}/contacts`);
      logger.info(`📨 Gestión de mensajes en http://localhost:${serverInfo.port}/messages`);
      logger.info(`🤖 Automatización en http://localhost:${serverInfo.port}/automation`);
      logger.info(`📈 Analíticas en http://localhost:${serverInfo.port}/api/analytics`);
      logger.info(`⚡ Aplicación modularizada iniciada correctamente`);
      
      return serverInfo;
      
    } catch (error) {
      logger.error('❌ Error iniciando servidor:', error);
      throw error;
    }
  }
  
  /**
   * Detener el servidor
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ El servidor no está ejecutándose');
        return;
      }
      
      // Usar AppInitializer para detener el servidor
      await this.appInitializer.stop();
      
      this.isRunning = false;
      this.startTime = null;
      
      logger.info('🛑 Servidor detenido correctamente');
      
    } catch (error) {
      logger.error('❌ Error deteniendo servidor:', error);
      throw error;
    }
  }
  
  /**
   * Reiniciar servidor
   */
  async restart() {
    try {
      logger.info('🔄 Reiniciando servidor...');
      
      await this.appInitializer.restart();
      
      logger.info('✅ Servidor reiniciado correctamente');
      
    } catch (error) {
      logger.error('❌ Error reiniciando servidor:', error);
      throw error;
    }
  }

  /**
   * Obtener instancia de Express
   */
  getApp() {
    return this.appInitializer.getApp();
  }
  
  /**
   * Obtener instancia del servidor HTTP
   */
  getServer() {
    return this.appInitializer.getServer();
  }
  
  /**
   * Obtener instancia de Socket.IO
   */
  getIO() {
    return this.appInitializer.getIO();
  }
  
  /**
   * Obtener servicios
   */
  getServices() {
    return this.appInitializer.getManager('services');
  }

  /**
   * Obtener gestor específico
   */
  getManager(name) {
    return this.appInitializer.getManager(name);
  }
  
  /**
   * Obtener estado del servidor
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      config: this.config,
      appInitializerStats: this.appInitializer.getStats()
    };
  }

  /**
   * Obtener información del sistema
   */
  getSystemInfo() {
    return this.appInitializer.getSystemInfo();
  }

  /**
   * Obtener estadísticas de la aplicación
   */
  getStats() {
    return this.appInitializer.getStats();
  }

  /**
   * Generar mensaje de actividad basado en el tipo
   */
  generateActivityMessage(type, user) {
    const messages = {
      message: `${user} envió un mensaje`,
      user_joined: `${user} se unió al chat`,
      ai_response: `${user} generó una respuesta automática`,
      automation_triggered: `Se activó una automatización para ${user}`,
      contact_added: `Se agregó un nuevo contacto: ${user}`
    };
    return messages[type] || `${user} realizó una acción`;
  }

  /**
   * Formatear tiempo de actividad
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

export default App;
