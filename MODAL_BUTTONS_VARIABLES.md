# Guía: Agregar Botones y Variables en el Modal de Campaña

**Fecha:** 22 de Noviembre, 2025
**Versión:** 1.0
**Estado:** ✅ LISTO PARA IMPLEMENTAR

---

## 📍 UBICACIÓN DEL MODAL

**Archivo:** `/client/campaigns.html`

**Sección:** Busca la sección "Botón Opcional" en el formulario

```html
<!-- Línea aproximada: 637 -->
<div class="form-group">
    <label>Botón <span class="optional">Opcional</span></label>
    <select id="buttonType">
        <option value="">Seleccionar Tipo De Botón</option>
    </select>
</div>
```

---

## 🎯 DÓNDE AGREGAR BOTONES

### Opción 1: En el HTML (Recomendado)

**Ubicación:** Dentro del `<select id="buttonType">` en campaigns.html

```html
<!-- BUSCA ESTA SECCIÓN EN campaigns.html -->
<div class="form-group">
    <label>Botón <span class="optional">Opcional</span></label>
    <select id="buttonType">
        <option value="">Seleccionar Tipo De Botón</option>
        
        <!-- AGREGA AQUÍ TUS BOTONES -->
        <option value="btn_call" data-label="Llamar" data-action="call">
            📞 Botón de Llamada
        </option>
        
        <option value="btn_url" data-label="Visitar Web" data-action="url">
            🌐 Botón de URL
        </option>
        
        <option value="btn_whatsapp" data-label="Chat WhatsApp" data-action="whatsapp">
            💬 Botón de WhatsApp
        </option>
        
        <option value="btn_copy" data-label="Copiar Código" data-action="copy">
            📋 Botón de Copiar
        </option>
        
        <option value="btn_location" data-label="Ubicación" data-action="location">
            📍 Botón de Ubicación
        </option>
    </select>
    <small>Máximo 10 botones en total combinando todos los tipos</small>
</div>
```

---

## 🔧 AGREGAR VALORES A CADA BOTÓN

### Paso 1: Crear Campos de Entrada para Valores

**Agrega después del select de botones:**

```html
<!-- Contenedor para configuración de botones -->
<div id="buttonConfigContainer" style="display: none;">
    
    <!-- Configuración para Botón de Llamada -->
    <div id="config_btn_call" class="button-config" style="display: none;">
        <label>Número de Teléfono</label>
        <input type="tel" id="btn_call_value" placeholder="Ej: +57 300 123 4567" 
               data-variable="PHONE_NUMBER">
        <small>Ejemplo: +57 300 123 4567</small>
    </div>
    
    <!-- Configuración para Botón de URL -->
    <div id="config_btn_url" class="button-config" style="display: none;">
        <label>URL</label>
        <input type="url" id="btn_url_value" placeholder="Ej: https://www.ejemplo.com" 
               data-variable="WEBSITE_URL">
        <small>Ejemplo: https://www.mitienda.com</small>
    </div>
    
    <!-- Configuración para Botón de WhatsApp -->
    <div id="config_btn_whatsapp" class="button-config" style="display: none;">
        <label>Número de WhatsApp</label>
        <input type="tel" id="btn_whatsapp_value" placeholder="Ej: +57 300 123 4567" 
               data-variable="WHATSAPP_NUMBER">
        <small>Ejemplo: +57 300 123 4567</small>
    </div>
    
    <!-- Configuración para Botón de Copiar -->
    <div id="config_btn_copy" class="button-config" style="display: none;">
        <label>Código a Copiar</label>
        <input type="text" id="btn_copy_value" placeholder="Ej: PROMO2024" 
               data-variable="PROMO_CODE">
        <small>Ejemplo: PROMO2024</small>
    </div>
    
    <!-- Configuración para Botón de Ubicación -->
    <div id="config_btn_location" class="button-config" style="display: none;">
        <label>Dirección</label>
        <input type="text" id="btn_location_value" placeholder="Ej: Cra 5 #10-20, Bogotá" 
               data-variable="BUSINESS_ADDRESS">
        <small>Ejemplo: Cra 5 #10-20, Bogotá</small>
    </div>
    
</div>
```

---

## 📦 SOPORTE DE VARIABLES

### Paso 2: Agregar Sección de Variables

**Agrega esta sección en el formulario:**

```html
<!-- SECCIÓN DE VARIABLES -->
<div class="form-group">
    <label>Variables Disponibles</label>
    <div class="variables-info">
        <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
            Usa estas variables en tu mensaje. Se reemplazarán automáticamente:
        </p>
        
        <div class="variables-list">
            <!-- Variable: Nombre del Cliente -->
            <div class="variable-item">
                <code>{{CUSTOMER_NAME}}</code>
                <span class="variable-example">Ejemplo: Juan Pérez</span>
                <button class="btn-copy-var" data-var="{{CUSTOMER_NAME}}">Copiar</button>
            </div>
            
            <!-- Variable: Email -->
            <div class="variable-item">
                <code>{{CUSTOMER_EMAIL}}</code>
                <span class="variable-example">Ejemplo: juan@example.com</span>
                <button class="btn-copy-var" data-var="{{CUSTOMER_EMAIL}}">Copiar</button>
            </div>
            
            <!-- Variable: Teléfono -->
            <div class="variable-item">
                <code>{{CUSTOMER_PHONE}}</code>
                <span class="variable-example">Ejemplo: +57 300 123 4567</span>
                <button class="btn-copy-var" data-var="{{CUSTOMER_PHONE}}">Copiar</button>
            </div>
            
            <!-- Variable: Código de Descuento -->
            <div class="variable-item">
                <code>{{DISCOUNT_CODE}}</code>
                <span class="variable-example">Ejemplo: PROMO2024</span>
                <button class="btn-copy-var" data-var="{{DISCOUNT_CODE}}">Copiar</button>
            </div>
            
            <!-- Variable: Monto -->
            <div class="variable-item">
                <code>{{AMOUNT}}</code>
                <span class="variable-example">Ejemplo: $99.900</span>
                <button class="btn-copy-var" data-var="{{AMOUNT}}">Copiar</button>
            </div>
            
            <!-- Variable: Fecha -->
            <div class="variable-item">
                <code>{{DATE}}</code>
                <span class="variable-example">Ejemplo: 22 de Noviembre, 2025</span>
                <button class="btn-copy-var" data-var="{{DATE}}">Copiar</button>
            </div>
            
            <!-- Variable: Hora -->
            <div class="variable-item">
                <code>{{TIME}}</code>
                <span class="variable-example">Ejemplo: 14:30</span>
                <button class="btn-copy-var" data-var="{{TIME}}">Copiar</button>
            </div>
            
            <!-- Variable: URL de Seguimiento -->
            <div class="variable-item">
                <code>{{TRACKING_URL}}</code>
                <span class="variable-example">Ejemplo: https://track.example.com/123</span>
                <button class="btn-copy-var" data-var="{{TRACKING_URL}}">Copiar</button>
            </div>
            
            <!-- Variable: Nombre del Negocio -->
            <div class="variable-item">
                <code>{{BUSINESS_NAME}}</code>
                <span class="variable-example">Ejemplo: Mi Tienda Online</span>
                <button class="btn-copy-var" data-var="{{BUSINESS_NAME}}">Copiar</button>
            </div>
            
            <!-- Variable: Número de Pedido -->
            <div class="variable-item">
                <code>{{ORDER_NUMBER}}</code>
                <span class="variable-example">Ejemplo: ORD-2024-001234</span>
                <button class="btn-copy-var" data-var="{{ORDER_NUMBER}}">Copiar</button>
            </div>
        </div>
    </div>
</div>
```

---

## 🎨 CSS PARA VARIABLES

**Agrega estos estilos en campaigns.html dentro de `<style>`:**

```css
/* Estilos para variables */
.variables-info {
    background: #f0f4ff;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
}

.variables-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
    margin-top: 10px;
}

.variable-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.variable-item code {
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #1f2937;
    font-weight: 500;
}

.variable-example {
    font-size: 11px;
    color: #6b7280;
    font-style: italic;
}

.btn-copy-var {
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-copy-var:hover {
    background: #4f46e5;
}

/* Estilos para configuración de botones */
.button-config {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    padding: 12px;
    margin-top: 10px;
}

.button-config label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    margin-bottom: 6px;
}

.button-config input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
}

.button-config small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #6b7280;
}
```

---

## 💻 JAVASCRIPT PARA MANEJAR BOTONES Y VARIABLES

**Agrega en campaigns.html dentro de `<script>`:**

```javascript
// Manejar cambio de tipo de botón
document.getElementById('buttonType').addEventListener('change', function() {
    const selectedValue = this.value;
    const configContainer = document.getElementById('buttonConfigContainer');
    
    // Ocultar todos los configs
    document.querySelectorAll('.button-config').forEach(config => {
        config.style.display = 'none';
    });
    
    // Mostrar el config seleccionado
    if (selectedValue) {
        configContainer.style.display = 'block';
        const configDiv = document.getElementById(`config_${selectedValue}`);
        if (configDiv) {
            configDiv.style.display = 'block';
        }
    } else {
        configContainer.style.display = 'none';
    }
});

// Copiar variables al mensaje
document.querySelectorAll('.btn-copy-var').forEach(btn => {
    btn.addEventListener('click', function() {
        const variable = this.getAttribute('data-var');
        const messageField = document.getElementById('campaignMessage');
        
        if (messageField) {
            messageField.value += variable;
            messageField.focus();
            
            // Mostrar feedback
            const originalText = this.textContent;
            this.textContent = '✅ Copiado';
            setTimeout(() => {
                this.textContent = originalText;
            }, 2000);
        }
    });
});

// Obtener valores de botones al enviar
function getButtonConfig() {
    const buttonType = document.getElementById('buttonType').value;
    
    if (!buttonType) {
        return null;
    }
    
    const valueInput = document.getElementById(`${buttonType}_value`);
    
    return {
        type: buttonType,
        value: valueInput ? valueInput.value : '',
        label: document.querySelector(`option[value="${buttonType}"]`)?.textContent || ''
    };
}

// Procesar variables en el mensaje
function processVariables(message, contactData) {
    let processedMessage = message;
    
    // Reemplazar variables con datos reales
    processedMessage = processedMessage.replace(/{{CUSTOMER_NAME}}/g, contactData.name || 'Cliente');
    processedMessage = processedMessage.replace(/{{CUSTOMER_EMAIL}}/g, contactData.email || '');
    processedMessage = processedMessage.replace(/{{CUSTOMER_PHONE}}/g, contactData.phone || '');
    processedMessage = processedMessage.replace(/{{DISCOUNT_CODE}}/g, contactData.discount_code || '');
    processedMessage = processedMessage.replace(/{{AMOUNT}}/g, contactData.amount || '');
    processedMessage = processedMessage.replace(/{{DATE}}/g, new Date().toLocaleDateString('es-CO'));
    processedMessage = processedMessage.replace(/{{TIME}}/g, new Date().toLocaleTimeString('es-CO'));
    processedMessage = processedMessage.replace(/{{TRACKING_URL}}/g, contactData.tracking_url || '');
    processedMessage = processedMessage.replace(/{{BUSINESS_NAME}}/g, 'Mi Negocio');
    processedMessage = processedMessage.replace(/{{ORDER_NUMBER}}/g, contactData.order_number || '');
    
    return processedMessage;
}

// Al guardar campaña
document.getElementById('saveCampaignBtn').addEventListener('click', async function() {
    const campaignName = document.getElementById('campaignName').value;
    const message = document.getElementById('campaignMessage').value;
    const buttonConfig = getButtonConfig();
    
    const campaignData = {
        name: campaignName,
        message: message,
        button: buttonConfig,
        variables: extractVariables(message)
    };
    
    console.log('Campaña a guardar:', campaignData);
    
    // Enviar al servidor
    await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(campaignData)
    });
});

// Extraer variables del mensaje
function extractVariables(message) {
    const variableRegex = /{{(\w+)}}/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(message)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }
    
    return variables;
}
```

---

## 📋 TABLA DE VARIABLES DISPONIBLES

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `{{CUSTOMER_NAME}}` | Juan Pérez | Nombre del cliente |
| `{{CUSTOMER_EMAIL}}` | juan@example.com | Email del cliente |
| `{{CUSTOMER_PHONE}}` | +57 300 123 4567 | Teléfono del cliente |
| `{{DISCOUNT_CODE}}` | PROMO2024 | Código de descuento |
| `{{AMOUNT}}` | $99.900 | Monto o precio |
| `{{DATE}}` | 22 de Noviembre, 2025 | Fecha actual |
| `{{TIME}}` | 14:30 | Hora actual |
| `{{TRACKING_URL}}` | https://track.example.com | URL de seguimiento |
| `{{BUSINESS_NAME}}` | Mi Tienda | Nombre del negocio |
| `{{ORDER_NUMBER}}` | ORD-2024-001234 | Número de pedido |

---

## 🎯 BOTONES DISPONIBLES

| Botón | Valor | Acción |
|-------|-------|--------|
| 📞 Llamada | `btn_call` | Llamar a número |
| 🌐 URL | `btn_url` | Abrir sitio web |
| 💬 WhatsApp | `btn_whatsapp` | Iniciar chat |
| 📋 Copiar | `btn_copy` | Copiar código |
| 📍 Ubicación | `btn_location` | Ver ubicación |

---

## ✅ CHECKLIST

- [ ] Encontraste el archivo `/client/campaigns.html`
- [ ] Agregaste los botones en el `<select id="buttonType">`
- [ ] Agregaste los campos de configuración de botones
- [ ] Agregaste la sección de variables
- [ ] Agregaste los estilos CSS
- [ ] Agregaste el JavaScript para manejar botones
- [ ] Probaste agregar variables al mensaje
- [ ] Probaste copiar variables
- [ ] Guardaste la campaña con botones y variables

---

**Última actualización:** 22 de Noviembre, 2025
