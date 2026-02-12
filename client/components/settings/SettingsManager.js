/**
 * Gestor de configuraciones modular
 * Maneja todas las configuraciones del sistema, bots, usuarios y aplicación
 */
class SettingsManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      autoSave: true,
      autoSaveDelay: 2000,
      enableValidation: true,
      enableBackup: true,
      maxBackups: 10,
      enableImportExport: true,
      enableAdvancedSettings: false,
      confirmChanges: true,
    };
  }

  async beforeInit() {
    this.settings = {};
    this.originalSettings = {};
    this.autoSaveTimer = null;
    this.hasUnsavedChanges = false;
    this.validationRules = {};
    this.backups = [];

    this.state = {
      loading: false,
      activeSection: 'general',
      activeTab: 'basic',
      searchQuery: '',
      showAdvanced: this.options.enableAdvancedSettings,
      isDirty: false,
      validationErrors: {},
      lastSaved: null,
    };

    this.sections = this.getSettingsSections();
    this.validationRules = this.getValidationRules();
  }

  getSettingsSections() {
    return {
      general: {
        name: 'General',
        icon: 'fas fa-cog',
        description: 'Configuraciones generales del sistema',
        tabs: {
          basic: { name: 'Básico', icon: 'fas fa-sliders-h' },
          appearance: { name: 'Apariencia', icon: 'fas fa-palette' },
          notifications: { name: 'Notificaciones', icon: 'fas fa-bell' },
          security: { name: 'Seguridad', icon: 'fas fa-shield-alt' },
        },
      },
      bots: {
        name: 'Bots',
        icon: 'fas fa-robot',
        description: 'Configuración de bots de WhatsApp',
        tabs: {
          instances: { name: 'Instancias', icon: 'fas fa-server' },
          behavior: { name: 'Comportamiento', icon: 'fas fa-brain' },
          responses: { name: 'Respuestas', icon: 'fas fa-comment-dots' },
          automation: { name: 'Automatización', icon: 'fas fa-magic' },
        },
      },
      whatsapp: {
        name: 'WhatsApp',
        icon: 'fab fa-whatsapp',
        description: 'Configuraciones específicas de WhatsApp',
        tabs: {
          connection: { name: 'Conexión', icon: 'fas fa-link' },
          messages: { name: 'Mensajes', icon: 'fas fa-envelope' },
          media: { name: 'Multimedia', icon: 'fas fa-photo-video' },
          webhooks: { name: 'Webhooks', icon: 'fas fa-webhook' },
        },
      },
      database: {
        name: 'Base de datos',
        icon: 'fas fa-database',
        description: 'Configuración de base de datos',
        tabs: {
          connection: { name: 'Conexión', icon: 'fas fa-plug' },
          backup: { name: 'Respaldo', icon: 'fas fa-save' },
          maintenance: { name: 'Mantenimiento', icon: 'fas fa-tools' },
          performance: { name: 'Rendimiento', icon: 'fas fa-tachometer-alt' },
        },
      },
      api: {
        name: 'API',
        icon: 'fas fa-code',
        description: 'Configuración de API y integraciones',
        tabs: {
          endpoints: { name: 'Endpoints', icon: 'fas fa-route' },
          authentication: { name: 'Autenticación', icon: 'fas fa-key' },
          rate_limiting: { name: 'Rate Limiting', icon: 'fas fa-stopwatch' },
          logging: { name: 'Logging', icon: 'fas fa-file-alt' },
        },
      },
      users: {
        name: 'Usuarios',
        icon: 'fas fa-users',
        description: 'Gestión de usuarios y permisos',
        tabs: {
          accounts: { name: 'Cuentas', icon: 'fas fa-user' },
          roles: { name: 'Roles', icon: 'fas fa-user-tag' },
          permissions: { name: 'Permisos', icon: 'fas fa-lock' },
          sessions: { name: 'Sesiones', icon: 'fas fa-clock' },
        },
      },
      advanced: {
        name: 'Avanzado',
        icon: 'fas fa-cogs',
        description: 'Configuraciones avanzadas del sistema',
        tabs: {
          system: { name: 'Sistema', icon: 'fas fa-microchip' },
          debug: { name: 'Debug', icon: 'fas fa-bug' },
          experimental: { name: 'Experimental', icon: 'fas fa-flask' },
          developer: { name: 'Desarrollador', icon: 'fas fa-code' },
        },
      },
    };
  }

  getValidationRules() {
    return {
      // General settings
      'general.app_name': { required: true, minLength: 3, maxLength: 50 },
      'general.app_url': { required: true, type: 'url' },
      'general.timezone': { required: true },
      'general.language': { required: true },
      'general.max_file_size': {
        required: true,
        type: 'number',
        min: 1,
        max: 100,
      },

      // Bot settings
      'bots.default_response_delay': {
        required: true,
        type: 'number',
        min: 0,
        max: 10000,
      },
      'bots.max_concurrent_conversations': {
        required: true,
        type: 'number',
        min: 1,
        max: 1000,
      },
      'bots.session_timeout': {
        required: true,
        type: 'number',
        min: 300,
        max: 86400,
      },

      // WhatsApp settings
      'whatsapp.webhook_url': { type: 'url' },
      'whatsapp.verify_token': { required: true, minLength: 8 },
      'whatsapp.access_token': { required: true, minLength: 10 },

      // Database settings
      'database.host': { required: true },
      'database.port': { required: true, type: 'number', min: 1, max: 65535 },
      'database.name': { required: true, minLength: 1 },
      'database.username': { required: true },
      'database.backup_interval': {
        required: true,
        type: 'number',
        min: 1,
        max: 168,
      },

      // API settings
      'api.rate_limit_requests': {
        required: true,
        type: 'number',
        min: 1,
        max: 10000,
      },
      'api.rate_limit_window': {
        required: true,
        type: 'number',
        min: 1,
        max: 3600,
      },
      'api.jwt_secret': { required: true, minLength: 32 },
      'api.jwt_expiry': {
        required: true,
        type: 'number',
        min: 300,
        max: 604800,
      },
    };
  }

  getTemplate() {
    return `
      <div class="settings-manager">
        <!-- Header -->
        <div class="settings-header">
          <div class="header-left">
            <h2 class="settings-title">
              <i class="fas fa-cog"></i>
              Configuraciones
            </h2>
            <div class="settings-subtitle">
              Gestiona todas las configuraciones del sistema
            </div>
          </div>
          
          <div class="header-controls">
            <div class="search-box">
              <i class="fas fa-search"></i>
              <input type="text" id="settingsSearch" placeholder="Buscar configuraciones..." />
            </div>
            
            <div class="settings-actions">
              <button class="btn btn-secondary" id="resetSettings">
                <i class="fas fa-undo"></i>
                Restablecer
              </button>
              
              <button class="btn btn-secondary" id="exportSettings">
                <i class="fas fa-download"></i>
                Exportar
              </button>
              
              <button class="btn btn-secondary" id="importSettings">
                <i class="fas fa-upload"></i>
                Importar
              </button>
              
              <button class="btn btn-success" id="saveSettings" disabled>
                <i class="fas fa-save"></i>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>

        <!-- Status bar -->
        <div class="settings-status" id="settingsStatus" style="display: none;">
          <div class="status-content">
            <i class="status-icon"></i>
            <span class="status-text"></span>
            <div class="status-actions">
              <button class="btn btn-sm btn-secondary" id="dismissStatus">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Main content -->
        <div class="settings-content">
          <!-- Sidebar -->
          <div class="settings-sidebar">
            <div class="sidebar-sections" id="sidebarSections">
              <!-- Sections will be rendered here -->
            </div>
            
            <div class="sidebar-footer">
              <div class="advanced-toggle">
                <label class="switch">
                  <input type="checkbox" id="advancedToggle" ${this.state.showAdvanced ? 'checked' : ''} />
                  <span class="slider"></span>
                </label>
                <span>Configuraciones avanzadas</span>
              </div>
              
              <div class="last-saved" id="lastSaved">
                <!-- Last saved info will be shown here -->
              </div>
            </div>
          </div>

          <!-- Main panel -->
          <div class="settings-main">
            <!-- Section header -->
            <div class="section-header" id="sectionHeader">
              <!-- Section info will be rendered here -->
            </div>

            <!-- Tabs -->
            <div class="settings-tabs" id="settingsTabs">
              <!-- Tabs will be rendered here -->
            </div>

            <!-- Tab content -->
            <div class="tab-content-container" id="tabContentContainer">
              <!-- Tab content will be rendered here -->
            </div>
          </div>
        </div>

        <!-- Unsaved changes modal -->
        <div class="modal" id="unsavedChangesModal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Cambios sin guardar</h3>
            </div>
            
            <div class="modal-body">
              <p>Tienes cambios sin guardar. ¿Qué deseas hacer?</p>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" id="discardChanges">
                Descartar cambios
              </button>
              <button class="btn btn-primary" id="saveChangesModal">
                Guardar cambios
              </button>
              <button class="btn btn-secondary" id="cancelNavigation">
                Cancelar
              </button>
            </div>
          </div>
        </div>

        <!-- Import modal -->
        <div class="modal" id="importModal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Importar configuraciones</h3>
              <button class="btn btn-sm btn-secondary" id="closeImportModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="import-options">
                <div class="import-method">
                  <label>
                    <input type="radio" name="importMethod" value="file" checked />
                    <span>Desde archivo</span>
                  </label>
                  
                  <div class="file-upload" id="fileUploadArea">
                    <input type="file" id="settingsFile" accept=".json,.yaml,.yml" />
                    <div class="upload-text">
                      <i class="fas fa-cloud-upload-alt"></i>
                      <span>Arrastra un archivo aquí o haz clic para seleccionar</span>
                      <small>Formatos soportados: JSON, YAML</small>
                    </div>
                  </div>
                </div>
                
                <div class="import-method">
                  <label>
                    <input type="radio" name="importMethod" value="text" />
                    <span>Desde texto</span>
                  </label>
                  
                  <div class="text-import" id="textImportArea" style="display: none;">
                    <textarea id="settingsText" rows="10" placeholder="Pega aquí el contenido de las configuraciones..."></textarea>
                  </div>
                </div>
              </div>
              
              <div class="import-options-config">
                <h4>Opciones de importación</h4>
                
                <label class="checkbox-label">
                  <input type="checkbox" id="mergeSettings" checked />
                  <span>Combinar con configuraciones existentes</span>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" id="backupBeforeImport" checked />
                  <span>Crear respaldo antes de importar</span>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" id="validateImport" checked />
                  <span>Validar configuraciones antes de importar</span>
                </label>
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" id="cancelImport">
                Cancelar
              </button>
              <button class="btn btn-primary" id="executeImport" disabled>
                <i class="fas fa-upload"></i>
                Importar
              </button>
            </div>
          </div>
        </div>

        <!-- Backup modal -->
        <div class="modal" id="backupModal" style="display: none;">
          <div class="modal-content large">
            <div class="modal-header">
              <h3>Gestión de respaldos</h3>
              <button class="btn btn-sm btn-secondary" id="closeBackupModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="backup-actions">
                <button class="btn btn-primary" id="createBackup">
                  <i class="fas fa-plus"></i>
                  Crear respaldo
                </button>
                
                <button class="btn btn-secondary" id="autoBackupSettings">
                  <i class="fas fa-cog"></i>
                  Configurar respaldo automático
                </button>
              </div>
              
              <div class="backups-list" id="backupsList">
                <!-- Backups will be rendered here -->
              </div>
            </div>
          </div>
        </div>

        <!-- Loading overlay -->
        <div class="loading-overlay" id="loadingOverlay" style="display: none;">
          <div class="loading-content">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Cargando configuraciones...</span>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      // Header
      settingsSearch: this.container.querySelector('#settingsSearch'),
      resetBtn: this.container.querySelector('#resetSettings'),
      exportBtn: this.container.querySelector('#exportSettings'),
      importBtn: this.container.querySelector('#importSettings'),
      saveBtn: this.container.querySelector('#saveSettings'),

      // Status
      settingsStatus: this.container.querySelector('#settingsStatus'),
      dismissStatusBtn: this.container.querySelector('#dismissStatus'),

      // Sidebar
      sidebarSections: this.container.querySelector('#sidebarSections'),
      advancedToggle: this.container.querySelector('#advancedToggle'),
      lastSaved: this.container.querySelector('#lastSaved'),

      // Main panel
      sectionHeader: this.container.querySelector('#sectionHeader'),
      settingsTabs: this.container.querySelector('#settingsTabs'),
      tabContentContainer: this.container.querySelector('#tabContentContainer'),

      // Loading
      loadingOverlay: this.container.querySelector('#loadingOverlay'),

      // Modals
      unsavedChangesModal: this.container.querySelector('#unsavedChangesModal'),
      discardChangesBtn: this.container.querySelector('#discardChanges'),
      saveChangesModalBtn: this.container.querySelector('#saveChangesModal'),
      cancelNavigationBtn: this.container.querySelector('#cancelNavigation'),

      importModal: this.container.querySelector('#importModal'),
      closeImportModalBtn: this.container.querySelector('#closeImportModal'),
      settingsFile: this.container.querySelector('#settingsFile'),
      fileUploadArea: this.container.querySelector('#fileUploadArea'),
      settingsText: this.container.querySelector('#settingsText'),
      textImportArea: this.container.querySelector('#textImportArea'),
      mergeSettings: this.container.querySelector('#mergeSettings'),
      backupBeforeImport: this.container.querySelector('#backupBeforeImport'),
      validateImport: this.container.querySelector('#validateImport'),
      cancelImportBtn: this.container.querySelector('#cancelImport'),
      executeImportBtn: this.container.querySelector('#executeImport'),

      backupModal: this.container.querySelector('#backupModal'),
      closeBackupModalBtn: this.container.querySelector('#closeBackupModal'),
      createBackupBtn: this.container.querySelector('#createBackup'),
      autoBackupSettingsBtn: this.container.querySelector(
        '#autoBackupSettings'
      ),
      backupsList: this.container.querySelector('#backupsList'),
    };
  }

  bindEvents() {
    // Header controls
    this.addEventListener(
      this.elements.settingsSearch,
      'input',
      this.handleSearch
    );
    this.addEventListener(this.elements.resetBtn, 'click', this.resetSettings);
    this.addEventListener(
      this.elements.exportBtn,
      'click',
      this.exportSettings
    );
    this.addEventListener(
      this.elements.importBtn,
      'click',
      this.showImportModal
    );
    this.addEventListener(this.elements.saveBtn, 'click', this.saveSettings);

    // Status
    this.addEventListener(
      this.elements.dismissStatusBtn,
      'click',
      this.dismissStatus
    );

    // Sidebar
    this.addEventListener(
      this.elements.advancedToggle,
      'change',
      this.toggleAdvancedSettings
    );

    // Modals
    this.addEventListener(
      this.elements.discardChangesBtn,
      'click',
      this.discardChanges
    );
    this.addEventListener(
      this.elements.saveChangesModalBtn,
      'click',
      this.saveChangesFromModal
    );
    this.addEventListener(
      this.elements.cancelNavigationBtn,
      'click',
      this.cancelNavigation
    );

    this.addEventListener(
      this.elements.closeImportModalBtn,
      'click',
      this.hideImportModal
    );
    this.addEventListener(
      this.elements.cancelImportBtn,
      'click',
      this.hideImportModal
    );
    this.addEventListener(
      this.elements.executeImportBtn,
      'click',
      this.executeImport
    );
    this.addEventListener(
      this.elements.settingsFile,
      'change',
      this.handleFileSelect
    );

    this.addEventListener(
      this.elements.closeBackupModalBtn,
      'click',
      this.hideBackupModal
    );
    this.addEventListener(
      this.elements.createBackupBtn,
      'click',
      this.createBackup
    );
    this.addEventListener(
      this.elements.autoBackupSettingsBtn,
      'click',
      this.showAutoBackupSettings
    );

    // Import method radio buttons
    this.container
      .querySelectorAll('input[name="importMethod"]')
      .forEach(radio => {
        this.addEventListener(radio, 'change', this.handleImportMethodChange);
      });

    // File drag and drop
    this.setupFileDragAndDrop();

    // Prevent navigation with unsaved changes
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  async afterInit() {
    await this.loadSettings();
    this.renderSidebar();
    this.switchSection(this.state.activeSection);
  }

  async loadSettings() {
    this.setState({ loading: true });
    this.showLoading();

    try {
      const response = await this.request('/api/settings');
      this.settings = response.settings || {};
      this.originalSettings = JSON.parse(JSON.stringify(this.settings));

      // Load backups
      const backupsResponse = await this.request('/api/settings/backups');
      this.backups = backupsResponse.backups || [];
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showToast('Error al cargar configuraciones', 'error');
    } finally {
      this.setState({ loading: false });
      this.hideLoading();
    }
  }

  renderSidebar() {
    const sectionsHTML = Object.entries(this.sections)
      .filter(([key]) => this.state.showAdvanced || key !== 'advanced')
      .map(([key, section]) => this.getSectionHTML(key, section))
      .join('');

    this.elements.sidebarSections.innerHTML = sectionsHTML;

    // Bind section click events
    this.container.querySelectorAll('.sidebar-section').forEach(section => {
      this.addEventListener(section, 'click', () => {
        const sectionKey = section.dataset.section;
        this.switchSection(sectionKey);
      });
    });
  }

  getSectionHTML(key, section) {
    const isActive = this.state.activeSection === key;
    const hasChanges = this.hasUnsavedChangesInSection(key);

    return `
      <div class="sidebar-section ${isActive ? 'active' : ''}" data-section="${key}">
        <div class="section-icon">
          <i class="${section.icon}"></i>
          ${hasChanges ? '<div class="changes-indicator"></div>' : ''}
        </div>
        <div class="section-info">
          <h3 class="section-name">${section.name}</h3>
          <p class="section-description">${section.description}</p>
        </div>
      </div>
    `;
  }

  switchSection(sectionKey) {
    if (this.hasUnsavedChanges && this.options.confirmChanges) {
      this.pendingSection = sectionKey;
      this.showUnsavedChangesModal();
      return;
    }

    this.setState({ activeSection: sectionKey, activeTab: 'basic' });
    this.renderSectionContent();
    this.updateSidebarSelection();
  }

  updateSidebarSelection() {
    this.container.querySelectorAll('.sidebar-section').forEach(section => {
      section.classList.toggle(
        'active',
        section.dataset.section === this.state.activeSection
      );
    });
  }

  renderSectionContent() {
    const section = this.sections[this.state.activeSection];
    if (!section) return;

    // Render section header
    this.elements.sectionHeader.innerHTML = `
      <div class="section-title">
        <i class="${section.icon}"></i>
        <h2>${section.name}</h2>
      </div>
      <div class="section-description">
        ${section.description}
      </div>
    `;

    // Render tabs
    this.renderTabs(section.tabs);

    // Render tab content
    this.renderTabContent();
  }

  renderTabs(tabs) {
    const tabsHTML = Object.entries(tabs)
      .map(([key, tab]) => this.getTabHTML(key, tab))
      .join('');

    this.elements.settingsTabs.innerHTML = tabsHTML;

    // Bind tab click events
    this.container.querySelectorAll('.tab-button').forEach(tab => {
      this.addEventListener(tab, 'click', () => {
        const tabKey = tab.dataset.tab;
        this.switchTab(tabKey);
      });
    });
  }

  getTabHTML(key, tab) {
    const isActive = this.state.activeTab === key;
    const hasChanges = this.hasUnsavedChangesInTab(
      this.state.activeSection,
      key
    );

    return `
      <button class="tab-button ${isActive ? 'active' : ''}" data-tab="${key}">
        <i class="${tab.icon}"></i>
        <span>${tab.name}</span>
        ${hasChanges ? '<div class="changes-indicator"></div>' : ''}
      </button>
    `;
  }

  switchTab(tabKey) {
    this.setState({ activeTab: tabKey });
    this.renderTabContent();
    this.updateTabSelection();
  }

  updateTabSelection() {
    this.container.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === this.state.activeTab);
    });
  }

  renderTabContent() {
    const settingsForTab = this.getSettingsForTab(
      this.state.activeSection,
      this.state.activeTab
    );
    const contentHTML = this.generateSettingsForm(settingsForTab);

    this.elements.tabContentContainer.innerHTML = `
      <div class="settings-form">
        ${contentHTML}
      </div>
    `;

    // Bind form events
    this.bindFormEvents();
  }

  getSettingsForTab(section, tab) {
    // This would typically come from a configuration file or API
    // For now, we'll generate some example settings based on section and tab
    return this.generateExampleSettings(section, tab);
  }

  generateExampleSettings(section, tab) {
    const settings = {};

    switch (section) {
      case 'general':
        if (tab === 'basic') {
          settings['general.app_name'] = {
            type: 'text',
            label: 'Nombre de la aplicación',
            value: this.getSetting('general.app_name', 'WhatsApp Bot'),
            description: 'Nombre que se mostrará en la interfaz',
          };
          settings['general.app_url'] = {
            type: 'url',
            label: 'URL de la aplicación',
            value: this.getSetting('general.app_url', 'http://localhost:3000'),
            description: 'URL base de la aplicación',
          };
          settings['general.timezone'] = {
            type: 'select',
            label: 'Zona horaria',
            value: this.getSetting('general.timezone', 'America/Mexico_City'),
            options: this.getTimezoneOptions(),
            description: 'Zona horaria para fechas y horas',
          };
          settings['general.language'] = {
            type: 'select',
            label: 'Idioma',
            value: this.getSetting('general.language', 'es'),
            options: [
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'pt', label: 'Português' },
            ],
            description: 'Idioma de la interfaz',
          };
        } else if (tab === 'appearance') {
          settings['general.theme'] = {
            type: 'select',
            label: 'Tema',
            value: this.getSetting('general.theme', 'light'),
            options: [
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
              { value: 'auto', label: 'Automático' },
            ],
          };
          settings['general.primary_color'] = {
            type: 'color',
            label: 'Color primario',
            value: this.getSetting('general.primary_color', '#007bff'),
          };
        }
        break;

      case 'bots':
        if (tab === 'instances') {
          settings['bots.max_instances'] = {
            type: 'number',
            label: 'Máximo de instancias',
            value: this.getSetting('bots.max_instances', 5),
            min: 1,
            max: 50,
          };
          settings['bots.auto_restart'] = {
            type: 'boolean',
            label: 'Reinicio automático',
            value: this.getSetting('bots.auto_restart', true),
          };
        } else if (tab === 'behavior') {
          settings['bots.default_response_delay'] = {
            type: 'number',
            label: 'Retraso de respuesta (ms)',
            value: this.getSetting('bots.default_response_delay', 1000),
            min: 0,
            max: 10000,
          };
          settings['bots.typing_simulation'] = {
            type: 'boolean',
            label: 'Simular escritura',
            value: this.getSetting('bots.typing_simulation', true),
          };
        }
        break;

      case 'whatsapp':
        if (tab === 'connection') {
          settings['whatsapp.webhook_url'] = {
            type: 'url',
            label: 'URL del webhook',
            value: this.getSetting('whatsapp.webhook_url', ''),
            description: 'URL donde WhatsApp enviará los webhooks',
          };
          settings['whatsapp.verify_token'] = {
            type: 'password',
            label: 'Token de verificación',
            value: this.getSetting('whatsapp.verify_token', ''),
            description: 'Token para verificar el webhook',
          };
        }
        break;

      case 'database':
        if (tab === 'connection') {
          settings['database.host'] = {
            type: 'text',
            label: 'Host',
            value: this.getSetting('database.host', 'localhost'),
          };
          settings['database.port'] = {
            type: 'number',
            label: 'Puerto',
            value: this.getSetting('database.port', 5432),
            min: 1,
            max: 65535,
          };
          settings['database.name'] = {
            type: 'text',
            label: 'Nombre de la base de datos',
            value: this.getSetting('database.name', 'whatsapp_bot'),
          };
        }
        break;
    }

    return settings;
  }

  generateSettingsForm(settings) {
    return Object.entries(settings)
      .map(([key, setting]) => this.generateSettingField(key, setting))
      .join('');
  }

  generateSettingField(key, setting) {
    const hasError = this.state.validationErrors[key];
    const errorClass = hasError ? 'has-error' : '';

    let fieldHTML = '';

    switch (setting.type) {
      case 'text':
      case 'url':
      case 'email':
        fieldHTML = `
          <input 
            type="${setting.type}" 
            id="${key}" 
            name="${key}" 
            value="${setting.value || ''}"
            ${setting.placeholder ? `placeholder="${setting.placeholder}"` : ''}
            ${setting.required ? 'required' : ''}
            ${setting.readonly ? 'readonly' : ''}
          />
        `;
        break;

      case 'password':
        fieldHTML = `
          <div class="password-field">
            <input 
              type="password" 
              id="${key}" 
              name="${key}" 
              value="${setting.value || ''}"
              ${setting.placeholder ? `placeholder="${setting.placeholder}"` : ''}
              ${setting.required ? 'required' : ''}
            />
            <button type="button" class="toggle-password" data-target="${key}">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        `;
        break;

      case 'number':
        fieldHTML = `
          <input 
            type="number" 
            id="${key}" 
            name="${key}" 
            value="${setting.value || ''}"
            ${setting.min !== undefined ? `min="${setting.min}"` : ''}
            ${setting.max !== undefined ? `max="${setting.max}"` : ''}
            ${setting.step !== undefined ? `step="${setting.step}"` : ''}
            ${setting.required ? 'required' : ''}
          />
        `;
        break;

      case 'boolean':
        fieldHTML = `
          <label class="switch">
            <input 
              type="checkbox" 
              id="${key}" 
              name="${key}" 
              ${setting.value ? 'checked' : ''}
            />
            <span class="slider"></span>
          </label>
        `;
        break;

      case 'select':
        const options = setting.options
          .map(
            option =>
              `<option value="${option.value}" ${option.value === setting.value ? 'selected' : ''}>${option.label}</option>`
          )
          .join('');

        fieldHTML = `
          <select id="${key}" name="${key}" ${setting.required ? 'required' : ''}>
            ${options}
          </select>
        `;
        break;

      case 'textarea':
        fieldHTML = `
          <textarea 
            id="${key}" 
            name="${key}" 
            rows="${setting.rows || 4}"
            ${setting.placeholder ? `placeholder="${setting.placeholder}"` : ''}
            ${setting.required ? 'required' : ''}
          >${setting.value || ''}</textarea>
        `;
        break;

      case 'color':
        fieldHTML = `
          <div class="color-field">
            <input 
              type="color" 
              id="${key}" 
              name="${key}" 
              value="${setting.value || '#000000'}"
            />
            <input 
              type="text" 
              class="color-text" 
              value="${setting.value || '#000000'}"
              data-color-input="${key}"
            />
          </div>
        `;
        break;

      case 'file':
        fieldHTML = `
          <div class="file-field">
            <input 
              type="file" 
              id="${key}" 
              name="${key}" 
              ${setting.accept ? `accept="${setting.accept}"` : ''}
              ${setting.multiple ? 'multiple' : ''}
            />
            <label for="${key}" class="file-label">
              <i class="fas fa-upload"></i>
              <span>Seleccionar archivo</span>
            </label>
          </div>
        `;
        break;
    }

    return `
      <div class="form-group ${errorClass}">
        <label for="${key}" class="form-label">
          ${setting.label}
          ${setting.required ? '<span class="required">*</span>' : ''}
        </label>
        
        <div class="form-field">
          ${fieldHTML}
        </div>
        
        ${setting.description ? `<div class="form-help">${setting.description}</div>` : ''}
        
        ${hasError ? `<div class="form-error">${this.state.validationErrors[key]}</div>` : ''}
      </div>
    `;
  }

  bindFormEvents() {
    // Bind change events to all form inputs
    this.container
      .querySelectorAll('input, select, textarea')
      .forEach(input => {
        this.addEventListener(input, 'change', this.handleSettingChange);
        this.addEventListener(input, 'input', this.handleSettingInput);
      });

    // Bind password toggle buttons
    this.container.querySelectorAll('.toggle-password').forEach(button => {
      this.addEventListener(button, 'click', this.togglePasswordVisibility);
    });

    // Bind color input synchronization
    this.container.querySelectorAll('[data-color-input]').forEach(input => {
      this.addEventListener(input, 'input', this.syncColorInput);
    });
  }

  handleSettingChange(event) {
    const { name, value, type, checked } = event.target;
    const settingValue = type === 'checkbox' ? checked : value;

    this.setSetting(name, settingValue);
    this.validateSetting(name, settingValue);
    this.markAsChanged();

    if (this.options.autoSave) {
      this.scheduleAutoSave();
    }
  }

  handleSettingInput(event) {
    // Handle real-time input for text fields
    if (
      event.target.type === 'text' ||
      event.target.type === 'url' ||
      event.target.type === 'email'
    ) {
      this.handleSettingChange(event);
    }
  }

  setSetting(key, value) {
    const keys = key.split('.');
    let current = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  getSetting(key, defaultValue = null) {
    const keys = key.split('.');
    let current = this.settings;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  validateSetting(key, value) {
    const rule = this.validationRules[key];
    if (!rule) return true;

    const errors = [];

    // Required validation
    if (rule.required && (!value || value.toString().trim() === '')) {
      errors.push('Este campo es requerido');
    }

    // Type validation
    if (value && rule.type) {
      switch (rule.type) {
        case 'number':
          if (isNaN(value)) {
            errors.push('Debe ser un número válido');
          } else {
            const num = parseFloat(value);
            if (rule.min !== undefined && num < rule.min) {
              errors.push(`El valor mínimo es ${rule.min}`);
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push(`El valor máximo es ${rule.max}`);
            }
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push('Debe ser una URL válida');
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push('Debe ser un email válido');
          }
          break;
      }
    }

    // Length validation
    if (value && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`Mínimo ${rule.minLength} caracteres`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Máximo ${rule.maxLength} caracteres`);
      }
    }

    // Update validation state
    if (errors.length > 0) {
      this.state.validationErrors[key] = errors[0];
    } else {
      delete this.state.validationErrors[key];
    }

    this.updateFieldValidation(key);
    return errors.length === 0;
  }

  updateFieldValidation(key) {
    const field = this.container.querySelector(`[name="${key}"]`);
    if (!field) return;

    const formGroup = field.closest('.form-group');
    const errorElement = formGroup.querySelector('.form-error');

    if (this.state.validationErrors[key]) {
      formGroup.classList.add('has-error');
      if (errorElement) {
        errorElement.textContent = this.state.validationErrors[key];
      }
    } else {
      formGroup.classList.remove('has-error');
      if (errorElement) {
        errorElement.textContent = '';
      }
    }
  }

  markAsChanged() {
    this.hasUnsavedChanges = true;
    this.setState({ isDirty: true });
    this.elements.saveBtn.disabled = false;
    this.updateSidebarIndicators();
  }

  updateSidebarIndicators() {
    // Update section indicators
    Object.keys(this.sections).forEach(sectionKey => {
      const sectionElement = this.container.querySelector(
        `[data-section="${sectionKey}"]`
      );
      if (sectionElement) {
        const hasChanges = this.hasUnsavedChangesInSection(sectionKey);
        const indicator = sectionElement.querySelector('.changes-indicator');

        if (hasChanges && !indicator) {
          const iconDiv = sectionElement.querySelector('.section-icon');
          iconDiv.insertAdjacentHTML(
            'beforeend',
            '<div class="changes-indicator"></div>'
          );
        } else if (!hasChanges && indicator) {
          indicator.remove();
        }
      }
    });

    // Update tab indicators
    const section = this.sections[this.state.activeSection];
    if (section && section.tabs) {
      Object.keys(section.tabs).forEach(tabKey => {
        const tabElement = this.container.querySelector(
          `[data-tab="${tabKey}"]`
        );
        if (tabElement) {
          const hasChanges = this.hasUnsavedChangesInTab(
            this.state.activeSection,
            tabKey
          );
          const indicator = tabElement.querySelector('.changes-indicator');

          if (hasChanges && !indicator) {
            tabElement.insertAdjacentHTML(
              'beforeend',
              '<div class="changes-indicator"></div>'
            );
          } else if (!hasChanges && indicator) {
            indicator.remove();
          }
        }
      });
    }
  }

  hasUnsavedChangesInSection(sectionKey) {
    // Check if any settings in this section have changed
    const originalSection = this.getSettingsForSection(
      this.originalSettings,
      sectionKey
    );
    const currentSection = this.getSettingsForSection(
      this.settings,
      sectionKey
    );

    return JSON.stringify(originalSection) !== JSON.stringify(currentSection);
  }

  hasUnsavedChangesInTab(sectionKey, tabKey) {
    // Check if any settings in this tab have changed
    const originalTab = this.getSettingsForTab(sectionKey, tabKey);
    const currentTab = this.getSettingsForTab(sectionKey, tabKey);

    return Object.keys(originalTab).some(key => {
      const originalValue = this.getSettingFromObject(
        this.originalSettings,
        key
      );
      const currentValue = this.getSetting(key);
      return originalValue !== currentValue;
    });
  }

  getSettingsForSection(settings, sectionKey) {
    // Extract all settings that belong to a section
    const sectionSettings = {};
    const prefix = sectionKey + '.';

    this.flattenObject(settings).forEach(([key, value]) => {
      if (key.startsWith(prefix)) {
        sectionSettings[key] = value;
      }
    });

    return sectionSettings;
  }

  getSettingFromObject(obj, key) {
    const keys = key.split('.');
    let current = obj;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  flattenObject(obj, prefix = '') {
    const flattened = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flattened.push(...this.flattenObject(value, fullKey));
      } else {
        flattened.push([fullKey, value]);
      }
    }

    return flattened;
  }

  scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.saveSettings(true);
    }, this.options.autoSaveDelay);
  }

  async saveSettings(isAutoSave = false) {
    // Validate all settings
    const isValid = this.validateAllSettings();
    if (!isValid) {
      this.showToast('Corrige los errores antes de guardar', 'warning');
      return;
    }

    this.setState({ loading: true });
    if (!isAutoSave) this.showLoading();

    try {
      const response = await this.request('/api/settings', {
        method: 'POST',
        body: this.settings,
      });

      if (response.success) {
        this.originalSettings = JSON.parse(JSON.stringify(this.settings));
        this.hasUnsavedChanges = false;
        this.setState({ isDirty: false, lastSaved: new Date() });
        this.elements.saveBtn.disabled = true;
        this.updateSidebarIndicators();
        this.updateLastSavedDisplay();

        if (!isAutoSave) {
          this.showToast('Configuraciones guardadas correctamente', 'success');
        } else {
          this.showStatus('Guardado automático completado', 'success', 3000);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showToast('Error al guardar configuraciones', 'error');
    } finally {
      this.setState({ loading: false });
      if (!isAutoSave) this.hideLoading();
    }
  }

  validateAllSettings() {
    let isValid = true;

    // Clear previous errors
    this.state.validationErrors = {};

    // Validate all settings with rules
    Object.keys(this.validationRules).forEach(key => {
      const value = this.getSetting(key);
      if (!this.validateSetting(key, value)) {
        isValid = false;
      }
    });

    return isValid;
  }

  updateLastSavedDisplay() {
    if (this.state.lastSaved) {
      this.elements.lastSaved.innerHTML = `
        <div class="last-saved-info">
          <i class="fas fa-check-circle"></i>
          <span>Guardado ${this.getTimeAgo(this.state.lastSaved)}</span>
        </div>
      `;
    }
  }

  // Event handlers
  handleSearch() {
    const query = this.elements.settingsSearch.value.toLowerCase();
    this.setState({ searchQuery: query });
    this.filterSettings(query);
  }

  filterSettings(query) {
    if (!query) {
      // Show all settings
      this.container.querySelectorAll('.form-group').forEach(group => {
        group.style.display = '';
      });
      return;
    }

    // Filter settings based on label, description, or key
    this.container.querySelectorAll('.form-group').forEach(group => {
      const label =
        group.querySelector('.form-label')?.textContent.toLowerCase() || '';
      const description =
        group.querySelector('.form-help')?.textContent.toLowerCase() || '';
      const input = group.querySelector('input, select, textarea');
      const key = input?.name?.toLowerCase() || '';

      const matches =
        label.includes(query) ||
        description.includes(query) ||
        key.includes(query);
      group.style.display = matches ? '' : 'none';
    });
  }

  toggleAdvancedSettings() {
    this.setState({ showAdvanced: this.elements.advancedToggle.checked });
    this.renderSidebar();

    // If currently viewing advanced section and toggling off, switch to general
    if (!this.state.showAdvanced && this.state.activeSection === 'advanced') {
      this.switchSection('general');
    }
  }

  async resetSettings() {
    if (
      !confirm(
        '¿Estás seguro de que quieres restablecer todas las configuraciones?'
      )
    ) {
      return;
    }

    try {
      const response = await this.request('/api/settings/reset', {
        method: 'POST',
      });

      if (response.success) {
        await this.loadSettings();
        this.renderSectionContent();
        this.showToast('Configuraciones restablecidas', 'success');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showToast('Error al restablecer configuraciones', 'error');
    }
  }

  async exportSettings() {
    try {
      const response = await this.request('/api/settings/export');

      if (response.success && response.data) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Configuraciones exportadas', 'success');
      }
    } catch (error) {
      console.error('Error exporting settings:', error);
      this.showToast('Error al exportar configuraciones', 'error');
    }
  }

  // Modal methods
  showUnsavedChangesModal() {
    this.showModal(this.elements.unsavedChangesModal);
  }

  hideUnsavedChangesModal() {
    this.hideModal(this.elements.unsavedChangesModal);
  }

  discardChanges() {
    this.settings = JSON.parse(JSON.stringify(this.originalSettings));
    this.hasUnsavedChanges = false;
    this.setState({ isDirty: false, validationErrors: {} });
    this.elements.saveBtn.disabled = true;
    this.updateSidebarIndicators();
    this.hideUnsavedChangesModal();

    if (this.pendingSection) {
      this.switchSection(this.pendingSection);
      this.pendingSection = null;
    }

    this.renderSectionContent();
    this.showToast('Cambios descartados', 'info');
  }

  async saveChangesFromModal() {
    await this.saveSettings();
    this.hideUnsavedChangesModal();

    if (this.pendingSection) {
      this.switchSection(this.pendingSection);
      this.pendingSection = null;
    }
  }

  cancelNavigation() {
    this.hideUnsavedChangesModal();
    this.pendingSection = null;
  }

  showImportModal() {
    this.showModal(this.elements.importModal);
  }

  hideImportModal() {
    this.hideModal(this.elements.importModal);
  }

  handleImportMethodChange(event) {
    const method = event.target.value;

    this.elements.fileUploadArea.style.display =
      method === 'file' ? 'block' : 'none';
    this.elements.textImportArea.style.display =
      method === 'text' ? 'block' : 'none';

    this.updateImportButton();
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.updateImportButton();
    }
  }

  updateImportButton() {
    const method = this.container.querySelector(
      'input[name="importMethod"]:checked'
    ).value;
    const hasFile = method === 'file' && this.selectedFile;
    const hasText =
      method === 'text' && this.elements.settingsText.value.trim();

    this.elements.executeImportBtn.disabled = !(hasFile || hasText);
  }

  setupFileDragAndDrop() {
    const uploadArea = this.elements.fileUploadArea;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(
        eventName,
        () => uploadArea.classList.add('drag-over'),
        false
      );
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(
        eventName,
        () => uploadArea.classList.remove('drag-over'),
        false
      );
    });

    uploadArea.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.elements.settingsFile.files = files;
      this.selectedFile = files[0];
      this.updateImportButton();
    }
  }

  async executeImport() {
    const method = this.container.querySelector(
      'input[name="importMethod"]:checked'
    ).value;
    let settingsData;

    try {
      if (method === 'file') {
        const text = await this.readFile(this.selectedFile);
        settingsData = JSON.parse(text);
      } else {
        settingsData = JSON.parse(this.elements.settingsText.value);
      }

      // Validate if requested
      if (this.elements.validateImport.checked) {
        const isValid = this.validateImportedSettings(settingsData);
        if (!isValid) {
          this.showToast('Los datos importados contienen errores', 'error');
          return;
        }
      }

      // Create backup if requested
      if (this.elements.backupBeforeImport.checked) {
        await this.createBackup();
      }

      // Import settings
      if (this.elements.mergeSettings.checked) {
        this.settings = { ...this.settings, ...settingsData };
      } else {
        this.settings = settingsData;
      }

      this.markAsChanged();
      this.renderSectionContent();
      this.hideImportModal();
      this.showToast('Configuraciones importadas correctamente', 'success');
    } catch (error) {
      console.error('Error importing settings:', error);
      this.showToast('Error al importar configuraciones', 'error');
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  validateImportedSettings(settings) {
    // Basic validation of imported settings structure
    try {
      // Check if it's a valid object
      if (typeof settings !== 'object' || settings === null) {
        return false;
      }

      // Validate specific required fields
      const requiredFields = ['general', 'bots'];
      for (const field of requiredFields) {
        if (!(field in settings)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  showBackupModal() {
    this.renderBackupsList();
    this.showModal(this.elements.backupModal);
  }

  hideBackupModal() {
    this.hideModal(this.elements.backupModal);
  }

  async createBackup() {
    try {
      const response = await this.request('/api/settings/backup', {
        method: 'POST',
        body: {
          name: `Backup ${new Date().toLocaleString()}`,
          settings: this.settings,
        },
      });

      if (response.success) {
        this.backups.unshift(response.backup);
        this.renderBackupsList();
        this.showToast('Respaldo creado correctamente', 'success');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      this.showToast('Error al crear respaldo', 'error');
    }
  }

  renderBackupsList() {
    if (this.backups.length === 0) {
      this.elements.backupsList.innerHTML = `
        <div class="no-backups">
          <i class="fas fa-archive"></i>
          <h3>No hay respaldos</h3>
          <p>Crea tu primer respaldo de configuraciones</p>
        </div>
      `;
      return;
    }

    const html = this.backups
      .map(
        backup => `
      <div class="backup-item">
        <div class="backup-info">
          <h4 class="backup-name">${backup.name}</h4>
          <div class="backup-meta">
            <span class="backup-date">
              <i class="fas fa-calendar"></i>
              ${new Date(backup.createdAt).toLocaleString()}
            </span>
            <span class="backup-size">
              <i class="fas fa-file"></i>
              ${this.formatFileSize(backup.size)}
            </span>
          </div>
        </div>
        
        <div class="backup-actions">
          <button class="btn btn-sm btn-secondary" onclick="this.restoreBackup('${backup.id}')">
            <i class="fas fa-undo"></i>
            Restaurar
          </button>
          <button class="btn btn-sm btn-secondary" onclick="this.downloadBackup('${backup.id}')">
            <i class="fas fa-download"></i>
            Descargar
          </button>
          <button class="btn btn-sm btn-danger" onclick="this.deleteBackup('${backup.id}')">
            <i class="fas fa-trash"></i>
            Eliminar
          </button>
        </div>
      </div>
    `
      )
      .join('');

    this.elements.backupsList.innerHTML = html;
  }

  // Utility methods
  togglePasswordVisibility(event) {
    const button = event.target.closest('.toggle-password');
    const targetId = button.dataset.target;
    const input = this.container.querySelector(`#${targetId}`);
    const icon = button.querySelector('i');

    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  }

  syncColorInput(event) {
    const textInput = event.target;
    const colorInputId = textInput.dataset.colorInput;
    const colorInput = this.container.querySelector(`#${colorInputId}`);

    if (colorInput && this.isValidColor(textInput.value)) {
      colorInput.value = textInput.value;
    }
  }

  isValidColor(color) {
    const style = new Option().style;
    style.color = color;
    return style.color !== '';
  }

  getTimezoneOptions() {
    return [
      { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
      { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
      { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
      { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
      { value: 'Europe/London', label: 'Londres (GMT+0)' },
      { value: 'Asia/Tokyo', label: 'Tokio (GMT+9)' },
      { value: 'UTC', label: 'UTC (GMT+0)' },
    ];
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;

    const days = Math.floor(hours / 24);
    return `hace ${days} día${days > 1 ? 's' : ''}`;
  }

  showStatus(message, type = 'info', duration = 5000) {
    const status = this.elements.settingsStatus;
    const icon = status.querySelector('.status-icon');
    const text = status.querySelector('.status-text');

    // Set icon based on type
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle',
    };

    icon.className = `status-icon ${icons[type] || icons.info}`;
    text.textContent = message;
    status.className = `settings-status ${type}`;
    status.style.display = 'block';

    if (duration > 0) {
      setTimeout(() => {
        status.style.display = 'none';
      }, duration);
    }
  }

  dismissStatus() {
    this.elements.settingsStatus.style.display = 'none';
  }

  showLoading() {
    this.elements.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
  }

  showModal(modal) {
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  hideModal(modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  handleBeforeUnload(event) {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  }

  destroy() {
    // Clean up auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Remove beforeunload listener
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    super.destroy();
  }
}
