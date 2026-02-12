import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../core/logger.js';

/**
 * Motor de plantillas para notificaciones
 * Soporta múltiples formatos y localización
 */
class TemplateEngine extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: true,
      engine: 'handlebars', // handlebars, mustache, ejs, custom
      cacheEnabled: true,
      cacheSize: 1000,
            
      // Configuración de directorios
      templatesDir: './templates',
      partialsDir: './templates/partials',
      layoutsDir: './templates/layouts',
            
      // Configuración de localización
      localization: {
        enabled: true,
        defaultLocale: 'es',
        fallbackLocale: 'en',
        localesDir: './locales',
        autoDetect: true
      },
            
      // Configuración de formatos
      formats: {
        html: {
          enabled: true,
          extension: '.html',
          contentType: 'text/html'
        },
        text: {
          enabled: true,
          extension: '.txt',
          contentType: 'text/plain'
        },
        markdown: {
          enabled: true,
          extension: '.md',
          contentType: 'text/markdown'
        },
        json: {
          enabled: true,
          extension: '.json',
          contentType: 'application/json'
        }
      },
            
      // Configuración de helpers
      helpers: {
        enabled: true,
        builtIn: true,
        custom: {}
      },
            
      // Configuración de validación
      validation: {
        enabled: true,
        strict: false,
        requiredFields: [],
        allowedTags: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div', 'span'],
        sanitize: true
      },
            
      // Configuración de compilación
      compilation: {
        precompile: false,
        minify: false,
        compress: false
      },
            
      // Configuración de watch
      watch: {
        enabled: false,
        debounce: 1000
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Cache de plantillas compiladas
    this.templateCache = new Map();
        
    // Cache de parciales
    this.partialsCache = new Map();
        
    // Cache de layouts
    this.layoutsCache = new Map();
        
    // Cache de localizaciones
    this.localesCache = new Map();
        
    // Helpers registrados
    this.helpers = new Map();
        
    // Watchers de archivos
    this.watchers = new Map();
        
    // Estadísticas del motor
    this.engineStats = {
      startTime: Date.now(),
      templatesCompiled: 0,
      templatesRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageRenderTime: 0,
      lastRender: null
    };
        
    // Motor de plantillas actual
    this.currentEngine = null;
        
    // Logger
    this.logger = createLogger('TEMPLATE_ENGINE');
  }
    
  /**
   * Inicializa el motor de plantillas
   * @async
   * @returns {Promise<void>}
   * @throws {Error} Si falla la inicialización del motor
   */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      // Inicializar motor de plantillas
      await this._initializeEngine();
            
      // Cargar helpers built-in
      if (this.config.helpers.builtIn) {
        this._registerBuiltInHelpers();
      }
            
      // Registrar helpers personalizados
      this._registerCustomHelpers();
            
      // Cargar plantillas existentes
      await this._loadExistingTemplates();
            
      // Cargar localizaciones
      if (this.config.localization.enabled) {
        await this._loadLocalizations();
      }
            
      // Configurar watchers
      if (this.config.watch.enabled) {
        this._setupWatchers();
      }
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
   * Compila una plantilla
   * @async
   * @param {string} templateName - Nombre de la plantilla
   * @param {string} source - Código fuente de la plantilla
   * @param {Object} [options={}] - Opciones de compilación
   * @param {boolean} [options.cache=true] - Si cachear la plantilla compilada
   * @param {string} [options.format='html'] - Formato de la plantilla
   * @returns {Promise<Function>} Plantilla compilada
   * @throws {Error} Si falla la compilación
   */
  async compile(templateName, source, options = {}) {
    const startTime = Date.now();
        
    try {
      const cacheKey = this._getCacheKey(templateName, options);
            
      // Verificar cache
      if (this.config.cacheEnabled && this.templateCache.has(cacheKey)) {
        this.engineStats.cacheHits++;
        return this.templateCache.get(cacheKey);
      }
            
      this.engineStats.cacheMisses++;
            
      // Validar plantilla
      if (this.config.validation.enabled) {
        this._validateTemplate(source, options);
      }
            
      // Procesar includes y partials
      const processedSource = await this._processIncludes(source);
            
      // Compilar con el motor actual
      const compiled = await this._compileWithEngine(processedSource, options);
            
      // Guardar en cache
      if (this.config.cacheEnabled) {
        this._addToCache(cacheKey, compiled);
      }
            
      // Actualizar estadísticas
      this.engineStats.templatesCompiled++;
      const compileTime = Date.now() - startTime;
            
      this.emit('templateCompiled', {
        templateName,
        cacheKey,
        compileTime,
        cached: false
      });
            
      return compiled;
            
    } catch (error) {
      this.engineStats.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
   * Renderiza una plantilla con datos
   * @async
   * @param {string} templateName - Nombre de la plantilla a renderizar
   * @param {Object} [data={}] - Datos para la plantilla
   * @param {Object} [options={}] - Opciones de renderizado
   * @param {string} [options.layout] - Layout a aplicar
   * @param {string} [options.locale] - Idioma para localización
   * @param {string} [options.format='html'] - Formato de salida
   * @returns {Promise<string>} Plantilla renderizada
   * @throws {Error} Si la plantilla no existe o falla el renderizado
   */
  async render(templateName, data = {}, options = {}) {
    const startTime = Date.now();
        
    try {
      // Obtener plantilla compilada
      let compiled = await this._getCompiledTemplate(templateName, options);
            
      // Preparar datos de renderizado
      const renderData = await this._prepareRenderData(data, options);
            
      // Aplicar layout si está especificado
      if (options.layout) {
        compiled = await this._applyLayout(compiled, options.layout, renderData);
      }
            
      // Renderizar plantilla
      const rendered = await this._renderWithEngine(compiled, renderData, options);
            
      // Post-procesar resultado
      const processed = await this._postProcessRender(rendered, options);
            
      // Actualizar estadísticas
      const renderTime = Date.now() - startTime;
      this.engineStats.templatesRendered++;
      this.engineStats.averageRenderTime = 
                (this.engineStats.averageRenderTime + renderTime) / 2;
      this.engineStats.lastRender = Date.now();
            
      this.emit('templateRendered', {
        templateName,
        renderTime,
        dataSize: JSON.stringify(data).length,
        outputSize: processed.length
      });
            
      return processed;
            
    } catch (error) {
      this.engineStats.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Renderiza una plantilla desde string
     */
  async renderString(templateString, data = {}, options = {}) {
    const templateName = `inline_${Date.now()}_${Math.random()}`;
        
    // Compilar plantilla inline
    const compiled = await this.compile(templateName, templateString, {
      ...options,
      inline: true
    });
        
    // Renderizar
    return this._renderWithEngine(compiled, data, options);
  }
    
  /**
   * Registra un helper personalizado
   * @param {string} name - Nombre del helper
   * @param {Function} helperFunction - Función del helper
   * @throws {Error} Si el nombre ya está registrado
   */
  registerHelper(name, helperFunction) {
    this.helpers.set(name, helperFunction);
        
    // Registrar en el motor actual
    if (this.currentEngine && this.currentEngine.registerHelper) {
      this.currentEngine.registerHelper(name, helperFunction);
    }
        
    this.emit('helperRegistered', { name });
  }
    
  /**
     * Registra múltiples helpers
     */
  registerHelpers(helpers) {
    for (const [name, helperFunction] of Object.entries(helpers)) {
      this.registerHelper(name, helperFunction);
    }
  }
    
  /**
     * Registra un partial
     */
  async registerPartial(name, source) {
    const compiled = await this._compileWithEngine(source, { partial: true });
    this.partialsCache.set(name, compiled);
        
    // Registrar en el motor actual
    if (this.currentEngine && this.currentEngine.registerPartial) {
      this.currentEngine.registerPartial(name, compiled);
    }
        
    this.emit('partialRegistered', { name });
  }
    
  /**
     * Carga una plantilla desde archivo
     */
  async loadTemplate(templateName, format = 'html') {
    const templatePath = this._getTemplatePath(templateName, format);
        
    try {
      const source = await fs.readFile(templatePath, 'utf8');
      return this.compile(templateName, source, { format });
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template not found: ${templatePath}`);
      }
      throw error;
    }
  }
    
  /**
     * Guarda una plantilla en archivo
     */
  async saveTemplate(templateName, source, format = 'html') {
    const templatePath = this._getTemplatePath(templateName, format);
    const templateDir = path.dirname(templatePath);
        
    // Crear directorio si no existe
    await fs.mkdir(templateDir, { recursive: true });
        
    // Guardar archivo
    await fs.writeFile(templatePath, source, 'utf8');
        
    this.emit('templateSaved', { templateName, format, path: templatePath });
  }
    
  /**
     * Lista todas las plantillas disponibles
     */
  async listTemplates() {
    const templates = [];
        
    for (const [formatName, formatConfig] of Object.entries(this.config.formats)) {
      if (!formatConfig.enabled) continue;
            
      try {
        const templatesDir = this.config.templatesDir;
        const files = await this._getFilesRecursive(templatesDir, formatConfig.extension);
                
        for (const file of files) {
          const relativePath = path.relative(templatesDir, file);
          const templateName = relativePath.replace(formatConfig.extension, '');
                    
          templates.push({
            name: templateName,
            format: formatName,
            path: file,
            extension: formatConfig.extension
          });
        }
      } catch (error) {
        // Directorio no existe, continuar
      }
    }
        
    return templates;
  }
    
  /**
     * Valida una plantilla
     */
  validateTemplate(source, options = {}) {
    try {
      this._validateTemplate(source, options);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
    
  /**
     * Limpia el cache de plantillas
     */
  clearCache() {
    this.templateCache.clear();
    this.partialsCache.clear();
    this.layoutsCache.clear();
        
    this.emit('cacheCleared');
  }
    
  /**
     * Obtiene estadísticas del motor
     */
  getStatistics() {
    return {
      engine: this.engineStats,
      cache: {
        templates: this.templateCache.size,
        partials: this.partialsCache.size,
        layouts: this.layoutsCache.size,
        locales: this.localesCache.size,
        hitRate: this.engineStats.cacheHits + this.engineStats.cacheMisses > 0 ?
          (this.engineStats.cacheHits / (this.engineStats.cacheHits + this.engineStats.cacheMisses)) * 100 : 0
      },
      helpers: {
        registered: this.helpers.size,
        builtIn: this.config.helpers.builtIn ? this._getBuiltInHelpersCount() : 0
      },
      performance: {
        uptime: Date.now() - this.engineStats.startTime,
        state: this.state,
        errors: this.engineStats.errors,
        averageRenderTime: this.engineStats.averageRenderTime
      }
    };
  }
    
  /**
     * Destruye el motor de plantillas
     */
  destroy() {
    // Detener watchers
    for (const watcher of this.watchers.values()) {
      if (watcher.close) {
        watcher.close();
      }
    }
    this.watchers.clear();
        
    // Limpiar caches
    this.clearCache();
    this.helpers.clear();
    this.localesCache.clear();
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  async _initializeEngine() {
    switch (this.config.engine) {
    case 'handlebars':
      this.currentEngine = await this._createHandlebarsEngine();
      break;
    case 'mustache':
      this.currentEngine = await this._createMustacheEngine();
      break;
    case 'ejs':
      this.currentEngine = await this._createEJSEngine();
      break;
    case 'custom':
      this.currentEngine = await this._createCustomEngine();
      break;
    default:
      throw new Error(`Unsupported template engine: ${this.config.engine}`);
    }
  }
    
  async _createHandlebarsEngine() {
    // Implementación simplificada de Handlebars
    return {
      compile: (source) => {
        return (data) => {
          let result = source;
                    
          // Reemplazar variables {{variable}}
          result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return this._getNestedValue(data, key) || '';
          });
                    
          // Reemplazar bloques {{#if condition}}
          result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
            const value = this._getNestedValue(data, condition);
            return value ? content : '';
          });
                    
          // Reemplazar bloques {{#each array}}
          result = result.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, content) => {
            const array = this._getNestedValue(data, arrayName);
            if (Array.isArray(array)) {
              return array.map(item => {
                let itemContent = content;
                itemContent = itemContent.replace(/\{\{this\}\}/g, item);
                itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (m, key) => {
                  return item[key] || '';
                });
                return itemContent;
              }).join('');
            }
            return '';
          });
                    
          return result;
        };
      },
      registerHelper: (name, fn) => {
        // Implementación simplificada
      },
      registerPartial: (name, template) => {
        // Implementación simplificada
      }
    };
  }
    
  async _createMustacheEngine() {
    // Implementación simplificada de Mustache
    return {
      compile: (source) => {
        return (data) => {
          let result = source;
                    
          // Reemplazar variables {{variable}}
          result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return this._getNestedValue(data, key) || '';
          });
                    
          return result;
        };
      }
    };
  }
    
  async _createEJSEngine() {
    // Implementación simplificada de EJS
    return {
      compile: (source) => {
        return (data) => {
          let result = source;
                    
          // Reemplazar variables <%= variable %>
          result = result.replace(/<%=\s*(\w+)\s*%>/g, (match, key) => {
            return this._getNestedValue(data, key) || '';
          });
                    
          return result;
        };
      }
    };
  }
    
  async _createCustomEngine() {
    // Motor personalizable
    return {
      compile: (source) => {
        return (data) => {
          // Implementación básica personalizable
          return source.replace(/\$\{(\w+)\}/g, (match, key) => {
            return this._getNestedValue(data, key) || '';
          });
        };
      }
    };
  }
    
  _registerBuiltInHelpers() {
    // Helpers de fecha
    this.registerHelper('formatDate', (date, format = 'YYYY-MM-DD') => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    });
        
    // Helpers de texto
    this.registerHelper('uppercase', (text) => {
      return text ? text.toString().toUpperCase() : '';
    });
        
    this.registerHelper('lowercase', (text) => {
      return text ? text.toString().toLowerCase() : '';
    });
        
    this.registerHelper('capitalize', (text) => {
      return text ? text.toString().charAt(0).toUpperCase() + text.slice(1) : '';
    });
        
    // Helpers de números
    this.registerHelper('formatNumber', (number, decimals = 2) => {
      return Number(number).toFixed(decimals);
    });
        
    // Helpers de URLs
    this.registerHelper('urlEncode', (text) => {
      return encodeURIComponent(text);
    });
        
    // Helpers de arrays
    this.registerHelper('join', (array, separator = ', ') => {
      return Array.isArray(array) ? array.join(separator) : '';
    });
        
    // Helpers condicionales
    this.registerHelper('eq', (a, b) => {
      return a === b;
    });
        
    this.registerHelper('ne', (a, b) => {
      return a !== b;
    });
        
    this.registerHelper('gt', (a, b) => {
      return a > b;
    });
        
    this.registerHelper('lt', (a, b) => {
      return a < b;
    });
  }
    
  _registerCustomHelpers() {
    for (const [name, helperFunction] of Object.entries(this.config.helpers.custom)) {
      this.registerHelper(name, helperFunction);
    }
  }
    
  async _loadExistingTemplates() {
    try {
      const templates = await this.listTemplates();
            
      for (const template of templates) {
        if (this.config.compilation.precompile) {
          await this.loadTemplate(template.name, template.format);
        }
      }
    } catch (error) {
      // No hay plantillas existentes, continuar
    }
  }
    
  async _loadLocalizations() {
    try {
      const localesDir = this.config.localization.localesDir;
      const files = await fs.readdir(localesDir);
            
      for (const file of files) {
        if (file.endsWith('.json')) {
          const locale = file.replace('.json', '');
          const localePath = path.join(localesDir, file);
          const localeData = JSON.parse(await fs.readFile(localePath, 'utf8'));
                    
          this.localesCache.set(locale, localeData);
        }
      }
    } catch (error) {
      // Directorio de locales no existe, continuar
    }
  }
    
  _setupWatchers() {
    // Implementación simplificada de watchers
    // En una implementación real, usaríamos chokidar o similar
  }
    
  async _getCompiledTemplate(templateName, options) {
    const cacheKey = this._getCacheKey(templateName, options);
        
    // Verificar cache
    if (this.config.cacheEnabled && this.templateCache.has(cacheKey)) {
      this.engineStats.cacheHits++;
      return this.templateCache.get(cacheKey);
    }
        
    // Cargar y compilar plantilla
    const format = options.format || 'html';
    return this.loadTemplate(templateName, format);
  }
    
  async _prepareRenderData(data, options) {
    const renderData = { ...data };
        
    // Agregar datos de localización
    if (this.config.localization.enabled) {
      const locale = options.locale || this.config.localization.defaultLocale;
      const localeData = this.localesCache.get(locale) || 
                             this.localesCache.get(this.config.localization.fallbackLocale) || {};
            
      renderData._locale = locale;
      renderData._t = localeData;
    }
        
    // Agregar helpers de datos
    renderData._now = new Date();
    renderData._timestamp = Date.now();
        
    return renderData;
  }
    
  async _applyLayout(compiled, layoutName, data) {
    const layoutPath = path.join(this.config.layoutsDir, `${layoutName}.html`);
        
    try {
      const layoutSource = await fs.readFile(layoutPath, 'utf8');
      const layoutCompiled = await this._compileWithEngine(layoutSource);
            
      // Renderizar contenido en el layout
      const content = await this._renderWithEngine(compiled, data);
      const layoutData = { ...data, content };
            
      return this._renderWithEngine(layoutCompiled, layoutData);
    } catch (error) {
      // Layout no encontrado, usar plantilla original
      return compiled;
    }
  }
    
  async _compileWithEngine(source, options = {}) {
    if (!this.currentEngine || !this.currentEngine.compile) {
      throw new Error('Template engine not initialized');
    }
        
    return this.currentEngine.compile(source, options);
  }
    
  async _renderWithEngine(compiled, data, options = {}) {
    if (typeof compiled === 'function') {
      return compiled(data);
    }
        
    throw new Error('Invalid compiled template');
  }
    
  async _processIncludes(source) {
    // Procesar includes {{> partial}}
    return source.replace(/\{\{>\s*(\w+)\s*\}\}/g, (match, partialName) => {
      const partial = this.partialsCache.get(partialName);
      return partial ? partial : match;
    });
  }
    
  async _postProcessRender(rendered, options) {
    let result = rendered;
        
    // Minificar si está habilitado
    if (this.config.compilation.minify) {
      result = this._minifyOutput(result, options.format);
    }
        
    // Sanitizar si está habilitado
    if (this.config.validation.sanitize) {
      result = this._sanitizeOutput(result);
    }
        
    return result;
  }
    
  _minifyOutput(output, format) {
    if (format === 'html') {
      // Minificación básica de HTML
      return output
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
    }
        
    return output;
  }
    
  _sanitizeOutput(output) {
    // Sanitización básica
    const allowedTags = this.config.validation.allowedTags;
        
    if (allowedTags.length > 0) {
      // Implementación simplificada de sanitización
      return output.replace(/<(?!\/?(?:${allowedTags.join('|')})\b)[^>]*>/gi, '');
    }
        
    return output;
  }
    
  _validateTemplate(source, options) {
    if (!source || typeof source !== 'string') {
      throw new Error('Template source must be a non-empty string');
    }
        
    if (this.config.validation.strict) {
      // Validaciones estrictas
      this._validateSyntax(source);
      this._validateRequiredFields(source, options);
    }
  }
    
  _validateSyntax(source) {
    // Validación básica de sintaxis
    const openTags = (source.match(/\{\{/g) || []).length;
    const closeTags = (source.match(/\}\}/g) || []).length;
        
    if (openTags !== closeTags) {
      throw new Error('Unmatched template tags');
    }
  }
    
  _validateRequiredFields(source, options) {
    const requiredFields = this.config.validation.requiredFields;
        
    for (const field of requiredFields) {
      const regex = new RegExp(`\\{\\{\\s*${field}\\s*\\}\\}`);
      if (!regex.test(source)) {
        throw new Error(`Required field missing: ${field}`);
      }
    }
  }
    
  _getCacheKey(templateName, options) {
    const keyParts = [
      templateName,
      options.format || 'html',
      options.locale || this.config.localization.defaultLocale,
      options.layout || 'none'
    ];
        
    return keyParts.join('|');
  }
    
  _addToCache(key, compiled) {
    // Verificar límite de cache
    if (this.templateCache.size >= this.config.cacheSize) {
      // Eliminar la entrada más antigua (LRU simple)
      const firstKey = this.templateCache.keys().next().value;
      this.templateCache.delete(firstKey);
    }
        
    this.templateCache.set(key, compiled);
  }
    
  _getTemplatePath(templateName, format) {
    const formatConfig = this.config.formats[format];
    if (!formatConfig) {
      throw new Error(`Unsupported format: ${format}`);
    }
        
    return path.join(
      this.config.templatesDir,
      `${templateName}${formatConfig.extension}`
    );
  }
    
  async _getFilesRecursive(dir, extension) {
    const files = [];
        
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
            
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
                
        if (entry.isDirectory()) {
          const subFiles = await this._getFilesRecursive(fullPath, extension);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directorio no existe o no es accesible
    }
        
    return files;
  }
    
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
    
  _getBuiltInHelpersCount() {
    // Contar helpers built-in registrados
    const builtInHelpers = [
      'formatDate', 'uppercase', 'lowercase', 'capitalize',
      'formatNumber', 'urlEncode', 'join', 'eq', 'ne', 'gt', 'lt'
    ];
        
    return builtInHelpers.filter(helper => this.helpers.has(helper)).length;
  }
    
  _validateConfig() {
    if (!this.config.templatesDir) {
      throw new Error('Templates directory must be specified');
    }
        
    if (!this.config.engine) {
      throw new Error('Template engine must be specified');
    }
        
    if (this.config.cacheSize <= 0) {
      throw new Error('Cache size must be positive');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      this.logger.error('Template engine error:', error);
    });
  }
}

export default TemplateEngine;