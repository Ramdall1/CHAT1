/**
 * Clase base para todas las páginas del sistema
 * Proporciona funcionalidad común y estructura estándar
 */
class BasePage {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.isInitialized = false;
    this.isVisible = false;
    this.components = new Map();
    this.eventListeners = [];
    
    // Opciones por defecto
    this.options = {
      title: 'Página',
      showHeader: true,
      showFooter: false,
      className: '',
      ...options
    };

    this.init();
  }

  /**
   * Inicializa la página
   */
  async init() {
    try {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        throw new Error(`Contenedor ${this.containerId} no encontrado`);
      }

      await this.render();
      await this.bindEvents();
      await this.loadComponents();
      
      this.isInitialized = true;
      this.onInitialized();
    } catch (error) {
      console.error(`Error inicializando página ${this.constructor.name}:`, error);
      this.onError(error);
    }
  }

  /**
   * Renderiza el contenido base de la página
   */
  async render() {
    if (!this.container) return;

    this.container.className = `page ${this.options.className}`;
    this.container.innerHTML = this.getTemplate();

    // Actualizar título de la página
    if (this.options.title) {
      document.title = `${this.options.title} - ChatBot`;
    }
  }

  /**
   * Obtiene el template HTML de la página
   */
  getTemplate() {
    return `
      ${this.options.showHeader ? this.getHeaderTemplate() : ''}
      <main class="page-content">
        ${this.getContentTemplate()}
      </main>
      ${this.options.showFooter ? this.getFooterTemplate() : ''}
    `;
  }

  /**
   * Template del header
   */
  getHeaderTemplate() {
    return `
      <header class="page-header">
        <div class="page-header-content">
          <h1 class="page-title">${this.options.title}</h1>
          <div class="page-actions">
            ${this.getHeaderActionsTemplate()}
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Template de acciones del header
   */
  getHeaderActionsTemplate() {
    return '';
  }

  /**
   * Template del contenido principal (debe ser sobrescrito)
   */
  getContentTemplate() {
    return '<div class="page-placeholder">Contenido de la página</div>';
  }

  /**
   * Template del footer
   */
  getFooterTemplate() {
    return `
      <footer class="page-footer">
        <div class="page-footer-content">
          <p>&copy; 2024 ChatBot System</p>
        </div>
      </footer>
    `;
  }

  /**
   * Vincula eventos de la página
   */
  async bindEvents() {
    // Eventos base que pueden ser sobrescritos
    this.addEventListener(window, 'resize', this.onResize.bind(this));
    this.addEventListener(document, 'visibilitychange', this.onVisibilityChange.bind(this));
  }

  /**
   * Carga componentes específicos de la página
   */
  async loadComponents() {
    // Implementar en clases hijas
  }

  /**
   * Agrega un event listener y lo registra para limpieza posterior
   */
  addEventListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler, options });
  }

  /**
   * Registra un componente
   */
  registerComponent(name, component) {
    this.components.set(name, component);
  }

  /**
   * Obtiene un componente registrado
   */
  getComponent(name) {
    return this.components.get(name);
  }

  /**
   * Muestra la página
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
      this.isVisible = true;
      this.onShow();
    }
  }

  /**
   * Oculta la página
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
      this.onHide();
    }
  }

  /**
   * Actualiza la página
   */
  async refresh() {
    if (this.isInitialized) {
      await this.render();
      await this.loadComponents();
      this.onRefresh();
    }
  }

  /**
   * Muestra un mensaje de carga
   */
  showLoading(message = 'Cargando...') {
    const loadingHtml = `
      <div class="page-loading">
        <div class="loading-spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;
    
    if (this.container) {
      this.container.innerHTML = loadingHtml;
    }
  }

  /**
   * Muestra un mensaje de error
   */
  showError(error, canRetry = true) {
    const errorMessage = error.message || 'Ha ocurrido un error';
    const retryButton = canRetry ? '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button>' : '';
    
    const errorHtml = `
      <div class="page-error">
        <div class="error-icon">⚠️</div>
        <h3>Error</h3>
        <p class="error-message">${errorMessage}</p>
        ${retryButton}
      </div>
    `;
    
    if (this.container) {
      this.container.innerHTML = errorHtml;
    }
  }

  /**
   * Obtiene datos de la página (para ser sobrescrito)
   */
  async getData() {
    return {};
  }

  /**
   * Guarda datos de la página (para ser sobrescrito)
   */
  async saveData(data) {
    return true;
  }

  /**
   * Valida datos de la página (para ser sobrescrito)
   */
  validateData(data) {
    return { isValid: true, errors: [] };
  }

  // Eventos del ciclo de vida
  onInitialized() {
    console.log(`Página ${this.constructor.name} inicializada`);
  }

  onShow() {
    console.log(`Página ${this.constructor.name} mostrada`);
  }

  onHide() {
    console.log(`Página ${this.constructor.name} ocultada`);
  }

  onRefresh() {
    console.log(`Página ${this.constructor.name} actualizada`);
  }

  onResize() {
    // Manejar cambios de tamaño de ventana
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.onPageHidden();
    } else {
      this.onPageVisible();
    }
  }

  onPageHidden() {
    // Página oculta (usuario cambió de pestaña)
  }

  onPageVisible() {
    // Página visible (usuario regresó a la pestaña)
  }

  onError(error) {
    console.error(`Error en página ${this.constructor.name}:`, error);
    this.showError(error);
  }

  /**
   * Limpia recursos y event listeners
   */
  destroy() {
    // Limpiar event listeners
    this.eventListeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.eventListeners = [];

    // Destruir componentes
    this.components.forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    this.components.clear();

    // Limpiar contenedor
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;
    this.isVisible = false;
  }

  /**
   * Obtiene el estado de la página
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isVisible: this.isVisible,
      title: this.options.title,
      components: Array.from(this.components.keys())
    };
  }
}

export default BasePage;