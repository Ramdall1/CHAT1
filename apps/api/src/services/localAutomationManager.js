import fs from 'fs-extra';
import path from 'path';

class LocalAutomationManager {
  constructor(dataDir, contactManager, messagingService) {
    this.dataDir = dataDir;
    this.contactManager = contactManager;
    this.messagingService = messagingService;
    this.flowsFile = path.join(dataDir, 'automation_flows.json');
    this.triggersFile = path.join(dataDir, 'automation_triggers.json');
    this.executionsFile = path.join(dataDir, 'automation_executions.json');

    this.flows = new Map();
    this.triggers = new Map();
    this.executions = [];
    this.activeFlows = new Map(); // phone -> { flowId, currentStep, startedAt }

    this.init();
  }

  async init() {
    await fs.ensureDir(this.dataDir);
    await this.loadFlows();
    await this.loadTriggers();
    await this.loadExecutions();
  }

  // ===== GESTIÓN DE FLUJOS =====
  async loadFlows() {
    try {
      if (await fs.pathExists(this.flowsFile)) {
        const data = await fs.readJson(this.flowsFile);
        this.flows = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando flujos:', error.message);
    }
  }

  async saveFlows() {
    try {
      const data = Object.fromEntries(this.flows);
      await fs.writeJson(this.flowsFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando flujos:', error.message);
    }
  }

  createFlow(name, description, steps = []) {
    const flow = {
      id: Date.now().toString(),
      name,
      description,
      steps, // Array de pasos del flujo
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
      },
    };

    this.flows.set(flow.id, flow);
    this.saveFlows();
    return flow;
  }

  updateFlow(flowId, updates) {
    const flow = this.flows.get(flowId);
    if (!flow) return null;

    const updated = {
      ...flow,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.flows.set(flowId, updated);
    this.saveFlows();
    return updated;
  }

  getFlow(flowId) {
    return this.flows.get(flowId) || null;
  }

  getAllFlows() {
    return Array.from(this.flows.values());
  }

  deleteFlow(flowId) {
    const deleted = this.flows.delete(flowId);
    if (deleted) {
      this.saveFlows();
    }
    return deleted;
  }

  // ===== GESTIÓN DE TRIGGERS =====
  async loadTriggers() {
    try {
      if (await fs.pathExists(this.triggersFile)) {
        const data = await fs.readJson(this.triggersFile);
        this.triggers = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando triggers:', error.message);
    }
  }

  async saveTriggers() {
    try {
      const data = Object.fromEntries(this.triggers);
      await fs.writeJson(this.triggersFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando triggers:', error.message);
    }
  }

  createTrigger(name, type, conditions, flowId) {
    const trigger = {
      id: Date.now().toString(),
      name,
      type, // 'keyword', 'tag_added', 'custom_field_changed', 'time_based', 'webhook'
      conditions, // Condiciones específicas del trigger
      flowId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.triggers.set(trigger.id, trigger);
    this.saveTriggers();
    return trigger;
  }

  getAllTriggers() {
    return Array.from(this.triggers.values());
  }

  deleteTrigger(triggerId) {
    const deleted = this.triggers.delete(triggerId);
    if (deleted) {
      this.saveTriggers();
    }
    return deleted;
  }

  // ===== EJECUCIÓN DE FLUJOS =====
  async executeFlow(flowId, phone, context = {}) {
    const flow = this.getFlow(flowId);
    if (!flow || !flow.isActive) {
      console.log(`❌ Flujo ${flowId} no encontrado o inactivo`);
      return false;
    }

    const execution = {
      id: Date.now().toString(),
      flowId,
      phone,
      startedAt: new Date().toISOString(),
      currentStep: 0,
      context,
      status: 'running',
      steps: [],
    };

    this.activeFlows.set(phone, {
      flowId,
      currentStep: 0,
      startedAt: execution.startedAt,
      executionId: execution.id,
    });

    console.log(`🚀 Iniciando flujo ${flow.name} para ${phone}`);

    try {
      await this.executeNextStep(execution);
      flow.stats.totalExecutions++;
      this.saveFlows();
      return true;
    } catch (error) {
      console.log(`❌ Error ejecutando flujo ${flowId}:`, error.message);
      execution.status = 'failed';
      execution.error = error.message;
      flow.stats.failedExecutions++;
      this.saveFlows();
      this.saveExecution(execution);
      return false;
    }
  }

  async executeNextStep(execution) {
    const flow = this.getFlow(execution.flowId);
    if (!flow || execution.currentStep >= flow.steps.length) {
      // Flujo completado
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      flow.stats.completedExecutions++;
      this.activeFlows.delete(execution.phone);
      this.saveFlows();
      this.saveExecution(execution);
      console.log(`✅ Flujo ${flow.name} completado para ${execution.phone}`);
      return;
    }

    const step = flow.steps[execution.currentStep];
    const stepExecution = {
      stepIndex: execution.currentStep,
      stepType: step.type,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    execution.steps.push(stepExecution);

    try {
      await this.executeStep(step, execution);
      stepExecution.status = 'completed';
      stepExecution.completedAt = new Date().toISOString();

      // Avanzar al siguiente paso
      execution.currentStep++;
      this.activeFlows.get(execution.phone).currentStep = execution.currentStep;

      // Verificar si hay delay antes del siguiente paso
      if (step.delay) {
        setTimeout(() => {
          this.executeNextStep(execution);
        }, step.delay * 1000);
      } else {
        await this.executeNextStep(execution);
      }
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error.message;
      stepExecution.completedAt = new Date().toISOString();
      throw error;
    }
  }

  async executeStep(step, execution) {
    const { phone, context } = execution;

    switch (step.type) {
      case 'send_message':
        await this.executeSendMessage(step, phone, context);
        break;
      case 'send_template':
        await this.executeSendTemplate(step, phone, context);
        break;
      case 'add_tag':
        await this.executeAddTag(step, phone, context);
        break;
      case 'remove_tag':
        await this.executeRemoveTag(step, phone, context);
        break;
      case 'set_custom_field':
        await this.executeSetCustomField(step, phone, context);
        break;
      case 'wait_for_response':
        await this.executeWaitForResponse(step, phone, context);
        break;
      case 'condition':
        await this.executeCondition(step, execution);
        break;
      case 'webhook':
        await this.executeWebhook(step, phone, context);
        break;
      default:
        throw new Error(`Tipo de paso no soportado: ${step.type}`);
    }
  }

  async executeSendMessage(step, phone, context) {
    let message = step.message;

    // Reemplazar variables en el mensaje
    message = this.replaceVariables(message, phone, context);

    if (this.messagingService && this.messagingService.sendText) {
      await this.messagingService.sendText(phone, message);
    } else {
      console.log(`📱 Mensaje a ${phone}: ${message}`);
    }
  }

  async executeSendTemplate(step, phone, context) {
    const variables = step.variables || [];
    const processedVariables = variables.map(variable =>
      this.replaceVariables(variable, phone, context)
    );

    if (this.messagingService && this.messagingService.sendTemplate) {
      await this.messagingService.sendTemplate({
        to: phone,
        name: step.templateName,
        languageCode: step.languageCode || 'es',
        components: [
          {
            type: 'body',
            parameters: processedVariables.map(v => ({
              type: 'text',
              text: v,
            })),
          },
        ],
      });
    } else {
      console.log(
        `📋 Plantilla ${step.templateName} a ${phone} con variables:`,
        processedVariables
      );
    }
  }

  async executeAddTag(step, phone, context) {
    const tagName = this.replaceVariables(step.tagName, phone, context);
    this.contactManager.addTagToContact(phone, tagName);
    console.log(`🏷️ Etiqueta "${tagName}" agregada a ${phone}`);
  }

  async executeRemoveTag(step, phone, context) {
    const tagName = this.replaceVariables(step.tagName, phone, context);
    this.contactManager.removeTagFromContact(phone, tagName);
    console.log(`🗑️ Etiqueta "${tagName}" removida de ${phone}`);
  }

  async executeSetCustomField(step, phone, context) {
    const fieldName = step.fieldName;
    const fieldValue = this.replaceVariables(step.fieldValue, phone, context);
    this.contactManager.setCustomFieldValue(phone, fieldName, fieldValue);
    console.log(`📝 Campo "${fieldName}" = "${fieldValue}" para ${phone}`);
  }

  async executeWaitForResponse(step, phone, context) {
    // Este paso pausa el flujo hasta recibir una respuesta del usuario
    const activeFlow = this.activeFlows.get(phone);
    if (activeFlow) {
      activeFlow.waitingForResponse = true;
      activeFlow.expectedResponseType = step.expectedType || 'any';
      activeFlow.timeout = step.timeout || 3600; // 1 hora por defecto
    }
    console.log(`⏳ Esperando respuesta de ${phone}`);
  }

  async executeCondition(step, execution) {
    const { phone, context } = execution;
    const contact = this.contactManager.getContact(phone);

    let conditionMet = false;

    switch (step.condition.type) {
      case 'has_tag':
        conditionMet = contact && contact.tags.includes(step.condition.value);
        break;
      case 'custom_field_equals':
        conditionMet =
          contact &&
          contact.customFields?.[step.condition.field] === step.condition.value;
        break;
      case 'context_equals':
        conditionMet = context[step.condition.field] === step.condition.value;
        break;
    }

    if (conditionMet && step.trueSteps) {
      // Ejecutar pasos si la condición es verdadera
      for (const trueStep of step.trueSteps) {
        await this.executeStep(trueStep, execution);
      }
    } else if (!conditionMet && step.falseSteps) {
      // Ejecutar pasos si la condición es falsa
      for (const falseStep of step.falseSteps) {
        await this.executeStep(falseStep, execution);
      }
    }
  }

  async executeWebhook(step, phone, context) {
    const payload = {
      phone,
      context,
      timestamp: new Date().toISOString(),
      ...step.payload,
    };

    // Aquí se podría implementar la llamada al webhook
    console.log(`🔗 Webhook a ${step.url} con payload:`, payload);
  }

  // ===== PROCESAMIENTO DE TRIGGERS =====
  async processTriggers(eventType, data) {
    const activeTriggers = Array.from(this.triggers.values()).filter(
      trigger => trigger.isActive && trigger.type === eventType
    );

    for (const trigger of activeTriggers) {
      if (await this.evaluateTriggerConditions(trigger, data)) {
        console.log(`🎯 Trigger "${trigger.name}" activado`);
        await this.executeFlow(trigger.flowId, data.phone, data);
      }
    }
  }

  async evaluateTriggerConditions(trigger, data) {
    switch (trigger.type) {
      case 'keyword':
        return (
          data.message &&
          trigger.conditions.keywords.some(keyword =>
            data.message.toLowerCase().includes(keyword.toLowerCase())
          )
        );

      case 'tag_added':
        return data.tagName === trigger.conditions.tagName;

      case 'custom_field_changed':
        return data.fieldName === trigger.conditions.fieldName;

      case 'time_based':
        // Implementar lógica de tiempo
        return true;

      default:
        return false;
    }
  }

  // ===== MANEJO DE RESPUESTAS =====
  async handleUserResponse(phone, message) {
    const activeFlow = this.activeFlows.get(phone);
    if (!activeFlow || !activeFlow.waitingForResponse) {
      return false;
    }

    // Procesar la respuesta y continuar el flujo
    const execution = this.executions.find(
      e => e.id === activeFlow.executionId
    );
    if (execution) {
      execution.context.lastResponse = message;
      activeFlow.waitingForResponse = false;

      // Continuar con el siguiente paso
      execution.currentStep++;
      activeFlow.currentStep = execution.currentStep;
      await this.executeNextStep(execution);
    }

    return true;
  }

  // ===== UTILIDADES =====
  replaceVariables(text, phone, context) {
    if (!text) return text;

    const contact = this.contactManager.getContact(phone);
    const variables = {
      phone,
      name: contact?.name || 'Usuario',
      email: contact?.email || '',
      ...context,
      ...(contact?.customFields || {}),
    };

    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] || match;
    });
  }

  async saveExecution(execution) {
    this.executions.push(execution);

    // Mantener solo las últimas 1000 ejecuciones
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-1000);
    }

    try {
      await fs.writeJson(this.executionsFile, this.executions, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando ejecuciones:', error.message);
    }
  }

  async loadExecutions() {
    try {
      if (await fs.pathExists(this.executionsFile)) {
        this.executions = await fs.readJson(this.executionsFile);
      }
    } catch (error) {
      console.log('⚠️ Error cargando ejecuciones:', error.message);
    }
  }

  getFlowStats(flowId) {
    const flow = this.getFlow(flowId);
    if (!flow) return null;

    const executions = this.executions.filter(e => e.flowId === flowId);
    const recentExecutions = executions.filter(e => {
      const executionDate = new Date(e.startedAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return executionDate > weekAgo;
    });

    return {
      ...flow.stats,
      recentExecutions: recentExecutions.length,
      averageCompletionTime: this.calculateAverageCompletionTime(executions),
      successRate:
        flow.stats.totalExecutions > 0
          ? (flow.stats.completedExecutions / flow.stats.totalExecutions) * 100
          : 0,
    };
  }

  calculateAverageCompletionTime(executions) {
    const completedExecutions = executions.filter(
      e => e.status === 'completed'
    );
    if (completedExecutions.length === 0) return 0;

    const totalTime = completedExecutions.reduce((sum, execution) => {
      const start = new Date(execution.startedAt);
      const end = new Date(execution.completedAt);
      return sum + (end - start);
    }, 0);

    return Math.round(totalTime / completedExecutions.length / 1000); // en segundos
  }
}

export default LocalAutomationManager;
