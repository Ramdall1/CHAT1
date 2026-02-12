/**
 * ServiceManager - Gestor centralizado de servicios para el chatbot
 * Coordina el ciclo de vida y la comunicación entre servicios
 */

import { EventEmitter } from 'events';

class ServiceManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.services = new Map();
        this.dependencies = new Map();
        this.serviceStates = new Map();
        this.startupOrder = [];
        this.shutdownOrder = [];
        this.options = {
            startupTimeout: options.startupTimeout || 30000,
            shutdownTimeout: options.shutdownTimeout || 15000,
            enableHealthChecks: options.enableHealthChecks !== false,
            healthCheckInterval: options.healthCheckInterval || 30000,
            enableAutoRestart: options.enableAutoRestart !== false,
            maxRestartAttempts: options.maxRestartAttempts || 3,
            ...options
        };
        
        this.isStarted = false;
        this.healthCheckTimer = null;
        this.restartAttempts = new Map();
    }

    /**
     * Registra un servicio
     */
    registerService(name, service, dependencies = []) {
        if (this.services.has(name)) {
            throw new Error(`Service ${name} is already registered`);
        }

        // Validar que el servicio tenga los métodos requeridos
        this.validateService(service, name);

        this.services.set(name, service);
        this.dependencies.set(name, dependencies);
        this.serviceStates.set(name, 'registered');
        this.restartAttempts.set(name, 0);

        // Calcular orden de inicio
        this.calculateStartupOrder();

        this.emit('serviceRegistered', { name, dependencies });

        return this;
    }

    /**
     * Desregistra un servicio
     */
    unregisterService(name) {
        if (!this.services.has(name)) {
            return false;
        }

        // Detener el servicio si está corriendo
        if (this.serviceStates.get(name) === 'running') {
            this.stopService(name);
        }

        this.services.delete(name);
        this.dependencies.delete(name);
        this.serviceStates.delete(name);
        this.restartAttempts.delete(name);

        // Recalcular orden de inicio
        this.calculateStartupOrder();

        this.emit('serviceUnregistered', { name });

        return true;
    }

    /**
     * Inicia todos los servicios
     */
    async startAll() {
        if (this.isStarted) {
            throw new Error('Services are already started');
        }

        try {
            this.emit('startupBegin');

            for (const serviceName of this.startupOrder) {
                await this.startService(serviceName);
            }

            this.isStarted = true;

            if (this.options.enableHealthChecks) {
                this.startHealthChecks();
            }

            this.emit('startupComplete');

        } catch (error) {
            this.emit('startupError', { error });
            throw error;
        }
    }

    /**
     * Detiene todos los servicios
     */
    async stopAll() {
        if (!this.isStarted) {
            return;
        }

        try {
            this.emit('shutdownBegin');

            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
                this.healthCheckTimer = null;
            }

            // Detener en orden inverso
            for (const serviceName of this.shutdownOrder) {
                await this.stopService(serviceName);
            }

            this.isStarted = false;

            this.emit('shutdownComplete');

        } catch (error) {
            this.emit('shutdownError', { error });
            throw error;
        }
    }

    /**
     * Inicia un servicio específico
     */
    async startService(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found`);
        }

        const currentState = this.serviceStates.get(name);
        if (currentState === 'running') {
            return;
        }

        if (currentState === 'starting') {
            throw new Error(`Service ${name} is already starting`);
        }

        try {
            this.serviceStates.set(name, 'starting');
            this.emit('serviceStarting', { name });

            // Verificar dependencias
            await this.ensureDependencies(name);

            // Iniciar el servicio con timeout
            await this.withTimeout(
                service.start ? service.start() : Promise.resolve(),
                this.options.startupTimeout,
                `Service ${name} startup timeout`
            );

            this.serviceStates.set(name, 'running');
            this.restartAttempts.set(name, 0);

            this.emit('serviceStarted', { name });

        } catch (error) {
            this.serviceStates.set(name, 'failed');
            this.emit('serviceStartError', { name, error });
            throw error;
        }
    }

    /**
     * Detiene un servicio específico
     */
    async stopService(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found`);
        }

        const currentState = this.serviceStates.get(name);
        if (currentState === 'stopped') {
            return;
        }

        if (currentState === 'stopping') {
            throw new Error(`Service ${name} is already stopping`);
        }

        try {
            this.serviceStates.set(name, 'stopping');
            this.emit('serviceStopping', { name });

            // Detener el servicio con timeout
            await this.withTimeout(
                service.stop ? service.stop() : Promise.resolve(),
                this.options.shutdownTimeout,
                `Service ${name} shutdown timeout`
            );

            this.serviceStates.set(name, 'stopped');

            this.emit('serviceStopped', { name });

        } catch (error) {
            this.serviceStates.set(name, 'failed');
            this.emit('serviceStopError', { name, error });
            throw error;
        }
    }

    /**
     * Reinicia un servicio
     */
    async restartService(name) {
        await this.stopService(name);
        await this.startService(name);
        
        this.emit('serviceRestarted', { name });
    }

    /**
     * Obtiene el estado de un servicio
     */
    getServiceState(name) {
        return this.serviceStates.get(name) || 'unknown';
    }

    /**
     * Obtiene información de todos los servicios
     */
    getServicesInfo() {
        const info = {};
        
        for (const [name, service] of this.services) {
            info[name] = {
                state: this.serviceStates.get(name),
                dependencies: this.dependencies.get(name),
                restartAttempts: this.restartAttempts.get(name),
                hasHealthCheck: typeof service.healthCheck === 'function',
                hasStart: typeof service.start === 'function',
                hasStop: typeof service.stop === 'function'
            };
        }
        
        return info;
    }

    /**
     * Verifica la salud de un servicio
     */
    async checkServiceHealth(name) {
        const service = this.services.get(name);
        if (!service || !service.healthCheck) {
            return { healthy: true, reason: 'No health check available' };
        }

        try {
            const result = await service.healthCheck();
            return { healthy: true, result };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Verifica la salud de todos los servicios
     */
    async checkAllHealth() {
        const healthResults = {};
        
        for (const [name] of this.services) {
            if (this.serviceStates.get(name) === 'running') {
                healthResults[name] = await this.checkServiceHealth(name);
            } else {
                healthResults[name] = { 
                    healthy: false, 
                    reason: `Service is ${this.serviceStates.get(name)}` 
                };
            }
        }
        
        return healthResults;
    }

    /**
     * Obtiene un servicio por nombre
     */
    getService(name) {
        return this.services.get(name);
    }

    /**
     * Verifica si un servicio está corriendo
     */
    isServiceRunning(name) {
        return this.serviceStates.get(name) === 'running';
    }

    /**
     * Obtiene estadísticas del gestor de servicios
     */
    getStats() {
        const states = {};
        for (const [name, state] of this.serviceStates) {
            states[state] = (states[state] || 0) + 1;
        }

        return {
            totalServices: this.services.size,
            states,
            isStarted: this.isStarted,
            startupOrder: this.startupOrder,
            healthChecksEnabled: this.options.enableHealthChecks,
            autoRestartEnabled: this.options.enableAutoRestart
        };
    }

    /**
     * Valida que un servicio tenga la interfaz correcta
     */
    validateService(service, name) {
        if (!service || typeof service !== 'object') {
            throw new Error(`Service ${name} must be an object`);
        }

        // Los métodos start y stop son opcionales pero deben ser funciones si existen
        if (service.start && typeof service.start !== 'function') {
            throw new Error(`Service ${name}.start must be a function`);
        }

        if (service.stop && typeof service.stop !== 'function') {
            throw new Error(`Service ${name}.stop must be a function`);
        }

        if (service.healthCheck && typeof service.healthCheck !== 'function') {
            throw new Error(`Service ${name}.healthCheck must be a function`);
        }
    }

    /**
     * Calcula el orden de inicio basado en dependencias
     */
    calculateStartupOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (serviceName) => {
            if (visiting.has(serviceName)) {
                throw new Error(`Circular dependency detected involving ${serviceName}`);
            }

            if (visited.has(serviceName)) {
                return;
            }

            visiting.add(serviceName);

            const deps = this.dependencies.get(serviceName) || [];
            for (const dep of deps) {
                if (!this.services.has(dep)) {
                    throw new Error(`Dependency ${dep} for service ${serviceName} not found`);
                }
                visit(dep);
            }

            visiting.delete(serviceName);
            visited.add(serviceName);
            order.push(serviceName);
        };

        for (const serviceName of this.services.keys()) {
            visit(serviceName);
        }

        this.startupOrder = order;
        this.shutdownOrder = [...order].reverse();
    }

    /**
     * Asegura que las dependencias estén corriendo
     */
    async ensureDependencies(serviceName) {
        const deps = this.dependencies.get(serviceName) || [];
        
        for (const dep of deps) {
            const depState = this.serviceStates.get(dep);
            if (depState !== 'running') {
                throw new Error(`Dependency ${dep} for service ${serviceName} is not running (state: ${depState})`);
            }
        }
    }

    /**
     * Inicia los health checks periódicos
     */
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            try {
                const healthResults = await this.checkAllHealth();
                
                for (const [serviceName, health] of Object.entries(healthResults)) {
                    if (!health.healthy && this.options.enableAutoRestart) {
                        await this.handleUnhealthyService(serviceName, health);
                    }
                }
                
                this.emit('healthCheckCompleted', healthResults);
                
            } catch (error) {
                this.emit('healthCheckError', { error });
            }
        }, this.options.healthCheckInterval);
    }

    /**
     * Maneja un servicio no saludable
     */
    async handleUnhealthyService(serviceName, healthResult) {
        const attempts = this.restartAttempts.get(serviceName) || 0;
        
        if (attempts >= this.options.maxRestartAttempts) {
            this.emit('serviceRestartLimitReached', { 
                serviceName, 
                attempts, 
                healthResult 
            });
            return;
        }

        try {
            this.restartAttempts.set(serviceName, attempts + 1);
            
            this.emit('serviceAutoRestarting', { 
                serviceName, 
                attempt: attempts + 1, 
                healthResult 
            });
            
            await this.restartService(serviceName);
            
            this.emit('serviceAutoRestarted', { 
                serviceName, 
                attempt: attempts + 1 
            });
            
        } catch (error) {
            this.emit('serviceAutoRestartFailed', { 
                serviceName, 
                attempt: attempts + 1, 
                error 
            });
        }
    }

    /**
     * Ejecuta una función con timeout
     */
    withTimeout(promise, timeout, errorMessage) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(errorMessage)), timeout)
            )
        ]);
    }
}

// Instancia singleton
const serviceManager = new ServiceManager();

export {
    ServiceManager,
    serviceManager
};