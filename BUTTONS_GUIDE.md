# Guía de Botones - Variedad y Valores

**Fecha:** 22 de Noviembre, 2025
**Versión:** 1.0

---

## 🎨 Tipos de Botones Disponibles

### 1. Botones HTML Básicos

```html
<!-- Botón básico -->
<button>Click aquí</button>

<!-- Botón con clase -->
<button class="btn btn-primary">Primario</button>

<!-- Botón con ID y atributos -->
<button id="btn-submit" class="btn btn-success" type="submit">Enviar</button>
```

---

## 🎯 Agregar Variedad de Botones

### Opción 1: Usando Bootstrap (Recomendado)

```html
<!-- Botones de Bootstrap -->
<button class="btn btn-primary">Primario</button>
<button class="btn btn-secondary">Secundario</button>
<button class="btn btn-success">Éxito</button>
<button class="btn btn-danger">Peligro</button>
<button class="btn btn-warning">Advertencia</button>
<button class="btn btn-info">Información</button>
<button class="btn btn-light">Claro</button>
<button class="btn btn-dark">Oscuro</button>

<!-- Botones con tamaños -->
<button class="btn btn-primary btn-lg">Grande</button>
<button class="btn btn-primary btn-sm">Pequeño</button>

<!-- Botones deshabilitados -->
<button class="btn btn-primary" disabled>Deshabilitado</button>

<!-- Botones con iconos -->
<button class="btn btn-primary">
  <i class="fas fa-save"></i> Guardar
</button>
```

### Opción 2: Usando TailwindCSS

```html
<!-- Botones de Tailwind -->
<button class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded">
  Primario
</button>

<button class="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded">
  Éxito
</button>

<button class="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded">
  Peligro
</button>

<!-- Botones con tamaños -->
<button class="bg-blue-500 text-white px-6 py-3 rounded text-lg">
  Grande
</button>

<button class="bg-blue-500 text-white px-2 py-1 rounded text-sm">
  Pequeño
</button>
```

### Opción 3: CSS Personalizado

```css
/* Estilos personalizados */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #c82333;
}
```

---

## 💾 Agregar Valores a Cada Botón

### Opción 1: Usando Atributos HTML

```html
<!-- Atributo data-* -->
<button class="btn btn-primary" data-value="opcion1" data-id="123">
  Opción 1
</button>

<button class="btn btn-success" data-value="opcion2" data-id="456">
  Opción 2
</button>

<!-- Atributo value -->
<button class="btn btn-danger" value="eliminar" name="accion">
  Eliminar
</button>
```

### Opción 2: Usando JavaScript

```javascript
// Agregar evento a botones
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const value = this.getAttribute('data-value');
    const id = this.getAttribute('data-id');
    
    console.log('Botón clickeado:', {
      valor: value,
      id: id,
      texto: this.textContent
    });
    
    // Hacer algo con el valor
    procesarBoton(value, id);
  });
});

function procesarBoton(valor, id) {
  console.log(`Procesando: ${valor} con ID: ${id}`);
}
```

### Opción 3: Usando Formularios

```html
<form id="miFormulario">
  <!-- Botones con valores en formulario -->
  <button type="submit" name="accion" value="guardar" class="btn btn-success">
    Guardar
  </button>
  
  <button type="submit" name="accion" value="cancelar" class="btn btn-secondary">
    Cancelar
  </button>
  
  <button type="submit" name="accion" value="eliminar" class="btn btn-danger">
    Eliminar
  </button>
</form>

<script>
document.getElementById('miFormulario').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const formData = new FormData(this);
  const accion = formData.get('accion');
  
  console.log('Acción seleccionada:', accion);
  
  // Enviar al servidor
  fetch('/api/procesar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion })
  });
});
</script>
```

---

## 🎨 Ejemplo Completo: Panel de Control

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">
  <style>
    .btn-group-custom {
      display: flex;
      gap: 10px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container mt-5">
    <h1>Panel de Control</h1>
    
    <!-- Grupo de botones -->
    <div class="btn-group-custom">
      <button class="btn btn-primary" data-action="crear" data-type="contacto">
        ➕ Crear Contacto
      </button>
      
      <button class="btn btn-success" data-action="editar" data-type="contacto">
        ✏️ Editar Contacto
      </button>
      
      <button class="btn btn-info" data-action="ver" data-type="contacto">
        👁️ Ver Detalles
      </button>
      
      <button class="btn btn-danger" data-action="eliminar" data-type="contacto">
        🗑️ Eliminar
      </button>
    </div>
    
    <!-- Tabla con botones -->
    <table class="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Juan Pérez</td>
          <td>juan@example.com</td>
          <td>
            <button class="btn btn-sm btn-primary" data-id="1" data-action="editar">Editar</button>
            <button class="btn btn-sm btn-danger" data-id="1" data-action="eliminar">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    // Manejar clics en botones
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        const type = this.getAttribute('data-type');
        const id = this.getAttribute('data-id');
        
        console.log({
          accion: action,
          tipo: type,
          id: id
        });
        
        // Llamar función según acción
        switch(action) {
          case 'crear':
            crearItem(type);
            break;
          case 'editar':
            editarItem(type, id);
            break;
          case 'eliminar':
            eliminarItem(type, id);
            break;
          case 'ver':
            verDetalles(type, id);
            break;
        }
      });
    });
    
    function crearItem(type) {
      console.log(`Crear nuevo ${type}`);
      // Lógica para crear
    }
    
    function editarItem(type, id) {
      console.log(`Editar ${type} con ID: ${id}`);
      // Lógica para editar
    }
    
    function eliminarItem(type, id) {
      console.log(`Eliminar ${type} con ID: ${id}`);
      // Lógica para eliminar
    }
    
    function verDetalles(type, id) {
      console.log(`Ver detalles de ${type} con ID: ${id}`);
      // Lógica para ver detalles
    }
  </script>
</body>
</html>
```

---

## 🔗 Agregar Botones en Rutas Express

```javascript
// En tu ruta Express
router.post('/procesar-boton', (req, res) => {
  const { accion, tipo, id } = req.body;
  
  switch(accion) {
    case 'crear':
      // Crear lógica
      res.json({ success: true, mensaje: `${tipo} creado` });
      break;
    case 'editar':
      // Editar lógica
      res.json({ success: true, mensaje: `${tipo} ${id} editado` });
      break;
    case 'eliminar':
      // Eliminar lógica
      res.json({ success: true, mensaje: `${tipo} ${id} eliminado` });
      break;
    default:
      res.status(400).json({ error: 'Acción no válida' });
  }
});
```

---

## 📋 Resumen

| Aspecto | Cómo Hacerlo |
|---------|-------------|
| **Variedad de botones** | Usar clases CSS (btn-primary, btn-success, etc.) |
| **Agregar valores** | Usar atributos data-* o value |
| **Manejar clics** | addEventListener en JavaScript |
| **Enviar datos** | fetch() o formulario HTML |
| **Estilos** | Bootstrap, TailwindCSS o CSS personalizado |

---

**Última actualización:** 22 de Noviembre, 2025
