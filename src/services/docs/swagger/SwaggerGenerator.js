/**
 * Generador de Documentación Swagger/OpenAPI
 * Maneja la extracción de rutas API y generación de documentación Swagger
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../core/core/logger.js';

class SwaggerGenerator {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './docs/swagger',
      routesDir: config.routesDir || './src/routes',
      controllersDir: config.controllersDir || './src/controllers',
      swaggerConfig: {
        definition: {
          openapi: '3.0.0',
          info: {
            title: 'ChatBot API',
            version: '1.0.0',
            description: 'API completa para el sistema de ChatBot',
            contact: {
              name: 'Equipo de Desarrollo',
              email: 'dev@chatbot.com'
            }
          },
          servers: [
            {
              url: 'http://localhost:3000',
              description: 'Servidor de desarrollo'
            },
            {
              url: 'https://api.chatbot.com',
              description: 'Servidor de producción'
            }
          ]
        },
        apis: ['./src/routes/*.js', './src/controllers/*.js']
      },
      ...config
    };
    
    this.logger = createLogger('SWAGGER_GENERATOR');
  }

  /**
   * Genera documentación Swagger completa
   */
  async generate() {
    this.logger.info('📋 Generando documentación Swagger...');
    
    try {
      // Crear directorio de salida
      this.ensureOutputDirectory();
      
      // Escanear rutas y controladores
      const apiData = await this.extractAPIData();
      
      // Generar especificación Swagger
      const swaggerSpec = this.generateSwaggerSpec(apiData);
      
      // Guardar especificación JSON
      await this.saveSwaggerSpec(swaggerSpec);
      
      // Generar interfaz Swagger UI
      await this.generateSwaggerUI();
      
      this.logger.info('✅ Swagger generado exitosamente');
      return swaggerSpec;
      
    } catch (error) {
      this.logger.error('❌ Error generando Swagger:', error);
      throw error;
    }
  }

  /**
   * Asegura que el directorio de salida existe
   */
  ensureOutputDirectory() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Extrae datos de API de rutas y controladores
   */
  async extractAPIData() {
    const apiData = {
      paths: {},
      components: {
        schemas: {},
        responses: {}
      }
    };

    // Escanear archivos de rutas
    const routeFiles = this.scanDirectory(this.config.routesDir);
    for (const file of routeFiles) {
      if (file.endsWith('.js')) {
        const routes = this.extractRoutes(file);
        Object.assign(apiData.paths, routes);
      }
    }

    // Escanear controladores para esquemas
    const controllerFiles = this.scanDirectory(this.config.controllersDir);
    for (const file of controllerFiles) {
      if (file.endsWith('.js')) {
        const schemas = this.extractSchemas(file);
        Object.assign(apiData.components.schemas, schemas);
      }
    }

    return apiData;
  }

  /**
   * Extrae rutas de archivos
   */
  extractRoutes(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const routes = {};
    
    // Buscar definiciones de rutas con comentarios Swagger
    const routeRegex = /\/\*\*([\s\S]*?)\*\/\s*router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      const [, comment, method, path] = match;
      const swaggerComment = this.parseSwaggerComment(comment);
      
      if (!routes[path]) {
        routes[path] = {};
      }
      
      routes[path][method.toLowerCase()] = swaggerComment;
    }

    return routes;
  }

  /**
   * Extrae esquemas de controladores
   */
  extractSchemas(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const schemas = {};
    
    // Buscar definiciones de esquemas en comentarios
    const schemaRegex = /\/\*\*\s*@schema\s+(\w+)([\s\S]*?)\*\//g;
    let match;

    while ((match = schemaRegex.exec(content)) !== null) {
      const [, schemaName, schemaContent] = match;
      const schema = this.parseSchemaComment(schemaContent);
      schemas[schemaName] = schema;
    }

    return schemas;
  }

  /**
   * Parsea comentarios Swagger
   */
  parseSwaggerComment(comment) {
    const lines = comment.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    const swaggerData = {
      summary: '',
      description: '',
      tags: [],
      parameters: [],
      responses: {}
    };

    let currentSection = 'description';
    
    for (const line of lines) {
      if (line.startsWith('@swagger')) {
        continue;
      } else if (line.startsWith('@summary')) {
        swaggerData.summary = line.replace('@summary', '').trim();
      } else if (line.startsWith('@description')) {
        swaggerData.description = line.replace('@description', '').trim();
      } else if (line.startsWith('@tags')) {
        swaggerData.tags = line.replace('@tags', '').trim().split(',').map(t => t.trim());
      } else if (line.startsWith('@param')) {
        const paramMatch = line.match(/@param\s+{(\w+)}\s+(\w+)\s+(.*)/);
        if (paramMatch) {
          swaggerData.parameters.push({
            name: paramMatch[2],
            in: 'query',
            schema: { type: paramMatch[1] },
            description: paramMatch[3]
          });
        }
      } else if (line.startsWith('@body')) {
        const bodyMatch = line.match(/@body\s+{(\w+)}\s+(.*)/);
        if (bodyMatch) {
          swaggerData.requestBody = {
            description: bodyMatch[2],
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${bodyMatch[1]}` }
              }
            }
          };
        }
      } else if (line.startsWith('@returns')) {
        const returnMatch = line.match(/@returns\s+{(\w+)}\s+(.*)/);
        if (returnMatch) {
          swaggerData.responses['200'] = {
            description: returnMatch[2],
            content: {
              'application/json': {
                schema: { type: returnMatch[1] }
              }
            }
          };
        }
      } else if (line.startsWith('@response')) {
        const responseMatch = line.match(/@response\s+(\d+)\s+{(\w+)}\s+(.*)/);
        if (responseMatch) {
          swaggerData.responses[responseMatch[1]] = {
            description: responseMatch[3],
            content: {
              'application/json': {
                schema: { type: responseMatch[2] }
              }
            }
          };
        }
      } else if (line.trim() && currentSection === 'description' && !swaggerData.description) {
        swaggerData.description += line + ' ';
      }
    }

    // Limpiar descripción
    swaggerData.description = swaggerData.description.trim();

    // Agregar respuestas por defecto si no existen
    if (Object.keys(swaggerData.responses).length === 0) {
      swaggerData.responses['200'] = {
        description: 'Operación exitosa',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    return swaggerData;
  }

  /**
   * Parsea comentarios de esquemas
   */
  parseSchemaComment(schemaContent) {
    const lines = schemaContent.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };

    for (const line of lines) {
      if (line.startsWith('@property')) {
        const propMatch = line.match(/@property\s+{(\w+)}\s+(\w+)\s+(.*)/);
        if (propMatch) {
          const [, type, name, description] = propMatch;
          schema.properties[name] = {
            type: type,
            description: description
          };
        }
      } else if (line.startsWith('@required')) {
        const requiredFields = line.replace('@required', '').trim().split(',').map(f => f.trim());
        schema.required.push(...requiredFields);
      }
    }

    return schema;
  }

  /**
   * Genera especificación Swagger completa
   */
  generateSwaggerSpec(apiData) {
    return {
      ...this.config.swaggerConfig.definition,
      paths: apiData.paths,
      components: apiData.components
    };
  }

  /**
   * Guarda la especificación Swagger en JSON
   */
  async saveSwaggerSpec(swaggerSpec) {
    const specPath = `${this.config.outputDir}/swagger.json`;
    fs.writeFileSync(specPath, JSON.stringify(swaggerSpec, null, 2));
    
    // También guardar en YAML si es necesario
    const yamlPath = `${this.config.outputDir}/swagger.yaml`;
    const yamlContent = this.convertToYAML(swaggerSpec);
    fs.writeFileSync(yamlPath, yamlContent);
  }

  /**
   * Convierte especificación a YAML (básico)
   */
  convertToYAML(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.convertToYAML(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n`;
            yaml += this.convertToYAML(item, indent + 2);
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  /**
   * Genera interfaz Swagger UI
   */
  async generateSwaggerUI() {
    const swaggerUIHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation - ChatBot</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #007bff; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: './swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                tryItOutEnabled: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                onComplete: function() {
                    logger.debug('Swagger UI cargado exitosamente');
                }
            });
        };
    </script>
</body>
</html>`;

    fs.writeFileSync(`${this.config.outputDir}/index.html`, swaggerUIHTML);
  }

  /**
   * Escanea directorio recursivamente
   */
  scanDirectory(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.scanDirectory(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Obtiene estadísticas de la documentación generada
   */
  getStats(swaggerSpec) {
    const pathCount = Object.keys(swaggerSpec.paths || {}).length;
    const schemaCount = Object.keys(swaggerSpec.components?.schemas || {}).length;
    
    let endpointCount = 0;
    for (const path of Object.values(swaggerSpec.paths || {})) {
      endpointCount += Object.keys(path).length;
    }

    return {
      paths: pathCount,
      endpoints: endpointCount,
      schemas: schemaCount,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Valida la configuración del generador
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.outputDir) {
      errors.push('Directorio de salida no especificado');
    }
    
    if (!this.config.swaggerConfig?.definition?.info?.title) {
      errors.push('Título de API no especificado en configuración Swagger');
    }
    
    return errors;
  }
}

export default SwaggerGenerator;