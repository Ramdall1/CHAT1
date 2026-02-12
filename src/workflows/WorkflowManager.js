/**
 * Workflow Manager Service
 * Gestiona flujos de trabajo y automatizaciones
 */

import { EventEmitter } from 'events';

export class WorkflowManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxConcurrentWorkflows: 10,
            defaultTimeout: 300000, // 5 minutos
            retryAttempts: 3,
            retryDelay: 1000,
            enablePersistence: true,
            ...config
        };
        
        this.workflows = new Map();
        this.instances = new Map();
        this.triggers = new Map();
        this.actions = new Map();
        this.conditions = new Map();
        this.running = new Set();
        
        this.stats = {
            executed: 0,
            successful: 0,
            failed: 0,
            active: 0,
            totalSteps: 0
        };
        
        this.setupDefaultActions();
        this.setupDefaultConditions();
        this.setupDefaultTriggers();
    }

    /**
     * Configura acciones por defecto
     */
    setupDefaultActions() {
        // Acción de envío de mensaje
        this.registerAction('send_message', {
            name: 'Enviar Mensaje',
            description: 'Envía un mensaje al usuario',
            inputs: ['message', 'recipient', 'channel'],
            execute: async (context, params) => {
                logger.info(`Sending message: ${params.message} to ${params.recipient}`);
                return { success: true, messageId: this.generateId() };
            }
        });
        
        // Acción de delay
        this.registerAction('delay', {
            name: 'Esperar',
            description: 'Pausa la ejecución por un tiempo determinado',
            inputs: ['duration'],
            execute: async (context, params) => {
                const duration = params.duration || 1000;
                await new Promise(resolve => setTimeout(resolve, duration));
                return { success: true, waited: duration };
            }
        });
        
        // Acción de log
        this.registerAction('log', {
            name: 'Registrar Log',
            description: 'Registra información en los logs',
            inputs: ['message', 'level'],
            execute: async (context, params) => {
                const level = params.level || 'info';
                logger.info(`[${level.toUpperCase()}] ${params.message}`);
                return { success: true, logged: true };
            }
        });
        
        // Acción de webhook
        this.registerAction('webhook', {
            name: 'Llamar Webhook',
            description: 'Realiza una llamada HTTP a un webhook',
            inputs: ['url', 'method', 'data', 'headers'],
            execute: async (context, params) => {
                logger.info(`Calling webhook: ${params.method || 'POST'} ${params.url}`);
                // En producción usar axios
                return { success: true, status: 200, response: 'OK' };
            }
        });
        
        // Acción de actualizar datos
        this.registerAction('update_data', {
            name: 'Actualizar Datos',
            description: 'Actualiza datos en el contexto',
            inputs: ['key', 'value'],
            execute: async (context, params) => {
                context.data[params.key] = params.value;
                return { success: true, updated: params.key };
            }
        });
        
        // Acción de notificación
        this.registerAction('notify', {
            name: 'Enviar Notificación',
            description: 'Envía una notificación del sistema',
            inputs: ['type', 'message', 'recipients'],
            execute: async (context, params) => {
                logger.info(`Notification [${params.type}]: ${params.message}`);
                return { success: true, notified: true };
            }
        });
    }

    /**
     * Configura condiciones por defecto
     */
    setupDefaultConditions() {
        // Condición de comparación
        this.registerCondition('compare', {
            name: 'Comparar Valores',
            description: 'Compara dos valores',
            inputs: ['value1', 'operator', 'value2'],
            evaluate: (context, params) => {
                const { value1, operator, value2 } = params;
                
                switch (operator) {
                    case '==': return value1 == value2;
                    case '===': return value1 === value2;
                    case '!=': return value1 != value2;
                    case '!==': return value1 !== value2;
                    case '>': return value1 > value2;
                    case '>=': return value1 >= value2;
                    case '<': return value1 < value2;
                    case '<=': return value1 <= value2;
                    case 'contains': return String(value1).includes(value2);
                    case 'startsWith': return String(value1).startsWith(value2);
                    case 'endsWith': return String(value1).endsWith(value2);
                    default: return false;
                }
            }
        });
        
        // Condición de existencia
        this.registerCondition('exists', {
            name: 'Verificar Existencia',
            description: 'Verifica si un valor existe',
            inputs: ['key'],
            evaluate: (context, params) => {
                return context.data[params.key] !== undefined && context.data[params.key] !== null;
            }
        });
        
        // Condición de tiempo
        this.registerCondition('time_range', {
            name: 'Rango de Tiempo',
            description: 'Verifica si la hora actual está en un rango',
            inputs: ['startTime', 'endTime'],
            evaluate: (context, params) => {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                
                const [startHour, startMin] = params.startTime.split(':').map(Number);
                const [endHour, endMin] = params.endTime.split(':').map(Number);
                
                const startTime = startHour * 60 + startMin;
                const endTime = endHour * 60 + endMin;
                
                return currentTime >= startTime && currentTime <= endTime;
            }
        });
        
        // Condición de día de semana
        this.registerCondition('day_of_week', {
            name: 'Día de la Semana',
            description: 'Verifica el día de la semana',
            inputs: ['days'],
            evaluate: (context, params) => {
                const today = new Date().getDay(); // 0 = domingo
                const allowedDays = Array.isArray(params.days) ? params.days : [params.days];
                return allowedDays.includes(today);
            }
        });
    }

    /**
     * Configura triggers por defecto
     */
    setupDefaultTriggers() {
        // Trigger de mensaje recibido
        this.registerTrigger('message_received', {
            name: 'Mensaje Recibido',
            description: 'Se activa cuando se recibe un mensaje',
            events: ['message:received']
        });
        
        // Trigger de usuario nuevo
        this.registerTrigger('user_registered', {
            name: 'Usuario Registrado',
            description: 'Se activa cuando se registra un nuevo usuario',
            events: ['user:registered']
        });
        
        // Trigger de error
        this.registerTrigger('error_occurred', {
            name: 'Error Ocurrido',
            description: 'Se activa cuando ocurre un error',
            events: ['error:occurred']
        });
        
        // Trigger de tiempo
        this.registerTrigger('scheduled', {
            name: 'Programado',
            description: 'Se activa en horarios programados',
            events: ['time:scheduled']
        });
    }

    /**
     * Registra un nuevo workflow
     * @param {string} id - ID del workflow
     * @param {object} workflow - Definición del workflow
     */
    registerWorkflow(id, workflow) {
        if (!workflow.name || !workflow.steps) {
            throw new Error('Workflow must have name and steps');
        }
        
        const workflowDef = {
            id,
            name: workflow.name,
            description: workflow.description || '',
            version: workflow.version || '1.0.0',
            enabled: workflow.enabled !== false,
            trigger: workflow.trigger,
            steps: workflow.steps,
            timeout: workflow.timeout || this.config.defaultTimeout,
            retryAttempts: workflow.retryAttempts || this.config.retryAttempts,
            variables: workflow.variables || {},
            metadata: workflow.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.workflows.set(id, workflowDef);
        
        // Configurar trigger si existe
        if (workflow.trigger) {
            this.setupWorkflowTrigger(id, workflow.trigger);
        }
        
        this.emit('workflowRegistered', { id, workflow: workflowDef });
        
        return workflowDef;
    }

    /**
     * Ejecuta un workflow
     * @param {string} workflowId - ID del workflow
     * @param {object} context - Contexto inicial
     * @param {object} options - Opciones de ejecución
     * @returns {Promise<object>} Resultado de la ejecución
     */
    async executeWorkflow(workflowId, context = {}, options = {}) {
        const workflow = this.workflows.get(workflowId);
        
        if (!workflow) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }
        
        if (!workflow.enabled) {
            throw new Error(`Workflow '${workflowId}' is disabled`);
        }
        
        // Verificar límite de workflows concurrentes
        if (this.running.size >= this.config.maxConcurrentWorkflows) {
            throw new Error('Maximum concurrent workflows reached');
        }
        
        const instanceId = this.generateId();
        const instance = {
            id: instanceId,
            workflowId,
            status: 'running',
            startedAt: new Date(),
            context: {
                data: { ...workflow.variables, ...context.data },
                user: context.user,
                session: context.session,
                trigger: context.trigger,
                metadata: { ...context.metadata }
            },
            currentStep: 0,
            steps: [],
            result: null,
            error: null,
            timeout: workflow.timeout,
            retryAttempts: workflow.retryAttempts
        };
        
        this.instances.set(instanceId, instance);
        this.running.add(instanceId);
        this.stats.executed++;
        this.stats.active++;
        
        this.emit('workflowStarted', { instanceId, workflowId, context });
        
        try {
            // Configurar timeout con referencia para limpieza
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Workflow timeout')), instance.timeout);
            });
            
            // Almacenar referencia del timeout en la instancia
            instance.timeoutId = timeoutId;
            
            // Ejecutar workflow
            const executionPromise = this.executeSteps(instance, workflow.steps);
            
            const result = await Promise.race([executionPromise, timeoutPromise]);
            
            // Limpiar timeout si el workflow completó antes
            if (timeoutId) {
                clearTimeout(timeoutId);
                instance.timeoutId = null;
            }
            
            instance.status = 'completed';
            instance.result = result;
            instance.completedAt = new Date();
            
            this.stats.successful++;
            this.emit('workflowCompleted', { instanceId, result });
            
            return {
                instanceId,
                status: instance.status,
                result,
                startedAt: instance.startedAt,
                completedAt: instance.completedAt
            };
            
        } catch (error) {
            // Limpiar timeout en caso de error
            if (instance.timeoutId) {
                clearTimeout(instance.timeoutId);
                instance.timeoutId = null;
            }
            
            instance.status = 'failed';
            instance.error = error.message;
            instance.completedAt = new Date();
            
            this.stats.failed++;
            this.emit('workflowFailed', { instanceId, error });
            
            throw error;
            
        } finally {
            this.running.delete(instanceId);
            this.stats.active--;
        }
    }

    /**
     * Ejecuta los pasos del workflow
     * @param {object} instance - Instancia del workflow
     * @param {array} steps - Pasos a ejecutar
     * @returns {Promise<object>} Resultado
     */
    async executeSteps(instance, steps) {
        const results = [];
        
        for (let i = 0; i < steps.length; i++) {
            // Verificar si el workflow ha sido detenido
            if (instance.status === 'stopped') {
                throw new Error(instance.error || 'Workflow stopped');
            }
            
            const step = steps[i];
            instance.currentStep = i;
            
            this.emit('stepStarted', { instanceId: instance.id, step, index: i });
            
            try {
                const stepResult = await this.executeStep(instance, step);
                
                results.push({
                    step: step.name || `Step ${i + 1}`,
                    success: true,
                    result: stepResult,
                    executedAt: new Date()
                });
                
                instance.steps.push(results[results.length - 1]);
                this.stats.totalSteps++;
                
                this.emit('stepCompleted', { instanceId: instance.id, step, result: stepResult });
                
                // Verificar si el paso indica que se debe detener
                if (stepResult && stepResult.stop) {
                    break;
                }
                
            } catch (error) {
                const stepError = {
                    step: step.name || `Step ${i + 1}`,
                    success: false,
                    error: error.message,
                    executedAt: new Date()
                };
                
                results.push(stepError);
                instance.steps.push(stepError);
                
                this.emit('stepFailed', { instanceId: instance.id, step, error });
                
                // Si el paso es crítico, detener ejecución
                if (step.critical !== false) {
                    throw error;
                }
            }
        }
        
        return {
            success: true,
            steps: results,
            totalSteps: results.length,
            successfulSteps: results.filter(r => r.success).length,
            failedSteps: results.filter(r => !r.success).length
        };
    }

    /**
     * Ejecuta un paso individual
     * @param {object} instance - Instancia del workflow
     * @param {object} step - Paso a ejecutar
     * @returns {Promise<any>} Resultado del paso
     */
    async executeStep(instance, step) {
        // Verificar si el workflow ha sido detenido
        if (instance.status === 'stopped') {
            throw new Error(instance.error || 'Workflow stopped');
        }
        
        // Verificar condiciones si existen
        if (step.condition && !this.evaluateCondition(instance.context, step.condition)) {
            return { skipped: true, reason: 'Condition not met' };
        }
        
        // Ejecutar según el tipo de paso
        switch (step.type) {
            case 'action':
                // Agregar instanceId al contexto
                const contextWithId = { ...instance.context, instanceId: instance.id };
                return await this.executeAction(contextWithId, step);
                
            case 'condition':
                return this.evaluateCondition(instance.context, step);
                
            case 'parallel':
                return await this.executeParallelSteps(instance, step.steps || []);
                
            case 'loop':
                return await this.executeLoop(instance, step);
                
            case 'switch':
                return await this.executeSwitch(instance, step);
                
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }

    /**
     * Ejecuta una acción
     * @param {object} context - Contexto de ejecución
     * @param {object} step - Paso de acción
     * @returns {Promise<any>} Resultado de la acción
     */
    async executeAction(context, step) {
        const action = this.actions.get(step.action);
        
        if (!action) {
            throw new Error(`Action '${step.action}' not found`);
        }
        
        // Preparar parámetros
        const params = this.resolveParameters(context, step.params || {});
        
        // Ejecutar acción
        const result = await action.execute(context, params);
        
        // Actualizar contexto si la acción devuelve datos
        if (result && typeof result === 'object' && step.outputVariable) {
            context.data[step.outputVariable] = result;
        }
        
        return result;
    }

    /**
     * Evalúa una condición
     * @param {object} context - Contexto de ejecución
     * @param {object} conditionDef - Definición de la condición
     * @returns {boolean} Resultado de la evaluación
     */
    evaluateCondition(context, conditionDef) {
        const condition = this.conditions.get(conditionDef.type);
        
        if (!condition) {
            throw new Error(`Condition '${conditionDef.type}' not found`);
        }
        
        const params = this.resolveParameters(context, conditionDef.params || {});
        
        return condition.evaluate(context, params);
    }

    /**
     * Ejecuta pasos en paralelo
     * @param {object} instance - Instancia del workflow
     * @param {array} steps - Pasos a ejecutar
     * @returns {Promise<array>} Resultados
     */
    async executeParallelSteps(instance, steps) {
        const promises = steps.map(step => this.executeStep(instance, step));
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            step: steps[index].name || `Parallel Step ${index + 1}`,
            success: result.status === 'fulfilled',
            result: result.status === 'fulfilled' ? result.value : undefined,
            error: result.status === 'rejected' ? result.reason.message : undefined
        }));
    }

    /**
     * Ejecuta un bucle
     * @param {object} instance - Instancia del workflow
     * @param {object} step - Paso de bucle
     * @returns {Promise<array>} Resultados
     */
    async executeLoop(instance, step) {
        const results = [];
        const maxIterations = step.maxIterations || 100;
        let iteration = 0;
        
        while (iteration < maxIterations) {
            // Verificar condición de continuación
            if (step.while && !this.evaluateCondition(instance.context, step.while)) {
                break;
            }
            
            // Ejecutar pasos del bucle
            for (const loopStep of step.steps || []) {
                const result = await this.executeStep(instance, loopStep);
                results.push({
                    iteration,
                    step: loopStep.name || 'Loop Step',
                    result
                });
            }
            
            iteration++;
        }
        
        return results;
    }

    /**
     * Ejecuta un switch
     * @param {object} instance - Instancia del workflow
     * @param {object} step - Paso de switch
     * @returns {Promise<any>} Resultado
     */
    async executeSwitch(instance, step) {
        const value = this.resolveValue(instance.context, step.value);
        
        // Buscar caso coincidente
        for (const case_ of step.cases || []) {
            if (case_.value === value || case_.value === '*') {
                return await this.executeSteps(instance, case_.steps || []);
            }
        }
        
        // Ejecutar caso por defecto si existe
        if (step.default) {
            return await this.executeSteps(instance, step.default || []);
        }
        
        return { matched: false };
    }

    /**
     * Resuelve parámetros con variables del contexto
     * @param {object} context - Contexto
     * @param {object} params - Parámetros
     * @returns {object} Parámetros resueltos
     */
    resolveParameters(context, params) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(params)) {
            resolved[key] = this.resolveValue(context, value);
        }
        
        return resolved;
    }

    /**
     * Resuelve un valor con variables del contexto
     * @param {object} context - Contexto
     * @param {any} value - Valor a resolver
     * @returns {any} Valor resuelto
     */
    resolveValue(context, value) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
            const variable = value.slice(2, -2).trim();
            return this.getNestedValue(context.data, variable);
        }
        
        return value;
    }

    /**
     * Obtiene valor anidado de un objeto
     * @param {object} obj - Objeto
     * @param {string} path - Ruta del valor
     * @returns {any} Valor
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Configura trigger para un workflow
     * @param {string} workflowId - ID del workflow
     * @param {object} trigger - Configuración del trigger
     */
    setupWorkflowTrigger(workflowId, trigger) {
        const triggerDef = this.triggers.get(trigger.type);
        
        if (!triggerDef) {
            logger.warn(`Trigger type '${trigger.type}' not found`);
            return;
        }
        
        // Registrar listeners para eventos del trigger
        for (const event of triggerDef.events) {
            this.on(event, (data) => {
                // Verificar condiciones del trigger si existen
                if (trigger.condition) {
                    const context = { data: { ...data, event } };
                    if (!this.evaluateCondition(context, trigger.condition)) {
                        return;
                    }
                }
                
                // Ejecutar workflow
                this.executeWorkflow(workflowId, {
                    data: { ...data, event },
                    trigger: { type: trigger.type, event, data }
                }).catch(error => {
                    logger.error(`Error executing triggered workflow ${workflowId}:`, error);
                });
            });
        }
    }

    /**
     * Registra una acción
     * @param {string} name - Nombre de la acción
     * @param {object} action - Definición de la acción
     */
    registerAction(name, action) {
        if (!action.execute || typeof action.execute !== 'function') {
            throw new Error('Action must have an execute method');
        }
        
        this.actions.set(name, action);
        this.emit('actionRegistered', { name, action });
    }

    /**
     * Registra una condición
     * @param {string} name - Nombre de la condición
     * @param {object} condition - Definición de la condición
     */
    registerCondition(name, condition) {
        if (!condition.evaluate || typeof condition.evaluate !== 'function') {
            throw new Error('Condition must have an evaluate method');
        }
        
        this.conditions.set(name, condition);
        this.emit('conditionRegistered', { name, condition });
    }

    /**
     * Registra un trigger
     * @param {string} name - Nombre del trigger
     * @param {object} trigger - Definición del trigger
     */
    registerTrigger(name, trigger) {
        if (!trigger.events || !Array.isArray(trigger.events)) {
            throw new Error('Trigger must have events array');
        }
        
        this.triggers.set(name, trigger);
        this.emit('triggerRegistered', { name, trigger });
    }

    /**
     * Detiene un workflow en ejecución
     * @param {string} instanceId - ID de la instancia
     * @param {string} reason - Razón de la detención
     */
    stopWorkflow(instanceId, reason = 'Manual stop') {
        const instance = this.instances.get(instanceId);
        
        if (!instance || instance.status !== 'running') {
            throw new Error('Workflow instance not found or not running');
        }
        
        // Limpiar timeout si existe
        if (instance.timeoutId) {
            clearTimeout(instance.timeoutId);
            instance.timeoutId = null;
        }
        
        instance.status = 'stopped';
        instance.error = reason;
        instance.completedAt = new Date();
        
        this.running.delete(instanceId);
        this.stats.active--;
        this.stats.failed++;
        
        this.emit('workflowStopped', { instanceId, reason });
    }

    /**
     * Limpia todos los timeouts activos
     */
    clearAllTimeouts() {
        for (const [instanceId, instance] of this.instances) {
            if (instance.timeoutId) {
                clearTimeout(instance.timeoutId);
                instance.timeoutId = null;
            }
        }
    }

    /**
     * Detiene todos los workflows en ejecución y limpia recursos
     */
    shutdown() {
        // Detener todos los workflows en ejecución
        for (const instanceId of this.running) {
            try {
                this.stopWorkflow(instanceId, 'System shutdown');
            } catch (error) {
                // Ignorar errores durante el shutdown
            }
        }
        
        // Limpiar todos los timeouts
        this.clearAllTimeouts();
        
        // Limpiar colecciones
        this.running.clear();
        this.instances.clear();
        
        this.emit('shutdown');
    }

    /**
     * Obtiene información de un workflow
     * @param {string} workflowId - ID del workflow
     * @returns {object} Información del workflow
     */
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }

    /**
     * Lista todos los workflows
     * @returns {array} Lista de workflows
     */
    listWorkflows() {
        return Array.from(this.workflows.values());
    }

    /**
     * Obtiene instancia de workflow
     * @param {string} instanceId - ID de la instancia
     * @returns {object} Instancia
     */
    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }

    /**
     * Lista instancias de workflow
     * @param {object} filters - Filtros
     * @returns {array} Lista de instancias
     */
    listInstances(filters = {}) {
        let instances = Array.from(this.instances.values());
        
        if (filters.status) {
            instances = instances.filter(i => i.status === filters.status);
        }
        
        if (filters.workflowId) {
            instances = instances.filter(i => i.workflowId === filters.workflowId);
        }
        
        return instances;
    }

    /**
     * Obtiene estadísticas
     * @returns {object} Estadísticas
     */
    getStats() {
        return {
            ...this.stats,
            workflows: this.workflows.size,
            actions: this.actions.size,
            conditions: this.conditions.size,
            triggers: this.triggers.size,
            instances: this.instances.size,
            running: this.running.size
        };
    }

    /**
     * Genera ID único
     * @returns {string} ID único
     */
    generateId() {
        return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Limpia instancias antiguas
     * @param {number} maxAge - Edad máxima en milisegundos
     */
    cleanupInstances(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
        const cutoff = new Date(Date.now() - maxAge);
        let cleaned = 0;
        
        for (const [id, instance] of this.instances) {
            if (instance.status !== 'running' && instance.completedAt && instance.completedAt < cutoff) {
                this.instances.delete(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} old workflow instances`);
        }
        
        return cleaned;
    }
}

// Instancia singleton
const workflowManager = new WorkflowManager();

export default workflowManager;