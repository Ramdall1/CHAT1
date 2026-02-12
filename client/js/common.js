// Common utilities for the chat application
// Importar desde utils/helpers.js para evitar duplicación

// Alias para compatibilidad hacia atrás
if (window.ChatHelpers) {
    window.ChatUtils = window.ChatHelpers;
} else {
    console.warn('ChatHelpers no está disponible. Asegúrate de cargar utils/helpers.js');
}