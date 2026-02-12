import rateLimit from 'express-rate-limit';

/**
 * Función para crear rate limiters personalizados - DESACTIVADO
 */
export const rateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutos por defecto
    max: 999999, // límite muy alto para desactivar efectivamente
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true, // Saltar todos los requests
    // Usar el keyGenerator por defecto que maneja IPv6 correctamente
    handler: (req, res) => {
      res.status(429).json({
        error: options.message || 'Demasiadas solicitudes',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(req.rateLimit.resetTime / 1000),
      });
    },
  };

  return rateLimit({
    ...defaultOptions,
    ...options,
  });
};

/**
 * Rate limiters predefinidos - TODOS DESACTIVADOS
 */
export const generalRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 999999, // límite muy alto para desactivar efectivamente
  skip: () => true, // Saltar todos los requests
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde',
});

export const strictRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 999999, // límite muy alto para desactivar efectivamente
  skip: () => true, // Saltar todos los requests
  message: 'Límite de solicitudes excedido',
});

export const paymentRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 999999, // límite muy alto para desactivar efectivamente
  skip: () => true, // Saltar todos los requests
  message: 'Demasiadas operaciones de pago',
});

export default rateLimiter;
