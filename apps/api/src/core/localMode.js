import { log } from './logger.js';

/**
 * Módulo para manejar el modo local y simular funcionalidades externas
 */

const LOCAL_MODE = process.env.LOCAL_MODE === 'true';
const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';
const SIMULATE_WHATSAPP = process.env.SIMULATE_WHATSAPP === 'true';

export class LocalModeManager {
  constructor() {
    this.isLocalMode = LOCAL_MODE;
    this.isOfflineMode = OFFLINE_MODE;
    this.simulateWhatsApp = SIMULATE_WHATSAPP;

    if (this.isLocalMode) {
      log('🏠 Modo LOCAL activado - Funcionamiento sin dependencias externas');
    }
  }

  /**
   * Simula el envío de mensajes de WhatsApp
   */
  async simulateWhatsAppMessage(to, message) {
    if (!this.simulateWhatsApp) {
      throw new Error('Simulación de WhatsApp deshabilitada');
    }

    log(`📱 [SIMULADO] Enviando mensaje a ${to}:`, message);

    // Simular respuesta exitosa de la API
    return {
      success: true,
      message_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      to: to,
      timestamp: new Date().toISOString(),
      simulated: true,
    };
  }

  /**
   * Simula la respuesta de templates de WhatsApp
   */
  async simulateTemplateList() {
    if (!this.simulateWhatsApp) {
      return [];
    }

    log('📋 [SIMULADO] Obteniendo lista de templates');

    return [
      {
        name: 'hello_world',
        language: 'es',
        status: 'APPROVED',
        category: 'UTILITY',
        components: [
          {
            type: 'BODY',
            text: 'Hola {{1}}, bienvenido a nuestro servicio local!',
          },
        ],
      },
      {
        name: 'local_test',
        language: 'es',
        status: 'APPROVED',
        category: 'MARKETING',
        components: [
          {
            type: 'BODY',
            text: 'Este es un template de prueba en modo local.',
          },
        ],
      },
    ];
  }

  /**
   * Simula el estado de salud del sistema
   */
  async simulateHealthStatus() {
    if (!this.isLocalMode) {
      return null;
    }

    return {
      status: 'healthy',
      mode: 'local',
      messaging_limits: {
        tier: 'unlimited',
        quality_rating: 'green',
      },
      timestamp: new Date().toISOString(),
      simulated: true,
    };
  }

  /**
   * Simula webhook de mensajes entrantes
   */
  simulateIncomingMessage(from, text) {
    if (!this.simulateWhatsApp) {
      return null;
    }

    const messageId = `sim_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    log(`📥 [SIMULADO] Mensaje entrante de ${from}: ${text}`);

    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'local_entry',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1234567890',
                  phone_number_id: 'local_phone_id',
                },
                messages: [
                  {
                    from: from,
                    id: messageId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: text },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
  }

  /**
   * Verifica si una funcionalidad externa está disponible
   */
  isExternalServiceAvailable(service) {
    if (this.isOfflineMode) {
      return false;
    }

    const availableServices = {
      whatsapp: !this.isLocalMode,
      ai: process.env.AI_ENDPOINT && process.env.AI_ENDPOINT !== '',
      manychat:
        process.env.MANYCHAT_API_KEY && process.env.MANYCHAT_API_KEY !== '',
      webhook: process.env.NGROK_URL && process.env.NGROK_URL !== '',
    };

    return availableServices[service] || false;
  }

  /**
   * Obtiene la configuración para modo local
   */
  getLocalConfig() {
    return {
      localMode: this.isLocalMode,
      offlineMode: this.isOfflineMode,
      simulateWhatsApp: this.simulateWhatsApp,
      dataDir: process.env.DATA_DIR || './data',
      uploadsDir: process.env.UPLOADS_DIR || './public/uploads',
      backupsEnabled: process.env.BACKUPS_ENABLED !== 'false',
      autoBackupInterval: parseInt(process.env.AUTO_BACKUP_INTERVAL) || 3600000,
    };
  }
}

export const localModeManager = new LocalModeManager();
export default localModeManager;
