/**
 * Sistema de Validación de Esquemas
 * Implementa validación tipo Swagger/OpenAPI para endpoints
 */

/**
 * Clase personalizada para errores de validación
 */
class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.value = value;
  }
}

class SchemaValidator {
  constructor() {
    this.schemas = new Map();
    this.validationRules = new Map();
    this.initializeSchemas();
  }

  /**
     * Inicializa esquemas predefinidos
     */
  initializeSchemas() {
    try {
      // Esquema para contactos
      this.registerSchema('Contact', {
        type: 'object',
        required: ['id', 'name', 'email'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'] },
          createdAt: { type: 'string', format: 'date-time' },
          lastActivity: { type: 'string', format: 'date-time' }
        }
      });

      // Esquema para mensajes de broadcast
      this.registerSchema('BroadcastMessage', {
        type: 'object',
        required: ['id', 'title', 'content', 'recipients'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          content: { type: 'string', minLength: 1, maxLength: 5000 },
          recipients: { 
            type: 'array', 
            minItems: 1,
            items: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' }
          },
          scheduledAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['draft', 'scheduled', 'sent', 'failed'] },
          mediaUrl: { type: 'string', format: 'uri' },
          type: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'file'] }
        }
      });

      // Esquema para flujos de conversación
      this.registerSchema('ConversationFlow', {
        type: 'object',
        required: ['id', 'name', 'nodes', 'connections'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          nodes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'type', 'position'],
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['start', 'message', 'condition', 'action', 'end'] },
                position: {
                  type: 'object',
                  required: ['x', 'y'],
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' }
                  }
                },
                data: { type: 'object' }
              }
            }
          },
          connections: {
            type: 'array',
            items: {
              type: 'object',
              required: ['from', 'to'],
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                condition: { type: 'string' }
              }
            }
          },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      });

      // Esquema para plantillas
      this.registerSchema('Template', {
        type: 'object',
        required: ['id', 'name', 'content'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          content: { type: 'string', minLength: 1, maxLength: 10000 },
          variables: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'type'],
              properties: {
                name: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' },
                type: { type: 'string', enum: ['text', 'number', 'date', 'boolean'] },
                required: { type: 'boolean' },
                defaultValue: { type: 'string' }
              }
            }
          },
          category: { type: 'string', enum: ['marketing', 'support', 'notification', 'other'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      });
    } catch (error) {
      throw new ValidationError(
        `Error inicializando esquemas: ${error.message}`,
        'SCHEMA_INITIALIZATION_ERROR'
      );
    }
  }

  /**
     * Registra un nuevo esquema
     */
  registerSchema(name, schema) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Nombre de esquema requerido', 'INVALID_SCHEMA_NAME');
    }
        
    if (!schema || typeof schema !== 'object') {
      throw new ValidationError('Esquema debe ser un objeto válido', 'INVALID_SCHEMA');
    }
        
    this.schemas.set(name, schema);
  }

  /**
     * Valida datos contra un esquema
     */
  validate(data, schemaName) {
    if (!schemaName || typeof schemaName !== 'string') {
      throw new ValidationError('Nombre de esquema requerido', 'MISSING_SCHEMA_NAME');
    }
        
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new ValidationError(`Esquema '${schemaName}' no encontrado`, 'SCHEMA_NOT_FOUND');
    }

    if (data === null || data === undefined) {
      throw new ValidationError('Datos requeridos para validación', 'MISSING_DATA');
    }

    const errors = [];
    this.validateObject(data, schema, '', errors);
        
    if (errors.length > 0) {
      const errorMessage = `Errores de validación: ${errors.join(', ')}`;
      throw new ValidationError(errorMessage, 'VALIDATION_FAILED', null, errors);
    }
        
    return true;
  }

  /**
     * Valida un objeto contra un esquema
     */
  validateObject(data, schema, path, errors) {
    try {
      if (schema.type !== 'object') {
        this.validateValue(data, schema, path, errors);
        return;
      }

      if (typeof data !== 'object' || data === null) {
        errors.push(`${path || 'root'}: debe ser un objeto`);
        return;
      }

      // Validar campos requeridos
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in data) || data[field] === null || data[field] === undefined) {
            errors.push(`${path}.${field}: campo requerido`);
          }
        }
      }

      // Validar propiedades
      if (schema.properties) {
        for (const [key, value] of Object.entries(data)) {
          const fieldSchema = schema.properties[key];
          if (fieldSchema) {
            const fieldPath = path ? `${path}.${key}` : key;
            this.validateValue(value, fieldSchema, fieldPath, errors);
          } else if (schema.additionalProperties === false) {
            errors.push(`${path}.${key}: propiedad no permitida`);
          }
        }
      }
    } catch (error) {
      errors.push(`${path}: error validando objeto - ${error.message}`);
    }
  }

  /**
     * Valida un valor contra un esquema
     */
  validateValue(value, schema, path, errors) {
    try {
      // Validar tipo
      if (!this.validateType(value, schema.type)) {
        errors.push(`${path}: tipo esperado '${schema.type}', recibido '${typeof value}'`);
        return;
      }

      // Validaciones específicas por tipo
      switch (schema.type) {
      case 'string':
        this.validateString(value, schema, path, errors);
        break;
      case 'number':
      case 'integer':
        this.validateNumber(value, schema, path, errors);
        break;
      case 'array':
        this.validateArray(value, schema, path, errors);
        break;
      case 'object':
        this.validateObject(value, schema, path, errors);
        break;
      }

      // Validar enum
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: valor debe ser uno de [${schema.enum.join(', ')}]`);
      }
    } catch (error) {
      errors.push(`${path}: error validando valor - ${error.message}`);
    }
  }

  /**
     * Valida el tipo de un valor
     */
  validateType(value, expectedType) {
    if (!expectedType) return true;
        
    switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
    }
  }

  /**
     * Valida una cadena
     */
  validateString(value, schema, path, errors) {
    try {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path}: longitud mínima ${schema.minLength}, actual ${value.length}`);
      }
            
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path}: longitud máxima ${schema.maxLength}, actual ${value.length}`);
      }
            
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push(`${path}: no coincide con el patrón requerido`);
        }
      }
            
      if (schema.format && !this.validateFormat(value, schema.format)) {
        errors.push(`${path}: formato '${schema.format}' inválido`);
      }
    } catch (error) {
      errors.push(`${path}: error validando cadena - ${error.message}`);
    }
  }

  /**
     * Valida un número
     */
  validateNumber(value, schema, path, errors) {
    try {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: valor mínimo ${schema.minimum}, actual ${value}`);
      }
            
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: valor máximo ${schema.maximum}, actual ${value}`);
      }
            
      if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
        errors.push(`${path}: debe ser múltiplo de ${schema.multipleOf}`);
      }
    } catch (error) {
      errors.push(`${path}: error validando número - ${error.message}`);
    }
  }

  /**
     * Valida un array
     */
  validateArray(value, schema, path, errors) {
    try {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: mínimo ${schema.minItems} elementos, actual ${value.length}`);
      }
            
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: máximo ${schema.maxItems} elementos, actual ${value.length}`);
      }
            
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items, `${path}[${index}]`, errors);
        });
      }
            
      if (schema.uniqueItems && new Set(value).size !== value.length) {
        errors.push(`${path}: elementos deben ser únicos`);
      }
    } catch (error) {
      errors.push(`${path}: error validando array - ${error.message}`);
    }
  }

  /**
     * Valida formato específico
     */
  validateFormat(value, format) {
    try {
      switch (format) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'uri':
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'date-time':
        return !isNaN(Date.parse(value));
      case 'date':
        return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
      case 'time':
        return /^\d{2}:\d{2}:\d{2}$/.test(value);
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      default:
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
     * Genera documentación Swagger para un esquema
     */
  generateSwaggerDoc(schemaName) {
    try {
      if (!schemaName || typeof schemaName !== 'string') {
        throw new ValidationError('Nombre de esquema requerido', 'INVALID_SCHEMA_NAME');
      }
            
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        throw new ValidationError(`Esquema '${schemaName}' no encontrado`, 'SCHEMA_NOT_FOUND');
      }

      return {
        openapi: '3.0.0',
        info: {
          title: `API ${schemaName}`,
          version: '1.0.0',
          description: `Documentación automática para ${schemaName}`
        },
        components: {
          schemas: {
            [schemaName]: schema
          }
        },
        paths: this.generatePaths(schemaName, schema)
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Error generando documentación Swagger: ${error.message}`,
        'SWAGGER_GENERATION_ERROR'
      );
    }
  }

  /**
     * Genera paths para Swagger
     */
  generatePaths(schemaName, schema) {
    try {
      if (!schemaName || !schema) {
        throw new ValidationError('Esquema y nombre requeridos', 'MISSING_PARAMETERS');
      }
            
      const basePath = `/${schemaName.toLowerCase()}s`;
            
      return {
        [basePath]: {
          get: {
            summary: `Obtener todos los ${schemaName}`,
            responses: {
              '200': {
                description: 'Éxito',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${schemaName}` }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: `Crear nuevo ${schemaName}`,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${schemaName}` }
                }
              }
            },
            responses: {
              '201': {
                description: 'Creado exitosamente',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/${schemaName}` }
                  }
                }
              },
              '400': {
                description: 'Datos inválidos'
              }
            }
          }
        },
        [`${basePath}/{id}`]: {
          get: {
            summary: `Obtener ${schemaName} por ID`,
            parameters: [{
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }],
            responses: {
              '200': {
                description: 'Éxito',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/${schemaName}` }
                  }
                }
              },
              '404': {
                description: 'No encontrado'
              }
            }
          },
          put: {
            summary: `Actualizar ${schemaName}`,
            parameters: [{
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${schemaName}` }
                }
              }
            },
            responses: {
              '200': {
                description: 'Actualizado exitosamente',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/${schemaName}` }
                  }
                }
              },
              '400': {
                description: 'Datos inválidos'
              },
              '404': {
                description: 'No encontrado'
              }
            }
          },
          delete: {
            summary: `Eliminar ${schemaName}`,
            parameters: [{
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }],
            responses: {
              '204': {
                description: 'Eliminado exitosamente'
              },
              '404': {
                description: 'No encontrado'
              }
            }
          }
        }
      };
    } catch (error) {
      throw new ValidationError(
        `Error generando paths Swagger: ${error.message}`,
        'SWAGGER_PATHS_ERROR'
      );
    }
  }

  /**
     * Valida endpoints de API
     */
  validateEndpoints(endpoints) {
    try {
      if (!endpoints || !Array.isArray(endpoints)) {
        throw new ValidationError('Lista de endpoints requerida', 'INVALID_ENDPOINTS');
      }
            
      const errors = [];
            
      for (const endpoint of endpoints) {
        try {
          this.validateEndpoint(endpoint);
        } catch (error) {
          errors.push(`Endpoint ${endpoint.path || 'desconocido'}: ${error.message}`);
        }
      }
            
      if (errors.length > 0) {
        throw new ValidationError(
          `Errores en endpoints: ${errors.join(', ')}`,
          'ENDPOINT_VALIDATION_FAILED',
          null,
          errors
        );
      }
            
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Error validando endpoints: ${error.message}`,
        'ENDPOINT_VALIDATION_ERROR'
      );
    }
  }

  /**
     * Valida un endpoint individual
     */
  validateEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== 'object') {
      throw new ValidationError('Endpoint debe ser un objeto', 'INVALID_ENDPOINT');
    }
        
    if (!endpoint.path || typeof endpoint.path !== 'string') {
      throw new ValidationError('Path del endpoint requerido', 'MISSING_ENDPOINT_PATH');
    }
        
    if (!endpoint.method || typeof endpoint.method !== 'string') {
      throw new ValidationError('Método del endpoint requerido', 'MISSING_ENDPOINT_METHOD');
    }
        
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    if (!validMethods.includes(endpoint.method.toUpperCase())) {
      throw new ValidationError(
        `Método inválido: ${endpoint.method}`,
        'INVALID_HTTP_METHOD'
      );
    }
        
    // Validar cumplimiento RESTful
    this.validateRESTfulCompliance(endpoint);
        
    // Validar convenciones de nomenclatura
    this.validateNamingConvention(endpoint);
        
    return true;
  }

  /**
     * Valida cumplimiento RESTful
     */
  validateRESTfulCompliance(endpoint) {
    try {
      const method = endpoint.method.toUpperCase();
      const path = endpoint.path;
            
      // Validar que GET no modifique datos
      if (method === 'GET' && endpoint.modifiesData) {
        throw new ValidationError(
          'GET no debe modificar datos',
          'RESTFUL_VIOLATION'
        );
      }
            
      // Validar que POST sea para creación
      if (method === 'POST' && !path.match(/^\/[a-z]+s?$/)) {
        // POST debería ser a colecciones, no a recursos específicos
        logger.warn(`POST a ${path} podría no seguir convenciones RESTful`);
      }
            
      // Validar que PUT/DELETE tengan ID en el path
      if ((method === 'PUT' || method === 'DELETE') && !path.includes('{id}') && !path.match(/\/[^\/]+$/)) {
        logger.warn(`${method} a ${path} debería incluir ID del recurso`);
      }
            
      return true;
    } catch (error) {
      throw new ValidationError(
        `Error validando cumplimiento RESTful: ${error.message}`,
        'RESTFUL_VALIDATION_ERROR'
      );
    }
  }

  /**
     * Valida convenciones de nomenclatura
     */
  validateNamingConvention(endpoint) {
    try {
      const path = endpoint.path;
            
      // Validar que use kebab-case o snake_case
      if (!path.match(/^\/[a-z0-9\-_\/{}]+$/)) {
        throw new ValidationError(
          'Path debe usar minúsculas, guiones o guiones bajos',
          'INVALID_PATH_NAMING'
        );
      }
            
      // Validar que no termine en slash (excepto root)
      if (path.length > 1 && path.endsWith('/')) {
        throw new ValidationError(
          'Path no debe terminar en slash',
          'INVALID_PATH_FORMAT'
        );
      }
            
      return true;
    } catch (error) {
      throw new ValidationError(
        `Error validando nomenclatura: ${error.message}`,
        'NAMING_VALIDATION_ERROR'
      );
    }
  }

  /**
     * Obtiene todos los esquemas registrados
     */
  getSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
     * Obtiene un esquema específico
     */
  getSchema(name) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Nombre de esquema requerido', 'INVALID_SCHEMA_NAME');
    }
        
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new ValidationError(`Esquema '${name}' no encontrado`, 'SCHEMA_NOT_FOUND');
    }
        
    return schema;
  }

  /**
     * Elimina un esquema
     */
  removeSchema(name) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Nombre de esquema requerido', 'INVALID_SCHEMA_NAME');
    }
        
    if (!this.schemas.has(name)) {
      throw new ValidationError(`Esquema '${name}' no encontrado`, 'SCHEMA_NOT_FOUND');
    }
        
    return this.schemas.delete(name);
  }
}

export { SchemaValidator, ValidationError };
export default SchemaValidator;