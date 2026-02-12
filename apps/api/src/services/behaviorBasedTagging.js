import fs from 'fs-extra';
import path from 'path';
import AdvancedTagManager from '../services/core/advancedTagManager.js';
import LocalContactManager from '../services/core/localContactManager.js';

class BehaviorBasedTagging {
  constructor() {
    this.tagManager = new AdvancedTagManager();
    this.contactManager = new LocalContactManager();
    this.dataDir = path.join(process.cwd(), 'data');
    this.rulesFile = path.join(this.dataDir, 'tagging_rules.json');
    this.behaviorFile = path.join(this.dataDir, 'contact_behavior.json');

    this.rules = [];
    this.contactBehavior = new Map();

    this.init();
  }

  async init() {
    await this.loadRules();
    await this.loadBehaviorData();
    await this.createDefaultRules();
  }

  // Cargar reglas de etiquetado
  async loadRules() {
    try {
      if (await fs.pathExists(this.rulesFile)) {
        const data = await fs.readJson(this.rulesFile);
        this.rules = data.rules || [];
      }
    } catch (error) {
      console.error('Error cargando reglas de etiquetado:', error);
      this.rules = [];
    }
  }

  // Guardar reglas de etiquetado
  async saveRules() {
    try {
      await fs.ensureDir(this.dataDir);
      await fs.writeJson(
        this.rulesFile,
        {
          rules: this.rules,
          lastUpdated: new Date().toISOString(),
        },
        { spaces: 2 }
      );
    } catch (error) {
      console.error('Error guardando reglas de etiquetado:', error);
    }
  }

  // Cargar datos de comportamiento
  async loadBehaviorData() {
    try {
      if (await fs.pathExists(this.behaviorFile)) {
        const data = await fs.readJson(this.behaviorFile);
        this.contactBehavior = new Map(Object.entries(data.behavior || {}));
      }
    } catch (error) {
      console.error('Error cargando datos de comportamiento:', error);
      this.contactBehavior = new Map();
    }
  }

  // Guardar datos de comportamiento
  async saveBehaviorData() {
    try {
      await fs.ensureDir(this.dataDir);
      const behaviorObj = Object.fromEntries(this.contactBehavior);
      await fs.writeJson(
        this.behaviorFile,
        {
          behavior: behaviorObj,
          lastUpdated: new Date().toISOString(),
        },
        { spaces: 2 }
      );
    } catch (error) {
      console.error('Error guardando datos de comportamiento:', error);
    }
  }

  // Crear reglas por defecto
  async createDefaultRules() {
    if (this.rules.length === 0) {
      const defaultRules = [
        {
          id: 'new_contact',
          name: 'Contacto Nuevo',
          description: 'Etiquetar contactos nuevos',
          condition: {
            type: 'first_interaction',
            timeframe: 24, // horas
          },
          action: {
            type: 'add_tag',
            tagName: 'Nuevo',
            categoryName: 'Estado',
          },
          active: true,
        },
        {
          id: 'frequent_user',
          name: 'Usuario Frecuente',
          description: 'Contactos con alta frecuencia de mensajes',
          condition: {
            type: 'message_frequency',
            threshold: 10,
            timeframe: 7, // días
          },
          action: {
            type: 'add_tag',
            tagName: 'Frecuente',
            categoryName: 'Actividad',
          },
          active: true,
        },
        {
          id: 'inactive_user',
          name: 'Usuario Inactivo',
          description: 'Contactos sin actividad reciente',
          condition: {
            type: 'last_interaction',
            threshold: 30, // días
            operator: 'greater_than',
          },
          action: {
            type: 'add_tag',
            tagName: 'Inactivo',
            categoryName: 'Estado',
          },
          active: true,
        },
        {
          id: 'vip_user',
          name: 'Usuario VIP',
          description: 'Contactos con alta interacción y engagement',
          condition: {
            type: 'composite',
            conditions: [
              {
                type: 'message_frequency',
                threshold: 20,
                timeframe: 30,
              },
              {
                type: 'response_rate',
                threshold: 0.8,
              },
            ],
            operator: 'and',
          },
          action: {
            type: 'add_tag',
            tagName: 'VIP',
            categoryName: 'Segmento',
          },
          active: true,
        },
        {
          id: 'potential_lead',
          name: 'Lead Potencial',
          description: 'Contactos que muestran interés comercial',
          condition: {
            type: 'keyword_detection',
            keywords: [
              'precio',
              'comprar',
              'cotización',
              'información',
              'servicio',
            ],
            threshold: 3, // menciones
          },
          action: {
            type: 'add_tag',
            tagName: 'Lead',
            categoryName: 'Comercial',
          },
          active: true,
        },
      ];

      this.rules = defaultRules;
      await this.saveRules();
    }
  }

  // Registrar interacción de contacto
  async recordInteraction(phone, interactionData) {
    const now = new Date();

    if (!this.contactBehavior.has(phone)) {
      this.contactBehavior.set(phone, {
        phone,
        firstInteraction: now.toISOString(),
        lastInteraction: now.toISOString(),
        messageCount: 0,
        responseCount: 0,
        keywords: {},
        interactions: [],
      });
    }

    const behavior = this.contactBehavior.get(phone);

    // Actualizar datos básicos
    behavior.lastInteraction = now.toISOString();
    behavior.messageCount += 1;

    if (interactionData.type === 'response') {
      behavior.responseCount += 1;
    }

    // Procesar keywords si hay texto
    if (interactionData.text) {
      this.processKeywords(behavior, interactionData.text);
    }

    // Agregar interacción al historial
    behavior.interactions.push({
      timestamp: now.toISOString(),
      type: interactionData.type,
      text: interactionData.text || '',
      metadata: interactionData.metadata || {},
    });

    // Mantener solo las últimas 100 interacciones
    if (behavior.interactions.length > 100) {
      behavior.interactions = behavior.interactions.slice(-100);
    }

    this.contactBehavior.set(phone, behavior);

    // Evaluar reglas automáticamente
    await this.evaluateRulesForContact(phone);

    // Guardar datos cada 10 interacciones para optimizar rendimiento
    if (behavior.messageCount % 10 === 0) {
      await this.saveBehaviorData();
    }
  }

  // Procesar keywords en el texto
  processKeywords(behavior, text) {
    const words = text.toLowerCase().split(/\s+/);
    words.forEach(word => {
      // Filtrar palabras muy cortas o comunes
      if (
        word.length > 3 &&
        !['para', 'este', 'esta', 'como', 'pero', 'todo', 'todos'].includes(
          word
        )
      ) {
        behavior.keywords[word] = (behavior.keywords[word] || 0) + 1;
      }
    });
  }

  // Evaluar reglas para un contacto específico
  async evaluateRulesForContact(phone) {
    const behavior = this.contactBehavior.get(phone);
    if (!behavior) return;

    for (const rule of this.rules) {
      if (!rule.active) continue;

      const shouldApply = await this.evaluateCondition(
        rule.condition,
        behavior
      );

      if (shouldApply) {
        await this.executeAction(rule.action, phone);
      }
    }
  }

  // Evaluar condición de regla
  async evaluateCondition(condition, behavior) {
    const now = new Date();

    switch (condition.type) {
      case 'first_interaction':
        const firstInteraction = new Date(behavior.firstInteraction);
        const hoursSinceFirst = (now - firstInteraction) / (1000 * 60 * 60);
        return hoursSinceFirst <= condition.timeframe;

      case 'message_frequency':
        const timeframeDays = condition.timeframe;
        const cutoffDate = new Date(now - timeframeDays * 24 * 60 * 60 * 1000);
        const recentMessages = behavior.interactions.filter(
          interaction => new Date(interaction.timestamp) > cutoffDate
        ).length;
        return recentMessages >= condition.threshold;

      case 'last_interaction':
        const lastInteraction = new Date(behavior.lastInteraction);
        const daysSinceLast = (now - lastInteraction) / (1000 * 60 * 60 * 24);

        if (condition.operator === 'greater_than') {
          return daysSinceLast > condition.threshold;
        } else if (condition.operator === 'less_than') {
          return daysSinceLast < condition.threshold;
        }
        return false;

      case 'response_rate':
        const responseRate =
          behavior.responseCount / Math.max(behavior.messageCount, 1);
        return responseRate >= condition.threshold;

      case 'keyword_detection':
        let keywordCount = 0;
        condition.keywords.forEach(keyword => {
          keywordCount += behavior.keywords[keyword.toLowerCase()] || 0;
        });
        return keywordCount >= condition.threshold;

      case 'composite':
        const results = await Promise.all(
          condition.conditions.map(subCondition =>
            this.evaluateCondition(subCondition, behavior)
          )
        );

        if (condition.operator === 'and') {
          return results.every(result => result);
        } else if (condition.operator === 'or') {
          return results.some(result => result);
        }
        return false;

      default:
        return false;
    }
  }

  // Ejecutar acción de regla
  async executeAction(action, phone) {
    switch (action.type) {
      case 'add_tag':
        try {
          // Buscar o crear categoría
          let category = await this.tagManager.getCategoryByName(
            action.categoryName
          );
          if (!category) {
            category = await this.tagManager.createCategory({
              name: action.categoryName,
              color: '#007bff',
            });
          }

          // Buscar o crear etiqueta
          let tag = await this.tagManager.getTagByName(action.tagName);
          if (!tag) {
            tag = await this.tagManager.createTag({
              name: action.tagName,
              categoryId: category.id,
              color: category.color,
            });
          }

          // Agregar etiqueta al contacto
          await this.tagManager.addTagToContact(phone, tag.id);

          console.log(
            `Etiqueta automática aplicada: ${action.tagName} a ${phone}`
          );
        } catch (error) {
          console.error('Error aplicando etiqueta automática:', error);
        }
        break;

      case 'remove_tag':
        try {
          const tag = await this.tagManager.getTagByName(action.tagName);
          if (tag) {
            await this.tagManager.removeTagFromContact(phone, tag.id);
            console.log(
              `Etiqueta automática removida: ${action.tagName} de ${phone}`
            );
          }
        } catch (error) {
          console.error('Error removiendo etiqueta automática:', error);
        }
        break;

      default:
        console.warn('Tipo de acción no reconocido:', action.type);
    }
  }

  // Evaluar todas las reglas para todos los contactos
  async evaluateAllRules() {
    console.log('Iniciando evaluación masiva de reglas de etiquetado...');

    for (const [phone, behavior] of this.contactBehavior) {
      await this.evaluateRulesForContact(phone);
    }

    await this.saveBehaviorData();
    console.log('Evaluación masiva completada');
  }

  // Obtener estadísticas de comportamiento
  getContactStats(phone) {
    const behavior = this.contactBehavior.get(phone);
    if (!behavior) return null;

    const now = new Date();
    const lastInteraction = new Date(behavior.lastInteraction);
    const daysSinceLastInteraction =
      (now - lastInteraction) / (1000 * 60 * 60 * 24);

    return {
      phone,
      messageCount: behavior.messageCount,
      responseCount: behavior.responseCount,
      responseRate: behavior.responseCount / Math.max(behavior.messageCount, 1),
      daysSinceLastInteraction: Math.floor(daysSinceLastInteraction),
      topKeywords: Object.entries(behavior.keywords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count })),
      firstInteraction: behavior.firstInteraction,
      lastInteraction: behavior.lastInteraction,
    };
  }

  // Obtener todas las reglas
  getRules() {
    return this.rules;
  }

  // Crear nueva regla
  async createRule(ruleData) {
    const rule = {
      id: `rule_${Date.now()}`,
      name: ruleData.name,
      description: ruleData.description,
      condition: ruleData.condition,
      action: ruleData.action,
      active: ruleData.active !== false,
      createdAt: new Date().toISOString(),
    };

    this.rules.push(rule);
    await this.saveRules();
    return rule;
  }

  // Actualizar regla
  async updateRule(ruleId, updates) {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error('Regla no encontrada');
    }

    this.rules[ruleIndex] = {
      ...this.rules[ruleIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveRules();
    return this.rules[ruleIndex];
  }

  // Eliminar regla
  async deleteRule(ruleId) {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error('Regla no encontrada');
    }

    this.rules.splice(ruleIndex, 1);
    await this.saveRules();
  }

  // Activar/desactivar regla
  async toggleRule(ruleId, active) {
    return await this.updateRule(ruleId, { active });
  }
}

export default BehaviorBasedTagging;
