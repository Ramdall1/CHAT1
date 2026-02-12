/**
 * Sidebar Navigation Manager
 * Maneja la actualización de la clase 'active' en el menú según la página actual
 */

document.addEventListener('DOMContentLoaded', function() {
  updateActiveSidebarItem();
});

/**
 * Actualiza el elemento activo del sidebar según la URL actual
 */
function updateActiveSidebarItem() {
  // Obtener la ruta actual
  const currentPath = window.location.pathname;
  
  // Obtener todos los items del menú
  const menuItems = document.querySelectorAll('.menu-item');
  
  // Remover clase 'active' de todos los items
  menuItems.forEach(item => {
    item.classList.remove('active');
  });
  
  // Agregar clase 'active' al item correspondiente
  menuItems.forEach(item => {
    const href = item.getAttribute('href');
    
    // Comparar la ruta actual con el href del item
    if (currentPath === href || currentPath === href + '/') {
      item.classList.add('active');
    }
  });
}

// Actualizar cuando se navega usando el historial del navegador
window.addEventListener('popstate', updateActiveSidebarItem);

// Actualizar cuando se hace clic en un link del sidebar
document.addEventListener('click', function(e) {
  if (e.target.closest('.menu-item')) {
    // Pequeño delay para asegurar que la navegación ocurra
    setTimeout(updateActiveSidebarItem, 100);
  }
});
