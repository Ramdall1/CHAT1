# APIs de Billing y Commerce

Esta documentación describe las APIs de facturación y comercio integradas en el sistema de WhatsApp Bot.

## Tabla de Contenidos

- [API de Billing](#api-de-billing)
- [API de Commerce](#api-de-commerce)
- [Integración](#integración)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Configuración](#configuración)

## API de Billing

### Base URL
```
/api/billing
```

### Autenticación
Todas las rutas requieren autenticación mediante token JWT en el header `Authorization: Bearer <token>`.

### Endpoints de Facturas

#### Crear Factura
```http
POST /api/billing/invoices
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": "customer_123",
  "items": [
    {
      "description": "Plan Professional - Enero 2024",
      "quantity": 1,
      "unitPrice": 99.99,
      "total": 99.99
    }
  ],
  "dueDate": "2024-02-15T00:00:00.000Z",
  "notes": "Factura mensual del plan professional"
}
```

#### Listar Facturas
```http
GET /api/billing/invoices?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Obtener Factura por ID
```http
GET /api/billing/invoices/:invoiceId
Authorization: Bearer <token>
```

#### Marcar Factura como Pagada
```http
POST /api/billing/invoices/:invoiceId/mark-paid
Authorization: Bearer <token>

{
  "paymentMethod": "credit_card",
  "transactionId": "txn_123456",
  "paidAmount": 99.99
}
```

### Endpoints de Pagos

#### Procesar Pago
```http
POST /api/billing/payments
Content-Type: application/json
Authorization: Bearer <token>

{
  "invoiceId": "inv_123",
  "amount": 99.99,
  "paymentMethod": "credit_card",
  "paymentDetails": {
    "cardLast4": "1234",
    "cardBrand": "visa"
  }
}
```

#### Listar Pagos
```http
GET /api/billing/payments?customerId=customer_123&page=1&limit=10
Authorization: Bearer <token>
```

### Endpoints de Suscripciones

#### Crear Suscripción
```http
POST /api/billing/subscriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": "customer_123",
  "planId": "professional",
  "billingCycle": "monthly",
  "startDate": "2024-01-01T00:00:00.000Z"
}
```

#### Actualizar Suscripción
```http
PUT /api/billing/subscriptions/:subscriptionId
Content-Type: application/json
Authorization: Bearer <token>

{
  "planId": "enterprise",
  "billingCycle": "yearly"
}
```

#### Cancelar Suscripción
```http
DELETE /api/billing/subscriptions/:subscriptionId
Authorization: Bearer <token>

{
  "reason": "Customer request",
  "cancelAtPeriodEnd": true
}
```

### Endpoints de Uso y Analytics

#### Registrar Uso
```http
POST /api/billing/usage
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": "customer_123",
  "usageType": "messages",
  "quantity": 150,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Obtener Análisis de Costos
```http
GET /api/billing/analytics/cost-analysis?customerId=customer_123&period=monthly
Authorization: Bearer <token>
```

## API de Commerce

### Base URL
```
/api/commerce
```

### Endpoints de Productos

#### Crear Producto
```http
POST /api/commerce/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Plan Premium WhatsApp Bot",
  "description": "Plan premium con todas las funcionalidades",
  "price": 199.99,
  "currency": "USD",
  "category": "subscription",
  "sku": "WBOT-PREMIUM",
  "stock": 999,
  "features": [
    "Mensajes ilimitados",
    "IA avanzada",
    "Soporte 24/7"
  ]
}
```

#### Listar Productos
```http
GET /api/commerce/products?category=subscription&status=active&page=1&limit=10
Authorization: Bearer <token>
```

#### Buscar Productos
```http
GET /api/commerce/products/search?q=premium&category=subscription
Authorization: Bearer <token>
```

#### Obtener Productos Más Vendidos
```http
GET /api/commerce/products/bestsellers?limit=5
Authorization: Bearer <token>
```

### Endpoints de Inventario

#### Actualizar Stock
```http
PUT /api/commerce/inventory/:productId
Content-Type: application/json
Authorization: Bearer <token>

{
  "stock": 500,
  "operation": "set"
}
```

#### Verificar Disponibilidad
```http
GET /api/commerce/inventory/:productId/availability?quantity=2
Authorization: Bearer <token>
```

### Endpoints de Carrito

#### Obtener Carrito
```http
GET /api/commerce/cart/:customerId
Authorization: Bearer <token>
```

#### Añadir al Carrito
```http
POST /api/commerce/cart/:customerId/items
Content-Type: application/json
Authorization: Bearer <token>

{
  "productId": "prod_001",
  "quantity": 1,
  "customizations": {
    "billingCycle": "yearly"
  }
}
```

#### Actualizar Cantidad
```http
PUT /api/commerce/cart/:customerId/items/:productId
Content-Type: application/json
Authorization: Bearer <token>

{
  "quantity": 2
}
```

### Endpoints de Órdenes

#### Crear Orden desde Carrito
```http
POST /api/commerce/orders/from-cart
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": "customer_123",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "paymentMethod": "credit_card"
}
```

#### Listar Órdenes
```http
GET /api/commerce/orders?customerId=customer_123&status=pending
Authorization: Bearer <token>
```

#### Actualizar Estado de Orden
```http
PUT /api/commerce/orders/:orderId/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "shipped",
  "notes": "Enviado via FedEx, tracking: 123456789"
}
```

## Integración

### Flujo Completo de Compra

1. **Explorar Productos**
   ```http
   GET /api/commerce/products?category=subscription
   ```

2. **Añadir al Carrito**
   ```http
   POST /api/commerce/cart/customer_123/items
   ```

3. **Crear Orden**
   ```http
   POST /api/commerce/orders/from-cart
   ```

4. **Generar Factura**
   ```http
   POST /api/billing/invoices
   ```

5. **Procesar Pago**
   ```http
   POST /api/billing/payments
   ```

6. **Crear Suscripción** (si aplica)
   ```http
   POST /api/billing/subscriptions
   ```

### Webhooks

El sistema emite eventos para integración con otros servicios:

- `invoice.created`
- `payment.received`
- `subscription.updated`
- `order.created`
- `inventory.low`

## Ejemplos de Uso

### Ejemplo 1: Crear Suscripción Completa

```javascript
// 1. Crear cliente y añadir producto al carrito
const cartResponse = await fetch('/api/commerce/cart/customer_123/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    productId: 'prod_002',
    quantity: 1,
    customizations: { billingCycle: 'monthly' }
  })
});

// 2. Crear orden
const orderResponse = await fetch('/api/commerce/orders/from-cart', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    customerId: 'customer_123',
    paymentMethod: 'credit_card'
  })
});

// 3. Crear suscripción
const subscriptionResponse = await fetch('/api/billing/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    customerId: 'customer_123',
    planId: 'professional',
    billingCycle: 'monthly'
  })
});
```

### Ejemplo 2: Monitoreo de Uso y Facturación

```javascript
// Registrar uso de mensajes
await fetch('/api/billing/usage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    customerId: 'customer_123',
    usageType: 'messages',
    quantity: 50
  })
});

// Obtener análisis de costos
const analytics = await fetch('/api/billing/analytics/cost-analysis?customerId=customer_123&period=monthly', {
  headers: { 'Authorization': 'Bearer ' + token }
});
```

## Configuración

### Variables de Entorno

```bash
# Billing Configuration
BILLING_CURRENCY=USD
BILLING_TAX_RATE=0.10
BILLING_PAYMENT_METHODS=credit_card,paypal,stripe

# Commerce Configuration
COMMERCE_CURRENCY=USD
COMMERCE_TAX_RATE=0.08
COMMERCE_FREE_SHIPPING_THRESHOLD=100.00

# Integration
WEBHOOK_SECRET=your_webhook_secret
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_WHATSAPP_ENABLED=true
```

### Archivo de Configuración

Copia `config/billing-commerce.example.json` a `config/billing-commerce.json` y ajusta los valores según tus necesidades.

## Rate Limiting

Las APIs tienen límites de velocidad configurados:

- **Billing API**: 100 requests por minuto por IP
- **Commerce API**: 200 requests por minuto por IP
- **Analytics**: 50 requests por minuto por IP

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido |
| 403 | Forbidden - Permisos insuficientes |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto de datos |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Error del servidor |

## Soporte

Para soporte técnico o preguntas sobre la implementación, consulta la documentación adicional en `/docs/` o contacta al equipo de desarrollo.