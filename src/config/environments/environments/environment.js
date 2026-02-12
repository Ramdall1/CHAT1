import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Joi from 'joi';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

/**
 * Configuración centralizada del sistema
 * Consolida todas las variables de entorno en un solo lugar
 */
class EnvironmentConfig {
  constructor() {
    this.config = this.buildAndValidateConfig();
  }

  /**
     * Construye y valida la configuración completa del sistema usando Joi
     */
  buildAndValidateConfig() {
    const envVarsSchema = Joi.object()
      .keys({
        // Server
        NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
        PORT: Joi.number().default(3000),
        HOST: Joi.string().default('localhost'),
        LOG_LEVEL: Joi.string().default('info'),
        // 360Dialog
        D360_API_KEY: Joi.string().required(),
        WABA_API_BASE: Joi.string().uri().default('https://waba-v2.360dialog.io'),
        D360_PHONE_NUMBER_ID: Joi.string().allow(''),
        D360_WABA_ACCOUNT_ID: Joi.string().allow(''),
        D360_PARTNER_ID: Joi.string().allow(''),
        D360_WHATSAPP_CHANNEL_ID: Joi.string().allow(''),
        D360_WABA_CHANNEL_EXTERNAL_ID: Joi.string().allow(''),
        D360_NAMESPACE: Joi.string().allow(''),
        D360_TIMEZONE_ID: Joi.string().allow(''),
        D360_FB_BUSINESS_MANAGER_ID: Joi.string().allow(''),
        D360_WABA_BUSINESS_ACCOUNT_ID: Joi.string().allow(''),
        // AI
        AI_ENDPOINT: Joi.string().uri().allow(''),
        AI_MODEL: Joi.string().allow(''),
        // Webhook
        NGROK_URL: Joi.string().uri().allow(''),
        WEBHOOK_VERIFY_TOKEN: Joi.string().default('chatbot_verify_token_2024'),
        // Messaging
        REJECT_CALL_MESSAGE: Joi.string().default('No puedo atender ahora, te devuelvo la llamada en breve.'),
        DEFAULT_PRODUCT_ID: Joi.string().allow(''),
        // Security
        JWT_SECRET: Joi.string().default(crypto.randomBytes(32).toString('hex')),
        ENCRYPTION_KEY: Joi.string().default(crypto.randomBytes(32).toString('hex')),
        SESSION_SECRET: Joi.string().default(crypto.randomBytes(32).toString('hex')),
        CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
        // Database
        DB_BACKUP_INTERVAL: Joi.number().default(3600000)
      })
      .unknown();

    const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }
        
    return {
      server: {
        port: envVars.PORT,
        host: envVars.HOST,
        logLevel: envVars.LOG_LEVEL,
        environment: envVars.NODE_ENV
      },
      dialog360: {
        apiKey: envVars.D360_API_KEY,
        baseUrl: envVars.WABA_API_BASE,
        phoneNumberId: envVars.D360_PHONE_NUMBER_ID,
        wabaAccountId: envVars.D360_WABA_ACCOUNT_ID,
        partnerId: envVars.D360_PARTNER_ID,
        whatsappChannelId: envVars.D360_WHATSAPP_CHANNEL_ID,
        wabaChannelExternalId: envVars.D360_WABA_CHANNEL_EXTERNAL_ID,
        namespace: envVars.D360_NAMESPACE,
        timezoneId: envVars.D360_TIMEZONE_ID,
        fbBusinessManagerId: envVars.D360_FB_BUSINESS_MANAGER_ID,
        wabaBusinessAccountId: envVars.D360_WABA_BUSINESS_ACCOUNT_ID
      },
      ai: {
        endpoint: envVars.AI_ENDPOINT,
        model: envVars.AI_MODEL,
        enabled: !!envVars.AI_ENDPOINT
      },
      webhook: {
        ngrokUrl: envVars.NGROK_URL,
        verifyToken: envVars.WEBHOOK_VERIFY_TOKEN
      },
      messaging: {
        rejectCallMessage: envVars.REJECT_CALL_MESSAGE,
        defaultProductId: envVars.DEFAULT_PRODUCT_ID
      },
      paths: {
        data: path.join(process.cwd(), 'data'),
        uploads: path.join(process.cwd(), 'client', 'uploads'),
        logs: path.join(process.cwd(), 'logs'),
        backups: path.join(process.cwd(), 'backups'),
        public: path.join(process.cwd(), 'client')
      },
      security: {
        jwtSecret: envVars.JWT_SECRET,
        encryptionKey: envVars.ENCRYPTION_KEY,
        sessionSecret: envVars.SESSION_SECRET,
        corsOrigins: envVars.CORS_ORIGINS.split(',')
      },
      database: {
        type: 'sqlite',
        path: path.join(process.cwd(), 'data', 'database.sqlite'),
        backupInterval: envVars.DB_BACKUP_INTERVAL
      }
    };
  }

  /**
     * Obtiene la configuración completa
     */
  getConfig() {
    return this.config;
  }

  /**
     * Obtiene una sección específica de la configuración
     */
  getSection(section) {
    return this.config[section] || {};
  }

  /**
     * Verifica si el sistema está configurado correctamente
     */
  isConfigured() {
    return !!(this.config.dialog360.apiKey && this.config.server.port);
  }

  /**
     * Obtiene headers para 360Dialog API
     */
  getDialog360Headers() {
    return {
      'Content-Type': 'application/json',
      'D360-API-KEY': this.config.dialog360.apiKey
    };
  }

  /**
     * Obtiene headers para Hub 360Dialog (compatibilidad)
     */
  getHubHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.config.dialog360.apiKey
    };
  }

  /**
     * Imprime un resumen de la configuración (sin datos sensibles)
     */
  printSummary() {
    logger.debug('\n🔧 CONFIGURACIÓN DEL SISTEMA');
    logger.debug('================================');
    logger.debug(`🌐 Servidor: http://${this.config.server.host}:${this.config.server.port}`);
    logger.debug(`📱 360Dialog: ${this.config.dialog360.apiKey ? '✅ Configurado' : '❌ No configurado'}`);
    logger.debug(`🧠 IA: ${this.config.ai.enabled ? '✅ Habilitada' : '❌ Deshabilitada'}`);
    logger.debug(`🔗 Webhook: ${this.config.webhook.ngrokUrl ? '✅ Configurado' : '❌ No configurado'}`);
    logger.debug('🔒 Seguridad: ✅ Configurada');
    logger.debug('================================\n');
  }
}

// Crear instancia singleton
const environmentConfig = new EnvironmentConfig();

export default environmentConfig;
export { EnvironmentConfig };
