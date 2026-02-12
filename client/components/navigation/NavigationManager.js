/**
 * Gestor de navegación modular
 * Maneja la navegación entre páginas y secciones de la aplicación
 */
class NavigationManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      enableBreadcrumbs: true,
      enableQuickActions: true,
      enableSearch: true,
      collapsible: true,
      theme: 'light',
    };
  }

  async beforeInit() {
    this.currentPage = this.getCurrentPage();
    this.navigationConfig = this.getNavigationConfig();
    this.isCollapsed = false;
    this.searchResults = [];

    this.state = {
      activeSection: null,
      activePage: this.currentPage,
      searchQuery: '',
      isSearching: false,
    };
  }

  getNavigationConfig() {
    // Configuración de navegación centralizada
    return {
      sections: [
        {
          id: 'conversations',
          title: 'Conversaciones',
          icon: 'fas fa-comments',
          items: [
            {
              id: 'chat',
              icon: '💬',
              text: 'Chat en Vivo',
              url: 'index.html',
              description: 'Gestionar conversaciones en tiempo real',
              badge: null,
            },
            {
              id: 'contacts',
              icon: '👥',
              text: 'Contactos',
              url: 'contacts.html',
              description: 'Administrar base de contactos',
              badge: null,
            },
            {
              id: 'tags',
              icon: '🏷️',
              text: 'Etiquetas',
              url: '#tags',
              description: 'Organizar con etiquetas',
              badge: null,
            },
          ],
        },
        {
          id: 'automation',
          title: 'Automatización',
          icon: 'fas fa-robot',
          items: [
            {
              id: 'flows',
              icon: '🔄',
              text: 'Flujos',
              url: 'flows.html',
              description: 'Crear flujos automatizados',
              badge: null,
            },
            {
              id: 'ai',
              icon: '🤖',
              text: 'IA Conversacional',
              url: 'ai-admin-dashboard.html',
              description: 'Configurar respuestas inteligentes',
              badge: null,
            },
            {
              id: 'triggers',
              icon: '⚡',
              text: 'Triggers',
              url: '#triggers',
              description: 'Activadores automáticos',
              badge: null,
            },
          ],
        },
        {
          id: 'broadcast',
          title: 'Difusión',
          icon: 'fas fa-bullhorn',
          items: [
            {
              id: 'templates',
              icon: '📝',
              text: 'Plantillas',
              url: 'templates-dashboard.html',
              description: 'Gestionar plantillas WhatsApp',
              badge: null,
            },
            {
              id: 'campaigns',
              icon: '📢',
              text: 'Campañas',
              url: '#campaigns',
              description: 'Crear campañas masivas',
              badge: null,
            },
            {
              id: 'queue',
              icon: '📤',
              text: 'Cola de Mensajes',
              url: 'message-queue-dashboard.html',
              description: 'Monitorear envíos',
              badge: null,
            },
          ],
        },
        {
          id: 'analytics',
          title: 'Análisis',
          icon: 'fas fa-chart-bar',
          items: [
            {
              id: 'analytics',
              icon: '📊',
              text: 'Analytics',
              url: 'index.html#analytics',
              description: 'Métricas detalladas',
              badge: null,
            },
            {
              id: 'reports',
              icon: '📈',
              text: 'Reportes',
              url: 'reports-dashboard.html',
              description: 'Informes personalizados',
              badge: null,
            },
          ],
        },
        {
          id: 'settings',
          title: 'Configuración',
          icon: 'fas fa-cog',
          items: [
            {
              id: 'general',
              icon: '⚙️',
              text: 'General',
              url: 'admin-dashboard.html',
              description: 'Configuración del sistema',
              badge: null,
            },
            {
              id: 'integrations',
              icon: '🔗',
              text: 'Integraciones',
              url: 'integrations-dashboard.html',
              description: 'APIs y webhooks',
              badge: null,
            },
            {
              id: 'notifications',
              icon: '🔔',
              text: 'Notificaciones',
              url: 'notifications-dashboard.html',
              description: 'Alertas del sistema',
              badge: null,
            },
            {
              id: 'backup',
              icon: '💾',
              text: 'Respaldos',
              url: 'backup-dashboard.html',
              description: 'Copias de seguridad',
              badge: null,
            },
          ],
        },
      ],
      quickActions: [
        {
          id: 'new-chat',
          icon: '💬',
          title: 'Iniciar Chat',
          description: 'Responder conversaciones',
          url: 'index.html',
          color: 'primary',
        },
        {
          id: 'new-template',
          icon: '📝',
          title: 'Crear Plantilla',
          description: 'Nueva plantilla WhatsApp',
          url: 'templates-dashboard.html',
          color: 'success',
        },
        {
          id: 'new-flow',
          icon: '🔄',
          title: 'Nuevo Flujo',
          description: 'Automatizar conversaciones',
          url: 'flows.html',
          color: 'info',
        },
        {
          id: 'view-analytics',
          icon: '📊',
          title: 'Ver Analytics',
          description: 'Métricas y estadísticas',
          url: 'index.html#analytics',
          color: 'warning',
        },
      ],
      branding: {
        name: 'ChatBot Pro',
        subtitle: 'Plataforma de Automatización',
        logo: '🤖',
      },
    };
  }

  getTemplate() {
    return `
      <nav class="navigation-manager ${this.isCollapsed ? 'collapsed' : ''}" data-theme="${this.options.theme}">
        <!-- Header -->
        <div class="nav-header">
          <div class="nav-brand">
            <span class="nav-logo">${this.navigationConfig.branding.logo}</span>
            <div class="nav-brand-text">
              <h1 class="nav-title">${this.navigationConfig.branding.name}</h1>
              <p class="nav-subtitle">${this.navigationConfig.branding.subtitle}</p>
            </div>
          </div>
          ${
            this.options.collapsible
              ? `
            <button class="nav-toggle" id="navToggle">
              <i class="fas fa-bars"></i>
            </button>
          `
              : ''
          }
        </div>

        <!-- Search -->
        ${
          this.options.enableSearch
            ? `
          <div class="nav-search">
            <div class="search-input-group">
              <i class="fas fa-search search-icon"></i>
              <input 
                type="text" 
                id="navSearch" 
                placeholder="Buscar páginas..." 
                autocomplete="off"
              />
              <button class="search-clear" id="searchClear" style="display: none;">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="search-results" id="searchResults" style="display: none;"></div>
          </div>
        `
            : ''
        }

        <!-- Main Navigation -->
        <div class="nav-main">
          <div class="nav-sections" id="navSections">
            ${this.renderSections()}
          </div>
        </div>

        <!-- Quick Actions -->
        ${
          this.options.enableQuickActions
            ? `
          <div class="nav-quick-actions">
            <h3 class="quick-actions-title">Acciones Rápidas</h3>
            <div class="quick-actions-grid" id="quickActions">
              ${this.renderQuickActions()}
            </div>
          </div>
        `
            : ''
        }

        <!-- Breadcrumbs -->
        ${
          this.options.enableBreadcrumbs
            ? `
          <div class="nav-breadcrumbs" id="breadcrumbs">
            ${this.renderBreadcrumbs()}
          </div>
        `
            : ''
        }

        <!-- Footer -->
        <div class="nav-footer">
          <div class="nav-user">
            <div class="user-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="user-info">
              <span class="user-name">Administrador</span>
              <span class="user-role">Sistema</span>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  renderSections() {
    return this.navigationConfig.sections
      .map(
        section => `
      <div class="nav-section" data-section="${section.id}">
        <div class="section-header" data-section-id="${section.id}">
          <i class="${section.icon}"></i>
          <span class="section-title">${section.title}</span>
          <i class="fas fa-chevron-down section-toggle"></i>
        </div>
        <div class="section-items">
          ${section.items.map(item => this.renderNavItem(item)).join('')}
        </div>
      </div>
    `
      )
      .join('');
  }

  renderNavItem(item) {
    const isActive = this.isActiveItem(item);
    const badge = item.badge
      ? `<span class="nav-badge">${item.badge}</span>`
      : '';

    return `
      <a href="${item.url}" class="nav-item ${isActive ? 'active' : ''}" data-item="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-text">${item.text}</span>
        ${badge}
        <span class="nav-description">${item.description}</span>
      </a>
    `;
  }

  renderQuickActions() {
    return this.navigationConfig.quickActions
      .map(
        action => `
      <a href="${action.url}" class="quick-action quick-action-${action.color}" data-action="${action.id}">
        <div class="quick-action-icon">${action.icon}</div>
        <div class="quick-action-content">
          <h4 class="quick-action-title">${action.title}</h4>
          <p class="quick-action-description">${action.description}</p>
        </div>
      </a>
    `
      )
      .join('');
  }

  renderBreadcrumbs() {
    const breadcrumbs = this.generateBreadcrumbs();

    return `
      <div class="breadcrumb-list">
        ${breadcrumbs
          .map(
            (crumb, index) => `
          <span class="breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}">
            ${crumb.icon ? `<i class="${crumb.icon}"></i>` : ''}
            ${index < breadcrumbs.length - 1 ? `<a href="${crumb.url}">${crumb.text}</a>` : crumb.text}
          </span>
          ${index < breadcrumbs.length - 1 ? '<i class="fas fa-chevron-right breadcrumb-separator"></i>' : ''}
        `
          )
          .join('')}
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      nav: this.container.querySelector('.navigation-manager'),
      toggle: this.container.querySelector('#navToggle'),
      search: this.container.querySelector('#navSearch'),
      searchClear: this.container.querySelector('#searchClear'),
      searchResults: this.container.querySelector('#searchResults'),
      sections: this.container.querySelector('#navSections'),
      quickActions: this.container.querySelector('#quickActions'),
      breadcrumbs: this.container.querySelector('#breadcrumbs'),
    };
  }

  bindEvents() {
    // Toggle navigation
    if (this.elements.toggle) {
      this.addEventListener(
        this.elements.toggle,
        'click',
        this.toggleNavigation
      );
    }

    // Search functionality
    if (this.elements.search) {
      this.addEventListener(this.elements.search, 'input', this.handleSearch);
      this.addEventListener(
        this.elements.search,
        'focus',
        this.showSearchResults
      );
      this.addEventListener(
        this.elements.search,
        'blur',
        this.hideSearchResults
      );
    }

    if (this.elements.searchClear) {
      this.addEventListener(
        this.elements.searchClear,
        'click',
        this.clearSearch
      );
    }

    // Section toggles
    this.container.querySelectorAll('.section-header').forEach(header => {
      this.addEventListener(header, 'click', e => {
        const sectionId = e.currentTarget.dataset.sectionId;
        this.toggleSection(sectionId);
      });
    });

    // Navigation items
    this.container.querySelectorAll('.nav-item').forEach(item => {
      this.addEventListener(item, 'click', e => {
        const itemId = e.currentTarget.dataset.item;
        this.handleNavigation(itemId, e);
      });
    });

    // Quick actions
    this.container.querySelectorAll('.quick-action').forEach(action => {
      this.addEventListener(action, 'click', e => {
        const actionId = e.currentTarget.dataset.action;
        this.handleQuickAction(actionId, e);
      });
    });

    // Keyboard shortcuts
    this.addEventListener(document, 'keydown', this.handleKeyboardShortcuts);

    // Window resize
    this.addEventListener(window, 'resize', this.handleResize);
  }

  // Navigation methods
  toggleNavigation() {
    this.isCollapsed = !this.isCollapsed;
    this.elements.nav.classList.toggle('collapsed', this.isCollapsed);

    // Save preference
    localStorage.setItem('nav-collapsed', this.isCollapsed);

    // Emit event
    this.emit('navigation:toggle', { collapsed: this.isCollapsed });
  }

  toggleSection(sectionId) {
    const section = this.container.querySelector(
      `[data-section="${sectionId}"]`
    );
    if (!section) return;

    const isExpanded = section.classList.contains('expanded');

    // Collapse all sections first (accordion behavior)
    this.container.querySelectorAll('.nav-section').forEach(s => {
      s.classList.remove('expanded');
    });

    // Expand current section if it wasn't expanded
    if (!isExpanded) {
      section.classList.add('expanded');
      this.setState({ activeSection: sectionId });
    } else {
      this.setState({ activeSection: null });
    }
  }

  handleNavigation(itemId, event) {
    // Update active state
    this.container.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    event.currentTarget.classList.add('active');
    this.setState({ activePage: itemId });

    // Emit navigation event
    this.emit('navigation:change', {
      itemId,
      url: event.currentTarget.href,
      event,
    });

    // Analytics tracking
    this.trackNavigation(itemId);
  }

  handleQuickAction(actionId, event) {
    // Emit quick action event
    this.emit('quickaction:click', {
      actionId,
      url: event.currentTarget.href,
      event,
    });

    // Analytics tracking
    this.trackQuickAction(actionId);
  }

  // Search methods
  handleSearch() {
    const query = this.elements.search.value.trim();
    this.setState({ searchQuery: query });

    if (query.length < 2) {
      this.hideSearchResults();
      return;
    }

    this.performSearch(query);
  }

  performSearch(query) {
    this.setState({ isSearching: true });

    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search through navigation items
    this.navigationConfig.sections.forEach(section => {
      section.items.forEach(item => {
        const score = this.calculateSearchScore(item, lowerQuery);
        if (score > 0) {
          results.push({
            ...item,
            section: section.title,
            score,
          });
        }
      });
    });

    // Search through quick actions
    this.navigationConfig.quickActions.forEach(action => {
      const score = this.calculateSearchScore(action, lowerQuery);
      if (score > 0) {
        results.push({
          ...action,
          section: 'Acciones Rápidas',
          score,
        });
      }
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    this.searchResults = results.slice(0, 8); // Limit results
    this.renderSearchResults();
    this.showSearchResults();

    this.setState({ isSearching: false });
  }

  calculateSearchScore(item, query) {
    let score = 0;
    const text = item.text?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    const title = item.title?.toLowerCase() || '';

    // Exact match in title/text
    if (text.includes(query) || title.includes(query)) {
      score += 10;
    }

    // Partial match in description
    if (description.includes(query)) {
      score += 5;
    }

    // Word boundary matches
    const words = query.split(' ');
    words.forEach(word => {
      if (text.includes(word) || title.includes(word)) {
        score += 3;
      }
      if (description.includes(word)) {
        score += 1;
      }
    });

    return score;
  }

  renderSearchResults() {
    if (this.searchResults.length === 0) {
      this.elements.searchResults.innerHTML = `
        <div class="search-no-results">
          <i class="fas fa-search"></i>
          <p>No se encontraron resultados</p>
        </div>
      `;
      return;
    }

    const html = this.searchResults
      .map(
        result => `
      <a href="${result.url}" class="search-result-item" data-item="${result.id}">
        <div class="search-result-icon">${result.icon}</div>
        <div class="search-result-content">
          <div class="search-result-title">${result.text || result.title}</div>
          <div class="search-result-description">${result.description}</div>
          <div class="search-result-section">${result.section}</div>
        </div>
      </a>
    `
      )
      .join('');

    this.elements.searchResults.innerHTML = html;

    // Bind click events
    this.elements.searchResults
      .querySelectorAll('.search-result-item')
      .forEach(item => {
        this.addEventListener(item, 'click', e => {
          this.hideSearchResults();
          this.clearSearch();
        });
      });
  }

  showSearchResults() {
    if (this.elements.searchResults) {
      this.elements.searchResults.style.display = 'block';
    }
  }

  hideSearchResults() {
    setTimeout(() => {
      if (this.elements.searchResults) {
        this.elements.searchResults.style.display = 'none';
      }
    }, 200);
  }

  clearSearch() {
    this.elements.search.value = '';
    this.elements.searchClear.style.display = 'none';
    this.hideSearchResults();
    this.setState({ searchQuery: '', searchResults: [] });
  }

  // Utility methods
  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return filename.replace('.html', '');
  }

  isActiveItem(item) {
    const currentPath = window.location.pathname;
    const itemPath = item.url;

    if (itemPath.startsWith('#')) {
      return false; // Hash links are not considered active
    }

    return (
      currentPath.includes(itemPath) ||
      (currentPath === '/' && itemPath === 'index.html')
    );
  }

  generateBreadcrumbs() {
    const breadcrumbs = [{ text: 'Inicio', url: '/', icon: 'fas fa-home' }];

    // Find current page in navigation
    for (const section of this.navigationConfig.sections) {
      for (const item of section.items) {
        if (this.isActiveItem(item)) {
          breadcrumbs.push({
            text: section.title,
            url: '#',
            icon: section.icon,
          });
          breadcrumbs.push({
            text: item.text,
            url: item.url,
            icon: null,
          });
          break;
        }
      }
    }

    return breadcrumbs;
  }

  handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + K for search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      if (this.elements.search) {
        this.elements.search.focus();
      }
    }

    // Escape to close search
    if (event.key === 'Escape') {
      if (this.elements.search === document.activeElement) {
        this.elements.search.blur();
        this.hideSearchResults();
      }
    }
  }

  handleResize() {
    const width = window.innerWidth;

    // Auto-collapse on mobile
    if (width < 768 && !this.isCollapsed) {
      this.toggleNavigation();
    }
  }

  trackNavigation(itemId) {
    // Analytics tracking
    if (window.gtag) {
      window.gtag('event', 'navigation_click', {
        item_id: itemId,
        page_title: document.title,
      });
    }
  }

  trackQuickAction(actionId) {
    // Analytics tracking
    if (window.gtag) {
      window.gtag('event', 'quick_action_click', {
        action_id: actionId,
        page_title: document.title,
      });
    }
  }

  // Event emitter methods
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    this.container.dispatchEvent(event);
  }

  on(eventName, callback) {
    this.addEventListener(this.container, eventName, callback);
  }

  // Public API methods
  setActivePage(pageId) {
    this.setState({ activePage: pageId });
    this.updateActiveStates();
  }

  updateActiveStates() {
    // Update navigation items
    this.container.querySelectorAll('.nav-item').forEach(item => {
      const isActive = item.dataset.item === this.state.activePage;
      item.classList.toggle('active', isActive);
    });

    // Update breadcrumbs
    if (this.options.enableBreadcrumbs && this.elements.breadcrumbs) {
      this.elements.breadcrumbs.innerHTML = this.renderBreadcrumbs();
    }
  }

  setBadge(itemId, badge) {
    const item = this.container.querySelector(`[data-item="${itemId}"]`);
    if (item) {
      let badgeElement = item.querySelector('.nav-badge');

      if (badge) {
        if (!badgeElement) {
          badgeElement = document.createElement('span');
          badgeElement.className = 'nav-badge';
          item.appendChild(badgeElement);
        }
        badgeElement.textContent = badge;
      } else if (badgeElement) {
        badgeElement.remove();
      }
    }
  }

  destroy() {
    // Remove keyboard event listener
    document.removeEventListener('keydown', this.handleKeyboardShortcuts);

    super.destroy();
  }
}

// Hacer disponible globalmente para compatibilidad
window.NavigationManager = NavigationManager;

// Exportar para uso en módulos ES6
export default NavigationManager;
