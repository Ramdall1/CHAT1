# Guía: Mapeador de Variables de Plantillas

## ¿Qué es el Mapeador de Variables?

Es una interfaz visual que permite al usuario **seleccionar qué dato se enviará en cada variable** de una plantilla.

### Ejemplo:

```
Plantilla: "Hola {{1}}, tu {{2}} es {{3}}"

Mapeo:
{{1}} → Nombre Completo
{{2}} → Apellido
{{3}} → Etiqueta
```

---

## Uso Básico

### 1. Importar el Componente

```html
<!-- En tu HTML -->
<script src="/client/js/template-variable-mapper.js"></script>
```

### 2. Crear Instancia

```javascript
const mapper = new TemplateVariableMapper();
```

### 3. Abrir el Modal

```javascript
const template = {
  components: [
    {
      type: 'body',
      text: 'Hola {{1}}, tu {{2}} es {{3}}'
    }
  ]
};

const customFields = [
  { id: 1, name: 'Empresa', values: ['Acme', 'TechCorp'] },
  { id: 2, name: 'Departamento', values: ['Ventas', 'Soporte'] }
];

mapper.showVariableMapperModal(template, customFields, (mapping) => {
  console.log('Mapeo guardado:', mapping);
  // Resultado:
  // {
  //   1: { type: 'name', field: 'name' },
  //   2: { type: 'last_name', field: 'last_name' },
  //   3: { type: 'tags', field: 'tags' }
  // }
});
```

---

## Opciones Disponibles

### Datos de Contacto

```
- Nombre Completo (name)
- Primer Nombre (first_name)
- Apellido (last_name)
- Teléfono (phone)
- Email (email)
```

### Información

```
- Etiquetas (tags)
- Estado (status)
```

### Campos Personalizados

```
- Cualquier campo personalizado creado en el sistema
- Se puede seleccionar un valor específico del campo
```

---

## Estructura del Mapeo

### Formato de Retorno

```javascript
{
  1: {
    type: 'name',              // Tipo de dato
    field: 'name'              // Campo específico
  },
  2: {
    type: 'custom_field',      // Tipo de campo personalizado
    field: '5',                // ID del campo personalizado
    customValue: 'Ventas'      // Valor específico (opcional)
  },
  3: {
    type: 'tags',
    field: 'tags'
  }
}
```

---

## Ejemplo Completo

### HTML

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
  <button id="mapVariablesBtn">Mapear Variables</button>

  <script src="/client/js/template-variable-mapper.js"></script>
  <script>
    document.getElementById('mapVariablesBtn').addEventListener('click', () => {
      const mapper = new TemplateVariableMapper();

      const template = {
        components: [
          {
            type: 'body',
            text: 'Hola {{1}}, tu pedido {{2}} está listo. Monto: {{3}}'
          }
        ]
      };

      const customFields = [
        { id: 1, name: 'Empresa' },
        { id: 2, name: 'Departamento' }
      ];

      mapper.showVariableMapperModal(template, customFields, (mapping) => {
        console.log('Mapeo:', mapping);
        // Usar el mapeo para enviar la plantilla
        sendTemplateWithMapping(template, mapping);
      });
    });

    function sendTemplateWithMapping(template, mapping) {
      // Aquí iría la lógica para enviar la plantilla
      console.log('Enviando plantilla con mapeo:', mapping);
    }
  </script>
</body>
</html>
```

---

## Integración en Formulario de Campaña

### Paso 1: Agregar Botón en el Formulario

```html
<form id="campaignForm">
  <input type="text" name="campaignName" placeholder="Nombre de campaña">
  
  <select id="templateSelect">
    <option value="">-- Seleccionar plantilla --</option>
    <option value="1">Confirmación de Pedido</option>
    <option value="2">Recordatorio de Cita</option>
  </select>

  <button type="button" id="mapVariablesBtn">
    <i class="fas fa-map"></i> Mapear Variables
  </button>

  <div id="mappingPreview"></div>

  <button type="submit">Guardar Campaña</button>
</form>
```

### Paso 2: Agregar JavaScript

```javascript
let currentMapping = null;

document.getElementById('mapVariablesBtn').addEventListener('click', async () => {
  const templateId = document.getElementById('templateSelect').value;
  
  if (!templateId) {
    alert('Selecciona una plantilla primero');
    return;
  }

  // Obtener plantilla del servidor
  const response = await fetch(`/api/templates/${templateId}`);
  const { data: template } = await response.json();

  // Obtener campos personalizados
  const customFieldsResponse = await fetch('/api/custom-fields');
  const { data: customFields } = await customFieldsResponse.json();

  // Mostrar mapeador
  const mapper = new TemplateVariableMapper();
  mapper.showVariableMapperModal(template, customFields, (mapping) => {
    currentMapping = mapping;
    updateMappingPreview(mapping);
  });
});

function updateMappingPreview(mapping) {
  const preview = document.getElementById('mappingPreview');
  let html = '<div class="mapping-preview"><h4>Mapeo:</h4><ul>';

  Object.keys(mapping).forEach(varNum => {
    const map = mapping[varNum];
    html += `<li>{{${varNum}}} → ${map.type}</li>`;
  });

  html += '</ul></div>';
  preview.innerHTML = html;
}

document.getElementById('campaignForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentMapping) {
    alert('Debes mapear las variables primero');
    return;
  }

  const formData = new FormData(e.target);
  const campaignData = {
    name: formData.get('campaignName'),
    templateId: document.getElementById('templateSelect').value,
    variableMapping: currentMapping
  };

  const response = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaignData)
  });

  const result = await response.json();
  if (result.success) {
    alert('✅ Campaña creada exitosamente');
  }
});
```

---

## Métodos Disponibles

### `showVariableMapperModal(template, customFields, onSave)`

Abre el modal de mapeo de variables.

**Parámetros:**
- `template` (object): Plantilla con componentes
- `customFields` (array): Lista de campos personalizados
- `onSave` (function): Callback cuando se guarda el mapeo

**Ejemplo:**
```javascript
mapper.showVariableMapperModal(
  template,
  customFields,
  (mapping) => console.log('Mapeo guardado:', mapping)
);
```

### `detectVariablesInTemplate(template)`

Detecta todas las variables en una plantilla.

**Retorna:**
```javascript
{
  header: [...],
  body: [...],
  footer: [...],
  total: 3
}
```

---

## Validación

El mapeador valida automáticamente:

✅ **Todas las variables deben estar mapeadas**
- Si falta mapear alguna variable, muestra error

✅ **Tipos de datos válidos**
- Solo permite seleccionar opciones válidas

✅ **Campos personalizados**
- Si se selecciona un campo personalizado, requiere seleccionar un valor

---

## Estilos Personalizados

Si quieres personalizar los estilos, puedes sobrescribir las clases CSS:

```css
.variable-mapper-modal {
  /* Estilos del modal */
}

.variable-row {
  /* Estilos de cada fila de variable */
}

.variable-number {
  /* Estilos del número de variable */
}

.btn-primary {
  /* Estilos del botón guardar */
}
```

---

## Casos de Uso

### Caso 1: Confirmación de Pedido

```javascript
const template = {
  components: [
    {
      type: 'body',
      text: 'Hola {{1}}, tu pedido {{2}} ha sido confirmado. Total: {{3}}'
    }
  ]
};

// Mapeo:
// {{1}} → Nombre Completo
// {{2}} → Campo Personalizado: Número de Pedido
// {{3}} → Campo Personalizado: Monto Total
```

### Caso 2: Recordatorio de Cita

```javascript
const template = {
  components: [
    {
      type: 'header',
      text: 'Recordatorio: {{1}}'
    },
    {
      type: 'body',
      text: 'Tu cita con {{1}} está programada para {{2}}'
    }
  ]
};

// Mapeo:
// {{1}} → Nombre Completo
// {{2}} → Campo Personalizado: Fecha de Cita
```

### Caso 3: Promoción

```javascript
const template = {
  components: [
    {
      type: 'body',
      text: 'Hola {{1}}, tienes {{2}} de descuento en {{3}}'
    }
  ]
};

// Mapeo:
// {{1}} → Nombre Completo
// {{2}} → Campo Personalizado: Porcentaje Descuento
// {{3}} → Etiqueta
```

---

## Flujo Completo de Envío

```javascript
// 1. Abrir mapeador
mapper.showVariableMapperModal(template, customFields, async (mapping) => {
  // 2. Obtener datos del contacto
  const contact = await getContactData(contactId);

  // 3. Construir valores basado en mapeo
  const values = buildValuesFromMapping(contact, mapping);

  // 4. Enviar plantilla
  const payload = prepareTemplatePayload(
    'template_name',
    contact.phone,
    template,
    values
  );

  await sendTemplate(payload);
});

function buildValuesFromMapping(contact, mapping) {
  const values = {};

  Object.keys(mapping).forEach(varNum => {
    const map = mapping[varNum];

    if (map.type === 'custom_field') {
      // Obtener valor del campo personalizado
      values[varNum] = contact.customFields[map.field];
    } else {
      // Obtener valor del contacto
      values[varNum] = contact[map.field];
    }
  });

  return values;
}
```

---

## Resumen

✅ **Características:**
- Interfaz visual para mapear variables
- Soporte para datos de contacto
- Soporte para campos personalizados
- Vista previa en tiempo real
- Validación automática

✅ **Ventajas:**
- Usuario no necesita conocer la estructura técnica
- Previene errores de mapeo
- Interfaz intuitiva y fácil de usar
- Reutilizable en múltiples contextos
