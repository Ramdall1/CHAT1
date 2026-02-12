/**
 * Modelo de Contacto
 * 
 * Define la estructura y validaciones para los contactos
 * del sistema de gestión de WhatsApp Business.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('CONTACT_MODEL');

/**
 * Clase modelo para Contactos
 */
export class Contact {
  constructor(data = {}) {
    this.id = data.id || null;
    this.phone = data.phone || '';
    this.name = data.name || '';
    this.email = data.email || '';
    this.tags = data.tags || [];
    this.segments = data.segments || [];
    this.status = data.status || 'active';
    this.lastInteraction = data.lastInteraction || null;
    this.metadata = data.metadata || {};
    this.customFields = data.customFields || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    // Validar datos al crear instancia
    this.validate();
  }
  
  /**
   * Validar datos del contacto
   * @throws {Error} Si los datos son inválidos
   */
  validate() {
    const errors = [];
    
    // Validar teléfono (requerido)
    if (!this.phone) {
      errors.push('El número de teléfono es requerido');
    } else if (!this.isValidPhone(this.phone)) {
      errors.push('El número de teléfono no es válido');
    }
    
    // Validar nombre
    if (this.name && this.name.length > 100) {
      errors.push('El nombre no puede exceder 100 caracteres');
    }
    
    // Validar email
    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('El email no es válido');
    }
    
    // Validar status
    const validStatuses = ['active', 'inactive', 'blocked', 'pending'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`El status debe ser uno de: ${validStatuses.join(', ')}`);
    }
    
    // Validar tags
    if (!Array.isArray(this.tags)) {
      errors.push('Las etiquetas deben ser un array');
    }
    
    // Validar segments
    if (!Array.isArray(this.segments)) {
      errors.push('Los segmentos deben ser un array');
    }
    
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Validar formato de teléfono
   * @param {string} phone - Número de teléfono
   * @returns {boolean} True si es válido
   */
  isValidPhone(phone) {
    // Formato internacional básico (puede mejorarse)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }
  
  /**
   * Validar formato de email
   * @param {string} email - Dirección de email
   * @returns {boolean} True si es válido
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Agregar etiqueta al contacto
   * @param {string} tag - Etiqueta a agregar
   */
  addTag(tag) {
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Remover etiqueta del contacto
   * @param {string} tag - Etiqueta a remover
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Agregar segmento al contacto
   * @param {string} segment - Segmento a agregar
   */
  addSegment(segment) {
    if (segment && !this.segments.includes(segment)) {
      this.segments.push(segment);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Remover segmento del contacto
   * @param {string} segment - Segmento a remover
   */
  removeSegment(segment) {
    const index = this.segments.indexOf(segment);
    if (index > -1) {
      this.segments.splice(index, 1);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Actualizar último contacto
   * @param {Date|string} date - Fecha de última interacción
   */
  updateLastInteraction(date = null) {
    this.lastInteraction = date || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Actualizar metadata del contacto
   * @param {object} newMetadata - Nueva metadata
   */
  updateMetadata(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Actualizar campos personalizados
   * @param {object} newFields - Nuevos campos personalizados
   */
  updateCustomFields(newFields) {
    this.customFields = { ...this.customFields, ...newFields };
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Cambiar status del contacto
   * @param {string} newStatus - Nuevo status
   */
  changeStatus(newStatus) {
    const validStatuses = ['active', 'inactive', 'blocked', 'pending'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido: ${newStatus}`);
    }
    
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Verificar si el contacto está activo
   * @returns {boolean} True si está activo
   */
  isActive() {
    return this.status === 'active';
  }
  
  /**
   * Verificar si el contacto está bloqueado
   * @returns {boolean} True si está bloqueado
   */
  isBlocked() {
    return this.status === 'blocked';
  }
  
  /**
   * Obtener días desde última interacción
   * @returns {number} Días desde última interacción
   */
  getDaysSinceLastInteraction() {
    if (!this.lastInteraction) {
      return null;
    }
    
    const lastDate = new Date(this.lastInteraction);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Convertir a objeto plano para almacenamiento
   * @returns {object} Objeto plano
   */
  toJSON() {
    return {
      id: this.id,
      phone: this.phone,
      name: this.name,
      email: this.email,
      tags: this.tags,
      segments: this.segments,
      status: this.status,
      lastInteraction: this.lastInteraction,
      metadata: this.metadata,
      customFields: this.customFields,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
  
  /**
   * Crear instancia desde objeto plano
   * @param {object} data - Datos del contacto
   * @returns {Contact} Nueva instancia
   */
  static fromJSON(data) {
    return new Contact(data);
  }
  
  /**
   * Crear contacto desde número de teléfono
   * @param {string} phone - Número de teléfono
   * @param {object} additionalData - Datos adicionales
   * @returns {Contact} Nueva instancia
   */
  static fromPhone(phone, additionalData = {}) {
    return new Contact({
      phone,
      ...additionalData
    });
  }
  
  /**
   * Validar datos antes de crear contacto
   * @param {object} data - Datos a validar
   * @returns {object} Datos validados
   * @throws {Error} Si los datos son inválidos
   */
  static validateData(data) {
    const contact = new Contact(data);
    return contact.toJSON();
  }
}

/**
 * Esquema de validación para contactos
 */
export const ContactSchema = {
  phone: {
    type: 'string',
    required: true,
    validate: (value) => {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
    }
  },
  name: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  email: {
    type: 'string',
    required: false,
    validate: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    }
  },
  status: {
    type: 'string',
    required: false,
    enum: ['active', 'inactive', 'blocked', 'pending'],
    default: 'active'
  },
  tags: {
    type: 'array',
    required: false,
    default: []
  },
  segments: {
    type: 'array',
    required: false,
    default: []
  }
};

export default Contact;