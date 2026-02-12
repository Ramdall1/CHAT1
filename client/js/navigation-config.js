const NavigationConfig = {
    sections: [
        {
            title: 'Principal',
            items: [
                {
                    icon: '🏠',
                    text: 'Dashboard',
                    url: 'dashboard.html',
                    badge: null,
                    description: 'Panel de control principal unificado'
                }
            ]
        },
        {
            title: 'Conversaciones',
            items: [
                {
                    icon: '💬',
                    text: 'Chat en Vivo',
                    url: '/dashboard/chat-live',
                    badge: null,
                    description: 'Conversaciones en tiempo real'
                },
                {
                    icon: '👥',
                    text: 'Contactos',
                    url: 'contacts.html',
                    badge: null,
                    description: 'Administrar base de contactos'
                },
                {
                    icon: '🏷️',
                    text: 'Etiquetas',
                    url: '#tags',
                    badge: null,
                    description: 'Organizar con etiquetas'
                }
            ]
        },
        {
            title: 'Automatización',
            items: [
                {
                    icon: '🔄',
                    text: 'Flujos',
                    url: 'flows.html',
                    badge: null,
                    description: 'Crear flujos automatizados'
                },
                {
                    icon: '🤖',
                    text: 'IA Conversacional',
                    url: '#ai-admin',
                    badge: null,
                    description: 'Configurar respuestas inteligentes'
                },
                {
                    icon: '⚡',
                    text: 'Triggers',
                    url: '#triggers',
                    badge: null,
                    description: 'Activadores automáticos'
                },
                {
                    icon: '🎯',
                    text: 'Segmentación',
                    url: '#segmentation',
                    badge: null,
                    description: 'Segmentar audiencias'
                }
            ]
        },
        {
            title: 'Difusión',
            items: [
                {
                    icon: '📝',
                    text: 'Plantillas',
                    url: 'templates.html',
                    badge: null,
                    description: 'Gestionar plantillas WhatsApp'
                }
            ]
        },
        {
            title: 'Análisis',
            items: [
                {
                    icon: '📊',
                    text: 'Analytics',
                    url: 'analytics.html',
                    badge: null,
                    description: 'Métricas detalladas'
                },
                {
                    icon: '🎯',
                    text: 'Conversiones',
                    url: '#conversions',
                    badge: null,
                    description: 'Seguimiento de objetivos'
                }
            ]
        },
        {
            title: 'Configuración',
            items: [
                {
                    icon: '🔗',
                    text: 'Integraciones',
                    url: 'integrations.html',
                    badge: null,
                    description: 'APIs y webhooks'
                }
            ]
        }
    ],
    quickActions: [
        {
            icon: '📝',
            title: 'Crear Plantilla',
            description: 'Nueva plantilla WhatsApp',
            url: 'templates.html',
            color: 'success'
        },
        {
            icon: '📊',
            title: 'Ver Analytics',
            description: 'Métricas y estadísticas',
            url: 'analytics.html',
            color: 'warning'
        },
        {
            icon: '👥',
            title: 'Gestionar Contactos',
            description: 'Administrar base de contactos',
            url: 'contacts.html',
            color: 'primary'
        },
        {
            icon: '🔗',
            title: 'Integraciones',
            description: 'Configurar APIs y webhooks',
            url: 'integrations.html',
            color: 'info'
        }
    ],
    branding: {
        name: 'ChatBot Pro',
        subtitle: 'Plataforma de Automatización',
        logo: '🤖'
    },
    generateSidebarHTML: function(currentPage = '') {
        let html = `
            <div class="sidebar-header">
                <div class="logo">${this.branding.logo} ${this.branding.name}</div>
                <div class="logo-subtitle">${this.branding.subtitle}</div>
            </div>
            <div class="sidebar-nav">
        `;

        this.sections.forEach(section => {
            html += `
                <div class="nav-section">
                    <div class="nav-section-title">${section.title}</div>
            `;
            
            section.items.forEach(item => {
                const isActive = currentPage === item.url ? 'active' : '';
                const badge = item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : '';
                html += `
                    <a href="${item.url}" class="nav-item ${isActive}" title="${item.description}">
                        <span class="nav-item-icon">${item.icon}</span>
                        <span class="nav-item-text">${item.text}</span>
                        ${badge}
                    </a>
                `;
            });
            
            html += '</div>';
        });

        html += `
            </div>
        `;
        
        return html;
    },
    generateQuickActionsHTML: function() {
        let html = `
            <div class="quick-actions">
                <h2>Acciones Rápidas</h2>
                <div class="actions-grid">
        `;
        
        this.quickActions.forEach(action => {
            html += `
                <a href="${action.url}" class="action-card">
                    <div class="action-icon">${action.icon}</div>
                    <div class="action-title">${action.title}</div>
                    <div class="action-desc">${action.description}</div>
                </a>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    },
    getPageTitle: function(url) {
        for(const section of this.sections) {
            for(const item of section.items) {
                if(item.url === url) {
                    return item.text;
                }
            }
        }
        return 'Dashboard';
    },
    getCurrentSection: function(url) {
        for(const section of this.sections) {
            for(const item of section.items) {
                if(item.url === url) {
                    return section.title;
                }
            }
        }
        return 'General';
    }
};

function initializeNavigation(currentPage = '') {
    const pageTitle = NavigationConfig.getPageTitle(currentPage);
    document.title = `${pageTitle} - ${NavigationConfig.branding.name}`;
    
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) {
        sidebar.innerHTML = NavigationConfig.generateSidebarHTML(currentPage);
    }
    
    if(!document.querySelector('#navigation-styles')) {
        const styles = document.createElement('style');
        styles.id = 'navigation-styles';
        styles.textContent = `
            .nav-item.active {
                background: rgba(255,255,255,0.15);
                border-left-color: #fff;
            }
            .nav-item:hover {
                background: rgba(255,255,255,0.1);
                border-left-color: #fff;
                transform: translateX(5px);
            }
        `;
        document.head.appendChild(styles);
    }
}

if(typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationConfig;
} else {
    window.NavigationConfig = NavigationConfig;
    window.initializeNavigation = initializeNavigation;
}