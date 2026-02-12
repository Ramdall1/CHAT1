/**
 * ErrorHandler - Manejador centralizado de errores para el core del chatbot
 * Proporciona funcionalidades avanzadas de manejo y recuperación de errores
 */

import { EventEmitter } from 'events';
import { errorManager } from '../../utils/helpers/error_manager.js';

class ErrorHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            enableRecovery: options.enableRecovery !== false,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            enableCircuitBreaker: options.enableCircuitBreaker !== false,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 30000,
            ...options
        };
        
        this.circuitBreakers = new Map();
        this.retryCounters = new Map();
        this.errorPatterns = new Map();
        this.recoveryStrategies = new Map();
        
        this.setupDefaultStrategies();
        this.setupDefaultPatterns();
    }

    /**
     * Maneja un error con estrategias de recuperación
     */
    async handleError(error, context = {}) {
        try {
            // Normalizar el error
            const normalizedError = this.normalizeError(error, context);
            
            // Registrar el error
            this.logError(normalizedError, context);
            
            // Verificar circuit breaker
            if (this.isCircuitOpen(context.operation)) {
                throw new Error(`Circuit breaker is open for operation: ${context.operation}`);
            }
            
            // Intentar recuperación automática
            if (this.options.enableRecovery) {
                const recovery = await this.attemptRecovery(normalizedError, context);
                if (recovery.success) {
                    this.emit('errorRecovered', { error: normalizedError, context, recovery });
                    return recovery.result;
                }
            }
            
            // Actualizar circuit breaker
            this.updateCircuitBreaker(context.operation, false);
            
            // Emitir evento de error no recuperado
            this.emit('errorNotRecovered', { error: normalizedError, context });
            
            throw normalizedError;
            
        } catch (handlingError) {
            // Error en el manejo de errores
            this.emit('handlingError', { originalError: error, handlingError, context });
            throw handlingError;
        }
    }

    /**
     * Normaliza errores a un formato estándar
     */
    normalizeError(error, context) {
        if (error.isNormalized) {
            return error;
        }

        const normalizedError = {
            name: error.name || 'UnknownError',
            message: error.message || 'An unknown error occurred',
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode,
            severity: this.determineSeverity(error, context),
            category: this.categorizeError(error, context),
            timestamp: new Date(),
            context: { ...context },
            isNormalized: true,
            originalError: error
        };

        return normalizedError;
    }

    /**
     * Determina la severidad del error
     */
    determineSeverity(error, context) {
        // Errores críticos del sistema
        if (error.name === 'SystemError' || error.code === 'ENOSPC') {
            return 'critical';
        }
        
        // Errores de base de datos
        if (error.name === 'DatabaseError' || error.code?.startsWith('DB_')) {
            return 'high';
        }
        
        // Errores de autenticación
        if (error.statusCode === 401 || error.name === 'AuthenticationError') {
            return 'medium';
        }
        
        // Errores de validación
        if (error.statusCode === 400 || error.name === 'ValidationError') {
            return 'low';
        }
        
        return 'medium';
    }

    /**
     * Categoriza el error
     */
    categorizeError(error, context) {
        const patterns = [
            { pattern: /network|connection|timeout/i, category: 'network' },
            { pattern: /database|db|sql/i, category: 'database' },
            { pattern: /auth|permission|unauthorized/i, category: 'authentication' },
            { pattern: /validation|invalid|format/i, category: 'validation' },
            { pattern: /rate.?limit|quota/i, category: 'rateLimit' },
            { pattern: /memory|heap|space/i, category: 'resource' }
        ];

        const errorText = `${error.name} ${error.message}`.toLowerCase();
        
        for (const { pattern, category } of patterns) {
            if (pattern.test(errorText)) {
                return category;
            }
        }
        
        return 'general';
    }

    /**
     * Intenta recuperación automática del error
     */
    async attemptRecovery(error, context) {
        const strategy = this.getRecoveryStrategy(error.category, error.name);
        
        if (!strategy) {
            return { success: false, reason: 'No recovery strategy available' };
        }

        const retryKey = `${context.operation || 'unknown'}_${error.category}`;
        const retryCount = this.retryCounters.get(retryKey) || 0;
        
        if (retryCount >= this.options.maxRetries) {
            this.retryCounters.delete(retryKey);
            return { success: false, reason: 'Max retries exceeded' };
        }

        try {
            this.retryCounters.set(retryKey, retryCount + 1);
            
            // Esperar antes del reintento
            if (retryCount > 0) {
                await this.delay(this.options.retryDelay * Math.pow(2, retryCount - 1));
            }
            
            const result = await strategy.recover(error, context, retryCount);
            
            // Recuperación exitosa
            this.retryCounters.delete(retryKey);
            this.updateCircuitBreaker(context.operation, true);
            
            return { success: true, result, retryCount };
            
        } catch (recoveryError) {
            return { 
                success: false, 
                reason: 'Recovery strategy failed', 
                error: recoveryError,
                retryCount 
            };
        }
    }

    /**
     * Obtiene estrategia de recuperación
     */
    getRecoveryStrategy(category, errorName) {
        return this.recoveryStrategies.get(category) || 
               this.recoveryStrategies.get(errorName) ||
               this.recoveryStrategies.get('default');
    }

    /**
     * Registra una estrategia de recuperación
     */
    registerRecoveryStrategy(key, strategy) {
        this.recoveryStrategies.set(key, strategy);
    }

    /**
     * Verifica si el circuit breaker está abierto
     */
    isCircuitOpen(operation) {
        if (!this.options.enableCircuitBreaker || !operation) {
            return false;
        }

        const breaker = this.circuitBreakers.get(operation);
        if (!breaker) {
            return false;
        }

        if (breaker.state === 'open') {
            if (Date.now() - breaker.lastFailure > this.options.circuitBreakerTimeout) {
                breaker.state = 'half-open';
                breaker.failures = 0;
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Actualiza el estado del circuit breaker
     */
    updateCircuitBreaker(operation, success) {
        if (!this.options.enableCircuitBreaker || !operation) {
            return;
        }

        let breaker = this.circuitBreakers.get(operation);
        if (!breaker) {
            breaker = { state: 'closed', failures: 0, lastFailure: null };
            this.circuitBreakers.set(operation, breaker);
        }

        if (success) {
            breaker.failures = 0;
            breaker.state = 'closed';
        } else {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            
            if (breaker.failures >= this.options.circuitBreakerThreshold) {
                breaker.state = 'open';
                this.emit('circuitBreakerOpened', { operation, failures: breaker.failures });
            }
        }
    }

    /**
     * Registra el error
     */
    logError(error, context) {
        errorManager.handleError(error, context);
        
        this.emit('errorLogged', { error, context });
    }

    /**
     * Configura estrategias de recuperación por defecto
     */
    setupDefaultStrategies() {
        // Estrategia para errores de red
        this.registerRecoveryStrategy('network', {
            recover: async (error, context, retryCount) => {
                if (context.originalFunction) {
                    return await context.originalFunction(...(context.args || []));
                }
                throw new Error('No original function to retry');
            }
        });

        // Estrategia para errores de base de datos
        this.registerRecoveryStrategy('database', {
            recover: async (error, context, retryCount) => {
                // Intentar reconectar a la base de datos
                if (context.reconnect && typeof context.reconnect === 'function') {
                    await context.reconnect();
                }
                
                if (context.originalFunction) {
                    return await context.originalFunction(...(context.args || []));
                }
                throw new Error('No original function to retry');
            }
        });

        // Estrategia por defecto
        this.registerRecoveryStrategy('default', {
            recover: async (error, context, retryCount) => {
                if (context.originalFunction && retryCount < 2) {
                    return await context.originalFunction(...(context.args || []));
                }
                throw error;
            }
        });
    }

    /**
     * Configura patrones de error por defecto
     */
    setupDefaultPatterns() {
        this.errorPatterns.set('timeout', /timeout|timed.?out/i);
        this.errorPatterns.set('connection', /connection|connect|econnrefused/i);
        this.errorPatterns.set('memory', /memory|heap|out.?of.?memory/i);
        this.errorPatterns.set('permission', /permission|access|unauthorized/i);
    }

    /**
     * Función de utilidad para delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtiene estadísticas del manejador de errores
     */
    getStats() {
        const circuitBreakerStats = {};
        for (const [operation, breaker] of this.circuitBreakers) {
            circuitBreakerStats[operation] = {
                state: breaker.state,
                failures: breaker.failures,
                lastFailure: breaker.lastFailure
            };
        }

        return {
            circuitBreakers: circuitBreakerStats,
            retryCounters: Object.fromEntries(this.retryCounters),
            recoveryStrategies: Array.from(this.recoveryStrategies.keys()),
            errorPatterns: Array.from(this.errorPatterns.keys())
        };
    }

    /**
     * Limpia contadores y estados
     */
    reset() {
        this.circuitBreakers.clear();
        this.retryCounters.clear();
        this.emit('reset');
    }
}

// Función wrapper para manejo automático de errores
function withErrorHandling(fn, context = {}) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            const handler = context.errorHandler || defaultErrorHandler;
            return await handler.handleError(error, {
                ...context,
                originalFunction: fn,
                args
            });
        }
    };
}

// Instancia por defecto
const defaultErrorHandler = new ErrorHandler();

export {
    ErrorHandler,
    withErrorHandling,
    defaultErrorHandler
};