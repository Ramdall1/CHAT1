# 📱 GUÍA RÁPIDA - Nuevo Sistema de Campañas

**Sistema de Campañas WhatsApp con Preview en Tiempo Real**  
**Versión:** 5.1.1  
**Fecha:** 27 de Octubre, 2025

---

## 🚀 INICIO RÁPIDO

### **1. Acceder al Sistema**

```
URL: http://localhost:3000/campaigns-improved.html
```

### **2. Navegación Principal**

El sistema tiene 2 tabs principales:

| Tab | Función |
|-----|---------|
| **📋 Mis Campañas** | Ver y gestionar campañas existentes |
| **➕ Crear Campaña** | Constructor de mensajes con preview |

---

## 📊 MIS CAMPAÑAS

### **¿Qué verás?**

Tarjetas con información de cada campaña:

```
┌─────────────────────────────────────┐
│ Campaña Promo Verano          [✓Sent]│
│ 📅 27/10/2025                        │
│                                      │
│ ┌──────┬──────┬──────┐              │
│ │ 500  │ 485  │ 420  │              │
│ │Enviad│Entreg│Leídos│              │
│ └──────┴──────┴──────┘              │
│                                      │
│ [👁️ Ver]  [✏️ Editar]               │
└─────────────────────────────────────┘
```

### **Acciones Disponibles:**

- **👁️ Ver:** Detalles y estadísticas completas
- **✏️ Editar:** Modificar campaña (solo en estado draft)
- **🎨 Estados:**
  - 🟦 Draft (Borrador)
  - 🟨 Sending (Enviando)
  - 🟩 Sent (Enviada)
  - �� Failed (Fallida)

---

## ✨ CREAR CAMPAÑA

### **Paso 1: Seleccionar Tipo de Mensaje**

Haz click en uno de los botones:

```
┌────────────────────────────────────────────────┐
│  [📝 Texto]  [🖼️ Imagen]  [🎬 Video]          │
│  [🔘 Botones] [📄 Template]                    │
└────────────────────────────────────────────────┘
```

### **Paso 2: Llenar Formulario**

Según el tipo seleccionado, verás diferentes campos:

#### **A. Texto Simple:**
```
Mensaje de texto
┌──────────────────────────────────────┐
│ Escribe tu mensaje aquí...           │
│                                       │
└──────────────────────────────────────┘

☐ Habilitar preview de URL
```

#### **B. Imagen:**
```
URL de la imagen
┌──────────────────────────────────────┐
│ https://ejemplo.com/imagen.jpg       │
└──────────────────────────────────────┘

Caption (opcional)
┌──────────────────────────────────────┐
│ Descripción de la imagen             │
└──────────────────────────────────────┘
```

#### **C. Botones:**
```
Texto del mensaje
┌──────────────────────────────────────┐
│ Mensaje principal                     │
└──────────────────────────────────────┘

Botones (máx. 3)
┌──────────────────────────────────────┐
│ Texto del botón 1                     │
└──────────────────────────────────────┘
[➕ Agregar botón]
```

#### **D. Template:**
```
Seleccionar template
┌──────────────────────────────────────┐
│ bienvenida (es) ▼                     │
└──────────────────────────────────────┘

Variables del template
Se mostrarán automáticamente
```

### **Paso 3: Ver Preview en Tiempo Real**

En el panel derecho verás exactamente cómo se verá tu mensaje en WhatsApp:

```
┌─────────────────────────────┐
│   Preview en Tiempo Real    │
│                              │
│  ┌─────────────────────────┐│
│  │ Hola! Este es un        ││
│  │ mensaje de prueba       ││
│  │                         ││
│  │         10:30 AM ✓✓     ││
│  └─────────────────────────┘│
│                              │
└─────────────────────────────┘
```

### **Paso 4: Seleccionar Destinatarios**

```
Destinatarios
┌──────────────────────────────────────┐
│ +573113705258                         │
└──────────────────────────────────────┘
O selecciona una audiencia
```

### **Paso 5: Enviar**

```
┌──────────────────────────────────────┐
│       📨 Enviar Mensaje               │
└──────────────────────────────────────┘
```

---

## 🎨 CARACTERÍSTICAS DESTACADAS

### **1. Preview en Tiempo Real**
- ✅ Ve tu mensaje exactamente como en WhatsApp
- ✅ Se actualiza mientras escribes
- ✅ Incluye timestamp y checks
- ✅ Colores y formato reales

### **2. Validación Automática**
- ✅ Campos requeridos marcados
- ✅ Formatos validados automáticamente
- ✅ Mensajes de error claros
- ✅ Prevención de errores

### **3. Diseño Moderno**
- ✅ Animaciones suaves
- ✅ Colores intuitivos
- ✅ Iconos claros
- ✅ Responsive (funciona en móvil)

### **4. Estadísticas Visuales**
- ✅ Números grandes y claros
- ✅ Colores por estado
- ✅ Porcentajes calculados
- ✅ Actualización en tiempo real

---

## 💡 TIPS Y MEJORES PRÁCTICAS

### **Para Mensajes de Texto:**
- ✅ Mantén el mensaje corto y claro
- ✅ Usa emojis moderadamente
- ✅ Incluye call-to-action
- ✅ Personaliza con variables

### **Para Imágenes:**
- ✅ Usa URLs HTTPS
- ✅ Imágenes de alta calidad
- ✅ Formato JPG o PNG
- ✅ Caption descriptivo

### **Para Botones:**
- ✅ Máximo 3 botones
- ✅ Texto corto y claro
- ✅ Opciones lógicas
- ✅ Orden de importancia

### **Para Templates:**
- ✅ Asegúrate que esté aprobado
- ✅ Verifica las variables
- ✅ Preview antes de enviar
- ✅ Prueba con un contacto primero

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### **El preview no se actualiza**
- ✔️ Verifica que el campo tenga contenido
- ✔️ Refresca la página
- ✔️ Verifica la consola del navegador

### **No puedo enviar el mensaje**
- ✔️ Verifica que todos los campos estén llenos
- ✔️ Comprueba el formato del teléfono
- ✔️ Verifica la conexión al servidor
- ✔️ Revisa que el template esté aprobado

### **Las campañas no cargan**
- ✔️ Verifica que el servidor esté activo
- ✔️ Comprueba la URL de la API
- ✔️ Revisa la consola de errores
- ✔️ Verifica permisos de usuario

### **El diseño se ve mal en móvil**
- ✔️ El sistema es responsive
- ✔️ Funciona en todos los dispositivos
- ✔️ Si hay problemas, reporta el navegador y versión

---

## 📱 ATAJOS DE TECLADO

| Acción | Atajo |
|--------|-------|
| Nueva campaña | `Alt + N` (próximamente) |
| Guardar | `Ctrl + S` (próximamente) |
| Preview | `Ctrl + P` (próximamente) |

---

## 📞 SOPORTE

### **¿Necesitas ayuda?**

1. **Documentación:**
   - Leer `MEJORAS_IMPLEMENTADAS.md`
   - Leer `CAMPAIGN_SYSTEM_OVERVIEW.md`

2. **Problemas técnicos:**
   - Verificar logs del servidor
   - Revisar consola del navegador
   - Contactar al equipo de desarrollo

3. **Sugerencias:**
   - Documentar la mejora sugerida
   - Enviar al equipo de desarrollo

---

## ✅ CHECKLIST ANTES DE ENVIAR

Antes de enviar una campaña, verifica:

- [ ] Mensaje escrito correctamente
- [ ] Preview verificado
- [ ] Destinatarios correctos
- [ ] Template aprobado (si aplica)
- [ ] Prueba enviada a ti mismo
- [ ] Estadísticas configuradas

---

## 🎯 EJEMPLOS RÁPIDOS

### **Ejemplo 1: Mensaje Simple**

```
1. Click en "Crear Campaña"
2. Seleccionar "Texto"
3. Escribir: "¡Hola! Tenemos una oferta especial para ti"
4. Ingresar teléfono: +573113705258
5. Click "Enviar Mensaje"
```

### **Ejemplo 2: Con Imagen**

```
1. Click en "Crear Campaña"
2. Seleccionar "Imagen"
3. URL: https://ejemplo.com/promocion.jpg
4. Caption: "¡50% de descuento esta semana!"
5. Ingresar teléfono
6. Click "Enviar Mensaje"
```

### **Ejemplo 3: Con Botones**

```
1. Click en "Crear Campaña"
2. Seleccionar "Botones"
3. Mensaje: "¿Te interesa nuestra oferta?"
4. Botón 1: "Sí, me interesa"
5. Botón 2: "No, gracias"
6. Botón 3: "Más información"
7. Ingresar teléfono
8. Click "Enviar Mensaje"
```

---

## 🚀 PRÓXIMAS CARACTERÍSTICAS

Próximamente se añadirán:

- ⏳ Programación de envíos
- ⏳ Segmentación avanzada
- ⏳ A/B testing
- ⏳ Reportes detallados
- ⏳ Automatizaciones

---

**Última actualización:** 27 de Octubre, 2025 - 02:55 AM  
**Versión del sistema:** 5.1.1  
**Ubicación:** `http://localhost:3000/campaigns-improved.html`  

🎉 **¡Disfruta del nuevo sistema de campañas!**

