/**
 * Selector de Plantillas Aprobadas
 * Muestra todas las plantillas listas para envío
 */

class TemplateSelector {
  constructor() {
    this.templates = [];
    this.selectedTemplate = null;
    this.currentPhone = null;
  }

  /**
   * Inicializar selector
   */
  async init() {
    await this.loadTemplates();
  }

  /**
   * Cargar plantillas desde el servidor
   */
  async loadTemplates() {
    try {
      const response = await fetch('/api/templates?status=approved');
      const data = await response.json();

      if (data.success) {
        this.templates = data.data || [];
        console.log(`✅ ${this.templates.length} plantillas cargadas`);
      } else {
        console.error('Error cargando plantillas:', data.error);
        this.templates = [];
      }
    } catch (error) {
      console.error('Error al cargar plantillas:', error);
      this.templates = [];
    }
  }

  /**
   * Abrir selector de plantillas
   */
  async openSelector() {
    if (this.templates.length === 0) {
      alert('No hay plantillas disponibles');
      return;
    }

    const modalHTML = `
      <div class="template-modal">
        <div class="template-modal-content">
          <div class="template-modal-header">
            <h2>Seleccionar Plantilla</h2>
            <button class="template-modal-close" id="templateModalClose">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="template-modal-search">
            <input 
              type="text" 
              id="templateSearch" 
              placeholder="Buscar plantilla..."
              class="template-search-input"
            >
          </div>

          <div class="template-list" id="templateList">
            ${this.templates.map(template => `
              <div class="template-item" data-template-id="${template.id}">
                <div class="template-item-header">
                  <h3>${template.name}</h3>
                  <span class="template-status approved">✓ Aprobada</span>
                </div>
                <p class="template-category">${template.category || 'General'}</p>
                <p class="template-preview">${template.content.substring(0, 100)}...</p>
                <button class="template-select-btn" data-template-id="${template.id}">
                  Seleccionar
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('templateModalClose').addEventListener('click', () => {
      modal.remove();
    });

    // Búsqueda
    document.getElementById('templateSearch').addEventListener('input', (e) => {
      this.filterTemplates(e.target.value);
    });

    // Seleccionar plantilla
    document.querySelectorAll('.template-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.dataset.templateId;
        this.selectTemplate(templateId);
        modal.remove();
      });
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Filtrar plantillas por búsqueda
   */
  filterTemplates(searchTerm) {
    const items = document.querySelectorAll('.template-item');
    const term = searchTerm.toLowerCase();

    items.forEach(item => {
      const name = item.querySelector('h3').textContent.toLowerCase();
      const category = item.querySelector('.template-category').textContent.toLowerCase();
      const preview = item.querySelector('.template-preview').textContent.toLowerCase();

      if (name.includes(term) || category.includes(term) || preview.includes(term)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Seleccionar plantilla
   */
  selectTemplate(templateId) {
    const template = this.templates.find(t => t.id === parseInt(templateId));
    
    if (!template) return;

    this.selectedTemplate = template;

    // Si la plantilla tiene variables, pedir que se completen
    if (template.variables && template.variables.length > 0) {
      this.showVariablesForm(template);
    } else {
      this.insertTemplateToInput(template.content);
    }
  }

  /**
   * Mostrar formulario para variables
   */
  showVariablesForm(template) {
    const formHTML = `
      <div class="template-variables-modal">
        <div class="template-variables-content">
          <h3>Completar Variables de Plantilla</h3>
          <form id="variablesForm">
            ${template.variables.map((variable, index) => `
              <div class="form-group">
                <label>${variable}</label>
                <input 
                  type="text" 
                  name="variable_${index}" 
                  placeholder="Ingresa ${variable}"
                  required
                >
              </div>
            `).join('')}
            <button type="submit" class="btn btn-primary">Usar Plantilla</button>
          </form>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = formHTML;
    document.body.appendChild(modal);

    document.getElementById('variablesForm').addEventListener('submit', (e) => {
      e.preventDefault();
      
      let content = template.content;
      const formData = new FormData(e.target);

      template.variables.forEach((variable, index) => {
        const value = formData.get(`variable_${index}`);
        content = content.replace(`{{${variable}}}`, value);
      });

      this.insertTemplateToInput(content);
      modal.remove();
    });
  }

  /**
   * Insertar plantilla en el input
   */
  insertTemplateToInput(content) {
    const input = document.querySelector('[data-role="message-input"]') ||
                  document.querySelector('.message-input') ||
                  document.querySelector('textarea[name="message"]');
    
    if (input) {
      input.value = content;
      input.focus();
      console.log('✅ Plantilla insertada');
    }
  }

  /**
   * Enviar plantilla a contacto
   */
  async sendTemplate(phone, templateId) {
    const template = this.templates.find(t => t.id === templateId);
    
    if (!template) {
      alert('Plantilla no encontrada');
      return;
    }

    try {
      const response = await fetch('/api/messages/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          templateId,
          templateName: template.name,
          content: template.content
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Plantilla enviada correctamente');
        return data;
      } else {
        alert('Error enviando plantilla: ' + data.error);
      }
    } catch (error) {
      console.error('Error enviando plantilla:', error);
      alert('Error enviando plantilla');
    }
  }
}

// Crear instancia global
window.templateSelector = new TemplateSelector();

export default TemplateSelector;
