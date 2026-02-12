/**
 * Cargador de componentes modulares
 * Maneja la carga dinámica, inicialización y gestión del ciclo de vida de componentes
 */
class ComponentLoader {
  constructor() {
    this.components = new Map();
    this.loadedScripts = new Set();
    this.componentRegistry = new Map();
    this.dependencies = new Map();
    this.loadingPromises = new Map();

    this.basePath = '/client/components';
    this.scriptCache = new Map();

    this.registerBuiltInComponents();
  }

  /**
   * Registra componentes integrados del sistema
   */
  registerBuiltInComponents() {
    const builtInComponents = {
      BaseComponent: {
        path: '/core/BaseComponent.js',
        dependencies: [],
      },
      ChatInterface: {
        path: '/chat/ChatInterface.js',
        dependencies: ['BaseComponent'],
      },
      NavigationManager: {
        path: '/navigation/NavigationManager.js',
        dependencies: ['BaseComponent'],
      },
      TemplateManager: {
        path: '/templates/TemplateManager.js',
        dependencies: ['BaseComponent'],
      },
      DashboardManager: {
        path: '/dashboard/DashboardManager.js',
        dependencies: ['BaseComponent'],
      },
      ContactManager: {
        path: '/contacts/ContactManager.js',
        dependencies: ['BaseComponent'],
      },
      AnalyticsManager: {
        path: '/analytics/AnalyticsManager.js',
        dependencies: ['BaseComponent'],
      },
      SettingsManager: {
        path: '/settings/SettingsManager.js',
        dependencies: ['BaseComponent'],
      },
      ReportsManager: {
        path: '/reports/ReportsManager.js',
        dependencies: ['BaseComponent'],
      },
    };

    Object.entries(builtInComponents).forEach(([name, config]) => {
      this.registerComponent(name, config);
    });
  }

  /**
   * Registra un componente en el sistema
   * @param {string} name - Nombre del componente
   * @param {Object} config - Configuración del componente
   */
  registerComponent(name, config) {
    this.componentRegistry.set(name, {
      name,
      path: config.path,
      dependencies: config.dependencies || [],
      loaded: false,
      constructor: null,
      instances: new Set(),
    });

    // Registrar dependencias
    if (config.dependencies && config.dependencies.length > 0) {
      this.dependencies.set(name, config.dependencies);
    }
  }

  /**
   * Carga un componente de forma asíncrona
   * @param {string} componentName - Nombre del componente a cargar
   * @param {Object} options - Opciones de configuración
   * @returns {Promise<Function>} Constructor del componente
   */
  async loadComponent(componentName, options = {}) {
    // Verificar si ya está siendo cargado
    if (this.loadingPromises.has(componentName)) {
      return this.loadingPromises.get(componentName);
    }

    const loadPromise = this._loadComponentInternal(componentName, options);
    this.loadingPromises.set(componentName, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(componentName);
      return result;
    } catch (error) {
      this.loadingPromises.delete(componentName);
      throw error;
    }
  }

  /**
   * Implementación interna de carga de componentes
   * @private
   */
  async _loadComponentInternal(componentName, options) {
    const componentInfo = this.componentRegistry.get(componentName);

    if (!componentInfo) {
      throw new Error(`Componente '${componentName}' no está registrado`);
    }

    // Si ya está cargado, devolver el constructor
    if (componentInfo.loaded && componentInfo.constructor) {
      return componentInfo.constructor;
    }

    try {
      // Cargar dependencias primero
      await this.loadDependencies(componentName);

      // Cargar el script del componente
      await this.loadScript(componentInfo.path);

      // Obtener el constructor del componente
      const constructor = this.getComponentConstructor(componentName);

      if (!constructor) {
        throw new Error(
          `Constructor para '${componentName}' no encontrado después de cargar el script`
        );
      }

      // Marcar como cargado y guardar constructor
      componentInfo.loaded = true;
      componentInfo.constructor = constructor;

      console.log(`Componente '${componentName}' cargado correctamente`);
      return constructor;
    } catch (error) {
      console.error(`Error cargando componente '${componentName}':`, error);
      throw error;
    }
  }

  /**
   * Carga las dependencias de un componente
   * @param {string} componentName - Nombre del componente
   */
  async loadDependencies(componentName) {
    const dependencies = this.dependencies.get(componentName) || [];

    if (dependencies.length === 0) {
      return;
    }

    console.log(`Cargando dependencias para '${componentName}':`, dependencies);

    // Cargar todas las dependencias en paralelo
    const dependencyPromises = dependencies.map(dep => this.loadComponent(dep));
    await Promise.all(dependencyPromises);
  }

  /**
   * Carga un script de forma dinámica
   * @param {string} scriptPath - Ruta del script
   */
  async loadScript(scriptPath) {
    const fullPath = this.basePath + scriptPath;

    // Verificar si ya está cargado
    if (this.loadedScripts.has(fullPath)) {
      return;
    }

    // Verificar cache
    if (this.scriptCache.has(fullPath)) {
      return this.scriptCache.get(fullPath);
    }

    const loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = fullPath;
      script.type = 'module';

      script.onload = () => {
        this.loadedScripts.add(fullPath);
        console.log(`Script cargado: ${fullPath}`);
        resolve();
      };

      script.onerror = () => {
        console.error(`Error cargando script: ${fullPath}`);
        reject(new Error(`No se pudo cargar el script: ${fullPath}`));
      };

      document.head.appendChild(script);
    });

    this.scriptCache.set(fullPath, loadPromise);
    return loadPromise;
  }

  /**
   * Obtiene el constructor de un componente desde el contexto global
   * @param {string} componentName - Nombre del componente
   */
  getComponentConstructor(componentName) {
    // Intentar obtener desde window
    if (window[componentName] && typeof window[componentName] === 'function') {
      return window[componentName];
    }

    // Buscar en namespaces comunes
    const namespaces = ['Components', 'App', 'WhatsApp'];

    for (const namespace of namespaces) {
      if (window[namespace] && window[namespace][componentName]) {
        return window[namespace][componentName];
      }
    }

    return null;
  }

  /**
   * Crea una instancia de un componente
   * @param {string} componentName - Nombre del componente
   * @param {HTMLElement} container - Contenedor del componente
   * @param {Object} options - Opciones de configuración
   */
  async createComponent(componentName, container, options = {}) {
    try {
      // Cargar el componente si no está cargado
      const ComponentClass = await this.loadComponent(componentName);

      // Crear instancia
      const instance = new ComponentClass(container, options);

      // Registrar la instancia
      const componentInfo = this.componentRegistry.get(componentName);
      if (componentInfo) {
        componentInfo.instances.add(instance);
      }

      // Agregar métodos de gestión a la instancia
      this.enhanceInstance(instance, componentName);

      // Inicializar el componente
      if (typeof instance.init === 'function') {
        await instance.init();
      }

      console.log(`Instancia de '${componentName}' creada e inicializada`);
      return instance;
    } catch (error) {
      console.error(`Error creando instancia de '${componentName}':`, error);
      throw error;
    }
  }

  /**
   * Mejora una instancia con métodos adicionales de gestión
   * @param {Object} instance - Instancia del componente
   * @param {string} componentName - Nombre del componente
   */
  enhanceInstance(instance, componentName) {
    // Agregar referencia al loader
    instance._loader = this;
    instance._componentName = componentName;

    // Método para cargar otros componentes
    instance.loadComponent = async (name, container, options) => {
      return this.createComponent(name, container, options);
    };

    // Método para destruir la instancia
    const originalDestroy = instance.destroy;
    instance.destroy = () => {
      // Remover de la lista de instancias
      const componentInfo = this.componentRegistry.get(componentName);
      if (componentInfo) {
        componentInfo.instances.delete(instance);
      }

      // Llamar al método destroy original si existe
      if (typeof originalDestroy === 'function') {
        originalDestroy.call(instance);
      }

      console.log(`Instancia de '${componentName}' destruida`);
    };
  }

  /**
   * Obtiene todas las instancias de un componente
   * @param {string} componentName - Nombre del componente
   */
  getInstances(componentName) {
    const componentInfo = this.componentRegistry.get(componentName);
    return componentInfo ? Array.from(componentInfo.instances) : [];
  }

  /**
   * Destruye todas las instancias de un componente
   * @param {string} componentName - Nombre del componente
   */
  destroyAllInstances(componentName) {
    const instances = this.getInstances(componentName);
    instances.forEach(instance => {
      if (typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });
  }

  /**
   * Recarga un componente (útil para desarrollo)
   * @param {string} componentName - Nombre del componente
   */
  async reloadComponent(componentName) {
    const componentInfo = this.componentRegistry.get(componentName);
    if (!componentInfo) {
      throw new Error(`Componente '${componentName}' no está registrado`);
    }

    // Destruir todas las instancias existentes
    this.destroyAllInstances(componentName);

    // Marcar como no cargado
    componentInfo.loaded = false;
    componentInfo.constructor = null;

    // Remover del cache de scripts
    const fullPath = this.basePath + componentInfo.path;
    this.loadedScripts.delete(fullPath);
    this.scriptCache.delete(fullPath);

    // Remover script del DOM
    const existingScript = document.querySelector(`script[src="${fullPath}"]`);
    if (existingScript) {
      existingScript.remove();
    }

    console.log(`Componente '${componentName}' marcado para recarga`);
  }

  /**
   * Precarga componentes de forma asíncrona
   * @param {Array<string>} componentNames - Lista de componentes a precargar
   */
  async preloadComponents(componentNames) {
    console.log('Precargando componentes:', componentNames);

    const loadPromises = componentNames.map(name =>
      this.loadComponent(name).catch(error => {
        console.warn(`Error precargando '${name}':`, error);
        return null;
      })
    );

    const results = await Promise.all(loadPromises);
    const loaded = results.filter(result => result !== null);

    console.log(
      `Precargados ${loaded.length} de ${componentNames.length} componentes`
    );
    return loaded;
  }

  /**
   * Obtiene estadísticas del loader
   */
  getStats() {
    const stats = {
      totalRegistered: this.componentRegistry.size,
      totalLoaded: 0,
      totalInstances: 0,
      components: {},
    };

    this.componentRegistry.forEach((info, name) => {
      if (info.loaded) stats.totalLoaded++;
      stats.totalInstances += info.instances.size;

      stats.components[name] = {
        loaded: info.loaded,
        instances: info.instances.size,
        dependencies: this.dependencies.get(name) || [],
      };
    });

    return stats;
  }

  /**
   * Limpia recursos no utilizados
   */
  cleanup() {
    // Remover componentes sin instancias
    this.componentRegistry.forEach((info, name) => {
      if (info.instances.size === 0 && info.loaded) {
        console.log(`Limpiando componente sin uso: ${name}`);
        // Opcional: descargar el componente si no tiene instancias
      }
    });

    // Limpiar promesas de carga completadas
    this.loadingPromises.clear();
  }

  /**
   * Registra un componente personalizado en tiempo de ejecución
   * @param {string} name - Nombre del componente
   * @param {Function} constructor - Constructor del componente
   * @param {Array} dependencies - Dependencias del componente
   */
  registerCustomComponent(name, constructor, dependencies = []) {
    this.componentRegistry.set(name, {
      name,
      path: null, // No tiene path porque ya está cargado
      dependencies,
      loaded: true,
      constructor,
      instances: new Set(),
    });

    if (dependencies.length > 0) {
      this.dependencies.set(name, dependencies);
    }

    console.log(`Componente personalizado '${name}' registrado`);
  }

  /**
   * Verifica si un componente está disponible
   * @param {string} componentName - Nombre del componente
   */
  isComponentAvailable(componentName) {
    return this.componentRegistry.has(componentName);
  }

  /**
   * Verifica si un componente está cargado
   * @param {string} componentName - Nombre del componente
   */
  isComponentLoaded(componentName) {
    const componentInfo = this.componentRegistry.get(componentName);
    return componentInfo ? componentInfo.loaded : false;
  }

  /**
   * Lista todos los componentes registrados
   */
  listComponents() {
    return Array.from(this.componentRegistry.keys());
  }

  /**
   * Obtiene información detallada de un componente
   * @param {string} componentName - Nombre del componente
   */
  getComponentInfo(componentName) {
    const componentInfo = this.componentRegistry.get(componentName);
    if (!componentInfo) {
      return null;
    }

    return {
      name: componentInfo.name,
      path: componentInfo.path,
      loaded: componentInfo.loaded,
      dependencies: this.dependencies.get(componentName) || [],
      instances: componentInfo.instances.size,
      hasConstructor: !!componentInfo.constructor,
    };
  }
}

// Crear instancia global del loader
window.ComponentLoader = window.ComponentLoader || new ComponentLoader();

// Exportar para uso en módulos ES6
export default ComponentLoader;
