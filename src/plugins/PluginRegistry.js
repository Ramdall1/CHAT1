import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

/**
 * Registro de plugins para descubrimiento y gestión de versiones
 */
class PluginRegistry extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      enabled: true,
      registryFile: './config/plugin-registry.json',
      cacheFile: './cache/plugin-cache.json',
      autoSave: true,
      autoLoad: true,
      validateChecksums: true,
      allowDuplicates: false,
      maxVersions: 5,
            
      // Configuración de búsqueda
      search: {
        enabled: true,
        indexFields: ['name', 'description', 'tags', 'author'],
        fuzzySearch: true,
        maxResults: 50
      },
            
      // Configuración de cache
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hora
        maxSize: 1000
      },
            
      // Configuración de validación
      validation: {
        strictMode: false,
        requireDescription: false,
        requireAuthor: false,
        requireLicense: false,
        maxNameLength: 100,
        maxDescriptionLength: 500
      },
            
      ...config
    };
        
    // Estado del registro
    this.state = {
      initialized: false,
      loading: false,
      saving: false
    };
        
    // Almacenamiento de plugins
    this.plugins = new Map();
    this.versions = new Map();
    this.tags = new Map();
    this.authors = new Map();
    this.categories = new Map();
        
    // Índices para búsqueda
    this.searchIndex = new Map();
    this.nameIndex = new Map();
    this.versionIndex = new Map();
        
    // Cache y estadísticas
    this.cache = new Map();
    this.statistics = {
      totalPlugins: 0,
      totalVersions: 0,
      totalAuthors: 0,
      totalTags: 0,
      totalCategories: 0,
      lastUpdate: null,
      searchQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
        
    // Timers
    this.saveTimer = null;
    this.cacheCleanupTimer = null;
        
    this._initializeRegistry();
  }
    
  /**
     * Inicializa el registro
     */
  async _initializeRegistry() {
    try {
      // Crear directorios necesarios
      await this._createDirectories();
            
      // Cargar registro existente
      if (this.config.autoLoad) {
        await this.load();
      }
            
      // Configurar limpieza automática
      this._setupCleanup();
            
      this.state.initialized = true;
      this.emit('initialized');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea los directorios necesarios
     */
  async _createDirectories() {
    const dirs = [
      path.dirname(this.config.registryFile),
      path.dirname(this.config.cacheFile)
    ];
        
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }
    
  /**
     * Configura la limpieza automática
     */
  _setupCleanup() {
    if (this.config.cache.enabled) {
      this.cacheCleanupTimer = setInterval(() => {
        this._cleanupCache();
      }, this.config.cache.ttl / 2);
    }
  }
    
  /**
     * Registra un plugin
     */
  async registerPlugin(pluginData) {
    if (!this.state.initialized) {
      throw new Error('Registry not initialized');
    }
        
    try {
      // Validar datos del plugin
      const validatedData = await this._validatePluginData(pluginData);
            
      // Generar ID único
      const pluginId = this._generatePluginId(validatedData);
            
      // Verificar duplicados
      if (!this.config.allowDuplicates && this.plugins.has(pluginId)) {
        throw new Error(`Plugin already registered: ${pluginId}`);
      }
            
      // Crear entrada del plugin
      const pluginEntry = {
        id: pluginId,
        ...validatedData,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checksum: this._calculateChecksum(validatedData)
      };
            
      // Registrar plugin
      this.plugins.set(pluginId, pluginEntry);
            
      // Actualizar índices
      await this._updateIndices(pluginEntry);
            
      // Actualizar estadísticas
      this._updateStatistics();
            
      // Guardar automáticamente
      if (this.config.autoSave) {
        await this._scheduleSave();
      }
            
      this.emit('pluginRegistered', { pluginId, plugin: pluginEntry });
            
      return pluginId;
            
    } catch (error) {
      this.emit('registrationError', { pluginData, error });
      throw error;
    }
  }
    
  /**
     * Valida los datos de un plugin
     */
  async _validatePluginData(pluginData) {
    const errors = [];
        
    // Campos requeridos
    const requiredFields = ['name', 'version', 'main'];
    for (const field of requiredFields) {
      if (!pluginData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
        
    // Validación de nombre
    if (pluginData.name) {
      if (pluginData.name.length > this.config.validation.maxNameLength) {
        errors.push(`Plugin name too long: ${pluginData.name.length} > ${this.config.validation.maxNameLength}`);
      }
            
      if (!/^[a-zA-Z0-9-_]+$/.test(pluginData.name)) {
        errors.push('Plugin name contains invalid characters');
      }
    }
        
    // Validación de versión
    if (pluginData.version && !this._isValidVersion(pluginData.version)) {
      errors.push(`Invalid version format: ${pluginData.version}`);
    }
        
    // Validación de descripción
    if (this.config.validation.requireDescription && !pluginData.description) {
      errors.push('Description is required');
    }
        
    if (pluginData.description && pluginData.description.length > this.config.validation.maxDescriptionLength) {
      errors.push(`Description too long: ${pluginData.description.length} > ${this.config.validation.maxDescriptionLength}`);
    }
        
    // Validación de autor
    if (this.config.validation.requireAuthor && !pluginData.author) {
      errors.push('Author is required');
    }
        
    // Validación de licencia
    if (this.config.validation.requireLicense && !pluginData.license) {
      errors.push('License is required');
    }
        
    // Validación de dependencias
    if (pluginData.dependencies) {
      for (const [depName, depVersion] of Object.entries(pluginData.dependencies)) {
        if (!this._isValidVersion(depVersion)) {
          errors.push(`Invalid dependency version: ${depName}@${depVersion}`);
        }
      }
    }
        
    if (errors.length > 0) {
      throw new Error(`Plugin validation failed: ${errors.join(', ')}`);
    }
        
    // Normalizar datos
    return {
      name: pluginData.name,
      version: pluginData.version,
      description: pluginData.description || '',
      author: pluginData.author || '',
      license: pluginData.license || '',
      main: pluginData.main,
      keywords: pluginData.keywords || [],
      tags: pluginData.tags || [],
      category: pluginData.category || 'general',
      dependencies: pluginData.dependencies || {},
      peerDependencies: pluginData.peerDependencies || {},
      permissions: pluginData.permissions || [],
      hooks: pluginData.hooks || [],
      config: pluginData.config || {},
      repository: pluginData.repository || '',
      homepage: pluginData.homepage || '',
      bugs: pluginData.bugs || '',
      engines: pluginData.engines || {},
      os: pluginData.os || [],
      cpu: pluginData.cpu || [],
      ...pluginData
    };
  }
    
  /**
     * Valida una versión
     */
  _isValidVersion(version) {
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?(\+[a-zA-Z0-9-]+)?$/;
    return versionRegex.test(version);
  }
    
  /**
     * Genera un ID único para el plugin
     */
  _generatePluginId(pluginData) {
    return `${pluginData.name}@${pluginData.version}`;
  }
    
  /**
     * Calcula el checksum de un plugin
     */
  _calculateChecksum(pluginData) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(pluginData, Object.keys(pluginData).sort()));
    return hash.digest('hex');
  }
    
  /**
     * Actualiza los índices de búsqueda
     */
  async _updateIndices(pluginEntry) {
    const { id, name, version, author, tags, category, keywords } = pluginEntry;
        
    // Índice de nombres
    if (!this.nameIndex.has(name)) {
      this.nameIndex.set(name, new Set());
    }
    this.nameIndex.get(name).add(id);
        
    // Índice de versiones
    const versionKey = `${name}@${version}`;
    this.versionIndex.set(versionKey, id);
        
    // Gestión de versiones
    if (!this.versions.has(name)) {
      this.versions.set(name, []);
    }
    const versions = this.versions.get(name);
    if (!versions.some(v => v.version === version)) {
      versions.push({ version, id, registeredAt: pluginEntry.registeredAt });
      versions.sort((a, b) => this._compareVersions(b.version, a.version));
            
      // Limitar número de versiones
      if (versions.length > this.config.maxVersions) {
        const removed = versions.splice(this.config.maxVersions);
        for (const removedVersion of removed) {
          this.plugins.delete(removedVersion.id);
        }
      }
    }
        
    // Índice de autores
    if (author) {
      if (!this.authors.has(author)) {
        this.authors.set(author, new Set());
      }
      this.authors.get(author).add(id);
    }
        
    // Índice de tags
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag).add(id);
    }
        
    // Índice de categorías
    if (category) {
      if (!this.categories.has(category)) {
        this.categories.set(category, new Set());
      }
      this.categories.get(category).add(id);
    }
        
    // Índice de búsqueda
    if (this.config.search.enabled) {
      const searchTerms = [
        name,
        pluginEntry.description,
        author,
        ...tags,
        ...keywords,
        category
      ].filter(Boolean);
            
      for (const term of searchTerms) {
        const normalizedTerm = term.toLowerCase();
        if (!this.searchIndex.has(normalizedTerm)) {
          this.searchIndex.set(normalizedTerm, new Set());
        }
        this.searchIndex.get(normalizedTerm).add(id);
      }
    }
  }
    
  /**
     * Compara dos versiones
     */
  _compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
        
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
            
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
        
    return 0;
  }
    
  /**
     * Desregistra un plugin
     */
  async unregisterPlugin(pluginId) {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
        
    try {
      const pluginEntry = this.plugins.get(pluginId);
            
      // Remover de índices
      await this._removeFromIndices(pluginEntry);
            
      // Remover plugin
      this.plugins.delete(pluginId);
            
      // Actualizar estadísticas
      this._updateStatistics();
            
      // Guardar automáticamente
      if (this.config.autoSave) {
        await this._scheduleSave();
      }
            
      this.emit('pluginUnregistered', { pluginId, plugin: pluginEntry });
            
    } catch (error) {
      this.emit('unregistrationError', { pluginId, error });
      throw error;
    }
  }
    
  /**
     * Remueve un plugin de los índices
     */
  async _removeFromIndices(pluginEntry) {
    const { id, name, version, author, tags, category } = pluginEntry;
        
    // Remover de índice de nombres
    if (this.nameIndex.has(name)) {
      this.nameIndex.get(name).delete(id);
      if (this.nameIndex.get(name).size === 0) {
        this.nameIndex.delete(name);
      }
    }
        
    // Remover de índice de versiones
    const versionKey = `${name}@${version}`;
    this.versionIndex.delete(versionKey);
        
    // Remover de gestión de versiones
    if (this.versions.has(name)) {
      const versions = this.versions.get(name);
      const index = versions.findIndex(v => v.id === id);
      if (index !== -1) {
        versions.splice(index, 1);
        if (versions.length === 0) {
          this.versions.delete(name);
        }
      }
    }
        
    // Remover de índice de autores
    if (author && this.authors.has(author)) {
      this.authors.get(author).delete(id);
      if (this.authors.get(author).size === 0) {
        this.authors.delete(author);
      }
    }
        
    // Remover de índice de tags
    for (const tag of tags) {
      if (this.tags.has(tag)) {
        this.tags.get(tag).delete(id);
        if (this.tags.get(tag).size === 0) {
          this.tags.delete(tag);
        }
      }
    }
        
    // Remover de índice de categorías
    if (category && this.categories.has(category)) {
      this.categories.get(category).delete(id);
      if (this.categories.get(category).size === 0) {
        this.categories.delete(category);
      }
    }
        
    // Remover de índice de búsqueda
    for (const [term, pluginIds] of this.searchIndex) {
      pluginIds.delete(id);
      if (pluginIds.size === 0) {
        this.searchIndex.delete(term);
      }
    }
  }
    
  /**
     * Busca plugins
     */
  search(query, options = {}) {
    if (!this.config.search.enabled) {
      throw new Error('Search is disabled');
    }
        
    const {
      limit = this.config.search.maxResults,
      offset = 0,
      category = null,
      author = null,
      tags = [],
      fuzzy = this.config.search.fuzzySearch
    } = options;
        
    this.statistics.searchQueries++;
        
    // Verificar cache
    const cacheKey = this._generateCacheKey('search', { query, options });
    if (this.config.cache.enabled && this.cache.has(cacheKey)) {
      this.statistics.cacheHits++;
      return this.cache.get(cacheKey).data;
    }
        
    this.statistics.cacheMisses++;
        
    try {
      let results = new Set();
            
      if (query) {
        const normalizedQuery = query.toLowerCase();
                
        // Búsqueda exacta
        for (const [term, pluginIds] of this.searchIndex) {
          if (term.includes(normalizedQuery)) {
            for (const pluginId of pluginIds) {
              results.add(pluginId);
            }
          }
        }
                
        // Búsqueda fuzzy
        if (fuzzy && results.size === 0) {
          for (const [term, pluginIds] of this.searchIndex) {
            if (this._fuzzyMatch(normalizedQuery, term)) {
              for (const pluginId of pluginIds) {
                results.add(pluginId);
              }
            }
          }
        }
      } else {
        // Sin query, devolver todos los plugins
        results = new Set(this.plugins.keys());
      }
            
      // Filtrar por categoría
      if (category && this.categories.has(category)) {
        const categoryPlugins = this.categories.get(category);
        results = new Set([...results].filter(id => categoryPlugins.has(id)));
      }
            
      // Filtrar por autor
      if (author && this.authors.has(author)) {
        const authorPlugins = this.authors.get(author);
        results = new Set([...results].filter(id => authorPlugins.has(id)));
      }
            
      // Filtrar por tags
      if (tags.length > 0) {
        for (const tag of tags) {
          if (this.tags.has(tag)) {
            const tagPlugins = this.tags.get(tag);
            results = new Set([...results].filter(id => tagPlugins.has(id)));
          } else {
            results.clear();
            break;
          }
        }
      }
            
      // Convertir a array y obtener datos completos
      const resultArray = Array.from(results)
        .map(id => this.plugins.get(id))
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
      // Aplicar paginación
      const paginatedResults = resultArray.slice(offset, offset + limit);
            
      const searchResult = {
        results: paginatedResults,
        total: resultArray.length,
        limit,
        offset,
        query,
        options
      };
            
      // Guardar en cache
      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          data: searchResult,
          timestamp: Date.now()
        });
      }
            
      return searchResult;
            
    } catch (error) {
      this.emit('searchError', { query, options, error });
      throw error;
    }
  }
    
  /**
     * Búsqueda fuzzy simple
     */
  _fuzzyMatch(query, target, threshold = 0.6) {
    if (query.length === 0) return true;
    if (target.length === 0) return false;
        
    const matrix = [];
        
    // Inicializar matriz
    for (let i = 0; i <= target.length; i++) {
      matrix[i] = [i];
    }
        
    for (let j = 0; j <= query.length; j++) {
      matrix[0][j] = j;
    }
        
    // Calcular distancia de Levenshtein
    for (let i = 1; i <= target.length; i++) {
      for (let j = 1; j <= query.length; j++) {
        if (target.charAt(i - 1) === query.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
        
    const distance = matrix[target.length][query.length];
    const similarity = 1 - distance / Math.max(query.length, target.length);
        
    return similarity >= threshold;
  }
    
  /**
     * Obtiene un plugin por ID
     */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }
    
  /**
     * Obtiene un plugin por nombre y versión
     */
  getPluginByNameAndVersion(name, version) {
    const versionKey = `${name}@${version}`;
    const pluginId = this.versionIndex.get(versionKey);
    return pluginId ? this.plugins.get(pluginId) : null;
  }
    
  /**
     * Obtiene la última versión de un plugin
     */
  getLatestVersion(name) {
    const versions = this.versions.get(name);
    if (!versions || versions.length === 0) {
      return null;
    }
        
    const latestVersion = versions[0];
    return this.plugins.get(latestVersion.id);
  }
    
  /**
     * Obtiene todas las versiones de un plugin
     */
  getVersions(name) {
    const versions = this.versions.get(name);
    if (!versions) {
      return [];
    }
        
    return versions.map(v => this.plugins.get(v.id)).filter(Boolean);
  }
    
  /**
     * Obtiene plugins por autor
     */
  getPluginsByAuthor(author) {
    const pluginIds = this.authors.get(author);
    if (!pluginIds) {
      return [];
    }
        
    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter(Boolean);
  }
    
  /**
     * Obtiene plugins por tag
     */
  getPluginsByTag(tag) {
    const pluginIds = this.tags.get(tag);
    if (!pluginIds) {
      return [];
    }
        
    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter(Boolean);
  }
    
  /**
     * Obtiene plugins por categoría
     */
  getPluginsByCategory(category) {
    const pluginIds = this.categories.get(category);
    if (!pluginIds) {
      return [];
    }
        
    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter(Boolean);
  }
    
  /**
     * Obtiene todos los plugins
     */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }
    
  /**
     * Obtiene todos los autores
     */
  getAllAuthors() {
    return Array.from(this.authors.keys());
  }
    
  /**
     * Obtiene todos los tags
     */
  getAllTags() {
    return Array.from(this.tags.keys());
  }
    
  /**
     * Obtiene todas las categorías
     */
  getAllCategories() {
    return Array.from(this.categories.keys());
  }
    
  /**
     * Actualiza las estadísticas
     */
  _updateStatistics() {
    this.statistics.totalPlugins = this.plugins.size;
    this.statistics.totalVersions = Array.from(this.versions.values())
      .reduce((total, versions) => total + versions.length, 0);
    this.statistics.totalAuthors = this.authors.size;
    this.statistics.totalTags = this.tags.size;
    this.statistics.totalCategories = this.categories.size;
    this.statistics.lastUpdate = new Date().toISOString();
  }
    
  /**
     * Obtiene estadísticas del registro
     */
  getStatistics() {
    return { ...this.statistics };
  }
    
  /**
     * Genera una clave de cache
     */
  _generateCacheKey(operation, data) {
    const hash = crypto.createHash('md5');
    hash.update(`${operation}:${JSON.stringify(data)}`);
    return hash.digest('hex');
  }
    
  /**
     * Limpia el cache
     */
  _cleanupCache() {
    if (!this.config.cache.enabled) {
      return;
    }
        
    const now = Date.now();
    const ttl = this.config.cache.ttl;
        
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
      }
    }
        
    // Limitar tamaño del cache
    if (this.cache.size > this.config.cache.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
      const toDelete = entries.slice(0, entries.length - this.config.cache.maxSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
    
  /**
     * Programa el guardado automático
     */
  async _scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
        
    this.saveTimer = setTimeout(async() => {
      try {
        await this.save();
      } catch (error) {
        this.emit('saveError', error);
      }
    }, 1000); // Guardar después de 1 segundo
  }
    
  /**
     * Guarda el registro
     */
  async save() {
    if (this.state.saving) {
      return;
    }
        
    try {
      this.state.saving = true;
            
      const registryData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        plugins: Array.from(this.plugins.entries()),
        versions: Array.from(this.versions.entries()),
        statistics: this.statistics
      };
            
      await fs.writeFile(
        this.config.registryFile,
        JSON.stringify(registryData, null, 2),
        'utf8'
      );
            
      this.emit('saved');
            
    } catch (error) {
      this.emit('saveError', error);
      throw error;
    } finally {
      this.state.saving = false;
    }
  }
    
  /**
     * Carga el registro
     */
  async load() {
    if (this.state.loading) {
      return;
    }
        
    try {
      this.state.loading = true;
            
      const registryContent = await fs.readFile(this.config.registryFile, 'utf8');
      const registryData = JSON.parse(registryContent);
            
      // Cargar plugins
      if (registryData.plugins) {
        this.plugins = new Map(registryData.plugins);
      }
            
      // Cargar versiones
      if (registryData.versions) {
        this.versions = new Map(registryData.versions);
      }
            
      // Cargar estadísticas
      if (registryData.statistics) {
        this.statistics = { ...this.statistics, ...registryData.statistics };
      }
            
      // Reconstruir índices
      await this._rebuildIndices();
            
      this.emit('loaded');
            
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Archivo no existe, crear uno nuevo
        await this.save();
      } else {
        this.emit('loadError', error);
        throw error;
      }
    } finally {
      this.state.loading = false;
    }
  }
    
  /**
     * Reconstruye los índices
     */
  async _rebuildIndices() {
    // Limpiar índices existentes
    this.nameIndex.clear();
    this.versionIndex.clear();
    this.authors.clear();
    this.tags.clear();
    this.categories.clear();
    this.searchIndex.clear();
        
    // Reconstruir índices
    for (const plugin of this.plugins.values()) {
      await this._updateIndices(plugin);
    }
  }
    
  /**
     * Limpia el registro
     */
  clear() {
    this.plugins.clear();
    this.versions.clear();
    this.nameIndex.clear();
    this.versionIndex.clear();
    this.authors.clear();
    this.tags.clear();
    this.categories.clear();
    this.searchIndex.clear();
    this.cache.clear();
        
    this._updateStatistics();
    this.emit('cleared');
  }
    
  /**
     * Habilita el registro
     */
  enable() {
    this.config.enabled = true;
    this.emit('enabled');
  }
    
  /**
     * Deshabilita el registro
     */
  disable() {
    this.config.enabled = false;
    this.emit('disabled');
  }
    
  /**
     * Destruye el registro
     */
  async destroy() {
    try {
      // Guardar antes de destruir
      if (this.config.autoSave) {
        await this.save();
      }
            
      // Limpiar timers
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }
            
      if (this.cacheCleanupTimer) {
        clearInterval(this.cacheCleanupTimer);
      }
            
      // Limpiar datos
      this.clear();
            
      // Remover listeners
      this.removeAllListeners();
            
      this.emit('destroyed');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}

export default PluginRegistry;