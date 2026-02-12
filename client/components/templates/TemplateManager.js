/**
 * Gestor de plantillas modular
 * Maneja la creación, edición y gestión de plantillas WhatsApp
 */
class TemplateManager extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      enablePreview: true,
      enableValidation: true,
      autoSave: true,
      autoSaveInterval: 30000,
      maxTemplates: 100,
    };
  }

  async beforeInit() {
    this.templates = [];
    this.localTemplates = [];
    this.currentTemplate = null;
    this.currentLanguage = 'es';
    this.autoSaveTimer = null;
    this.validationRules = this.getValidationRules();

    this.state = {
      loading: false,
      saving: false,
      mode: 'list', // list, create, edit, preview
      selectedTemplate: null,
      validationErrors: {},
      previewData: null,
    };
  }

  getValidationRules() {
    return {
      name: {
        required: true,
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_\s]+$/,
        message: 'El nombre debe tener entre 3-50 caracteres alfanuméricos',
      },
      category: {
        required: true,
        message: 'La categoría es requerida',
      },
      language: {
        required: true,
        message: 'El idioma es requerido',
      },
      header: {
        maxLength: 60,
        message: 'El encabezado no puede exceder 60 caracteres',
      },
      body: {
        required: true,
        minLength: 1,
        maxLength: 1024,
        message: 'El cuerpo es requerido y no puede exceder 1024 caracteres',
      },
      footer: {
        maxLength: 60,
        message: 'El pie no puede exceder 60 caracteres',
      },
    };
  }

  getTemplate() {
    return `
      <div class="template-manager">
        <!-- Header -->
        <div class="template-header">
          <div class="header-left">
            <h2 class="template-title">
              <i class="fas fa-file-alt"></i>
              Gestión de Plantillas
            </h2>
            <div class="template-stats" id="templateStats">
              <span class="stat-item">
                <i class="fas fa-file"></i>
                <span id="templateCount">0</span> plantillas
              </span>
              <span class="stat-item">
                <i class="fas fa-check-circle"></i>
                <span id="approvedCount">0</span> aprobadas
              </span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="refreshTemplates">
              <i class="fas fa-sync-alt"></i>
              Actualizar
            </button>
            <button class="btn btn-primary" id="createTemplate">
              <i class="fas fa-plus"></i>
              Nueva Plantilla
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="template-filters">
          <div class="filter-group">
            <label>Categoría:</label>
            <select id="categoryFilter">
              <option value="">Todas las categorías</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utilidad</option>
              <option value="AUTHENTICATION">Autenticación</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Estado:</label>
            <select id="statusFilter">
              <option value="">Todos los estados</option>
              <option value="APPROVED">Aprobado</option>
              <option value="PENDING">Pendiente</option>
              <option value="REJECTED">Rechazado</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Idioma:</label>
            <select id="languageFilter">
              <option value="">Todos los idiomas</option>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
            </select>
          </div>
          <div class="filter-group">
            <input type="text" id="searchTemplates" placeholder="Buscar plantillas..." />
          </div>
        </div>

        <!-- Main Content -->
        <div class="template-content">
          <!-- Template List -->
          <div class="template-list-view" id="templateListView">
            <div class="template-grid" id="templateGrid">
              <div class="loading-templates">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Cargando plantillas...</span>
              </div>
            </div>
          </div>

          <!-- Template Form -->
          <div class="template-form-view" id="templateFormView" style="display: none;">
            <div class="form-header">
              <h3 id="formTitle">Nueva Plantilla</h3>
              <div class="form-actions">
                <button class="btn btn-secondary" id="cancelForm">
                  <i class="fas fa-times"></i>
                  Cancelar
                </button>
                <button class="btn btn-primary" id="saveTemplate">
                  <i class="fas fa-save"></i>
                  Guardar
                </button>
              </div>
            </div>

            <form class="template-form" id="templateForm">
              <div class="form-row">
                <div class="form-group">
                  <label for="templateName">Nombre de la plantilla *</label>
                  <input type="text" id="templateName" name="name" required />
                  <div class="field-error" id="nameError"></div>
                </div>
                <div class="form-group">
                  <label for="templateCategory">Categoría *</label>
                  <select id="templateCategory" name="category" required>
                    <option value="">Seleccionar categoría</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utilidad</option>
                    <option value="AUTHENTICATION">Autenticación</option>
                  </select>
                  <div class="field-error" id="categoryError"></div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="templateLanguage">Idioma *</label>
                  <select id="templateLanguage" name="language" required>
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                    <option value="pt">Portugués</option>
                  </select>
                  <div class="field-error" id="languageError"></div>
                </div>
                <div class="form-group">
                  <label for="templateTags">Etiquetas</label>
                  <input type="text" id="templateTags" name="tags" placeholder="Separadas por comas" />
                </div>
              </div>

              <div class="form-group">
                <label for="templateHeader">Encabezado (opcional)</label>
                <input type="text" id="templateHeader" name="header" maxlength="60" />
                <div class="field-help">Máximo 60 caracteres</div>
                <div class="field-error" id="headerError"></div>
              </div>

              <div class="form-group">
                <label for="templateBody">Cuerpo del mensaje *</label>
                <textarea id="templateBody" name="body" rows="6" required maxlength="1024"></textarea>
                <div class="field-help">
                  Usa {{1}}, {{2}}, etc. para variables. Máximo 1024 caracteres.
                  <span class="char-count" id="bodyCharCount">0/1024</span>
                </div>
                <div class="field-error" id="bodyError"></div>
              </div>

              <div class="form-group">
                <label for="templateFooter">Pie de página (opcional)</label>
                <input type="text" id="templateFooter" name="footer" maxlength="60" />
                <div class="field-help">Máximo 60 caracteres</div>
                <div class="field-error" id="footerError"></div>
              </div>

              <div class="form-group">
                <label>Botones (opcional)</label>
                <div class="buttons-container" id="buttonsContainer">
                  <div class="no-buttons">
                    <p>No hay botones configurados</p>
                    <button type="button" class="btn btn-sm btn-secondary" id="addButton">
                      <i class="fas fa-plus"></i>
                      Agregar Botón
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Variables detectadas</label>
                <div class="variables-list" id="variablesList">
                  <div class="no-variables">No se detectaron variables</div>
                </div>
              </div>
            </form>
          </div>

          <!-- Template Preview -->
          <div class="template-preview-view" id="templatePreviewView" style="display: none;">
            <div class="preview-header">
              <h3>Vista Previa de Plantilla</h3>
              <div class="preview-actions">
                <button class="btn btn-secondary" id="closePreview">
                  <i class="fas fa-times"></i>
                  Cerrar
                </button>
                <button class="btn btn-primary" id="sendTestTemplate">
                  <i class="fas fa-paper-plane"></i>
                  Enviar Prueba
                </button>
              </div>
            </div>

            <div class="preview-content">
              <div class="preview-phone">
                <div class="phone-header">
                  <div class="phone-status">
                    <span class="time">10:30</span>
                    <div class="phone-indicators">
                      <i class="fas fa-signal"></i>
                      <i class="fas fa-wifi"></i>
                      <i class="fas fa-battery-three-quarters"></i>
                    </div>
                  </div>
                  <div class="chat-header">
                    <div class="contact-info">
                      <img src="/images/business-avatar.png" alt="Business" class="contact-avatar" />
                      <div class="contact-details">
                        <h4>Mi Negocio</h4>
                        <span class="contact-status">en línea</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="phone-messages">
                  <div class="message-preview" id="messagePreview">
                    <!-- Preview content will be rendered here -->
                  </div>
                </div>
              </div>

              <div class="preview-variables">
                <h4>Variables de prueba</h4>
                <div class="variables-form" id="previewVariables">
                  <!-- Variables form will be rendered here -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      // Header
      templateStats: this.container.querySelector('#templateStats'),
      templateCount: this.container.querySelector('#templateCount'),
      approvedCount: this.container.querySelector('#approvedCount'),
      refreshBtn: this.container.querySelector('#refreshTemplates'),
      createBtn: this.container.querySelector('#createTemplate'),

      // Filters
      categoryFilter: this.container.querySelector('#categoryFilter'),
      statusFilter: this.container.querySelector('#statusFilter'),
      languageFilter: this.container.querySelector('#languageFilter'),
      searchInput: this.container.querySelector('#searchTemplates'),

      // Views
      listView: this.container.querySelector('#templateListView'),
      formView: this.container.querySelector('#templateFormView'),
      previewView: this.container.querySelector('#templatePreviewView'),
      templateGrid: this.container.querySelector('#templateGrid'),

      // Form
      form: this.container.querySelector('#templateForm'),
      formTitle: this.container.querySelector('#formTitle'),
      cancelBtn: this.container.querySelector('#cancelForm'),
      saveBtn: this.container.querySelector('#saveTemplate'),

      // Form fields
      nameInput: this.container.querySelector('#templateName'),
      categoryInput: this.container.querySelector('#templateCategory'),
      languageInput: this.container.querySelector('#templateLanguage'),
      tagsInput: this.container.querySelector('#templateTags'),
      headerInput: this.container.querySelector('#templateHeader'),
      bodyInput: this.container.querySelector('#templateBody'),
      footerInput: this.container.querySelector('#templateFooter'),
      bodyCharCount: this.container.querySelector('#bodyCharCount'),
      buttonsContainer: this.container.querySelector('#buttonsContainer'),
      variablesList: this.container.querySelector('#variablesList'),
      addButtonBtn: this.container.querySelector('#addButton'),

      // Preview
      closePreviewBtn: this.container.querySelector('#closePreview'),
      sendTestBtn: this.container.querySelector('#sendTestTemplate'),
      messagePreview: this.container.querySelector('#messagePreview'),
      previewVariables: this.container.querySelector('#previewVariables'),
    };
  }

  bindEvents() {
    // Header actions
    this.addEventListener(
      this.elements.refreshBtn,
      'click',
      this.refreshTemplates
    );
    this.addEventListener(
      this.elements.createBtn,
      'click',
      this.showCreateForm
    );

    // Filters
    this.addEventListener(
      this.elements.categoryFilter,
      'change',
      this.applyFilters
    );
    this.addEventListener(
      this.elements.statusFilter,
      'change',
      this.applyFilters
    );
    this.addEventListener(
      this.elements.languageFilter,
      'change',
      this.applyFilters
    );
    this.addEventListener(
      this.elements.searchInput,
      'input',
      this.applyFilters
    );

    // Form actions
    this.addEventListener(this.elements.cancelBtn, 'click', this.showListView);
    this.addEventListener(this.elements.saveBtn, 'click', this.saveTemplate);
    this.addEventListener(this.elements.form, 'submit', this.handleFormSubmit);

    // Form fields
    this.addEventListener(
      this.elements.bodyInput,
      'input',
      this.handleBodyInput
    );
    this.addEventListener(this.elements.addButtonBtn, 'click', this.addButton);

    // Preview actions
    this.addEventListener(
      this.elements.closePreviewBtn,
      'click',
      this.showListView
    );
    this.addEventListener(
      this.elements.sendTestBtn,
      'click',
      this.sendTestTemplate
    );

    // Auto-save
    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  async afterInit() {
    await this.loadTemplates();
  }

  // Template loading methods
  async loadTemplates() {
    this.setState({ loading: true });

    try {
      const [whatsappTemplates, localTemplates] = await Promise.all([
        this.loadWhatsAppTemplates(),
        this.loadLocalTemplates(),
      ]);

      this.templates = whatsappTemplates;
      this.localTemplates = localTemplates;

      this.updateStats();
      this.renderTemplates();
    } catch (error) {
      console.error('Error loading templates:', error);
      this.showToast('Error al cargar plantillas', 'error');
    } finally {
      this.setState({ loading: false });
    }
  }

  async loadWhatsAppTemplates() {
    try {
      const response = await this.request('/api/templates');
      return response.templates || [];
    } catch (error) {
      console.error('Error loading WhatsApp templates:', error);
      return [];
    }
  }

  async loadLocalTemplates() {
    try {
      const response = await this.request('/api/templates/local');
      return response.templates || [];
    } catch (error) {
      console.error('Error loading local templates:', error);
      return [];
    }
  }

  async refreshTemplates() {
    await this.loadTemplates();
    this.showToast('Plantillas actualizadas', 'success');
  }

  // Rendering methods
  renderTemplates() {
    const allTemplates = [...this.templates, ...this.localTemplates];
    const filteredTemplates = this.applyCurrentFilters(allTemplates);

    if (filteredTemplates.length === 0) {
      this.elements.templateGrid.innerHTML = `
        <div class="no-templates">
          <i class="fas fa-file-alt"></i>
          <h3>No hay plantillas</h3>
          <p>Crea tu primera plantilla para comenzar</p>
          <button class="btn btn-primary" onclick="this.showCreateForm()">
            <i class="fas fa-plus"></i>
            Crear Plantilla
          </button>
        </div>
      `;
      return;
    }

    const html = filteredTemplates
      .map(template => this.getTemplateCardHTML(template))
      .join('');
    this.elements.templateGrid.innerHTML = html;

    // Bind events for template cards
    this.bindTemplateCardEvents();
  }

  getTemplateCardHTML(template) {
    const isLocal = template.source === 'local';
    const statusClass = template.status?.toLowerCase() || 'local';
    const statusIcon = this.getStatusIcon(template.status);

    return `
      <div class="template-card ${statusClass}" data-template-id="${template.id}" data-source="${template.source || 'whatsapp'}">
        <div class="template-card-header">
          <div class="template-info">
            <h4 class="template-name">${template.name}</h4>
            <span class="template-category">${template.category || 'Sin categoría'}</span>
          </div>
          <div class="template-status">
            ${statusIcon}
            <span class="status-text">${this.getStatusText(template.status)}</span>
          </div>
        </div>

        <div class="template-card-body">
          <div class="template-preview-text">
            ${this.getTemplatePreviewText(template)}
          </div>
          
          <div class="template-meta">
            <span class="template-language">
              <i class="fas fa-globe"></i>
              ${template.language || 'es'}
            </span>
            <span class="template-variables">
              <i class="fas fa-code"></i>
              ${this.getVariableCount(template)} variables
            </span>
          </div>
        </div>

        <div class="template-card-actions">
          <button class="btn btn-sm btn-secondary" onclick="this.previewTemplate('${template.id}', '${template.source || 'whatsapp'}')">
            <i class="fas fa-eye"></i>
            Vista Previa
          </button>
          ${
            isLocal
              ? `
            <button class="btn btn-sm btn-primary" onclick="this.editTemplate('${template.id}')">
              <i class="fas fa-edit"></i>
              Editar
            </button>
          `
              : ''
          }
          <button class="btn btn-sm btn-success" onclick="this.useTemplate('${template.id}', '${template.source || 'whatsapp'}')">
            <i class="fas fa-paper-plane"></i>
            Usar
          </button>
          ${
            isLocal
              ? `
            <button class="btn btn-sm btn-danger" onclick="this.deleteTemplate('${template.id}')">
              <i class="fas fa-trash"></i>
            </button>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  bindTemplateCardEvents() {
    // Make methods available globally for onclick handlers
    window.previewTemplate = this.previewTemplate.bind(this);
    window.editTemplate = this.editTemplate.bind(this);
    window.useTemplate = this.useTemplate.bind(this);
    window.deleteTemplate = this.deleteTemplate.bind(this);
  }

  getStatusIcon(status) {
    const icons = {
      APPROVED: '<i class="fas fa-check-circle text-success"></i>',
      PENDING: '<i class="fas fa-clock text-warning"></i>',
      REJECTED: '<i class="fas fa-times-circle text-danger"></i>',
      local: '<i class="fas fa-file text-info"></i>',
    };
    return icons[status] || icons.local;
  }

  getStatusText(status) {
    const texts = {
      APPROVED: 'Aprobado',
      PENDING: 'Pendiente',
      REJECTED: 'Rechazado',
      local: 'Local',
    };
    return texts[status] || 'Local';
  }

  getTemplatePreviewText(template) {
    let text = '';

    if (template.header) {
      text += `<strong>${template.header}</strong><br>`;
    }

    text += template.body || template.text || '';

    if (template.footer) {
      text += `<br><small>${template.footer}</small>`;
    }

    // Truncate if too long
    if (text.length > 150) {
      text = text.substring(0, 150) + '...';
    }

    return text;
  }

  getVariableCount(template) {
    const body = template.body || template.text || '';
    const matches = body.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  }

  // Filter methods
  applyFilters() {
    this.renderTemplates();
  }

  applyCurrentFilters(templates) {
    let filtered = [...templates];

    // Category filter
    const category = this.elements.categoryFilter.value;
    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    // Status filter
    const status = this.elements.statusFilter.value;
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }

    // Language filter
    const language = this.elements.languageFilter.value;
    if (language) {
      filtered = filtered.filter(t => t.language === language);
    }

    // Search filter
    const search = this.elements.searchInput.value.toLowerCase();
    if (search) {
      filtered = filtered.filter(
        t =>
          (t.name || '').toLowerCase().includes(search) ||
          (t.body || t.text || '').toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  // Form methods
  showCreateForm() {
    this.setState({ mode: 'create', selectedTemplate: null });
    this.elements.formTitle.textContent = 'Nueva Plantilla';
    this.resetForm();
    this.showFormView();
  }

  showEditForm(template) {
    this.setState({ mode: 'edit', selectedTemplate: template });
    this.elements.formTitle.textContent = 'Editar Plantilla';
    this.populateForm(template);
    this.showFormView();
  }

  showFormView() {
    this.elements.listView.style.display = 'none';
    this.elements.previewView.style.display = 'none';
    this.elements.formView.style.display = 'block';
  }

  showListView() {
    this.elements.formView.style.display = 'none';
    this.elements.previewView.style.display = 'none';
    this.elements.listView.style.display = 'block';
    this.setState({ mode: 'list' });
  }

  resetForm() {
    this.elements.form.reset();
    this.clearValidationErrors();
    this.updateCharCount();
    this.updateVariablesList();
  }

  populateForm(template) {
    this.elements.nameInput.value = template.name || '';
    this.elements.categoryInput.value = template.category || '';
    this.elements.languageInput.value = template.language || 'es';
    this.elements.tagsInput.value = (template.tags || []).join(', ');
    this.elements.headerInput.value = template.header || '';
    this.elements.bodyInput.value = template.body || template.text || '';
    this.elements.footerInput.value = template.footer || '';

    this.updateCharCount();
    this.updateVariablesList();
  }

  handleFormSubmit(event) {
    event.preventDefault();
    this.saveTemplate();
  }

  async saveTemplate() {
    const formData = this.getFormData();
    const validation = this.validateTemplate(formData);

    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    this.setState({ saving: true });
    this.elements.saveBtn.disabled = true;

    try {
      const isEdit = this.state.mode === 'edit';
      const url = isEdit
        ? `/api/templates/local/${this.state.selectedTemplate.id}`
        : '/api/templates/local';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await this.request(url, {
        method,
        body: formData,
      });

      if (response.success) {
        this.showToast(
          isEdit ? 'Plantilla actualizada' : 'Plantilla creada',
          'success'
        );
        await this.loadTemplates();
        this.showListView();
      } else {
        throw new Error(response.error || 'Error al guardar plantilla');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      this.showToast('Error al guardar plantilla', 'error');
    } finally {
      this.setState({ saving: false });
      this.elements.saveBtn.disabled = false;
    }
  }

  getFormData() {
    return {
      name: this.elements.nameInput.value.trim(),
      category: this.elements.categoryInput.value,
      language: this.elements.languageInput.value,
      tags: this.elements.tagsInput.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t),
      header: this.elements.headerInput.value.trim(),
      body: this.elements.bodyInput.value.trim(),
      footer: this.elements.footerInput.value.trim(),
    };
  }

  validateTemplate(data) {
    // Usar función consolidada de validación si está disponible
    if (
      typeof window !== 'undefined' &&
      window.ValidationUtils &&
      window.ValidationUtils.validateTemplate
    ) {
      return window.ValidationUtils.validateTemplate(data);
    }
    // Fallback a validación local
    return this.validate(data, this.validationRules);
  }

  showValidationErrors(errors) {
    this.clearValidationErrors();

    for (const [field, message] of Object.entries(errors)) {
      const errorElement = this.container.querySelector(`#${field}Error`);
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
      }
    }
  }

  clearValidationErrors() {
    this.container.querySelectorAll('.field-error').forEach(element => {
      element.textContent = '';
      element.style.display = 'none';
    });
  }

  // Body input handlers
  handleBodyInput() {
    this.updateCharCount();
    this.updateVariablesList();

    if (this.options.autoSave && this.state.mode === 'edit') {
      this.scheduleAutoSave();
    }
  }

  updateCharCount() {
    const body = this.elements.bodyInput.value;
    const count = body.length;
    this.elements.bodyCharCount.textContent = `${count}/1024`;

    if (count > 1024) {
      this.elements.bodyCharCount.classList.add('text-danger');
    } else {
      this.elements.bodyCharCount.classList.remove('text-danger');
    }
  }

  updateVariablesList() {
    const body = this.elements.bodyInput.value;
    const variables = this.extractVariables(body);

    if (variables.length === 0) {
      this.elements.variablesList.innerHTML =
        '<div class="no-variables">No se detectaron variables</div>';
      return;
    }

    const html = variables
      .map(
        (variable, index) => `
      <div class="variable-item">
        <span class="variable-name">${variable}</span>
        <span class="variable-description">Variable ${index + 1}</span>
      </div>
    `
      )
      .join('');

    this.elements.variablesList.innerHTML = html;
  }

  extractVariables(text) {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? [...new Set(matches)].sort() : [];
  }

  // Button management
  addButton() {
    // Implementation for adding buttons to template
    this.showToast('Función de botones en desarrollo', 'info');
  }

  // Template actions
  async editTemplate(templateId) {
    const template = this.localTemplates.find(t => t.id === templateId);
    if (template) {
      this.showEditForm(template);
    }
  }

  async deleteTemplate(templateId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
      return;
    }

    try {
      const response = await this.request(
        `/api/templates/local/${templateId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.success) {
        this.showToast('Plantilla eliminada', 'success');
        await this.loadTemplates();
      } else {
        throw new Error(response.error || 'Error al eliminar plantilla');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      this.showToast('Error al eliminar plantilla', 'error');
    }
  }

  async previewTemplate(templateId, source) {
    const templates = source === 'local' ? this.localTemplates : this.templates;
    const template = templates.find(t => t.id === templateId);

    if (template) {
      this.setState({ mode: 'preview', selectedTemplate: template });
      this.renderPreview(template);
      this.showPreviewView();
    }
  }

  showPreviewView() {
    this.elements.listView.style.display = 'none';
    this.elements.formView.style.display = 'none';
    this.elements.previewView.style.display = 'block';
  }

  renderPreview(template) {
    const variables = this.extractVariables(
      template.body || template.text || ''
    );

    // Render message preview
    this.renderMessagePreview(template, {});

    // Render variables form
    this.renderPreviewVariablesForm(variables);
  }

  renderMessagePreview(template, variableValues) {
    let body = template.body || template.text || '';

    // Replace variables with values
    Object.entries(variableValues).forEach(([variable, value]) => {
      body = body.replace(
        new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'),
        value || variable
      );
    });

    const html = `
      <div class="whatsapp-message">
        ${template.header ? `<div class="message-header">${template.header}</div>` : ''}
        <div class="message-body">${body}</div>
        ${template.footer ? `<div class="message-footer">${template.footer}</div>` : ''}
        ${template.buttons ? this.renderPreviewButtons(template.buttons) : ''}
      </div>
    `;

    this.elements.messagePreview.innerHTML = html;
  }

  renderPreviewButtons(buttons) {
    return `
      <div class="message-buttons">
        ${buttons
          .map(
            button => `
          <button class="message-button">${button.text}</button>
        `
          )
          .join('')}
      </div>
    `;
  }

  renderPreviewVariablesForm(variables) {
    if (variables.length === 0) {
      this.elements.previewVariables.innerHTML =
        '<p>Esta plantilla no tiene variables</p>';
      return;
    }

    const html = variables
      .map(
        variable => `
      <div class="variable-input-group">
        <label for="var_${variable}">${variable}</label>
        <input 
          type="text" 
          id="var_${variable}" 
          data-variable="${variable}"
          placeholder="Valor para ${variable}"
        />
      </div>
    `
      )
      .join('');

    this.elements.previewVariables.innerHTML = html;

    // Bind events for variable inputs
    this.elements.previewVariables.querySelectorAll('input').forEach(input => {
      this.addEventListener(input, 'input', this.updatePreviewWithVariables);
    });
  }

  updatePreviewWithVariables() {
    const variableValues = {};
    this.elements.previewVariables.querySelectorAll('input').forEach(input => {
      const variable = input.dataset.variable;
      variableValues[variable] = input.value;
    });

    this.renderMessagePreview(this.state.selectedTemplate, variableValues);
  }

  async useTemplate(templateId, source) {
    // Emit event for using template
    this.emit('template:use', {
      templateId,
      source,
      template:
        source === 'local'
          ? this.localTemplates.find(t => t.id === templateId)
          : this.templates.find(t => t.id === templateId),
    });

    this.showToast('Plantilla seleccionada para uso', 'success');
  }

  async sendTestTemplate() {
    const template = this.state.selectedTemplate;
    if (!template) return;

    // Get variable values
    const variableValues = {};
    this.elements.previewVariables.querySelectorAll('input').forEach(input => {
      const variable = input.dataset.variable;
      variableValues[variable] = input.value || 'Ejemplo';
    });

    // Emit event for sending test
    this.emit('template:test', {
      template,
      variableValues,
    });

    this.showToast('Enviando plantilla de prueba...', 'info');
  }

  // Auto-save functionality
  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      if (this.state.mode === 'edit' && this.hasUnsavedChanges()) {
        this.autoSave();
      }
    }, this.options.autoSaveInterval);
  }

  scheduleAutoSave() {
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSave();
    }, 2000);
  }

  async autoSave() {
    if (this.state.mode !== 'edit' || this.state.saving) return;

    const formData = this.getFormData();
    const validation = this.validateTemplate(formData);

    if (!validation.isValid) return;

    try {
      await this.request(
        `/api/templates/local/${this.state.selectedTemplate.id}`,
        {
          method: 'PUT',
          body: formData,
        }
      );

      this.showToast('Guardado automático', 'success', 1000);
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }

  hasUnsavedChanges() {
    if (!this.state.selectedTemplate) return false;

    const formData = this.getFormData();
    const template = this.state.selectedTemplate;

    return (
      formData.name !== template.name ||
      formData.body !== (template.body || template.text) ||
      formData.header !== (template.header || '') ||
      formData.footer !== (template.footer || '')
    );
  }

  // Stats update
  updateStats() {
    const totalTemplates = this.templates.length + this.localTemplates.length;
    const approvedTemplates = this.templates.filter(
      t => t.status === 'APPROVED'
    ).length;

    this.elements.templateCount.textContent = totalTemplates;
    this.elements.approvedCount.textContent = approvedTemplates;
  }

  // Event emitter
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    this.container.dispatchEvent(event);
  }

  destroy() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Clean up global methods
    if (window.previewTemplate) delete window.previewTemplate;
    if (window.editTemplate) delete window.editTemplate;
    if (window.useTemplate) delete window.useTemplate;
    if (window.deleteTemplate) delete window.deleteTemplate;

    super.destroy();
  }
}

// Hacer disponible globalmente para compatibilidad
window.TemplateManager = TemplateManager;

// Exportar para uso en módulos ES6
export default TemplateManager;
