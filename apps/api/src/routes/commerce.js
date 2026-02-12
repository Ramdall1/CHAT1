import express from 'express';
import Joi from 'joi';
import CommerceService from '../services/CommerceService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateSchema } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const commerceService = new CommerceService();

// ==================== ESQUEMAS DE VALIDACIÓN ====================

const productSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(2000),
  shortDescription: Joi.string().allow('').max(500),
  categoryId: Joi.string().required(),
  price: Joi.number().positive().required(),
  comparePrice: Joi.number().positive().optional(),
  cost: Joi.number().positive().optional(),
  currency: Joi.string().length(3).optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  variants: Joi.array().optional(),
  attributes: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('active', 'inactive', 'draft').optional(),
  featured: Joi.boolean().optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: Joi.object({
    length: Joi.number().min(0),
    width: Joi.number().min(0),
    height: Joi.number().min(0),
  }).optional(),
  seoTitle: Joi.string().max(255).optional(),
  seoDescription: Joi.string().max(500).optional(),
  metadata: Joi.object().optional(),
  initialStock: Joi.number().integer().min(0).optional(),
});

const categorySchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(1000),
  parentId: Joi.string().optional().allow(null),
  image: Joi.string().uri().optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  metadata: Joi.object().optional(),
});

const cartItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().positive().required(),
});

const orderSchema = Joi.object({
  shippingAddress: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    address1: Joi.string().required(),
    address2: Joi.string().allow(''),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required(),
    phone: Joi.string().optional(),
  }).required(),
  billingAddress: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    address1: Joi.string().required(),
    address2: Joi.string().allow(''),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required(),
    phone: Joi.string().optional(),
  }).optional(),
  paymentMethod: Joi.string().required(),
  notes: Joi.string().allow('').max(1000).optional(),
  metadata: Joi.object().optional(),
});

// ==================== MIDDLEWARE ====================

// Rate limiting específico para commerce
const commerceRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: 'Demasiadas solicitudes de commerce, intenta de nuevo más tarde',
});

// ==================== RUTAS DE PRODUCTOS ====================

/**
 * @route POST /api/commerce/products
 * @desc Crear nuevo producto
 * @access Admin
 */
router.post(
  '/products',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateSchema(productSchema),
  async (req, res) => {
    try {
      const product = await commerceService.createProduct(req.body);
      res.status(201).json({
        success: true,
        data: product,
        message: 'Producto creado exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/commerce/products
 * @desc Listar productos con filtros
 * @access Public
 */
router.get('/products', commerceRateLimit, async (req, res) => {
  try {
    const filters = {
      categoryId: req.query.categoryId,
      status: req.query.status || 'active',
      featured: req.query.featured ? req.query.featured === 'true' : undefined,
      inStock: req.query.inStock ? req.query.inStock === 'true' : undefined,
      priceMin: req.query.priceMin,
      priceMax: req.query.priceMax,
      search: req.query.search,
      sortBy: req.query.sortBy || 'created_desc',
    };

    const products = await commerceService.listProducts(filters);

    res.json({
      success: true,
      data: products,
      total: products.length,
      filters: filters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/commerce/products/search
 * @desc Buscar productos
 * @access Public
 */
router.get('/products/search', commerceRateLimit, async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro de búsqueda requerido',
      });
    }

    const filters = {
      categoryId: req.query.categoryId,
      status: req.query.status || 'active',
      priceMin: req.query.priceMin,
      priceMax: req.query.priceMax,
      sortBy: req.query.sortBy || 'created_desc',
    };

    const results = await commerceService.searchProducts(query, filters);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/commerce/products/bestsellers
 * @desc Obtener productos más vendidos
 * @access Public
 */
router.get('/products/bestsellers', commerceRateLimit, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await commerceService.getBestSellingProducts(limit);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/commerce/products/:id
 * @desc Obtener producto por ID
 * @access Public
 */
router.get('/products/:id', commerceRateLimit, async (req, res) => {
  try {
    const product = await commerceService.getProduct(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/commerce/products/:id/related
 * @desc Obtener productos relacionados
 * @access Public
 */
router.get('/products/:id/related', commerceRateLimit, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const products = await commerceService.getRelatedProducts(
      req.params.id,
      limit
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/commerce/products/:id
 * @desc Actualizar producto
 * @access Admin
 */
router.put(
  '/products/:id',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const product = await commerceService.updateProduct(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        data: product,
        message: 'Producto actualizado exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route DELETE /api/commerce/products/:id
 * @desc Eliminar producto
 * @access Admin
 */
router.delete(
  '/products/:id',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const product = await commerceService.deleteProduct(req.params.id);

      res.json({
        success: true,
        data: product,
        message: 'Producto eliminado exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE CATEGORÍAS ====================

/**
 * @route POST /api/commerce/categories
 * @desc Crear nueva categoría
 * @access Admin
 */
router.post(
  '/categories',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateSchema(categorySchema),
  async (req, res) => {
    try {
      const category = await commerceService.createCategory(req.body);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Categoría creada exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/commerce/categories
 * @desc Listar categorías
 * @access Public
 */
router.get('/categories', commerceRateLimit, async (req, res) => {
  try {
    const includeHierarchy = req.query.hierarchy === 'true';
    const categories = await commerceService.listCategories(includeHierarchy);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== RUTAS DE INVENTARIO ====================

/**
 * @route PUT /api/commerce/inventory/:productId
 * @desc Actualizar stock de producto
 * @access Admin
 */
router.put(
  '/inventory/:productId',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const { quantity, operation = 'set' } = req.body;

      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({
          success: false,
          error: 'Cantidad debe ser un número positivo',
        });
      }

      const result = await commerceService.updateStock(
        req.params.productId,
        quantity,
        operation
      );

      res.json({
        success: true,
        data: result,
        message: 'Stock actualizado exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/commerce/inventory/:productId/availability
 * @desc Verificar disponibilidad de stock
 * @access Public
 */
router.get(
  '/inventory/:productId/availability',
  commerceRateLimit,
  async (req, res) => {
    try {
      const quantity = parseInt(req.query.quantity) || 1;
      const availability = await commerceService.checkStockAvailability(
        req.params.productId,
        quantity
      );

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE CARRITOS ====================

/**
 * @route GET /api/commerce/cart
 * @desc Obtener carrito del usuario
 * @access Authenticated
 */
router.get('/cart', commerceRateLimit, authenticateToken, async (req, res) => {
  try {
    const cart = await commerceService.getCart(req.user.id, req.sessionID);

    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/commerce/cart/items
 * @desc Agregar item al carrito
 * @access Authenticated
 */
router.post(
  '/cart/items',
  commerceRateLimit,
  authenticateToken,
  validateSchema(cartItemSchema),
  async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      const cart = await commerceService.addToCart(
        req.user.id,
        productId,
        quantity,
        req.sessionID
      );

      res.json({
        success: true,
        data: cart,
        message: 'Producto agregado al carrito',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route PUT /api/commerce/cart/items/:productId
 * @desc Actualizar cantidad de item en carrito
 * @access Authenticated
 */
router.put(
  '/cart/items/:productId',
  commerceRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const { quantity } = req.body;

      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({
          success: false,
          error: 'Cantidad debe ser un número positivo',
        });
      }

      const cart = await commerceService.updateCartItemQuantity(
        req.user.id,
        req.params.productId,
        quantity,
        req.sessionID
      );

      res.json({
        success: true,
        data: cart,
        message: 'Carrito actualizado',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route DELETE /api/commerce/cart/items/:productId
 * @desc Remover item del carrito
 * @access Authenticated
 */
router.delete(
  '/cart/items/:productId',
  commerceRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const cart = await commerceService.removeFromCart(
        req.user.id,
        req.params.productId,
        req.sessionID
      );

      res.json({
        success: true,
        data: cart,
        message: 'Producto removido del carrito',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route DELETE /api/commerce/cart
 * @desc Limpiar carrito
 * @access Authenticated
 */
router.delete(
  '/cart',
  commerceRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const cart = await commerceService.clearCart(req.user.id, req.sessionID);

      res.json({
        success: true,
        data: cart,
        message: 'Carrito limpiado',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE ÓRDENES ====================

/**
 * @route POST /api/commerce/orders
 * @desc Crear orden desde carrito
 * @access Authenticated
 */
router.post(
  '/orders',
  commerceRateLimit,
  authenticateToken,
  validateSchema(orderSchema),
  async (req, res) => {
    try {
      const order = await commerceService.createOrder(
        req.user.id,
        req.body,
        req.sessionID
      );

      res.status(201).json({
        success: true,
        data: order,
        message: 'Orden creada exitosamente',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/commerce/orders
 * @desc Listar órdenes del usuario
 * @access Authenticated
 */
router.get(
  '/orders',
  commerceRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const orders = await commerceService.getOrders();
      const userOrders = orders.filter(order => order.userId === req.user.id);

      res.json({
        success: true,
        data: userOrders,
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
 * @route GET /api/commerce/orders/:id
 * @desc Obtener orden por ID
 * @access Authenticated
 */
router.get(
  '/orders/:id',
  commerceRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const orders = await commerceService.getOrders();
      const order = orders.find(o => o.id === req.params.id);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      // Verificar que el usuario sea el propietario o admin
      if (order.userId !== req.user.id && !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'No autorizado para ver esta orden',
        });
      }

      res.json({
        success: true,
        data: order,
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
 * @route PUT /api/commerce/orders/:id/status
 * @desc Actualizar estado de orden
 * @access Admin
 */
router.put(
  '/orders/:id/status',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const { status, notes } = req.body;

      const validStatuses = Object.values(commerceService.orderStatuses);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Estado de orden inválido',
        });
      }

      const order = await commerceService.updateOrderStatus(
        req.params.id,
        status,
        notes
      );

      res.json({
        success: true,
        data: order,
        message: 'Estado de orden actualizado',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== RUTAS DE ESTADÍSTICAS ====================

/**
 * @route GET /api/commerce/stats
 * @desc Obtener estadísticas del servicio
 * @access Admin
 */
router.get(
  '/stats',
  commerceRateLimit,
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const stats = await commerceService.getServiceStats();

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
  }
);

// ==================== MANEJO DE ERRORES ====================

// Middleware de manejo de errores específico para commerce
router.use((error, req, res, next) => {
  console.error('Commerce API Error:', error);

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor de commerce',
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
});

export default router;
