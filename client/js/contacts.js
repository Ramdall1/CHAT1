/**
 * Contact Manager - Gestión de contactos
 */
class ContactManager {
    constructor() {
        this.contacts = [];
        this.tags = [];
        this.customFields = [];
        this.contactCustomFields = {}; // Valores de campos personalizados por contacto
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalContacts = 0;
        this.searchQuery = '';
        this.filters = {
            tag: '',
            customField: ''
        };
        this.sortField = 'last_message_at'; // Default sort field (última actividad)
        this.sortDirection = 'asc'; // 'asc' or 'desc' - menor tiempo primero (más reciente)
        // Asegurar que selectedContacts sea un Set
        this.selectedContacts = new Set();
        // console.log('Constructor: selectedContacts inicializado como Set:', this.selectedContacts instanceof Set);
        this.editingContact = null;
        this.editingCustomField = null;
        
        this.elements = {};
        this.init();
    }

    /**
     * Inicializa el gestor
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadTags();
        await this.loadCustomFieldsOptions();
        await this.loadContacts();
    }

    /**
     * Cachea elementos del DOM
     */
    cacheElements() {
        this.elements = {
            // Stats
            totalContactsCount: document.getElementById('totalContactsCount'),
            totalGroupsCount: document.getElementById('totalGroupsCount'),
            
            // Search and filters
            searchInput: document.getElementById('searchContacts'),
            clearSearch: document.getElementById('clearSearch'),
            tagsFilter: document.getElementById('tagsFilter'),
            customFieldsFilter: document.getElementById('customFieldsFilter'),
            
            // Actions
            addContactBtn: document.getElementById('addContactBtn'),
            exportContacts: document.getElementById('exportContacts'),
            importContacts: document.getElementById('importContacts'),
            selectAllContacts: document.getElementById('selectAllContacts'),
            
            // Bulk Actions
            bulkActionsBar: document.getElementById('bulkActionsBar'),
            selectedCount: document.getElementById('selectedCount'),
            bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
            cancelSelectionBtn: document.getElementById('cancelSelectionBtn'),
            
            // Table
            contactsTableBody: document.getElementById('contactsTableBody'),
            
            // Pagination
            paginationStart: document.getElementById('paginationStart'),
            paginationEnd: document.getElementById('paginationEnd'),
            paginationTotal: document.getElementById('paginationTotal'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageNumbers: document.getElementById('pageNumbers'),
            
            // Contact Modal
            contactModal: document.getElementById('contactModal'),
            contactModalOverlay: document.getElementById('contactModalOverlay'),
            closeContactModal: document.getElementById('closeContactModal'),
            contactModalTitle: document.getElementById('contactModalTitle'),
            contactForm: document.getElementById('contactForm'),
            cancelContactForm: document.getElementById('cancelContactForm'),
            saveContactBtn: document.getElementById('saveContactBtn'),
            
            // Contact Form Fields
            contactName: document.getElementById('contactName'),
            contactSurname: document.getElementById('contactSurname'),
            contactPhone: document.getElementById('contactPhone'),
            contactEmail: document.getElementById('contactEmail'),
            contactGroups: document.getElementById('contactGroups'),
            contactNotes: document.getElementById('contactNotes'),
            
            // Import Modal
            importModal: document.getElementById('importModal'),
            importModalOverlay: document.getElementById('importModalOverlay'),
            closeImportModal: document.getElementById('closeImportModal'),
            importFile: document.getElementById('importFile'),
            cancelImport: document.getElementById('cancelImport'),
            confirmImport: document.getElementById('confirmImport'),

            // Custom Fields Modal
            manageCustomFields: document.getElementById('manageCustomFields'),
            customFieldsModal: document.getElementById('customFieldsModal'),
            customFieldsModalOverlay: document.getElementById('customFieldsModalOverlay'),
            closeCustomFieldsModal: document.getElementById('closeCustomFieldsModal'),
            addCustomFieldBtn: document.getElementById('addCustomFieldBtn'),
            customFieldsList: document.getElementById('customFieldsList'),

            // Custom Field Modal
            customFieldModal: document.getElementById('customFieldModal'),
            customFieldModalOverlay: document.getElementById('customFieldModalOverlay'),
            closeCustomFieldModal: document.getElementById('closeCustomFieldModal'),
            customFieldModalTitle: document.getElementById('customFieldModalTitle'),
            customFieldForm: document.getElementById('customFieldForm'),
            customFieldName: document.getElementById('customFieldName'),
            customFieldType: document.getElementById('customFieldType'),
            customFieldDescription: document.getElementById('customFieldDescription'),
            cancelCustomFieldForm: document.getElementById('cancelCustomFieldForm'),
            saveCustomFieldBtn: document.getElementById('saveCustomFieldBtn'),

            // Contact Custom Fields
            contactCustomFields: document.getElementById('contactCustomFields')
        };
    }

    /**
     * Vincula eventos a elementos del DOM
     */
    bindEvents() {
        // Search
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('keyup', (e) => {
                this.searchQuery = e.target.value;
                this.currentPage = 1;
                this.loadContacts();
            });
        }

        if (this.elements.clearSearch) {
            this.elements.clearSearch.addEventListener('click', () => {
                this.searchQuery = '';
                this.elements.searchInput.value = '';
                this.elements.clearSearch.style.display = 'none';
                this.loadContacts();
            });
        }

        // Filters
        if (this.elements.tagsFilter) {
            this.elements.tagsFilter.addEventListener('change', (e) => {
                this.filters.tag = e.target.value;
                this.loadContacts();
            });
        }

        if (this.elements.customFieldsFilter) {
            this.elements.customFieldsFilter.addEventListener('change', (e) => {
                this.filters.customField = e.target.value;
                this.loadContacts();
            });
        }

        // Select All - Select ALL contacts, not just current page
        if (this.elements.selectAllContacts) {
            this.elements.selectAllContacts.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    // Select ALL contacts
                    await this.selectAllContacts();
                } else {
                    // Deselect all
                    this.clearSelection();
                }
            });
        }

        // Bulk Actions
        if (this.elements.bulkDeleteBtn) {
            this.elements.bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteContacts());
        }
        if (this.elements.cancelSelectionBtn) {
            this.elements.cancelSelectionBtn.addEventListener('click', () => this.clearSelection());
        }

        // Actions
        if (this.elements.addContactBtn) {
            this.elements.addContactBtn.addEventListener('click', () => this.showAddContactModal());
        }
        if (this.elements.exportContacts) {
            this.elements.exportContacts.addEventListener('click', () => this.exportContacts());
        }
        if (this.elements.importContacts) {
            this.elements.importContacts.addEventListener('click', () => this.showImportModal());
        }
        if (this.elements.manageCustomFields) {
            this.elements.manageCustomFields.addEventListener('click', () => this.showCustomFieldsModal());
        }
        
        // Pagination
        if (this.elements.prevPage) {
            this.elements.prevPage.addEventListener('click', () => this.changePage(this.currentPage - 1));
        }
        if (this.elements.nextPage) {
            this.elements.nextPage.addEventListener('click', () => this.changePage(this.currentPage + 1));
        }
        
        // Contact Modal
        if (this.elements.closeContactModal) {
            this.elements.closeContactModal.addEventListener('click', () => this.hideContactModal());
        }
        if (this.elements.contactModalOverlay) {
            this.elements.contactModalOverlay.addEventListener('click', () => this.hideContactModal());
        }
        if (this.elements.cancelContactForm) {
            this.elements.cancelContactForm.addEventListener('click', () => this.hideContactModal());
        }
        if (this.elements.contactForm) {
            this.elements.contactForm.addEventListener('submit', (e) => this.handleContactFormSubmit(e));
        }
        
        // Import Modal
        if (this.elements.closeImportModal) {
            this.elements.closeImportModal.addEventListener('click', () => this.hideImportModal());
        }
        if (this.elements.importModalOverlay) {
            this.elements.importModalOverlay.addEventListener('click', () => this.hideImportModal());
        }
        if (this.elements.cancelImport) {
            this.elements.cancelImport.addEventListener('click', () => this.hideImportModal());
        }
        if (this.elements.importFile) {
            this.elements.importFile.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (this.elements.confirmImport) {
            this.elements.confirmImport.addEventListener('click', () => this.handleImport());
        }

        // Custom Fields Modal
        if (this.elements.closeCustomFieldsModal) {
            this.elements.closeCustomFieldsModal.addEventListener('click', () => this.hideCustomFieldsModal());
        }
        if (this.elements.customFieldsModalOverlay) {
            this.elements.customFieldsModalOverlay.addEventListener('click', () => this.hideCustomFieldsModal());
        }
        if (this.elements.addCustomFieldBtn) {
            this.elements.addCustomFieldBtn.addEventListener('click', () => this.showAddCustomFieldModal());
        }

        // Custom Field Modal
        if (this.elements.closeCustomFieldModal) {
            this.elements.closeCustomFieldModal.addEventListener('click', () => this.hideCustomFieldModal());
        }
        if (this.elements.customFieldModalOverlay) {
            this.elements.customFieldModalOverlay.addEventListener('click', () => this.hideCustomFieldModal());
        }
        if (this.elements.cancelCustomFieldForm) {
            this.elements.cancelCustomFieldForm.addEventListener('click', () => this.hideCustomFieldModal());
        }
        if (this.elements.customFieldForm) {
            this.elements.customFieldForm.addEventListener('submit', (e) => this.handleCustomFieldFormSubmit(e));
        }

        // Initialize sorting after DOM is ready
        setTimeout(() => this.initializeSorting(), 100);
    }

    /**
     * Inicializa la funcionalidad de ordenamiento
     */
    initializeSorting() {
        // Make table headers clickable for sorting
        const tableHeaders = document.querySelectorAll('.contacts-table th[data-sort]');
        tableHeaders.forEach(header => {
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                this.handleSort(field);
            });
        });

        // Update visual indicators initially
        this.updateSortIndicators();
    }

    /**
     * Maneja el clic en un header para ordenar
     */
    handleSort(field) {
        if (this.sortField === field) {
            // Toggle direction if same field
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to ascending
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        // Reset to first page when sorting changes
        this.currentPage = 1;

        // Reload contacts with new sorting
        this.loadContacts();

        // Update visual indicators
        this.updateSortIndicators();
    }

    /**
     * Actualiza los indicadores visuales de ordenamiento
     */
    updateSortIndicators() {
        // Remove existing indicators
        document.querySelectorAll('.contacts-table th .sort-indicator').forEach(indicator => {
            indicator.remove();
        });

        // Add indicator to current sort field
        const currentHeader = document.querySelector(`.contacts-table th[data-sort="${this.sortField}"]`);
        if (currentHeader) {
            const indicator = document.createElement('i');
            indicator.className = `sort-indicator fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'}`;
            indicator.style.marginLeft = '5px';
            indicator.style.fontSize = '0.8em';
            indicator.style.opacity = '0.7';
            currentHeader.appendChild(indicator);
        }
    }

    /**
     * Carga los contactos del servidor
     */
    async loadContacts() {
        try {
            this.elements.contactsTableBody.innerHTML = '<tr><td colspan="7" class="loading-state">Cargando contactos...</td></tr>';
            
            try {
                // Construir params de consulta
                const params = new URLSearchParams();
                params.append('page', this.currentPage);
                params.append('limit', this.pageSize);
                
                if (this.searchQuery) {
                    params.append('search', this.searchQuery);
                }
                
                if (this.filters.tag) {
                    params.append('tag', this.filters.tag);
                }
                
                if (this.filters.customField) {
                    params.append('custom_field', this.filters.customField);
                }

                // Sorting parameters
                params.append('sort_by', this.sortField);
                params.append('sort_order', this.sortDirection);

                // Llamar a la API
                const response = await fetch(`/api/contacts?${params}`);
                const data = await response.json();
                
                // console.log('📋 Respuesta de API de contactos:', data);
                
                if (data.success) {
                    this.contacts = data.data || [];  // La API devuelve data.data no data.contacts
                    this.totalContacts = data.pagination?.total || data.total || 0;
                    // console.log(`✅ ${this.contacts.length} contactos cargados de ${this.totalContacts} total`);
                    
                    // Cargar últimos mensajes para cada contacto
                    await this.loadLastMessages();
                } else {
                    console.error('❌ API devolvió error:', data.error || data.message);
                    this.showErrorState(data.error || data.message || 'Error desconocido');
                }
            } catch (apiError) {
                console.error('❌ Error de API:', apiError);
                this.showErrorState('Error de conexión: ' + apiError.message);
            }
            
            // Renderizar la interfaz
            this.renderContacts();
            this.updatePagination();
            this.updateStats();
        } catch (error) {
            console.error('Error fatal cargando contactos:', error);
            this.showErrorState('Error al cargar contactos: ' + error.message);
        }
    }
    
    /**
     * Carga los últimos mensajes enviados por los contactos
     */
    async loadLastMessages() {
        try {
            // Obtener las conversaciones activas
            const response = await fetch('/api/chat-live/conversations');
            const data = await response.json();
            
            if (data.success && data.data) {
                // Crear un mapa de teléfono -> último mensaje del contacto
                const messageMap = {};
                data.data.forEach(conv => {
                    if (conv.phone && conv.lastMessage) {
                        // Asumimos que lastMessage contiene el último mensaje del contacto
                        // ya que la API no especifica la dirección del mensaje
                        messageMap[conv.phone] = {
                            text: conv.lastMessage,
                            time: conv.lastMessageTime,
                            isFromContact: true // Asumimos que es del contacto
                        };
                    }
                });
                
                // Asignar los mensajes a los contactos correspondientes
                this.contacts = this.contacts.map(contact => {
                    const phone = contact.phone_number || contact.phone;
                    if (phone && messageMap[phone]) {
                        // console.log(`🕒 Contacto ${contact.name}: last_message_at = ${messageMap[phone].time}`);
                        return {
                            ...contact,
                            last_message: messageMap[phone].text,
                            last_message_at: messageMap[phone].time,
                            is_from_contact: messageMap[phone].isFromContact
                        };
                    }
                    return contact;
                });
                
                // console.log('✅ Mensajes de contactos cargados');
            }
        } catch (error) {
            console.error('Error cargando últimos mensajes:', error);
        }
    }
    
    /**
     * Usa datos de ejemplo cuando la API falla
     */
    useDemoData() {
        this.contacts = [
            {
                id: 1,
                name: 'Juan Pérez',
                phone_number: '+573113705258',
                email: 'juan@ejemplo.com',
                is_blocked: false,
                last_message_at: new Date().toISOString(),
                groups: [{ id: 1, name: 'Clientes' }]
            },
            {
                id: 2,
                name: 'María López',
                phone_number: '+573113705259',
                email: 'maria@ejemplo.com',
                is_blocked: false,
                last_message_at: new Date(Date.now() - 86400000).toISOString(),
                groups: [{ id: 2, name: 'Proveedores' }]
            },
            {
                id: 3,
                name: 'Carlos Rodríguez',
                phone_number: '+573113705260',
                email: null,
                is_blocked: true,
                last_message_at: null,
                groups: []
            }
        ];
        
        this.totalContacts = this.contacts.length;
    }


    /**
     * Carga los campos personalizados disponibles
     */
    async loadCustomFieldsOptions() {
        try {
            const response = await fetch('/api/custom-fields');
            const data = await response.json();
            
            // console.log('📋 Respuesta de API de campos personalizados:', data);

            if (data.success) {
                this.customFields = data.data || [];
                this.updateCustomFieldsFilter();
                // console.log(`✅ ${this.customFields.length} campos personalizados cargados`);
            }
        } catch (error) {
            console.error('❌ Error cargando campos personalizados:', error);
            this.customFields = [];
        }
    }


    /**
     * Actualiza el filtro de campos personalizados
     */
    updateCustomFieldsFilter() {
        if (!this.elements.customFieldsFilter) return;
        
        const options = this.customFields.map(field => `
            <option value="${field.id}">${this.escapeHtml(field.name)}</option>
        `).join('');
        
        this.elements.customFieldsFilter.innerHTML = `
            <option value="">Campos</option>
            ${options}
        `;
    }

    /**
     * Carga las etiquetas
     */
    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            
            // console.log('🏷️ Respuesta de API de etiquetas:', data);

            if (data.success) {
                this.tags = data.data || [];  // La API devuelve data.data
                this.renderTagsFilter();
                // console.log(`✅ ${this.tags.length} etiquetas cargadas`);
            }
        } catch (error) {
            console.error('❌ Error cargando etiquetas:', error);
            this.tags = [];  // Etiquetas vacío si falla
        }
    }

    /**
     * Renderiza el filtro de etiquetas
     */
    renderTagsFilter() {
        if (!this.elements.tagsFilter) return;
        
        const options = this.tags.map(tag => `
            <option value="${tag.id}">${this.escapeHtml(tag.name)}</option>
        `).join('');
        
        this.elements.tagsFilter.innerHTML = `
            <option value="">Todas las etiquetas</option>
            ${options}
        `;
    }

    /**
     * Renderiza los contactos en la tabla
     */
    renderContacts() {
        if (this.contacts.length === 0) {
            this.showEmptyState();
            return;
        }

        const html = this.contacts.map(contact => this.getContactRowHTML(contact)).join('');
        this.elements.contactsTableBody.innerHTML = html;
        
        // Bind events for individual rows
        this.bindContactRowEvents();
    }

    /**
     * Genera el HTML para una fila de contacto
     */
    getContactRowHTML(contact) {
        const initials = this.getInitials(contact.name);
        const avatar = contact.avatar || '';
        const lastActivity = contact.last_message_at || contact.last_interaction;
        const isFromContact = contact.is_from_contact === true;
        
        // Formatear la última actividad con formato compacto
        let lastActivityFormatted = 'Sin actividad';
        if (lastActivity) {
            // Parsear la fecha correctamente (formato: "YYYY-MM-DD HH:MM:SS")
            // Reemplazar espacio por 'T' para que sea ISO 8601 compatible
            const isoDate = lastActivity.includes('T') ? lastActivity : lastActivity.replace(' ', 'T');
            const date = new Date(isoDate);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            
            // console.log(`🕒 ${contact.name}: lastActivity=${lastActivity}, parsed=${date.toISOString()}, now=${now.toISOString()}, diffMs=${diffMs}, diffMins=${diffMins}`);
            
            if (diffMins < 1) {
                // Menos de 1 minuto
                lastActivityFormatted = 'Ahora';
            } else if (diffMins < 60) {
                // Menos de una hora: mostrar minutos
                lastActivityFormatted = `${diffMins}m`;
            } else if (diffMins < 1440) {
                // Menos de un día: mostrar horas
                const hours = Math.floor(diffMins / 60);
                lastActivityFormatted = `${hours}h`;
            } else {
                // Más de un día: mostrar días
                const days = Math.floor(diffMins / 1440);
                lastActivityFormatted = `${days}d`;
            }
        }
        
        const phone = contact.phone_number || contact.phone || '';

        return `
            <tr class="contact-row" data-contact-id="${contact.id}">
                <td>
                    <input type="checkbox" class="contact-checkbox" value="${contact.id}">
                </td>
                <td>
                    ${avatar ?
                        `<img src="${avatar}" alt="${contact.name}" class="contact-avatar">` :
                        `<div class="contact-avatar-placeholder">${initials}</div>`
                    }
                </td>
                <td>
                    <div class="contact-name clickable-name" data-contact-id="${contact.id}" title="Abrir chat">
                        ${this.escapeHtml(contact.name || 'Sin nombre')}
                    </div>
                </td>
                <td>
                    <a href="tel:${phone}" class="contact-phone">${phone}</a>
                </td>
                <td class="text-muted">
                    <span class="last-activity-time">${lastActivityFormatted}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline contact-delete-btn" data-contact-id="${contact.id}" title="Eliminar contacto">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    /**
     * Muestra estado de carga
     */
    showLoadingState() {
        if (!this.elements.contactsTableBody) return;
        
        this.elements.contactsTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="6">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <h3>Cargando contactos...</h3>
                        <p>Por favor espere mientras se cargan los datos</p>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Muestra estado de error
     */
    showErrorState(errorMessage) {
        if (!this.elements.contactsTableBody) return;
        
        this.elements.contactsTableBody.innerHTML = `
            <tr class="error-row">
                <td colspan="7">
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error al cargar contactos</h3>
                        <p>${errorMessage || 'Ha ocurrido un error inesperado'}</p>
                        <button class="btn btn-primary mt-4" onclick="contactManager.loadContacts()">
                            <i class="fas fa-sync"></i>
                            Reintentar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Muestra estado vacío
     */
    showEmptyState(message) {
        if (!this.elements.contactsTableBody) return;
        
        this.elements.contactsTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-address-book"></i>
                        <h3>${message || 'No hay contactos'}</h3>
                        <p>${message ? '' : 'Agrega tu primer contacto para comenzar'}</p>
                        ${!message ? `
                            <button class="btn btn-primary" onclick="contactManager.showAddContactModal()">
                                <i class="fas fa-plus"></i>
                                Agregar Contacto
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Actualiza la paginación
     */
    updatePagination() {
        const totalPages = Math.ceil(this.totalContacts / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalContacts);

        this.elements.paginationStart.textContent = start;
        this.elements.paginationEnd.textContent = end;
        this.elements.paginationTotal.textContent = this.totalContacts;

        this.elements.prevPage.disabled = this.currentPage === 1;
        this.elements.nextPage.disabled = this.currentPage >= totalPages;

        // Render page numbers
        this.renderPageNumbers(totalPages);
    }

    /**
     * Renderiza los números de página
     */
    renderPageNumbers(totalPages) {
        const pages = [];
        const maxPages = 5;

        if (totalPages <= maxPages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (this.currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (this.currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', this.currentPage - 1, this.currentPage, this.currentPage + 1, '...', totalPages);
            }
        }

        this.elements.pageNumbers.innerHTML = pages.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            }
            return `
                <button class="page-number ${page === this.currentPage ? 'active' : ''}" 
                        onclick="contactManager.changePage(${page})">
                    ${page}
                </button>
            `;
        }).join('');
    }

    /**
     * Cambia de página
     */
    changePage(page) {
        const totalPages = Math.ceil(this.totalContacts / this.pageSize);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.loadContacts();
    }

    /**
     * Actualiza las estadísticas
     */
    updateStats() {
        if (this.elements.totalContactsCount) {
            this.elements.totalContactsCount.textContent = this.totalContacts;
        }
        if (this.elements.totalGroupsCount && this.tags) {
            this.elements.totalGroupsCount.textContent = this.tags.length || 0;
        }
    }


    /**
     * Muestra el modal para agregar contacto
     */
    async showAddContactModal() {
        this.editingContact = null;
        this.elements.contactModalTitle.textContent = 'Nuevo Contacto';
        this.elements.contactForm.reset();
        await this.renderContactCustomFields('new');
        this.elements.contactModal.style.display = 'flex';
    }

    /**
     * Edita un contacto
     */
    async editContact(contactId) {
        try {
            const response = await fetch(`/api/contacts/${contactId}`);
            const data = await response.json();

            if (data.success) {
                this.editingContact = data.data; // Cambié data.contact a data.data
                this.elements.contactModalTitle.textContent = 'Editar Contacto';

                // Fill form
                const nameParts = (this.editingContact.name || '').split(' ');
                this.elements.contactName.value = nameParts[0] || '';
                this.elements.contactSurname.value = nameParts.slice(1).join(' ') || '';
                this.elements.contactPhone.value = this.editingContact.phone || '';
                this.elements.contactEmail.value = this.editingContact.email || '';
                this.elements.contactNotes.value = this.editingContact.notes || '';

                // Select groups
                const groupIds = (this.editingContact.groups || []).map(g => g.id);
                Array.from(this.elements.contactGroups.options).forEach(option => {
                    option.selected = groupIds.includes(parseInt(option.value));
                });

                // Load custom fields with existing values
                await this.renderContactCustomFields(contactId);

                this.elements.contactModal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error cargando contacto:', error);
            alert('Error al cargar el contacto');
        }
    }

    /**
     * Oculta el modal de contacto
     */
    hideContactModal() {
        this.elements.contactModal.style.display = 'none';
        this.elements.contactForm.reset();
        this.editingContact = null;
    }

    /**
     * Maneja el envío del formulario de contacto
     */
    async handleContactFormSubmit(e) {
        e.preventDefault();

        const firstName = this.elements.contactName.value.trim();
        const surname = this.elements.contactSurname.value.trim();

        const formData = {
            name: `${firstName} ${surname}`.trim(),
            phone: this.elements.contactPhone.value.trim(),
            email: this.elements.contactEmail.value.trim(),
            groups: Array.from(this.elements.contactGroups.selectedOptions).map(o => o.value),
            notes: this.elements.contactNotes.value.trim()
        };

        // Validation
        if (!firstName) {
            this.showFieldError('name', 'El nombre es requerido');
            return;
        }

        if (!formData.phone) {
            this.showFieldError('phone', 'El teléfono es requerido');
            return;
        }

        try {
            const url = this.editingContact ? 
                `/api/contacts/${this.editingContact.id}` : 
                '/api/contacts';
            
            const method = this.editingContact ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Guardar campos personalizados
                const contactId = this.editingContact ? this.editingContact.id : data.data.id;
                await this.saveContactCustomFields(contactId);

                this.hideContactModal();
                await this.loadContacts();
                alert(this.editingContact ? 'Contacto actualizado correctamente' : 'Contacto creado correctamente');
            } else {
                throw new Error(data.error || 'Error al guardar contacto');
            }
        } catch (error) {
            console.error('Error guardando contacto:', error);
            alert('Error al guardar el contacto: ' + error.message);
        }
    }

    /**
     * Elimina un contacto
     */
    async deleteContact(contactId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este contacto?')) {
            return;
        }

        try {
            const response = await fetch(`/api/contacts/${contactId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                await this.loadContacts();
                alert('Contacto eliminado correctamente');
            } else {
                throw new Error(data.error || 'Error al eliminar contacto');
            }
        } catch (error) {
            console.error('Error eliminando contacto:', error);
            alert('Error al eliminar el contacto');
        }
    }

    /**
     * Abre el chat en vivo con el contacto
     */
    openChat(contactId) {
        // Buscar el contacto para obtener su teléfono
        const contact = this.contacts.find(c => c.id == contactId);
        if (contact) {
            const phone = contact.phone_number || contact.phone;
            if (phone) {
                // Redirigir a la página de chat en vivo con el teléfono del contacto
                window.location.href = `/chat-live?phone=${encodeURIComponent(phone)}`;
            } else {
                alert('No se encontró número de teléfono para este contacto');
            }
        } else {
            alert('Contacto no encontrado');
        }
    }
    
    /**
     * Envía un mensaje a un contacto
     */
    sendMessage(contactId) {
        const contact = this.contacts.find(c => c.id === contactId);
        if (contact) {
            const phone = contact.phone_number || contact.phone || '';
            window.location.href = `/chat-live.html?phone=${phone}`;
        }
    }

    /**
     * Exporta contactos
     */
    async exportContacts() {
        try {
            const response = await fetch('/api/contacts/export');
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exportando contactos:', error);
            alert('Error al exportar contactos');
        }
    }

    /**
     * Muestra modal de importación
     */
    showImportModal() {
        this.elements.importModal.style.display = 'flex';
    }

    /**
     * Oculta modal de importación
     */
    hideImportModal() {
        this.elements.importModal.style.display = 'none';
        this.elements.importFile.value = '';
        this.elements.confirmImport.disabled = true;

        // Restaurar UI de importación
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea) {
            fileUploadArea.style.display = '';
        }
        const importHelp = document.querySelector('.import-help');
        if (importHelp) {
            importHelp.style.display = '';
        }
        const oldPreview = document.getElementById('importPreviewContainer');
        if (oldPreview) {
            oldPreview.remove();
        }
        this.importSelectedFile = null;
        this.importPreview = null;
        this.importColumnMapping = null;
    }

    /**
     * Maneja la selección de archivo
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) {
            this.elements.confirmImport.disabled = true;
            return;
        }

        // Guardar referencia al archivo seleccionado
        this.importSelectedFile = file;

        // Previsualizar y permitir mapeo antes de importar
        this.showImportPreview(file)
            .then(() => {
                this.elements.confirmImport.disabled = false;
            })
            .catch(error => {
                console.error('Error generando previsualización de importación:', error);
                alert('No se pudo leer el archivo para previsualización');
                this.elements.confirmImport.disabled = true;
            });
    }

    /**
     * Maneja la importación
     */
    async handleImport() {
        const file = this.importSelectedFile || this.elements.importFile.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        // Incluir mapping si existe (para uso futuro en el backend)
        if (this.importColumnMapping) {
            formData.append('mapping', JSON.stringify(this.importColumnMapping));
        }


        try {
            const response = await fetch('/api/contacts/import', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.hideImportModal();
                await this.loadContacts();
                alert(`Importados ${data.imported} contactos correctamente`);
            } else {
                throw new Error(data.error || 'Error al importar contactos');
            }
        } catch (error) {
            console.error('Error importando contactos:', error);
            alert('Error al importar contactos: ' + error.message);
        }
    }

    /**
     * Muestra un preview del archivo y permite mapear columnas a campos de contacto
     */
    async showImportPreview(file) {
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const isCsv = file.type.includes('csv') || ['csv'].includes(extension);
        const isExcel = ['xlsx', 'xls'].includes(extension);

        if (!isCsv && !isExcel) {
            // Para JSON u otros, de momento no hacemos preview tabular
            this.importPreview = null;
            this.importColumnMapping = null;
            return;
        }

        const preview = await this.readTabularFilePreview(file, { maxRows: 5 });
        const { headers, rows, detectedColumns } = preview;

        this.importPreview = preview;

        // Construir UI dentro del importModal (debajo de la zona de ayuda)
        const importContent = document.querySelector('.import-content');
        if (!importContent) return;

        // Ocultar zona de selección de archivo y ayuda para centrarse en el preview
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea) {
            fileUploadArea.style.display = 'none';
        }
        const importHelp = document.querySelector('.import-help');
        if (importHelp) {
            importHelp.style.display = 'none';
        }

        // Eliminar preview anterior si existe
        const oldPreview = document.getElementById('importPreviewContainer');
        if (oldPreview) {
            oldPreview.remove();
        }

        // Mapeo sugerido inicial
        const mapping = {
            name: detectedColumns?.nameIndex ?? null,
            lastName: detectedColumns?.lastNameIndex ?? null,
            phone: detectedColumns?.phoneIndex ?? null,
            email: null,
        };
        this.importColumnMapping = mapping;

        const headerOptions = headers.map((h, idx) => {
            const label = h || `Columna ${idx + 1}`;
            return `<option value="${idx}">${label}</option>`;
        }).join('');

        const buildSelect = (id, selectedIndex, placeholder) => {
            const selected = (idx) => (idx === selectedIndex ? 'selected' : '');
            return `
                <select id="${id}" class="mapping-select" style="width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px;">
                    <option value="" ${selectedIndex == null ? 'selected' : ''}>No usar</option>
                    ${headers.map((h, idx) => {
                        const label = h || `Columna ${idx + 1}`;
                        return `<option value="${idx}" ${selected(idx)}>${label}</option>`;
                    }).join('')}
                </select>
                <small style="font-size:11px; color:#9ca3af;">${placeholder}</small>
            `;
        };

        const headerCells = headers.map(h => `<th style="padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px; text-align:left;">${h || ''}</th>`).join('');
        const bodyRows = rows.map(row => {
            return `<tr>${headers.map((_, idx) => {
                const value = (row[idx] ?? '').toString();
                return `<td style="padding:4px 8px; font-size:12px; border-bottom:1px solid #f1f5f9;">${value}</td>`;
            }).join('')}</tr>`;
        }).join('');

        const container = document.createElement('div');
        container.id = 'importPreviewContainer';
        container.style.marginTop = '16px';

        container.innerHTML = `
            <hr style="margin: 12px 0; border-color:#e5e7eb;">
            <h4 style="font-size:14px; font-weight:600; margin-bottom:8px; color:#111827;">Previsualización y mapeo</h4>
            <p style="font-size:12px; color:#6b7280; margin-bottom:10px;">Selecciona qué columnas del archivo corresponden a los campos del contacto.</p>
            <div class="mapping-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-bottom:12px;">
                <div>
                    <label style="font-size:12px; font-weight:500; color:#374151;">Nombre *</label>
                    ${buildSelect('mappingName', mapping.name, 'Ej: "name", "nombre"')}
                </div>
                <div>
                    <label style="font-size:12px; font-weight:500; color:#374151;">Apellido</label>
                    ${buildSelect('mappingLastName', mapping.lastName, 'Ej: "apellido", "last"')}
                </div>
                <div>
                    <label style="font-size:12px; font-weight:500; color:#374151;">Teléfono *</label>
                    ${buildSelect('mappingPhone', mapping.phone, 'Ej: "phone", "telefono"')}
                </div>
                <div>
                    <label style="font-size:12px; font-weight:500; color:#374151;">Email</label>
                    ${buildSelect('mappingEmail', mapping.email, 'Opcional')}
                </div>
            </div>
            <div style="max-height:220px; overflow:auto; border:1px solid #e5e7eb; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr>${headerCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
        `;

        importContent.appendChild(container);

        // Escuchar cambios en selects para mantener mapping actualizado
        const getIndex = (id) => {
            const el = document.getElementById(id);
            if (!el || el.value === '') return null;
            const idx = parseInt(el.value, 10);
            return Number.isNaN(idx) ? null : idx;
        };

        const updateMapping = () => {
            this.importColumnMapping = {
                name: getIndex('mappingName'),
                lastName: getIndex('mappingLastName'),
                phone: getIndex('mappingPhone'),
                email: getIndex('mappingEmail'),
            };
        };

        ['mappingName', 'mappingLastName', 'mappingPhone', 'mappingEmail'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', updateMapping);
            }
        });

        updateMapping();

        // Validación mínima: nombre y teléfono deberían estar mapeados
        if (this.importColumnMapping.name == null || this.importColumnMapping.phone == null) {
            alert('Por favor verifica que las columnas de Nombre y Teléfono estén correctamente mapeadas antes de importar.');
        }
    }

    /**
     * Lee un archivo CSV/Excel y devuelve headers + algunas filas y columnas detectadas
     */
    readTabularFilePreview(file, options = {}) {
        const maxRows = options.maxRows || null; // ya no limitamos filas para permitir scroll sobre todos los datos

        return new Promise((resolve, reject) => {
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const isCsv = file.type.includes('csv') || ['csv'].includes(extension);
            const isExcel = ['xlsx', 'xls'].includes(extension);

            const reader = new FileReader();

            reader.onerror = () => reject(reader.error);

            reader.onload = () => {
                try {
                    let headers = [];
                    let rows = [];

                    if (isCsv) {
                        const text = reader.result.toString();
                        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                        if (!lines.length) {
                            return resolve({ headers: [], rows: [], detectedColumns: {} });
                        }
                        headers = lines[0].split(/[,;\t]/).map(h => h.trim());
                        // Mostrar todas las filas; el contenedor ya tiene scroll
                        rows = lines.slice(1).map(line => line.split(/[,;\t]/));
                    } else if (isExcel) {
                        if (typeof XLSX === 'undefined') {
                            throw new Error('Librería XLSX no disponible');
                        }
                        const data = new Uint8Array(reader.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                        if (!json.length) {
                            return resolve({ headers: [], rows: [], detectedColumns: {} });
                        }
                        headers = (json[0] || []).map(h => (h || '').toString());
                        // Mostrar todas las filas del archivo; el contenedor tiene max-height y scroll
                        rows = json.slice(1);
                    } else {
                        return resolve({ headers: [], rows: [], detectedColumns: {} });
                    }

                    const detectedColumns = this.detectContactColumns(headers);
                    resolve({ headers, rows, detectedColumns });
                } catch (err) {
                    reject(err);
                }
            };

            if (isCsv) {
                reader.readAsText(file, 'utf-8');
            } else if (isExcel) {
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Tipo de archivo no soportado'));
            }
        });
    }

    /**
     * Detecta columnas típicas de nombre, apellido y teléfono en headers
     */
    detectContactColumns(headers) {
        const result = { nameIndex: null, lastNameIndex: null, phoneIndex: null };
        if (!Array.isArray(headers)) return result;

        headers.forEach((header, index) => {
            const h = (header || '').toString().toLowerCase();

            if (result.nameIndex == null && (h.includes('nombre') || h.includes('name') || h.includes('first'))) {
                result.nameIndex = index;
            }
            if (result.lastNameIndex == null && (h.includes('apellido') || h.includes('last'))) {
                result.lastNameIndex = index;
            }
            if (result.phoneIndex == null && (h.includes('telefono') || h.includes('teléfono') || h.includes('phone') || h.includes('celular') || h.includes('whatsapp') || h.includes('numero') || h.includes('número'))) {
                result.phoneIndex = index;
            }
        });

        return result;
    }

    /**
     * Vincula eventos de las filas de contactos
     */
    bindContactRowEvents() {
        // Checkboxes
        document.querySelectorAll('.contact-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const contactId = parseInt(e.target.value);
                if (e.target.checked) {
                    this.selectedContacts.add(contactId);
                } else {
                    this.selectedContacts.delete(contactId);
                }
                this.updateBulkActionsBar();
            });
        });

        // Click en nombre del contacto para abrir chat
        document.querySelectorAll('.clickable-name').forEach(nameEl => {
            nameEl.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const contactId = parseInt(nameEl.dataset.contactId);
                // Usar setTimeout para no bloquear el click handler
                this.openChat(contactId);
            });
        });

        // Botón de eliminar contacto
        document.querySelectorAll('.contact-delete-btn').forEach(deleteBtn => {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const contactId = parseInt(deleteBtn.dataset.contactId);
                // Usar setTimeout para no bloquear el click handler
                this.deleteContact(contactId);
            });
        });
    }
    
    /**
     * Actualiza la barra de acciones masivas
     */
    updateBulkActionsBar() {
        // console.log('Actualizando barra de acciones masivas...');
        // console.log('selectedContacts:', this.selectedContacts);
        // console.log('selectedContacts instanceof Set:', this.selectedContacts instanceof Set);
        
        // Asegurar que selectedContacts sea un Set
        if (!(this.selectedContacts instanceof Set)) {
            console.error('selectedContacts no es un Set, reinicializando...');
            this.selectedContacts = new Set(Array.isArray(this.selectedContacts) ? this.selectedContacts : []);
        }
        
        const count = this.selectedContacts.size;
        // console.log(`Contactos seleccionados: ${count}`);
        
        if (count > 0) {
            // console.log('Mostrando barra de acciones masivas');
            this.elements.bulkActionsBar.style.display = 'flex';
            this.elements.selectedCount.textContent = count;
        } else {
            // console.log('Ocultando barra de acciones masivas');
            this.elements.bulkActionsBar.style.display = 'none';
        }
    }
    
    /**
     * Selecciona TODOS los contactos (no solo los de la página actual)
     */
    async selectAllContacts() {
        try {
            // console.log('📋 Seleccionando TODOS los contactos...');

            // Obtener todos los IDs de contactos del servidor (sin límite)
            const response = await fetch('/api/contacts?all=true');
            const data = await response.json();

            if (data.success && data.data) {
                // Limpiar selección actual
                this.selectedContacts.clear();

                // Agregar todos los IDs de contactos
                data.data.forEach(contact => {
                    this.selectedContacts.add(contact.id);
                });

                // Marcar todos los checkboxes visibles como checked
                document.querySelectorAll('.contact-checkbox').forEach(cb => {
                    cb.checked = true;
                });

                // Marcar el checkbox "Select All" como checked
                if (this.elements.selectAllContacts) {
                    this.elements.selectAllContacts.checked = true;
                }

                // console.log(`✅ Seleccionados ${this.selectedContacts.size} contactos en total`);
                this.updateBulkActionsBar();
            } else {
                console.error('❌ Error obteniendo lista completa de contactos');
                alert('Error al seleccionar todos los contactos');
            }
        } catch (error) {
            console.error('❌ Error seleccionando todos los contactos:', error);
            alert('Error al seleccionar todos los contactos');
        }
    }

    /**
     * Limpia la selección de contactos
     */
    clearSelection() {
        this.selectedContacts.clear();
        document.querySelectorAll('.contact-checkbox').forEach(cb => cb.checked = false);
        if (this.elements.selectAllContacts) {
            this.elements.selectAllContacts.checked = false;
        }
        this.updateBulkActionsBar();
    }
    
    
    
    
    /**
     * Elimina múltiples contactos
     */
    async bulkDeleteContacts() {
        if (this.selectedContacts.size === 0) {
            alert('No hay contactos seleccionados');
            return;
        }
        
        const confirmMsg = `¿Estás seguro de eliminar ${this.selectedContacts.size} contacto(s)? Esta acción no se puede deshacer.`;
        if (!confirm(confirmMsg)) return;
        
        const contactIds = Array.from(this.selectedContacts);
        let successCount = 0;
        let errorCount = 0;
        
        for (const contactId of contactIds) {
            try {
                const response = await fetch(`/api/contacts/${contactId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        alert(`Contactos eliminados: ${successCount} éxito, ${errorCount} errores`);
        this.clearSelection();
        this.loadContacts(); // Recargar lista
    }

    /**
     * Muestra error en un campo
     */
    showFieldError(field, message) {
        const errorElement = document.getElementById(`${field}Error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
            
            setTimeout(() => {
                errorElement.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * Obtiene las iniciales de un nombre
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Formatea tiempo relativo
     */
    formatTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /**
     * Escapa caracteres HTML especiales
     */
    escapeHtml(text) {
        // Usar ChatHelpers si está disponible, sino usar fallback local
        if (typeof ChatHelpers !== 'undefined' && ChatHelpers.escapeHtml) {
            return ChatHelpers.escapeHtml(text);
        }
        // Fallback local
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Trunca un texto a una longitud máxima
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * Debounce helper
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===== GESTIÓN DE CAMPOS PERSONALIZADOS =====

    /**
     * Muestra el modal de gestión de campos personalizados
     */
    async showCustomFieldsModal() {
        await this.loadCustomFields();
        this.renderCustomFieldsList();
        this.elements.customFieldsModal.style.display = 'flex';
    }

    /**
     * Oculta el modal de campos personalizados
     */
    hideCustomFieldsModal() {
        this.elements.customFieldsModal.style.display = 'none';
    }

    /**
     * Carga los campos personalizados desde el servidor
     */
    async loadCustomFields() {
        try {
            const response = await fetch('/api/custom-fields');
            const data = await response.json();

            if (data.success) {
                this.customFields = data.data || [];
                console.log(`✅ ${this.customFields.length} campos personalizados cargados`);
            } else {
                console.error('❌ Error cargando campos personalizados:', data.error);
                this.customFields = [];
            }
        } catch (error) {
            console.error('❌ Error cargando campos personalizados:', error);
            this.customFields = [];
        }
    }

    /**
     * Renderiza la lista de campos personalizados
     */
    renderCustomFieldsList() {
        if (this.customFields.length === 0) {
            this.elements.customFieldsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <h3>No hay campos personalizados</h3>
                    <p>Crea tu primer campo personalizado para empezar</p>
                </div>
            `;
            return;
        }

        const html = this.customFields.map(field => `
            <div class="custom-field-row">
                <div class="custom-field-info">
                    <h5>${this.escapeHtml(field.name)}</h5>
                    <p>Tipo: ${field.type} ${field.description ? `• ${field.description}` : ''}</p>
                </div>
                <div class="custom-field-actions">
                    <button class="edit-btn" onclick="contactManager.editCustomField('${field.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="contactManager.deleteCustomField('${field.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.elements.customFieldsList.innerHTML = html;
    }

    /**
     * Muestra el modal para agregar campo personalizado
     */
    showAddCustomFieldModal() {
        this.editingCustomField = null;
        this.elements.customFieldModalTitle.textContent = 'Nuevo Campo Personalizado';
        this.elements.customFieldForm.reset();
        this.elements.customFieldModal.style.display = 'flex';
        this.elements.customFieldName.focus();
    }

    /**
     * Edita un campo personalizado
     */
    async editCustomField(fieldId) {
        const field = this.customFields.find(f => f.id === fieldId);
        if (!field) return;

        this.editingCustomField = field;
        this.elements.customFieldModalTitle.textContent = 'Editar Campo Personalizado';
        this.elements.customFieldName.value = field.name;
        this.elements.customFieldType.value = field.type;
        this.elements.customFieldDescription.value = field.description || '';
        this.elements.customFieldModal.style.display = 'flex';
    }

    /**
     * Oculta el modal de campo personalizado
     */
    hideCustomFieldModal() {
        this.elements.customFieldModal.style.display = 'none';
        this.elements.customFieldForm.reset();
        this.editingCustomField = null;
    }

    /**
     * Maneja el envío del formulario de campo personalizado
     */
    async handleCustomFieldFormSubmit(e) {
        e.preventDefault();

        const formData = {
            name: this.elements.customFieldName.value.trim(),
            type: this.elements.customFieldType.value,
            description: this.elements.customFieldDescription.value.trim()
        };

        if (!formData.name) {
            alert('El nombre es requerido');
            return;
        }

        try {
            let url = '/api/custom-fields';
            let method = 'POST';

            if (this.editingCustomField) {
                url = `/api/custom-fields/${this.editingCustomField.id}`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.hideCustomFieldModal();
                await this.loadCustomFieldsOptions();
                this.renderCustomFieldsList();
                
                // Actualizar campos en el formulario de contacto si está abierto
                if (this.elements.contactModal.style.display === 'flex') {
                    const contactId = this.editingContact ? this.editingContact.id : 'new';
                    await this.renderContactCustomFields(contactId);
                }
                
                alert(this.editingCustomField ? 'Campo actualizado correctamente' : 'Campo creado correctamente');
            } else {
                throw new Error(data.error || 'Error guardando campo');
            }
        } catch (error) {
            console.error('Error guardando campo personalizado:', error);
            alert('Error al guardar el campo personalizado: ' + error.message);
        }
    }

    /**
     * Elimina un campo personalizado
     */
    async deleteCustomField(fieldId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este campo personalizado? Se perderán todos los valores asociados.')) {
            return;
        }

        try {
            const response = await fetch(`/api/custom-fields/${fieldId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                await this.loadCustomFieldsOptions();
                this.renderCustomFieldsList();
                
                // Actualizar campos en el formulario de contacto si está abierto
                if (this.elements.contactModal.style.display === 'flex') {
                    const contactId = this.editingContact ? this.editingContact.id : 'new';
                    await this.renderContactCustomFields(contactId);
                }
                
                alert('Campo eliminado correctamente');
            } else {
                throw new Error(data.error || 'Error eliminando campo');
            }
        } catch (error) {
            console.error('Error eliminando campo personalizado:', error);
            alert('Error al eliminar el campo personalizado');
        }
    }

    /**
     * Carga campos personalizados de un contacto específico
     */
    async loadContactCustomFields(contactId) {
        try {
            const response = await fetch(`/api/contacts/${contactId}/custom-fields`);
            const data = await response.json();

            if (data.success) {
                this.contactCustomFields[contactId] = data.data || [];
                // console.log(`✅ ${this.contactCustomFields[contactId].length} campos personalizados cargados para contacto ${contactId}`);
            } else {
                this.contactCustomFields[contactId] = [];
            }
        } catch (error) {
            console.error('Error cargando campos personalizados del contacto:', error);
            this.contactCustomFields[contactId] = [];
        }
    }

    /**
     * Renderiza campos personalizados en el formulario de contacto
     */
    async renderContactCustomFields(contactId) {
        if (this.customFields.length === 0) {
            this.elements.contactCustomFields.innerHTML = '<p style="color: #6b7280; font-style: italic;">No hay campos personalizados definidos</p>';
            return;
        }

        await this.loadContactCustomFields(contactId);

        const html = this.customFields.map(field => {
            const contactField = this.contactCustomFields[contactId]?.find(cf => cf.field_id === field.id);
            const value = contactField?.value || '';

            return `
                <div class="custom-field-item">
                    <label for="custom_${field.id}">${this.escapeHtml(field.name)}</label>
                    ${this.getCustomFieldInput(field, value)}
                </div>
            `;
        }).join('');

        this.elements.contactCustomFields.innerHTML = html;
    }

    /**
     * Genera el input apropiado según el tipo de campo
     */
    getCustomFieldInput(field, value) {
        const baseAttrs = `id="custom_${field.id}" name="custom_${field.id}" data-field-id="${field.id}"`;

        switch (field.type) {
            case 'number':
                return `<input type="number" ${baseAttrs} value="${value}" placeholder="Ingrese un número">`;
            case 'date':
                return `<input type="date" ${baseAttrs} value="${value}">`;
            case 'email':
                return `<input type="email" ${baseAttrs} value="${value}" placeholder="correo@ejemplo.com">`;
            case 'phone':
                return `<input type="tel" ${baseAttrs} value="${value}" placeholder="+57...">`;
            default:
                return `<input type="text" ${baseAttrs} value="${value}" placeholder="Ingrese ${field.name.toLowerCase()}">`;
        }
    }

    /**
     * Guarda los valores de campos personalizados de un contacto
     */
    async saveContactCustomFields(contactId) {
        const customFieldElements = this.elements.contactCustomFields.querySelectorAll('[data-field-id]');

        for (const element of customFieldElements) {
            const fieldId = element.dataset.fieldId;
            const value = element.value.trim();

            try {
                if (value) {
                    // Agregar/actualizar valor
                    await fetch(`/api/contacts/${contactId}/custom-fields`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ field_id: fieldId, value })
                    });
                } else {
                    // Eliminar valor si está vacío
                    await fetch(`/api/contacts/${contactId}/custom-fields/${fieldId}`, {
                        method: 'DELETE'
                    });
                }
            } catch (error) {
                console.error(`Error guardando campo ${fieldId}:`, error);
            }
        }
    }
}

// Initialize contact manager
let contactManager;
document.addEventListener('DOMContentLoaded', () => {
    contactManager = new ContactManager();
});
