/**
 * Extensión de ChatLiveManager para manejar campos personalizados
 */

// Añadir métodos para campos personalizados a la clase ChatLiveManager
Object.assign(ChatLiveManager.prototype, {
    /**
     * Carga los campos personalizados del contacto actual
     */
    async loadCustomFields() {
        if (!this.currentConversation) {
            console.warn('No hay conversación actual para cargar campos');
            return;
        }
        
        const customFieldsContainer = document.getElementById('customFields');
        if (!customFieldsContainer) {
            console.error('Container customFields no encontrado');
            return;
        }
        
        try {
            // Obtener contact_id desde el phone
            const phone = this.currentConversation.phone;
            if (!phone) {
                console.warn('No se pudo obtener el phone del contacto');
                return;
            }
            
            // Buscar el contacto por teléfono
            const contactResponse = await fetch(`/api/contacts?search=${phone}&limit=1`);
            const contactData = await contactResponse.json();
            
            if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                console.warn('No se encontró el contacto con phone:', phone);
                // Aún así permitir añadir etiquetas, usar un ID temporal basado en el phone
                this.renderCustomFields([], phone);
                return;
            }
            
            const contactId = contactData.data[0].id;
            
            // Obtener campos personalizados del contacto
            const fieldsResponse = await fetch(`/api/contacts/${contactId}/custom-fields`);
            const fieldsData = await fieldsResponse.json();
            
            // Obtener definiciones de campos disponibles
            const defsResponse = await fetch(`/api/custom-fields`);
            const defsData = await defsResponse.json();
            
            if (fieldsData.success && defsData.success) {
                // Combinar campos existentes con definiciones disponibles
                const existingFieldIds = (fieldsData.data || []).map(f => f.field_id);
                const availableFields = (defsData.data || []).filter(def => !existingFieldIds.includes(def.id));
                
                const allFields = [...(fieldsData.data || []), ...availableFields];
                this.renderCustomFields(allFields, contactId);
            } else {
                console.warn('API devolvió error');
                this.renderCustomFields(fieldsData.data || [], contactId);
            }
        } catch (error) {
            console.error('Error cargando campos personalizados:', error);
            // En caso de error, no mostrar datos de ejemplo
            // Intentar obtener el contactId del teléfono
            try {
                const phone = this.currentConversation.phone;
                const contactResponse = await fetch(`/api/contacts?search=${phone}&limit=1`);
                const contactData = await contactResponse.json();
                if (contactData.success && contactData.data && contactData.data.length > 0) {
                    this.renderCustomFields([], contactData.data[0].id);
                } else {
                    this.renderCustomFields([], null);
                }
            } catch (e) {
                console.error('Error obteniendo contactId:', e);
                this.renderCustomFields([], null);
            }
        }
    },
    
    /**
     * Renderiza los campos personalizados
     */
    renderCustomFields(fields, contactId) {
        const container = document.getElementById('customFields');
        if (!container) {
            console.error('Container customFields no encontrado');
            return;
        }
        
        if (!fields || fields.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        
        // Filtrar solo campos con valor
        const fieldsWithValue = fields.filter(field => field.value !== undefined && field.value !== null && field.value !== '');
        
        container.innerHTML = fieldsWithValue.map(field => {
            const fieldName = field.name || field.id;
            const fieldValue = field.value;
            const fieldId = field.field_id || field.id;
            
            return `
                <span class="contact-custom-field-compact" data-field-id="${fieldId}" data-contact-id="${contactId}">
                    <strong>${fieldName}:</strong> ${fieldValue}
                    <button class="remove-custom-field-btn-compact" title="Eliminar valor">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `;
        }).join('');
        
        // Agregar eventos para editar campos al hacer click
        container.querySelectorAll('.contact-custom-field-compact').forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', (e) => {
                if (e.target.closest('.remove-custom-field-btn-compact')) {
                    return; // El botón X maneja su propio evento
                }
                
                const fieldId = span.dataset.fieldId;
                const fieldName = span.querySelector('strong').textContent.replace(':', '');
                const currentValue = span.textContent
                    .replace(fieldName + ':', '')
                    .replace('sin valor', '')
                    .trim();
                
                // Crear modal HTML en lugar de usar prompt()
                const modal = document.createElement('div');
                modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
                modal.innerHTML = `
                    <div style="background: white; padding: 20px; border-radius: 8px; min-width: 300px;">
                        <h3 style="margin-top: 0;">${fieldName}</h3>
                        <input type="text" id="editFieldInput" value="${currentValue}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
                        <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: flex-end;">
                            <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">Cancelar</button>
                            <button id="saveBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                const input = modal.querySelector('#editFieldInput');
                input.focus();
                input.select();
                
                const save = () => {
                    const newValue = input.value.trim();
                    modal.remove();
                    if (newValue !== currentValue) {
                        this.saveCustomFieldValue(contactId, fieldId, newValue).catch(err => {
                            console.error('Error guardando campo:', err);
                        });
                    }
                };
                
                modal.querySelector('#saveBtn').addEventListener('click', save);
                modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') modal.remove();
                });
            });
            
            // Event listener para el botón X (eliminar valor)
            const removeBtn = span.querySelector('.remove-custom-field-btn-compact');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fieldId = span.dataset.fieldId;
                    const contactId = span.dataset.contactId;
                    this.saveCustomFieldValue(contactId, fieldId, '').catch(err => {
                        console.error('Error eliminando campo:', err);
                    });
                });
            }
        });
    },
    
    /**
     * Hace un valor de campo editable inline
     */
    makeFieldValueEditable(valueEl) {
        const currentValue = valueEl.textContent;
        const fieldContainer = valueEl.closest('.custom-field');
        const fieldId = fieldContainer.dataset.fieldId;
        
        // Crear input para edición
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'inline-edit-input-value';
        
        // Reemplazar contenido con input
        valueEl.textContent = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();
        
        // Guardar al presionar Enter
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const newValue = input.value.trim();
                await this.saveFieldValueInline(fieldId, newValue, currentValue, fieldContainer);
            }
        });
        
        // Cancelar al presionar Escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                valueEl.textContent = currentValue;
            }
        });
        
        // Guardar al perder el foco
        input.addEventListener('blur', async () => {
            const newValue = input.value.trim();
            await this.saveFieldValueInline(fieldId, newValue, currentValue, fieldContainer);
        });
    },
    
    /**
     * Guarda el valor editado inline
     */
    async saveFieldValueInline(fieldId, newValue, oldValue, fieldContainer) {
        if (newValue === oldValue) {
            // Sin cambios, restaurar valor
            const valueEl = fieldContainer.querySelector('.custom-field-value');
            valueEl.textContent = oldValue;
            return;
        }
        
        if (!newValue) {
            // Valor vacío, eliminar el campo
            await this.deleteCustomFieldValue(fieldId);
            // Eliminar el elemento del DOM inmediatamente
            fieldContainer.remove();
            
            // Verificar si quedan campos
            const container = document.getElementById('customFields');
            if (container && container.children.length === 0) {
                container.innerHTML = '<p class="empty-state-text">No hay campos personalizados</p>';
            }
        } else {
            // Guardar nuevo valor
            await this.saveCustomField(fieldId, newValue);
            // Actualizar el valor en el DOM
            const valueEl = fieldContainer.querySelector('.custom-field-value');
            valueEl.textContent = newValue;
        }
    },
    
    /**
     * Muestra el modal para añadir un campo personalizado
     */
    async showAddCustomFieldModal() {
        if (!this.currentConversation) return;
        
        // Guardar referencia a 'this' para usarla en event listeners
        const self = this;
        
        // Obtener campos disponibles y valores actuales
        const availableFields = await this.getAvailableCustomFields();
        const currentFields = await this.getCurrentCustomFieldValues();
        
        const modal = document.createElement('div');
        modal.className = 'tag-modal-overlay';
        modal.innerHTML = `
            <div class="tag-modal">
                <div class="tag-modal-header">
                    <h3>Añadir campo personalizado</h3>
                    <button class="close-modal-btn" id="closeCustomFieldModalBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tag-modal-body">
                    <div class="tag-search">
                        <input type="text" id="customFieldSearch" class="tag-search-input" placeholder="Buscar campo...">
                    </div>
                    <div class="tag-list" id="customFieldsList">
                        ${availableFields.map(field => `
                            <div class="tag-item" data-field-id="${field.id || field.name}">
                                <div class="tag-name">${field.name}</div>
                                <button class="delete-tag-btn" onclick="event.stopPropagation()" title="Seleccionar">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="form-group" style="margin-top: 16px;">
                        <label for="customFieldValue">Valor:</label>
                        <input type="text" id="customFieldValue" class="form-control" placeholder="Introduce el valor del campo">
                        <small style="color: #6b7280; font-size: 12px; margin-top: 4px; display: block;">Deja vacío para eliminar el campo</small>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-outline" id="cancelAddCustomFieldBtn">Cancelar</button>
                        <button class="btn btn-primary" id="saveCustomFieldBtn">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const fieldsList = document.getElementById('customFieldsList');
        const fieldSearch = document.getElementById('customFieldSearch');
        const fieldValue = document.getElementById('customFieldValue');
        let selectedFieldId = availableFields[0]?.id || availableFields[0]?.name;
        
        // Verificar que los elementos existen antes de agregar listeners
        if (!fieldsList || !fieldSearch || !fieldValue) {
            console.error('Elementos del modal no encontrados');
            modal.remove();
            return;
        }
        
        // Búsqueda de campos
        fieldSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const items = fieldsList.querySelectorAll('.tag-item');
            items.forEach(item => {
                const name = item.querySelector('.tag-name').textContent.toLowerCase();
                item.style.display = name.includes(query) ? 'flex' : 'none';
            });
        });
        
        // Seleccionar campo
        fieldsList.querySelectorAll('.tag-item').forEach(item => {
            item.addEventListener('click', () => {
                fieldsList.querySelectorAll('.tag-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                selectedFieldId = item.dataset.fieldId;
                
                // Cargar valor existente
                const existingField = currentFields.find(f => f.field_id === selectedFieldId);
                fieldValue.value = existingField ? existingField.value : '';
            });
        });
        
        // Cargar valor inicial del primer campo
        const existingField = currentFields.find(f => f.field_id === selectedFieldId);
        fieldValue.value = existingField ? existingField.value : '';
        
        // Marcar primer campo como seleccionado
        const firstItem = fieldsList.querySelector('.tag-item');
        if (firstItem) firstItem.classList.add('selected');
        
        // Eventos para los botones - Verificar existencia
        const closeBtn = document.getElementById('closeCustomFieldModalBtn');
        const cancelBtn = document.getElementById('cancelAddCustomFieldBtn');
        const saveBtn = document.getElementById('saveCustomFieldBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const value = fieldValue.value.trim();
                
                if (!value) {
                    // Si el valor está vacío, eliminar el campo
                    await self.deleteCustomFieldValue(selectedFieldId);
                } else {
                    // Guardar o actualizar el campo
                    await self.saveCustomFieldValue(selectedFieldId, value);
                }
                
                modal.remove();
            });
        }
    },
    
    /**
     * Muestra modal para agregar valor a un campo personalizado
     */
    async showAddCustomFieldValueModal(contactId, fieldId, fieldName) {
        const modal = document.createElement('div');
        modal.className = 'tag-modal-overlay';
        modal.innerHTML = `
            <div class="tag-modal">
                <div class="tag-modal-header">
                    <h3>Agregar valor: ${fieldName}</h3>
                    <button class="close-modal-btn" id="closeValueModalBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tag-modal-body">
                    <div class="form-group">
                        <label>Valor:</label>
                        <input type="text" id="customFieldValueInput" class="form-control" placeholder="Introduce el valor">
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-outline" id="cancelValueModalBtn">Cancelar</button>
                        <button class="btn btn-primary" id="saveValueBtn">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Cerrar modal
        document.getElementById('closeValueModalBtn').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('cancelValueModalBtn').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('saveValueBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const value = document.getElementById('customFieldValueInput').value.trim();

            if (!value) {
                alert('El valor es requerido');
                return;
            }

            // Guardar el valor del campo
            await this.saveCustomFieldValue(contactId, fieldId, value);
            modal.remove();
        });
    },
    
    /**
     * Muestra el modal para crear un nuevo campo personalizado
     */
    async showCreateCustomFieldModal() {
        const modal = document.createElement('div');
        modal.className = 'tag-modal-overlay';
        modal.innerHTML = `
            <div class="tag-modal">
                <div class="tag-modal-header">
                    <h3>Crear campo personalizado</h3>
                    <button class="close-modal-btn" id="closeCreateFieldBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tag-modal-body">
                    <div class="form-group">
                        <label>Nombre</label>
                        <input type="text" id="newCustomFieldName" class="form-control" placeholder="Introducir nombre del campo">
                    </div>
                    <div class="form-group">
                        <label>Tipo</label>
                        <select id="newCustomFieldType" class="form-control">
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="email">Email</option>
                            <option value="date">Fecha</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Descripción (opcional)</label>
                        <input type="text" id="newCustomFieldDesc" class="form-control" placeholder="Descripción del campo">
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-outline" id="cancelCreateFieldBtn">Cancelar</button>
                        <button class="btn btn-primary" id="saveNewCustomFieldBtn">Crear</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Guardar referencia a 'this' para usarla en el event listener
        const self = this;

        // Event delegation para los botones del modal
        modal.addEventListener('click', async (e) => {
            if (e.target.closest('#closeCreateFieldBtn') || e.target.closest('#cancelCreateFieldBtn')) {
                modal.remove();
                return;
            }

            if (e.target.closest('#saveNewCustomFieldBtn')) {
                e.preventDefault();
                const name = document.getElementById('newCustomFieldName').value.trim();
                const type = document.getElementById('newCustomFieldType').value;
                const description = document.getElementById('newCustomFieldDesc').value.trim();

                if (!name) {
                    alert('El nombre es requerido');
                    return;
                }

                // Validar que no exista un campo con el mismo nombre
                try {
                    const response = await fetch('/api/custom-fields');
                    const data = await response.json();

                    if (data.success) {
                        const existingField = data.data.find(field =>
                            field.name.toLowerCase() === name.toLowerCase()
                        );

                        if (existingField) {
                            alert(`Ya existe un campo con el nombre "${name}"`);
                            return;
                        }
                    }

                    const result = await self.createCustomField(name, type, description);
                    if (result) {
                        // Limpiar el formulario y cerrar el modal
                        modal.remove();
                        alert('✅ Campo creado correctamente');
                    }
                } catch (error) {
                    console.error('Error creando campo:', error);
                    alert('Error creando el campo');
                }
            }
        });
    },
    
    /**
     * Muestra el formulario para crear un nuevo campo personalizado
     */
    showNewCustomFieldForm(parentModal) {
        const formContainer = document.createElement('div');
        formContainer.className = 'custom-field-form';
        formContainer.innerHTML = `
            <h4>Nuevo campo personalizado</h4>
            <div class="form-group">
                <label for="newFieldName">Nombre:</label>
                <input type="text" id="newFieldName" class="form-control" placeholder="Nombre del campo">
            </div>
            <div class="form-group">
                <label for="newFieldType">Tipo:</label>
                <select id="newFieldType" class="form-control">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                </select>
            </div>
            <div class="form-group">
                <label for="newFieldDescription">Descripción:</label>
                <input type="text" id="newFieldDescription" class="form-control" placeholder="Descripción (opcional)">
            </div>
            <div class="form-actions">
                <button class="btn btn-outline" id="cancelNewFieldBtn">Cancelar</button>
                <button class="btn btn-primary" id="saveNewFieldBtn">Crear</button>
            </div>
        `;
        
        // Añadir al modal existente
        const modalBody = parentModal.querySelector('.custom-fields-modal-body');
        modalBody.appendChild(formContainer);
        
        // Eventos para los botones
        document.getElementById('cancelNewFieldBtn').addEventListener('click', () => {
            formContainer.remove();
        });
        
        document.getElementById('saveNewFieldBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newFieldName').value.trim();
            const type = document.getElementById('newFieldType').value;
            const description = document.getElementById('newFieldDescription').value.trim();
            
            if (!name) {
                alert('El nombre del campo es obligatorio');
                return;
            }
            
            // Crear el campo
            await this.createCustomField(name, type, description);
            formContainer.remove();
            // Recargar la tabla de campos
            await this.loadCustomFieldsOptions();
        });
    },
    
    /**
     * Obtiene los valores actuales de campos personalizados del contacto
     */
    async getCurrentCustomFieldValues() {
        if (!this.currentConversation) {
            console.error('No hay conversación actual');
            return [];
        }
        
        try {
            const phone = this.currentConversation.phone;
            const contactResponse = await fetch(`/api/contacts?search=${phone}&limit=1`);
            const contactData = await contactResponse.json();
            
            if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                return [];
            }
            
            const contactId = contactData.data[0].id;
            const response = await fetch(`/api/contacts/${contactId}/custom-fields`);
            const data = await response.json();
            
            if (data.success) {
                return data.data || [];
            }
        } catch (error) {
            console.error('Error obteniendo campos del contacto:', error);
            return [];
        }
    },
    
    /**
     * Obtiene los campos personalizados disponibles
     */
    async getAvailableCustomFields() {
        try {
            const response = await fetch('/api/custom-fields');
            const data = await response.json();
            
            if (data.success) {
                return data.data || [];
            }
        } catch (error) {
            console.error('Error obteniendo campos personalizados:', error);
        }
        
        // Si hay error o no hay datos, devolver array vacío
        return [];
    },
    
    /**
     * Guarda un campo personalizado para el contacto actual
     */
    async saveCustomField(fieldId, value) {
        if (!this.currentConversation) return;
        
        try {
            // Obtener contact_id
            const phone = this.currentConversation.phone;
            const contactResponse = await fetch(`/api/contacts?search=${phone}&limit=1`);
            const contactData = await contactResponse.json();
            
            if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                console.warn('No se encontró el contacto');
                return;
            }
            
            const contactId = contactData.data[0].id;
            
            // Guardar el campo personalizado
            const response = await fetch(`/api/contacts/${contactId}/custom-fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_id: fieldId, value })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Recargar los campos
                this.loadCustomFields();
            } else {
                console.error('Error guardando campo personalizado:', data.error);
                // No usar simulación, solo recargar
                this.loadCustomFields();
            }
        } catch (error) {
            console.error('Error guardando campo personalizado:', error);
            // No usar simulación, solo recargar
            this.loadCustomFields();
        }
    },
    
    /**
     * Guarda un valor de campo personalizado para un contacto específico
     */
    async saveCustomFieldValue(contactId, fieldId, value) {
        try {
            const response = await fetch(`/api/contacts/${contactId}/custom-fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_id: fieldId, value })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Campo guardado correctamente');
                // Recargar los campos
                this.loadCustomFields();
            } else {
                console.error('Error guardando valor del campo:', data.error);
                alert('Error guardando el campo: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error guardando valor del campo personalizado:', error);
            alert('Error guardando el campo: ' + error.message);
        }
    },
    
    /**
     * Crea un nuevo campo personalizado
     */
    async createCustomField(name, type, description) {
        try {
            const response = await fetch('/api/custom-fields', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, description })
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                console.error('Error creando campo personalizado:', data.error);
                alert('Error creando el campo personalizado');
            }
        } catch (error) {
            console.error('Error creando campo personalizado:', error);
            alert('Error creando el campo personalizado');
        }
        
        return false;
    },
    
    /**
     * Carga la tabla de campos personalizados
     */
    async loadCustomFieldsTable() {
        const tableBody = document.getElementById('userFieldsTableBody');
        if (!tableBody) return;
        
        try {
            const fields = await this.getAvailableCustomFields();
            
            if (fields.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="empty-custom-fields">No hay campos personalizados</td></tr>';
                return;
            }
            
            tableBody.innerHTML = fields.map(field => `
                <tr data-field-id="${field.id || field.name}">
                    <td><input type="checkbox" class="field-checkbox"></td>
                    <td class="editable-field-name" title="Haz clic para editar">${field.name}</td>
                    <td>${field.type || 'Text'}</td>
                    <td class="editable-field-desc" title="Haz clic para editar">${field.description || 'Añadir descripción'}</td>
                </tr>
            `).join('');
            
            // Añadir eventos a los checkboxes
            tableBody.querySelectorAll('.field-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const modal = document.querySelector('.custom-fields-modal-overlay');
                    this.updateDeleteButton(modal);
                });
            });
            
            // Añadir eventos para edición inline de nombre
            tableBody.querySelectorAll('.editable-field-name').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    this.makeFieldEditable(e.target, 'name');
                });
            });
            
            // Añadir eventos para edición inline de descripción
            tableBody.querySelectorAll('.editable-field-desc').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    this.makeFieldEditable(e.target, 'description');
                });
            });
        } catch (error) {
            console.error('Error cargando tabla de campos personalizados:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="empty-custom-fields">Error cargando campos</td></tr>';
        }
    },
    
    /**
     * Hace un campo editable inline
     */
    makeFieldEditable(cell, fieldType) {
        const currentValue = cell.textContent;
        const row = cell.closest('tr');
        const fieldId = row.dataset.fieldId;
        
        // Crear input para edición
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue === 'Añadir descripción' ? '' : currentValue;
        input.className = 'inline-edit-input';
        
        // Reemplazar contenido con input
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // Guardar al presionar Enter
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const newValue = input.value.trim();
                await this.saveFieldEdit(fieldId, fieldType, newValue);
                cell.textContent = newValue || 'Añadir descripción';
            }
        });
        
        // Cancelar al presionar Escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cell.textContent = currentValue;
            }
        });
        
        // Guardar al perder el foco
        input.addEventListener('blur', async () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== currentValue) {
                await this.saveFieldEdit(fieldId, fieldType, newValue);
                cell.textContent = newValue;
            } else {
                cell.textContent = currentValue;
            }
        });
    },
    
    // NOTA: El método saveFieldEdit ha sido movido a chat-live.js para evitar conflictos
    // Este método era para editar campos en la tabla de campos personalizados
    // Ahora la edición de nombre/apellido se maneja directamente en chat-live.js
    
    /**
     * Elimina un campo personalizado (sin confirmación)
     */
    async deleteCustomField(fieldId) {
        try {
            const response = await fetch(`/api/custom-fields/${fieldId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Recargar la tabla
                this.loadCustomFieldsTable();
            } else {
                console.error('Error eliminando campo:', data.error);
                alert('Error eliminando el campo personalizado');
            }
        } catch (error) {
            console.error('Error eliminando campo personalizado:', error);
            // Simulación para desarrollo
            alert(`Campo ${fieldId} eliminado (simulación)`);
            this.loadCustomFieldsTable();
        }
    },
    
    /**
     * Elimina un campo personalizado completamente de todos los contactos
     */
    async deleteCustomFieldGlobally(fieldId, fieldName, modal) {
        const confirmed = confirm(`¿Eliminar completamente el campo "${fieldName}"?\n\nEsta acción eliminará el campo de TODOS los contactos y no se puede deshacer.`);

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/custom-fields/${fieldId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // Mostrar notificación de éxito
                this.showNotification('Campo eliminado', `El campo "${fieldName}" ha sido eliminado completamente`);

                // Recargar los campos del contacto actual (sin esperar)
                this.loadCustomFields();

                // Recargar la lista de campos en el modal (sin cerrarlo)
                const fieldList = modal.querySelector('#fieldList');
                if (fieldList) {
                    // Obtener todos los campos actualizados
                    const fieldsResponse = await fetch('/api/custom-fields');
                    const fieldsData = await fieldsResponse.json();
                    const fields = fieldsData.data || [];

                    // Si no hay más campos, cerrar el modal
                    if (fields.length === 0) {
                        modal.remove();
                        return;
                    }

                    // Actualizar la lista de campos en el modal
                    fieldList.innerHTML = fields.map(field => `
                        <div class="tag-item" data-field-id="${field.id}" data-field-name="${field.name.toLowerCase()}">
                            <span class="tag-name">${field.name}</span>
                            <span class="tag-folder">${field.type}</span>
                            <button class="delete-tag-btn" data-field-id="${field.id}" data-field-name="${field.name}" title="Eliminar campo personalizado completamente">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('');

                    // Re-vincular eventos a los botones de eliminar
                    const newDeleteButtons = fieldList.querySelectorAll('.delete-tag-btn');
                    newDeleteButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const newFieldId = button.dataset.fieldId;
                            const newFieldName = button.dataset.fieldName;
                            // Eliminar el campo globalmente
                            this.deleteCustomFieldGlobally(newFieldId, newFieldName, modal);
                        });
                    });
                }
            } else {
                alert('Error eliminando el campo personalizado');
            }
        } catch (error) {
            console.error('Error eliminando campo personalizado:', error);
            alert('Error eliminando el campo personalizado');
        }
    },
    
    /**
     * Muestra una notificación
     */
    showNotification(title, message) {
        // Implementación simple con alert (puedes mejorar esto con un toast)
        // Notificación mostrada al usuario
    },
    
    /**
     * Actualiza la visibilidad del botón de eliminar seleccionados
     */
    updateDeleteButton(modal) {
        if (!modal) return;
        
        const deleteBtn = modal.querySelector('#deleteSelectedFieldsBtn');
        const checkboxes = modal.querySelectorAll('#userFieldsTableBody .field-checkbox:checked');
        
        if (deleteBtn) {
            if (checkboxes.length > 0) {
                deleteBtn.style.display = 'inline-flex';
                deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Eliminar seleccionados (${checkboxes.length})`;
            } else {
                deleteBtn.style.display = 'none';
            }
        }
    },
    
    /**
     * Elimina los campos seleccionados
     */
    async deleteSelectedFields(modal) {
        const checkboxes = modal.querySelectorAll('#userFieldsTableBody .field-checkbox:checked');
        const selectedFields = Array.from(checkboxes).map(cb => {
            const row = cb.closest('tr');
            return {
                id: row.dataset.fieldId,
                name: row.querySelector('td:nth-child(2)').textContent
            };
        });
        
        if (selectedFields.length === 0) {
            return; // No hacer nada si no hay campos seleccionados
        }
        
        // Solo pedir confirmación si se seleccionan múltiples campos
        if (selectedFields.length > 1) {
            if (!confirm(`¿Estás seguro de eliminar ${selectedFields.length} campo(s)?`)) {
                return;
            }
        }
        
        // Eliminar campos sin mostrar alertas de éxito
        for (const field of selectedFields) {
            try {
                await fetch(`/api/custom-fields/${field.id}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error(`Error eliminando campo ${field.id}:`, error);
            }
        }
        
        // Recargar la tabla sin alertas
        this.loadCustomFieldsTable();
        
        // Recargar los campos personalizados del contacto actual para actualizar la vista
        if (this.currentConversation) {
            this.loadCustomFields();
        }
        
        // Desmarcar "seleccionar todos"
        const selectAllCheckbox = modal.querySelector('#selectAllFields');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        // Ocultar botón de eliminar
        this.updateDeleteButton(modal);
    },
    
    /**
     * Guarda un valor de campo personalizado
     */
    async saveCustomFieldValue(contactId, fieldId, value) {
        try {
            const response = await fetch(`/api/contacts/${contactId}/custom-fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_id: fieldId, value })
            });
            
            const data = await response.json();
            if (data.success) {
                // Recargar campos para reflejar cambios
                await this.loadCustomFields();
            } else {
                console.error('Error guardando valor de campo:', data.error);
            }
        } catch (error) {
            console.error('Error guardando valor de campo:', error);
        }
    },
    
    /**
     * Devuelve campos personalizados de ejemplo
     */
    getDemoCustomFields() {
        return [
            { id: 'cedula', name: 'Cédula de Ciudadanía', value: '222222222222' },
            { id: 'ciudad', name: 'Ciudad', value: 'Cartagena - bolivar' },
            { id: 'cantidad_boletos', name: 'Cantidad de Boletos', value: '20' },
            { id: 'id_referencia', name: 'ID_Referencia', value: '1060' }
        ];
    }
});
