import express from 'express';
import BillingService from '../services/BillingService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();
const billingService = new BillingService();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// ==================== RUTAS DE FACTURAS ====================

/**
 * @route POST /api/billing/invoices
 * @desc Crear nueva factura
 * @access Admin, Manager
 */
router.post(
  '/invoices',
  requireRole(['admin', 'manager']),
  [
    body('clientId').notEmpty().withMessage('Client ID es requerido'),
    body('items').isArray().withMessage('Items debe ser un array'),
    body('items.*.description')
      .notEmpty()
      .withMessage('Descripción del item es requerida'),
    body('items.*.quantity')
      .isNumeric()
      .withMessage('Cantidad debe ser numérica'),
    body('items.*.unitPrice')
      .isNumeric()
      .withMessage('Precio unitario debe ser numérico'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Moneda debe tener 3 caracteres'),
    body('paymentTerms')
      .optional()
      .isNumeric()
      .withMessage('Términos de pago deben ser numéricos'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await billingService.createInvoice(req.body);
      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Factura creada exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/invoices
 * @desc Listar facturas con filtros
 * @access Admin, Manager, User (solo sus facturas)
 */
router.get(
  '/invoices',
  [
    query('clientId').optional().notEmpty(),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'overdue', 'cancelled']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('page').optional().isNumeric(),
    query('limit').optional().isNumeric(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const filters = { ...req.query };

      // Si no es admin/manager, solo puede ver sus propias facturas
      if (!['admin', 'manager'].includes(req.user.role)) {
        filters.clientId = req.user.clientId;
      }

      const invoices = await billingService.listInvoices(filters);

      // Paginación
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedInvoices = invoices.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedInvoices,
        pagination: {
          page,
          limit,
          total: invoices.length,
          pages: Math.ceil(invoices.length / limit),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/invoices/:id
 * @desc Obtener factura por ID
 * @access Admin, Manager, User (solo su factura)
 */
router.get(
  '/invoices/:id',
  [param('id').notEmpty().withMessage('ID de factura es requerido')],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await billingService.getInvoice(req.params.id);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Factura no encontrada',
        });
      }

      // Verificar permisos
      if (
        !['admin', 'manager'].includes(req.user.role) &&
        invoice.clientId !== req.user.clientId
      ) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para ver esta factura',
        });
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route PUT /api/billing/invoices/:id
 * @desc Actualizar factura
 * @access Admin, Manager
 */
router.put(
  '/invoices/:id',
  requireRole(['admin', 'manager']),
  [
    param('id').notEmpty().withMessage('ID de factura es requerido'),
    body('items').optional().isArray(),
    body('status').optional().isIn(['pending', 'paid', 'overdue', 'cancelled']),
    body('notes').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await billingService.updateInvoice(
        req.params.id,
        req.body
      );
      res.json({
        success: true,
        data: invoice,
        message: 'Factura actualizada exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route POST /api/billing/invoices/:id/pay
 * @desc Marcar factura como pagada
 * @access Admin, Manager
 */
router.post(
  '/invoices/:id/pay',
  requireRole(['admin', 'manager']),
  [
    param('id').notEmpty().withMessage('ID de factura es requerido'),
    body('paymentMethod').notEmpty().withMessage('Método de pago es requerido'),
    body('transactionId').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await billingService.markInvoiceAsPaid(
        req.params.id,
        req.body
      );
      res.json({
        success: true,
        data: invoice,
        message: 'Factura marcada como pagada',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE PAGOS ====================

/**
 * @route POST /api/billing/payments
 * @desc Procesar nuevo pago
 * @access Admin, Manager, User
 */
router.post(
  '/payments',
  [
    body('amount').isNumeric().withMessage('Monto debe ser numérico'),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('paymentMethod').notEmpty().withMessage('Método de pago es requerido'),
    body('invoiceId').optional().isString(),
    body('clientId').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const paymentData = { ...req.body };

      // Si no es admin/manager, usar su clientId
      if (!['admin', 'manager'].includes(req.user.role)) {
        paymentData.clientId = req.user.clientId;
      }

      const payment = await billingService.processPayment(paymentData);
      res.status(201).json({
        success: true,
        data: payment,
        message: 'Pago iniciado exitosamente',
      });
    } catch (error) {
      // Determinar el código de estado basado en el tipo de error
      const isValidationError = error.message.includes('inválido') || 
                               error.message.includes('no encontrada') || 
                               error.message.includes('ya está pagada');
      
      const statusCode = isValidationError ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/payments
 * @desc Listar pagos
 * @access Admin, Manager, User (solo sus pagos)
 */
router.get(
  '/payments',
  [
    query('clientId').optional().notEmpty(),
    query('status')
      .optional()
      .isIn(['processing', 'completed', 'failed', 'refunded']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const payments = await billingService.getPayments();
      let filtered = payments;

      // Filtrar por cliente si no es admin/manager
      if (!['admin', 'manager'].includes(req.user.role)) {
        filtered = filtered.filter(
          payment => payment.clientId === req.user.clientId
        );
      } else if (req.query.clientId) {
        filtered = filtered.filter(
          payment => payment.clientId === req.query.clientId
        );
      }

      // Aplicar otros filtros
      if (req.query.status) {
        filtered = filtered.filter(
          payment => payment.status === req.query.status
        );
      }

      if (req.query.dateFrom) {
        filtered = filtered.filter(
          payment => new Date(payment.createdAt) >= new Date(req.query.dateFrom)
        );
      }

      if (req.query.dateTo) {
        filtered = filtered.filter(
          payment => new Date(payment.createdAt) <= new Date(req.query.dateTo)
        );
      }

      res.json({
        success: true,
        data: filtered.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        ),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE SUSCRIPCIONES ====================

/**
 * @route POST /api/billing/subscriptions
 * @desc Crear nueva suscripción
 * @access Admin, Manager
 */
router.post(
  '/subscriptions',
  requireRole(['admin', 'manager']),
  [
    body('clientId').notEmpty().withMessage('Client ID es requerido'),
    body('planId').notEmpty().withMessage('Plan ID es requerido'),
    body('billingCycle').optional().isIn(['monthly', 'yearly']),
    body('paymentMethod').notEmpty().withMessage('Método de pago es requerido'),
    body('trialDays').optional().isNumeric(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const subscription = await billingService.createSubscription(req.body);
      res.status(201).json({
        success: true,
        data: subscription,
        message: 'Suscripción creada exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/subscriptions
 * @desc Listar suscripciones
 * @access Admin, Manager, User (solo su suscripción)
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const subscriptions = await billingService.getSubscriptions();
    let filtered = subscriptions;

    // Filtrar por cliente si no es admin/manager
    if (!['admin', 'manager'].includes(req.user.role)) {
      filtered = filtered.filter(sub => sub.clientId === req.user.clientId);
    } else if (req.query.clientId) {
      filtered = filtered.filter(sub => sub.clientId === req.query.clientId);
    }

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/billing/subscriptions/:id
 * @desc Actualizar suscripción
 * @access Admin, Manager
 */
router.put(
  '/subscriptions/:id',
  requireRole(['admin', 'manager']),
  [
    param('id').notEmpty().withMessage('ID de suscripción es requerido'),
    body('status')
      .optional()
      .isIn(['active', 'cancelled', 'suspended', 'expired']),
    body('planId').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const subscription = await billingService.updateSubscription(
        req.params.id,
        req.body
      );
      res.json({
        success: true,
        data: subscription,
        message: 'Suscripción actualizada exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route DELETE /api/billing/subscriptions/:id
 * @desc Cancelar suscripción
 * @access Admin, Manager, User (solo su suscripción)
 */
router.delete(
  '/subscriptions/:id',
  [
    param('id').notEmpty().withMessage('ID de suscripción es requerido'),
    body('reason').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Verificar permisos si no es admin/manager
      if (!['admin', 'manager'].includes(req.user.role)) {
        const subscriptions = await billingService.getSubscriptions();
        const subscription = subscriptions.find(
          sub => sub.id === req.params.id
        );

        if (!subscription || subscription.clientId !== req.user.clientId) {
          return res.status(403).json({
            success: false,
            error: 'No tienes permisos para cancelar esta suscripción',
          });
        }
      }

      const subscription = await billingService.cancelSubscription(
        req.params.id,
        req.body.reason || 'Cancelado por el usuario'
      );

      res.json({
        success: true,
        data: subscription,
        message: 'Suscripción cancelada exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE USO Y ANÁLISIS ====================

/**
 * @route POST /api/billing/usage
 * @desc Registrar uso de servicio
 * @access Admin, Manager
 */
router.post(
  '/usage',
  requireRole(['admin', 'manager']),
  [
    body('clientId').notEmpty().withMessage('Client ID es requerido'),
    body('service').notEmpty().withMessage('Servicio es requerido'),
    body('amount').isNumeric().withMessage('Cantidad debe ser numérica'),
    body('metadata').optional().isObject(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const result = await billingService.trackUsage(
        req.body.clientId,
        req.body.service,
        req.body.amount,
        req.body.metadata
      );

      res.json({
        success: true,
        data: result,
        message: 'Uso registrado exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/usage/:clientId
 * @desc Obtener uso por cliente
 * @access Admin, Manager, User (solo su uso)
 */
router.get(
  '/usage/:clientId',
  [
    param('clientId').notEmpty().withMessage('Client ID es requerido'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Verificar permisos
      if (
        !['admin', 'manager'].includes(req.user.role) &&
        req.params.clientId !== req.user.clientId
      ) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para ver este uso',
        });
      }

      const startDate =
        req.query.startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = req.query.endDate || new Date().toISOString();

      const usage = await billingService.getClientUsage(
        req.params.clientId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/analytics/costs/:clientId
 * @desc Obtener análisis de costos
 * @access Admin, Manager, User (solo sus costos)
 */
router.get(
  '/analytics/costs/:clientId',
  [
    param('clientId').notEmpty().withMessage('Client ID es requerido'),
    query('period').optional().isIn(['month', 'quarter', 'year']),
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Verificar permisos
      if (
        !['admin', 'manager'].includes(req.user.role) &&
        req.params.clientId !== req.user.clientId
      ) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para ver estos análisis',
        });
      }

      const analytics = await billingService.getCostAnalytics(
        req.params.clientId,
        req.query.period || 'month'
      );

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/reports/financial
 * @desc Generar reporte financiero
 * @access Admin, Manager
 */
router.get(
  '/reports/financial',
  requireRole(['admin', 'manager']),
  [
    query('startDate')
      .notEmpty()
      .withMessage('Fecha de inicio es requerida')
      .isISO8601(),
    query('endDate')
      .notEmpty()
      .withMessage('Fecha de fin es requerida')
      .isISO8601(),
    query('clientId').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const report = await billingService.generateFinancialReport(
        req.query.startDate,
        req.query.endDate,
        req.query.clientId
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/billing/stats
 * @desc Obtener estadísticas del servicio de facturación
 * @access Admin, Manager
 */
router.get('/stats', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = await billingService.getServiceStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/billing/plans
 * @desc Obtener planes de precios disponibles
 * @access Public
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: billingService.pricingPlans,
  });
});

/**
 * @route GET /api/billing/pricing
 * @desc Obtener información de precios por uso
 * @access Admin, Manager
 */
router.get('/pricing', requireRole(['admin', 'manager']), (req, res) => {
  res.json({
    success: true,
    data: billingService.usagePricing,
  });
});

// Manejo de errores
router.use((error, req, res, next) => {
  console.error('Billing API Error:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor de facturación',
  });
});

export default router;
