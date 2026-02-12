/**
 * Template Approvals Manager
 * Gestiona el flujo completo de aprobación de plantillas
 */

class TemplateApprovalsManager {
    constructor() {
        this.pendingTemplates = [];
        this.approvedTemplates = [];
        this.rejectedTemplates = [];
        this.stats = {};
        this.currentAction = null;
        this.currentActionTemplate = null;

        this.init();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadStats();
        await this.loadTemplates('pending');
    }

    /**
     * Cachea elementos del DOM
     */
    cacheElements() {
        this.elements = {
            // Tabs
            tabs: document.querySelectorAll('.approval-tab'),
            
            // Content
            pendingContent: document.getElementById('pendingContent'),
            approvedContent: document.getElementById('approvedContent'),
            rejectedContent: document.getElementById('rejectedContent'),
            
            // Stats
            totalCount: document.getElementById('totalCount'),
            pendingCount: document.getElementById('pendingCount'),
            approvedCount: document.getElementById('approvedCount'),
            rejectedCount: document.getElementById('rejectedCount'),
            pendingBadge: document.getElementById('pendingBadge'),
            approvedBadge: document.getElementById('approvedBadge'),
            rejectedBadge: document.getElementById('rejectedBadge'),
            
            // Modals
            approvalModal: document.getElementById('approvalModal'),
            approvalModalOverlay: document.getElementById('approvalModalOverlay'),
            approvalModalTitle: document.getElementById('approvalModalTitle'),
            approvalModalContent: document.getElementById('approvalModalContent'),
            closeApprovalModal: document.getElementById('closeApprovalModal'),
            
            actionModal: document.getElementById('actionModal'),
            actionModalOverlay: document.getElementById('actionModalOverlay'),
            actionModalTitle: document.getElementById('actionModalTitle'),
            actionNotes: document.getElementById('actionNotes'),
            closeActionModal: document.getElementById('closeActionModal'),
            cancelActionBtn: document.getElementById('cancelActionBtn'),
            submitActionBtn: document.getElementById('submitActionBtn')
        };
    }

    /**
     * Vincula eventos
     */
    bindEvents() {
        // Tabs
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.closest('.approval-tab')));
        });

        // Modal close buttons
        this.elements.closeApprovalModal.addEventListener('click', () => this.closeApprovalModal());
        this.elements.approvalModalOverlay.addEventListener('click', () => this.closeApprovalModal());
        
        this.elements.closeActionModal.addEventListener('click', () => this.closeActionModal());
        this.elements.actionModalOverlay.addEventListener('click', () => this.closeActionModal());
        
        this.elements.cancelActionBtn.addEventListener('click', () => this.closeActionModal());
        this.elements.submitActionBtn.addEventListener('click', async () => {
            await this.submitAction();
        });
    }

    /**
     * Cambiar tab
     */
    switchTab(tab) {
        // Remover clase active de todos los tabs
        this.elements.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Ocultar todos los contenidos
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Mostrar contenido del tab seleccionado
        const tabName = tab.dataset.tab;
        const content = document.getElementById(`${tabName}Content`);
        if (content) {
            content.classList.add('active');
        }

        // Cargar plantillas del tab
        this.loadTemplates(tabName);
    }

    /**
     * Cargar plantillas por estado
     */
    async loadTemplates(status) {
        try {
            const response = await fetch(`/api/template-approvals/${status}`);
            const data = await response.json();

            if (data.success) {
                const templates = data.templates || [];
                
                if (status === 'pending') {
                    this.pendingTemplates = templates;
                    this.renderPendingTemplates();
                } else if (status === 'approved') {
                    this.approvedTemplates = templates;
                    this.renderApprovedTemplates();
                } else if (status === 'rejected') {
                    this.rejectedTemplates = templates;
                    this.renderRejectedTemplates();
                }
            }
        } catch (error) {
            console.error(`Error cargando plantillas ${status}:`, error);
            this.showError(`Error al cargar plantillas ${status}`);
        }
    }

    /**
     * Cargar estadísticas
     */
    async loadStats() {
        try {
            const response = await fetch('/api/template-approvals/stats');
            const data = await response.json();

            if (data.success) {
                this.stats = data.stats;
                this.updateStats();
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    /**
     * Actualizar estadísticas en UI
     */
    updateStats() {
        this.elements.totalCount.textContent = this.stats.total || 0;
        this.elements.pendingCount.textContent = this.stats.pending || 0;
        this.elements.approvedCount.textContent = this.stats.approved || 0;
        this.elements.rejectedCount.textContent = this.stats.rejected || 0;
        
        this.elements.pendingBadge.textContent = this.stats.pending || 0;
        this.elements.approvedBadge.textContent = this.stats.approved || 0;
        this.elements.rejectedBadge.textContent = this.stats.rejected || 0;
    }

    /**
     * Renderizar plantillas pendientes
     */
    renderPendingTemplates() {
        if (this.pendingTemplates.length === 0) {
            this.elements.pendingContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>No hay plantillas pendientes</h3>
                    <p>Todas las plantillas han sido procesadas</p>
                </div>
            `;
            return;
        }

        const html = this.pendingTemplates.map(template => this.getTemplateCardHTML(template, 'pending')).join('');
        this.elements.pendingContent.innerHTML = html;
        this.attachCardEvents('pending');
    }

    /**
     * Renderizar plantillas aprobadas
     */
    renderApprovedTemplates() {
        if (this.approvedTemplates.length === 0) {
            this.elements.approvedContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No hay plantillas aprobadas</h3>
                    <p>Las plantillas aprobadas aparecerán aquí</p>
                </div>
            `;
            return;
        }

        const html = this.approvedTemplates.map(template => this.getTemplateCardHTML(template, 'approved')).join('');
        this.elements.approvedContent.innerHTML = html;
        this.attachCardEvents('approved');
    }

    /**
     * Renderizar plantillas rechazadas
     */
    renderRejectedTemplates() {
        if (this.rejectedTemplates.length === 0) {
            this.elements.rejectedContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-times-circle"></i>
                    <h3>No hay plantillas rechazadas</h3>
                    <p>Las plantillas rechazadas aparecerán aquí</p>
                </div>
            `;
            return;
        }

        const html = this.rejectedTemplates.map(template => this.getTemplateCardHTML(template, 'rejected')).join('');
        this.elements.rejectedContent.innerHTML = html;
        this.attachCardEvents('rejected');
    }

    /**
     * Generar HTML de tarjeta de plantilla
     */
    getTemplateCardHTML(template, status) {
        const templateData = template.templateData || {};
        const requestedAt = new Date(template.requestedAt).toLocaleString('es-ES');
        
        let statusBadgeClass = status;
        let statusText = {
            'pending': 'Pendiente',
            'approved': 'Aprobada',
            'rejected': 'Rechazada'
        }[status] || status;

        let actionsHTML = '';
        if (status === 'pending') {
            actionsHTML = `
                <button class="btn-approve" data-action="approve" data-template-id="${template.id}">
                    <i class="fas fa-check"></i> Aprobar
                </button>
                <button class="btn-reject" data-action="reject" data-template-id="${template.id}">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            `;
        } else if (status === 'approved') {
            actionsHTML = `
                <button class="btn-view" data-action="send-360dialog" data-template-id="${template.id}">
                    <i class="fas fa-paper-plane"></i> Enviar a 360Dialog
                </button>
            `;
        }

        return `
            <div class="approval-card" data-template-id="${template.id}">
                <div class="approval-card-header">
                    <h3 class="approval-card-title">${ChatHelpers.escapeHtml(templateData.name || 'Sin nombre')}</h3>
                    <span class="approval-status-badge ${statusBadgeClass}">${statusText}</span>
                </div>
                
                <div class="approval-card-meta">
                    <div class="approval-card-meta-item">
                        <strong>Solicitado:</strong> ${requestedAt}
                    </div>
                    <div class="approval-card-meta-item">
                        <strong>Categoría:</strong> ${ChatHelpers.escapeHtml(templateData.category || 'General')}
                    </div>
                    <div class="approval-card-meta-item">
                        <strong>Idioma:</strong> ${ChatHelpers.escapeHtml(templateData.language || 'Español')}
                    </div>
                </div>

                ${this.getValidationHTML(template)}

                <div class="approval-card-content">
                    ${this.getTemplatePreview(templateData)}
                </div>

                <div class="approval-card-actions">
                    <button class="btn-view" data-action="view" data-template-id="${template.id}">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Obtener HTML de validación
     */
    getValidationHTML(template) {
        if (!template.validation) return '';

        const validation = template.validation;
        const score = validation.score || 0;

        let html = `
            <div class="validation-score">
                <div class="validation-score-bar">
                    <div class="validation-score-fill" style="width: ${score}%"></div>
                </div>
                <div class="validation-score-text">${score}%</div>
            </div>
        `;

        if (validation.errors && validation.errors.length > 0) {
            html += `
                <div class="validation-errors">
                    <strong>Errores:</strong>
                    <ul>
                        ${validation.errors.map(error => `<li>${ChatHelpers.escapeHtml(error)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (validation.warnings && validation.warnings.length > 0) {
            html += `
                <div class="validation-warnings">
                    <strong>Advertencias:</strong>
                    <ul>
                        ${validation.warnings.map(warning => `<li>${ChatHelpers.escapeHtml(warning)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        return html;
    }

    /**
     * Obtener preview de plantilla
     */
    getTemplatePreview(templateData) {
        let preview = '';

        if (templateData.components && Array.isArray(templateData.components)) {
            templateData.components.forEach(component => {
                if (component.type === 'HEADER' && component.text) {
                    preview += `<strong>Encabezado:</strong> ${ChatHelpers.escapeHtml(component.text)}<br>`;
                }
                if (component.type === 'BODY' && component.text) {
                    preview += `<strong>Cuerpo:</strong> ${ChatHelpers.escapeHtml(component.text)}<br>`;
                }
                if (component.type === 'FOOTER' && component.text) {
                    preview += `<strong>Pie:</strong> ${ChatHelpers.escapeHtml(component.text)}<br>`;
                }
            });
        }

        return preview || '<em>Sin contenido disponible</em>';
    }

    /**
     * Adjuntar eventos a tarjetas
     */
    attachCardEvents(status) {
        const content = status === 'pending' ? this.elements.pendingContent :
                       status === 'approved' ? this.elements.approvedContent :
                       this.elements.rejectedContent;

        content.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('[data-action="view"]');
            const approveBtn = e.target.closest('[data-action="approve"]');
            const rejectBtn = e.target.closest('[data-action="reject"]');
            const send360Btn = e.target.closest('[data-action="send-360dialog"]');

            if (viewBtn) {
                const templateId = viewBtn.dataset.templateId;
                await this.showTemplateDetails(templateId, status);
            } else if (approveBtn) {
                const templateId = approveBtn.dataset.templateId;
                this.showActionModal('approve', templateId);
            } else if (rejectBtn) {
                const templateId = rejectBtn.dataset.templateId;
                this.showActionModal('reject', templateId);
            } else if (send360Btn) {
                const templateId = send360Btn.dataset.templateId;
                await this.sendTemplateToDialog360(templateId);
            }
        });
    }

    /**
     * Enviar plantilla a 360Dialog
     */
    async sendTemplateToDialog360(templateId) {
        if (!confirm('¿Enviar esta plantilla a 360Dialog para aprobación?')) {
            return;
        }

        try {
            const response = await fetch(`/api/template-approvals/send-to-360dialog/${templateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                alert(`✅ Plantilla enviada a 360Dialog\nID: ${data.dialog360Id}\nEstado: ${data.dialog360Status}`);
                await this.loadStats();
                await this.loadTemplates('approved');
            } else {
                throw new Error(data.error || 'Error al enviar');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`❌ Error: ${error.message}`);
        }
    }

    /**
     * Mostrar detalles de plantilla
     */
    async showTemplateDetails(templateId, status) {
        let template = null;

        if (status === 'pending') {
            template = this.pendingTemplates.find(t => t.id === templateId);
        } else if (status === 'approved') {
            template = this.approvedTemplates.find(t => t.id === templateId);
        } else if (status === 'rejected') {
            template = this.rejectedTemplates.find(t => t.id === templateId);
        }

        if (!template) return;

        const templateData = template.templateData || {};
        const html = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4 style="margin-top: 0;">Información General</h4>
                <p><strong>Nombre:</strong> ${ChatHelpers.escapeHtml(templateData.name || 'N/A')}</p>
                <p><strong>Categoría:</strong> ${ChatHelpers.escapeHtml(templateData.category || 'N/A')}</p>
                <p><strong>Idioma:</strong> ${ChatHelpers.escapeHtml(templateData.language || 'N/A')}</p>
                <p><strong>Solicitado por:</strong> ${ChatHelpers.escapeHtml(template.requestedBy || 'N/A')}</p>
                <p><strong>Fecha de solicitud:</strong> ${new Date(template.requestedAt).toLocaleString('es-ES')}</p>

                ${template.approvedAt ? `
                    <h4>Información de Aprobación</h4>
                    <p><strong>Aprobado por:</strong> ${ChatHelpers.escapeHtml(template.approvedBy || 'N/A')}</p>
                    <p><strong>Fecha de aprobación:</strong> ${new Date(template.approvedAt).toLocaleString('es-ES')}</p>
                    ${template.approvalNotes ? `<p><strong>Notas:</strong> ${ChatHelpers.escapeHtml(template.approvalNotes)}</p>` : ''}
                ` : ''}

                ${template.rejectedAt ? `
                    <h4>Información de Rechazo</h4>
                    <p><strong>Rechazado por:</strong> ${ChatHelpers.escapeHtml(template.rejectedBy || 'N/A')}</p>
                    <p><strong>Fecha de rechazo:</strong> ${new Date(template.rejectedAt).toLocaleString('es-ES')}</p>
                    <p><strong>Razón:</strong> ${ChatHelpers.escapeHtml(template.rejectionReason || 'N/A')}</p>
                ` : ''}

                <h4>Contenido de la Plantilla</h4>
                <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px;">
                    ${this.getTemplatePreview(templateData)}
                </div>

                ${templateData.businessJustification ? `
                    <h4>Justificación Comercial</h4>
                    <p>${ChatHelpers.escapeHtml(templateData.businessJustification)}</p>
                ` : ''}
            </div>
        `;

        this.elements.approvalModalTitle.textContent = `Detalles: ${templateData.name || 'Plantilla'}`;
        this.elements.approvalModalContent.innerHTML = html;
        this.openApprovalModal();
    }

    /**
     * Mostrar modal de acción
     */
    showActionModal(action, templateId) {
        this.currentAction = action;
        this.currentActionTemplate = templateId;

        const actionText = action === 'approve' ? 'Aprobar' : 'Rechazar';
        const actionTitle = action === 'approve' ? 'Aprobar Plantilla' : 'Rechazar Plantilla';

        this.elements.actionModalTitle.textContent = actionTitle;
        this.elements.actionNotes.placeholder = action === 'approve' ? 
            'Notas de aprobación (opcional)' : 
            'Razón del rechazo (requerido)';
        this.elements.actionNotes.value = '';

        if (action === 'reject') {
            this.elements.actionNotes.required = true;
        } else {
            this.elements.actionNotes.required = false;
        }

        this.openActionModal();
    }

    /**
     * Enviar acción (aprobar/rechazar)
     */
    async submitAction() {
        const notes = this.elements.actionNotes.value.trim();

        if (this.currentAction === 'reject' && !notes) {
            alert('La razón del rechazo es requerida');
            return;
        }

        try {
            const endpoint = this.currentAction === 'approve' ? 
                `/api/template-approvals/approve/${this.currentActionTemplate}` :
                `/api/template-approvals/reject/${this.currentActionTemplate}`;

            const body = this.currentAction === 'approve' ? 
                { approvedBy: 'admin', notes } :
                { rejectedBy: 'admin', reason: notes };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                const actionText = this.currentAction === 'approve' ? 'aprobada' : 'rechazada';
                alert(`Plantilla ${actionText} correctamente`);
                
                this.closeActionModal();
                await this.loadStats();
                await this.loadTemplates('pending');
                await this.loadTemplates('approved');
                await this.loadTemplates('rejected');
            } else {
                throw new Error(data.error || 'Error al procesar la acción');
            }
        } catch (error) {
            console.error('Error en acción:', error);
            alert(`Error: ${error.message}`);
        }
    }

    /**
     * Abrir modal de aprobación
     */
    openApprovalModal() {
        this.elements.approvalModal.classList.add('active');
        this.elements.approvalModalOverlay.classList.add('active');
    }

    /**
     * Cerrar modal de aprobación
     */
    closeApprovalModal() {
        this.elements.approvalModal.classList.remove('active');
        this.elements.approvalModalOverlay.classList.remove('active');
    }

    /**
     * Abrir modal de acción
     */
    openActionModal() {
        this.elements.actionModal.classList.add('active');
        this.elements.actionModalOverlay.classList.add('active');
    }

    /**
     * Cerrar modal de acción
     */
    closeActionModal() {
        this.elements.actionModal.classList.remove('active');
        this.elements.actionModalOverlay.classList.remove('active');
        this.currentAction = null;
        this.currentActionTemplate = null;
    }

    /**
     * Mostrar error
     */
    showError(message) {
        alert(`❌ ${message}`);
    }
}
