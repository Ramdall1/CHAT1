# 📝 Cómo Crear CUALQUIER Template - Documentación Oficial 360Dialog

## 🎯 ENDPOINT OFICIAL

```bash
POST https://waba-v2.360dialog.io/v1/configs/templates
Headers:
  D360-API-KEY: AgfBv5iKrrsrrENqb4VDfeiZAK
  Content-Type: application/json
```

---

## 📋 ESTRUCTURA BÁSICA

```json
{
  "name": "nombre_template",
  "category": "MARKETING|UTILITY|AUTHENTICATION",
  "language": "es|en_US|etc",
  "allow_category_change": true,
  "components": [...]
}
```

### **Campos importantes:**
- `name`: Nombre único (snake_case)
- `category`: MARKETING, UTILITY, AUTHENTICATION
- `language`: Código de idioma (es, en_US, pt_BR, etc)
- `allow_category_change`: true (evita rechazos por categorización)
- `components`: Array de componentes

---

## 🎨 COMPONENTES DISPONIBLES

### **1. HEADER**
```json
{
  "type": "HEADER",
  "format": "TEXT|IMAGE|VIDEO|DOCUMENT",
  "text": "Texto del header"  // Solo si format: TEXT
}
```

### **2. BODY** (Obligatorio)
```json
{
  "type": "BODY",
  "text": "Texto con variables {{1}}, {{2}}, etc",
  "example": {
    "body_text": [["valor1", "valor2"]]
  }
}
```

### **3. FOOTER** (Opcional)
```json
{
  "type": "FOOTER",
  "text": "Texto del footer"
}
```

### **4. BUTTONS** (Opcional)
```json
{
  "type": "BUTTONS",
  "buttons": [...]
}
```

---

## 🔘 TIPOS DE BOTONES

### **A. URL (Call to Action)**
```json
{
  "type": "URL",
  "text": "Ver Pedido",
  "url": "https://tienda.com/pedido/{{1}}",
  "example": ["ABC123"]
}
```

### **B. PHONE NUMBER**
```json
{
  "type": "PHONE_NUMBER",
  "text": "Llamar Ahora",
  "phone_number": "+573113705258"
}
```

### **C. QUICK REPLY**
```json
{
  "type": "QUICK_REPLY",
  "text": "Sí, confirmar"
}
```

### **D. COPY CODE**
```json
{
  "type": "COPY_CODE",
  "example": "SUMMER25"
}
```

---

## 📦 EJEMPLOS OFICIALES

### **Ejemplo 1: MARKETING (Promoción)**
```json
{
  "name": "seasonal_promotion",
  "category": "MARKETING",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "¡Oferta de Verano!"
    },
    {
      "type": "BODY",
      "text": "Compra ahora hasta el 31 de agosto y usa el código VERANO25 para obtener 25% de descuento."
    },
    {
      "type": "FOOTER",
      "text": "Responde STOP para cancelar promociones"
    }
  ]
}
```

### **Ejemplo 2: UTILITY (Con variables)**
```json
{
  "name": "order_status",
  "category": "UTILITY",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "BODY",
      "text": "Tu pedido #{{1}} ha sido enviado! Llegará el {{2}}. Rastréalo aquí: {{3}}",
      "example": {
        "body_text": [["ABC123", "25 de agosto", "https://example.com/track/ABC123"]]
      }
    }
  ]
}
```

### **Ejemplo 3: AUTHENTICATION (Con botón Copy Code)**
```json
{
  "name": "verification_code",
  "category": "AUTHENTICATION",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "BODY",
      "text": "Tu código de verificación es {{1}}. Este código expira en 10 minutos.",
      "example": {
        "body_text": [["123456"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "COPY_CODE",
          "example": "123456"
        }
      ]
    }
  ]
}
```

### **Ejemplo 4: COMPLETO (Header + Body + Footer + Botón URL)**
```json
{
  "name": "order_confirmation",
  "category": "UTILITY",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Confirmación de Pedido"
    },
    {
      "type": "BODY",
      "text": "Gracias por tu pedido, {{1}}! Tu número de pedido es {{2}}. Te notificaremos cuando sea enviado.",
      "example": {
        "body_text": [["Juan", "ORD-12345"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Contáctanos para cualquier pregunta"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Rastrear Pedido",
          "url": "https://www.tienda.com/pedidos/{{1}}",
          "example": ["ORD-12345"]
        }
      ]
    }
  ]
}
```

---

## 🚀 USO CON CURL

```bash
# Crear template
curl --location 'https://waba-v2.360dialog.io/v1/configs/templates' \
  --header 'D360-API-KEY: AgfBv5iKrrsrrENqb4VDfeiZAK' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "mi_template",
    "category": "UTILITY",
    "language": "es",
    "allow_category_change": true,
    "components": [
      {
        "type": "BODY",
        "text": "Hola {{1}}, tu código es {{2}}",
        "example": {
          "body_text": [["Juan", "ABC123"]]
        }
      }
    ]
  }'

# Ver templates
curl --request GET \
  --url 'https://waba-v2.360dialog.io/v1/configs/templates' \
  --header 'D360-API-KEY: AgfBv5iKrrsrrENqb4VDfeiZAK'
```

---

## ✅ PROCESO DE APROBACIÓN

### **Estados del template:**
- `PENDING` ⏳ - En revisión por Meta
- `APPROVED` ✅ - Aprobado y listo para usar
- `REJECTED` ❌ - Rechazado (revisar y reenviar)

### **Tiempos:**
- **Templates de biblioteca**: Aprobados instantáneamente
- **Templates personalizados**: Hasta 24 horas

### **Verificar estado:**
```bash
curl --request GET \
  --url 'https://waba-v2.360dialog.io/v1/configs/templates' \
  --header 'D360-API-KEY: AgfBv5iKrrsrrENqb4VDfeiZAK'
```

---

## 💡 TIPS PARA APROBACIÓN

✅ **DO:**
- Mantén el contenido claro y consistente con la categoría
- Proporciona ejemplos precisos para todas las variables
- Usa `"allow_category_change": true`
- Haz los primeros 60-65 caracteres atractivos
- Para MARKETING, incluye opción de opt-out
- Prueba diferentes templates

❌ **DON'T:**
- No uses lenguaje agresivo o spam
- No incluyas información falsa
- No uses variables sin ejemplos
- No copies templates de otras empresas

---

## 📊 CATEGORÍAS

### **MARKETING**
- Promociones
- Ofertas
- Descuentos
- Anuncios de productos
**Requiere:** Opción de opt-out clara

### **UTILITY**
- Confirmaciones de pedido
- Actualizaciones de cuenta
- Notificaciones de envío
- Alertas de servicio

### **AUTHENTICATION**
- Códigos OTP
- Verificación de dos factores
- Confirmación de identidad

---

## 🎯 CASOS DE USO

### **E-commerce:**
```json
{
  "name": "abandoned_cart",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {"header_handle": ["https://tienda.com/cart.jpg"]}
    },
    {
      "type": "BODY",
      "text": "¡Hola {{1}}! Dejaste {{2}} artículos en tu carrito. Completa tu compra ahora.",
      "example": {"body_text": [["María", "3"]]}
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {"type": "URL", "text": "Ver Carrito", "url": "https://tienda.com/cart"}
      ]
    }
  ]
}
```

### **Servicios:**
```json
{
  "name": "appointment_reminder",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Recordatorio: Tienes una cita el {{1}} a las {{2}}. Dirección: {{3}}",
      "example": {"body_text": [["15 de marzo", "10:00 AM", "Calle 123"]]}
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {"type": "QUICK_REPLY", "text": "Confirmar"},
        {"type": "QUICK_REPLY", "text": "Reprogramar"}
      ]
    }
  ]
}
```

---

## 🔗 RECURSOS

- [Documentación Oficial](https://docs.360dialog.com/partner/get-started/quickstarts/create-a-message-template)
- [Template Elements](https://docs.360dialog.com/partner/messaging-and-calling/template-messages/template-elements)
- [Template Library](https://docs.360dialog.com/partner/messaging-and-calling/template-messages/template-library)

---

**Actualizado:** 27 de Octubre, 2025 - 01:25 AM
**Endpoint oficial:** `https://waba-v2.360dialog.io/v1/configs/templates`
**Estado:** ✅ Documentación completa basada en fuente oficial
