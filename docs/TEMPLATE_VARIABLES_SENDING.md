# Guía: Envío de Plantillas con Variables

## Cómo Agregar Variables al Enviar Plantillas

### 1. Detectar Variables en una Plantilla

Primero, detecta qué variables tiene una plantilla:

```javascript
import { detectVariablesInTemplate } from '../utils/templateVariableHandler.js';

const template = {
  components: [
    { type: 'header', text: 'Hola {{1}}' },
    { type: 'body', text: 'Tu pedido {{2}} está listo. Total: {{3}}' }
  ]
};

const variables = detectVariablesInTemplate(template);
console.log(variables);
// Resultado:
// {
//   header: [{ number: 1, full: '{{1}}', index: 6 }],
//   body: [
//     { number: 2, full: '{{2}}', index: 10 },
//     { number: 3, full: '{{3}}', index: 32 }
//   ],
//   total: 3
// }
```

---

### 2. Validar Valores Antes de Enviar

Valida que proporciones todos los valores requeridos:

```javascript
import { validateTemplateValues } from '../utils/templateVariableHandler.js';

const values = {
  1: 'María García',
  2: 'PED-2024-001',
  3: '$150.00'
};

const validation = validateTemplateValues(template, values);

if (!validation.isValid) {
  console.error('❌ Errores de validación:', validation.errors);
  // Errores: ["❌ Valor requerido para variable {{1}}", ...]
} else {
  console.log('✅ Valores válidos');
}
```

---

### 3. Obtener Preview de la Plantilla

Visualiza cómo se vería la plantilla con los valores:

```javascript
import { getTemplatePreview } from '../utils/templateVariableHandler.js';

const preview = getTemplatePreview(template, values);
console.log(preview);
// Resultado:
// {
//   header: 'Hola María García',
//   body: 'Tu pedido PED-2024-001 está listo. Total: $150.00',
//   footer: null
// }
```

---

### 4. Preparar Payload para Enviar

Construye el payload listo para enviar a 360Dialog:

```javascript
import { prepareTemplatePayload } from '../utils/templateVariableHandler.js';

const payload = prepareTemplatePayload(
  'confirmacion_pedido',      // Nombre de la plantilla
  '573113705258',             // Número de teléfono
  template,                   // Objeto de plantilla
  values,                     // Valores {1: "...", 2: "...", ...}
  'es'                        // Código de idioma (opcional)
);

console.log(JSON.stringify(payload, null, 2));
// Resultado:
// {
//   "messaging_product": "whatsapp",
//   "to": "573113705258",
//   "type": "template",
//   "template": {
//     "name": "confirmacion_pedido",
//     "language": { "code": "es" },
//     "components": [
//       {
//         "type": "header",
//         "parameters": [
//           { "type": "text", "text": "María García" }
//         ]
//       },
//       {
//         "type": "body",
//         "parameters": [
//           { "type": "text", "text": "María García" },
//           { "type": "text", "text": "PED-2024-001" },
//           { "type": "text", "text": "$150.00" }
//         ]
//       }
//     ]
//   }
// }
```

---

### 5. Enviar a 360Dialog

Finalmente, envía el payload a la API de 360Dialog:

```javascript
import axios from 'axios';

try {
  const response = await axios.post(
    'https://waba-v2.360dialog.io/messages',
    payload,
    {
      headers: {
        'D360-API-KEY': process.env.D360_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('✅ Plantilla enviada:', response.data);
  // Resultado: { messages: [{ id: "wamid.xxx" }] }
} catch (error) {
  console.error('❌ Error enviando plantilla:', error.response?.data || error.message);
}
```

---

## Flujo Completo de Ejemplo

```javascript
import {
  detectVariablesInTemplate,
  validateTemplateValues,
  getTemplatePreview,
  prepareTemplatePayload
} from '../utils/templateVariableHandler.js';
import axios from 'axios';

async function sendTemplateWithVariables(templateName, phoneNumber, templateObject, variableValues) {
  try {
    // 1. Detectar variables
    console.log('🔍 Detectando variables...');
    const variables = detectVariablesInTemplate(templateObject);
    console.log(`Encontradas ${variables.total} variable(s)`);

    // 2. Validar valores
    console.log('✓ Validando valores...');
    const validation = validateTemplateValues(templateObject, variableValues);
    if (!validation.isValid) {
      throw new Error(`Validación fallida:\n${validation.errors.join('\n')}`);
    }

    // 3. Obtener preview
    console.log('👁️ Generando preview...');
    const preview = getTemplatePreview(templateObject, variableValues);
    console.log('Preview:');
    console.log(`  Header: ${preview.header || '(sin header)'}`);
    console.log(`  Body: ${preview.body || '(sin body)'}`);
    console.log(`  Footer: ${preview.footer || '(sin footer)'}`);

    // 4. Preparar payload
    console.log('📦 Preparando payload...');
    const payload = prepareTemplatePayload(
      templateName,
      phoneNumber,
      templateObject,
      variableValues,
      'es'
    );

    // 5. Enviar
    console.log('📤 Enviando plantilla...');
    const response = await axios.post(
      'https://waba-v2.360dialog.io/messages',
      payload,
      {
        headers: {
          'D360-API-KEY': process.env.D360_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Plantilla enviada exitosamente');
    console.log(`   Message ID: ${response.data.messages[0].id}`);

    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Uso:
const template = {
  components: [
    { type: 'body', text: 'Hola {{1}}, tu pedido {{2}} está listo' }
  ]
};

const values = {
  1: 'María',
  2: 'PED-001'
};

await sendTemplateWithVariables(
  'confirmacion_pedido',
  '573113705258',
  template,
  values
);
```

---

## Estructura de Valores

### Formato Correcto

```javascript
// Números como claves
const values = {
  1: 'Valor para {{1}}',
  2: 'Valor para {{2}}',
  3: 'Valor para {{3}}'
};

// Valores pueden ser string o number
const values = {
  1: 'María',
  2: 123,
  3: 45.67
};
```

### Formato Incorrecto

```javascript
// ❌ Claves con nombre
const values = {
  name: 'María',      // Incorrecto
  order: 'PED-001'    // Incorrecto
};

// ❌ Claves como string
const values = {
  '1': 'María',       // Debe ser número
  '2': 'PED-001'      // Debe ser número
};

// ❌ Valores complejos
const values = {
  1: { name: 'María' },  // Debe ser string/number
  2: ['PED-001']         // Debe ser string/number
};
```

---

## Validación de Valores

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Valor requerido para variable {{1}}" | Falta un valor | Proporcionar todos los valores requeridos |
| "Valor para {{1}} debe ser string o number" | Tipo incorrecto | Usar string o number |
| "Valor para {{1}} excede 1000 caracteres" | Valor muy largo | Acortar el valor |
| "Valor extra para {{1}}" | Variable no existe | Remover valores innecesarios |

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

const values = {
  1: 'María García',
  2: 'PED-2024-001',
  3: '$150.00'
};

await sendTemplateWithVariables('confirmacion_pedido', '573113705258', template, values);
```

### Caso 2: Código de Verificación

```javascript
const template = {
  components: [
    {
      type: 'body',
      text: 'Tu código de verificación es {{1}}. Válido por {{2}} minutos.'
    }
  ]
};

const values = {
  1: '123456',
  2: '10'
};

await sendTemplateWithVariables('codigo_verificacion', '573113705258', template, values);
```

### Caso 3: Recordatorio de Cita

```javascript
const template = {
  components: [
    {
      type: 'header',
      text: 'Recordatorio: {{1}}'
    },
    {
      type: 'body',
      text: 'Tu cita con {{1}} está programada para {{2}} en {{3}}'
    },
    {
      type: 'footer',
      text: 'Confirma tu asistencia - Código: {{1}}'
    }
  ]
};

const values = {
  1: 'Dr. García',
  2: '15 de Noviembre',
  3: 'Clínica Central'
};

await sendTemplateWithVariables('recordatorio_cita', '573113705258', template, values);
```

---

## Integración en Express

### Endpoint para Enviar Plantilla

```javascript
import express from 'express';
import { prepareTemplatePayload, validateTemplateValues } from '../utils/templateVariableHandler.js';
import axios from 'axios';

const router = express.Router();

/**
 * POST /api/templates/send
 * Envía una plantilla con variables
 */
router.post('/templates/send', async (req, res) => {
  try {
    const { templateName, phoneNumber, template, values } = req.body;

    // Validar inputs
    if (!templateName || !phoneNumber || !template || !values) {
      return res.status(400).json({
        success: false,
        error: 'templateName, phoneNumber, template y values son requeridos'
      });
    }

    // Validar valores
    const validation = validateTemplateValues(template, values);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validación de valores fallida',
        details: validation.errors
      });
    }

    // Preparar payload
    const payload = prepareTemplatePayload(
      templateName,
      phoneNumber,
      template,
      values,
      'es'
    );

    // Enviar a 360Dialog
    const response = await axios.post(
      'https://waba-v2.360dialog.io/messages',
      payload,
      {
        headers: {
          'D360-API-KEY': process.env.D360_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      messageId: response.data.messages[0].id,
      message: 'Plantilla enviada exitosamente'
    });
  } catch (error) {
    console.error('Error enviando plantilla:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

### Uso del Endpoint

```bash
curl -X POST http://localhost:3000/api/templates/send \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "confirmacion_pedido",
    "phoneNumber": "573113705258",
    "template": {
      "components": [
        {
          "type": "body",
          "text": "Hola {{1}}, tu pedido {{2}} está listo"
        }
      ]
    },
    "values": {
      "1": "María",
      "2": "PED-001"
    }
  }'
```

---

## Resumen

✅ **Pasos para enviar plantillas con variables:**

1. **Detectar** variables con `detectVariablesInTemplate()`
2. **Validar** valores con `validateTemplateValues()`
3. **Obtener preview** con `getTemplatePreview()`
4. **Preparar payload** con `prepareTemplatePayload()`
5. **Enviar** a 360Dialog con axios

✅ **Funciones disponibles:**
- `detectVariablesInText()` - Detecta variables en un texto
- `detectVariablesInTemplate()` - Detecta variables en toda la plantilla
- `buildTemplateParameters()` - Construye parámetros para 360Dialog
- `prepareTemplatePayload()` - Prepara el payload completo
- `validateTemplateValues()` - Valida los valores
- `replaceVariablesInText()` - Reemplaza variables en texto
- `getTemplatePreview()` - Obtiene preview de la plantilla
