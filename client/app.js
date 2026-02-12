/**
 * Aplicación principal modular
 * Gestiona la inicialización y coordinación de todos los componentes del sistema
 */
class ModularApp {
  constructor() {
    this.components = new Map();
    this.loader = window.ComponentLoader;
    this.currentPage = null;
    this.isInitialized = false;

    this.config = {
      autoPreload: true,
      enableHotReload: false,
      debugMode: false,
      defaultComponents: ['NavigationManager'],
      pageComponents: {
        dashboard: ['DashboardManager', 'AnalyticsManager'],
        chat: ['ChatInterface'],
        templates: ['TemplateManager'],
        contacts: ['ContactManager'],
        analytics: ['AnalyticsManager'],
        reports: ['ReportsManager'],
        settings: ['SettingsManager'],
      },
    };

    this.state = {
      loading: false,
      error: null,
      user: null,
      theme: 'light',
      language: 'es',
    };

    this.eventBus = new EventTarget();
  }

  /**
   * Inicializa la aplicación
   */
  async init() {
    if (this.isInitialized) {
      console.warn('La aplicación ya está inicializada');
      return;
    }

    try {
      console.log('Inicializando aplicación modular...');

      // Mostrar loading
      this.showGlobalLoading();

      // Configurar manejo de errores globales
      this.setupErrorHandling();

      // Cargar configuración del usuario
      await this.loadUserConfig();

      // Precargar componentes base si está habilitado
      if (this.config.autoPreload) {
        await this.preloadBaseComponents();
      }

      // Inicializar componentes por defecto
      await this.initializeDefaultComponents();

      // Configurar navegación
      this.setupNavigation();

      // Configurar hot reload si está habilitado
      if (this.config.enableHotReload) {
        this.setupHotReload();
      }

      // Cargar página inicial
      await this.loadInitialPage();

      this.isInitialized = true;
      this.hideGlobalLoading();

      console.log('Aplicación inicializada correctamente');
      this.emit('app:initialized');
    } catch (error) {
      console.error('Error inicializando aplicación:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Configura el manejo de errores globales
   */
  setupErrorHandling() {
    window.addEventListener('error', event => {
      console.error('Error global:', event.error);
      this.handleGlobalError(event.error);
    });

    window.addEventListener('unhandledrejection', event => {
      console.error('Promise rechazada:', event.reason);
      this.handleGlobalError(event.reason);
    });
  }

  /**
   * Carga la configuración del usuario
   */
  async loadUserConfig() {
    try {
      const response = await fetch('/api/user/config');
      if (response.ok) {
        const userConfig = await response.json();
        this.applyUserConfig(userConfig);
      }
    } catch (error) {
      console.warn('No se pudo cargar configuración del usuario:', error);
    }
  }

  /**
   * Aplica la configuración del usuario
   */
  applyUserConfig(userConfig) {
    if (userConfig.theme) {
      this.setTheme(userConfig.theme);
    }

    if (userConfig.language) {
      this.setLanguage(userConfig.language);
    }

    if (userConfig.preferences) {
      Object.assign(this.config, userConfig.preferences);
    }
  }

  /**
   * Precarga componentes base
   */
  async preloadBaseComponents() {
    const baseComponents = ['BaseComponent', 'NavigationManager'];

    try {
      await this.loader.preloadComponents(baseComponents);
      console.log('Componentes base precargados');
    } catch (error) {
      console.warn('Error precargando componentes base:', error);
    }
  }

  /**
   * Inicializa componentes por defecto
   */
  async initializeDefaultComponents() {
    for (const componentName of this.config.defaultComponents) {
      try {
        await this.loadComponent(componentName);
      } catch (error) {
        console.error(
          `Error cargando componente por defecto '${componentName}':`,
          error
        );
      }
    }
  }

  /**
   * Configura la navegación de la aplicación
   */
  setupNavigation() {
    // Manejar cambios de hash para navegación SPA
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });

    // Manejar navegación con botones del navegador
    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });

    // Interceptar clicks en enlaces internos
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (link) {
        event.preventDefault();
        this.navigateTo(link.getAttribute('href'));
      }
    });
  }

  /**
   * Configura hot reload para desarrollo
   */
  setupHotReload() {
    if (typeof WebSocket !== 'undefined') {
      const ws = new WebSocket('ws://localhost:3000/hot-reload');

      ws.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === 'component-changed') {
          this.reloadComponent(data.componentName);
        }
      };

      ws.onerror = () => {
        console.log('Hot reload no disponible');
      };
    }
  }

  /**
   * Carga la página inicial
   */
  async loadInitialPage() {
    const hash = window.location.hash.slice(1) || 'chat';
    await this.navigateTo(hash, false);
  }

  /**
   * Carga un componente
   */
  async loadComponent(componentName, container = null, options = {}) {
    try {
      // Usar contenedor por defecto si no se especifica
      if (!container) {
        container = this.getDefaultContainer(componentName);
      }

      // Crear instancia del componente
      const instance = await this.loader.createComponent(
        componentName,
        container,
        options
      );

      // Registrar en la aplicación
      this.components.set(componentName, instance);

      // Configurar comunicación con la aplicación
      this.setupComponentCommunication(instance, componentName);

      console.log(`Componente '${componentName}' cargado en la aplicación`);
      this.emit('component:loaded', { name: componentName, instance });

      return instance;
    } catch (error) {
      console.error(`Error cargando componente '${componentName}':`, error);
      throw error;
    }
  }

  /**
   * Obtiene el contenedor por defecto para un componente
   */
  getDefaultContainer(componentName) {
    const containerMap = {
      NavigationManager: '#sidebar',
      DashboardManager: '#main-content',
      ChatInterface: '#main-content',
      TemplateManager: '#main-content',
      ContactManager: '#main-content',
      AnalyticsManager: '#main-content',
      ReportsManager: '#main-content',
      SettingsManager: '#main-content',
    };

    const selector = containerMap[componentName] || '#main-content';
    const container = document.querySelector(selector);

    if (!container) {
      throw new Error(
        `Contenedor '${selector}' no encontrado para '${componentName}'`
      );
    }

    return container;
  }

  /**
   * Configura la comunicación entre componente y aplicación
   */
  setupComponentCommunication(instance, componentName) {
    // Agregar referencia a la aplicación
    instance.app = this;

    // Método para comunicarse con otros componentes
    instance.sendMessage = (targetComponent, message, data) => {
      this.sendComponentMessage(componentName, targetComponent, message, data);
    };

    // Método para emitir eventos globales
    instance.emit = (eventName, data) => {
      this.emit(`component:${componentName}:${eventName}`, data);
    };

    // Método para escuchar eventos globales
    instance.listen = (eventName, callback) => {
      this.on(eventName, callback);
    };
  }

  /**
   * Envía mensaje entre componentes
   */
  sendComponentMessage(fromComponent, toComponent, message, data) {
    const targetInstance = this.components.get(toComponent);

    if (targetInstance && typeof targetInstance.handleMessage === 'function') {
      targetInstance.handleMessage(fromComponent, message, data);
    } else {
      console.warn(`Componente '${toComponent}' no puede recibir mensajes`);
    }
  }

  /**
   * Navega a una página específica
   */
  async navigateTo(page, updateHistory = true) {
    if (this.currentPage === page) {
      return;
    }

    try {
      this.setState({ loading: true });

      // Actualizar historial si es necesario
      if (updateHistory) {
        window.location.hash = page;
      }

      // Limpiar contenido actual
      await this.unloadCurrentPage();

      // Cargar componentes de la nueva página
      await this.loadPageComponents(page);

      // Actualizar página actual
      this.currentPage = page;

      // Actualizar navegación
      this.updateNavigation(page);

      this.emit('page:changed', { page, previous: this.currentPage });
    } catch (error) {
      console.error(`Error navegando a '${page}':`, error);
      this.handleNavigationError(error, page);
    } finally {
      this.setState({ loading: false });
    }
  }

  /**
   * Descarga la página actual
   */
  async unloadCurrentPage() {
    if (!this.currentPage) return;

    const pageComponents = this.config.pageComponents[this.currentPage] || [];

    for (const componentName of pageComponents) {
      const instance = this.components.get(componentName);
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
        this.components.delete(componentName);
      }
    }
  }

  /**
   * Carga los componentes de una página
   */
  async loadPageComponents(page) {
    const pageComponents = this.config.pageComponents[page] || [];

    if (pageComponents.length === 0) {
      console.warn(`No hay componentes definidos para la página '${page}'`);
      return;
    }

    // Cargar componentes en paralelo
    const loadPromises = pageComponents.map(componentName =>
      this.loadComponent(componentName).catch(error => {
        console.error(
          `Error cargando '${componentName}' para página '${page}':`,
          error
        );
        return null;
      })
    );

    await Promise.all(loadPromises);
  }

  /**
   * Actualiza la navegación activa
   */
  updateNavigation(page) {
    const navManager = this.components.get('NavigationManager');
    if (navManager && typeof navManager.setActivePage === 'function') {
      navManager.setActivePage(page);
    }
  }

  /**
   * Maneja cambios de ruta
   */
  handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.navigateTo(hash, false);
  }

  /**
   * Recarga un componente (para hot reload)
   */
  async reloadComponent(componentName) {
    try {
      console.log(`Recargando componente '${componentName}'...`);

      // Destruir instancia actual
      const instance = this.components.get(componentName);
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
      }

      // Recargar desde el loader
      await this.loader.reloadComponent(componentName);

      // Recrear si estaba activo
      if (this.components.has(componentName)) {
        await this.loadComponent(componentName);
      }

      console.log(`Componente '${componentName}' recargado`);
    } catch (error) {
      console.error(`Error recargando '${componentName}':`, error);
    }
  }

  /**
   * Establece el tema de la aplicación
   */
  setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.emit('theme:changed', { theme });
  }

  /**
   * Establece el idioma de la aplicación
   */
  setLanguage(language) {
    this.state.language = language;
    document.documentElement.setAttribute('lang', language);
    this.emit('language:changed', { language });
  }

  /**
   * Actualiza el estado de la aplicación
   */
  setState(newState) {
    const oldState = { ...this.state };
    Object.assign(this.state, newState);
    this.emit('state:changed', { oldState, newState: this.state });
  }

  /**
   * Obtiene estadísticas de la aplicación
   */
  getStats() {
    return {
      app: {
        initialized: this.isInitialized,
        currentPage: this.currentPage,
        componentsLoaded: this.components.size,
        state: this.state,
      },
      loader: this.loader.getStats(),
    };
  }

  /**
   * Muestra loading global
   */
  showGlobalLoading() {
    const loadingEl = document.getElementById('global-loading');
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }
  }

  /**
   * Oculta loading global
   */
  hideGlobalLoading() {
    const loadingEl = document.getElementById('global-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  /**
   * Maneja errores de inicialización
   */
  handleInitializationError(error) {
    this.setState({ error: error.message });
    this.hideGlobalLoading();

    // Mostrar error al usuario
    const errorEl = document.getElementById('initialization-error');
    if (errorEl) {
      errorEl.textContent = `Error de inicialización: ${error.message}`;
      errorEl.style.display = 'block';
    }
  }

  /**
   * Maneja errores globales
   */
  handleGlobalError(error) {
    console.error('Error global capturado:', error);
    this.emit('error:global', { error });
  }

  /**
   * Maneja errores de navegación
   */
  handleNavigationError(error, page) {
    console.error(`Error navegando a '${page}':`, error);
    this.emit('error:navigation', { error, page });
  }

  /**
   * Emite un evento
   */
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    this.eventBus.dispatchEvent(event);
  }

  /**
   * Escucha un evento
   */
  on(eventName, callback) {
    this.eventBus.addEventListener(eventName, callback);
  }

  /**
   * Remueve un listener de evento
   */
  off(eventName, callback) {
    this.eventBus.removeEventListener(eventName, callback);
  }

  /**
   * Destruye la aplicación
   */
  destroy() {
    // Destruir todos los componentes
    this.components.forEach((instance, name) => {
      if (typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });

    this.components.clear();
    this.isInitialized = false;

    console.log('Aplicación destruida');
  }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Crear instancia global de la aplicación
    window.App = new ModularApp();

    // Inicializar
    await window.App.init();
  } catch (error) {
    console.error('Error fatal inicializando aplicación:', error);
  }
});

// Exportar para uso en módulos ES6
export default ModularApp;
