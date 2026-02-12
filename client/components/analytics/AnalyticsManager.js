/**
 * Gestor de análisis y métricas modular
 * Maneja la visualización de estadísticas, gráficos y reportes
 */
class AnalyticsManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      refreshInterval: 30000, // 30 seconds
      enableRealTime: true,
      enableExport: true,
      defaultDateRange: '7d',
      chartColors: [
        '#007bff',
        '#28a745',
        '#ffc107',
        '#dc3545',
        '#6f42c1',
        '#fd7e14',
        '#20c997',
        '#6c757d',
      ],
      enableComparison: true,
      maxDataPoints: 100,
    };
  }

  async beforeInit() {
    this.metrics = {};
    this.charts = {};
    this.refreshTimer = null;
    this.websocket = null;

    this.state = {
      loading: false,
      dateRange: this.options.defaultDateRange,
      customDateStart: null,
      customDateEnd: null,
      selectedMetrics: ['messages', 'conversations', 'response_time'],
      comparisonEnabled: false,
      comparisonPeriod: 'previous',
      activeTab: 'overview',
      filters: {
        bot: '',
        status: '',
        source: '',
      },
    };

    this.dateRanges = {
      '1h': { label: 'Última hora', value: 1, unit: 'hour' },
      '24h': { label: 'Últimas 24 horas', value: 24, unit: 'hour' },
      '7d': { label: 'Últimos 7 días', value: 7, unit: 'day' },
      '30d': { label: 'Últimos 30 días', value: 30, unit: 'day' },
      '90d': { label: 'Últimos 90 días', value: 90, unit: 'day' },
      custom: { label: 'Personalizado', value: null, unit: null },
    };

    this.metricDefinitions = this.getMetricDefinitions();
  }

  getMetricDefinitions() {
    return {
      messages: {
        name: 'Mensajes',
        icon: 'fas fa-comment',
        color: '#007bff',
        format: 'number',
        description: 'Total de mensajes enviados y recibidos',
      },
      conversations: {
        name: 'Conversaciones',
        icon: 'fas fa-comments',
        color: '#28a745',
        format: 'number',
        description: 'Número de conversaciones activas',
      },
      response_time: {
        name: 'Tiempo de respuesta',
        icon: 'fas fa-clock',
        color: '#ffc107',
        format: 'duration',
        description: 'Tiempo promedio de respuesta',
      },
      satisfaction: {
        name: 'Satisfacción',
        icon: 'fas fa-star',
        color: '#fd7e14',
        format: 'percentage',
        description: 'Índice de satisfacción del cliente',
      },
      resolution_rate: {
        name: 'Tasa de resolución',
        icon: 'fas fa-check-circle',
        color: '#20c997',
        format: 'percentage',
        description: 'Porcentaje de consultas resueltas',
      },
      active_users: {
        name: 'Usuarios activos',
        icon: 'fas fa-users',
        color: '#6f42c1',
        format: 'number',
        description: 'Usuarios únicos activos',
      },
    };
  }

  getTemplate() {
    return `
      <div class="analytics-manager">
        <!-- Header -->
        <div class="analytics-header">
          <div class="header-left">
            <h2 class="analytics-title">
              <i class="fas fa-chart-line"></i>
              Análisis y Métricas
            </h2>
            <div class="analytics-subtitle">
              Panel de control de rendimiento y estadísticas
            </div>
          </div>
          
          <div class="header-controls">
            <div class="date-range-selector">
              <label>Período:</label>
              <select id="dateRangeSelect">
                <option value="1h">Última hora</option>
                <option value="24h">Últimas 24 horas</option>
                <option value="7d" selected>Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            
            <div class="custom-date-range" id="customDateRange" style="display: none;">
              <input type="date" id="startDate" />
              <span>a</span>
              <input type="date" id="endDate" />
              <button class="btn btn-sm btn-primary" id="applyCustomRange">
                Aplicar
              </button>
            </div>
            
            <div class="comparison-toggle">
              <label class="switch">
                <input type="checkbox" id="comparisonToggle" />
                <span class="slider"></span>
              </label>
              <span>Comparar</span>
            </div>
            
            <button class="btn btn-secondary" id="refreshData">
              <i class="fas fa-sync-alt"></i>
              Actualizar
            </button>
            
            <button class="btn btn-secondary" id="exportReport">
              <i class="fas fa-download"></i>
              Exportar
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="analytics-filters">
          <div class="filter-group">
            <label>Bot:</label>
            <select id="botFilter">
              <option value="">Todos los bots</option>
              <!-- Options will be populated dynamically -->
            </select>
          </div>
          
          <div class="filter-group">
            <label>Estado:</label>
            <select id="statusFilter">
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="resolved">Resuelto</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Origen:</label>
            <select id="sourceFilter">
              <option value="">Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="web">Web</option>
              <option value="api">API</option>
            </select>
          </div>
        </div>

        <!-- Tabs -->
        <div class="analytics-tabs">
          <button class="tab-button active" data-tab="overview">
            <i class="fas fa-tachometer-alt"></i>
            Resumen
          </button>
          <button class="tab-button" data-tab="messages">
            <i class="fas fa-comment"></i>
            Mensajes
          </button>
          <button class="tab-button" data-tab="conversations">
            <i class="fas fa-comments"></i>
            Conversaciones
          </button>
          <button class="tab-button" data-tab="performance">
            <i class="fas fa-chart-bar"></i>
            Rendimiento
          </button>
          <button class="tab-button" data-tab="users">
            <i class="fas fa-users"></i>
            Usuarios
          </button>
          <button class="tab-button" data-tab="reports">
            <i class="fas fa-file-alt"></i>
            Reportes
          </button>
        </div>

        <!-- Content -->
        <div class="analytics-content">
          <!-- Overview Tab -->
          <div class="tab-content active" id="overviewTab">
            <!-- Key Metrics -->
            <div class="metrics-grid" id="metricsGrid">
              <!-- Metric cards will be rendered here -->
            </div>
            
            <!-- Main Charts -->
            <div class="charts-row">
              <div class="chart-container">
                <div class="chart-header">
                  <h3>Actividad en el tiempo</h3>
                  <div class="chart-controls">
                    <select id="activityMetric">
                      <option value="messages">Mensajes</option>
                      <option value="conversations">Conversaciones</option>
                      <option value="users">Usuarios</option>
                    </select>
                  </div>
                </div>
                <canvas id="activityChart"></canvas>
              </div>
              
              <div class="chart-container">
                <div class="chart-header">
                  <h3>Distribución por canal</h3>
                </div>
                <canvas id="channelChart"></canvas>
              </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="recent-activity">
              <h3>Actividad reciente</h3>
              <div class="activity-list" id="recentActivityList">
                <!-- Recent activity items will be rendered here -->
              </div>
            </div>
          </div>

          <!-- Messages Tab -->
          <div class="tab-content" id="messagesTab">
            <div class="messages-analytics">
              <div class="charts-grid">
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Volumen de mensajes</h3>
                  </div>
                  <canvas id="messageVolumeChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Tipos de mensaje</h3>
                  </div>
                  <canvas id="messageTypesChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Horarios de mayor actividad</h3>
                  </div>
                  <canvas id="messageHeatmapChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Longitud promedio de mensajes</h3>
                  </div>
                  <canvas id="messageLengthChart"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Conversations Tab -->
          <div class="tab-content" id="conversationsTab">
            <div class="conversations-analytics">
              <div class="charts-grid">
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Duración de conversaciones</h3>
                  </div>
                  <canvas id="conversationDurationChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Estado de conversaciones</h3>
                  </div>
                  <canvas id="conversationStatusChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Tasa de resolución</h3>
                  </div>
                  <canvas id="resolutionRateChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Escalaciones</h3>
                  </div>
                  <canvas id="escalationsChart"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Tab -->
          <div class="tab-content" id="performanceTab">
            <div class="performance-analytics">
              <div class="charts-grid">
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Tiempo de respuesta</h3>
                  </div>
                  <canvas id="responseTimeChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Satisfacción del cliente</h3>
                  </div>
                  <canvas id="satisfactionChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Rendimiento del bot</h3>
                  </div>
                  <canvas id="botPerformanceChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Errores y fallos</h3>
                  </div>
                  <canvas id="errorsChart"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Users Tab -->
          <div class="tab-content" id="usersTab">
            <div class="users-analytics">
              <div class="charts-grid">
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Usuarios activos</h3>
                  </div>
                  <canvas id="activeUsersChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Nuevos usuarios</h3>
                  </div>
                  <canvas id="newUsersChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Retención de usuarios</h3>
                  </div>
                  <canvas id="userRetentionChart"></canvas>
                </div>
                
                <div class="chart-container">
                  <div class="chart-header">
                    <h3>Segmentación de usuarios</h3>
                  </div>
                  <canvas id="userSegmentationChart"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Reports Tab -->
          <div class="tab-content" id="reportsTab">
            <div class="reports-section">
              <div class="reports-header">
                <h3>Reportes personalizados</h3>
                <button class="btn btn-primary" id="createReport">
                  <i class="fas fa-plus"></i>
                  Crear reporte
                </button>
              </div>
              
              <div class="reports-grid" id="reportsGrid">
                <!-- Report cards will be rendered here -->
              </div>
              
              <div class="scheduled-reports">
                <h3>Reportes programados</h3>
                <div class="scheduled-reports-list" id="scheduledReportsList">
                  <!-- Scheduled reports will be rendered here -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Real-time indicator -->
        <div class="realtime-indicator" id="realtimeIndicator">
          <div class="indicator-dot"></div>
          <span>Datos en tiempo real</span>
          <span class="last-update" id="lastUpdate">Actualizado hace unos segundos</span>
        </div>

        <!-- Loading overlay -->
        <div class="loading-overlay" id="loadingOverlay" style="display: none;">
          <div class="loading-content">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Cargando datos...</span>
          </div>
        </div>

        <!-- Report Modal -->
        <div class="modal" id="reportModal" style="display: none;">
          <div class="modal-content large">
            <div class="modal-header">
              <h3 id="reportModalTitle">Crear reporte personalizado</h3>
              <button class="btn btn-sm btn-secondary" id="closeReportModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="report-builder">
              <div class="builder-step active" id="step1">
                <h4>Paso 1: Seleccionar métricas</h4>
                <div class="metrics-selection" id="metricsSelection">
                  <!-- Metrics checkboxes will be rendered here -->
                </div>
              </div>
              
              <div class="builder-step" id="step2">
                <h4>Paso 2: Configurar filtros</h4>
                <div class="filters-configuration" id="filtersConfiguration">
                  <!-- Filter configuration will be rendered here -->
                </div>
              </div>
              
              <div class="builder-step" id="step3">
                <h4>Paso 3: Opciones de reporte</h4>
                <div class="report-options" id="reportOptions">
                  <div class="form-group">
                    <label for="reportName">Nombre del reporte:</label>
                    <input type="text" id="reportName" placeholder="Mi reporte personalizado" />
                  </div>
                  
                  <div class="form-group">
                    <label for="reportDescription">Descripción:</label>
                    <textarea id="reportDescription" rows="3"></textarea>
                  </div>
                  
                  <div class="form-group">
                    <label for="reportFormat">Formato:</label>
                    <select id="reportFormat">
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label>
                      <input type="checkbox" id="scheduleReport" />
                      Programar reporte automático
                    </label>
                  </div>
                  
                  <div class="schedule-options" id="scheduleOptions" style="display: none;">
                    <div class="form-row">
                      <div class="form-group">
                        <label for="scheduleFrequency">Frecuencia:</label>
                        <select id="scheduleFrequency">
                          <option value="daily">Diario</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>
                      
                      <div class="form-group">
                        <label for="scheduleTime">Hora:</label>
                        <input type="time" id="scheduleTime" value="09:00" />
                      </div>
                    </div>
                    
                    <div class="form-group">
                      <label for="scheduleEmails">Enviar por email a:</label>
                      <input type="text" id="scheduleEmails" placeholder="email1@ejemplo.com, email2@ejemplo.com" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-secondary" id="cancelReport">
                Cancelar
              </button>
              <button class="btn btn-secondary" id="prevStep" style="display: none;">
                <i class="fas fa-chevron-left"></i>
                Anterior
              </button>
              <button class="btn btn-primary" id="nextStep">
                Siguiente
                <i class="fas fa-chevron-right"></i>
              </button>
              <button class="btn btn-success" id="generateReport" style="display: none;">
                <i class="fas fa-file-alt"></i>
                Generar reporte
              </button>
            </div>
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
      startDate: this.container.querySelector('#startDate'),
      endDate: this.container.querySelector('#endDate'),
      applyCustomRangeBtn: this.container.querySelector('#applyCustomRange'),
      comparisonToggle: this.container.querySelector('#comparisonToggle'),
      refreshBtn: this.container.querySelector('#refreshData'),
      exportBtn: this.container.querySelector('#exportReport'),

      // Filters
      botFilter: this.container.querySelector('#botFilter'),
      statusFilter: this.container.querySelector('#statusFilter'),
      sourceFilter: this.container.querySelector('#sourceFilter'),

      // Tabs
      tabButtons: this.container.querySelectorAll('.tab-button'),
      tabContents: this.container.querySelectorAll('.tab-content'),

      // Overview tab
      metricsGrid: this.container.querySelector('#metricsGrid'),
      activityMetric: this.container.querySelector('#activityMetric'),
      recentActivityList: this.container.querySelector('#recentActivityList'),

      // Real-time indicator
      realtimeIndicator: this.container.querySelector('#realtimeIndicator'),
      lastUpdate: this.container.querySelector('#lastUpdate'),

      // Loading
      loadingOverlay: this.container.querySelector('#loadingOverlay'),

      // Reports
      createReportBtn: this.container.querySelector('#createReport'),
      reportsGrid: this.container.querySelector('#reportsGrid'),
      scheduledReportsList: this.container.querySelector(
        '#scheduledReportsList'
      ),

      // Report Modal
      reportModal: this.container.querySelector('#reportModal'),
      reportModalTitle: this.container.querySelector('#reportModalTitle'),
      closeReportModalBtn: this.container.querySelector('#closeReportModal'),
      metricsSelection: this.container.querySelector('#metricsSelection'),
      filtersConfiguration: this.container.querySelector(
        '#filtersConfiguration'
      ),
      reportOptions: this.container.querySelector('#reportOptions'),
      reportName: this.container.querySelector('#reportName'),
      reportDescription: this.container.querySelector('#reportDescription'),
      reportFormat: this.container.querySelector('#reportFormat'),
      scheduleReport: this.container.querySelector('#scheduleReport'),
      scheduleOptions: this.container.querySelector('#scheduleOptions'),
      scheduleFrequency: this.container.querySelector('#scheduleFrequency'),
      scheduleTime: this.container.querySelector('#scheduleTime'),
      scheduleEmails: this.container.querySelector('#scheduleEmails'),
      cancelReportBtn: this.container.querySelector('#cancelReport'),
      prevStepBtn: this.container.querySelector('#prevStep'),
      nextStepBtn: this.container.querySelector('#nextStep'),
      generateReportBtn: this.container.querySelector('#generateReport'),
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
      this.elements.applyCustomRangeBtn,
      'click',
      this.applyCustomDateRange
    );
    this.addEventListener(
      this.elements.comparisonToggle,
      'change',
      this.toggleComparison
    );
    this.addEventListener(this.elements.refreshBtn, 'click', this.refreshData);
    this.addEventListener(this.elements.exportBtn, 'click', this.exportReport);

    // Filters
    this.addEventListener(this.elements.botFilter, 'change', this.applyFilters);
    this.addEventListener(
      this.elements.statusFilter,
      'change',
      this.applyFilters
    );
    this.addEventListener(
      this.elements.sourceFilter,
      'change',
      this.applyFilters
    );

    // Tabs
    this.elements.tabButtons.forEach(button => {
      this.addEventListener(button, 'click', () =>
        this.switchTab(button.dataset.tab)
      );
    });

    // Activity metric selector
    this.addEventListener(
      this.elements.activityMetric,
      'change',
      this.updateActivityChart
    );

    // Reports
    this.addEventListener(
      this.elements.createReportBtn,
      'click',
      this.showReportModal
    );
    this.addEventListener(
      this.elements.closeReportModalBtn,
      'click',
      this.hideReportModal
    );
    this.addEventListener(
      this.elements.cancelReportBtn,
      'click',
      this.hideReportModal
    );
    this.addEventListener(
      this.elements.scheduleReport,
      'change',
      this.toggleScheduleOptions
    );
    this.addEventListener(
      this.elements.prevStepBtn,
      'click',
      this.prevReportStep
    );
    this.addEventListener(
      this.elements.nextStepBtn,
      'click',
      this.nextReportStep
    );
    this.addEventListener(
      this.elements.generateReportBtn,
      'click',
      this.generateReport
    );
  }

  async afterInit() {
    // Initialize Chart.js if available
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
      Chart.defaults.color = '#6c757d';
    }

    await this.loadInitialData();
    this.setupRealTimeUpdates();
    this.startRefreshTimer();
  }

  async loadInitialData() {
    this.setState({ loading: true });
    this.showLoading();

    try {
      await Promise.all([
        this.loadMetrics(),
        this.loadChartData(),
        this.loadRecentActivity(),
        this.loadReports(),
      ]);

      this.renderMetrics();
      this.renderCharts();
      this.renderRecentActivity();
      this.renderReports();
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.showToast('Error al cargar datos de análisis', 'error');
    } finally {
      this.setState({ loading: false });
      this.hideLoading();
    }
  }

  async loadMetrics() {
    const params = this.getRequestParams();
    const response = await this.request(`/api/analytics/metrics?${params}`);
    this.metrics = response.metrics || {};
  }

  async loadChartData() {
    const params = this.getRequestParams();
    const response = await this.request(`/api/analytics/charts?${params}`);
    this.chartData = response.data || {};
  }

  async loadRecentActivity() {
    const response = await this.request('/api/analytics/activity/recent');
    this.recentActivity = response.activities || [];
  }

  async loadReports() {
    const response = await this.request('/api/analytics/reports');
    this.reports = response.reports || [];
    this.scheduledReports = response.scheduled || [];
  }

  getRequestParams() {
    const params = new URLSearchParams({
      dateRange: this.state.dateRange,
      ...this.state.filters,
    });

    if (this.state.customDateStart) {
      params.append('startDate', this.state.customDateStart);
    }
    if (this.state.customDateEnd) {
      params.append('endDate', this.state.customDateEnd);
    }
    if (this.state.comparisonEnabled) {
      params.append('comparison', this.state.comparisonPeriod);
    }

    return params;
  }

  renderMetrics() {
    const html = Object.entries(this.metricDefinitions)
      .filter(([key]) => this.state.selectedMetrics.includes(key))
      .map(([key, definition]) => this.getMetricCardHTML(key, definition))
      .join('');

    this.elements.metricsGrid.innerHTML = html;
  }

  getMetricCardHTML(key, definition) {
    const metric = this.metrics[key] || {};
    const value = this.formatMetricValue(metric.value, definition.format);
    const change = metric.change || 0;
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

    return `
      <div class="metric-card" data-metric="${key}">
        <div class="metric-header">
          <div class="metric-icon" style="color: ${definition.color}">
            <i class="${definition.icon}"></i>
          </div>
          <div class="metric-info">
            <h3 class="metric-name">${definition.name}</h3>
            <p class="metric-description">${definition.description}</p>
          </div>
        </div>
        
        <div class="metric-value">
          <span class="value">${value}</span>
          ${
            this.state.comparisonEnabled
              ? `
            <div class="metric-change ${changeClass}">
              <i class="fas ${changeIcon}"></i>
              <span>${Math.abs(change)}%</span>
            </div>
          `
              : ''
          }
        </div>
        
        <div class="metric-chart">
          <canvas id="${key}MiniChart" width="100" height="30"></canvas>
        </div>
      </div>
    `;
  }

  formatMetricValue(value, format) {
    if (value === null || value === undefined) return '-';

    switch (format) {
      case 'number':
        return new Intl.NumberFormat('es-ES').format(value);
      case 'percentage':
        return `${value}%`;
      case 'duration':
        return this.formatDuration(value);
      case 'currency':
        return new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'EUR',
        }).format(value);
      default:
        return value.toString();
    }
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  renderCharts() {
    // Render main charts based on active tab
    switch (this.state.activeTab) {
      case 'overview':
        this.renderOverviewCharts();
        break;
      case 'messages':
        this.renderMessageCharts();
        break;
      case 'conversations':
        this.renderConversationCharts();
        break;
      case 'performance':
        this.renderPerformanceCharts();
        break;
      case 'users':
        this.renderUserCharts();
        break;
    }

    // Render mini charts for metrics
    this.renderMiniCharts();
  }

  renderOverviewCharts() {
    // Activity chart
    const activityCtx = this.container.querySelector('#activityChart');
    if (activityCtx && this.chartData.activity) {
      this.charts.activity = this.createLineChart(activityCtx, {
        labels: this.chartData.activity.labels,
        datasets: [
          {
            label: this.elements.activityMetric.value,
            data: this.chartData.activity.data,
            borderColor: this.options.chartColors[0],
            backgroundColor: this.options.chartColors[0] + '20',
            fill: true,
          },
        ],
      });
    }

    // Channel distribution chart
    const channelCtx = this.container.querySelector('#channelChart');
    if (channelCtx && this.chartData.channels) {
      this.charts.channels = this.createDoughnutChart(channelCtx, {
        labels: this.chartData.channels.labels,
        datasets: [
          {
            data: this.chartData.channels.data,
            backgroundColor: this.options.chartColors,
          },
        ],
      });
    }
  }

  renderMessageCharts() {
    // Message volume chart
    const volumeCtx = this.container.querySelector('#messageVolumeChart');
    if (volumeCtx && this.chartData.messageVolume) {
      this.charts.messageVolume = this.createLineChart(volumeCtx, {
        labels: this.chartData.messageVolume.labels,
        datasets: [
          {
            label: 'Mensajes enviados',
            data: this.chartData.messageVolume.sent,
            borderColor: this.options.chartColors[0],
            backgroundColor: this.options.chartColors[0] + '20',
          },
          {
            label: 'Mensajes recibidos',
            data: this.chartData.messageVolume.received,
            borderColor: this.options.chartColors[1],
            backgroundColor: this.options.chartColors[1] + '20',
          },
        ],
      });
    }

    // Message types chart
    const typesCtx = this.container.querySelector('#messageTypesChart');
    if (typesCtx && this.chartData.messageTypes) {
      this.charts.messageTypes = this.createPieChart(typesCtx, {
        labels: this.chartData.messageTypes.labels,
        datasets: [
          {
            data: this.chartData.messageTypes.data,
            backgroundColor: this.options.chartColors,
          },
        ],
      });
    }
  }

  renderConversationCharts() {
    // Conversation duration chart
    const durationCtx = this.container.querySelector(
      '#conversationDurationChart'
    );
    if (durationCtx && this.chartData.conversationDuration) {
      this.charts.conversationDuration = this.createBarChart(durationCtx, {
        labels: this.chartData.conversationDuration.labels,
        datasets: [
          {
            label: 'Duración promedio (minutos)',
            data: this.chartData.conversationDuration.data,
            backgroundColor: this.options.chartColors[0],
          },
        ],
      });
    }

    // Conversation status chart
    const statusCtx = this.container.querySelector('#conversationStatusChart');
    if (statusCtx && this.chartData.conversationStatus) {
      this.charts.conversationStatus = this.createDoughnutChart(statusCtx, {
        labels: this.chartData.conversationStatus.labels,
        datasets: [
          {
            data: this.chartData.conversationStatus.data,
            backgroundColor: this.options.chartColors,
          },
        ],
      });
    }
  }

  renderPerformanceCharts() {
    // Response time chart
    const responseTimeCtx = this.container.querySelector('#responseTimeChart');
    if (responseTimeCtx && this.chartData.responseTime) {
      this.charts.responseTime = this.createLineChart(responseTimeCtx, {
        labels: this.chartData.responseTime.labels,
        datasets: [
          {
            label: 'Tiempo de respuesta (segundos)',
            data: this.chartData.responseTime.data,
            borderColor: this.options.chartColors[2],
            backgroundColor: this.options.chartColors[2] + '20',
            fill: true,
          },
        ],
      });
    }

    // Satisfaction chart
    const satisfactionCtx = this.container.querySelector('#satisfactionChart');
    if (satisfactionCtx && this.chartData.satisfaction) {
      this.charts.satisfaction = this.createLineChart(satisfactionCtx, {
        labels: this.chartData.satisfaction.labels,
        datasets: [
          {
            label: 'Satisfacción (%)',
            data: this.chartData.satisfaction.data,
            borderColor: this.options.chartColors[3],
            backgroundColor: this.options.chartColors[3] + '20',
            fill: true,
          },
        ],
      });
    }
  }

  renderUserCharts() {
    // Active users chart
    const activeUsersCtx = this.container.querySelector('#activeUsersChart');
    if (activeUsersCtx && this.chartData.activeUsers) {
      this.charts.activeUsers = this.createLineChart(activeUsersCtx, {
        labels: this.chartData.activeUsers.labels,
        datasets: [
          {
            label: 'Usuarios activos',
            data: this.chartData.activeUsers.data,
            borderColor: this.options.chartColors[4],
            backgroundColor: this.options.chartColors[4] + '20',
            fill: true,
          },
        ],
      });
    }

    // New users chart
    const newUsersCtx = this.container.querySelector('#newUsersChart');
    if (newUsersCtx && this.chartData.newUsers) {
      this.charts.newUsers = this.createBarChart(newUsersCtx, {
        labels: this.chartData.newUsers.labels,
        datasets: [
          {
            label: 'Nuevos usuarios',
            data: this.chartData.newUsers.data,
            backgroundColor: this.options.chartColors[5],
          },
        ],
      });
    }
  }

  renderMiniCharts() {
    Object.keys(this.metricDefinitions).forEach(key => {
      const canvas = this.container.querySelector(`#${key}MiniChart`);
      if (
        canvas &&
        this.chartData.miniCharts &&
        this.chartData.miniCharts[key]
      ) {
        this.createMiniChart(canvas, this.chartData.miniCharts[key]);
      }
    });
  }

  createLineChart(ctx, data, options = {}) {
    return new Chart(ctx, {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        ...options,
      },
    });
  }

  createBarChart(ctx, data, options = {}) {
    return new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        ...options,
      },
    });
  }

  createPieChart(ctx, data, options = {}) {
    return new Chart(ctx, {
      type: 'pie',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
          },
        },
        ...options,
      },
    });
  }

  createDoughnutChart(ctx, data, options = {}) {
    return new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
          },
        },
        ...options,
      },
    });
  }

  createMiniChart(ctx, data) {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            borderColor: this.options.chartColors[0],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        elements: {
          line: { tension: 0.4 },
        },
      },
    });
  }

  renderRecentActivity() {
    if (this.recentActivity.length === 0) {
      this.elements.recentActivityList.innerHTML = `
        <div class="no-activity">
          <i class="fas fa-clock"></i>
          <span>No hay actividad reciente</span>
        </div>
      `;
      return;
    }

    const html = this.recentActivity
      .map(
        activity => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="${this.getActivityIcon(activity.type)}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-text">${activity.description}</div>
          <div class="activity-time">${this.getTimeAgo(activity.timestamp)}</div>
        </div>
      </div>
    `
      )
      .join('');

    this.elements.recentActivityList.innerHTML = html;
  }

  getActivityIcon(type) {
    const icons = {
      message: 'fas fa-comment',
      conversation: 'fas fa-comments',
      user: 'fas fa-user',
      error: 'fas fa-exclamation-triangle',
      system: 'fas fa-cog',
    };
    return icons[type] || 'fas fa-circle';
  }

  renderReports() {
    // Render custom reports
    if (this.reports.length === 0) {
      this.elements.reportsGrid.innerHTML = `
        <div class="no-reports">
          <i class="fas fa-file-alt"></i>
          <h3>No hay reportes personalizados</h3>
          <p>Crea tu primer reporte personalizado</p>
        </div>
      `;
    } else {
      const html = this.reports
        .map(report => this.getReportCardHTML(report))
        .join('');
      this.elements.reportsGrid.innerHTML = html;
    }

    // Render scheduled reports
    if (this.scheduledReports.length === 0) {
      this.elements.scheduledReportsList.innerHTML = `
        <div class="no-scheduled-reports">
          <i class="fas fa-calendar"></i>
          <span>No hay reportes programados</span>
        </div>
      `;
    } else {
      const html = this.scheduledReports
        .map(report => this.getScheduledReportHTML(report))
        .join('');
      this.elements.scheduledReportsList.innerHTML = html;
    }
  }

  getReportCardHTML(report) {
    return `
      <div class="report-card">
        <div class="report-header">
          <h4 class="report-name">${report.name}</h4>
          <div class="report-actions">
            <button class="btn btn-sm btn-secondary" onclick="this.editReport('${report.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="this.downloadReport('${report.id}')">
              <i class="fas fa-download"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="this.deleteReport('${report.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div class="report-content">
          <p class="report-description">${report.description}</p>
          <div class="report-meta">
            <span class="report-format">
              <i class="fas fa-file"></i>
              ${report.format.toUpperCase()}
            </span>
            <span class="report-created">
              <i class="fas fa-calendar"></i>
              ${this.getTimeAgo(report.createdAt)}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  getScheduledReportHTML(report) {
    return `
      <div class="scheduled-report-item">
        <div class="scheduled-report-info">
          <h5 class="scheduled-report-name">${report.name}</h5>
          <div class="scheduled-report-schedule">
            <i class="fas fa-clock"></i>
            ${this.getScheduleText(report.schedule)}
          </div>
        </div>
        
        <div class="scheduled-report-actions">
          <button class="btn btn-sm btn-secondary" onclick="this.editScheduledReport('${report.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="this.deleteScheduledReport('${report.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  getScheduleText(schedule) {
    const frequency = {
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
    };
    return `${frequency[schedule.frequency]} a las ${schedule.time}`;
  }

  // Event handlers
  handleDateRangeChange() {
    const range = this.elements.dateRangeSelect.value;
    this.setState({ dateRange: range });

    if (range === 'custom') {
      this.elements.customDateRange.style.display = 'flex';
    } else {
      this.elements.customDateRange.style.display = 'none';
      this.refreshData();
    }
  }

  applyCustomDateRange() {
    const startDate = this.elements.startDate.value;
    const endDate = this.elements.endDate.value;

    if (!startDate || !endDate) {
      this.showToast('Selecciona fechas de inicio y fin', 'warning');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      this.showToast(
        'La fecha de inicio debe ser anterior a la fecha de fin',
        'warning'
      );
      return;
    }

    this.setState({
      customDateStart: startDate,
      customDateEnd: endDate,
    });

    this.refreshData();
  }

  toggleComparison() {
    this.setState({
      comparisonEnabled: this.elements.comparisonToggle.checked,
    });
    this.refreshData();
  }

  applyFilters() {
    this.setState({
      filters: {
        bot: this.elements.botFilter.value,
        status: this.elements.statusFilter.value,
        source: this.elements.sourceFilter.value,
      },
    });

    this.refreshData();
  }

  switchTab(tabName) {
    this.setState({ activeTab: tabName });

    // Update tab buttons
    this.elements.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab contents
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load tab-specific data if needed
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    // Load specific data for the active tab
    if (!this.chartData[tabName]) {
      try {
        const params = this.getRequestParams();
        params.append('tab', tabName);

        const response = await this.request(`/api/analytics/charts?${params}`);
        this.chartData[tabName] = response.data;

        this.renderCharts();
      } catch (error) {
        console.error(`Error loading ${tabName} data:`, error);
      }
    } else {
      this.renderCharts();
    }
  }

  updateActivityChart() {
    const metric = this.elements.activityMetric.value;
    // Update the activity chart with the selected metric
    if (this.charts.activity && this.chartData.activity) {
      this.charts.activity.data.datasets[0].label = metric;
      this.charts.activity.data.datasets[0].data =
        this.chartData.activity[metric] || [];
      this.charts.activity.update();
    }
  }

  async refreshData() {
    await this.loadInitialData();
    this.updateLastUpdateTime();
  }

  updateLastUpdateTime() {
    this.elements.lastUpdate.textContent = 'Actualizado ahora mismo';
  }

  // Real-time updates
  setupRealTimeUpdates() {
    if (!this.options.enableRealTime) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/analytics`;

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Analytics WebSocket connected');
        this.elements.realtimeIndicator.classList.add('connected');
      };

      this.websocket.onmessage = event => {
        const data = JSON.parse(event.data);
        this.handleRealTimeUpdate(data);
      };

      this.websocket.onclose = () => {
        console.log('Analytics WebSocket disconnected');
        this.elements.realtimeIndicator.classList.remove('connected');

        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.setupRealTimeUpdates(), 5000);
      };

      this.websocket.onerror = error => {
        console.error('Analytics WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error setting up real-time updates:', error);
    }
  }

  handleRealTimeUpdate(data) {
    // Update metrics
    if (data.metrics) {
      Object.assign(this.metrics, data.metrics);
      this.renderMetrics();
    }

    // Update charts
    if (data.chartData) {
      Object.assign(this.chartData, data.chartData);
      this.updateChartsWithNewData(data.chartData);
    }

    // Update recent activity
    if (data.activity) {
      this.recentActivity.unshift(data.activity);
      this.recentActivity = this.recentActivity.slice(0, 10); // Keep only last 10
      this.renderRecentActivity();
    }

    this.updateLastUpdateTime();
  }

  updateChartsWithNewData(newData) {
    Object.keys(this.charts).forEach(chartKey => {
      const chart = this.charts[chartKey];
      const data = newData[chartKey];

      if (chart && data) {
        // Add new data point
        chart.data.labels.push(data.label);
        chart.data.datasets.forEach((dataset, index) => {
          dataset.data.push(data.values[index]);
        });

        // Remove old data points if we have too many
        if (chart.data.labels.length > this.options.maxDataPoints) {
          chart.data.labels.shift();
          chart.data.datasets.forEach(dataset => {
            dataset.data.shift();
          });
        }

        chart.update('none'); // Update without animation for real-time
      }
    });
  }

  startRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      if (!this.options.enableRealTime) {
        this.refreshData();
      }
    }, this.options.refreshInterval);
  }

  // Report modal methods
  showReportModal() {
    this.resetReportBuilder();
    this.showModal(this.elements.reportModal);
  }

  hideReportModal() {
    this.hideModal(this.elements.reportModal);
  }

  resetReportBuilder() {
    this.currentReportStep = 1;
    this.updateReportStep();
    this.renderMetricsSelection();
  }

  renderMetricsSelection() {
    const html = Object.entries(this.metricDefinitions)
      .map(
        ([key, definition]) => `
      <label class="metric-checkbox">
        <input type="checkbox" value="${key}" ${this.state.selectedMetrics.includes(key) ? 'checked' : ''} />
        <div class="metric-option">
          <div class="metric-icon" style="color: ${definition.color}">
            <i class="${definition.icon}"></i>
          </div>
          <div class="metric-details">
            <h4>${definition.name}</h4>
            <p>${definition.description}</p>
          </div>
        </div>
      </label>
    `
      )
      .join('');

    this.elements.metricsSelection.innerHTML = html;
  }

  toggleScheduleOptions() {
    const isChecked = this.elements.scheduleReport.checked;
    this.elements.scheduleOptions.style.display = isChecked ? 'block' : 'none';
  }

  prevReportStep() {
    if (this.currentReportStep > 1) {
      this.currentReportStep--;
      this.updateReportStep();
    }
  }

  nextReportStep() {
    if (this.currentReportStep < 3) {
      this.currentReportStep++;
      this.updateReportStep();
    }
  }

  updateReportStep() {
    // Hide all steps
    this.container.querySelectorAll('.builder-step').forEach(step => {
      step.classList.remove('active');
    });

    // Show current step
    this.container
      .querySelector(`#step${this.currentReportStep}`)
      .classList.add('active');

    // Update buttons
    this.elements.prevStepBtn.style.display =
      this.currentReportStep > 1 ? 'inline-block' : 'none';
    this.elements.nextStepBtn.style.display =
      this.currentReportStep < 3 ? 'inline-block' : 'none';
    this.elements.generateReportBtn.style.display =
      this.currentReportStep === 3 ? 'inline-block' : 'none';
  }

  async generateReport() {
    const reportData = this.getReportData();

    try {
      const response = await this.request('/api/analytics/reports/generate', {
        method: 'POST',
        body: reportData,
      });

      if (response.success) {
        this.showToast('Reporte generado correctamente', 'success');
        this.hideReportModal();

        if (response.downloadUrl) {
          window.open(response.downloadUrl, '_blank');
        }

        await this.loadReports();
        this.renderReports();
      }
    } catch (error) {
      console.error('Error generating report:', error);
      this.showToast('Error al generar reporte', 'error');
    }
  }

  getReportData() {
    const selectedMetrics = Array.from(
      this.elements.metricsSelection.querySelectorAll('input:checked')
    ).map(input => input.value);

    return {
      name: this.elements.reportName.value,
      description: this.elements.reportDescription.value,
      format: this.elements.reportFormat.value,
      metrics: selectedMetrics,
      filters: this.state.filters,
      dateRange: this.state.dateRange,
      customDateStart: this.state.customDateStart,
      customDateEnd: this.state.customDateEnd,
      schedule: this.elements.scheduleReport.checked
        ? {
            frequency: this.elements.scheduleFrequency.value,
            time: this.elements.scheduleTime.value,
            emails: this.elements.scheduleEmails.value
              .split(',')
              .map(e => e.trim())
              .filter(e => e),
          }
        : null,
    };
  }

  async exportReport() {
    try {
      const params = this.getRequestParams();
      const response = await this.request(`/api/analytics/export?${params}`, {
        method: 'POST',
        body: {
          format: 'pdf',
          includeCharts: true,
        },
      });

      if (response.success && response.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
        this.showToast('Reporte exportado correctamente', 'success');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      this.showToast('Error al exportar reporte', 'error');
    }
  }

  // Utility methods
  showLoading() {
    this.elements.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
  }

  showModal(modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  hideModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  }

  // Cleanup
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.websocket) {
      this.websocket.close();
    }

    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });

    // Clean up global methods
    if (window.editReport) delete window.editReport;
    if (window.downloadReport) delete window.downloadReport;
    if (window.deleteReport) delete window.deleteReport;
    if (window.editScheduledReport) delete window.editScheduledReport;
    if (window.deleteScheduledReport) delete window.deleteScheduledReport;

    super.destroy();
  }
}

// Hacer disponible globalmente para compatibilidad
window.AnalyticsManager = AnalyticsManager;

// Exportar para uso en módulos ES6
export default AnalyticsManager;
