/**
 * Sistema de Navegación Unificada
 * Maneja la navegación común entre todas las páginas del dashboard
 */

// Configuración de navegación
const navigationConfig = {
    logo: {
        text: 'ChatBot Pro',
        icon: 'fas fa-robot'
    },
    sections: [
        {
            title: '',
            items: [
                {
                    text: 'Dashboard Principal',
                    icon: 'fas fa-tachometer-alt',
                    href: '/dashboard',
                    active: true
                }
            ]
        },
        {
            title: 'CONVERSACIONES',
            items: [
                {
                    text: 'Chat en Vivo',
                    icon: 'fas fa-comments',
                    href: '/chat-live',
                    active: false
                },
                {
                    text: 'Gestionar Contactos',
                    icon: 'fas fa-address-book',
                    href: '/contacts.html',
                    active: false
                }
            ]
        },
        {
            title: 'AUTOMATIZACIÓN',
            items: [
                {
                    text: 'Etiquetas Organizadas',
                    icon: 'fas fa-tags',
                    href: '/tags.html',
                    active: false
                },
                {
                    text: 'Flujos Chat Rápidos',
                    icon: 'fas fa-project-diagram',
                    href: '/flows.html',
                    active: false
                },
                {
                    text: 'Plantillas Gestionar',
                    icon: 'fas fa-file-alt',
                    href: '/templates.html',
                    active: false
                }
            ]
        },
        {
            title: 'IA CONVERSACIONAL',
            items: [
                {
                    text: 'Configurar Respuestas Inteligentes',
                    icon: 'fas fa-brain',
                    href: '/ai-config.html',
                    active: false
                },
                {
                    text: 'Triggers Activadores Automáticos',
                    icon: 'fas fa-bolt',
                    href: '/triggers.html',
                    active: false
                }
            ]
        },
        {
            title: 'DIFUSIÓN',
            items: [
                {
                    text: 'Plantillas Gestionar',
                    icon: 'fas fa-file-text',
                    href: '/broadcast-templates.html',
                    active: false
                },
                {
                    text: 'Campañas Crear',
                    icon: 'fas fa-bullhorn',
                    href: '/campaigns.html',
                    active: false
                }
            ]
        },
        {
            title: 'ANÁLISIS',
            items: [
                {
                    text: 'Analytics Métricas',
                    icon: 'fas fa-chart-bar',
                    href: '/analytics.html',
                    active: false
                },
                {
                    text: 'Reportes Informes',
                    icon: 'fas fa-file-chart-line',
                    href: '/reports.html',
                    active: false
                }
            ]
        },
        {
            title: 'CONFIGURACIÓN',
            items: [
                {
                    text: 'General',
                    icon: 'fas fa-cog',
                    href: '/settings.html',
                    active: false
                },
                {
                    text: 'Configuración del Sistema',
                    icon: 'fas fa-tools',
                    href: '/system-config.html',
                    active: false
                }
            ]
        }
    ]
};

/**
 * Inicializa la navegación unificada
 */
function initUnifiedNavigation() {
    try {
        console.log('🚀 Inicializando navegación unificada...');
        
        // Verificar que el DOM esté listo
        if (document.readyState === 'loading') {
            console.log('⏳ DOM aún cargando, esperando...');
            document.addEventListener('DOMContentLoaded', initUnifiedNavigation);
            return;
        }
        
        console.log('📄 DOM listo, procediendo con la inicialización');
        
        // Cargar contenido del sidebar
        const sidebarLoaded = loadSidebarContent();
        if (!sidebarLoaded) {
            console.error('❌ Error: No se pudo cargar el contenido del sidebar');
            return false;
        }
        
        // Configurar eventos de navegación
        setupNavigationEvents();
        
        console.log('✅ Navegación unificada inicializada correctamente');
        return true;
        
    } catch (error) {
        console.error('❌ Error crítico al inicializar la navegación:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

/**
 * Carga el contenido del sidebar
 */
function loadSidebarContent() {
    try {
        console.log('🔄 Iniciando carga del sidebar...');
        
        const sidebar = document.getElementById('unifiedSidebar');
        if (!sidebar) {
            console.error('❌ Error: Elemento #unifiedSidebar no encontrado en el DOM');
            console.log('📋 Elementos disponibles con ID:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return false;
        }
        
        console.log('✅ Elemento sidebar encontrado:', sidebar);
        
        // Verificar si la función generateSidebarHTML existe
        if (typeof generateSidebarHTML !== 'function') {
            console.error('❌ Error: Función generateSidebarHTML no está disponible');
            return false;
        }
        
        // Generar y cargar el HTML
        const sidebarHTML = generateSidebarHTML();
        if (!sidebarHTML || sidebarHTML.trim() === '') {
            console.error('❌ Error: generateSidebarHTML devolvió contenido vacío');
            return false;
        }
        
        console.log('📝 HTML del sidebar generado correctamente');
        sidebar.innerHTML = sidebarHTML;
        
        // Marcar página actual como activa
        markCurrentPageActive();
        
        // Configurar eventos
        setupNavigationEvents();
        
        console.log('✅ Sidebar cargado exitosamente');
        return true;
        
    } catch (error) {
        console.error('❌ Error crítico al cargar el sidebar:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

/**
 * Genera el HTML del sidebar
 */
function generateSidebarHTML() {
    let html = `
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <i class="${navigationConfig.logo.icon}"></i>
                <span>${navigationConfig.logo.text}</span>
            </div>
        </div>
        <nav class="sidebar-nav">
    `;
    
    navigationConfig.sections.forEach(section => {
        html += `
            <div class="nav-section">
                <div class="nav-section-title">${section.title}</div>
                <ul class="nav-items">
        `;
        
        section.items.forEach(item => {
            const activeClass = item.active ? 'active' : '';
            html += `
                <li class="nav-item">
                    <a href="${item.href}" class="nav-link ${activeClass}" data-page="${item.href}">
                        <i class="${item.icon}"></i>
                        <span>${item.text}</span>
                    </a>
                </li>
            `;
        });
        
        html += `
                </ul>
            </div>
        `;
    });
    
    html += `
        </nav>
        <div class="sidebar-footer">
            <div class="user-info">
                <i class="fas fa-user-circle"></i>
                <span>Usuario</span>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Marca la página actual como activa
 */
function markCurrentPageActive() {
    const currentPath = window.location.pathname;
    
    // Resetear todos los estados activos
    navigationConfig.sections.forEach(section => {
        section.items.forEach(item => {
            item.active = false;
        });
    });
    
    // Marcar página actual como activa
    navigationConfig.sections.forEach(section => {
        section.items.forEach(item => {
            if (item.href === currentPath || 
                (currentPath === '/' && item.href === '/index.html') ||
                (currentPath.endsWith(item.href.substring(1)))) {
                item.active = true;
            }
        });
    });
    
    // Actualizar clases en el DOM
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('data-page');
        if (href === currentPath || 
            (currentPath === '/' && href === '/index.html') ||
            (currentPath.endsWith(href.substring(1)))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Configura los eventos de navegación
 */
function setupNavigationEvents() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Permitir navegación normal
            console.log('Navegando a:', this.getAttribute('href'));
        });
    });
}

/**
 * Función para alternar el sidebar en dispositivos móviles
 */
function toggleSidebar() {
    const sidebar = document.getElementById('unifiedSidebar');
    if (sidebar) {
        sidebar.classList.toggle('sidebar-collapsed');
    }
}

// Exportar funciones para uso global
window.initUnifiedNavigation = initUnifiedNavigation;
window.loadSidebarContent = loadSidebarContent;
window.toggleSidebar = toggleSidebar;

// Auto-inicializar si el DOM ya está cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUnifiedNavigation);
} else {
    initUnifiedNavigation();
}