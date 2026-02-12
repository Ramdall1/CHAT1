/**
 * Campaigns Manager - Gestión de campañas de difusión masiva
 */
class CampaignsManager {
    constructor() {
        this.campaigns = [];
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalCampaigns = 0;
        this.statusFilter = '';
        this.editingCampaign = null;
        this.tags = [];
        this.customFields = [];
        this.recipientsPreview = {
            total: 0,
            contacts: []
        };
        
        // Caché para plantillas y flows
        this.cachedTemplates = null;
        this.cachedFlows = null;
        this.templatesLoaded = false;
        this.flowsLoaded = false;
        
        // Archivos seleccionados
        this.selectedFile = null;
        this.selectedFileType = null;
        this.headerText = null;
        
        // Botones agregados
        this.addedButtons = [];
        this.buttonCounter = 0;
        
        // Mapeo de variables
        this.currentVariableMapping = null;
        this.currentTemplate = null;
        
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
        await this.loadCustomFields();
        await this.loadCampaigns();
        await this.loadStats();
    }

    /**
     * Cachea elementos del DOM
     */
    cacheElements() {
        this.elements = {
            // Buttons
            createCampaignBtn: document.getElementById('createCampaignBtn'),
            saveCampaignBtn: document.getElementById('saveCampaignBtn'),
            cancelCampaignBtn: document.getElementById('cancelCampaignBtn'),
            closeCampaignModal: document.getElementById('closeCampaignModal'),
            closeStatsModal: document.getElementById('closeStatsModal'),
            previewRecipientsBtn: document.getElementById('previewRecipientsBtn'),
            
            // Filters
            statusFilter: document.getElementById('statusFilter'),
            
            // Table
            campaignsTableBody: document.getElementById('campaignsTableBody'),
            
            // Modals
            campaignModal: document.getElementById('campaignModal'),
            statsModal: document.getElementById('statsModal'),
            modalTitle: document.getElementById('modalTitle'),
            
            // Form
            campaignName: document.getElementById('campaignName'),
            templateType: document.getElementById('templateType'),
            templateSelector: document.getElementById('templateSelector'),
            templateSelectorGroup: document.getElementById('templateSelectorGroup'),
            templateSelectorLabel: document.getElementById('templateSelectorLabel'),
            templateSelectorHelp: document.getElementById('templateSelectorHelp'),
            templateSelectorStatus: document.getElementById('templateSelectorStatus'),
            mapVariablesBtn: document.getElementById('mapVariablesBtn'),
            variableMappingPreview: document.getElementById('variableMappingPreview'),
            mappingList: document.getElementById('mappingList'),
            mapCustomVariablesBtn: document.getElementById('mapCustomVariablesBtn'),
            customVariableMappingPreview: document.getElementById('customVariableMappingPreview'),
            customMappingList: document.getElementById('customMappingList'),
            campaignMessage: document.getElementById('campaignMessage'),
            footerText: document.getElementById('footerText'),
            buttonType: document.getElementById('buttonType'),
            messageCategory: document.getElementById('messageCategory'),
            messageLanguage: document.getElementById('messageLanguage'),
            scheduledAt: document.getElementById('scheduledAt'),
            
            // Recipients filters
            filterSearch: document.getElementById('filterSearch'),
            filterStatus: document.getElementById('filterStatus'),
            filterTag: document.getElementById('filterTag'),
            filterCustomField: document.getElementById('filterCustomField'),
            recipientsPreview: document.getElementById('recipientsPreview'),
            recipientsCount: document.getElementById('recipientsCount'),
            recipientsList: document.getElementById('recipientsList'),
            
            // Media buttons
            headerMediaSection: document.getElementById('headerMediaSection'),
            mediaTextBtn: document.getElementById('mediaTextBtn'),
            mediaImageBtn: document.getElementById('mediaImageBtn'),
            mediaVideoBtn: document.getElementById('mediaVideoBtn'),
            mediaFileBtn: document.getElementById('mediaFileBtn'),
            mediaImageInput: document.getElementById('mediaImageInput'),
            mediaVideoInput: document.getElementById('mediaVideoInput'),
            mediaFileInput: document.getElementById('mediaFileInput'),
            headerTextInputWrapper: document.getElementById('headerTextInputWrapper'),
            headerTextInput: document.getElementById('headerTextInput'),
            removeHeaderTextBtn: document.getElementById('removeHeaderTextBtn'),
            selectedFileInfo: document.getElementById('selectedFileInfo'),
            selectedFileName: document.getElementById('selectedFileName'),
            removeFileBtn: document.getElementById('removeFileBtn'),
            
            // Stats
            totalCampaigns: document.getElementById('totalCampaigns'),
            sentCampaigns: document.getElementById('sentCampaigns'),
            scheduledCampaigns: document.getElementById('scheduledCampaigns'),
            draftCampaigns: document.getElementById('draftCampaigns'),
            
            // Pagination
            paginationContainer: document.getElementById('paginationContainer'),
            paginationStart: document.getElementById('paginationStart'),
            paginationEnd: document.getElementById('paginationEnd'),
            paginationTotal: document.getElementById('paginationTotal'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageNumbers: document.getElementById('pageNumbers'),
            
            // Loading
            loadingOverlay: document.getElementById('loadingOverlay'),
            
            // Preview
            messagePreview: document.getElementById('messagePreview')
        };
    }

    /**
     * Vincula eventos
     */
    bindEvents() {
        this.elements.createCampaignBtn.addEventListener('click', () => this.showCreateModal());
        this.elements.saveCampaignBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.saveCampaign();
        });
        this.elements.cancelCampaignBtn.addEventListener('click', () => this.hideModal());
        this.elements.closeCampaignModal.addEventListener('click', () => this.hideModal());
        this.elements.closeStatsModal.addEventListener('click', () => this.hideStatsModal());
        this.elements.previewRecipientsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.previewRecipients();
        });
        
        this.elements.statusFilter.addEventListener('change', () => {
            this.statusFilter = this.elements.statusFilter.value;
            this.currentPage = 1;
            this.loadCampaigns();
        });
        
        this.elements.prevPage.addEventListener('click', () => this.changePage(this.currentPage - 1));
        this.elements.nextPage.addEventListener('click', () => this.changePage(this.currentPage + 1));
        
        // Event delegation para acciones de campañas
        this.elements.campaignsTableBody.addEventListener('click', (e) => {
            const sendBtn = e.target.closest('.campaign-send-btn');
            const editBtn = e.target.closest('.campaign-edit-btn');
            const statsBtn = e.target.closest('.campaign-stats-btn');
            const deleteBtn = e.target.closest('.campaign-delete-btn');
            
            if (sendBtn) {
                e.preventDefault();
                e.stopPropagation();
                const campaignId = parseInt(sendBtn.dataset.campaignId);
                this.sendCampaign(campaignId);
            } else if (editBtn) {
                e.preventDefault();
                e.stopPropagation();
                const campaignId = parseInt(editBtn.dataset.campaignId);
                this.editCampaign(campaignId);
            } else if (statsBtn) {
                e.preventDefault();
                e.stopPropagation();
                const campaignId = parseInt(statsBtn.dataset.campaignId);
                this.viewStats(campaignId);
            } else if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const campaignId = parseInt(deleteBtn.dataset.campaignId);
                this.deleteCampaign(campaignId);
            }
        });
        
        // Preview en tiempo real del mensaje
        this.elements.campaignMessage.addEventListener('input', () => this.updateMediaPreview());
        
        // Preview en tiempo real del pie de página
        if (this.elements.footerText) {
            this.elements.footerText.addEventListener('input', () => this.updateMediaPreview());
        }
        
        // Preview en tiempo real del botón
        if (this.elements.buttonType) {
            this.elements.buttonType.addEventListener('change', () => {
                this.handleButtonTypeChange();
                this.updateMediaPreview();
            });
        }
        
        // Media buttons
        this.elements.mediaTextBtn.addEventListener('click', () => this.showHeaderTextInput());
        this.elements.mediaImageBtn.addEventListener('click', () => this.elements.mediaImageInput.click());
        this.elements.mediaVideoBtn.addEventListener('click', () => this.elements.mediaVideoInput.click());
        this.elements.mediaFileBtn.addEventListener('click', () => this.elements.mediaFileInput.click());
        
        this.elements.mediaImageInput.addEventListener('change', (e) => this.handleFileSelection(e, 'image'));
        this.elements.mediaVideoInput.addEventListener('change', (e) => this.handleFileSelection(e, 'video'));
        this.elements.mediaFileInput.addEventListener('change', (e) => this.handleFileSelection(e, 'file'));
        
        this.elements.removeFileBtn.addEventListener('click', () => this.removeSelectedFile());
        this.elements.removeHeaderTextBtn.addEventListener('click', () => this.removeHeaderText());
        
        // Header text input
        if (this.elements.headerTextInput) {
            this.elements.headerTextInput.addEventListener('input', (e) => {
                this.headerText = e.target.value;
                this.updateMediaPreview();
            });
        }
        
        // Template/Flow selector
        this.elements.templateType.addEventListener('change', () => this.handleTemplateTypeChange());
        this.elements.templateSelector.addEventListener('change', () => this.handleTemplateSelection());
        
        // Mapeo de variables (plantillas pre-aprobadas)
        if (this.elements.mapVariablesBtn) {
            this.elements.mapVariablesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openVariableMapper();
            });
        }

        // Mapeo de variables (plantillas personalizadas o pre-aprobadas)
        if (this.elements.mapCustomVariablesBtn) {
            this.elements.mapCustomVariablesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Si está usando una plantilla pre-aprobada, usar el mapeador de plantillas
                const templateType = this.elements.templateType.value;
                const templateSelector = this.elements.templateSelector.value;
                const isUsingExistingTemplate = (templateType === 'template' || templateType === 'flow') && templateSelector;
                
                if (isUsingExistingTemplate) {
                    this.openVariableMapper();
                } else {
                    this.openCustomVariableMapper();
                }
            });
        }

        // Inputs de botones: actualizar solo el preview al escribir
        const buttonInputs = [
            document.getElementById('quick_reply_text'),
            document.getElementById('url_text'),
            document.getElementById('url_value'),
            document.getElementById('url_example'),
            document.getElementById('phone_value')
        ];

        buttonInputs.forEach(input => {
            if (!input) return;

            // Mientras escribe: solo actualizar preview (no guardar)
            input.addEventListener('input', () => {
                this.updateMediaPreview();
            });

            // Guardar solo al presionar Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addButton();
                }
            });

            // Guardar al hacer blur (clic fuera) si hay contenido
            input.addEventListener('blur', () => {
                const hasValue =
                    (document.getElementById('quick_reply_text')?.value || '').trim() ||
                    (document.getElementById('url_text')?.value || '').trim() ||
                    (document.getElementById('url_value')?.value || '').trim() ||
                    (document.getElementById('phone_value')?.value || '').trim();

                if (hasValue) {
                    setTimeout(() => {
                        this.addButton();
                    }, 100);
                }
            });
        });
    }

    /**
     * Manejar cambio de tipo de contenido (Plantilla/Flow)
     */
    async handleTemplateTypeChange() {
        const type = this.elements.templateType.value;
        
        // El encabezado siempre debe estar visible
        this.elements.headerMediaSection.style.display = 'block';
        
        if (!type) {
            this.elements.templateSelectorGroup.style.display = 'none';
            this.renderTemplatePreview(null); // Limpiar preview
            return;
        }
        
        // Mostrar selector
        this.elements.templateSelectorGroup.style.display = 'block';
        
        // Cambiar label según tipo y renderizar desde caché
        if (type === 'template') {
            this.elements.templateSelectorLabel.textContent = 'Seleccionar Plantilla Actual';
            await this.loadTemplates();
        } else if (type === 'flow') {
            this.elements.templateSelectorLabel.textContent = 'Seleccionar Flow';
            await this.loadFlows();
        }
    }
    
    /**
     * Cargar plantillas desde 360Dialog API (con caché)
     */
    async loadTemplates() {
        try {
            // Si ya están en caché, usar caché
            if (this.templatesLoaded && this.cachedTemplates) {
                this.renderTemplates(this.cachedTemplates);
                return;
            }
            
            this.elements.templateSelector.innerHTML = '<option value="">Cargando plantillas...</option>';
            
            const response = await fetch('/api/360dialog/templates');
            const data = await response.json();
            
            if (data.success && Array.isArray(data.templates)) {
                // Guardar en caché
                this.cachedTemplates = data.templates;
                this.templatesLoaded = true;
                
                // Renderizar
                this.renderTemplates(this.cachedTemplates);
            } else if (!response.ok) {
                this.elements.templateSelector.innerHTML = '<option value="">Error cargando plantillas</option>';
            } else if (!data.templates || data.templates.length === 0) {
                this.elements.templateSelector.innerHTML = '<option value="">No hay plantillas aprobadas</option>';
            } else {
                this.elements.templateSelector.innerHTML = '<option value="">Error cargando plantillas</option>';
            }
        } catch (error) {
            this.elements.templateSelector.innerHTML = '<option value="">Error de conexión</option>';
        }
    }
    
    /**
     * Renderizar plantillas desde caché
     */
    renderTemplates(templates) {
        this.elements.templateSelector.innerHTML = '<option value="">Seleccionar Plantilla Actual</option>';
        
        templates.forEach((template, index) => {
            const option = document.createElement('option');
            // Usar el nombre de la plantilla como value (es lo que 360Dialog necesita)
            option.value = template.name;
            option.textContent = `${template.name} (${template.language})`;
            option.dataset.templateData = JSON.stringify(template);
            option.dataset.templateId = template.id;  // Guardar ID en dataset si lo necesitamos
            this.elements.templateSelector.appendChild(option);
        });
        
        if (templates.length === 0) {
            this.elements.templateSelector.innerHTML = '<option value="">No hay plantillas aprobadas</option>';
        }
    }
    
    /**
     * Cargar flows desde 360Dialog API (con caché)
     */
    async loadFlows() {
        try {
            // Si ya están en caché, usar caché
            if (this.flowsLoaded && this.cachedFlows) {
                this.renderFlows(this.cachedFlows);
                return;
            }
            
            this.elements.templateSelector.innerHTML = '<option value="">Cargando flows...</option>';
            
            const response = await fetch('/api/360dialog/flows');
            const data = await response.json();
            
            if (data.success && data.flows) {
                // Guardar en caché
                this.cachedFlows = data.flows;
                this.flowsLoaded = true;
                
                // Renderizar
                this.renderFlows(this.cachedFlows);
            } else {
                this.elements.templateSelector.innerHTML = '<option value="">Error cargando flows</option>';
            }
        } catch (error) {
            this.elements.templateSelector.innerHTML = '<option value="">Error de conexión</option>';
        }
    }
    
    /**
     * Renderizar flows desde caché
     */
    renderFlows(flows) {
        this.elements.templateSelector.innerHTML = '<option value="">Seleccionar Flow</option>';
        
        flows.forEach(flow => {
            const option = document.createElement('option');
            option.value = flow.id;
            option.textContent = `${flow.name} (${flow.status})`;
            option.dataset.flowData = JSON.stringify(flow);
            this.elements.templateSelector.appendChild(option);
        });
        
        if (flows.length === 0) {
            this.elements.templateSelector.innerHTML = '<option value="">No hay flows publicados</option>';
        }
    }
    
    /**
     * Manejar selección de plantilla/flow
     */
    handleTemplateSelection() {
        const selectedValue = this.elements.templateSelector.value;
        const type = this.elements.templateType.value;
        
        if (!selectedValue) {
            this.elements.templateSelectorHelp.style.display = 'none';
            this.renderTemplatePreview(null);
            return;
        }
        
        const selectedOption = this.elements.templateSelector.options[this.elements.templateSelector.selectedIndex];
        
        if (type === 'template') {
            const templateData = JSON.parse(selectedOption.dataset.templateData || '{}');
            this.elements.templateSelectorStatus.textContent = `Plantilla "${templateData.name}" seleccionada (${templateData.language})`;
            this.elements.templateSelectorHelp.style.display = 'block';
            this.renderTemplatePreview(templateData);
        } else if (type === 'flow') {
            const flowData = JSON.parse(selectedOption.dataset.flowData || '{}');
            this.elements.templateSelectorStatus.textContent = `Flow "${flowData.name}" seleccionado`;
            this.elements.templateSelectorHelp.style.display = 'block';
            this.renderTemplatePreview(flowData);
        }
    }
    
    /**
     * Renderizar preview de plantilla
     */
    renderTemplatePreview(template) {
        if (!template || !this.elements.messagePreview) {
            // Limpiar preview si no hay plantilla
            if (this.elements.messagePreview) {
                this.elements.messagePreview.innerHTML = '';
            }
            return;
        }
        
        let previewHTML = '';
        let bubbleContent = '';
        let hasButtons = false;
        
        if (template.components && Array.isArray(template.components)) {
            // Agrupar componentes en una sola burbuja
            template.components.forEach((component, index) => {
                if (component.type === 'HEADER') {
                    if (component.format === 'TEXT') {
                        bubbleContent += `<div style="font-size: 14px; line-height: 1.4; color: #1f2937; font-weight: 500; margin-bottom: 8px; text-align: left;">${this.escapeHtml(component.text)}</div>`;
                    } else if (component.format === 'IMAGE') {
                        bubbleContent += `<div style="text-align: center; margin-bottom: 8px;"><i class="far fa-image" style="font-size: 48px; color: #bbb;"></i></div>`;
                    } else if (component.format === 'VIDEO') {
                        bubbleContent += `<div style="text-align: center; margin-bottom: 8px;"><i class="far fa-play-circle" style="font-size: 48px; color: #bbb;"></i></div>`;
                    }
                } else if (component.type === 'BODY') {
                    const bodyText = component.text || '';
                    bubbleContent += `<div style="font-size: 14.2px; line-height: 1.4; color: #1f2937; white-space: pre-wrap; margin-bottom: 8px; text-align: left;">${this.escapeHtml(bodyText)}</div>`;
                } else if (component.type === 'FOOTER') {
                    bubbleContent += `<div style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 8px;">${this.escapeHtml(component.text)}</div>`;
                } else if (component.type === 'BUTTONS') {
                    hasButtons = true;
                    if (component.buttons && Array.isArray(component.buttons)) {
                        bubbleContent += '<div style="margin-top: 12px; border-top: 1px solid rgba(0, 0, 0, 0.08); padding-top: 8px;">';
                        component.buttons.forEach(btn => {
                            bubbleContent += `<div style="padding: 10px 0; text-align: center; font-size: 14px; color: #31a24c; font-weight: 500; border-bottom: 1px solid rgba(0, 0, 0, 0.05);">${this.escapeHtml(btn.text)}</div>`;
                        });
                        bubbleContent += '</div>';
                    }
                }
            });
            
            // Crear una sola burbuja con todo el contenido (mensaje enviado - lado derecho, verde WhatsApp)
            if (bubbleContent) {
                previewHTML += `
                    <div style="
                        background: #dcf8c6;
                        border-radius: 18px;
                        padding: 12px 14px;
                        margin-bottom: 8px;
                        max-width: 80%;
                        margin-left: auto;
                        word-wrap: break-word;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    ">
                        ${bubbleContent}
                        <div style="font-size: 11px; color: #999; text-align: right; margin-top: 6px;">
                            2:24 p.m.
                        </div>
                    </div>
                `;
            }
        } else {
            previewHTML = '';
        }
        
        this.elements.messagePreview.innerHTML = previewHTML;
    }
    
    /**
     * Escapar HTML para prevenir XSS
     * Usar ChatHelpers.escapeHtml() en su lugar
     */
    escapeHtml(text) {
        return ChatHelpers.escapeHtml(text);
    }
    
    /**
     * Mostrar overlay de carga
     */
    showLoading() {
        this.elements.loadingOverlay.style.display = 'flex';
    }

    /**
     * Ocultar overlay de carga
     */
    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
    }

    /**
     * Cargar etiquetas
     */
    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            
            if (data.success) {
                this.tags = data.data || [];
                this.updateTagsFilter();
            }
        } catch (error) {
        }
    }

    /**
     * Cargar campos personalizados
     */
    async loadCustomFields() {
        try {
            const response = await fetch('/api/custom-fields');
            const data = await response.json();
            
            if (data.success) {
                this.customFields = data.data || [];
                this.updateCustomFieldsFilter();
            }
        } catch (error) {
        }
    }

    /**
     * Actualizar filtro de etiquetas
     */
    updateTagsFilter() {
        const options = this.tags.map(tag => `
            <option value="${tag.id}">${tag.name}</option>
        `).join('');
        
        this.elements.filterTag.innerHTML = `
            <option value="">Todas</option>
            ${options}
        `;
    }

    /**
     * Actualizar filtro de campos
     */
    updateCustomFieldsFilter() {
        const options = this.customFields.map(field => `
            <option value="${field.id}">${field.name}</option>
        `).join('');
        
        this.elements.filterCustomField.innerHTML = `
            <option value="">Todos</option>
            ${options}
        `;
    }

    /**
     * Cargar campañas
     */
    async loadCampaigns() {
        try {
            const params = new URLSearchParams();
            params.append('page', this.currentPage);
            params.append('limit', this.pageSize);
            if (this.statusFilter) {
                params.append('status', this.statusFilter);
            }
            
            const response = await fetch(`/api/campaigns?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.campaigns = data.data || [];
                this.totalCampaigns = data.pagination?.total || 0;
                this.renderCampaigns();
                this.updatePagination();
            }
        } catch (error) {
            this.showError('Error al cargar campañas');
        }
    }

    /**
     * Cargar estadísticas
     */
    async loadStats() {
        try {
            const response = await fetch('/api/campaigns');
            const data = await response.json();
            
            if (data.success) {
                const campaigns = data.data || [];
                
                this.elements.totalCampaigns.textContent = campaigns.length;
                this.elements.sentCampaigns.textContent = campaigns.filter(c => c.status === 'sent').length;
                this.elements.scheduledCampaigns.textContent = campaigns.filter(c => c.status === 'scheduled').length;
                this.elements.draftCampaigns.textContent = campaigns.filter(c => c.status === 'draft').length;
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    /**
     * Renderizar campañas
     */
    renderCampaigns() {
        if (this.campaigns.length === 0) {
            this.elements.campaignsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-bullhorn"></i>
                        <h3>No hay campañas</h3>
                        <p>Crea tu primera campaña para comenzar</p>
                        <button class="btn btn-primary" onclick="campaignsManager.showCreateModal()">
                            <i class="fas fa-plus"></i>
                            Crear Campaña
                        </button>
                    </td>
                </tr>
            `;
            this.elements.paginationContainer.style.display = 'none';
            return;
        }

        const html = this.campaigns.map(campaign => this.getCampaignRowHTML(campaign)).join('');
        this.elements.campaignsTableBody.innerHTML = html;
        this.elements.paginationContainer.style.display = 'flex';
    }

    /**
     * Generar HTML de fila de campaña
     */
    getCampaignRowHTML(campaign) {
        const statusClass = `status-${campaign.status}`;
        const statusText = {
            'draft': 'Borrador',
            'scheduled': 'Programada',
            'sending': 'Enviando',
            'sent': 'Enviada',
            'failed': 'Fallida'
        }[campaign.status] || campaign.status;
        
        const date = campaign.scheduled_at || campaign.created_at;
        const formattedDate = new Date(date).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const deliveryRate = campaign.sent_count > 0 
            ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1) 
            : 0;

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${campaign.name}</div>
                    ${campaign.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${campaign.description}</div>` : ''}
                </td>
                <td>${campaign.total_recipients || 0}</td>
                <td>${campaign.sent_count || 0}</td>
                <td>
                    ${campaign.delivered_count || 0} 
                    ${campaign.sent_count > 0 ? `<span style="font-size: 11px; color: #6b7280;">(${deliveryRate}%)</span>` : ''}
                </td>
                <td>
                    <span class="campaign-status ${statusClass}">${statusText}</span>
                </td>
                <td style="font-size: 13px;">${formattedDate}</td>
                <td>
                    <div class="campaign-actions">
                        ${campaign.status === 'draft' || campaign.status === 'scheduled' ? `
                            <button class="btn btn-sm btn-success campaign-send-btn" data-campaign-id="${campaign.id}" title="Enviar">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                            <button class="btn btn-sm btn-outline campaign-edit-btn" data-campaign-id="${campaign.id}" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline campaign-stats-btn" data-campaign-id="${campaign.id}" title="Ver estadísticas">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                        <button class="btn btn-sm btn-danger campaign-delete-btn" data-campaign-id="${campaign.id}" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Actualizar paginación
     */
    updatePagination() {
        const totalPages = Math.ceil(this.totalCampaigns / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalCampaigns);

        this.elements.paginationStart.textContent = start;
        this.elements.paginationEnd.textContent = end;
        this.elements.paginationTotal.textContent = this.totalCampaigns;

        this.elements.prevPage.disabled = this.currentPage === 1;
        this.elements.nextPage.disabled = this.currentPage >= totalPages;

        this.renderPageNumbers(totalPages);
    }

    /**
     * Renderizar números de página
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
                return '<span style="padding: 6px;">...</span>';
            }
            return `
                <button class="page-number ${page === this.currentPage ? 'active' : ''}" 
                        onclick="campaignsManager.changePage(${page})">
                    ${page}
                </button>
            `;
        }).join('');
    }

    /**
     * Cambiar página
     */
    changePage(page) {
        const totalPages = Math.ceil(this.totalCampaigns / this.pageSize);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.loadCampaigns();
    }

    /**
     * Mostrar input de texto para encabezado
     */
    showHeaderTextInput() {
        // Ocultar selector de archivos si está visible
        this.elements.selectedFileInfo.classList.remove('show');
        
        // Desmarcar otros botones
        document.querySelectorAll('.media-btn').forEach(btn => btn.classList.remove('active'));
        
        // Marcar botón de texto como activo
        this.elements.mediaTextBtn.classList.add('active');
        
        // Mostrar input de texto
        this.elements.headerTextInputWrapper.classList.add('show');
        
        // Focus en el input
        setTimeout(() => {
            this.elements.headerTextInput.focus();
        }, 100);
        
        // Limpiar archivo seleccionado
        this.selectedFile = null;
        this.selectedFileType = null;
    }
    
    /**
     * Remover texto de encabezado
     */
    removeHeaderText() {
        // Limpiar input
        this.elements.headerTextInput.value = '';
        
        // Ocultar wrapper
        this.elements.headerTextInputWrapper.classList.remove('show');
        
        // Desmarcar botón
        this.elements.mediaTextBtn.classList.remove('active');
    }
    
    /**
     * Manejar selección de archivo
     */
    handleFileSelection(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar tamaño según tipo
        const maxSizes = {
            'image': 5 * 1024 * 1024,      // 5 MB
            'video': 16 * 1024 * 1024,     // 16 MB
            'file': 50 * 1024 * 1024       // 50 MB
        };
        
        const maxSize = maxSizes[type];
        if (file.size > maxSize) {
            const maxSizeMB = maxSize / (1024 * 1024);
            event.target.value = ''; // Limpiar input
            return;
        }
        
        // Ocultar input de texto si está visible
        this.elements.headerTextInputWrapper.classList.remove('show');
        this.elements.headerTextInput.value = '';
        
        // Guardar archivo seleccionado
        this.selectedFile = file;
        this.selectedFileType = type;
        
        // Actualizar UI con tamaño del archivo
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        this.elements.selectedFileName.textContent = `${file.name} (${fileSizeMB} MB)`;
        this.elements.selectedFileInfo.classList.add('show');
        
        // Marcar botón como activo
        document.querySelectorAll('.media-btn').forEach(btn => btn.classList.remove('active'));
        if (type === 'image') this.elements.mediaImageBtn.classList.add('active');
        if (type === 'video') this.elements.mediaVideoBtn.classList.add('active');
        if (type === 'file') this.elements.mediaFileBtn.classList.add('active');
    }
    
    /**
     * Remover archivo seleccionado
     */
    removeSelectedFile() {
        this.selectedFile = null;
        this.selectedFileType = null;
        
        // Limpiar inputs
        this.elements.mediaImageInput.value = '';
        this.elements.mediaVideoInput.value = '';
        this.elements.mediaFileInput.value = '';
        
        // Ocultar info
        this.elements.selectedFileInfo.classList.remove('show');
        
        // Desmarcar botones
        document.querySelectorAll('.media-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    /**
     * Actualizar preview del mensaje
     */
    updateMessagePreview() {
        const message = this.elements.campaignMessage.value.trim();
        const previewContainer = document.getElementById('messagePreview');
        
        if (!message) {
            previewContainer.className = 'preview-placeholder';
            previewContainer.innerHTML = `
                <i class="far fa-comment-dots" style="font-size: 48px; margin-bottom: 12px; opacity: 0.3;"></i>
                <p>Escribe tu mensaje para ver el preview</p>
            `;
            return;
        }
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        previewContainer.className = '';
        previewContainer.innerHTML = `
            <div class="message-bubble">
                <div class="message-bubble-text">${this.escapeHtml(message)}</div>
                <div class="message-bubble-time">${timeStr}</div>
            </div>
        `;
    }
    
    /**
     * Mostrar modal de crear
     */
    showCreateModal() {
        this.editingCampaign = null;
        this.elements.modalTitle.textContent = 'Enviar mensaje';
        this.clearForm();
        this.updateMessagePreview();
        this.elements.campaignModal.style.display = 'flex';
        
        // Pre-cargar plantillas en background (solo la primera vez)
        if (!this.templatesLoaded) {
            this.loadTemplates().catch(err => {});
        }
    }

    /**
     * Editar campaña
     */
    async editCampaign(id) {
        try {
            const response = await fetch(`/api/campaigns/${id}`);
            const data = await response.json();
            
            if (data.success) {
                this.editingCampaign = data.data;
                this.elements.modalTitle.textContent = 'Editar mensaje';
                
                this.elements.campaignName.value = data.data.name || '';
                this.elements.campaignMessage.value = data.data.message || '';
                this.elements.footerText.value = data.data.footer_text || '';
                this.elements.buttonType.value = data.data.button_type || '';
                this.elements.messageCategory.value = data.data.message_category || '';
                this.elements.messageLanguage.value = data.data.message_language || '';
                this.elements.scheduledAt.value = data.data.scheduled_at 
                    ? new Date(data.data.scheduled_at).toISOString().slice(0, 16)
                    : '';
                
                // Restaurar selección de plantilla si existe
                if (data.data.template_id) {
                    this.elements.templateType.value = 'template';
                    this.elements.templateSelector.value = data.data.template_id;
                    await this.handleTemplateTypeChange();
                    this.handleTemplateSelection();
                } else {
                    this.elements.templateType.value = '';
                    this.elements.templateSelector.value = '';
                    this.elements.templateSelectorGroup.style.display = 'none';
                }
                
                // Aplicar filtros
                if (data.data.filters) {
                    this.elements.filterSearch.value = data.data.filters.search || '';
                    this.elements.filterStatus.value = data.data.filters.status || '';
                    this.elements.filterTag.value = data.data.filters.tag || '';
                    this.elements.filterCustomField.value = data.data.filters.custom_field || '';
                }
                
                this.updateMessagePreview();
                this.elements.campaignModal.style.display = 'flex';
            }
        } catch (error) {
        }
    }

    /**
     * Guardar campaña
     */
    async saveCampaign() {
        const name = this.elements.campaignName.value.trim();
        const message = this.elements.campaignMessage.value.trim();
        const templateType = this.elements.templateType.value;
        const templateSelector = this.elements.templateSelector.value;
        
        // Si usa plantilla existente, no necesita nombre y mensaje
        const isUsingExistingTemplate = (templateType === 'template' || templateType === 'flow') && templateSelector;
        
        // Validación: Siempre necesita nombre
        if (!name) {
            return;
        }
        
        // Validación: Si NO usa plantilla existente, necesita mensaje
        if (!isUsingExistingTemplate && !message) {
            return;
        }
        
        // Validación: Si usa plantilla, debe estar seleccionada
        if (templateType && !templateSelector) {
            return;
        }
        
        this.showLoading();
        
        try {
            // Si es nueva campaña y usa plantilla existente, obtener el ID
            let templateId = null;
            if (!this.editingCampaign && isUsingExistingTemplate) {
                // El templateSelector puede ser un número o un string (UUID)
                templateId = templateSelector;
            } else if (!this.editingCampaign && !isUsingExistingTemplate) {
                // Si es nueva campaña personalizada, crear plantilla primero
                templateId = await this.createAndApproveTemplate(name, message);
            }
            
            const filters = {
                search: this.elements.filterSearch.value || '',
                status: this.elements.filterStatus.value || 'active',
                tag: this.elements.filterTag.value || '',
                custom_field: this.elements.filterCustomField.value || ''
            };
            
            const campaignData = {
                name,
                message: isUsingExistingTemplate ? '' : message,
                footer_text: this.elements.footerText.value.trim(),
                button_type: this.elements.buttonType.value,
                message_category: this.elements.messageCategory.value,
                message_language: this.elements.messageLanguage.value,
                template_id: templateId,
                filters,
                scheduled_at: this.elements.scheduledAt.value || null,
                variable_mapping: this.currentVariableMapping ? JSON.stringify(this.currentVariableMapping) : '{}'
            };
            
            const url = this.editingCampaign 
                ? `/api/campaigns/${this.editingCampaign.id}`
                : '/api/campaigns';
            
            const method = this.editingCampaign ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(campaignData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hideModal();
                await this.loadCampaigns();
                await this.loadStats();
            } else {
                throw new Error(data.error || 'Error al guardar campaña');
            }
        } catch (error) {
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Crear plantilla desde campaña y enviarla a 360Dialog
     */
    async createAndApproveTemplate(campaignName, message) {
        try {
            // Obtener encabezado si existe
            const headerElement = document.getElementById('headerText');
            const headerFormatElement = document.getElementById('headerFormat');
            const headerUrlElement = document.getElementById('headerUrl');

            // Obtener variables y crear mapeo
            // Mapeo: {{1}} -> 'name', {{2}} -> 'email', etc.
            const variablesElement = document.getElementById('campaignVariables');
            const variablesList = variablesElement ? variablesElement.value.split('\n').filter(v => v.trim()) : [];
            
            // Crear ejemplos de variables (para mostrar en 360Dialog)
            const variableExamples = this.getVariableExamples(variablesList);

            // Obtener botones
            const buttons = this.getAddedButtons();

            const templateData = {
                name: campaignName,
                category: this.elements.messageCategory.value || 'MARKETING',
                language: this.elements.messageLanguage.value || 'es',
                message: message,
                variables: variablesList,  // ['name', 'email', 'company']
                variableExamples: variableExamples,  // ['Juan', 'juan@ejemplo.com', 'Acme Corp']
                buttons: buttons,
                businessJustification: 'Campaña de marketing automática'
            };

            // Agregar encabezado si existe
            if (headerElement && headerElement.value.trim()) {
                templateData.header = headerElement.value.trim();
                templateData.headerFormat = headerFormatElement ? headerFormatElement.value : 'TEXT';
                if (headerUrlElement && headerUrlElement.value.trim()) {
                    templateData.headerUrl = headerUrlElement.value.trim();
                }
            }

            // Agregar footer si existe
            if (this.elements.footerText.value.trim()) {
                templateData.footer = this.elements.footerText.value.trim();
            }

            // Crear, aprobar y enviar a 360Dialog
            const response = await fetch('/api/campaign-templates/create-and-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateData,
                    requestedBy: 'campaign'
                })
            });

            const data = await response.json();

            if (data.success) {
                return data.template.id;
            } else {
                throw new Error(data.error || 'Error al crear plantilla');
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtener ejemplos de variables para 360Dialog
     */
    getVariableExamples(variablesList) {
        const examples = [];
        
        variablesList.forEach(varName => {
            let example = '';
            
            switch (varName.toLowerCase()) {
                case 'name':
                    example = 'Juan Pérez';
                    break;
                case 'email':
                    example = 'juan@ejemplo.com';
                    break;
                case 'phone':
                    example = '+573001234567';
                    break;
                case 'company':
                    example = 'Acme Corp';
                    break;
                case 'discount':
                    example = '50%';
                    break;
                case 'code':
                    example = 'PROMO2024';
                    break;
                default:
                    example = varName;
            }
            
            examples.push(example);
        });
        
        return examples;
    }

    /**
     * Obtener botones agregados
     */
    getAddedButtons() {
        const buttons = [];
        const buttonElements = document.querySelectorAll('[data-button-id]');

        buttonElements.forEach(btn => {
            const type = btn.querySelector('[data-button-type]')?.value || 'QUICK_REPLY';
            const text = btn.querySelector('[data-button-text]')?.value || '';
            const url = btn.querySelector('[data-button-url]')?.value || '';
            const phone = btn.querySelector('[data-button-phone]')?.value || '';

            if (text.trim()) {
                buttons.push({
                    type: type,
                    text: text.trim(),
                    url: url.trim(),
                    phone: phone.trim()
                });
            }
        });

        return buttons;
    }

    /**
     * Enviar campaña
     */
    async sendCampaign(id) {
        if (!confirm('¿Estás seguro de que deseas enviar esta campaña? Esta acción no se puede deshacer.')) {
            return;
        }
        
        this.showLoading();
        
        try {
            // Obtener detalles de campaña
            const campaignResponse = await fetch(`/api/campaigns/${id}`);
            const campaignData = await campaignResponse.json();

            if (!campaignData.success) {
                throw new Error('Error obteniendo datos de campaña');
            }

            const campaign = campaignData.data;

            // Calcular destinatarios basado en filtros
            const recipientsResponse = await fetch('/api/campaigns/preview-recipients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: campaign.filters || {}
                })
            });

            const recipientsData = await recipientsResponse.json();

            if (!recipientsData.success) {
                throw new Error('Error obteniendo destinatarios');
            }

            const recipients = recipientsData.data?.contacts || [];

            if (recipients.length === 0) {
                throw new Error('No hay destinatarios para esta campaña');
            }

            // Usar el endpoint de envío de campaña
            const sendResponse = await fetch(`/api/campaigns/${id}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const sendData = await sendResponse.json();

            if (sendData.success) {
                await this.loadCampaigns();
                await this.loadStats();
            } else {
                throw new Error(sendData.error || 'Error al enviar campaña');
            }
        } catch (error) {
            console.error('Error enviando campaña:', error);
            alert('Error al enviar la campaña: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Eliminar campaña
     */
    async deleteCampaign(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta campaña?')) {
            return;
        }
        
        this.showLoading();
        
        try {
            const response = await fetch(`/api/campaigns/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadCampaigns();
                await this.loadStats();
            } else {
                throw new Error(data.error || 'Error al eliminar campaña');
            }
        } catch (error) {
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Ver estadísticas
     */
    async viewStats(id) {
        this.showLoading();
        
        try {
            const response = await fetch(`/api/campaigns/${id}/stats`);
            const data = await response.json();
            
            if (data.success) {
                this.showStatsModal(data.data);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            alert('Error al cargar estadísticas');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Mostrar modal de estadísticas
     */
    showStatsModal(data) {
        document.getElementById('statsModalTitle').textContent = `Estadísticas: ${data.campaign.name}`;
        
        const html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-card-title">Total Mensajes</div>
                    <div class="stat-card-value">${data.stats.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Enviados</div>
                    <div class="stat-card-value" style="color: #10b981;">${data.stats.sent}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Entregados</div>
                    <div class="stat-card-value" style="color: #3b82f6;">${data.stats.delivered}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Leídos</div>
                    <div class="stat-card-value" style="color: #8b5cf6;">${data.stats.read}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Fallidos</div>
                    <div class="stat-card-value" style="color: #ef4444;">${data.stats.failed}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Pendientes</div>
                    <div class="stat-card-value" style="color: #f59e0b;">${data.stats.pending}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-card-title">Tasa de Éxito</div>
                    <div class="stat-card-value" style="font-size: 24px; color: #10b981;">${data.stats.success_rate}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">Tasa de Lectura</div>
                    <div class="stat-card-value" style="font-size: 24px; color: #3b82f6;">${data.stats.read_rate}%</div>
                </div>
            </div>
            
            ${data.recent_messages.length > 0 ? `
                <div>
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #374151;">Mensajes Recientes</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${data.recent_messages.map(msg => `
                            <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-weight: 500;">${msg.contact_name || msg.phone}</span>
                                    <span class="campaign-status status-${msg.status}">${msg.status}</span>
                                </div>
                                <div style="font-size: 12px; color: #6b7280;">
                                    ${msg.phone}
                                    ${msg.sent_at ? ` • ${new Date(msg.sent_at).toLocaleString('es-ES')}` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        document.getElementById('statsModalBody').innerHTML = html;
        this.elements.statsModal.style.display = 'flex';
    }

    /**
     * Previsualizar destinatarios
     */
    async previewRecipients() {
        this.showLoading();
        
        try {
            const filters = {
                search: this.elements.filterSearch.value || '',
                status: this.elements.filterStatus.value || 'active',
                tag: this.elements.filterTag.value || '',
                custom_field: this.elements.filterCustomField.value || ''
            };
            
            const response = await fetch('/api/campaigns/preview-recipients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filters })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.recipientsPreview = data.data;
                this.renderRecipientsPreview();
            }
        } catch (error) {
            console.error('Error previsualizando destinatarios:', error);
            alert('Error al previsualizar destinatarios');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Renderizar previsualización de destinatarios
     */
    renderRecipientsPreview() {
        this.elements.recipientsCount.textContent = `${this.recipientsPreview.total} destinatarios`;
        
        if (this.recipientsPreview.contacts.length > 0) {
            const html = this.recipientsPreview.contacts.map(contact => `
                <div class="recipient-item">
                    <i class="fas fa-user" style="margin-right: 8px; color: #6b7280;"></i>
                    ${contact.name} - ${contact.phone}
                </div>
            `).join('');
            
            this.elements.recipientsList.innerHTML = html;
        } else {
            this.elements.recipientsList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 16px;">No hay destinatarios con estos filtros</div>';
        }
        
        this.elements.recipientsPreview.style.display = 'block';
    }

    /**
     * Limpiar formulario
     */
    clearForm() {
        this.elements.campaignName.value = '';
        this.elements.templateType.value = '';
        this.elements.templateSelector.value = '';
        this.elements.templateSelectorGroup.style.display = 'none';
        this.elements.templateSelectorHelp.style.display = 'none';
        this.elements.campaignMessage.value = '';
        this.elements.footerText.value = '';
        this.elements.buttonType.value = '';
        this.elements.messageCategory.value = '';
        this.elements.messageLanguage.value = '';
        this.elements.scheduledAt.value = '';
        this.elements.filterSearch.value = '';
        this.elements.filterStatus.value = 'active';
        this.elements.filterTag.value = '';
        this.elements.filterCustomField.value = '';
        this.elements.recipientsPreview.style.display = 'none';
        this.removeSelectedFile();
        this.removeHeaderText();
    }

    /**
     * Ocultar modal
     */
    hideModal() {
        this.elements.campaignModal.style.display = 'none';
        this.clearForm();
    }

    /**
     * Ocultar modal de estadísticas
     */
    hideStatsModal() {
        this.elements.statsModal.style.display = 'none';
    }

    /**
     * Manejar selección de archivo
     */
    handleFileSelection(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.selectedFile = file;
        this.selectedFileType = type;
        
        // Mostrar nombre del archivo
        this.elements.selectedFileName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        this.elements.selectedFileInfo.style.display = 'block';
        
        // Ocultar el campo de texto del encabezado cuando hay archivo seleccionado
        // (porque la media ya es el encabezado)
        this.elements.headerTextInputWrapper.style.display = 'none';
        this.headerText = null;
        this.elements.headerTextInput.value = '';
        
        // Actualizar preview
        this.updateMediaPreview();
    }
    
    /**
     * Mostrar input de texto para encabezado
     */
    showHeaderTextInput() {
        // Si hay archivo seleccionado, eliminarlo para que se vea solo el texto
        if (this.selectedFile) {
            this.removeSelectedFile();
        }
        
        this.elements.headerTextInputWrapper.style.display = 'block';
        this.elements.headerTextInput.focus();
    }
    
    /**
     * Remover archivo seleccionado
     */
    removeSelectedFile() {
        this.selectedFile = null;
        this.selectedFileType = null;
        this.elements.selectedFileInfo.style.display = 'none';
        this.elements.mediaImageInput.value = '';
        this.elements.mediaVideoInput.value = '';
        this.elements.mediaFileInput.value = '';
        
        // Nota: El campo de texto del encabezado solo se muestra si el usuario hace clic en el botón de texto
        // Por lo que no lo mostramos automáticamente aquí
        
        this.updateMediaPreview();
    }
    
    /**
     * Remover texto del encabezado
     */
    removeHeaderText() {
        this.headerText = null;
        this.elements.headerTextInputWrapper.style.display = 'none';
        this.elements.headerTextInput.value = '';
        this.updateMediaPreview();
    }
    
    /**
     * Límites de caracteres según políticas de WhatsApp
     */
    getCharacterLimits() {
        return {
            header: { max: 60, variables: 1 },
            body: { max: 1024, variables: null }, // múltiples
            footer: { max: 60, variables: 0 },
            button: { max: 25, variables: 0 }
        };
    }
    
    /**
     * Límites de botones según políticas de WhatsApp
     */
    getButtonLimits() {
        return {
            total: 10, // Máximo 10 botones totales (combinados)
            types: {
                quick_reply: { max: 10, name: 'Quick Reply' }, // Máximo 10 Quick Reply
                url: { max: 2, name: 'URL' },
                phone: { max: 1, name: 'Teléfono' },
                copy_code: { max: 1, name: 'Copiar Código' }
            }
        };
    }
    
    /**
     * Validar caracteres y mostrar advertencia
     */
    validateCharacterCount(text, type) {
        const limits = this.getCharacterLimits();
        const limit = limits[type];
        
        if (!limit) return { valid: true, remaining: 0 };
        
        const count = text.length;
        const remaining = limit.max - count;
        const valid = count <= limit.max;
        
        return { valid, count, remaining, max: limit.max };
    }
    
    /**
     * Validar y obtener botones según políticas de WhatsApp
     */
    getValidatedButtons() {
        const buttons = [];
        const buttonLimits = this.getButtonLimits();
        
        // 1) Botones ya agregados (persistentes)
        if (this.addedButtons && this.addedButtons.length > 0) {
            this.addedButtons.forEach(btn => {
                let displayText = btn.value;
                
                // Para botones URL, mostrar el texto si existe
                if (btn.type === 'url' && btn.text) {
                    displayText = btn.text;
                }
                
                const validation = this.validateCharacterCount(displayText, 'button');
                const typeLabel = btn.label.split(' - ')[0];
                
                buttons.push({
                    type: btn.type,
                    text: displayText,
                    value: btn.value,
                    example: btn.example,
                    valid: validation.valid,
                    charCount: validation.count,
                    charMax: validation.max,
                    typeName: typeLabel
                });
            });
        }

        // 2) Botón actualmente en edición (solo para el preview)
        const currentConfig = this.getButtonConfig();
        if (currentConfig && currentConfig.value) {
            let displayText = currentConfig.value;
            if (currentConfig.type === 'url' && currentConfig.text) {
                displayText = currentConfig.text;
            }

            const validation = this.validateCharacterCount(displayText, 'button');
            const typeLabel = currentConfig.label.split(' - ')[0];

            buttons.push({
                type: currentConfig.type,
                text: displayText,
                value: currentConfig.value,
                example: currentConfig.example,
                valid: validation.valid,
                charCount: validation.count,
                charMax: validation.max,
                typeName: typeLabel
            });
        }
        
        return buttons;
    }
    
    /**
     * Validar si se puede agregar un botón del tipo especificado
     */
    canAddButton(type) {
        const buttonLimits = this.getButtonLimits();
        const buttons = this.getValidatedButtons();
        
        // Contar botones del tipo especificado
        const typeCount = buttons.filter(btn => btn.type === type).length;
        
        // Verificar límites
        const typeLimit = buttonLimits.types[type]?.max || 0;
        const totalLimit = buttonLimits.total;
        
        return {
            canAdd: typeCount < typeLimit && buttons.length < totalLimit,
            typeCount,
            typeLimit,
            totalCount: buttons.length,
            totalLimit
        };
    }
    
    /**
     * Renderizar botones según políticas de WhatsApp
     */
    renderButtons(buttons) {
        if (!buttons || buttons.length === 0) return '';
        
        // Mostrar todos los botones (WhatsApp permite hasta 10)
        let buttonsHTML = '<div style="margin-top: 12px; border-top: 1px solid rgba(0, 0, 0, 0.08); padding-top: 8px;">';
        
        buttons.forEach((btn, index) => {
            const charWarning = !btn.valid ? ' <span style="color: #ef4444;">⚠️ Límite excedido</span>' : '';
            const icon = this.getButtonIcon(btn.type);
            const borderBottom = index < buttons.length - 1 ? 'border-bottom: 1px solid rgba(0, 0, 0, 0.05);' : '';
            
            buttonsHTML += `
                <div style="padding: 10px 0; text-align: center; font-size: 14px; color: #31a24c; font-weight: 500; ${borderBottom}">
                    ${icon} ${this.escapeHtml(btn.text)}${charWarning}
                </div>
            `;
        });
        
        buttonsHTML += '</div>';
        return buttonsHTML;
    }
    
    /**
     * Renderizar preview de media (para imágenes)
     */
    renderMediaPreview(imageDataUrl) {
        const bodyContent = this.buildBubbleContent();
        const headerContent = `<img src="${imageDataUrl}" style="max-width: 100%; height: auto; border-radius: 12px; display: block; margin-bottom: 8px;">`;
        let finalContent = headerContent + bodyContent;
        
        const previewHTML = `
            <div style="
                background: #dcf8c6;
                border-radius: 18px;
                padding: 12px 14px;
                margin-bottom: 8px;
                max-width: 80%;
                margin-left: auto;
                word-wrap: break-word;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            ">
                ${finalContent}
                <div style="font-size: 11px; color: #999; text-align: right; margin-top: 6px;">
                    23:08
                </div>
            </div>
        `;
        
        this.elements.messagePreview.innerHTML = previewHTML;
    }
    
    /**
     * Construir contenido de la burbuja
     * Sigue políticas de WhatsApp:
     * - Encabezado: Opcional (SOLO TEXTO O SOLO MEDIA, no ambos)
     * - Mensaje (Body): Requerido
     * - Pie de página: Opcional
     * - Botones: Opcional (máximo 10)
     */
    buildBubbleContent() {
        let content = '';
        
        // NOTA: El encabezado de texto se maneja en updateMediaPreview()
        // porque puede ser TEXTO O MEDIA, pero no ambos
        
        // Mostrar mensaje (Requerido - solo texto, máx 1024 caracteres)
        if (this.elements.campaignMessage && this.elements.campaignMessage.value) {
            const bodyValidation = this.validateCharacterCount(this.elements.campaignMessage.value, 'body');
            const bodyWarning = !bodyValidation.valid ? '<span style="color: #ef4444; font-size: 11px;"> ⚠️ Límite excedido</span>' : '';
            content += `<div style="font-size: 14.2px; line-height: 1.4; color: #1f2937; white-space: pre-wrap; margin-bottom: 8px; text-align: left;">${this.escapeHtml(this.elements.campaignMessage.value)}${bodyWarning}</div>`;
        }
        
        // Mostrar pie de página si existe (Opcional - máx 60 caracteres)
        if (this.elements.footerText && this.elements.footerText.value) {
            const footerValidation = this.validateCharacterCount(this.elements.footerText.value, 'footer');
            const footerWarning = !footerValidation.valid ? '<span style="color: #ef4444; font-size: 11px;"> ⚠️ Límite excedido</span>' : '';
            content += `<div style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 8px;">${this.escapeHtml(this.elements.footerText.value)}${footerWarning}</div>`;
        }
        
        // Mostrar botones si existen (Opcional - máximo 10, con políticas)
        const buttons = this.getValidatedButtons();
        if (buttons.length > 0) {
            content += this.renderButtons(buttons);
        }
        
        return content;
    }
    
    /**
     * Actualizar preview de medios
     * Políticas de WhatsApp:
     * - Encabezado: SOLO TEXTO O SOLO MEDIA (no ambos)
     * - Si hay archivo (media), se usa como encabezado de media (se oculta headerText)
     * - Si hay headerText sin archivo, se usa como encabezado de texto
     * - No se pueden combinar ambos
     */
    updateMediaPreview() {
        if (!this.elements.messagePreview) return;
        
        // ENCABEZADO: Prioridad a MEDIA sobre TEXTO
        // Si hay archivo seleccionado, se usa como encabezado de media
        if (this.selectedFile) {
            let headerContent = '';
            let mediaUrl = '';
            
            // Para imágenes usar readAsDataURL, para videos usar createObjectURL
            if (this.selectedFileType === 'image') {
                const fileReader = new FileReader();
                fileReader.onload = (e) => {
                    this.renderMediaPreview(e.target.result);
                };
                fileReader.readAsDataURL(this.selectedFile);
                return;
            } else if (this.selectedFileType === 'video') {
                // Usar createObjectURL para videos (evita CSP issues)
                mediaUrl = URL.createObjectURL(this.selectedFile);
                headerContent = `
                    <video style="max-width: 100%; height: auto; border-radius: 12px; display: block; margin-bottom: 8px;" controls>
                        <source src="${mediaUrl}" type="${this.selectedFile.type}">
                    </video>
                `;
            } else if (this.selectedFileType === 'file') {
                headerContent = `
                    <div style="text-align: center; margin-bottom: 8px;">
                        <i class="far fa-file" style="font-size: 32px; color: #666; margin-bottom: 8px; display: block;"></i>
                        <div style="font-size: 12px; color: #1f2937; font-weight: 500;">
                            ${this.escapeHtml(this.selectedFile.name)}
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                            ${(this.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                `;
            }
            
            // Construir burbuja con encabezado de media
            const bodyContent = this.buildBubbleContent();
            let finalContent = headerContent + bodyContent;
            
            const previewHTML = `
                <div style="
                    background: #dcf8c6;
                    border-radius: 18px;
                    padding: 12px 14px;
                    margin-bottom: 8px;
                    max-width: 80%;
                    margin-left: auto;
                    word-wrap: break-word;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                ">
                    ${finalContent}
                    <div style="font-size: 11px; color: #999; text-align: right; margin-top: 6px;">
                        23:08
                    </div>
                </div>
            `;
            
            this.elements.messagePreview.innerHTML = previewHTML;
        } else {
            // Sin archivo: usar encabezado de texto si existe
            let finalContent = '';
            
            if (this.headerText) {
                const headerValidation = this.validateCharacterCount(this.headerText, 'header');
                const headerWarning = !headerValidation.valid ? '<span style="color: #ef4444; font-size: 11px;"> ⚠️ Límite excedido</span>' : '';
                finalContent += `<div style="font-size: 14px; line-height: 1.4; color: #1f2937; font-weight: 500; text-align: left; margin-bottom: 8px;">${this.escapeHtml(this.headerText)}${headerWarning}</div>`;
            }
            
            finalContent += this.buildBubbleContent();
            
            if (finalContent) {
                const previewHTML = `
                    <div style="
                        background: #dcf8c6;
                        border-radius: 18px;
                        padding: 12px 14px;
                        margin-bottom: 8px;
                        max-width: 80%;
                        margin-left: auto;
                        word-wrap: break-word;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    ">
                        ${finalContent}
                        <div style="font-size: 11px; color: #999; text-align: right; margin-top: 6px;">
                            23:08
                        </div>
                    </div>
                `;
                this.elements.messagePreview.innerHTML = previewHTML;
            } else {
                this.elements.messagePreview.innerHTML = '';
            }
        }
    }

    /**
     * Agregar un nuevo botón a la lista
     */
    addButton() {
        const buttonConfig = this.getButtonConfig();
        
        if (!buttonConfig || !buttonConfig.value) {
            alert('Por favor ingresa un valor para el botón');
            return;
        }
        
        // Validar límite de caracteres (máximo 25 para todos los tipos)
        let displayText = buttonConfig.value;
        if (buttonConfig.type === 'url' && buttonConfig.text) {
            displayText = buttonConfig.text;
        }
        
        if (displayText.length > 25) {
            alert(`El texto del botón no puede exceder 25 caracteres.\nActualmente tienes: ${displayText.length} caracteres`);
            return;
        }
        
        // Validar límites de cantidad
        const quickReplyCount = this.addedButtons.filter(b => b.type === 'quick_reply').length;
        const urlCount = this.addedButtons.filter(b => b.type === 'url').length;
        const phoneCount = this.addedButtons.filter(b => b.type === 'phone').length;
        
        if (buttonConfig.type === 'quick_reply' && quickReplyCount >= 10) {
            alert('Máximo 10 botones Quick Reply');
            return;
        }
        if (buttonConfig.type === 'url' && urlCount >= 2) {
            alert('Máximo 2 botones URL');
            return;
        }
        if (buttonConfig.type === 'phone' && phoneCount >= 1) {
            alert('Máximo 1 botón Phone');
            return;
        }
        
        // Agregar botón
        this.buttonCounter++;
        const button = {
            id: this.buttonCounter,
            type: buttonConfig.type,
            value: buttonConfig.value,
            label: buttonConfig.label
        };
        
        this.addedButtons.push(button);
        
        // Limpiar campos
        document.getElementById('quick_reply_text').value = '';
        document.getElementById('url_value').value = '';
        document.getElementById('url_text').value = '';
        document.getElementById('url_example').value = '';
        document.getElementById('phone_value').value = '';
        document.getElementById('buttonType').value = '';
        
        // Actualizar visualización
        this.renderAddedButtons();
        this.updateMediaPreview();
        this.handleButtonTypeChange();
    }

    /**
     * Renderizar lista de botones agregados (vertical)
     */
    renderAddedButtons() {
        const container = document.getElementById('buttonsContainer');
        const listDiv = document.getElementById('addedButtonsList');
        
        if (this.addedButtons.length === 0) {
            listDiv.style.display = 'none';
            return;
        }
        
        listDiv.style.display = 'block';
        container.innerHTML = '';
        
        this.addedButtons.forEach((button, index) => {
            const buttonEl = document.createElement('div');
            const icon = this.getButtonIcon(button.type);
            const typeLabel = button.label.split(' - ')[0];
            
            // Colores por tipo de botón
            let bgColor = '#f0f4ff';
            let borderColor = '#d1d5db';
            let badgeColor = '#6366f1';
            
            if (button.type === 'quick_reply') {
                bgColor = '#f0fdf4';
                borderColor = '#86efac';
                badgeColor = '#10b981';
            } else if (button.type === 'url') {
                bgColor = '#fef3c7';
                borderColor = '#fcd34d';
                badgeColor = '#f59e0b';
            } else if (button.type === 'phone') {
                bgColor = '#fce7f3';
                borderColor = '#fbcfe8';
                badgeColor = '#ec4899';
            }
            
            // Para botones URL, mostrar texto y URL
            let displayValue = this.escapeHtml(button.value);
            let displayTitle = typeLabel;
            
            if (button.type === 'url' && button.text) {
                displayTitle = this.escapeHtml(button.text);
                displayValue = `${this.escapeHtml(button.value)}`;
                if (button.example) {
                    displayValue += ` (${this.escapeHtml(button.example)})`;
                }
            }
            
            buttonEl.style.cssText = `
                background: ${bgColor};
                border: 2px solid ${borderColor};
                border-radius: 8px;
                padding: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                position: relative;
                transition: all 0.3s ease;
                animation: slideIn 0.3s ease-out;
                cursor: pointer;
            `;
            
            buttonEl.innerHTML = `
                <span style="font-size: 20px; flex-shrink: 0;">${icon}</span>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                        ${displayTitle}
                    </div>
                    <div style="font-size: 12px; color: #6b7280; word-break: break-word;">
                        ${displayValue}
                    </div>
                </div>
                
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <button type="button" data-id="${button.id}" class="edit-button" 
                        style="background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 6px 10px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                        ✏️ Editar
                    </button>
                    <button type="button" data-id="${button.id}" class="remove-button" 
                        style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 6px 10px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                        ✕
                    </button>
                </div>
            `;
            
            // Agregar hover effect
            buttonEl.addEventListener('mouseenter', () => {
                buttonEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                buttonEl.style.transform = 'translateX(4px)';
            });
            
            buttonEl.addEventListener('mouseleave', () => {
                buttonEl.style.boxShadow = 'none';
                buttonEl.style.transform = 'translateX(0)';
            });
            
            container.appendChild(buttonEl);
        });
        
        // Agregar animación CSS
        if (!document.getElementById('buttonAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'buttonAnimationStyle';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                .edit-button:hover {
                    background: #2563eb !important;
                    transform: scale(1.05);
                }
                
                .remove-button:hover {
                    background: #dc2626 !important;
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);
        }
        
        // Agregar event listeners a botones de editar
        document.querySelectorAll('.edit-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.getAttribute('data-id'));
                this.editButton(id);
            });
        });
        
        // Agregar event listeners a botones de eliminar
        document.querySelectorAll('.remove-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.getAttribute('data-id'));
                this.removeButton(id);
            });
        });
    }
    
    /**
     * Editar un botón
     */
    editButton(id) {
        const button = this.addedButtons.find(b => b.id === id);
        if (!button) return;
        
        // Cargar valores en los campos
        document.getElementById('buttonType').value = button.type;
        this.handleButtonTypeChange();
        
        // Cargar valores según tipo
        if (button.type === 'quick_reply') {
            document.getElementById('quick_reply_text').value = button.value;
        } else if (button.type === 'url') {
            document.getElementById('url_text').value = button.text || '';
            document.getElementById('url_value').value = button.value || '';
            document.getElementById('url_example').value = button.example || '';
        } else if (button.type === 'phone') {
            document.getElementById('phone_value').value = button.value;
        }
        
        // Eliminar el botón actual
        this.removeButton(id);
        
        // Scroll a los campos
        document.getElementById('buttonType').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Obtener icono del botón
     */
    getButtonIcon(type) {
        switch(type) {
            case 'quick_reply': return '💬';
            case 'url': return '🌐';
            case 'phone': return '📞';
            default: return '🔘';
        }
    }

    /**
     * Eliminar un botón
     */
    removeButton(id) {
        this.addedButtons = this.addedButtons.filter(b => b.id !== id);
        this.renderAddedButtons();
        this.updateMediaPreview();
    }

    /**
     * Obtener todos los botones agregados
     */
    getAllButtons() {
        return this.addedButtons;
    }

    /**
     * Manejar cambio de tipo de botón
     */
    handleButtonTypeChange() {
        const selectedValue = this.elements.buttonType.value;
        const configContainer = document.getElementById('buttonConfigContainer');
        
        if (!configContainer) return;
        
        // Ocultar todos los configs
        document.querySelectorAll('[id^="config_"]').forEach(config => {
            config.style.display = 'none';
        });
        
        // Mostrar el config seleccionado
        if (selectedValue) {
            configContainer.style.display = 'block';
            const configDiv = document.getElementById(`config_${selectedValue}`);
            if (configDiv) {
                configDiv.style.display = 'block';
            }
        } else {
            configContainer.style.display = 'none';
        }
    }

    /**
     * Obtener configuración del botón
     */
    getButtonConfig() {
        const buttonType = this.elements.buttonType.value;
        
        if (!buttonType) {
            return null;
        }
        
        let config = {
            type: buttonType,
            label: this.elements.buttonType.options[this.elements.buttonType.selectedIndex].textContent || ''
        };
        
        switch(buttonType) {
            case 'quick_reply':
                config.value = document.getElementById('quick_reply_text')?.value || '';
                break;
            case 'url':
                const urlText = document.getElementById('url_text')?.value || '';
                const urlValue = document.getElementById('url_value')?.value || '';
                const urlExample = document.getElementById('url_example')?.value || '';
                
                config.value = urlValue;
                config.text = urlText;
                config.example = urlExample;
                
                // Validar que tenga variable si hay ejemplo
                if (urlExample && !urlValue.includes('{{1}}')) {
                    alert('Si ingresas un valor de ejemplo, la URL debe contener {{1}}');
                    return null;
                }
                break;
            case 'phone':
                config.value = document.getElementById('phone_value')?.value || '';
                break;
        }
        
        return config;
    }

    /**
     * Escapar HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Abre el mapeador de variables para plantillas personalizadas
     */
    async openCustomVariableMapper() {
        const messageText = this.elements.campaignMessage ? this.elements.campaignMessage.value : '';
        const headerText = this.headerText || '';
        const footerText = this.elements.footerText ? this.elements.footerText.value : '';
        const templateType = this.elements.templateType.value;
        const templateSelector = this.elements.templateSelector.value;

        // Si está usando una plantilla pre-aprobada, no necesita validar el mensaje
        const isUsingExistingTemplate = (templateType === 'template' || templateType === 'flow') && templateSelector;
        
        // Validar que al menos haya algo escrito (solo si NO usa plantilla pre-aprobada)
        if (!isUsingExistingTemplate && !messageText && !headerText && !footerText) {
            alert('❌ Escribe al menos un mensaje, encabezado o pie de página');
            return;
        }

        // Crear un objeto de plantilla temporal basado en header, body y footer
        const components = [];

        // Agregar header si existe
        if (headerText) {
            components.push({
                type: 'header',
                text: headerText
            });
        }

        // Agregar body (usar mensaje o placeholder si está vacío)
        components.push({
            type: 'body',
            text: messageText || 'Mensaje'
        });

        // Agregar footer si existe
        if (footerText) {
            components.push({
                type: 'footer',
                text: footerText
            });
        }

        const customTemplate = {
            name: 'Plantilla Personalizada',
            components: components
        };

        // Mostrar mapeador
        const mapper = new TemplateVariableMapper();
        mapper.showVariableMapperModal(customTemplate, this.customFields, (mapping) => {
            this.currentVariableMapping = mapping;
            this.updateCustomVariableMappingPreview(mapping);
        });
    }

    /**
     * Actualiza la vista previa del mapeo de variables personalizado
     */
    updateCustomVariableMappingPreview(mapping) {
        if (!mapping || Object.keys(mapping).length === 0) {
            this.elements.customVariableMappingPreview.style.display = 'none';
            return;
        }

        let html = '';
        Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b)).forEach(varNum => {
            const map = mapping[varNum];
            const typeLabels = {
                name: 'Nombre',
                first_name: 'Primer Nombre',
                last_name: 'Apellido',
                phone: 'Teléfono',
                email: 'Email',
                tags: 'Etiquetas',
                status: 'Estado',
                custom_field: 'Campo Personalizado'
            };

            let displayValue = typeLabels[map.type] || map.type;

            if (map.type === 'custom_field') {
                const field = this.customFields.find(f => f.id == map.field);
                const fieldName = field ? field.name : 'Campo Desconocido';
                displayValue = `${fieldName} (Personalizado)`;
            }

            html += `<div style="margin-bottom: 6px;">{{${varNum}}} → <strong>${displayValue}</strong></div>`;
        });

        this.elements.customMappingList.innerHTML = html;
        this.elements.customVariableMappingPreview.style.display = 'block';
    }

    /**
     * Abre el mapeador de variables
     */
    async openVariableMapper() {
        const templateName = this.elements.templateSelector.value;
        
        if (!templateName) {
            alert('❌ Selecciona una plantilla primero');
            return;
        }

        try {
            // Obtener plantilla del servidor usando el nombre
            const response = await fetch(`/api/campaigns/templates/${templateName}`);
            const result = await response.json();

            if (!result.success || !result.data) {
                alert('❌ Error cargando la plantilla');
                return;
            }

            const template = result.data;
            this.currentTemplate = template;

            // Mostrar mapeador
            const mapper = new TemplateVariableMapper();
            mapper.showVariableMapperModal(template, this.customFields, (mapping) => {
                this.currentVariableMapping = mapping;
                this.updateVariableMappingPreview(mapping);
            });
        } catch (error) {
            console.error('Error abriendo mapeador:', error);
            alert('❌ Error abriendo el mapeador de variables');
        }
    }

    /**
     * Actualiza la vista previa del mapeo de variables
     */
    updateVariableMappingPreview(mapping) {
        if (!mapping || Object.keys(mapping).length === 0) {
            this.elements.variableMappingPreview.style.display = 'none';
            return;
        }

        let html = '';
        Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b)).forEach(varNum => {
            const map = mapping[varNum];
            const typeLabels = {
                name: 'Nombre',
                first_name: 'Primer Nombre',
                last_name: 'Apellido',
                phone: 'Teléfono',
                email: 'Email',
                tags: 'Etiquetas',
                status: 'Estado',
                custom_field: 'Campo Personalizado'
            };

            let displayValue = typeLabels[map.type] || map.type;

            if (map.type === 'custom_field') {
                const field = this.customFields.find(f => f.id == map.field);
                const fieldName = field ? field.name : 'Campo Desconocido';
                displayValue = `${fieldName} (Personalizado)`;
            }

            html += `<div style="margin-bottom: 6px;">{{${varNum}}} → <strong>${displayValue}</strong></div>`;
        });

        this.elements.mappingList.innerHTML = html;
        this.elements.variableMappingPreview.style.display = 'block';
    }

    /**
     * Mostrar error
     */
    showError(message) {
        alert(message);
    }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    window.campaignsManager = new CampaignsManager();
});
