/**
 * Mapeador de Variables de Plantillas
 * Permite al usuario seleccionar qué dato se envía en cada variable {{1}}, {{2}}, etc.
 */

class TemplateVariableMapper {
  constructor() {
    this.currentTemplate = null;
    this.variableMapping = {}; // { 1: { type: 'name', field: 'name' }, 2: { type: 'custom_field', field: 'field_id' } }
    this.customFields = [];
  }

  /**
   * Abre el modal de mapeo de variables
   * @param {object} template - Plantilla con componentes
   * @param {array} customFields - Lista de campos personalizados disponibles
   * @param {function} onSave - Callback cuando se guarda el mapeo
   */
  async showVariableMapperModal(template, customFields = [], onSave = null) {
    this.currentTemplate = template;
    this.customFields = customFields;

    // Detectar variables en la plantilla
    const variables = this.detectVariablesInTemplate(template);

    if (variables.total === 0) {
      alert('❌ Esta plantilla no tiene variables');
      return;
    }

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'variable-mapper-overlay';
    modal.id = 'variableMapperModal';
    modal.innerHTML = this.buildModalHTML(variables, customFields);

    document.body.appendChild(modal);

    // Agregar estilos si no existen
    this.addModalStyles();

    // Configurar eventos
    this.setupModalEvents(modal, variables, onSave);
  }

  /**
   * Detecta variables en una plantilla
   */
  detectVariablesInTemplate(template) {
    const result = {
      header: [],
      body: [],
      footer: [],
      total: 0,
    };

    if (!template.components) return result;

    template.components.forEach(component => {
      // Soportar tanto mayúsculas como minúsculas
      const type = (component.type || '').toUpperCase();
      
      if (type === 'HEADER' && component.text) {
        result.header = this.detectVariablesInText(component.text);
      }
      if (type === 'BODY' && component.text) {
        result.body = this.detectVariablesInText(component.text);
      }
      if (type === 'FOOTER' && component.text) {
        result.footer = this.detectVariablesInText(component.text);
      }
    });

    result.total = result.header.length + result.body.length + result.footer.length;
    return result;
  }

  /**
   * Detecta variables en un texto
   */
  detectVariablesInText(text) {
    const variableRegex = /\{\{(\d+)\}\}/g;
    const variables = [];
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
      variables.push({
        number: parseInt(match[1]),
        full: match[0],
      });
    }

    return variables;
  }

  /**
   * Construye el HTML del modal
   */
  buildModalHTML(variables, customFields) {
    const allVariables = [...variables.header, ...variables.body, ...variables.footer]
      .sort((a, b) => a.number - b.number);

    const variablesHTML = allVariables
      .map(variable => this.buildVariableRowHTML(variable, customFields))
      .join('');

    return `
      <div class="variable-mapper-modal">
        <div class="variable-mapper-header">
          <h3>📋 Mapear Variables de Plantilla</h3>
          <button class="close-mapper-btn" id="closeMapperBtn">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="variable-mapper-body">
          <p class="mapper-instructions">
            Selecciona qué dato se enviará en cada variable:
          </p>

          <div class="variables-list">
            ${variablesHTML}
          </div>

          <div class="mapper-preview">
            <h4>👁️ Vista Previa:</h4>
            <div class="preview-content" id="mapperPreview">
              <p style="color: #999;">Los valores se mostrarán aquí...</p>
            </div>
          </div>
        </div>

        <div class="variable-mapper-footer">
          <button class="btn btn-outline" id="cancelMapperBtn">Cancelar</button>
          <button class="btn btn-primary" id="saveMapperBtn">
            <i class="fas fa-check"></i> Guardar Mapeo
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Construye el HTML de una fila de variable
   */
  buildVariableRowHTML(variable, customFields) {
    const customFieldsOptions = customFields
      .map(field => `<option value="custom_field:${field.id}">${field.name}</option>`)
      .join('');

    return `
      <div class="variable-row" data-variable="${variable.number}">
        <div class="variable-label">
          <span class="variable-number">{{${variable.number}}}</span>
        </div>

        <div class="variable-select-group">
          <select class="variable-type-select" data-variable="${variable.number}">
            <option value="">-- Seleccionar tipo --</option>
            <optgroup label="Campos del Sistema">
              <option value="name">Nombre</option>
              <option value="last_name">Apellidos</option>
              <option value="phone">Teléfono</option>
            </optgroup>
            <optgroup label="Etiquetas" id="tagsOptgroup_${variable.number}">
            </optgroup>
            <optgroup label="Campos Personalizados" id="fieldsOptgroup_${variable.number}">
              ${customFieldsOptions}
            </optgroup>
          </select>

          <div class="variable-custom-field-select" style="display: none;">
            <select class="variable-custom-value-select" data-variable="${variable.number}">
              <option value="">-- Seleccionar valor --</option>
            </select>
          </div>
        </div>

        <div class="variable-preview">
          <span class="preview-value" data-variable="${variable.number}">-</span>
        </div>
      </div>
    `;
  }

  /**
   * Configura los eventos del modal
   */
  setupModalEvents(modal, variables, onSave) {
    // Cargar etiquetas dinámicamente
    this.loadAvailableTags(modal);

    // Cerrar modal - Verificar existencia
    const closeBtn = modal.querySelector('#closeMapperBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    const cancelBtn = modal.querySelector('#cancelMapperBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    // Cambio en selects de tipo
    modal.querySelectorAll('.variable-type-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const variableNum = parseInt(e.target.dataset.variable);
        const selectedValue = e.target.value;
        const row = e.target.closest('.variable-row');

        // Mostrar/ocultar select de campo personalizado
        const customFieldSelect = row.querySelector('.variable-custom-field-select');
        if (selectedValue.startsWith('custom_field:')) {
          customFieldSelect.style.display = 'block';
          // Cargar opciones del campo personalizado
          const fieldId = selectedValue.split(':')[1];
          this.loadCustomFieldValues(fieldId, row);
        } else {
          customFieldSelect.style.display = 'none';
        }

        // Guardar mapeo
        this.variableMapping[variableNum] = {
          type: selectedValue.split(':')[0],
          field: selectedValue.includes(':') ? selectedValue.split(':')[1] : selectedValue,
        };

        // Actualizar preview
        this.updatePreview(modal);
      });
    });

    // Cambio en selects de valor de campo personalizado
    modal.querySelectorAll('.variable-custom-value-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const variableNum = parseInt(e.target.dataset.variable);
        const selectedValue = e.target.value;

        // Actualizar mapeo
        if (this.variableMapping[variableNum]) {
          this.variableMapping[variableNum].customValue = selectedValue;
        }

        // Actualizar preview
        this.updatePreview(modal);
      });
    });

    // Guardar mapeo - Verificar existencia
    const saveBtn = modal.querySelector('#saveMapperBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        // Validar que todas las variables tengan mapeo
        const allVariables = [...variables.header, ...variables.body, ...variables.footer];
        const unmapped = allVariables.filter(v => !this.variableMapping[v.number]);

        if (unmapped.length > 0) {
          alert(`❌ Debes mapear todas las variables. Falta: ${unmapped.map(v => `{{${v.number}}}`).join(', ')}`);
          return;
        }

        // Llamar callback
        if (onSave) {
          onSave(this.variableMapping);
        }

        modal.remove();
      });
    }
  }

  /**
   * Carga las etiquetas disponibles dinámicamente
   */
  loadAvailableTags(modal) {
    // Obtener todas las etiquetas disponibles del sistema
    fetch('/api/tags')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data && Array.isArray(result.data)) {
          const tags = result.data;

          // Actualizar cada optgroup de etiquetas
          modal.querySelectorAll('[id^="tagsOptgroup_"]').forEach(optgroup => {
            optgroup.innerHTML = '';

            tags.forEach(tag => {
              const option = document.createElement('option');
              option.value = `tag:${tag.id}`;
              option.textContent = tag.name;
              optgroup.appendChild(option);
            });
          });
        }
      })
      .catch(error => {
        console.error('Error cargando etiquetas:', error);
      });
  }

  /**
   * Carga los valores de un campo personalizado
   */
  loadCustomFieldValues(fieldId, row) {
    const field = this.customFields.find(f => f.id == fieldId);
    if (!field) return;

    const select = row.querySelector('.variable-custom-value-select');
    select.innerHTML = '<option value="">-- Seleccionar valor --</option>';

    // Si el campo tiene valores predefinidos, mostrarlos
    if (field.values && Array.isArray(field.values)) {
      field.values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    } else {
      // Si no, permitir entrada libre
      const option = document.createElement('option');
      option.value = 'custom';
      option.textContent = 'Valor personalizado...';
      select.appendChild(option);
    }
  }

  /**
   * Actualiza la vista previa
   */
  updatePreview(modal) {
    const previewDiv = modal.querySelector('#mapperPreview');
    const rows = modal.querySelectorAll('.variable-row');

    let previewHTML = '<div class="preview-items">';

    rows.forEach(row => {
      const variableNum = parseInt(row.dataset.variable);
      const mapping = this.variableMapping[variableNum];

      if (!mapping) {
        previewHTML += `<div class="preview-item"><strong>{{${variableNum}}}</strong>: <span style="color: #999;">No mapeado</span></div>`;
        return;
      }

      let displayValue = this.getDisplayValue(mapping);
      previewHTML += `<div class="preview-item"><strong>{{${variableNum}}}</strong>: <span style="color: #10b981;">${displayValue}</span></div>`;
    });

    previewHTML += '</div>';
    previewDiv.innerHTML = previewHTML;
  }

  /**
   * Obtiene el valor a mostrar en la vista previa
   */
  getDisplayValue(mapping) {
    const typeLabels = {
      name: 'Nombre',
      last_name: 'Apellidos',
      phone: 'Teléfono',
    };

    if (mapping.type === 'tag') {
      // Buscar la etiqueta en el campo
      return mapping.field || 'Etiqueta';
    }

    if (mapping.type === 'custom_field') {
      const field = this.customFields.find(f => f.id == mapping.field);
      const fieldName = field ? field.name : 'Campo Desconocido';
      return fieldName;
    }

    return typeLabels[mapping.type] || mapping.type;
  }

  /**
   * Agrega estilos CSS al modal
   */
  addModalStyles() {
    if (document.getElementById('variableMapperStyles')) return;

    const style = document.createElement('style');
    style.id = 'variableMapperStyles';
    style.textContent = `
      .variable-mapper-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .variable-mapper-modal {
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        width: 85%;
        max-width: 500px;
        max-height: 65vh;
        display: flex;
        flex-direction: column;
      }

      .variable-mapper-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .variable-mapper-header h3 {
        margin: 0;
        font-size: 15px;
        color: #1f2937;
        font-weight: 600;
      }

      .close-mapper-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6b7280;
      }

      .close-mapper-btn:hover {
        color: #1f2937;
      }

      .variable-mapper-body {
        padding: 12px 16px;
        overflow-y: auto;
        flex: 1;
      }

      .mapper-instructions {
        margin: 0 0 12px 0;
        color: #6b7280;
        font-size: 12px;
      }

      .variables-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 12px;
      }

      .variable-row {
        display: grid;
        grid-template-columns: 65px 1fr 120px;
        gap: 10px;
        align-items: center;
        padding: 10px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }

      .variable-label {
        display: flex;
        align-items: center;
      }

      .variable-number {
        background: #6366f1;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 12px;
      }

      .variable-select-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .variable-type-select,
      .variable-custom-value-select {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
        cursor: pointer;
      }

      .variable-type-select:focus,
      .variable-custom-value-select:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .variable-preview {
        text-align: right;
      }

      .preview-value {
        font-size: 11px;
        color: #6b7280;
        font-style: italic;
      }

      .mapper-preview {
        background: #f3f4f6;
        padding: 10px;
        border-radius: 6px;
        margin-top: 12px;
      }

      .mapper-preview h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: #1f2937;
        font-weight: 600;
      }

      .preview-content {
        background: white;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
        max-height: 100px;
        overflow-y: auto;
      }

      .preview-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .preview-item {
        font-size: 11px;
        color: #374151;
      }

      .variable-mapper-footer {
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-outline {
        background: white;
        color: #374151;
        border: 1px solid #d1d5db;
      }

      .btn-outline:hover {
        background: #f9fafb;
      }

      .btn-primary {
        background: #6366f1;
        color: white;
      }

      .btn-primary:hover {
        background: #4f46e5;
      }
    `;

    document.head.appendChild(style);
  }
}

// Exportar para uso global
window.TemplateVariableMapper = TemplateVariableMapper;
