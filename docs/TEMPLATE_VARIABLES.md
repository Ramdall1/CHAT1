# Sistema de Variables en Plantillas WhatsApp

## Ubicación de Variables por Componente

| Componente | Variables Soportadas | Límite | Reglas |
|-----------|---------------------|--------|--------|
| **Header** | Sí | Máximo 1 | Debe ser {{1}}, no al inicio/final |
| **Body** | Sí | Múltiples | Secuenciales, no al inicio/final |
| **Footer** | Sí | Múltiples | Secuenciales, no al inicio/final |
| **Buttons** | No | N/A | No soportan variables |

---

## Reglas Importantes

### 1. **Secuenciales** ✅
Las variables deben estar numeradas consecutivamente sin saltos.

```javascript
// ✅ CORRECTO
"Hola {{1}}, tu pedido {{2}} está listo"

// ❌ INCORRECTO (salto entre 1 y 3)
"Hola {{1}}, tu pedido {{3}} está listo"
```

### 2. **No al Inicio o Final** ✅
Las variables no pueden estar al principio o al final de la plantilla.

```javascript
// ✅ CORRECTO
"Hola {{1}}, tu pedido está listo"
"Tu pedido {{1}} está listo, gracias"

// ❌ INCORRECTO (al inicio)
"{{1}} tu pedido está listo"

// ❌ INCORRECTO (al final)
"Tu pedido está listo {{1}}"
```

### 3. **No Juntas** ✅
Las variables no pueden estar una al lado de la otra sin separación.

```javascript
// ✅ CORRECTO
"Hola {{1}}, tu {{2}} está listo"

// ❌ INCORRECTO (juntas)
"Hola {{1}}{{2}} está listo"
```

### 4. **Solo Números** ✅
Las variables solo pueden contener números, sin caracteres especiales.

```javascript
// ✅ CORRECTO
"Hola {{1}}, {{2}}, {{3}}"

// ❌ INCORRECTO (caracteres especiales)
"Hola {{#1}}, {{$2}}, {{%3}}"
"Hola {{name}}, {{email}}"  // Solo números, no nombres
```

### 5. **Ejemplos Requeridos** ✅
Toda plantilla con variables **DEBE** incluir ejemplos.

```javascript
// ✅ CORRECTO
{
  "type": "BODY",
  "text": "Hola {{1}}, tu pedido {{2}} está listo",
  "example": {
    "body_text": [
      ["María", "ABC123"],
      ["Juan", "XYZ789"]
    ]
  }
}

// ❌ INCORRECTO (sin ejemplos)
{
  "type": "BODY",
  "text": "Hola {{1}}, tu pedido {{2}} está listo"
}
```

---

## Ejemplos Completos

### Ejemplo 1: Confirmación de Pedido

```json
{
  "name": "confirmacion_pedido",
  "category": "utility",
  "components": [
    {
      "type": "body",
      "text": "Hola {{1}}, tu pedido {{2}} ha sido confirmado. Total: {{3}}"
    }
  ],
  "example": {
    "body_text": [
      ["María García", "PED-2024-001", "$150.00"],
      ["Juan López", "PED-2024-002", "$250.50"]
    ]
  }
}
```

### Ejemplo 2: Recordatorio de Cita

```json
{
  "name": "recordatorio_cita",
  "category": "utility",
  "components": [
    {
      "type": "body",
      "text": "Recordatorio: Tu cita con {{1}} está programada para {{2}} en {{3}}"
    }
  ],
  "example": {
    "body_text": [
      ["Dr. García", "15 de Noviembre", "Clínica Central"],
      ["Dra. López", "20 de Noviembre", "Clínica Sur"]
    ]
  }
}
```

### Ejemplo 3: Código de Verificación

```json
{
  "name": "codigo_verificacion",
  "category": "authentication",
  "components": [
    {
      "type": "body",
      "text": "Tu código de verificación es {{1}}. Válido por {{2}} minutos."
    }
  ],
  "example": {
    "body_text": [
      ["123456", "10"],
      ["654321", "10"]
    ]
  }
}
```

### Ejemplo 4: Envío de Producto

```json
{
  "name": "envio_producto",
  "category": "utility",
  "components": [
    {
      "type": "body",
      "text": "Tu {{1}} ha sido enviado. Número de seguimiento: {{2}}. Entrega estimada: {{3}}"
    }
  ],
  "example": {
    "body_text": [
      ["Laptop Dell", "TRK-2024-001", "5 de Diciembre"],
      ["Mouse Logitech", "TRK-2024-002", "3 de Diciembre"]
    ]
  }
}
```

### Ejemplo 5: Plantilla con Header, Body y Footer

```json
{
  "name": "oferta_especial",
  "category": "marketing",
  "components": [
    {
      "type": "header",
      "text": "¡Descuento de {{1}}!"
    },
    {
      "type": "body",
      "text": "Hola {{1}}, tienes un descuento especial en {{2}}. Precio original: {{3}}, Precio final: {{4}}"
    },
    {
      "type": "footer",
      "text": "Válido hasta {{1}} - Código: {{2}}"
    }
  ],
  "example": {
    "header_text": [
      ["50%"],
      ["30%"]
    ],
    "body_text": [
      ["María", "Laptops", "$1000", "$500"],
      ["Juan", "Teléfonos", "$800", "$560"]
    ],
    "footer_text": [
      ["31 de Diciembre", "DESCUENTO50"],
      ["15 de Diciembre", "DESCUENTO30"]
    ]
  }
}
```

### Ejemplo 6: Pie de Página con Variables

```json
{
  "name": "promocion_codigo",
  "category": "marketing",
  "components": [
    {
      "type": "body",
      "text": "¡Aprovecha nuestra promoción especial! Obtén {{1}} de descuento en tu próxima compra."
    },
    {
      "type": "footer",
      "text": "Válido hasta {{1}} - Código: {{2}}"
    }
  ],
  "example": {
    "body_text": [
      ["20%"],
      ["30%"]
    ],
    "footer_text": [
      ["31 de Diciembre", "PROMO20"],
      ["15 de Enero", "PROMO30"]
    ]
  }
}
```

---

## Validación de Variables

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Las variables deben ser secuenciales" | Saltos en numeración ({{1}}, {{3}}) | Usar {{1}}, {{2}}, {{3}} sin saltos |
| "Las variables no pueden estar al inicio" | Variable al principio | Agregar texto antes: "Hola {{1}}" |
| "Las variables no pueden estar al final" | Variable al final | Agregar texto después: "{{1}} está listo" |
| "Las variables no pueden estar juntas" | {{1}}{{2}} sin espacio | Separar: "{{1}} y {{2}}" |
| "Solo números, sin caracteres especiales" | {{#1}}, {{$2}} | Usar solo números: {{1}}, {{2}} |
| "El header soporta máximo 1 variable" | Más de una variable en header | Usar solo {{1}} en header |
| "El header debe usar {{1}}" | Variable incorrecta en header | Cambiar a {{1}} |
| "Se requieren ejemplos" | Plantilla sin ejemplos | Agregar propiedad "example" |
| "Se requiere example.header_text" | Falta ejemplos del header | Agregar: `"header_text": [["valor"]]` |
| "Se requiere example.body_text" | Falta ejemplos del body | Agregar: `"body_text": [["val1", "val2"]]` |
| "Se requiere example.footer_text" | Falta ejemplos del footer | Agregar: `"footer_text": [["val1", "val2"]]` |
| "example.header_text debe tener 1 valor" | Cantidad incorrecta | Usar exactamente 1 valor por ejemplo |
| "example.body_text tiene X valores pero se requieren Y" | Cantidad incorrecta | Ajustar cantidad de valores |
| "example.footer_text tiene X valores pero se requieren Y" | Cantidad incorrecta | Ajustar cantidad de valores |

---

## Estructura de Ejemplos

### Formato Correcto

```javascript
"example": {
  "body_text": [
    ["valor_variable_1", "valor_variable_2", "valor_variable_3"],
    ["otro_valor_1", "otro_valor_2", "otro_valor_3"]
  ]
}
```

### Reglas para Ejemplos

1. **Array de Arrays**: `body_text` debe ser un array de arrays
2. **Cantidad de Valores**: Cada array interno debe tener exactamente N valores (donde N = número de variables)
3. **Mínimo un Ejemplo**: Debe haber al menos un conjunto de ejemplos
4. **Valores Válidos**: Los valores deben ser strings y representar casos reales

---

## Envío de Plantillas con Variables

### Formato de Envío

```javascript
{
  "messaging_product": "whatsapp",
  "to": "573113705258",
  "type": "template",
  "template": {
    "name": "confirmacion_pedido",
    "language": {
      "code": "es"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "María García" },
          { "type": "text", "text": "PED-2024-001" },
          { "type": "text", "text": "$150.00" }
        ]
      }
    ]
  }
}
```

### Mapeo de Variables

```
Plantilla: "Hola {{1}}, tu pedido {{2}} ha sido confirmado. Total: {{3}}"

Parameters:
- {{1}} → "María García"
- {{2}} → "PED-2024-001"
- {{3}} → "$150.00"

Resultado: "Hola María García, tu pedido PED-2024-001 ha sido confirmado. Total: $150.00"
```

---

## Testing

### Validar una Plantilla

```javascript
import { validateTemplate } from './templateValidation.js';

const template = {
  name: "confirmacion_pedido",
  category: "utility",
  components: [
    {
      type: "body",
      text: "Hola {{1}}, tu pedido {{2}} está listo"
    }
  ],
  example: {
    body_text: [
      ["María", "ABC123"]
    ]
  }
};

const result = validateTemplate(template);
console.log(result.isValid); // true
console.log(result.errors);  // []
```

### Casos de Error

```javascript
// ❌ Sin ejemplos
const result1 = validateTemplate({
  name: "test",
  category: "utility",
  components: [{ type: "body", text: "Hola {{1}}" }]
});
// Errores: "Se requieren ejemplos para plantillas con variables"

// ❌ Variables juntas
const result2 = validateTemplate({
  name: "test",
  category: "utility",
  components: [{ type: "body", text: "Hola {{1}}{{2}}" }],
  example: { body_text: [["a", "b"]] }
});
// Errores: "Las variables no pueden estar juntas"

// ❌ Saltos en numeración
const result3 = validateTemplate({
  name: "test",
  category: "utility",
  components: [{ type: "body", text: "Hola {{1}}, {{3}}" }],
  example: { body_text: [["a", "b"]] }
});
// Errores: "Las variables deben ser secuenciales"
```

---

## Resumen

✅ **Reglas Clave:**
1. Secuenciales: {{1}}, {{2}}, {{3}}
2. No al inicio/final
3. No juntas
4. Solo números
5. Ejemplos requeridos

✅ **Validación Automática:** El sistema valida todas estas reglas automáticamente

✅ **Mensajes Claros:** Los errores indican exactamente qué está mal
