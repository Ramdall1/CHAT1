/**
 * Utilidades y funciones auxiliares para el Chat en Vivo
 */

// Formatear tiempo relativo
function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
}

// Formatear número de teléfono
function formatPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/^\+57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
}

// Generar avatar por defecto
function generateAvatar(name, backgroundColor = '667eea') {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=${backgroundColor}&color=fff`;
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Validar número de teléfono
function isValidPhoneNumber(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

// Truncar texto
function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Detectar si es móvil
function isMobile() {
    return window.innerWidth <= 768;
}

// Scroll suave al final
function scrollToBottom(element, smooth = true) {
    if (!element) return;
    element.scrollTo({
        top: element.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

// Debounce function
function debounce(func, wait) {
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

// Exportar funciones globalmente
window.ChatHelpers = {
    formatTimeAgo,
    formatPhoneNumber,
    generateAvatar,
    escapeHtml,
    isValidPhoneNumber,
    truncateText,
    isMobile,
    scrollToBottom,
    debounce
};