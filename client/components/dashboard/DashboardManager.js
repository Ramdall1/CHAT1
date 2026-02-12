/**
 * Gestor del dashboard principal
 * Maneja la visualización de métricas, estadísticas y widgets del dashboard
 */
class DashboardManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      refreshInterval: 60000, // 60 segundos (optimizado para reducir carga del servidor)
      enableRealTime: true,
      enableNotifications: true,
      autoRefresh: true,
      maxMetricsHistory: 100,
      chartAnimations: true,
    };
  }

  async beforeInit() {
    this.metrics = {
      messages: { sent: 0, received: 0, failed: 0 },
      conversations: { active: 0, total: 0, avgDuration: 0 },
      templates: { total: 0, approved: 0, pending: 0 },
      contacts: { total: 0, active: 0, blocked: 0 },
      performance: { responseTime: 0, uptime: 0, errorRate: 0 },
    };

    this.charts = {};
    this.widgets = [];
    this.refreshTimer = null;
    this.socket = null;

    this.state = {
      loading: true,
      lastUpdate: null,
      selectedPeriod: '24h',
      activeWidgets: ['messages', 'conversations', 'templates', 'performance'],
      notifications: [],
    };
  }

  getTemplate() {
    return `
      <div class="dashboard-manager">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
          <div class="header-left">
            <h1 class="dashboard-title">
              <i class="fas fa-tachometer-alt"></i>
              Dashboard Principal
            </h1>
            <div class="dashboard-subtitle">
              <span class="last-update">
                Última actualización: <span id="lastUpdateTime">--</span>
              </span>
              <div class="connection-status" id="connectionStatus">
                <i class="fas fa-circle"></i>
                <span>Conectado</span>
              </div>
            </div>
          </div>
          
          <div class="header-actions">
            <div class="period-selector">
              <label>Período:</label>
              <select id="periodSelector">
                <option value="1h">Última hora</option>
                <option value="24h" selected>Últimas 24 horas</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
              </select>
            </div>
            
            <button class="btn btn-secondary" id="refreshDashboard">
              <i class="fas fa-sync-alt"></i>
              Actualizar
            </button>
            
            <button class="btn btn-secondary" id="exportData">
              <i class="fas fa-download"></i>
              Exportar
            </button>
            
            <button class="btn btn-secondary" id="dashboardSettings">
              <i class="fas fa-cog"></i>
              Configurar
            </button>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="quick-stats" id="quickStats">
          <div class="stat-card messages-stat">
            <div class="stat-icon">
              <i class="fas fa-comments"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value" id="messagesCount">0</div>
              <div class="stat-label">Mensajes Hoy</div>
              <div class="stat-change" id="messagesChange">
                <i class="fas fa-arrow-up"></i>
                <span>0%</span>
              </div>
            </div>
          </div>

          <div class="stat-card conversations-stat">
            <div class="stat-icon">
              <i class="fas fa-users"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value" id="conversationsCount">0</div>
              <div class="stat-label">Conversaciones Activas</div>
              <div class="stat-change" id="conversationsChange">
                <i class="fas fa-arrow-up"></i>
                <span>0%</span>
              </div>
            </div>
          </div>

          <div class="stat-card templates-stat">
            <div class="stat-icon">
              <i class="fas fa-file-alt"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value" id="templatesCount">0</div>
              <div class="stat-label">Plantillas Aprobadas</div>
              <div class="stat-change" id="templatesChange">
                <i class="fas fa-arrow-up"></i>
                <span>0%</span>
              </div>
            </div>
          </div>

          <div class="stat-card performance-stat">
            <div class="stat-icon">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value" id="performanceScore">0%</div>
              <div class="stat-label">Rendimiento</div>
              <div class="stat-change" id="performanceChange">
                <i class="fas fa-arrow-up"></i>
                <span>0%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Dashboard Content -->
        <div class="dashboard-content">
          <!-- Left Column -->
          <div class="dashboard-left">
            <!-- Messages Chart -->
            <div class="dashboard-widget" id="messagesWidget">
              <div class="widget-header">
                <h3>
                  <i class="fas fa-comments"></i>
                  Actividad de Mensajes
                </h3>
                <div class="widget-actions">
                  <button class="btn btn-sm btn-secondary" id="messagesFullscreen">
                    <i class="fas fa-expand"></i>
                  </button>
                </div>
              </div>
              <div class="widget-content">
                <div class="chart-container">
                  <canvas id="messagesChart"></canvas>
                </div>
                <div class="chart-legend" id="messagesLegend">
                  <div class="legend-item">
                    <span class="legend-color sent"></span>
                    <span>Enviados</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color received"></span>
                    <span>Recibidos</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color failed"></span>
                    <span>Fallidos</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Conversations Chart -->
            <div class="dashboard-widget" id="conversationsWidget">
              <div class="widget-header">
                <h3>
                  <i class="fas fa-users"></i>
                  Conversaciones
                </h3>
                <div class="widget-actions">
                  <button class="btn btn-sm btn-secondary" id="conversationsFullscreen">
                    <i class="fas fa-expand"></i>
                  </button>
                </div>
              </div>
              <div class="widget-content">
                <div class="chart-container">
                  <canvas id="conversationsChart"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="dashboard-right">
            <!-- Recent Activity -->
            <div class="dashboard-widget" id="activityWidget">
              <div class="widget-header">
                <h3>
                  <i class="fas fa-clock"></i>
                  Actividad Reciente
                </h3>
                <div class="widget-actions">
                  <button class="btn btn-sm btn-secondary" id="clearActivity">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="widget-content">
                <div class="activity-list" id="activityList">
                  <div class="no-activity">
                    <i class="fas fa-clock"></i>
                    <p>No hay actividad reciente</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- System Status -->
            <div class="dashboard-widget" id="statusWidget">
              <div class="widget-header">
                <h3>
                  <i class="fas fa-server"></i>
                  Estado del Sistema
                </h3>
              </div>
              <div class="widget-content">
                <div class="status-list" id="statusList">
                  <div class="status-item">
                    <div class="status-indicator" id="whatsappStatus">
                      <i class="fas fa-circle"></i>
                    </div>
                    <div class="status-info">
                      <span class="status-name">WhatsApp API</span>
                      <span class="status-value" id="whatsappStatusText">Verificando...</span>
                    </div>
                  </div>
                  
                  <div class="status-item">
                    <div class="status-indicator" id="databaseStatus">
                      <i class="fas fa-circle"></i>
                    </div>
                    <div class="status-info">
                      <span class="status-name">Base de Datos</span>
                      <span class="status-value" id="databaseStatusText">Verificando...</span>
                    </div>
                  </div>
                  
                  <div class="status-item">
                    <div class="status-indicator" id="serverStatus">
                      <i class="fas fa-circle"></i>
                    </div>
                    <div class="status-info">
                      <span class="status-name">Servidor</span>
                      <span class="status-value" id="serverStatusText">Verificando...</span>
                    </div>
                  </div>
                  
                  <div class="status-item">
                    <div class="status-indicator" id="storageStatus">
                      <i class="fas fa-circle"></i>
                    </div>
                    <div class="status-info">
                      <span class="status-name">Almacenamiento</span>
                      <span class="status-value" id="storageStatusText">Verificando...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="dashboard-widget" id="actionsWidget">
              <div class="widget-header">
                <h3>
                  <i class="fas fa-bolt"></i>
                  Acciones Rápidas
                </h3>
              </div>
              <div class="widget-content">
                <div class="quick-actions">
                  <button class="action-btn" id="sendBroadcast">
                    <i class="fas fa-bullhorn"></i>
                    <span>Enviar Difusión</span>
                  </button>
                  
                  <button class="action-btn" id="createTemplate">
                    <i class="fas fa-file-plus"></i>
                    <span>Nueva Plantilla</span>
                  </button>
                  
                  <button class="action-btn" id="exportContacts">
                    <i class="fas fa-download"></i>
                    <span>Exportar Contactos</span>
                  </button>
                  
                  <button class="action-btn" id="viewReports">
                    <i class="fas fa-chart-bar"></i>
                    <span>Ver Reportes</span>
                  </button>
                  
                  <button class="action-btn" id="systemBackup">
                    <i class="fas fa-shield-alt"></i>
                    <span>Respaldo</span>
                  </button>
                  
                  <button class="action-btn" id="systemSettings">
                    <i class="fas fa-cogs"></i>
                    <span>Configuración</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="dashboard-notifications" id="dashboardNotifications">
          <!-- Notifications will be rendered here -->
        </div>

        <!-- Loading Overlay -->
        <div class="dashboard-loading" id="dashboardLoading" style="display: none;">
          <div class="loading-content">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Cargando dashboard...</span>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      // Header
      lastUpdateTime: this.container.querySelector('#lastUpdateTime'),
      connectionStatus: this.container.querySelector('#connectionStatus'),
      periodSelector: this.container.querySelector('#periodSelector'),
      refreshBtn: this.container.querySelector('#refreshDashboard'),
      exportBtn: this.container.querySelector('#exportData'),
      settingsBtn: this.container.querySelector('#dashboardSettings'),

      // Quick Stats
      quickStats: this.container.querySelector('#quickStats'),
      messagesCount: this.container.querySelector('#messagesCount'),
      messagesChange: this.container.querySelector('#messagesChange'),
      conversationsCount: this.container.querySelector('#conversationsCount'),
      conversationsChange: this.container.querySelector('#conversationsChange'),
      templatesCount: this.container.querySelector('#templatesCount'),
      templatesChange: this.container.querySelector('#templatesChange'),
      performanceScore: this.container.querySelector('#performanceScore'),
      performanceChange: this.container.querySelector('#performanceChange'),

      // Charts
      messagesChart: this.container.querySelector('#messagesChart'),
      conversationsChart: this.container.querySelector('#conversationsChart'),
      messagesFullscreen: this.container.querySelector('#messagesFullscreen'),
      conversationsFullscreen: this.container.querySelector(
        '#conversationsFullscreen'
      ),

      // Activity
      activityList: this.container.querySelector('#activityList'),
      clearActivityBtn: this.container.querySelector('#clearActivity'),

      // Status
      statusList: this.container.querySelector('#statusList'),
      whatsappStatus: this.container.querySelector('#whatsappStatus'),
      whatsappStatusText: this.container.querySelector('#whatsappStatusText'),
      databaseStatus: this.container.querySelector('#databaseStatus'),
      databaseStatusText: this.container.querySelector('#databaseStatusText'),
      serverStatus: this.container.querySelector('#serverStatus'),
      serverStatusText: this.container.querySelector('#serverStatusText'),
      storageStatus: this.container.querySelector('#storageStatus'),
      storageStatusText: this.container.querySelector('#storageStatusText'),

      // Quick Actions
      sendBroadcastBtn: this.container.querySelector('#sendBroadcast'),
      createTemplateBtn: this.container.querySelector('#createTemplate'),
      exportContactsBtn: this.container.querySelector('#exportContacts'),
      viewReportsBtn: this.container.querySelector('#viewReports'),
      systemBackupBtn: this.container.querySelector('#systemBackup'),
      systemSettingsBtn: this.container.querySelector('#systemSettings'),

      // Notifications
      notifications: this.container.querySelector('#dashboardNotifications'),
      loading: this.container.querySelector('#dashboardLoading'),
    };
  }

  bindEvents() {
    // Header actions
    this.addEventListener(
      this.elements.refreshBtn,
      'click',
      this.refreshDashboard
    );
    this.addEventListener(
      this.elements.exportBtn,
      'click',
      this.exportDashboardData
    );
    this.addEventListener(
      this.elements.settingsBtn,
      'click',
      this.showDashboardSettings
    );
    this.addEventListener(
      this.elements.periodSelector,
      'change',
      this.handlePeriodChange
    );

    // Chart actions
    this.addEventListener(this.elements.messagesFullscreen, 'click', () =>
      this.showFullscreenChart('messages')
    );
    this.addEventListener(this.elements.conversationsFullscreen, 'click', () =>
      this.showFullscreenChart('conversations')
    );

    // Activity actions
    this.addEventListener(
      this.elements.clearActivityBtn,
      'click',
      this.clearActivity
    );

    // Quick actions
    this.addEventListener(
      this.elements.sendBroadcastBtn,
      'click',
      this.handleSendBroadcast
    );
    this.addEventListener(
      this.elements.createTemplateBtn,
      'click',
      this.handleCreateTemplate
    );
    this.addEventListener(
      this.elements.exportContactsBtn,
      'click',
      this.handleExportContacts
    );
    this.addEventListener(
      this.elements.viewReportsBtn,
      'click',
      this.handleViewReports
    );
    this.addEventListener(
      this.elements.systemBackupBtn,
      'click',
      this.handleSystemBackup
    );
    this.addEventListener(
      this.elements.systemSettingsBtn,
      'click',
      this.handleSystemSettings
    );
  }

  async afterInit() {
    await this.initializeCharts();
    await this.loadDashboardData();
    this.setupRealTimeUpdates();
    this.startAutoRefresh();
  }

  // Data loading methods
  async loadDashboardData() {
    this.setState({ loading: true });
    this.showLoading();

    try {
      // Cargar datos con un pequeño delay para evitar cancelaciones
      const metrics = await this.loadMetrics();
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      
      const activity = await this.loadRecentActivity();
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      
      const systemStatus = await this.loadSystemStatus();

      this.metrics = metrics;
      this.updateQuickStats();
      this.updateCharts();
      this.updateActivity(activity);
      this.updateSystemStatus(systemStatus);
      this.updateLastUpdateTime();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showToast('Error al cargar datos del dashboard', 'error');
    } finally {
      this.setState({ loading: false });
      this.hideLoading();
    }
  }

  async loadMetrics() {
    try {
      const response = await this.request(
        `/api/dashboard/metrics?period=${this.state.selectedPeriod}`
      );
      this.clearError('metrics');
      return response.data || response.metrics || this.getDefaultMetrics();
    } catch (error) {
      console.error('Error loading metrics:', error);
      this.handleApiError(error, 'metrics');
      return this.getDefaultMetrics();
    }
  }

  async loadRecentActivity() {
    try {
      const response = await this.request('/api/dashboard/activity?limit=20');
      this.clearError('activity');
      return response.data || response.activities || [];
    } catch (error) {
      console.error('Error loading activity:', error);
      this.handleApiError(error, 'activity');
      return [];
    }
  }

  async loadSystemStatus() {
    try {
      const response = await this.request('/api/dashboard/status');
      this.clearError('status');
      return response.data || response.status || this.getDefaultStatus();
    } catch (error) {
      console.error('Error loading system status:', error);
      this.handleApiError(error, 'status');
      return this.getDefaultStatus();
    }
  }

  getDefaultMetrics() {
    return {
      messages: { sent: 0, received: 0, failed: 0, history: [] },
      conversations: { active: 0, total: 0, avgDuration: 0, history: [] },
      templates: { total: 0, approved: 0, pending: 0 },
      contacts: { total: 0, active: 0, blocked: 0 },
      performance: { responseTime: 0, uptime: 100, errorRate: 0 },
    };
  }

  getDefaultStatus() {
    return {
      whatsapp: { status: 'unknown', message: 'Verificando...' },
      database: { status: 'unknown', message: 'Verificando...' },
      server: { status: 'unknown', message: 'Verificando...' },
      storage: { status: 'unknown', message: 'Verificando...' },
    };
  }

  // Chart initialization
  async initializeCharts() {
    // Chart.js ya está cargado en el HTML
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está disponible globalmente');
      return;
    }

    this.initializeMessagesChart();
    this.initializeConversationsChart();
  }

  initializeMessagesChart() {
    if (!this.elements.messagesChart) {
      console.warn('Elemento messagesChart no encontrado');
      return;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está disponible');
      return;
    }

    const ctx = this.elements.messagesChart.getContext('2d');

    this.charts.messages = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Enviados',
            data: [],
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            tension: 0.4,
          },
          {
            label: 'Recibidos',
            data: [],
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            tension: 0.4,
          },
          {
            label: 'Fallidos',
            data: [],
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
        },
        animation: {
          duration: this.options.chartAnimations ? 1000 : 0,
        },
      },
    });
  }

  initializeConversationsChart() {
    if (!this.elements.conversationsChart) {
      console.warn('Elemento conversationsChart no encontrado');
      return;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está disponible');
      return;
    }

    const ctx = this.elements.conversationsChart.getContext('2d');

    this.charts.conversations = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Activas', 'Completadas', 'Abandonadas'],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ['#28a745', '#007bff', '#ffc107'],
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
        },
        animation: {
          duration: this.options.chartAnimations ? 1000 : 0,
        },
      },
    });
  }

  // Update methods
  updateQuickStats() {
    const { messages, conversations, templates, performance } = this.metrics;

    // Messages
    const totalMessages = messages.sent + messages.received;
    this.elements.messagesCount.textContent = this.formatNumber(totalMessages);
    this.updateStatChange(this.elements.messagesChange, messages.change || 0);

    // Conversations
    this.elements.conversationsCount.textContent = this.formatNumber(
      conversations.active
    );
    this.updateStatChange(
      this.elements.conversationsChange,
      conversations.change || 0
    );

    // Templates
    this.elements.templatesCount.textContent = this.formatNumber(
      templates.approved
    );
    this.updateStatChange(this.elements.templatesChange, templates.change || 0);

    // Performance
    this.elements.performanceScore.textContent = `${Math.round(performance.uptime)}%`;
    this.updateStatChange(
      this.elements.performanceChange,
      performance.change || 0
    );
  }

  updateStatChange(element, change) {
    const icon = element.querySelector('i');
    const span = element.querySelector('span');

    span.textContent = `${Math.abs(change)}%`;

    if (change > 0) {
      icon.className = 'fas fa-arrow-up';
      element.className = 'stat-change positive';
    } else if (change < 0) {
      icon.className = 'fas fa-arrow-down';
      element.className = 'stat-change negative';
    } else {
      icon.className = 'fas fa-minus';
      element.className = 'stat-change neutral';
    }
  }

  updateCharts() {
    this.updateMessagesChart();
    this.updateConversationsChart();
  }

  updateMessagesChart() {
    const { messages } = this.metrics;

    if (messages.history && messages.history.length > 0) {
      const labels = messages.history.map(item =>
        this.formatTimeLabel(item.time)
      );
      const sentData = messages.history.map(item => item.sent || 0);
      const receivedData = messages.history.map(item => item.received || 0);
      const failedData = messages.history.map(item => item.failed || 0);

      this.charts.messages.data.labels = labels;
      this.charts.messages.data.datasets[0].data = sentData;
      this.charts.messages.data.datasets[1].data = receivedData;
      this.charts.messages.data.datasets[2].data = failedData;

      this.charts.messages.update();
    }
  }

  updateConversationsChart() {
    const { conversations } = this.metrics;

    this.charts.conversations.data.datasets[0].data = [
      conversations.active || 0,
      conversations.completed || 0,
      conversations.abandoned || 0,
    ];

    this.charts.conversations.update();
  }

  updateActivity(activities) {
    if (!activities || activities.length === 0) {
      this.elements.activityList.innerHTML = `
        <div class="no-activity">
          <i class="fas fa-clock"></i>
          <p>No hay actividad reciente</p>
        </div>
      `;
      return;
    }

    const html = activities
      .map(activity => this.getActivityItemHTML(activity))
      .join('');
    this.elements.activityList.innerHTML = html;
  }

  getActivityItemHTML(activity) {
    const icon = this.getActivityIcon(activity.type);
    const timeAgo = this.getTimeAgo(activity.timestamp);

    return `
      <div class="activity-item ${activity.type}">
        <div class="activity-icon">
          ${icon}
        </div>
        <div class="activity-content">
          <div class="activity-message">${activity.message}</div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }

  getActivityIcon(type) {
    const icons = {
      message: '<i class="fas fa-comment"></i>',
      template: '<i class="fas fa-file-alt"></i>',
      contact: '<i class="fas fa-user"></i>',
      system: '<i class="fas fa-cog"></i>',
      error: '<i class="fas fa-exclamation-triangle"></i>',
      success: '<i class="fas fa-check-circle"></i>',
    };
    return icons[type] || icons.system;
  }

  updateSystemStatus(status) {
    this.updateStatusIndicator('whatsapp', status.whatsapp);
    this.updateStatusIndicator('database', status.database);
    this.updateStatusIndicator('server', status.server);
    this.updateStatusIndicator('storage', status.storage);
  }

  updateStatusIndicator(service, serviceStatus) {
    const indicator = this.elements[`${service}Status`];
    const text = this.elements[`${service}StatusText`];

    const statusClass = this.getStatusClass(serviceStatus.status);

    indicator.className = `status-indicator ${statusClass}`;
    text.textContent = serviceStatus.message || 'Estado desconocido';
  }

  getStatusClass(status) {
    const classes = {
      online: 'status-online',
      offline: 'status-offline',
      warning: 'status-warning',
      error: 'status-error',
      unknown: 'status-unknown',
    };
    return classes[status] || classes.unknown;
  }

  updateLastUpdateTime() {
    const now = new Date();
    this.elements.lastUpdateTime.textContent = now.toLocaleTimeString();
    this.setState({ lastUpdate: now });
  }

  updateConnectionStatus(connected) {
    const status = this.elements.connectionStatus;
    const icon = status.querySelector('i');
    const text = status.querySelector('span');

    if (connected) {
      icon.className = 'fas fa-circle text-success';
      text.textContent = 'Conectado';
      status.className = 'connection-status connected';
    } else {
      icon.className = 'fas fa-circle text-danger';
      text.textContent = 'Desconectado';
      status.className = 'connection-status disconnected';
    }
  }

  // Event handlers
  async refreshDashboard() {
    await this.loadDashboardData();
    this.showToast('Dashboard actualizado', 'success');
  }

  handlePeriodChange() {
    this.setState({ selectedPeriod: this.elements.periodSelector.value });
    this.loadDashboardData();
  }

  async exportDashboardData() {
    try {
      const response = await this.request(
        `/api/dashboard/export?period=${this.state.selectedPeriod}`
      );

      if (response.success) {
        // Create download link
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Datos exportados correctamente', 'success');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showToast('Error al exportar datos', 'error');
    }
  }

  showDashboardSettings() {
    // Emit event for showing settings
    this.emit('dashboard:settings');
  }

  showFullscreenChart(chartType) {
    // Emit event for fullscreen chart
    this.emit('dashboard:fullscreen', { chartType });
  }

  clearActivity() {
    this.elements.activityList.innerHTML = `
      <div class="no-activity">
        <i class="fas fa-clock"></i>
        <p>No hay actividad reciente</p>
      </div>
    `;
    this.showToast('Actividad limpiada', 'success');
  }

  // Quick action handlers
  handleSendBroadcast() {
    this.emit('dashboard:action', { action: 'send-broadcast' });
  }

  handleCreateTemplate() {
    this.emit('dashboard:action', { action: 'create-template' });
  }

  handleExportContacts() {
    this.emit('dashboard:action', { action: 'export-contacts' });
  }

  handleViewReports() {
    this.emit('dashboard:action', { action: 'view-reports' });
  }

  handleSystemBackup() {
    this.emit('dashboard:action', { action: 'system-backup' });
  }

  handleSystemSettings() {
    this.emit('dashboard:action', { action: 'system-settings' });
  }

  // Real-time updates
  setupRealTimeUpdates() {
    if (!this.options.enableRealTime) return;

    try {
      this.socket = io();

      this.socket.on('connect', () => {
        this.updateConnectionStatus(true);
      });

      this.socket.on('disconnect', () => {
        this.updateConnectionStatus(false);
      });

      this.socket.on('dashboard:metrics', data => {
        this.handleRealTimeMetrics(data);
      });

      this.socket.on('dashboard:activity', data => {
        this.handleRealTimeActivity(data);
      });

      this.socket.on('dashboard:status', data => {
        this.handleRealTimeStatus(data);
      });
    } catch (error) {
      console.error('Error setting up real-time updates:', error);
    }
  }

  handleRealTimeMetrics(data) {
    // Update metrics with real-time data
    Object.assign(this.metrics, data);
    this.updateQuickStats();
    this.updateCharts();
  }

  handleRealTimeActivity(activity) {
    // Add new activity to the list
    const activityHTML = this.getActivityItemHTML(activity);
    const activityList = this.elements.activityList;

    if (activityList.querySelector('.no-activity')) {
      activityList.innerHTML = '';
    }

    activityList.insertAdjacentHTML('afterbegin', activityHTML);

    // Remove old activities (keep only 20)
    const activities = activityList.querySelectorAll('.activity-item');
    if (activities.length > 20) {
      activities[activities.length - 1].remove();
    }
  }

  handleRealTimeStatus(status) {
    this.updateSystemStatus(status);
  }

  // Auto-refresh
  startAutoRefresh() {
    if (!this.options.autoRefresh) return;

    // Detener cualquier timer existente
    this.stopAutoRefresh();

    this.refreshTimer = setInterval(() => {
      // Solo actualizar si la pestaña está visible para reducir carga del servidor
      if (!document.hidden) {
        this.loadDashboardData();
      }
    }, this.options.refreshInterval);

    // Solo agregar el event listener si no existe ya
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.stopAutoRefresh();
        } else {
          this.startAutoRefresh();
          // Comentado temporalmente para evitar peticiones duplicadas
          // this.loadDashboardData();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
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

  formatTimeLabel(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
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

  showLoading() {
    this.elements.loading.style.display = 'flex';
  }

  hideLoading() {
    this.elements.loading.style.display = 'none';
  }

  // Error handling
  handleApiError(error, section) {
    const errorInfo = this.parseError(error);

    // Mostrar notificación de error específica
    this.showErrorNotification(errorInfo, section);

    // Manejar rate limiting específicamente
    if (errorInfo.status === 429) {
      this.handleRateLimitError(section);
    }

    // Actualizar estado de conexión
    this.updateConnectionStatus(false);
  }

  parseError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText,
        type: this.getErrorType(error.response.status),
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'Error de conexión - Servidor no disponible',
        type: 'network',
      };
    } else {
      return {
        status: 500,
        message: error.message || 'Error desconocido',
        type: 'unknown',
      };
    }
  }

  getErrorType(status) {
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
    if (status === 404) return 'not_found';
    if (status >= 400) return 'client';
    return 'unknown';
  }

  showErrorNotification(errorInfo, section) {
    const message = this.getErrorMessage(errorInfo, section);

    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `dashboard-error-notification ${errorInfo.type}`;
    notification.innerHTML = `
      <div class="error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
        <button class="close-error" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Agregar al dashboard
    const dashboard = this.container.querySelector('.dashboard-content');
    if (dashboard) {
      dashboard.insertBefore(notification, dashboard.firstChild);

      // Auto-remover después de 5 segundos
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    }
  }

  getErrorMessage(errorInfo, section) {
    const sectionNames = {
      metrics: 'métricas',
      activity: 'actividad',
      status: 'estado del sistema',
    };

    const sectionName = sectionNames[section] || section;

    switch (errorInfo.type) {
      case 'rate_limit':
        return `Demasiadas solicitudes. Pausando actualizaciones de ${sectionName}...`;
      case 'network':
        return `Error de conexión al cargar ${sectionName}. Reintentando...`;
      case 'server':
        return `Error del servidor al cargar ${sectionName}. Usando datos por defecto.`;
      case 'not_found':
        return `API de ${sectionName} no encontrada. Usando datos por defecto.`;
      default:
        return `Error al cargar ${sectionName}: ${errorInfo.message}`;
    }
  }

  handleRateLimitError(section) {
    // Pausar auto-refresh temporalmente
    this.stopAutoRefresh();

    // Reanudar después de 2 minutos
    setTimeout(() => {
      if (this.options.autoRefresh) {
        this.startAutoRefresh();
      }
    }, 120000); // 2 minutos

    console.warn(
      `Rate limit alcanzado para ${section}. Pausando actualizaciones por 2 minutos.`
    );
  }

  clearError(section) {
    // Remover notificaciones de error específicas de esta sección
    const notifications = this.container.querySelectorAll(
      '.dashboard-error-notification'
    );
    notifications.forEach(notification => {
      if (notification.textContent.includes(section)) {
        notification.remove();
      }
    });
  }

  // Event emitter
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    this.container.dispatchEvent(event);
  }

  // Cleanup
  destroy() {
    this.stopAutoRefresh();

    // Remover event listener de visibilidad
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    // Destroy charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });

    super.destroy();
  }
}

// Hacer disponible globalmente para compatibilidad
window.DashboardManager = DashboardManager;

// Exportar para uso en módulos ES6
export default DashboardManager;
