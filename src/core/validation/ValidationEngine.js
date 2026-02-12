/**
 * ValidationEngine - Motor de validación centralizado para el chatbot
 * Proporciona validación de datos, mensajes y configuraciones
 */

import Joi from '@hapi/joi';
import { EventEmitter } from 'events';

class ValidationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.schemas = new Map();
        this.validators = new Map();
        this.customRules = new Map();
        this.options = {
            enableCaching: options.enableCaching !== false,
            cacheSize: options.cacheSize || 1000,
            enableMetrics: options.enableMetrics !== false,
            strictMode: options.strictMode !== false,
            ...options
        };
        
        this.cache = new Map();
        this.metrics = {
            validations: 0,
            successes: 0,
            failures: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        this.setupDefaultSchemas();
        this.setupDefaultValidators();
        this.setupCustomRules();
    }

    /**
     * Registra un esquema de validación
     */
    registerSchema(name, schema, options = {}) {
        if (this.schemas.has(name) && !options.overwrite) {
            throw new Error(`Schema ${name} already exists`);
        }

        // Convertir a esquema Joi si es necesario
        const joiSchema = Joi.isSchema(schema) ? schema : Joi.object(schema);

        this.schemas.set(name, {
            schema: joiSchema,
            options: {
                allowUnknown: options.allowUnknown || false,
                stripUnknown: options.stripUnknown || false,
                abortEarly: options.abortEarly !== false,
                ...options
            },
            createdAt: new Date(),
            usageCount: 0
        });

        this.emit('schemaRegistered', { name, options });

        return this;
    }

    /**
     * Registra un validador personalizado
     */
    registerValidator(name, validator) {
        if (typeof validator !== 'function') {
            throw new Error('Validator must be a function');
        }

        this.validators.set(name, {
            validate: validator,
            createdAt: new Date(),
            usageCount: 0
        });

        this.emit('validatorRegistered', { name });

        return this;
    }

    /**
     * Valida datos usando un esquema registrado
     */
    async validate(schemaName, data, options = {}) {
        this.metrics.validations++;

        try {
            // Verificar caché si está habilitado
            if (this.options.enableCaching) {
                const cacheKey = this.generateCacheKey(schemaName, data);
                const cached = this.cache.get(cacheKey);
                
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
                this.metrics.cacheMisses++;
            }

            const schemaInfo = this.schemas.get(schemaName);
            if (!schemaInfo) {
                throw new Error(`Schema ${schemaName} not found`);
            }

            // Realizar validación
            const result = await this.performValidation(schemaInfo, data, options);

            // Actualizar métricas y caché
            schemaInfo.usageCount++;
            
            if (result.isValid) {
                this.metrics.successes++;
            } else {
                this.metrics.failures++;
            }

            // Guardar en caché si está habilitado
            if (this.options.enableCaching && result.isValid) {
                this.cacheResult(schemaName, data, result);
            }

            this.emit('validationCompleted', {
                schemaName,
                isValid: result.isValid,
                errorCount: result.errors.length
            });

            return result;

        } catch (error) {
            this.metrics.failures++;
            this.emit('validationError', { schemaName, error });
            throw error;
        }
    }

    /**
     * Valida usando un validador personalizado
     */
    async validateWith(validatorName, data, context = {}) {
        this.metrics.validations++;

        try {
            const validatorInfo = this.validators.get(validatorName);
            if (!validatorInfo) {
                throw new Error(`Validator ${validatorName} not found`);
            }

            const result = await validatorInfo.validate(data, context);
            validatorInfo.usageCount++;

            const validationResult = this.normalizeValidationResult(result);

            if (validationResult.isValid) {
                this.metrics.successes++;
            } else {
                this.metrics.failures++;
            }

            this.emit('customValidationCompleted', {
                validatorName,
                isValid: validationResult.isValid
            });

            return validationResult;

        } catch (error) {
            this.metrics.failures++;
            this.emit('customValidationError', { validatorName, error });
            throw error;
        }
    }

    /**
     * Valida múltiples datos con diferentes esquemas
     */
    async validateBatch(validations) {
        const results = [];

        for (const validation of validations) {
            try {
                const result = await this.validate(
                    validation.schema,
                    validation.data,
                    validation.options
                );
                results.push({
                    ...validation,
                    result,
                    success: true
                });
            } catch (error) {
                results.push({
                    ...validation,
                    error,
                    success: false
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        
        this.emit('batchValidationCompleted', {
            total: validations.length,
            successes: successCount,
            failures: validations.length - successCount
        });

        return results;
    }

    /**
     * Valida un mensaje de chat
     */
    async validateMessage(message, context = {}) {
        const messageSchema = this.schemas.get('message');
        if (!messageSchema) {
            throw new Error('Message schema not registered');
        }

        // Validación básica del esquema
        const schemaResult = await this.validate('message', message);
        
        if (!schemaResult.isValid) {
            return schemaResult;
        }

        // Validaciones adicionales específicas de mensajes
        const additionalValidations = await this.performMessageValidations(
            message, 
            context
        );

        return {
            isValid: schemaResult.isValid && additionalValidations.isValid,
            data: schemaResult.data,
            errors: [...schemaResult.errors, ...additionalValidations.errors],
            warnings: additionalValidations.warnings || []
        };
    }

    /**
     * Valida configuración del sistema
     */
    async validateConfig(config, configType = 'system') {
        const schemaName = `config_${configType}`;
        
        try {
            return await this.validate(schemaName, config);
        } catch (error) {
            if (error.message.includes('not found')) {
                // Usar validación genérica si no hay esquema específico
                return await this.validate('generic_config', config);
            }
            throw error;
        }
    }

    /**
     * Realiza la validación con Joi
     */
    async performValidation(schemaInfo, data, options) {
        const validationOptions = {
            ...schemaInfo.options,
            ...options
        };

        try {
            const { error, value, warning } = schemaInfo.schema.validate(
                data, 
                validationOptions
            );

            return {
                isValid: !error,
                data: value,
                errors: error ? this.formatJoiErrors(error) : [],
                warnings: warning ? this.formatJoiWarnings(warning) : [],
                originalData: data
            };

        } catch (error) {
            return {
                isValid: false,
                data: null,
                errors: [{
                    field: 'unknown',
                    message: error.message,
                    type: 'validation_error'
                }],
                warnings: [],
                originalData: data
            };
        }
    }

    /**
     * Realiza validaciones específicas de mensajes
     */
    async performMessageValidations(message, context) {
        const errors = [];
        const warnings = [];

        // Validar longitud del mensaje
        if (message.content && message.content.length > 4000) {
            warnings.push({
                field: 'content',
                message: 'Message content is very long',
                type: 'length_warning'
            });
        }

        // Validar contenido sospechoso
        if (await this.containsSuspiciousContent(message.content)) {
            errors.push({
                field: 'content',
                message: 'Message contains suspicious content',
                type: 'security_error'
            });
        }

        // Validar rate limiting
        if (context.userId && await this.isRateLimited(context.userId)) {
            errors.push({
                field: 'rate_limit',
                message: 'Rate limit exceeded',
                type: 'rate_limit_error'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Verifica contenido sospechoso
     */
    async containsSuspiciousContent(content) {
        if (!content) return false;

        const suspiciousPatterns = [
            /script\s*>/i,
            /<\s*iframe/i,
            /javascript:/i,
            /on\w+\s*=/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Verifica rate limiting
     */
    async isRateLimited(userId) {
        // Implementación básica - en producción usar Redis o similar
        const key = `rate_limit_${userId}`;
        const now = Date.now();
        const window = 60000; // 1 minuto
        const limit = 60; // 60 mensajes por minuto

        // Esta es una implementación simplificada
        return false;
    }

    /**
     * Formatea errores de Joi
     */
    formatJoiErrors(joiError) {
        return joiError.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
            value: detail.context?.value
        }));
    }

    /**
     * Formatea warnings de Joi
     */
    formatJoiWarnings(joiWarning) {
        return joiWarning.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
            value: detail.context?.value
        }));
    }

    /**
     * Normaliza resultado de validación personalizada
     */
    normalizeValidationResult(result) {
        if (typeof result === 'boolean') {
            return {
                isValid: result,
                data: null,
                errors: result ? [] : [{ message: 'Validation failed' }],
                warnings: []
            };
        }

        return {
            isValid: result.isValid || result.valid || false,
            data: result.data || result.value || null,
            errors: result.errors || [],
            warnings: result.warnings || []
        };
    }

    /**
     * Genera clave de caché
     */
    generateCacheKey(schemaName, data) {
        const dataString = JSON.stringify(data);
        return `${schemaName}:${this.simpleHash(dataString)}`;
    }

    /**
     * Hash simple para caché
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Guarda resultado en caché
     */
    cacheResult(schemaName, data, result) {
        if (this.cache.size >= this.options.cacheSize) {
            // Eliminar el más antiguo (LRU simple)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const cacheKey = this.generateCacheKey(schemaName, data);
        this.cache.set(cacheKey, {
            ...result,
            cachedAt: Date.now()
        });
    }

    /**
     * Limpia la caché
     */
    clearCache() {
        this.cache.clear();
        this.emit('cacheCleared');
    }

    /**
     * Obtiene métricas de validación
     */
    getMetrics() {
        const schemaMetrics = {};
        for (const [name, schema] of this.schemas) {
            schemaMetrics[name] = {
                usageCount: schema.usageCount,
                createdAt: schema.createdAt
            };
        }

        const validatorMetrics = {};
        for (const [name, validator] of this.validators) {
            validatorMetrics[name] = {
                usageCount: validator.usageCount,
                createdAt: validator.createdAt
            };
        }

        return {
            global: this.metrics,
            schemas: schemaMetrics,
            validators: validatorMetrics,
            cache: {
                size: this.cache.size,
                maxSize: this.options.cacheSize,
                hitRate: this.metrics.cacheHits / 
                        (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
            }
        };
    }

    /**
     * Configura esquemas por defecto
     */
    setupDefaultSchemas() {
        // Esquema para mensajes
        this.registerSchema('message', {
            id: Joi.string().optional(),
            content: Joi.string().required().max(4000),
            type: Joi.string().valid('text', 'image', 'audio', 'video', 'file').default('text'),
            timestamp: Joi.date().default(Date.now),
            userId: Joi.string().required(),
            sessionId: Joi.string().optional(),
            metadata: Joi.object().optional()
        });

        // Esquema para usuarios
        this.registerSchema('user', {
            id: Joi.string().required(),
            name: Joi.string().required().min(1).max(100),
            email: Joi.string().email().optional(),
            phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
            preferences: Joi.object().optional(),
            createdAt: Joi.date().default(Date.now)
        });

        // Esquema para configuración genérica
        this.registerSchema('generic_config', Joi.object().unknown(true));

        // Esquema para configuración del sistema
        this.registerSchema('config_system', {
            port: Joi.number().port().default(3000),
            host: Joi.string().hostname().default('localhost'),
            database: Joi.object({
                url: Joi.string().uri().required(),
                maxConnections: Joi.number().positive().default(10)
            }).required(),
            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
                file: Joi.string().optional()
            }).optional()
        });
    }

    /**
     * Configura validadores por defecto
     */
    setupDefaultValidators() {
        // Validador de fortaleza de contraseña
        this.registerValidator('password_strength', (password) => {
            const errors = [];
            
            if (password.length < 8) {
                errors.push({ message: 'Password must be at least 8 characters long' });
            }
            
            if (!/[A-Z]/.test(password)) {
                errors.push({ message: 'Password must contain at least one uppercase letter' });
            }
            
            if (!/[a-z]/.test(password)) {
                errors.push({ message: 'Password must contain at least one lowercase letter' });
            }
            
            if (!/\d/.test(password)) {
                errors.push({ message: 'Password must contain at least one number' });
            }
            
            return {
                isValid: errors.length === 0,
                errors
            };
        });

        // Validador de contenido apropiado
        this.registerValidator('content_appropriate', (content) => {
            const inappropriateWords = ['spam', 'scam', 'phishing'];
            const errors = [];
            
            const lowerContent = content.toLowerCase();
            for (const word of inappropriateWords) {
                if (lowerContent.includes(word)) {
                    errors.push({ 
                        message: `Content contains inappropriate word: ${word}` 
                    });
                }
            }
            
            return {
                isValid: errors.length === 0,
                errors
            };
        });
    }

    /**
     * Configura reglas personalizadas de Joi
     */
    setupCustomRules() {
        // Regla personalizada para validar números de teléfono
        const phoneRule = {
            name: 'phone',
            validate: (value, helpers) => {
                const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
                if (!phoneRegex.test(value)) {
                    return helpers.error('phone.invalid');
                }
                return value;
            }
        };

        // Extender Joi con reglas personalizadas
        this.customJoi = Joi.extend({
            type: 'string',
            base: Joi.string(),
            messages: {
                'phone.invalid': 'Invalid phone number format'
            },
            rules: {
                phone: phoneRule
            }
        });
    }

    /**
     * Obtiene estadísticas del motor de validación
     */
    getStats() {
        return {
            schemas: this.schemas.size,
            validators: this.validators.size,
            customRules: this.customRules.size,
            cacheSize: this.cache.size,
            metrics: this.metrics
        };
    }
}

// Instancia singleton
const validationEngine = new ValidationEngine();

export {
    ValidationEngine,
    validationEngine
};