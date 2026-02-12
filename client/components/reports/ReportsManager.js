/**
 * Gestor de reportes modular
 * Maneja la generación, visualización y exportación de reportes
 */
class ReportsManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      autoRefresh: true,
      refreshInterval: 30000,
      enableExport: true,
      enableScheduling: true,
      enableCustomReports: true,
      maxReportsHistory: 100,
      defaultDateRange: 'last_7_days',
      enableRealTime: true,
      chartAnimations: true,
    };
  }

  async beforeInit() {
    this.reports = [];
    this.templates = [];
    this.scheduledReports = [];
    this.currentReport = null;
    this.refreshTimer = null;
    this.charts = {};

    this.state = {
      loading: false,
      activeTab: 'overview',
      selectedDateRange: this.options.defaultDateRange,
      customDateStart: null,
      customDateEnd: null,
      selectedFilters: {},
      reportData: {},
      isGenerating: false,
      lastUpdated: null,
      viewMode: 'charts', // charts, tables, mixed
    };

    this.reportTypes = this.getReportTypes();
    this.dateRanges = this.getDateRanges();
    this.exportFormats = this.getExportFormats();
  }

  getReportTypes() {
    return {
      overview: {
        name: 'Resumen general',
        icon: 'fas fa-chart-pie',
        description: 'Vista general de métricas principales',
        widgets: [
          'total_messages',
          'active_conversations',
          'response_time',
          'user_satisfaction',
        ],
      },
      messages: {
        name: 'Análisis de mensajes',
        icon: 'fas fa-comments',
        description: 'Estadísticas detalladas de mensajes',
        widgets: [
          'message_volume',
          'message_types',
          'peak_hours',
          'response_patterns',
        ],
      },
      users: {
        name: 'Análisis de usuarios',
        icon: 'fas fa-users',
        description: 'Comportamiento y engagement de usuarios',
        widgets: [
          'user_activity',
          'new_users',
          'retention_rate',
          'user_journey',
        ],
      },
      performance: {
        name: 'Rendimiento del sistema',
        icon: 'fas fa-tachometer-alt',
        description: 'Métricas de rendimiento y disponibilidad',
        widgets: ['response_times', 'error_rates', 'uptime', 'resource_usage'],
      },
      bots: {
        name: 'Análisis de bots',
        icon: 'fas fa-robot',
        description: 'Efectividad y rendimiento de bots',
        widgets: [
          'bot_interactions',
          'success_rate',
          'fallback_triggers',
          'training_needs',
        ],
      },
      business: {
        name: 'Métricas de negocio',
        icon: 'fas fa-chart-line',
        description: 'KPIs y métricas de negocio',
        widgets: [
          'conversion_rate',
          'revenue_impact',
          'cost_per_interaction',
          'roi_analysis',
        ],
      },
      custom: {
        name: 'Reportes personalizados',
        icon: 'fas fa-cogs',
        description: 'Reportes creados por el usuario',
        widgets: [],
      },
    };
  }

  getDateRanges() {
    return {
      today: { name: 'Hoy', days: 0 },
      yesterday: { name: 'Ayer', days: 1 },
      last_7_days: { name: 'Últimos 7 días', days: 7 },
      last_30_days: { name: 'Últimos 30 días', days: 30 },
      last_90_days: { name: 'Últimos 90 días', days: 90 },
      this_month: { name: 'Este mes', type: 'month', offset: 0 },
      last_month: { name: 'Mes pasado', type: 'month', offset: -1 },
      this_year: { name: 'Este año', type: 'year', offset: 0 },
      custom: { name: 'Personalizado', type: 'custom' },
    };
  }

  getExportFormats() {
    return {
      pdf: { name: 'PDF', icon: 'fas fa-file-pdf', mime: 'application/pdf' },
      excel: {
        name: 'Excel',
        icon: 'fas fa-file-excel',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      csv: { name: 'CSV', icon: 'fas fa-file-csv', mime: 'text/csv' },
      json: {
        name: 'JSON',
        icon: 'fas fa-file-code',
        mime: 'application/json',
      },
      png: { name: 'PNG', icon: 'fas fa-file-image', mime: 'image/png' },
    };
  }

  getTemplate() {
    return `
      <div class="reports-manager">
        <!-- Header -->
        <div class="reports-header">
          <div class="header-left">
            <h2 class="reports-title">
              <i class="fas fa-chart-bar"></i>
              Reportes y análisis
            </h2>
            <div class="reports-subtitle">
              Análisis detallado de métricas y rendimiento
            </div>
          </div>
          
          <div class="header-controls">
            <div class="date-range-selector">
              <label>Período:</label>
              <select id="dateRangeSelect">
                ${Object.entries(this.dateRanges)
                  .map(
                    ([key, range]) =>
                      `<option value="${key}" ${key === this.state.selectedDateRange ? 'selected' : ''}>${range.name}</option>`
                  )
                  .join('')}
              </select>
            </div>
            
            <div class="custom-date-range" id="customDateRange" style="display: none;">
              <input type="date" id="dateStart" />
              <span>a</span>
              <input type="date" id="dateEnd" />
            </div>
            
            <div class="view-mode-toggle">
              <button class="btn btn-sm ${this.state.viewMode === 'charts' ? 'active' : ''}" data-mode="charts">
                <i class="fas fa-chart-bar"></i>
              </button>
              <button class="btn btn-sm ${this.state.viewMode === 'tables' ? 'active' : ''}" data-mode="tables">
                <i class="fas fa-table"></i>
              </button>
              <button class="btn btn-sm ${this.state.viewMode === 'mixed' ? 'active' : ''}" data-mode="mixed">
                <i class="fas fa-th"></i>
              </button>
            </div>
            
            <div class="reports-actions">
              <button class="btn btn-secondary" id="refreshReports">
                <i class="fas fa-sync-alt"></i>
                Actualizar
              </button>
              
              <div class="dropdown">
                <button class="btn btn-secondary dropdown-toggle" id="exportDropdown">
                  <i class="fas fa-download"></i>
                  Exportar
                </button>
                <div class="dropdown-menu" id="exportMenu">
                  ${Object.entries(this.exportFormats)
                    .map(
                      ([key, format]) =>
                        `<a href="#" class="dropdown-item" data-format="${key}">
                      <i class="${format.icon}"></i>
                      ${format.name}
                    </a>`
                    )
                    .join('')}
                </div>
              </div>
              
              <button class="btn btn-primary" id="generateReport">
                <i class="fas fa-plus"></i>
                Nuevo reporte
              </button>
            </div>
          </div>
        </div>

        <!-- Filters bar -->
        <div class="reports-filters" id="reportsFilters">
          <div class="filters-content">
            <div class="filter-group">
              <label>Bot:</label>
              <select id="botFilter" multiple>
                <option value="">Todos los bots</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Canal:</label>
              <select id="channelFilter" multiple>
                <option value="">Todos los canales</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Estado:</label>
              <select id="statusFilter" multiple>
                <option value="">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="resolved">Resuelto</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            
            <div class="filter-actions">
              <button class="btn btn-sm btn-secondary" id="clearFilters">
                <i class="fas fa-times"></i>
                Limpiar
              </button>
              <button class="btn btn-sm btn-primary" id="applyFilters">
                <i class="fas fa-filter"></i>
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <!-- Status bar -->
        <div class="reports-status" id="reportsStatus">
          <div class="status-info">
            <span class="last-updated" id="lastUpdated">
              <!-- Last updated info -->
            </span>
            
            <div class="auto-refresh-toggle">
              <label class="switch">
                <input type="checkbox" id="autoRefreshToggle" ${this.options.autoRefresh ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
              <span>Actualización automática</span>
            </div>
          </div>
          
          <div class="status-actions">
            <button class="btn btn-sm btn-secondary" id="scheduleReport">
              <i class="fas fa-clock"></i>
              Programar
            </button>
            <button class="btn btn-sm btn-secondary" id="saveTemplate">
              <i class="fas fa-save"></i>
              Guardar plantilla
            </button>
          </div>
        </div>

        <!-- Main content -->
        <div class="reports-content">
          <!-- Tabs -->
          <div class="reports-tabs">
            ${Object.entries(this.reportTypes)
              .map(
                ([key, type]) =>
                  `<button class="tab-button ${key === this.state.activeTab ? 'active' : ''}" data-tab="${key}">
                <i class="${type.icon}"></i>
                <span>${type.name}</span>
              </button>`
              )
              .join('')}
          </div>

          <!-- Tab content -->
          <div class="tab-content-container" id="tabContentContainer">
            <!-- Content will be rendered here -->
          </div>
        </div>

        <!-- Generate report modal -->
        <div class="modal" id="generateReportModal" style="display: none;">
          <div class="modal-content large">
            <div class="modal-header">
              <h3>Generar nuevo reporte</h3>
              <button class="btn btn-sm btn-secondary" id="closeGenerateModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="report-wizard">
                <div class="wizard-steps">
                  <div class="step active" data-step="1">
                    <span class="step-number">1</span>
                    <span class="step-title">Tipo</span>
                  </div>
                  <div class="step" data-step="2">
                    <span class="step-number">2</span>
                    <span class="step-title">Configuración</span>
                  </div>
                  <div class="step" data-step="3">
                    <span class="step-number">3</span>
                    <span class="step-title">Previsualización</span>
                  </div>
                </div>
                
                <div class="wizard-content" id="wizardContent">
                  <!-- Wizard steps content -->
                </div>
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" id="wizardPrev" disabled>
                <i class="fas fa-arrow-left"></i>
                Anterior
              </button>
              <button class="btn btn-primary" id="wizardNext">
                Siguiente
                <i class="fas fa-arrow-right"></i>
              </button>
              <button class="btn btn-success" id="wizardFinish" style="display: none;">
                <i class="fas fa-check"></i>
                Generar reporte
              </button>
            </div>
          </div>
        </div>

        <!-- Schedule report modal -->
        <div class="modal" id="scheduleReportModal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Programar reporte</h3>
              <button class="btn btn-sm btn-secondary" id="closeScheduleModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <form id="scheduleForm">
                <div class="form-group">
                  <label>Nombre del reporte</label>
                  <input type="text" id="scheduleName" required />
                </div>
                
                <div class="form-group">
                  <label>Tipo de reporte</label>
                  <select id="scheduleType" required>
                    ${Object.entries(this.reportTypes)
                      .map(
                        ([key, type]) =>
                          `<option value="${key}">${type.name}</option>`
                      )
                      .join('')}
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Frecuencia</label>
                  <select id="scheduleFrequency" required>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Hora de envío</label>
                  <input type="time" id="scheduleTime" value="09:00" required />
                </div>
                
                <div class="form-group">
                  <label>Destinatarios (emails)</label>
                  <textarea id="scheduleEmails" rows="3" placeholder="email1@example.com, email2@example.com"></textarea>
                </div>
                
                <div class="form-group">
                  <label>Formato de exportación</label>
                  <select id="scheduleFormat">
                    ${Object.entries(this.exportFormats)
                      .map(
                        ([key, format]) =>
                          `<option value="${key}">${format.name}</option>`
                      )
                      .join('')}
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="scheduleActive" checked />
                    <span>Activar programación</span>
                  </label>
                </div>
              </form>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" id="cancelSchedule">
                Cancelar
              </button>
              <button class="btn btn-primary" id="saveSchedule">
                <i class="fas fa-save"></i>
                Guardar programación
              </button>
            </div>
          </div>
        </div>

        <!-- Loading overlay -->
        <div class="loading-overlay" id="loadingOverlay" style="display: none;">
          <div class="loading-content">
            <i class="fas fa-spinner fa-spin"></i>
            <span id="loadingText">Generando reporte...</span>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      // Header controls
      dateRangeSelect: this.container.querySelector('#dateRangeSelect'),
      customDateRange: this.container.querySelector('#customDateRange'),
      dateStart: this.container.querySelector('#dateStart'),
      dateEnd: this.container.querySelector('#dateEnd'),
      refreshBtn: this.container.querySelector('#refreshReports'),
      exportDropdown: this.container.querySelector('#exportDropdown'),
      exportMenu: this.container.querySelector('#exportMenu'),
      generateReportBtn: this.container.querySelector('#generateReport'),

      // View mode toggle
      viewModeButtons: this.container.querySelectorAll('[data-mode]'),

      // Filters
      reportsFilters: this.container.querySelector('#reportsFilters'),
      botFilter: this.container.querySelector('#botFilter'),
      channelFilter: this.container.querySelector('#channelFilter'),
      statusFilter: this.container.querySelector('#statusFilter'),
      clearFiltersBtn: this.container.querySelector('#clearFilters'),
      applyFiltersBtn: this.container.querySelector('#applyFilters'),

      // Status
      reportsStatus: this.container.querySelector('#reportsStatus'),
      lastUpdated: this.container.querySelector('#lastUpdated'),
      autoRefreshToggle: this.container.querySelector('#autoRefreshToggle'),
      scheduleReportBtn: this.container.querySelector('#scheduleReport'),
      saveTemplateBtn: this.container.querySelector('#saveTemplate'),

      // Content
      tabButtons: this.container.querySelectorAll('.tab-button'),
      tabContentContainer: this.container.querySelector('#tabContentContainer'),

      // Loading
      loadingOverlay: this.container.querySelector('#loadingOverlay'),
      loadingText: this.container.querySelector('#loadingText'),

      // Modals
      generateReportModal: this.container.querySelector('#generateReportModal'),
      closeGenerateModalBtn: this.container.querySelector(
        '#closeGenerateModal'
      ),
      wizardContent: this.container.querySelector('#wizardContent'),
      wizardPrevBtn: this.container.querySelector('#wizardPrev'),
      wizardNextBtn: this.container.querySelector('#wizardNext'),
      wizardFinishBtn: this.container.querySelector('#wizardFinish'),

      scheduleReportModal: this.container.querySelector('#scheduleReportModal'),
      closeScheduleModalBtn: this.container.querySelector(
        '#closeScheduleModal'
      ),
      scheduleForm: this.container.querySelector('#scheduleForm'),
      cancelScheduleBtn: this.container.querySelector('#cancelSchedule'),
      saveScheduleBtn: this.container.querySelector('#saveSchedule'),
    };
  }

  bindEvents() {
    // Header controls
    this.addEventListener(
      this.elements.dateRangeSelect,
      'change',
      this.handleDateRangeChange
    );
    this.addEventListener(
      this.elements.dateStart,
      'change',
      this.handleCustomDateChange
    );
    this.addEventListener(
      this.elements.dateEnd,
      'change',
      this.handleCustomDateChange
    );
    this.addEventListener(
      this.elements.refreshBtn,
      'click',
      this.refreshReports
    );
    this.addEventListener(
      this.elements.generateReportBtn,
      'click',
      this.showGenerateReportModal
    );

    // View mode toggle
    this.elements.viewModeButtons.forEach(button => {
      this.addEventListener(button, 'click', () => {
        this.switchViewMode(button.dataset.mode);
      });
    });

    // Export dropdown
    this.addEventListener(
      this.elements.exportDropdown,
      'click',
      this.toggleExportMenu
    );
    this.elements.exportMenu
      .querySelectorAll('.dropdown-item')
      .forEach(item => {
        this.addEventListener(item, 'click', e => {
          e.preventDefault();
          this.exportReport(item.dataset.format);
        });
      });

    // Filters
    this.addEventListener(
      this.elements.clearFiltersBtn,
      'click',
      this.clearFilters
    );
    this.addEventListener(
      this.elements.applyFiltersBtn,
      'click',
      this.applyFilters
    );

    // Status controls
    this.addEventListener(
      this.elements.autoRefreshToggle,
      'change',
      this.toggleAutoRefresh
    );
    this.addEventListener(
      this.elements.scheduleReportBtn,
      'click',
      this.showScheduleReportModal
    );
    this.addEventListener(
      this.elements.saveTemplateBtn,
      'click',
      this.saveTemplate
    );

    // Tabs
    this.elements.tabButtons.forEach(button => {
      this.addEventListener(button, 'click', () => {
        this.switchTab(button.dataset.tab);
      });
    });

    // Modals
    this.addEventListener(
      this.elements.closeGenerateModalBtn,
      'click',
      this.hideGenerateReportModal
    );
    this.addEventListener(
      this.elements.wizardPrevBtn,
      'click',
      this.wizardPrevStep
    );
    this.addEventListener(
      this.elements.wizardNextBtn,
      'click',
      this.wizardNextStep
    );
    this.addEventListener(
      this.elements.wizardFinishBtn,
      'click',
      this.wizardFinish
    );

    this.addEventListener(
      this.elements.closeScheduleModalBtn,
      'click',
      this.hideScheduleReportModal
    );
    this.addEventListener(
      this.elements.cancelScheduleBtn,
      'click',
      this.hideScheduleReportModal
    );
    this.addEventListener(
      this.elements.saveScheduleBtn,
      'click',
      this.saveScheduledReport
    );

    // Close dropdowns when clicking outside
    document.addEventListener('click', e => {
      if (!this.elements.exportDropdown.contains(e.target)) {
        this.elements.exportMenu.classList.remove('show');
      }
    });
  }

  async afterInit() {
    await this.loadInitialData();
    this.renderTabContent();
    this.startAutoRefresh();
  }

  async loadInitialData() {
    this.setState({ loading: true });
    this.showLoading('Cargando datos iniciales...');

    try {
      // Load available bots for filter
      const botsResponse = await this.request('/api/bots');
      this.populateBotFilter(botsResponse.bots || []);

      // Load report data
      await this.loadReportData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showToast('Error al cargar datos iniciales', 'error');
    } finally {
      this.setState({ loading: false });
      this.hideLoading();
    }
  }

  populateBotFilter(bots) {
    const botFilter = this.elements.botFilter;
    botFilter.innerHTML = '<option value="">Todos los bots</option>';

    bots.forEach(bot => {
      const option = document.createElement('option');
      option.value = bot.id;
      option.textContent = bot.name;
      botFilter.appendChild(option);
    });
  }

  async loadReportData() {
    const dateRange = this.getDateRangeParams();
    const filters = this.getActiveFilters();

    try {
      const response = await this.request('/api/reports/data', {
        method: 'POST',
        body: {
          type: this.state.activeTab,
          dateRange,
          filters,
          viewMode: this.state.viewMode,
        },
      });

      this.setState({
        reportData: response.data || {},
        lastUpdated: new Date(),
      });

      this.updateLastUpdatedDisplay();
    } catch (error) {
      console.error('Error loading report data:', error);
      this.showToast('Error al cargar datos del reporte', 'error');
    }
  }

  getDateRangeParams() {
    const range = this.dateRanges[this.state.selectedDateRange];

    if (this.state.selectedDateRange === 'custom') {
      return {
        type: 'custom',
        start: this.state.customDateStart,
        end: this.state.customDateEnd,
      };
    }

    if (range.type === 'month') {
      const date = new Date();
      date.setMonth(date.getMonth() + range.offset);
      return {
        type: 'month',
        year: date.getFullYear(),
        month: date.getMonth(),
      };
    }

    if (range.type === 'year') {
      const date = new Date();
      date.setFullYear(date.getFullYear() + range.offset);
      return {
        type: 'year',
        year: date.getFullYear(),
      };
    }

    return {
      type: 'days',
      days: range.days,
    };
  }

  getActiveFilters() {
    return {
      bots: Array.from(this.elements.botFilter.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v),
      channels: Array.from(this.elements.channelFilter.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v),
      statuses: Array.from(this.elements.statusFilter.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v),
    };
  }

  renderTabContent() {
    const reportType = this.reportTypes[this.state.activeTab];
    if (!reportType) return;

    const contentHTML = this.generateTabContent(reportType);
    this.elements.tabContentContainer.innerHTML = contentHTML;

    // Initialize charts and widgets
    this.initializeWidgets(reportType.widgets);
  }

  generateTabContent(reportType) {
    const data = this.state.reportData[this.state.activeTab] || {};

    return `
      <div class="report-content">
        <div class="report-header">
          <h3 class="report-title">
            <i class="${reportType.icon}"></i>
            ${reportType.name}
          </h3>
          <p class="report-description">${reportType.description}</p>
        </div>
        
        <div class="report-widgets" id="reportWidgets">
          ${this.generateWidgets(reportType.widgets, data)}
        </div>
      </div>
    `;
  }

  generateWidgets(widgets, data) {
    return widgets
      .map(widgetType => {
        const widgetData = data[widgetType] || {};
        return this.generateWidget(widgetType, widgetData);
      })
      .join('');
  }

  generateWidget(type, data) {
    const widgetConfig = this.getWidgetConfig(type);

    return `
      <div class="widget ${widgetConfig.size || 'medium'}" data-widget="${type}">
        <div class="widget-header">
          <h4 class="widget-title">
            <i class="${widgetConfig.icon}"></i>
            ${widgetConfig.title}
          </h4>
          
          <div class="widget-actions">
            <button class="btn btn-sm btn-secondary" onclick="this.refreshWidget('${type}')">
              <i class="fas fa-sync-alt"></i>
            </button>
            <button class="btn btn-sm btn-secondary" onclick="this.exportWidget('${type}')">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
        
        <div class="widget-content" id="widget-${type}">
          ${this.generateWidgetContent(type, data, widgetConfig)}
        </div>
      </div>
    `;
  }

  getWidgetConfig(type) {
    const configs = {
      total_messages: {
        title: 'Total de mensajes',
        icon: 'fas fa-envelope',
        type: 'metric',
        size: 'small',
      },
      active_conversations: {
        title: 'Conversaciones activas',
        icon: 'fas fa-comments',
        type: 'metric',
        size: 'small',
      },
      response_time: {
        title: 'Tiempo de respuesta promedio',
        icon: 'fas fa-clock',
        type: 'metric',
        size: 'small',
      },
      user_satisfaction: {
        title: 'Satisfacción del usuario',
        icon: 'fas fa-star',
        type: 'metric',
        size: 'small',
      },
      message_volume: {
        title: 'Volumen de mensajes',
        icon: 'fas fa-chart-line',
        type: 'chart',
        chartType: 'line',
        size: 'large',
      },
      message_types: {
        title: 'Tipos de mensajes',
        icon: 'fas fa-chart-pie',
        type: 'chart',
        chartType: 'pie',
        size: 'medium',
      },
      peak_hours: {
        title: 'Horas pico',
        icon: 'fas fa-chart-bar',
        type: 'chart',
        chartType: 'bar',
        size: 'medium',
      },
      user_activity: {
        title: 'Actividad de usuarios',
        icon: 'fas fa-chart-area',
        type: 'chart',
        chartType: 'area',
        size: 'large',
      },
      response_times: {
        title: 'Tiempos de respuesta',
        icon: 'fas fa-chart-line',
        type: 'chart',
        chartType: 'line',
        size: 'medium',
      },
      error_rates: {
        title: 'Tasas de error',
        icon: 'fas fa-exclamation-triangle',
        type: 'chart',
        chartType: 'line',
        size: 'medium',
      },
    };

    return (
      configs[type] || { title: type, icon: 'fas fa-chart-bar', type: 'chart' }
    );
  }

  generateWidgetContent(type, data, config) {
    if (config.type === 'metric') {
      return this.generateMetricWidget(data);
    } else if (config.type === 'chart') {
      return this.generateChartWidget(type, data, config);
    } else if (config.type === 'table') {
      return this.generateTableWidget(data);
    }

    return '<div class="no-data">No hay datos disponibles</div>';
  }

  generateMetricWidget(data) {
    const value = data.value || 0;
    const change = data.change || 0;
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

    return `
      <div class="metric-widget">
        <div class="metric-value">${this.formatNumber(value)}</div>
        <div class="metric-change ${changeClass}">
          <i class="fas ${changeIcon}"></i>
          <span>${Math.abs(change)}%</span>
        </div>
        <div class="metric-period">${data.period || 'vs período anterior'}</div>
      </div>
    `;
  }

  generateChartWidget(type, data, config) {
    return `
      <div class="chart-widget">
        <canvas id="chart-${type}" width="400" height="200"></canvas>
      </div>
    `;
  }

  generateTableWidget(data) {
    if (!data.headers || !data.rows) {
      return '<div class="no-data">No hay datos disponibles</div>';
    }

    return `
      <div class="table-widget">
        <table class="data-table">
          <thead>
            <tr>
              ${data.headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.rows
              .map(
                row =>
                  `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async initializeWidgets(widgets) {
    // Initialize charts for chart widgets
    for (const widgetType of widgets) {
      const config = this.getWidgetConfig(widgetType);
      if (config.type === 'chart') {
        await this.initializeChart(widgetType, config);
      }
    }
  }

  async initializeChart(type, config) {
    const canvas = this.container.querySelector(`#chart-${type}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const data = this.state.reportData[this.state.activeTab]?.[type] || {};

    // Destroy existing chart if it exists
    if (this.charts[type]) {
      this.charts[type].destroy();
    }

    const chartConfig = this.getChartConfig(config.chartType, data);

    // Import Chart.js if not already loaded
    if (typeof Chart === 'undefined') {
      await this.loadChartJS();
    }

    this.charts[type] = new Chart(ctx, chartConfig);
  }

  getChartConfig(chartType, data) {
    const baseConfig = {
      responsive: true,
      maintainAspectRatio: false,
      animation: this.options.chartAnimations,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
    };

    switch (chartType) {
      case 'line':
        return {
          type: 'line',
          data: {
            labels: data.labels || [],
            datasets: data.datasets || [],
          },
          options: {
            ...baseConfig,
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: data.xAxisLabel || 'Tiempo',
                },
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: data.yAxisLabel || 'Valor',
                },
              },
            },
          },
        };

      case 'bar':
        return {
          type: 'bar',
          data: {
            labels: data.labels || [],
            datasets: data.datasets || [],
          },
          options: {
            ...baseConfig,
            scales: {
              x: {
                display: true,
              },
              y: {
                display: true,
                beginAtZero: true,
              },
            },
          },
        };

      case 'pie':
        return {
          type: 'pie',
          data: {
            labels: data.labels || [],
            datasets: [
              {
                data: data.values || [],
                backgroundColor:
                  data.colors ||
                  this.getDefaultColors(data.labels?.length || 0),
              },
            ],
          },
          options: baseConfig,
        };

      case 'area':
        return {
          type: 'line',
          data: {
            labels: data.labels || [],
            datasets: (data.datasets || []).map(dataset => ({
              ...dataset,
              fill: true,
            })),
          },
          options: {
            ...baseConfig,
            elements: {
              line: {
                tension: 0.4,
              },
            },
          },
        };

      default:
        return {
          type: 'bar',
          data: {
            labels: data.labels || [],
            datasets: data.datasets || [],
          },
          options: baseConfig,
        };
    }
  }

  getDefaultColors(count) {
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#FF6384',
      '#C9CBCF',
    ];

    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  }

  async loadChartJS() {
    return new Promise((resolve, reject) => {
      if (typeof Chart !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Event handlers
  handleDateRangeChange() {
    const selectedRange = this.elements.dateRangeSelect.value;
    this.setState({ selectedDateRange: selectedRange });

    if (selectedRange === 'custom') {
      this.elements.customDateRange.style.display = 'flex';
    } else {
      this.elements.customDateRange.style.display = 'none';
      this.refreshReports();
    }
  }

  handleCustomDateChange() {
    const start = this.elements.dateStart.value;
    const end = this.elements.dateEnd.value;

    if (start && end) {
      this.setState({
        customDateStart: start,
        customDateEnd: end,
      });
      this.refreshReports();
    }
  }

  switchViewMode(mode) {
    this.setState({ viewMode: mode });

    // Update button states
    this.elements.viewModeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });

    this.refreshReports();
  }

  switchTab(tabKey) {
    this.setState({ activeTab: tabKey });

    // Update tab states
    this.elements.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabKey);
    });

    this.renderTabContent();
  }

  async refreshReports() {
    await this.loadReportData();
    this.renderTabContent();
    this.showToast('Reportes actualizados', 'success');
  }

  clearFilters() {
    this.elements.botFilter.selectedIndex = 0;
    this.elements.channelFilter.selectedIndex = 0;
    this.elements.statusFilter.selectedIndex = 0;
    this.refreshReports();
  }

  applyFilters() {
    this.refreshReports();
  }

  toggleAutoRefresh() {
    const enabled = this.elements.autoRefreshToggle.checked;

    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.options.autoRefresh) {
      this.refreshTimer = setInterval(() => {
        this.refreshReports();
      }, this.options.refreshInterval);
    }
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  toggleExportMenu() {
    this.elements.exportMenu.classList.toggle('show');
  }

  async exportReport(format) {
    this.elements.exportMenu.classList.remove('show');

    this.showLoading(
      `Exportando reporte en formato ${format.toUpperCase()}...`
    );

    try {
      const response = await this.request('/api/reports/export', {
        method: 'POST',
        body: {
          type: this.state.activeTab,
          format,
          dateRange: this.getDateRangeParams(),
          filters: this.getActiveFilters(),
          data: this.state.reportData,
        },
      });

      if (response.success && response.downloadUrl) {
        // Download the file
        const a = document.createElement('a');
        a.href = response.downloadUrl;
        a.download = response.filename;
        a.click();

        this.showToast(
          `Reporte exportado en formato ${format.toUpperCase()}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      this.showToast('Error al exportar reporte', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Modal methods
  showGenerateReportModal() {
    this.currentWizardStep = 1;
    this.renderWizardStep();
    this.showModal(this.elements.generateReportModal);
  }

  hideGenerateReportModal() {
    this.hideModal(this.elements.generateReportModal);
  }

  showScheduleReportModal() {
    this.showModal(this.elements.scheduleReportModal);
  }

  hideScheduleReportModal() {
    this.hideModal(this.elements.scheduleReportModal);
  }

  renderWizardStep() {
    const stepContent = this.getWizardStepContent(this.currentWizardStep);
    this.elements.wizardContent.innerHTML = stepContent;

    // Update step indicators
    this.container
      .querySelectorAll('.wizard-steps .step')
      .forEach((step, index) => {
        step.classList.toggle('active', index + 1 === this.currentWizardStep);
        step.classList.toggle('completed', index + 1 < this.currentWizardStep);
      });

    // Update navigation buttons
    this.elements.wizardPrevBtn.disabled = this.currentWizardStep === 1;
    this.elements.wizardNextBtn.style.display =
      this.currentWizardStep === 3 ? 'none' : 'inline-block';
    this.elements.wizardFinishBtn.style.display =
      this.currentWizardStep === 3 ? 'inline-block' : 'none';
  }

  getWizardStepContent(step) {
    switch (step) {
      case 1:
        return `
          <div class="wizard-step">
            <h4>Selecciona el tipo de reporte</h4>
            <div class="report-types-grid">
              ${Object.entries(this.reportTypes)
                .map(
                  ([key, type]) => `
                <div class="report-type-card" data-type="${key}">
                  <i class="${type.icon}"></i>
                  <h5>${type.name}</h5>
                  <p>${type.description}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `;

      case 2:
        return `
          <div class="wizard-step">
            <h4>Configuración del reporte</h4>
            <form id="reportConfigForm">
              <div class="form-group">
                <label>Nombre del reporte</label>
                <input type="text" id="reportName" required />
              </div>
              
              <div class="form-group">
                <label>Descripción</label>
                <textarea id="reportDescription" rows="3"></textarea>
              </div>
              
              <div class="form-group">
                <label>Período de datos</label>
                <select id="reportDateRange">
                  ${Object.entries(this.dateRanges)
                    .map(
                      ([key, range]) =>
                        `<option value="${key}">${range.name}</option>`
                    )
                    .join('')}
                </select>
              </div>
              
              <div class="form-group">
                <label>Incluir gráficos</label>
                <label class="checkbox-label">
                  <input type="checkbox" id="includeCharts" checked />
                  <span>Incluir visualizaciones gráficas</span>
                </label>
              </div>
              
              <div class="form-group">
                <label>Incluir tablas de datos</label>
                <label class="checkbox-label">
                  <input type="checkbox" id="includeTables" checked />
                  <span>Incluir datos tabulares</span>
                </label>
              </div>
            </form>
          </div>
        `;

      case 3:
        return `
          <div class="wizard-step">
            <h4>Previsualización del reporte</h4>
            <div class="report-preview">
              <div class="preview-header">
                <h5 id="previewTitle">Nombre del reporte</h5>
                <p id="previewDescription">Descripción del reporte</p>
              </div>
              
              <div class="preview-content">
                <p>El reporte incluirá:</p>
                <ul id="previewFeatures">
                  <!-- Features will be populated -->
                </ul>
              </div>
              
              <div class="preview-settings">
                <h6>Configuración:</h6>
                <div id="previewSettings">
                  <!-- Settings will be populated -->
                </div>
              </div>
            </div>
          </div>
        `;

      default:
        return '<div>Paso no encontrado</div>';
    }
  }

  wizardPrevStep() {
    if (this.currentWizardStep > 1) {
      this.currentWizardStep--;
      this.renderWizardStep();
    }
  }

  wizardNextStep() {
    if (this.currentWizardStep < 3) {
      if (this.validateWizardStep()) {
        this.currentWizardStep++;
        this.renderWizardStep();

        if (this.currentWizardStep === 3) {
          this.updatePreview();
        }
      }
    }
  }

  validateWizardStep() {
    switch (this.currentWizardStep) {
      case 1:
        const selectedType = this.container.querySelector(
          '.report-type-card.selected'
        );
        if (!selectedType) {
          this.showToast('Selecciona un tipo de reporte', 'warning');
          return false;
        }
        this.selectedReportType = selectedType.dataset.type;
        return true;

      case 2:
        const form = this.container.querySelector('#reportConfigForm');
        const formData = new FormData(form);

        if (!formData.get('reportName')) {
          this.showToast('Ingresa un nombre para el reporte', 'warning');
          return false;
        }

        this.reportConfig = {
          name: formData.get('reportName'),
          description: formData.get('reportDescription'),
          dateRange: formData.get('reportDateRange'),
          includeCharts: formData.get('includeCharts') === 'on',
          includeTables: formData.get('includeTables') === 'on',
        };

        return true;

      default:
        return true;
    }
  }

  updatePreview() {
    const previewTitle = this.container.querySelector('#previewTitle');
    const previewDescription = this.container.querySelector(
      '#previewDescription'
    );
    const previewFeatures = this.container.querySelector('#previewFeatures');
    const previewSettings = this.container.querySelector('#previewSettings');

    if (previewTitle) previewTitle.textContent = this.reportConfig.name;
    if (previewDescription)
      previewDescription.textContent =
        this.reportConfig.description || 'Sin descripción';

    if (previewFeatures) {
      const features = [];
      if (this.reportConfig.includeCharts)
        features.push('Gráficos y visualizaciones');
      if (this.reportConfig.includeTables) features.push('Tablas de datos');
      features.push('Métricas principales');
      features.push('Análisis de tendencias');

      previewFeatures.innerHTML = features
        .map(feature => `<li>${feature}</li>`)
        .join('');
    }

    if (previewSettings) {
      const reportType = this.reportTypes[this.selectedReportType];
      const dateRange = this.dateRanges[this.reportConfig.dateRange];

      previewSettings.innerHTML = `
        <p><strong>Tipo:</strong> ${reportType.name}</p>
        <p><strong>Período:</strong> ${dateRange.name}</p>
        <p><strong>Formato:</strong> Interactivo (HTML)</p>
      `;
    }
  }

  async wizardFinish() {
    this.showLoading('Generando reporte personalizado...');

    try {
      const response = await this.request('/api/reports/generate', {
        method: 'POST',
        body: {
          type: this.selectedReportType,
          config: this.reportConfig,
          dateRange: this.getDateRangeParams(),
          filters: this.getActiveFilters(),
        },
      });

      if (response.success) {
        this.hideGenerateReportModal();
        this.showToast('Reporte generado correctamente', 'success');

        // Optionally open the generated report
        if (response.reportUrl) {
          window.open(response.reportUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Error generating report:', error);
      this.showToast('Error al generar reporte', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async saveScheduledReport() {
    const form = this.elements.scheduleForm;
    const formData = new FormData(form);

    const scheduleData = {
      name: formData.get('scheduleName'),
      type: formData.get('scheduleType'),
      frequency: formData.get('scheduleFrequency'),
      time: formData.get('scheduleTime'),
      emails: formData
        .get('scheduleEmails')
        .split(',')
        .map(email => email.trim())
        .filter(email => email),
      format: formData.get('scheduleFormat'),
      active: formData.get('scheduleActive') === 'on',
      dateRange: this.getDateRangeParams(),
      filters: this.getActiveFilters(),
    };

    try {
      const response = await this.request('/api/reports/schedule', {
        method: 'POST',
        body: scheduleData,
      });

      if (response.success) {
        this.hideScheduleReportModal();
        this.showToast('Reporte programado correctamente', 'success');
        form.reset();
      }
    } catch (error) {
      console.error('Error scheduling report:', error);
      this.showToast('Error al programar reporte', 'error');
    }
  }

  async saveTemplate() {
    const templateData = {
      name: `Plantilla ${this.reportTypes[this.state.activeTab].name}`,
      type: this.state.activeTab,
      dateRange: this.getDateRangeParams(),
      filters: this.getActiveFilters(),
      viewMode: this.state.viewMode,
    };

    try {
      const response = await this.request('/api/reports/templates', {
        method: 'POST',
        body: templateData,
      });

      if (response.success) {
        this.showToast('Plantilla guardada correctamente', 'success');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      this.showToast('Error al guardar plantilla', 'error');
    }
  }

  // Utility methods
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  updateLastUpdatedDisplay() {
    if (this.state.lastUpdated) {
      this.elements.lastUpdated.innerHTML = `
        <i class="fas fa-clock"></i>
        Actualizado ${this.getTimeAgo(this.state.lastUpdated)}
      `;
    }
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

  showLoading(text = 'Cargando...') {
    this.elements.loadingText.textContent = text;
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

  destroy() {
    // Clean up auto-refresh timer
    this.stopAutoRefresh();

    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });

    super.destroy();
  }
}
