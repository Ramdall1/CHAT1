# Guía Práctica: Agregar Botones con Valores

**Fecha:** 22 de Noviembre, 2025
**Versión:** 1.0
**Estado:** ✅ LISTO PARA IMPLEMENTAR

---

## ✅ SÍ, PUEDES AGREGAR BOTONES

Tienes **total libertad** para:
- ✅ Agregar botones nuevos
- ✅ Asignar valores a cada botón
- ✅ Crear diferentes estilos
- ✅ Agregar funcionalidades
- ✅ Personalizar acciones

---

## 🚀 Implementación Rápida

### Paso 1: Agregar HTML del Botón

```html
<!-- En tu archivo HTML (campaigns.html, contacts.html, etc.) -->

<button 
  class="btn btn-primary" 
  data-action="crear" 
  data-type="campaña"
  data-value="nueva_campana"
  id="btn-crear-campana"
>
  ➕ Crear Campaña
</button>
```

### Paso 2: Agregar JavaScript para Manejar el Clic

```javascript
// En tu archivo JavaScript

document.getElementById('btn-crear-campana').addEventListener('click', function() {
  const action = this.getAttribute('data-action');
  const type = this.getAttribute('data-type');
  const value = this.getAttribute('data-value');
  
  console.log({
    accion: action,
    tipo: type,
    valor: value
  });
  
  // Llamar función según la acción
  crearCampana(value);
});

function crearCampana(valor) {
  console.log(`Crear campaña con valor: ${valor}`);
  // Aquí va tu lógica
}
```

---

## 📋 Botones Disponibles por Sección

### 1. Botones de Campaña

```html
<!-- Crear Campaña -->
<button class="btn btn-primary" data-action="crear" data-type="campaña" data-value="nueva">
  ➕ Crear Campaña
</button>

<!-- Editar Campaña -->
<button class="btn btn-success" data-action="editar" data-type="campaña" data-value="editar_id_123">
  ✏️ Editar
</button>

<!-- Enviar Campaña -->
<button class="btn btn-info" data-action="enviar" data-type="campaña" data-value="enviar_id_123">
  📤 Enviar
</button>

<!-- Pausar Campaña -->
<button class="btn btn-warning" data-action="pausar" data-type="campaña" data-value="pausar_id_123">
  ⏸️ Pausar
</button>

<!-- Eliminar Campaña -->
<button class="btn btn-danger" data-action="eliminar" data-type="campaña" data-value="eliminar_id_123">
  🗑️ Eliminar
</button>

<!-- Ver Detalles -->
<button class="btn btn-outline" data-action="ver" data-type="campaña" data-value="detalles_id_123">
  👁️ Ver Detalles
</button>
```

### 2. Botones de Plantilla

```html
<!-- Crear Plantilla -->
<button class="btn btn-primary" data-action="crear" data-type="plantilla" data-value="nueva_plantilla">
  ➕ Nueva Plantilla
</button>

<!-- Duplicar Plantilla -->
<button class="btn btn-info" data-action="duplicar" data-type="plantilla" data-value="duplicar_id_456">
  📋 Duplicar
</button>

<!-- Previsualizar -->
<button class="btn btn-outline" data-action="previsualizar" data-type="plantilla" data-value="preview_id_456">
  👁️ Previsualizar
</button>

<!-- Enviar a Aprobación -->
<button class="btn btn-success" data-action="aprobar" data-type="plantilla" data-value="aprobar_id_456">
  ✅ Enviar a Aprobación
</button>
```

### 3. Botones de Contacto

```html
<!-- Agregar Contacto -->
<button class="btn btn-primary" data-action="crear" data-type="contacto" data-value="nuevo_contacto">
  ➕ Agregar Contacto
</button>

<!-- Editar Contacto -->
<button class="btn btn-success" data-action="editar" data-type="contacto" data-value="editar_id_789">
  ✏️ Editar
</button>

<!-- Enviar Mensaje -->
<button class="btn btn-info" data-action="mensaje" data-type="contacto" data-value="mensaje_id_789">
  💬 Enviar Mensaje
</button>

<!-- Agregar a Grupo -->
<button class="btn btn-outline" data-action="grupo" data-type="contacto" data-value="grupo_id_789">
  👥 Agregar a Grupo
</button>

<!-- Eliminar Contacto -->
<button class="btn btn-danger" data-action="eliminar" data-type="contacto" data-value="eliminar_id_789">
  🗑️ Eliminar
</button>
```

### 4. Botones de Mensaje

```html
<!-- Enviar Mensaje -->
<button class="btn btn-success" data-action="enviar" data-type="mensaje" data-value="enviar_msg">
  📤 Enviar
</button>

<!-- Guardar Borrador -->
<button class="btn btn-outline" data-action="guardar" data-type="mensaje" data-value="guardar_borrador">
  💾 Guardar Borrador
</button>

<!-- Programar Mensaje -->
<button class="btn btn-info" data-action="programar" data-type="mensaje" data-value="programar_msg">
  ⏰ Programar
</button>

<!-- Usar Plantilla -->
<button class="btn btn-outline" data-action="plantilla" data-type="mensaje" data-value="usar_plantilla">
  📋 Usar Plantilla
</button>
```

---

## 🎨 Estilos de Botones Disponibles

```html
<!-- Primario (Azul) -->
<button class="btn btn-primary">Acción Principal</button>

<!-- Éxito (Verde) -->
<button class="btn btn-success">Confirmar</button>

<!-- Peligro (Rojo) -->
<button class="btn btn-danger">Eliminar</button>

<!-- Advertencia (Amarillo) -->
<button class="btn btn-warning">Advertencia</button>

<!-- Información (Cian) -->
<button class="btn btn-info">Información</button>

<!-- Secundario (Gris) -->
<button class="btn btn-outline">Cancelar</button>

<!-- Pequeño -->
<button class="btn btn-sm btn-primary">Pequeño</button>

<!-- Grande -->
<button class="btn btn-lg btn-primary">Grande</button>

<!-- Deshabilitado -->
<button class="btn btn-primary" disabled>Deshabilitado</button>
```

---

## 💻 Código Completo para Implementar

### HTML (En tu archivo HTML)

```html
<div class="button-group">
  <!-- Botones de Campaña -->
  <button class="btn btn-primary" data-action="crear" data-type="campaña" data-value="nueva">
    ➕ Crear Campaña
  </button>
  
  <button class="btn btn-success" data-action="editar" data-type="campaña" data-value="editar">
    ✏️ Editar
  </button>
  
  <button class="btn btn-danger" data-action="eliminar" data-type="campaña" data-value="eliminar">
    🗑️ Eliminar
  </button>
</div>
```

### JavaScript (En tu archivo JS)

```javascript
// Manejar todos los botones con data-action
document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    
    const action = this.getAttribute('data-action');
    const type = this.getAttribute('data-type');
    const value = this.getAttribute('data-value');
    
    console.log('Botón clickeado:', {
      accion: action,
      tipo: type,
      valor: value
    });
    
    // Llamar función según la acción
    procesarAccion(action, type, value);
  });
});

// Función principal para procesar acciones
function procesarAccion(action, type, value) {
  switch(action) {
    case 'crear':
      crearItem(type, value);
      break;
    case 'editar':
      editarItem(type, value);
      break;
    case 'eliminar':
      eliminarItem(type, value);
      break;
    case 'enviar':
      enviarItem(type, value);
      break;
    case 'pausar':
      pausarItem(type, value);
      break;
    case 'ver':
      verDetalles(type, value);
      break;
    default:
      console.log(`Acción no reconocida: ${action}`);
  }
}

// Funciones específicas
function crearItem(type, value) {
  console.log(`Crear nuevo ${type}`);
  // Abrir modal, hacer API call, etc.
}

function editarItem(type, value) {
  console.log(`Editar ${type} con valor: ${value}`);
  // Cargar datos, abrir modal, etc.
}

function eliminarItem(type, value) {
  if(confirm(`¿Estás seguro de que deseas eliminar este ${type}?`)) {
    console.log(`Eliminar ${type} con valor: ${value}`);
    // Hacer API call DELETE
  }
}

function enviarItem(type, value) {
  console.log(`Enviar ${type} con valor: ${value}`);
  // Hacer API call POST
}

function pausarItem(type, value) {
  console.log(`Pausar ${type} con valor: ${value}`);
  // Hacer API call PATCH
}

function verDetalles(type, value) {
  console.log(`Ver detalles de ${type} con valor: ${value}`);
  // Abrir modal con detalles
}
```

---

## 🔗 Enviar Valores al Servidor

```javascript
// Ejemplo: Crear campaña
async function crearItem(type, value) {
  try {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Mi Campaña',
        description: 'Descripción',
        template_id: 1,
        value: value // Tu valor personalizado
      })
    });
    
    const data = await response.json();
    console.log('Campaña creada:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Ejemplo: Editar campaña
async function editarItem(type, value) {
  try {
    const response = await fetch(`/api/campaigns/${value}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Nombre actualizado',
        description: 'Descripción actualizada'
      })
    });
    
    const data = await response.json();
    console.log('Campaña actualizada:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Ejemplo: Eliminar campaña
async function eliminarItem(type, value) {
  try {
    const response = await fetch(`/api/campaigns/${value}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('Campaña eliminada:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## ✅ Checklist de Implementación

- [ ] Agregar botones al HTML
- [ ] Asignar atributos data-* a cada botón
- [ ] Crear event listeners en JavaScript
- [ ] Implementar funciones para cada acción
- [ ] Conectar con API backend
- [ ] Probar en navegador
- [ ] Verificar logs en consola
- [ ] Validar respuestas del servidor

---

## 🎯 Resumen

```
✅ Puedes agregar CUALQUIER botón
✅ Puedes asignar CUALQUIER valor
✅ Puedes crear CUALQUIER estilo
✅ Puedes conectar con API
✅ Puedes personalizar acciones
✅ Tienes total libertad
```

---

**Última actualización:** 22 de Noviembre, 2025
