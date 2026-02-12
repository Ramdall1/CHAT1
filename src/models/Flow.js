/**
 * @fileoverview Modelo de Flujo para Base de Datos
 * 
 * Modelo completo para gestión de flujos de conversación con soporte para
 * nodos, transiciones, condiciones, variables y estadísticas de ejecución.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { DataTypes, Model } from '../adapters/SequelizeAdapter.js';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('FLOW_MODEL');

/**
 * Modelo de Flujo
 */
class Flow extends Model {
  /**
   * Inicializar modelo
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false
      },
      
      // Información básica
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      
      version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0'
      },
      
      // Estado del flujo
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'draft', 'archived', 'testing'),
        allowNull: false,
        defaultValue: 'draft'
      },
      
      // Configuración del flujo
      nodes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      
      edges: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      
      variables: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },
      
      // Configuraciones de trigger
      triggerType: {
        type: DataTypes.ENUM('keyword', 'intent', 'event', 'manual', 'webhook', 'schedule'),
        allowNull: false,
        defaultValue: 'manual',
        field: 'trigger_type'
      },
      
      triggerConditions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        field: 'trigger_conditions'
      },
      
      keywords: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
      },
      
      // Configuraciones de canal
      channels: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: ['whatsapp']
      },
      
      // Configuraciones de tiempo
      timeout: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Timeout en segundos'
      },
      
      maxExecutions: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_executions'
      },
      
      // Configuraciones de audiencia
      targetAudience: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        field: 'target_audience'
      },
      
      // Estadísticas
      executionCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'execution_count'
      },
      
      successCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'success_count'
      },
      
      failureCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'failure_count'
      },
      
      completionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'completion_rate'
      },
      
      averageDuration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'average_duration'
      },
      
      lastExecutedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_executed_at'
      },
      
      // Metadatos
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
      },
      
      category: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      
      // Información del creador
      createdBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'created_by'
      },
      
      updatedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'updated_by'
      },
      
      // Configuraciones adicionales
      priority: {
        type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'normal'
      },
      
      isTemplate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_template'
      },
      
      parentFlowId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'parent_flow_id',
        references: {
          model: 'flows',
          key: 'id'
        }
      },
      
      // Configuraciones de validación
      requiresApproval: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'requires_approval'
      },
      
      approvedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'approved_by'
      },
      
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approved_at'
      },
      
      // Configuraciones de programación
      scheduleEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'schedule_enabled'
      },
      
      scheduleConfig: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        field: 'schedule_config'
      }
      
    }, {
      sequelize,
      modelName: 'Flow',
      tableName: 'flows',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      
      // Índices
      indexes: [
        { fields: ['name'] },
        { fields: ['status'] },
        { fields: ['trigger_type'] },
        { fields: ['category'] },
        { fields: ['created_by'] },
        { fields: ['parent_flow_id'] },
        { fields: ['keywords'], using: 'gin' },
        { fields: ['channels'], using: 'gin' },
        { fields: ['tags'], using: 'gin' },
        { fields: ['execution_count'] },
        { fields: ['last_executed_at'] },
        { fields: ['created_at'] }
      ],
      
      // Hooks
      hooks: {
        beforeValidate: (flow) => {
          // Normalizar nombre
          if (flow.name) {
            flow.name = flow.name.trim();
          }
          
          // Validar estructura de nodos
          if (flow.nodes && flow.nodes.length > 0) {
            Flow.validateNodes(flow.nodes);
          }
          
          // Validar estructura de edges
          if (flow.edges && flow.edges.length > 0) {
            Flow.validateEdges(flow.edges, flow.nodes);
          }
        },
        
        beforeCreate: (flow) => {
          // Establecer nodo inicial si no existe
          if (!flow.nodes.find(node => node.type === 'start')) {
            flow.nodes.unshift({
              id: 'start',
              type: 'start',
              position: { x: 100, y: 100 },
              data: { label: 'Inicio' }
            });
          }
        },
        
        afterCreate: (flow) => {
          logger.info(`🔄 Flujo creado: ${flow.name} (${flow.triggerType})`);
        },
        
        afterUpdate: (flow) => {
          if (flow.changed('status')) {
            logger.info(`📝 Estado de flujo actualizado: ${flow.name} -> ${flow.status}`);
          }
        }
      }
    });
  }

  /**
   * Definir asociaciones
   */
  static associate(models) {
    // Un flujo puede tener muchas ejecuciones
    Flow.hasMany(models.FlowExecution, {
      foreignKey: 'flow_id',
      as: 'executions'
    });
    
    // Un flujo puede tener un flujo padre (para subflujos)
    Flow.belongsTo(Flow, {
      foreignKey: 'parent_flow_id',
      as: 'parentFlow'
    });
    
    // Un flujo puede tener muchos flujos hijos
    Flow.hasMany(Flow, {
      foreignKey: 'parent_flow_id',
      as: 'childFlows'
    });
  }

  /**
   * Validar estructura de nodos
   */
  static validateNodes(nodes) {
    const requiredFields = ['id', 'type'];
    const validTypes = [
      'start', 'end', 'message', 'question', 'condition', 
      'action', 'webhook', 'delay', 'template', 'human_handoff'
    ];
    
    for (const node of nodes) {
      // Verificar campos requeridos
      for (const field of requiredFields) {
        if (!node[field]) {
          throw new Error(`Nodo ${node.id || 'desconocido'} debe tener el campo ${field}`);
        }
      }
      
      // Verificar tipo válido
      if (!validTypes.includes(node.type)) {
        throw new Error(`Tipo de nodo inválido: ${node.type}`);
      }
      
      // Validaciones específicas por tipo
      switch (node.type) {
        case 'message':
        case 'template':
          if (!node.data || !node.data.content) {
            throw new Error(`Nodo ${node.id} de tipo ${node.type} debe tener contenido`);
          }
          break;
        case 'question':
          if (!node.data || !node.data.question) {
            throw new Error(`Nodo ${node.id} debe tener una pregunta`);
          }
          break;
        case 'condition':
          if (!node.data || !node.data.conditions) {
            throw new Error(`Nodo ${node.id} debe tener condiciones`);
          }
          break;
      }
    }
    
    return true;
  }

  /**
   * Validar estructura de edges
   */
  static validateEdges(edges, nodes) {
    const nodeIds = nodes.map(node => node.id);
    
    for (const edge of edges) {
      // Verificar campos requeridos
      if (!edge.id || !edge.source || !edge.target) {
        throw new Error('Edge debe tener id, source y target');
      }
      
      // Verificar que los nodos existan
      if (!nodeIds.includes(edge.source)) {
        throw new Error(`Nodo source no encontrado: ${edge.source}`);
      }
      
      if (!nodeIds.includes(edge.target)) {
        throw new Error(`Nodo target no encontrado: ${edge.target}`);
      }
    }
    
    return true;
  }

  /**
   * Crear flujo
   */
  static async createFlow(data) {
    // Validar datos básicos
    if (!data.name) {
      throw new Error('El flujo debe tener un nombre');
    }
    
    // Establecer valores por defecto
    const flowData = {
      nodes: [],
      edges: [],
      variables: [],
      ...data
    };
    
    return await Flow.create(flowData);
  }

  /**
   * Buscar flujos por tipo de trigger
   */
  static async findByTriggerType(triggerType, options = {}) {
    return await Flow.findAll({
      where: { 
        triggerType,
        status: options.status || 'active'
      },
      order: options.order || [['execution_count', 'DESC']],
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  }

  /**
   * Buscar flujos por palabra clave
   */
  static async findByKeyword(keyword, options = {}) {
    return await Flow.findAll({
      where: {
        keywords: {
          [sequelize.Op.contains]: [keyword]
        },
        status: options.status || 'active'
      },
      order: options.order || [['priority', 'DESC'], ['execution_count', 'DESC']],
      limit: options.limit || 10
    });
  }

  /**
   * Buscar flujos por canal
   */
  static async findByChannel(channel, options = {}) {
    return await Flow.findAll({
      where: {
        channels: {
          [sequelize.Op.contains]: [channel]
        },
        status: options.status || 'active'
      },
      order: options.order || [['priority', 'DESC']],
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  }

  /**
   * Activar flujo
   */
  async activate() {
    this.status = 'active';
    await this.save();
  }

  /**
   * Desactivar flujo
   */
  async deactivate() {
    this.status = 'inactive';
    await this.save();
  }

  /**
   * Archivar flujo
   */
  async archive() {
    this.status = 'archived';
    await this.save();
  }

  /**
   * Aprobar flujo
   */
  async approve(approvedBy) {
    this.status = 'active';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    await this.save();
  }

  /**
   * Incrementar contador de ejecución
   */
  async incrementExecution(success = true, duration = null) {
    this.executionCount += 1;
    this.lastExecutedAt = new Date();
    
    if (success) {
      this.successCount += 1;
    } else {
      this.failureCount += 1;
    }
    
    // Actualizar tasa de finalización
    this.completionRate = (this.successCount / this.executionCount) * 100;
    
    // Actualizar duración promedio
    if (duration && this.averageDuration) {
      this.averageDuration = Math.floor(
        (this.averageDuration + duration) / 2
      );
    } else if (duration) {
      this.averageDuration = duration;
    }
    
    await this.save();
  }

  /**
   * Agregar nodo
   */
  async addNode(nodeData) {
    // Validar datos del nodo
    if (!nodeData.id || !nodeData.type) {
      throw new Error('El nodo debe tener id y type');
    }
    
    // Verificar que el ID sea único
    if (this.nodes.find(node => node.id === nodeData.id)) {
      throw new Error(`Ya existe un nodo con ID: ${nodeData.id}`);
    }
    
    this.nodes = [...this.nodes, nodeData];
    await this.save();
  }

  /**
   * Actualizar nodo
   */
  async updateNode(nodeId, nodeData) {
    const nodeIndex = this.nodes.findIndex(node => node.id === nodeId);
    
    if (nodeIndex === -1) {
      throw new Error(`Nodo no encontrado: ${nodeId}`);
    }
    
    this.nodes[nodeIndex] = {
      ...this.nodes[nodeIndex],
      ...nodeData,
      id: nodeId // Preservar ID
    };
    
    await this.save();
  }

  /**
   * Eliminar nodo
   */
  async removeNode(nodeId) {
    // Eliminar nodo
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    
    // Eliminar edges relacionados
    this.edges = this.edges.filter(
      edge => edge.source !== nodeId && edge.target !== nodeId
    );
    
    await this.save();
  }

  /**
   * Agregar edge
   */
  async addEdge(edgeData) {
    // Validar datos del edge
    if (!edgeData.id || !edgeData.source || !edgeData.target) {
      throw new Error('El edge debe tener id, source y target');
    }
    
    // Verificar que los nodos existan
    const sourceExists = this.nodes.find(node => node.id === edgeData.source);
    const targetExists = this.nodes.find(node => node.id === edgeData.target);
    
    if (!sourceExists) {
      throw new Error(`Nodo source no encontrado: ${edgeData.source}`);
    }
    
    if (!targetExists) {
      throw new Error(`Nodo target no encontrado: ${edgeData.target}`);
    }
    
    this.edges = [...this.edges, edgeData];
    await this.save();
  }

  /**
   * Eliminar edge
   */
  async removeEdge(edgeId) {
    this.edges = this.edges.filter(edge => edge.id !== edgeId);
    await this.save();
  }

  /**
   * Obtener nodo por ID
   */
  getNode(nodeId) {
    return this.nodes.find(node => node.id === nodeId);
  }

  /**
   * Obtener nodos por tipo
   */
  getNodesByType(type) {
    return this.nodes.filter(node => node.type === type);
  }

  /**
   * Obtener nodo inicial
   */
  getStartNode() {
    return this.nodes.find(node => node.type === 'start');
  }

  /**
   * Obtener nodos finales
   */
  getEndNodes() {
    return this.nodes.filter(node => node.type === 'end');
  }

  /**
   * Obtener siguientes nodos
   */
  getNextNodes(nodeId) {
    const outgoingEdges = this.edges.filter(edge => edge.source === nodeId);
    return outgoingEdges.map(edge => this.getNode(edge.target));
  }

  /**
   * Obtener nodos anteriores
   */
  getPreviousNodes(nodeId) {
    const incomingEdges = this.edges.filter(edge => edge.target === nodeId);
    return incomingEdges.map(edge => this.getNode(edge.source));
  }

  /**
   * Validar flujo completo
   */
  validate() {
    const errors = [];
    
    // Verificar que tenga nodo inicial
    const startNode = this.getStartNode();
    if (!startNode) {
      errors.push('El flujo debe tener un nodo de inicio');
    }
    
    // Verificar que tenga al menos un nodo final
    const endNodes = this.getEndNodes();
    if (endNodes.length === 0) {
      errors.push('El flujo debe tener al menos un nodo final');
    }
    
    // Verificar que todos los nodos estén conectados
    for (const node of this.nodes) {
      if (node.type !== 'start' && node.type !== 'end') {
        const incoming = this.edges.filter(edge => edge.target === node.id);
        const outgoing = this.edges.filter(edge => edge.source === node.id);
        
        if (incoming.length === 0) {
          errors.push(`Nodo ${node.id} no tiene conexiones entrantes`);
        }
        
        if (outgoing.length === 0 && node.type !== 'end') {
          errors.push(`Nodo ${node.id} no tiene conexiones salientes`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Clonar flujo
   */
  async clone(newName, options = {}) {
    const clonedData = {
      name: newName,
      description: options.description || `Copia de ${this.description}`,
      version: '1.0.0',
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
      variables: JSON.parse(JSON.stringify(this.variables)),
      triggerType: this.triggerType,
      triggerConditions: JSON.parse(JSON.stringify(this.triggerConditions)),
      keywords: [...this.keywords],
      channels: [...this.channels],
      timeout: this.timeout,
      targetAudience: JSON.parse(JSON.stringify(this.targetAudience)),
      metadata: { ...this.metadata, clonedFrom: this.id },
      tags: [...this.tags],
      category: this.category,
      priority: this.priority,
      status: 'draft',
      createdBy: options.createdBy
    };
    
    return await Flow.create(clonedData);
  }

  /**
   * Verificar si está activo
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Verificar si necesita aprobación
   */
  needsApproval() {
    return this.requiresApproval && !this.approvedAt;
  }

  /**
   * Verificar si es compatible con canal
   */
  isCompatibleWithChannel(channel) {
    return this.channels.includes(channel);
  }

  /**
   * Obtener tasa de éxito
   */
  getSuccessRate() {
    if (this.executionCount === 0) return 0;
    return (this.successCount / this.executionCount) * 100;
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      executionCount: this.executionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      completionRate: this.completionRate,
      successRate: this.getSuccessRate(),
      averageDuration: this.averageDuration,
      lastExecutedAt: this.lastExecutedAt,
      isActive: this.isActive(),
      needsApproval: this.needsApproval(),
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length
    };
  }

  /**
   * Agregar etiqueta
   */
  async addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags = [...this.tags, tag];
      await this.save();
    }
  }

  /**
   * Remover etiqueta
   */
  async removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    await this.save();
  }

  /**
   * Convertir a JSON para API
   */
  toJSON() {
    const values = Object.assign({}, this.get());
    
    // Agregar campos calculados
    values.stats = this.getStats();
    values.isActive = this.isActive();
    values.needsApproval = this.needsApproval();
    values.successRate = this.getSuccessRate();
    
    return values;
  }

  /**
   * Buscar flujos con filtros avanzados
   */
  static async findWithFilters(filters = {}) {
    const where = {};
    const include = [];
    
    // Filtro por estado
    if (filters.status) {
      where.status = filters.status;
    }
    
    // Filtro por tipo de trigger
    if (filters.triggerType) {
      where.triggerType = filters.triggerType;
    }
    
    // Filtro por categoría
    if (filters.category) {
      where.category = filters.category;
    }
    
    // Filtro por creador
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }
    
    // Filtro por etiquetas
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        [sequelize.Op.overlap]: filters.tags
      };
    }
    
    // Filtro por canales
    if (filters.channels && filters.channels.length > 0) {
      where.channels = {
        [sequelize.Op.overlap]: filters.channels
      };
    }
    
    // Filtro por palabras clave
    if (filters.keywords && filters.keywords.length > 0) {
      where.keywords = {
        [sequelize.Op.overlap]: filters.keywords
      };
    }
    
    // Búsqueda por texto
    if (filters.search) {
      where[sequelize.Op.or] = [
        { name: { [sequelize.Op.iLike]: `%${filters.search}%` } },
        { description: { [sequelize.Op.iLike]: `%${filters.search}%` } }
      ];
    }
    
    // Incluir ejecuciones si se solicita
    if (filters.includeExecutions) {
      include.push({
        association: 'executions',
        limit: 5,
        order: [['created_at', 'DESC']]
      });
    }
    
    return await Flow.findAll({
      where,
      include,
      order: filters.order || [['execution_count', 'DESC']],
      limit: filters.limit || 50,
      offset: filters.offset || 0
    });
  }

  /**
   * Obtener flujos más usados
   */
  static async getMostUsed(limit = 10, filters = {}) {
    const where = {
      status: 'active',
      ...filters
    };
    
    return await Flow.findAll({
      where,
      order: [['execution_count', 'DESC']],
      limit
    });
  }

  /**
   * Obtener estadísticas generales
   */
  static async getGeneralStats(filters = {}) {
    const where = {};
    
    // Aplicar filtros de fecha
    if (filters.dateFrom) {
      where.created_at = { [sequelize.Op.gte]: filters.dateFrom };
    }
    
    if (filters.dateTo) {
      where.created_at = {
        ...where.created_at,
        [sequelize.Op.lte]: filters.dateTo
      };
    }
    
    // Obtener estadísticas
    const stats = await Flow.findAll({
      where,
      attributes: [
        'status',
        'trigger_type',
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('execution_count')), 'totalExecutions'],
        [sequelize.fn('AVG', sequelize.col('completion_rate')), 'avgCompletionRate'],
        [sequelize.fn('AVG', sequelize.col('average_duration')), 'avgDuration']
      ],
      group: ['status', 'trigger_type', 'category'],
      raw: true
    });
    
    return stats;
  }
}

export default Flow;