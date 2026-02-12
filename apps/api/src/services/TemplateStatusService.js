/**
 * Servicio de Estado de Plantillas para 360Dialog
 * Gestiona el estado de aprobación y seguimiento de plantillas
 */

import fs from 'fs/promises';
import path from 'path';
import { log } from '../core/logger.js';
import {
  VALID_TEMPLATE_STATUSES,
  TEMPLATE_CATEGORIES,
} from '../utils/templateValidation.js';

export class TemplateStatusService {
  constructor() {
    this.approvalsFile = path.join(
      process.cwd(),
      'apps/api/src/data/template-approvals.json'
    );
    this.templatesFile = path.join(process.cwd(), 'data/templates.json');
  }

  /**
   * Obtiene el estado actual de todas las plantillas
   */
  async getTemplateStatuses() {
    try {
      const data = await fs.readFile(this.approvalsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log(`Error leyendo estados de plantillas: ${error.message}`);
      return {
        pending: [],
        approved: [],
        rejected: [],
        queue: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Actualiza el estado de una plantilla
   */
  async updateTemplateStatus(templateName, newStatus, reason = '') {
    try {
      if (!VALID_TEMPLATE_STATUSES.includes(newStatus)) {
        throw new Error(`Estado inválido: ${newStatus}`);
      }

      const statuses = await this.getTemplateStatuses();
      const timestamp = new Date().toISOString();

      // Remover de todos los estados
      Object.keys(statuses).forEach(status => {
        if (Array.isArray(statuses[status])) {
          statuses[status] = statuses[status].filter(
            template => template.name !== templateName
          );
        }
      });

      // Añadir al nuevo estado
      const templateEntry = {
        name: templateName,
        status: newStatus,
        timestamp,
        reason,
      };

      switch (newStatus) {
        case 'PENDING':
          statuses.pending.push(templateEntry);
          break;
        case 'APPROVED':
          statuses.approved.push(templateEntry);
          break;
        case 'REJECTED':
          statuses.rejected.push(templateEntry);
          break;
        case 'DISABLED':
          statuses.queue.push(templateEntry);
          break;
      }

      statuses.lastUpdated = timestamp;

      await fs.writeFile(this.approvalsFile, JSON.stringify(statuses, null, 2));

      log(
        `✅ Estado de plantilla "${templateName}" actualizado a ${newStatus}`
      );

      return {
        success: true,
        templateName,
        newStatus,
        timestamp,
      };
    } catch (error) {
      log(`❌ Error actualizando estado de plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene plantillas por estado
   */
  async getTemplatesByStatus(status) {
    try {
      const statuses = await this.getTemplateStatuses();

      switch (status.toUpperCase()) {
        case 'PENDING':
          return statuses.pending || [];
        case 'APPROVED':
          return statuses.approved || [];
        case 'REJECTED':
          return statuses.rejected || [];
        case 'DISABLED':
          return statuses.queue || [];
        default:
          throw new Error(`Estado inválido: ${status}`);
      }
    } catch (error) {
      log(`Error obteniendo plantillas por estado: ${error.message}`);
      throw error;
    }
  }

  /**
   * Añade una plantilla a la cola de aprobación
   */
  async submitForApproval(templateName, category = 'MARKETING') {
    try {
      if (!Object.values(TEMPLATE_CATEGORIES).includes(category)) {
        throw new Error(`Categoría inválida: ${category}`);
      }

      await this.updateTemplateStatus(
        templateName,
        'PENDING',
        `Plantilla enviada para aprobación en categoría ${category}`
      );

      log(`📋 Plantilla "${templateName}" enviada para aprobación`);

      return {
        success: true,
        message: `Plantilla "${templateName}" enviada para aprobación`,
        status: 'PENDING',
      };
    } catch (error) {
      log(`Error enviando plantilla para aprobación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aprueba una plantilla
   */
  async approveTemplate(templateName, approverNote = '') {
    try {
      await this.updateTemplateStatus(
        templateName,
        'APPROVED',
        `Plantilla aprobada. ${approverNote}`
      );

      log(`✅ Plantilla "${templateName}" aprobada`);

      return {
        success: true,
        message: `Plantilla "${templateName}" aprobada exitosamente`,
        status: 'APPROVED',
      };
    } catch (error) {
      log(`Error aprobando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rechaza una plantilla
   */
  async rejectTemplate(templateName, rejectionReason) {
    try {
      if (!rejectionReason) {
        throw new Error('Se requiere una razón para rechazar la plantilla');
      }

      await this.updateTemplateStatus(
        templateName,
        'REJECTED',
        rejectionReason
      );

      log(`❌ Plantilla "${templateName}" rechazada: ${rejectionReason}`);

      return {
        success: true,
        message: `Plantilla "${templateName}" rechazada`,
        reason: rejectionReason,
        status: 'REJECTED',
      };
    } catch (error) {
      log(`Error rechazando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de plantillas
   */
  async getTemplateStats() {
    try {
      const statuses = await this.getTemplateStatuses();

      return {
        total:
          (statuses.pending?.length || 0) +
          (statuses.approved?.length || 0) +
          (statuses.rejected?.length || 0) +
          (statuses.queue?.length || 0),
        pending: statuses.pending?.length || 0,
        approved: statuses.approved?.length || 0,
        rejected: statuses.rejected?.length || 0,
        disabled: statuses.queue?.length || 0,
        lastUpdated: statuses.lastUpdated,
      };
    } catch (error) {
      log(`Error obteniendo estadísticas de plantillas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si una plantilla está aprobada
   */
  async isTemplateApproved(templateName) {
    try {
      const approvedTemplates = await this.getTemplatesByStatus('APPROVED');
      return approvedTemplates.some(template => template.name === templateName);
    } catch (error) {
      log(`Error verificando aprobación de plantilla: ${error.message}`);
      return false;
    }
  }
}

export const templateStatusService = new TemplateStatusService();
