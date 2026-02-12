/**
 * Servicio de Aprobación de Plantillas
 * Gestiona el proceso de aprobación de plantillas antes del envío
 */

import fs from 'fs/promises';
import path from 'path';

class TemplateApprovalService {
  constructor() {
    this.pendingTemplates = new Map();
    this.approvedTemplates = new Map();
    this.rejectedTemplates = new Map();
    this.approvalQueue = [];
    this.dataPath = path.join(process.cwd(), 'apps/api/src/data/template-approvals.json');
    this.init();
  }

  async init() {
    try {
      await this.loadApprovalData();
      console.log('TemplateApprovalService inicializado');
    } catch (error) {
      console.error('Error inicializando TemplateApprovalService:', error);
    }
  }

  // Cargar datos de aprobaciones desde archivo
  async loadApprovalData() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      const approvalData = JSON.parse(data);

      this.pendingTemplates = new Map(approvalData.pending || []);
      this.approvedTemplates = new Map(approvalData.approved || []);
      this.rejectedTemplates = new Map(approvalData.rejected || []);
      this.approvalQueue = approvalData.queue || [];
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error cargando datos de aprobación:', error);
      }
      // Crear archivo inicial si no existe
      await this.saveApprovalData();
    }
  }

  // Guardar datos de aprobaciones
  async saveApprovalData() {
    try {
      const approvalData = {
        pending: Array.from(this.pendingTemplates.entries()),
        approved: Array.from(this.approvedTemplates.entries()),
        rejected: Array.from(this.rejectedTemplates.entries()),
        queue: this.approvalQueue,
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeFile(this.dataPath, JSON.stringify(approvalData, null, 2));
    } catch (error) {
      console.error('Error guardando datos de aprobación:', error);
    }
  }

  // Solicitar aprobación para una plantilla
  async requestTemplateApproval(templateData, requestedBy) {
    const approvalId = this.generateApprovalId();
    const timestamp = new Date().toISOString();

    const approvalRequest = {
      id: approvalId,
      templateData,
      requestedBy,
      requestedAt: timestamp,
      status: 'pending',
      priority: templateData.priority || 'normal',
      category: templateData.category || 'general',
      estimatedReach: templateData.estimatedReach || 0,
      businessJustification: templateData.businessJustification || '',
      complianceNotes: templateData.complianceNotes || '',
    };

    // Validar plantilla antes de agregar a cola
    const validation = await this.validateTemplate(templateData);
    if (!validation.isValid) {
      throw new Error(`Plantilla inválida: ${validation.errors.join(', ')}`);
    }

    this.pendingTemplates.set(approvalId, approvalRequest);
    this.approvalQueue.push(approvalId);

    await this.saveApprovalData();

    console.log(`Solicitud de aprobación creada: ${approvalId}`);
    return approvalRequest;
  }

  // Validar plantilla
  async validateTemplate(templateData) {
    const errors = [];
    const warnings = [];

    // Validaciones básicas
    if (!templateData.name || templateData.name.trim().length === 0) {
      errors.push('El nombre de la plantilla es requerido');
    }

    if (!templateData.language) {
      errors.push('El idioma de la plantilla es requerido');
    }

    if (!templateData.category) {
      warnings.push('Se recomienda especificar una categoría');
    }

    // Validar componentes de la plantilla
    if (templateData.components && Array.isArray(templateData.components)) {
      for (let i = 0; i < templateData.components.length; i++) {
        const component = templateData.components[i];
        const componentErrors = this.validateTemplateComponent(component, i);
        errors.push(...componentErrors);
      }
    } else {
      errors.push('La plantilla debe tener al menos un componente');
    }

    // Validar cumplimiento de políticas
    const policyValidation = await this.validatePolicyCompliance(templateData);
    errors.push(...policyValidation.errors);
    warnings.push(...policyValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateTemplateScore(templateData, errors, warnings),
    };
  }

  // Validar componente de plantilla
  validateTemplateComponent(component, index) {
    const errors = [];

    if (!component.type) {
      errors.push(`Componente ${index}: tipo requerido`);
      return errors;
    }

    switch (component.type) {
      case 'HEADER':
        if (component.format === 'TEXT' && !component.text) {
          errors.push(`Componente ${index}: texto del header requerido`);
        }
        if (component.format === 'MEDIA' && !component.example) {
          errors.push(
            `Componente ${index}: ejemplo de media requerido para header`
          );
        }
        break;

      case 'BODY':
        if (!component.text) {
          errors.push(`Componente ${index}: texto del body requerido`);
        }
        // Validar variables
        if (component.example && component.example.body_text) {
          const variables = component.text.match(/\{\{\d+\}\}/g) || [];
          const examples = component.example.body_text;
          if (variables.length !== examples.length) {
            errors.push(
              `Componente ${index}: número de variables no coincide con ejemplos`
            );
          }
        }
        break;

      case 'FOOTER':
        if (!component.text) {
          errors.push(`Componente ${index}: texto del footer requerido`);
        }
        break;

      case 'BUTTONS':
        if (!component.buttons || !Array.isArray(component.buttons)) {
          errors.push(`Componente ${index}: botones requeridos`);
        } else {
          component.buttons.forEach((button, btnIndex) => {
            if (!button.type || !button.text) {
              errors.push(
                `Componente ${index}, Botón ${btnIndex}: tipo y texto requeridos`
              );
            }
          });
        }
        break;
    }

    return errors;
  }

  // Validar cumplimiento de políticas
  async validatePolicyCompliance(templateData) {
    const errors = [];
    const warnings = [];

    // Palabras prohibidas
    const prohibitedWords = [
      'gratis',
      'free',
      'urgente',
      'urgent',
      'limitado',
      'limited',
      'oferta especial',
      'special offer',
      'último día',
      'last day',
    ];

    const templateText = this.extractTemplateText(templateData);
    const lowerText = templateText.toLowerCase();

    prohibitedWords.forEach(word => {
      if (lowerText.includes(word.toLowerCase())) {
        warnings.push(
          `Palabra potencialmente problemática detectada: "${word}"`
        );
      }
    });

    // Validar longitud de texto
    if (templateText.length > 1024) {
      errors.push(
        'El texto de la plantilla excede el límite de 1024 caracteres'
      );
    }

    // Validar formato de URLs
    const urls = templateText.match(/(https?:\/\/[^\s]+)/g) || [];
    urls.forEach(url => {
      if (!this.isValidUrl(url)) {
        errors.push(`URL inválida detectada: ${url}`);
      }
    });

    // Validar contenido sensible
    const sensitivePatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Números de tarjeta
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /password|contraseña/i, // Contraseñas
    ];

    sensitivePatterns.forEach(pattern => {
      if (pattern.test(templateText)) {
        errors.push('Contenido sensible detectado en la plantilla');
      }
    });

    return { errors, warnings };
  }

  // Extraer todo el texto de la plantilla
  extractTemplateText(templateData) {
    let text = '';

    if (templateData.components) {
      templateData.components.forEach(component => {
        if (component.text) {
          text += component.text + ' ';
        }
        if (component.buttons) {
          component.buttons.forEach(button => {
            if (button.text) {
              text += button.text + ' ';
            }
          });
        }
      });
    }

    return text.trim();
  }

  // Validar URL
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Calcular puntuación de plantilla
  calculateTemplateScore(templateData, errors, warnings) {
    let score = 100;

    // Penalizar errores
    score -= errors.length * 20;

    // Penalizar advertencias
    score -= warnings.length * 5;

    // Bonificar buenas prácticas
    if (
      templateData.businessJustification &&
      templateData.businessJustification.length > 50
    ) {
      score += 10;
    }

    if (
      templateData.complianceNotes &&
      templateData.complianceNotes.length > 20
    ) {
      score += 5;
    }

    if (templateData.category && templateData.category !== 'general') {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Aprobar plantilla
  async approveTemplate(approvalId, approvedBy, notes = '') {
    const pendingTemplate = this.pendingTemplates.get(approvalId);

    if (!pendingTemplate) {
      throw new Error('Solicitud de aprobación no encontrada');
    }

    const approvedTemplate = {
      ...pendingTemplate,
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      approvalNotes: notes,
    };

    this.approvedTemplates.set(approvalId, approvedTemplate);
    this.pendingTemplates.delete(approvalId);

    // Remover de cola
    const queueIndex = this.approvalQueue.indexOf(approvalId);
    if (queueIndex > -1) {
      this.approvalQueue.splice(queueIndex, 1);
    }

    await this.saveApprovalData();

    console.log(`Plantilla aprobada: ${approvalId} por ${approvedBy}`);
    return approvedTemplate;
  }

  // Rechazar plantilla
  async rejectTemplate(approvalId, rejectedBy, reason) {
    const pendingTemplate = this.pendingTemplates.get(approvalId);

    if (!pendingTemplate) {
      throw new Error('Solicitud de aprobación no encontrada');
    }

    const rejectedTemplate = {
      ...pendingTemplate,
      status: 'rejected',
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    };

    this.rejectedTemplates.set(approvalId, rejectedTemplate);
    this.pendingTemplates.delete(approvalId);

    // Remover de cola
    const queueIndex = this.approvalQueue.indexOf(approvalId);
    if (queueIndex > -1) {
      this.approvalQueue.splice(queueIndex, 1);
    }

    await this.saveApprovalData();

    console.log(`Plantilla rechazada: ${approvalId} por ${rejectedBy}`);
    return rejectedTemplate;
  }

  // Obtener plantillas pendientes
  getPendingTemplates() {
    return Array.from(this.pendingTemplates.values()).sort((a, b) => {
      // Ordenar por prioridad y fecha
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return new Date(a.requestedAt) - new Date(b.requestedAt);
    });
  }

  // Obtener plantillas aprobadas
  getApprovedTemplates() {
    return Array.from(this.approvedTemplates.values());
  }

  // Obtener plantillas rechazadas
  getRejectedTemplates() {
    return Array.from(this.rejectedTemplates.values());
  }

  // Obtener estadísticas
  getApprovalStats() {
    const total =
      this.pendingTemplates.size +
      this.approvedTemplates.size +
      this.rejectedTemplates.size;

    return {
      total,
      pending: this.pendingTemplates.size,
      approved: this.approvedTemplates.size,
      rejected: this.rejectedTemplates.size,
      approvalRate:
        total > 0
          ? ((this.approvedTemplates.size / total) * 100).toFixed(2)
          : 0,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    };
  }

  // Calcular tiempo promedio de procesamiento
  calculateAverageProcessingTime() {
    const processedTemplates = [
      ...Array.from(this.approvedTemplates.values()),
      ...Array.from(this.rejectedTemplates.values()),
    ];

    if (processedTemplates.length === 0) return 0;

    const totalTime = processedTemplates.reduce((sum, template) => {
      const requestTime = new Date(template.requestedAt);
      const processTime = new Date(template.approvedAt || template.rejectedAt);
      return sum + (processTime - requestTime);
    }, 0);

    return Math.round(totalTime / processedTemplates.length / (1000 * 60 * 60)); // Horas
  }

  // Verificar si una plantilla está aprobada
  isTemplateApproved(templateId) {
    return this.approvedTemplates.has(templateId);
  }

  // Obtener plantilla aprobada
  getApprovedTemplate(templateId) {
    return this.approvedTemplates.get(templateId);
  }

  // Generar ID de aprobación
  generateApprovalId() {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Limpiar plantillas antiguas
  async cleanupOldTemplates(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleaned = 0;

    // Limpiar plantillas rechazadas antiguas
    for (const [id, template] of this.rejectedTemplates.entries()) {
      const rejectedDate = new Date(template.rejectedAt);
      if (rejectedDate < cutoffDate) {
        this.rejectedTemplates.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveApprovalData();
      console.log(`Limpiadas ${cleaned} plantillas antiguas`);
    }

    return cleaned;
  }
}

export default TemplateApprovalService;
