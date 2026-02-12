# ✅ Botón URL - Especificación Final Implementada

## Fecha: 27 de Octubre, 2025 - 01:12 AM

---

## 🎯 **ESPECIFICACIÓN OFICIAL DE WHATSAPP**

### **Características de los Botones URL:**

✅ Cargan una URL en el navegador cuando el usuario los toca
✅ **Máximo 2 botones URL** por template
✅ Texto del botón: **Máximo 25 caracteres**
✅ URL debe estar **URL-encoded** si incluye variables
✅ Pueden combinarse con otros tipos de botones

---

## 📝 **SINTAXIS CORRECTA**

```json
{
  "type": "URL",
  "text": "Shop Now",
  "url": "https://www.luckyshrub.com/shop/"
}
```

### **Propiedades:**
- `type`: Siempre "URL"
- `text`: Texto visible en el botón (máx. 25 caracteres)
- `url`: URL completa con https:// (debe estar URL-encoded si tiene variables)

---

## 📱 **VISUALIZACIÓN EN WHATSAPP**

### **1 Botón URL:**
```
┌─────────────────────────────────────┐
│  🛍️ Ofertas Especiales             │
├─────────────────────────────────────┤
│                                     │
│  Descubre nuestras promociones      │
│  exclusivas. ¡No te lo pierdas!     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🌐 Comprar Ahora             │  │ ← Botón URL
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### **2 Botones URL (Máximo):**
```
┌─────────────────────────────────────┐
│  Elige tu método de compra:         │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🌐 Tienda Online             │  │ ← Botón URL 1
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  📱 App Móvil                 │  │ ← Botón URL 2
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### **Combinación URL + Otros Botones:**
```
┌─────────────────────────────────────┐
│  ¿Cómo prefieres contactarnos?      │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🌐 Ver Sitio Web             │  │ ← URL
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  📞 Llamar Ahora              │  │ ← Phone
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  ❌ No, gracias               │  │ ← Quick Reply
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔧 **ENDPOINT IMPLEMENTADO**

### **POST /api/360dialog/send-url-button**

**Parámetros:**
```json
{
  "to": "573113705258",
  "templateName": "nombre_del_template",
  "language": {"code": "es"},
  "url": "valor_para_variable"  // Opcional, solo si template tiene variable {{1}}
}
```

**Ejemplo de uso:**
```bash
# URL estática
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "visita_tienda",
    "language": {"code": "es"}
  }'

# URL dinámica
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "seguimiento_pedido",
    "language": {"code": "es"},
    "url": "ABC12345"
  }'
```

---

## 📋 **EJEMPLOS DE TEMPLATES**

### **Template 1: URL Estática Simple**
```json
{
  "name": "visita_tienda",
  "category": "MARKETING",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Descubre nuestras ofertas exclusivas."
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Comprar Ahora",
          "url": "https://tienda.com/ofertas"
        }
      ]
    }
  ]
}
```

### **Template 2: 2 Botones URL**
```json
{
  "name": "opciones_compra",
  "category": "MARKETING",
  "language": "es",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Elige tu plataforma preferida"
    },
    {
      "type": "BODY",
      "text": "Compra desde donde prefieras:"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Sitio Web",
          "url": "https://tienda.com/shop"
        },
        {
          "type": "URL",
          "text": "App Móvil",
          "url": "https://tienda.com/app"
        }
      ]
    }
  ]
}
```

### **Template 3: URL Dinámica con Variable**
```json
{
  "name": "seguimiento_pedido",
  "category": "UTILITY",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Tu pedido #{{1}} está en camino."
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Rastrear",
          "url": "https://tienda.com/track/{{1}}"
        }
      ]
    }
  ]
}
```

**Al enviar con url: "ABC123":**
- Body mostrará: "Tu pedido #ABC123 está en camino."
- Botón llevará a: `https://tienda.com/track/ABC123`

### **Template 4: Combinado (URL + Phone + Quick Reply)**
```json
{
  "name": "contacto_completo",
  "category": "UTILITY",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "¿Cómo prefieres continuar?"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Portal Web",
          "url": "https://empresa.com/portal"
        },
        {
          "type": "PHONE_NUMBER",
          "text": "Llamar Soporte",
          "phone_number": "+573113705258"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Cancelar"
        }
      ]
    }
  ]
}
```

---

## 📊 **LÍMITES Y RESTRICCIONES**

| Aspecto | Límite | Notas |
|---------|--------|-------|
| **Botones URL por template** | **2 máximo** | Especificación oficial |
| Texto del botón | 25 caracteres | Incluyendo espacios |
| Longitud de URL | 2000 caracteres | Debe comenzar con https:// |
| Variables en URL | 1 variable ({{1}}) | Debe estar URL-encoded |
| Botón Phone | 1 máximo | Puede combinarse con URL |
| Botones Quick Reply | 10 máximo | Pueden combinarse |
| **Total de botones** | **13 máximo** | En un solo template |

---

## 🎯 **CASOS DE USO REALES**

### **E-commerce:**
✅ Botón 1: "Ver Producto" → https://tienda.com/producto/{{1}}
✅ Botón 2: "Ver Catálogo" → https://tienda.com/catalogo

### **Servicios:**
✅ Botón 1: "Agendar Cita" → https://agenda.com/nuevo
✅ Botón 2: "Ver Disponibilidad" → https://agenda.com/horarios

### **Soporte:**
✅ Botón 1: "Ver Ticket" → https://soporte.com/ticket/{{1}}
✅ Botón 2: "Base de Conocimientos" → https://soporte.com/kb

### **Marketing:**
✅ Botón 1: "Registrarse" → https://evento.com/registro
✅ Botón 2: "Más Información" → https://evento.com/info

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

### **Para el desarrollador:**
- [x] Endpoint `/send-url-button` creado
- [x] Soporte para URL estática
- [x] Soporte para URL dinámica con variable
- [x] Validación de parámetros
- [x] Documentación completa
- [x] Ejemplos de uso

### **Para usar:**
- [ ] Crear template en WhatsApp Manager
- [ ] Configurar hasta 2 botones URL
- [ ] Esperar aprobación (24-48h)
- [ ] Probar con endpoint
- [ ] Verificar que URLs abran correctamente
- [ ] Validar tracking de clicks (opcional)

---

## 🚀 **ESTADO ACTUAL**

| Componente | Estado | Nota |
|------------|--------|------|
| Endpoint | ✅ Implementado | Listo para usar |
| Documentación | ✅ Completa | Con especificación oficial |
| Ejemplos | ✅ 4 templates | Diferentes casos de uso |
| Servidor | ✅ Activo | Puerto 3000 |
| Templates | ⏳ Pendiente | Crear en WhatsApp Manager |

---

## 📝 **PRÓXIMOS PASOS**

1. **Crear template en WhatsApp Manager:**
   - Ir a https://business.facebook.com/wa/manage/home/
   - Crear template siguiendo ejemplos
   - Esperar aprobación

2. **Probar endpoint:**
   - Usar curl o Postman
   - Enviar a número de prueba
   - Verificar que botón funcione

3. **Integrar en sistema de campañas:**
   - Agregar opción de botón URL en interfaz
   - Preview en tiempo real
   - Envío masivo

---

## 📚 **DOCUMENTACIÓN RELACIONADA**

- `CREAR_TEMPLATE_BOTON_URL.md` - Guía paso a paso
- `SISTEMA_CAMPANAS_COMPLETO.md` - Sistema de campañas
- `dialog360Routes.js` línea 566-625 - Código del endpoint

---

**Implementado:** 27 de Octubre, 2025 - 01:12 AM
**Estado:** ✅ Completo y listo para producción
**Próximo:** Crear templates en WhatsApp Manager para pruebas reales
