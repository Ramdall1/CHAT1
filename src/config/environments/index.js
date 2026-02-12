import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
    PORT: Joi.number().default(3000),
    DEFAULT_COUNTRY_CODE: Joi.string().default('+57'),
    MAX_CONTACTS: Joi.number().default(10000),
    BACKUP_ON_WRITE: Joi.boolean().default(true),
    VALIDATE_PHONES: Joi.boolean().default(true),
    AUTO_CLEANUP: Joi.boolean().default(true),
    D360_API_KEY: Joi.string().allow(''),
    WABA_API_BASE: Joi.string().uri().allow('')
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  defaultCountryCode: envVars.DEFAULT_COUNTRY_CODE,
  maxContacts: envVars.MAX_CONTACTS,
  backupOnWrite: envVars.BACKUP_ON_WRITE,
  validatePhones: envVars.VALIDATE_PHONES,
  autoCleanup: envVars.AUTO_CLEANUP,
  d360ApiKey: envVars.D360_API_KEY,
  wabaApiBase: envVars.WABA_API_BASE
};

export const LOGGING_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  CONSOLE: process.env.LOG_CONSOLE !== 'false',
  FILE_LOGGING: process.env.LOG_FILE !== 'false',
  FILE: process.env.LOG_FILE_PATH || './logs/app.log',
  MAX_SIZE: parseInt(process.env.LOG_MAX_SIZE) || 5242880, // 5MB
  MAX_FILES: parseInt(process.env.LOG_MAX_FILES) || 5
};

export const DATABASE_CONFIG = {
  DATA_DIR: process.env.DATA_DIR || './data',
  BACKUP_DIR: process.env.BACKUP_DIR || './backups',
  UPLOADS_DIR: process.env.UPLOADS_DIR || './public/uploads',
  FILES: {
    CONTACTS: 'contactos.json',
    CONVERSATIONS: 'conversaciones.json',
    ANALYTICS: 'analytics.json',
    LOGS: 'logs.json',
    BACKUPS: 'backups.json',
    AUDIENCE_SEGMENTS: 'audience_segments.json'
  }
};

export default config;
