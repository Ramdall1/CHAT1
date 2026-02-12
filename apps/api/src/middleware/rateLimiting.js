import rateLimit from 'express-rate-limit';

/**
 * Rate limiter general para APIs - DESACTIVADO
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Demasiadas solicitudes',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter estricto para operaciones de billing - DESACTIVADO
 */
export const billingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Límite de solicitudes de facturación excedido',
    code: 'BILLING_RATE_LIMIT_EXCEEDED',
    retryAfter: '5 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  keyGenerator: req => {
    // Usar user ID si está autenticado, sino IP
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas operaciones de facturación',
      code: 'BILLING_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter para operaciones de commerce - DESACTIVADO
 */
export const commerceRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Límite de solicitudes de comercio excedido',
    code: 'COMMERCE_RATE_LIMIT_EXCEEDED',
    retryAfter: '10 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  keyGenerator: req => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas operaciones de comercio',
      code: 'COMMERCE_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter muy estricto para operaciones de pago - DESACTIVADO
 */
export const paymentRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Límite de operaciones de pago excedido',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minuto',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  keyGenerator: req => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error:
        'Demasiadas operaciones de pago. Por seguridad, espere antes de intentar nuevamente.',
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter para operaciones de carrito - DESACTIVADO
 */
export const cartRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Límite de operaciones de carrito excedido',
    code: 'CART_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minuto',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  keyGenerator: req => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas operaciones de carrito',
      code: 'CART_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Rate limiter para operaciones de búsqueda - DESACTIVADO
 */
export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 999999, // límite muy alto para desactivar efectivamente
  message: {
    error: 'Límite de búsquedas excedido',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minuto',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Saltar todos los requests
  keyGenerator: req => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas búsquedas',
      code: 'SEARCH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Función para crear rate limiters personalizados - DESACTIVADO
 */
export const createCustomRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 999999, // límite muy alto para desactivar efectivamente
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true, // Saltar todos los requests
    keyGenerator: req => req.user?.id || req.ip,
  };

  return rateLimit({
    ...defaultOptions,
    ...options,
    handler: (req, res) => {
      res.status(429).json({
        error: options.message || 'Límite de solicitudes excedido',
        code: options.code || 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(req.rateLimit.resetTime / 1000),
      });
    },
  });
};

export default {
  generalRateLimit,
  billingRateLimit,
  commerceRateLimit,
  paymentRateLimit,
  cartRateLimit,
  searchRateLimit,
  createCustomRateLimit,
};
