/**
 * @fileoverview Advanced Data Validation System
 * 
 * Sistema avanzado de validación de datos con esquemas flexibles,
 * sanitización automática, verificación de tipos y validación personalizada.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import { ValidationError } from '../../../../utils/error_manager.js';
import logger from '../logger.js';

/**
 * Configuración de seguridad para validación
 */
const SECURITY_LIMITS = {
  MAX_JSON_SIZE: 1024 * 1024, // 1MB máximo para JSON
  MAX_STRING_LENGTH: 10000,   // 10KB máximo para strings
  MAX_OBJECT_DEPTH: 10,       // Máxima profundidad de objetos anidados
  MAX_ARRAY_LENGTH: 1000      // Máximo elementos en array
};

/**
 * Tipos de datos soportados
 * 
 * @enum {string}
 */
export const DataType = {
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  EMAIL: 'email',
  URL: 'url',
  UUID: 'uuid',
  DATE: 'date',
  PHONE: 'phone',
  JSON: 'json'
};

/**
 * Reglas de validación predefinidas
 * 
 * @enum {RegExp}
 */
export const ValidationRules = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHA: /^[a-zA-Z]+$/,
  NUMERIC: /^[0-9]+$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};

/**
 * Sanitiza strings para prevenir ataques XSS
 * 
 * @param {string} str - String a sanitizar
 * @returns {string} String sanitizado
 */
function sanitizeXSS(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Valida el tamaño de un string para prevenir ataques DoS
 * 
 * @param {string} str - String a validar
 * @param {number} maxSize - Tamaño máximo permitido
 * @returns {boolean} True si el tamaño es válido
 */
function validateStringSize(str, maxSize = SECURITY_LIMITS.MAX_STRING_LENGTH) {
  return typeof str === 'string' && str.length <= maxSize;
}

/**
 * Esquema de validación
 * 
 * @typedef {Object} ValidationSchema
 * @property {DataType} type - Tipo de dato
 * @property {boolean} required - Si es requerido
 * @property {*} default - Valor por defecto
 * @property {number} min - Valor/longitud mínima
 * @property {number} max - Valor/longitud máxima
 * @property {RegExp|Function} pattern - Patrón o función de validación
 * @property {Array} enum - Valores permitidos
 * @property {ValidationSchema} items - Esquema para elementos de array
 * @property {Object<string, ValidationSchema>} properties - Propiedades de objeto
 * @property {Function} custom - Validador personalizado
 * @property {boolean} sanitize - Si debe sanitizar
 * @property {string} message - Mensaje de error personalizado
 */

/**
 * Resultado de validación
 * 
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Si es válido
 * @property {*} data - Datos validados/sanitizados
 * @property {Array<Object>} errors - Lista de errores
 * @property {Array<string>} warnings - Lista de advertencias
 */

/**
 * Validador de datos avanzado
 * 
 * @class DataValidator
 */
export class DataValidator {
  /**
   * Constructor del validador
   * 
   * @param {Object} config - Configuración del validador
   * @param {boolean} config.strictMode - Modo estricto
   * @param {boolean} config.autoSanitize - Sanitización automática
   * @param {boolean} config.throwOnError - Lanzar excepción en error
   * @param {Object} config.customTypes - Tipos personalizados
   */
  constructor(config = {}) {
    this.strictMode = config.strictMode !== false;
    this.autoSanitize = config.autoSanitize !== false;
    this.throwOnError = config.throwOnError === true;
    this.maxDepth = config.maxDepth || SECURITY_LIMITS.MAX_OBJECT_DEPTH;
    this.maxArrayLength = config.maxArrayLength || SECURITY_LIMITS.MAX_ARRAY_LENGTH;
    this.customTypes = new Map(Object.entries(config.customTypes || {}));
    
    this.validationStats = {
      total: 0,
      passed: 0,
      failed: 0,
      byType: new Map(),
      byField: new Map()
    };

    logger.info('🔍 DataValidator inicializado');
  }

  /**
   * Valida datos contra un esquema
   * 
   * @param {*} data - Datos a validar
   * @param {ValidationSchema|Object} schema - Esquema de validación
   * @param {Object} options - Opciones de validación
   * @returns {ValidationResult} Resultado de la validación
   */
  validate(data, schema, options = {}) {
    this.validationStats.total++;
    
    const context = {
      path: options.path || '',
      depth: options.depth || 0,
      parent: options.parent || null,
      root: options.root || data
    };

    try {
      const result = this.validateValue(data, schema, context);
      
      if (result.valid) {
        this.validationStats.passed++;
      } else {
        this.validationStats.failed++;
        
        if (this.throwOnError) {
          const firstError = result.errors[0];
          throw new ValidationError(
            firstError.message,
            firstError.field,
            firstError.value,
            { errors: result.errors }
          );
        }
      }

      return result;
    } catch (error) {
      this.validationStats.failed++;
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        `Error de validación: ${error.message}`,
        context.path,
        data,
        { originalError: error }
      );
    }
  }

  /**
   * Valida un valor individual
   * 
   * @private
   * @param {*} value - Valor a validar
   * @param {ValidationSchema} schema - Esquema de validación
   * @param {Object} context - Contexto de validación
   * @returns {ValidationResult} Resultado de la validación
   */
  validateValue(value, schema, context) {
    const errors = [];
    const warnings = [];
    let validatedValue = value;

    // Verificar profundidad máxima para prevenir stack overflow
    if (context.depth > this.maxDepth) {
      errors.push({
        field: context.path,
        message: `Profundidad máxima excedida (${this.maxDepth})`,
        code: 'MAX_DEPTH_EXCEEDED',
        value
      });
      
      return {
        valid: false,
        data: value,
        errors,
        warnings
      };
    }

    // Manejar valor undefined/null
    if (value === undefined || value === null) {
      if (schema.required) {
        errors.push({
          field: context.path,
          message: schema.message || `Campo requerido: ${context.path}`,
          code: 'REQUIRED_FIELD',
          value
        });
        return { valid: false, data: null, errors, warnings };
      }
      
      if (schema.default !== undefined) {
        validatedValue = schema.default;
      } else {
        return { valid: true, data: null, errors, warnings };
      }
    }

    // Sanitización automática
    if (this.autoSanitize && schema.sanitize !== false) {
      validatedValue = this.sanitizeValue(validatedValue, schema.type);
    }

    // Validación por tipo
    const typeValidation = this.validateType(validatedValue, schema, context);
    if (!typeValidation.valid) {
      errors.push(...typeValidation.errors);
      return { valid: false, data: validatedValue, errors, warnings };
    }
    validatedValue = typeValidation.data;

    // Validaciones adicionales
    const additionalValidation = this.validateConstraints(validatedValue, schema, context);
    errors.push(...additionalValidation.errors);
    warnings.push(...additionalValidation.warnings);

    // Validador personalizado
    if (schema.custom && typeof schema.custom === 'function') {
      try {
        const customResult = schema.custom(validatedValue, context);
        if (customResult === false) {
          errors.push({
            field: context.path,
            message: schema.message || `Validación personalizada falló: ${context.path}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            value: validatedValue
          });
        } else if (typeof customResult === 'object' && customResult.valid === false) {
          errors.push({
            field: context.path,
            message: customResult.message || schema.message || `Validación personalizada falló: ${context.path}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            value: validatedValue
          });
        }
      } catch (error) {
        errors.push({
          field: context.path,
          message: `Error en validación personalizada: ${error.message}`,
          code: 'CUSTOM_VALIDATION_ERROR',
          value: validatedValue
        });
      }
    }

    const isValid = errors.length === 0;
    
    // Actualizar estadísticas
    this.updateStats(schema.type, context.path, isValid);

    return {
      valid: isValid,
      data: validatedValue,
      errors,
      warnings
    };
  }

  /**
   * Valida el tipo de dato
   * 
   * @private
   * @param {*} value - Valor a validar
   * @param {ValidationSchema} schema - Esquema de validación
   * @param {Object} context - Contexto de validación
   * @returns {ValidationResult} Resultado de la validación de tipo
   */
  validateType(value, schema, context) {
    const errors = [];
    let validatedValue = value;

    // Verificar tipo personalizado
    if (this.customTypes.has(schema.type)) {
      const customValidator = this.customTypes.get(schema.type);
      return customValidator(value, schema, context);
    }

    switch (schema.type) {
      case DataType.STRING:
        if (typeof value !== 'string') {
          if (this.strictMode) {
            errors.push({
              field: context.path,
              message: `Se esperaba string, recibido ${typeof value}`,
              code: 'INVALID_TYPE',
              value
            });
          } else {
            validatedValue = String(value);
          }
        } else if (!validateStringSize(value)) {
          errors.push({
            field: context.path,
            message: `String excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres)`,
            code: 'STRING_TOO_LONG',
            value
          });
        }
        break;

      case DataType.NUMBER:
        if (typeof value !== 'number' || isNaN(value)) {
          if (this.strictMode) {
            errors.push({
              field: context.path,
              message: `Se esperaba number, recibido ${typeof value}`,
              code: 'INVALID_TYPE',
              value
            });
          } else {
            const parsed = Number(value);
            if (isNaN(parsed)) {
              errors.push({
                field: context.path,
                message: `No se puede convertir a number: ${value}`,
                code: 'INVALID_TYPE',
                value
              });
            } else {
              validatedValue = parsed;
            }
          }
        }
        break;

      case DataType.INTEGER:
        if (!Number.isInteger(value)) {
          if (this.strictMode) {
            errors.push({
              field: context.path,
              message: `Se esperaba integer, recibido ${typeof value}`,
              code: 'INVALID_TYPE',
              value
            });
          } else {
            const parsed = parseInt(value, 10);
            if (isNaN(parsed)) {
              errors.push({
                field: context.path,
                message: `No se puede convertir a integer: ${value}`,
                code: 'INVALID_TYPE',
                value
              });
            } else {
              validatedValue = parsed;
            }
          }
        }
        break;

      case DataType.BOOLEAN:
        if (typeof value !== 'boolean') {
          if (this.strictMode) {
            errors.push({
              field: context.path,
              message: `Se esperaba boolean, recibido ${typeof value}`,
              code: 'INVALID_TYPE',
              value
            });
          } else {
            validatedValue = Boolean(value);
          }
        }
        break;

      case DataType.ARRAY:
        if (!Array.isArray(value)) {
          errors.push({
            field: context.path,
            message: `Se esperaba array, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else {
          // Validar longitud máxima del array
          if (value.length > this.maxArrayLength) {
            errors.push({
              field: context.path,
              message: `Array excede la longitud máxima permitida (${this.maxArrayLength})`,
              code: 'ARRAY_TOO_LONG',
              value
            });
          } else {
            // Validar profundidad para todos los arrays
            if (context.depth > this.maxDepth) {
              errors.push({
                field: context.path,
                message: `Profundidad máxima excedida (${this.maxDepth})`,
                code: 'MAX_DEPTH_EXCEEDED',
                value
              });
            } else if (schema.items) {
              const arrayErrors = [];
              const validatedArray = [];
              
              for (let i = 0; i < value.length; i++) {
                const itemResult = this.validateValue(value[i], schema.items, {
                  ...context,
                  path: `${context.path}[${i}]`,
                  depth: context.depth + 1
                });
                
                if (!itemResult.valid) {
                  arrayErrors.push(...itemResult.errors);
                }
                
                validatedArray.push(itemResult.data);
              }
              
              if (arrayErrors.length > 0) {
                errors.push(...arrayErrors);
              } else {
                validatedValue = validatedArray;
              }
            } else {
              // Array sin items definidos - validar recursivamente para profundidad
              const arrayErrors = [];
              const validatedArray = [];
              
              for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (Array.isArray(item)) {
                  const itemResult = this.validateValue(item, { type: DataType.ARRAY }, {
                    ...context,
                    path: `${context.path}[${i}]`,
                    depth: context.depth + 1
                  });
                  
                  if (!itemResult.valid) {
                    arrayErrors.push(...itemResult.errors);
                  }
                  
                  validatedArray.push(itemResult.data);
                } else if (typeof item === 'object' && item !== null) {
                  const itemResult = this.validateValue(item, { type: DataType.OBJECT }, {
                    ...context,
                    path: `${context.path}[${i}]`,
                    depth: context.depth + 1
                  });
                  
                  if (!itemResult.valid) {
                    arrayErrors.push(...itemResult.errors);
                  }
                  
                  validatedArray.push(itemResult.data);
                } else {
                  validatedArray.push(item);
                }
              }
              
              if (arrayErrors.length > 0) {
                errors.push(...arrayErrors);
              } else {
                validatedValue = validatedArray;
              }
            }
          }
        }
        break;

      case DataType.OBJECT:
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            field: context.path,
            message: `Se esperaba object, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else {
          // Validar profundidad para todos los objetos
          if (context.depth > this.maxDepth) {
            errors.push({
              field: context.path,
              message: `Profundidad máxima excedida (${this.maxDepth})`,
              code: 'MAX_DEPTH_EXCEEDED',
              value
            });
          } else if (schema.properties) {
            const objectErrors = [];
            const validatedObject = {};
            
            // Validar propiedades definidas
            for (const [key, propSchema] of Object.entries(schema.properties)) {
              const propResult = this.validateValue(value[key], propSchema, {
                ...context,
                path: context.path ? `${context.path}.${key}` : key,
                depth: context.depth + 1
              });
              
              if (!propResult.valid) {
                objectErrors.push(...propResult.errors);
              }
              
              if (propResult.data !== undefined) {
                validatedObject[key] = propResult.data;
              }
            }
            
            // En modo estricto, rechazar propiedades no definidas
            if (this.strictMode) {
              for (const key of Object.keys(value)) {
                if (!schema.properties[key]) {
                  objectErrors.push({
                    field: `${context.path}.${key}`,
                    message: `Propiedad no permitida: ${key}`,
                    code: 'UNKNOWN_PROPERTY',
                    value: value[key]
                  });
                }
              }
            } else {
              // Copiar propiedades no definidas
              for (const [key, val] of Object.entries(value)) {
                if (!schema.properties[key]) {
                  validatedObject[key] = val;
                }
              }
            }
            
            if (objectErrors.length > 0) {
              errors.push(...objectErrors);
            } else {
              validatedValue = validatedObject;
            }
          } else {
            // Objeto sin propiedades definidas - validar recursivamente para profundidad
            const objectErrors = [];
            const validatedObject = {};
            
            for (const [key, val] of Object.entries(value)) {
              if (typeof val === 'object' && val !== null) {
                const propResult = this.validateValue(val, { type: DataType.OBJECT }, {
                  ...context,
                  path: context.path ? `${context.path}.${key}` : key,
                  depth: context.depth + 1
                });
                
                if (!propResult.valid) {
                  objectErrors.push(...propResult.errors);
                }
                
                validatedObject[key] = propResult.data;
              } else {
                validatedObject[key] = val;
              }
            }
            
            if (objectErrors.length > 0) {
              errors.push(...objectErrors);
            } else {
              validatedValue = validatedObject;
            }
          }
        }
        break;

      case DataType.EMAIL:
        if (typeof value !== 'string') {
          errors.push({
            field: context.path,
            message: `Se esperaba string para email, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else if (!validateStringSize(value)) {
          errors.push({
            field: context.path,
            message: `Email excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres)`,
            code: 'STRING_TOO_LONG',
            value
          });
        } else if (!ValidationRules.EMAIL.test(value)) {
          errors.push({
            field: context.path,
            message: `Email inválido: ${value}`,
            code: 'INVALID_EMAIL',
            value
          });
        }
        break;

      case DataType.URL:
        if (typeof value !== 'string') {
          errors.push({
            field: context.path,
            message: `Se esperaba string para URL, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else if (!validateStringSize(value)) {
          errors.push({
            field: context.path,
            message: `URL excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres)`,
            code: 'STRING_TOO_LONG',
            value
          });
        } else if (!ValidationRules.URL.test(value)) {
          errors.push({
            field: context.path,
            message: `URL inválida: ${value}`,
            code: 'INVALID_URL',
            value
          });
        }
        break;

      case DataType.UUID:
        if (typeof value !== 'string') {
          errors.push({
            field: context.path,
            message: `Se esperaba string para UUID, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else if (!validateStringSize(value)) {
          errors.push({
            field: context.path,
            message: `UUID excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres)`,
            code: 'STRING_TOO_LONG',
            value
          });
        } else if (!ValidationRules.UUID.test(value)) {
          errors.push({
            field: context.path,
            message: `UUID inválido: ${value}`,
            code: 'INVALID_UUID',
            value
          });
        }
        break;

      case DataType.DATE:
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push({
            field: context.path,
            message: `Fecha inválida: ${value}`,
            code: 'INVALID_DATE',
            value
          });
        } else {
          validatedValue = date;
        }
        break;

      case DataType.PHONE:
        if (typeof value !== 'string') {
          errors.push({
            field: context.path,
            message: `Se esperaba string para teléfono, recibido ${typeof value}`,
            code: 'INVALID_TYPE',
            value
          });
        } else if (!validateStringSize(value)) {
          errors.push({
            field: context.path,
            message: `Teléfono excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres)`,
            code: 'STRING_TOO_LONG',
            value
          });
        } else if (!ValidationRules.PHONE.test(value)) {
          errors.push({
            field: context.path,
            message: `Teléfono inválido: ${value}`,
            code: 'INVALID_PHONE',
            value
          });
        }
        break;

      case DataType.JSON:
        if (typeof value === 'string') {
          // Validar tamaño del string JSON para prevenir ataques DoS
          if (value.length > SECURITY_LIMITS.MAX_JSON_SIZE) {
            errors.push({
              field: context.path,
              message: `JSON excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_JSON_SIZE} bytes)`,
              code: 'JSON_TOO_LARGE',
              value
            });
          } else {
            try {
              validatedValue = JSON.parse(value);
            } catch (error) {
              errors.push({
                field: context.path,
                message: `JSON inválido: ${error.message}`,
                code: 'INVALID_JSON',
                value
              });
            }
          }
        } else if (typeof value === 'object') {
          try {
            const jsonString = JSON.stringify(value);
            // Validar tamaño del JSON serializado
            if (jsonString.length > SECURITY_LIMITS.MAX_JSON_SIZE) {
              errors.push({
                field: context.path,
                message: `Objeto JSON excede el tamaño máximo permitido (${SECURITY_LIMITS.MAX_JSON_SIZE} bytes)`,
                code: 'JSON_TOO_LARGE',
                value
              });
            } else {
              validatedValue = value;
            }
          } catch (error) {
            errors.push({
              field: context.path,
              message: `Objeto no serializable a JSON: ${error.message}`,
              code: 'INVALID_JSON',
              value
            });
          }
        } else {
          errors.push({
            field: context.path,
            message: `Se esperaba JSON válido, recibido ${typeof value}`,
            code: 'INVALID_JSON',
            value
          });
        }
        break;

      default:
        errors.push({
          field: context.path,
          message: `Tipo de dato no soportado: ${schema.type}`,
          code: 'UNSUPPORTED_TYPE',
          value
        });
    }

    return {
      valid: errors.length === 0,
      data: validatedValue,
      errors,
      warnings: []
    };
  }

  /**
   * Valida restricciones adicionales
   * 
   * @private
   * @param {*} value - Valor a validar
   * @param {ValidationSchema} schema - Esquema de validación
   * @param {Object} context - Contexto de validación
   * @returns {Object} Errores y advertencias
   */
  validateConstraints(value, schema, context) {
    const errors = [];
    const warnings = [];

    // Validar longitud/tamaño mínimo
    if (schema.min !== undefined) {
      const size = this.getSize(value);
      if (size < schema.min) {
        errors.push({
          field: context.path,
          message: `Valor muy pequeño. Mínimo: ${schema.min}, actual: ${size}`,
          code: 'MIN_CONSTRAINT',
          value
        });
      }
    }

    // Validar longitud/tamaño máximo
    if (schema.max !== undefined) {
      const size = this.getSize(value);
      if (size > schema.max) {
        errors.push({
          field: context.path,
          message: `Valor muy grande. Máximo: ${schema.max}, actual: ${size}`,
          code: 'MAX_CONSTRAINT',
          value
        });
      }
    }

    // Validar patrón
    if (schema.pattern) {
      if (schema.pattern instanceof RegExp) {
        if (typeof value === 'string' && !schema.pattern.test(value)) {
          errors.push({
            field: context.path,
            message: `Valor no coincide con el patrón requerido`,
            code: 'PATTERN_MISMATCH',
            value
          });
        }
      } else if (typeof schema.pattern === 'function') {
        try {
          const result = schema.pattern(value);
          if (!result) {
            errors.push({
              field: context.path,
              message: `Valor no pasa la validación de patrón`,
              code: 'PATTERN_MISMATCH',
              value
            });
          }
        } catch (error) {
          errors.push({
            field: context.path,
            message: `Error en validación de patrón: ${error.message}`,
            code: 'PATTERN_ERROR',
            value
          });
        }
      }
    }

    // Validar enum
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        errors.push({
          field: context.path,
          message: `Valor no permitido. Valores válidos: ${schema.enum.join(', ')}`,
          code: 'ENUM_MISMATCH',
          value
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Sanitiza un valor según su tipo
   * 
   * @private
   * @param {*} value - Valor a sanitizar
   * @param {DataType} type - Tipo de dato
   * @returns {*} Valor sanitizado
   */
  sanitizeValue(value, type) {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case DataType.STRING:
        const stringValue = String(value).trim();
        // Sanitizar XSS si autoSanitize está habilitado
        return this.autoSanitize ? sanitizeXSS(stringValue) : stringValue;
        
      case DataType.EMAIL:
        const emailValue = String(value).toLowerCase().trim();
        return emailValue;
        
      case DataType.URL:
        const urlValue = String(value).trim();
        return urlValue;
        
      case DataType.PHONE:
        const phoneValue = String(value).replace(/\s+/g, '');
        return phoneValue;
        
      default:
        return value;
    }
  }

  /**
   * Obtiene el tamaño de un valor
   * 
   * @private
   * @param {*} value - Valor a medir
   * @returns {number} Tamaño del valor
   */
  getSize(value) {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).length;
    }
    
    return 0;
  }

  /**
   * Actualiza estadísticas de validación
   * 
   * @private
   * @param {DataType} type - Tipo de dato
   * @param {string} field - Campo validado
   * @param {boolean} valid - Si fue válido
   */
  updateStats(type, field, valid) {
    // Por tipo
    if (!this.validationStats.byType.has(type)) {
      this.validationStats.byType.set(type, { total: 0, passed: 0, failed: 0 });
    }
    const typeStats = this.validationStats.byType.get(type);
    typeStats.total++;
    if (valid) {
      typeStats.passed++;
    } else {
      typeStats.failed++;
    }

    // Por campo
    if (!this.validationStats.byField.has(field)) {
      this.validationStats.byField.set(field, { total: 0, passed: 0, failed: 0 });
    }
    const fieldStats = this.validationStats.byField.get(field);
    fieldStats.total++;
    if (valid) {
      fieldStats.passed++;
    } else {
      fieldStats.failed++;
    }
  }

  /**
   * Registra un tipo personalizado
   * 
   * @param {string} name - Nombre del tipo
   * @param {Function} validator - Función validadora
   */
  registerCustomType(name, validator) {
    this.customTypes.set(name, validator);
    logger.info(`📝 Tipo personalizado registrado: ${name}`);
  }

  /**
   * Obtiene estadísticas de validación
   * 
   * @returns {Object} Estadísticas de validación
   */
  getStats() {
    return {
      ...this.validationStats,
      byType: Object.fromEntries(this.validationStats.byType),
      byField: Object.fromEntries(this.validationStats.byField)
    };
  }

  /**
   * Valida múltiples valores
   * 
   * @param {Object} data - Datos a validar
   * @param {Object} schemas - Esquemas de validación
   * @returns {ValidationResult} Resultado de la validación
   */
  validateMultiple(data, schemas) {
    const results = {};
    const allErrors = [];
    const allWarnings = [];
    let allValid = true;

    for (const [key, schema] of Object.entries(schemas)) {
      const result = this.validate(data[key], schema, { path: key });
      results[key] = result;
      
      if (!result.valid) {
        allValid = false;
        allErrors.push(...result.errors);
      }
      
      allWarnings.push(...result.warnings);
    }

    return {
      valid: allValid,
      data: Object.fromEntries(
        Object.entries(results).map(([key, result]) => [key, result.data])
      ),
      errors: allErrors,
      warnings: allWarnings,
      results
    };
  }
}

// Esquemas predefinidos comunes
export const CommonSchemas = {
  email: {
    type: DataType.EMAIL,
    required: true,
    sanitize: true
  },
  
  password: {
    type: DataType.STRING,
    required: true,
    min: 8,
    pattern: ValidationRules.PASSWORD_STRONG,
    message: 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos'
  },
  
  phone: {
    type: DataType.PHONE,
    required: false,
    sanitize: true
  },
  
  url: {
    type: DataType.URL,
    required: false
  },
  
  uuid: {
    type: DataType.UUID,
    required: true
  },
  
  positiveInteger: {
    type: DataType.INTEGER,
    min: 1
  },
  
  nonEmptyString: {
    type: DataType.STRING,
    required: true,
    min: 1,
    sanitize: true
  }
};

// Instancia global del validador
export const globalValidator = new DataValidator({
  strictMode: false,
  autoSanitize: true,
  throwOnError: false
});

export default DataValidator;