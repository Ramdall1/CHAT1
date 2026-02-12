import BaseAgent from './BaseAgent.js';
import EventTypes from './EventTypes.js';

/**
 * Agente especializado en ventas
 * Escucha eventos de interés del usuario y pagos para persuadir con mensajes personalizados
 */
class SalesAgent extends BaseAgent {
  constructor(eventBus, config = {}) {
    super('SalesAgent', eventBus, {
      priority: 'high',
      maxConcurrentTasks: 10,
      retryAttempts: 3,
      timeout: 15000,
      ...config
    });
        
    this.salesConfig = {
      persuasionLevel: config.persuasionLevel || 'medium',
      followUpDelay: config.followUpDelay || 300000, // 5 minutos
      maxFollowUps: config.maxFollowUps || 3,
      discountThreshold: config.discountThreshold || 2, // Después de 2 rechazos
      urgencyMessages: config.urgencyMessages || true,
      personalizedOffers: config.personalizedOffers || true
    };
        
    this.customerProfiles = new Map();
    this.activeOffers = new Map();
    this.followUpTimers = new Map();
        
    this.salesStats = {
      leadsGenerated: 0,
      conversions: 0,
      rejections: 0,
      followUpsSent: 0,
      discountsOffered: 0,
      averageConversionTime: 0
    };
  }

  /**
     * Registra los listeners específicos del agente de ventas
     */
  async registerEventListeners() {
    // Eventos de interés del usuario
    this.on('user.interested', this.handleUserInterest.bind(this));
    this.on('user.viewing_product', this.handleProductViewing.bind(this));
    this.on('user.cart_abandoned', this.handleCartAbandonment.bind(this));
    this.on('user.price_inquiry', this.handlePriceInquiry.bind(this));
        
    // Eventos de pagos
    this.on('payment.declined', this.handlePaymentDeclined.bind(this));
    this.on('payment.pending', this.handlePaymentPending.bind(this));
    this.on('payment.approved', this.handlePaymentApproved.bind(this));
    this.on('payment.failed', this.handlePaymentFailed.bind(this));
        
    // Eventos de comportamiento del usuario
    this.on('user.hesitating', this.handleUserHesitation.bind(this));
    this.on('user.comparing_prices', this.handlePriceComparison.bind(this));
    this.on('user.session_ending', this.handleSessionEnding.bind(this));
        
    // Eventos de competencia
    this.on('competitor.price_drop', this.handleCompetitorPriceDrop.bind(this));
    this.on('market.trend_change', this.handleMarketTrendChange.bind(this));
        
    logger.info(`💰 ${this.name}: Listeners de ventas registrados`);
  }

  /**
     * Maneja el interés del usuario
     */
  async handleUserInterest(data) {
    const { userId, productId, interestLevel, context } = data;
        
    logger.info(`💰 ${this.name}: Usuario ${userId} muestra interés en ${productId} (nivel: ${interestLevel})`);
        
    // Actualizar perfil del cliente
    this.updateCustomerProfile(userId, {
      lastInterest: {
        productId,
        level: interestLevel,
        timestamp: new Date().toISOString(),
        context
      }
    });
        
    // Generar mensaje personalizado basado en el nivel de interés
    const message = await this.generateInterestMessage(userId, productId, interestLevel, context);
        
    // Emitir evento de mensaje de ventas
    this.emit('sales.message_generated', {
      userId,
      productId,
      message,
      type: 'interest_response',
      urgency: this.calculateUrgency(interestLevel),
      timestamp: new Date().toISOString()
    });
        
    // Programar seguimiento si es necesario
    if (interestLevel === 'high') {
      this.scheduleFollowUp(userId, productId, 'high_interest');
    }
        
    this.salesStats.leadsGenerated++;
  }

  /**
     * Maneja cuando el usuario está viendo un producto
     */
  async handleProductViewing(data) {
    const { userId, productId, viewDuration, previousViews } = data;
        
    logger.info(`👀 ${this.name}: Usuario ${userId} viendo ${productId} por ${viewDuration}ms`);
        
    // Si ha visto el producto múltiples veces, aumentar persuasión
    if (previousViews > 2) {
      const message = await this.generateRepeatedViewMessage(userId, productId, previousViews);
            
      this.emit('sales.repeated_view_detected', {
        userId,
        productId,
        viewCount: previousViews,
        message,
        recommendedAction: 'offer_discount',
        timestamp: new Date().toISOString()
      });
    }
        
    // Si la duración de visualización es larga, es una buena señal
    if (viewDuration > 30000) { // Más de 30 segundos
      this.emit('sales.extended_view_detected', {
        userId,
        productId,
        viewDuration,
        recommendedAction: 'send_offer',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja el abandono del carrito
     */
  async handleCartAbandonment(data) {
    const { userId, cartItems, abandonmentReason, cartValue } = data;
        
    logger.info(`🛒 ${this.name}: Usuario ${userId} abandonó carrito con valor $${cartValue}`);
        
    // Estrategia basada en el valor del carrito
    let strategy = 'basic_reminder';
        
    if (cartValue > 100) {
      strategy = 'premium_recovery';
    } else if (cartValue > 50) {
      strategy = 'discount_offer';
    }
        
    const recoveryMessage = await this.generateCartRecoveryMessage(userId, cartItems, strategy, abandonmentReason);
        
    this.emit('sales.cart_recovery_initiated', {
      userId,
      cartItems,
      cartValue,
      strategy,
      message: recoveryMessage,
      timestamp: new Date().toISOString()
    });
        
    // Programar serie de seguimientos
    this.scheduleCartRecoverySequence(userId, cartItems, cartValue);
  }

  /**
     * Maneja consultas de precios
     */
  async handlePriceInquiry(data) {
    const { userId, productId, currentPrice, userBudget } = data;
        
    logger.info(`💲 ${this.name}: Usuario ${userId} consulta precio de ${productId} (presupuesto: $${userBudget})`);
        
    let response;
        
    if (userBudget && userBudget < currentPrice) {
      // Ofrecer alternativas o descuentos
      response = await this.generateBudgetAlternatives(userId, productId, currentPrice, userBudget);
    } else {
      // Justificar el precio y agregar valor
      response = await this.generateValueJustification(userId, productId, currentPrice);
    }
        
    this.emit('sales.price_response_generated', {
      userId,
      productId,
      currentPrice,
      userBudget,
      response,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Maneja pagos rechazados
     */
  async handlePaymentDeclined(data) {
    const { userId, paymentId, reason, amount, attemptNumber } = data;
        
    logger.info(`❌ ${this.name}: Pago rechazado para usuario ${userId} - Razón: ${reason}`);
        
    this.salesStats.rejections++;
        
    // Actualizar perfil del cliente
    this.updateCustomerProfile(userId, {
      lastRejection: {
        reason,
        amount,
        timestamp: new Date().toISOString(),
        attemptNumber
      }
    });
        
    // Estrategia de recuperación basada en la razón
    let recoveryStrategy;
        
    switch (reason) {
    case 'insufficient_funds':
      recoveryStrategy = 'payment_plan_offer';
      break;
    case 'card_declined':
      recoveryStrategy = 'alternative_payment_methods';
      break;
    case 'security_concern':
      recoveryStrategy = 'security_reassurance';
      break;
    default:
      recoveryStrategy = 'general_assistance';
    }
        
    const recoveryMessage = await this.generatePaymentRecoveryMessage(userId, reason, amount, recoveryStrategy);
        
    this.emit('sales.payment_recovery_initiated', {
      userId,
      paymentId,
      reason,
      amount,
      strategy: recoveryStrategy,
      message: recoveryMessage,
      timestamp: new Date().toISOString()
    });
        
    // Ofrecer descuento después de múltiples rechazos
    if (attemptNumber >= this.salesConfig.discountThreshold) {
      await this.offerRecoveryDiscount(userId, amount);
    }
  }

  /**
     * Maneja pagos pendientes
     */
  async handlePaymentPending(data) {
    const { userId, paymentId, amount, estimatedTime } = data;
        
    logger.info(`⏳ ${this.name}: Pago pendiente para usuario ${userId} - $${amount}`);
        
    // Enviar mensaje de tranquilidad
    const reassuranceMessage = await this.generatePaymentReassurance(userId, estimatedTime);
        
    this.emit('sales.payment_reassurance_sent', {
      userId,
      paymentId,
      amount,
      message: reassuranceMessage,
      estimatedTime,
      timestamp: new Date().toISOString()
    });
        
    // Programar seguimiento si el pago tarda mucho
    if (estimatedTime > 300000) { // Más de 5 minutos
      this.schedulePaymentFollowUp(userId, paymentId, estimatedTime);
    }
  }

  /**
     * Maneja pagos aprobados
     */
  async handlePaymentApproved(data) {
    const { userId, paymentId, amount, products } = data;
        
    logger.info(`✅ ${this.name}: Pago aprobado para usuario ${userId} - $${amount}`);
        
    this.salesStats.conversions++;
        
    // Calcular tiempo de conversión
    const customerProfile = this.customerProfiles.get(userId);
    if (customerProfile && customerProfile.firstInteraction) {
      const conversionTime = Date.now() - new Date(customerProfile.firstInteraction).getTime();
      this.updateAverageConversionTime(conversionTime);
    }
        
    // Enviar mensaje de agradecimiento y upsell
    const thankYouMessage = await this.generateThankYouMessage(userId, amount, products);
    const upsellSuggestions = await this.generateUpsellSuggestions(userId, products);
        
    this.emit('sales.conversion_completed', {
      userId,
      paymentId,
      amount,
      products,
      thankYouMessage,
      upsellSuggestions,
      conversionTime: customerProfile ? Date.now() - new Date(customerProfile.firstInteraction).getTime() : null,
      timestamp: new Date().toISOString()
    });
        
    // Limpiar seguimientos activos
    this.clearFollowUps(userId);
  }

  /**
     * Maneja fallos de pago
     */
  async handlePaymentFailed(data) {
    const { userId, orderId, amount, reason, retryCount = 0 } = data;
        
    logger.info(`💰 ${this.name}: Manejando fallo de pago para usuario ${userId}`);
        
    // Estrategia basada en el número de reintentos
    if (retryCount < 2) {
      // Ofrecer ayuda técnica
      this.emit('ai.sales.payment_assistance', {
        userId,
        orderId,
        message: 'Parece que hubo un problema con el pago. ¿Te gustaría intentar con otro método de pago?',
        suggestedActions: ['retry_payment', 'change_payment_method', 'contact_support'],
        timestamp: new Date().toISOString()
      });
    } else {
      // Ofrecer descuento de recuperación
      this.emit('ai.sales.recovery_offer', {
        userId,
        orderId,
        message: 'Entendemos que puede ser frustrante. Te ofrecemos un 10% de descuento para completar tu compra.',
        discountPercent: 10,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString()
      });
    }
        
    this.stats.paymentFailures++;
  }

  /**
     * Maneja comparación de precios
     */
  async handlePriceComparison(data) {
    const { userId, productId, competitorPrices, currentPrice } = data;
        
    logger.info(`💰 ${this.name}: Usuario ${userId} comparando precios para ${productId}`);
        
    // Analizar ventaja competitiva
    const lowestCompetitorPrice = Math.min(...competitorPrices);
    const priceDifference = currentPrice - lowestCompetitorPrice;
        
    if (priceDifference > 0) {
      // Nuestro precio es más alto, justificar valor
      this.emit('ai.sales.value_proposition', {
        userId,
        productId,
        message: 'Entiendo que estés comparando precios. Nuestro producto incluye garantía extendida, soporte 24/7 y envío gratuito.',
        valuePoints: ['extended_warranty', '24_7_support', 'free_shipping'],
        competitorAnalysis: { priceDifference, lowestCompetitorPrice },
        timestamp: new Date().toISOString()
      });
    } else {
      // Nuestro precio es competitivo
      this.emit('ai.sales.competitive_advantage', {
        userId,
        productId,
        message: '¡Excelente elección! Tenemos el mejor precio del mercado y la mejor calidad.',
        priceAdvantage: Math.abs(priceDifference),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja fin de sesión
     */
  async handleSessionEnding(data) {
    const { userId, sessionDuration, viewedProducts, cartItems } = data;
        
    logger.info(`💰 ${this.name}: Sesión terminando para usuario ${userId}`);
        
    if (cartItems && cartItems.length > 0) {
      // Recordatorio de carrito
      this.emit('ai.sales.cart_reminder', {
        userId,
        message: '¡No olvides completar tu compra! Tus productos te están esperando.',
        cartItems,
        urgency: 'medium',
        timestamp: new Date().toISOString()
      });
            
      // Programar seguimiento
      this.scheduleFollowUp(userId, cartItems[0].productId, 'cart_recovery', 3600000); // 1 hora
    } else if (viewedProducts && viewedProducts.length > 0) {
      // Seguimiento de productos vistos
      this.emit('ai.sales.product_reminder', {
        userId,
        message: 'Vi que estuviste interesado en algunos productos. ¿Te gustaría que te ayude a decidir?',
        viewedProducts,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja caída de precios de competencia
     */
  async handleCompetitorPriceDrop(data) {
    const { competitorName, productId, oldPrice, newPrice, affectedUsers } = data;
        
    logger.info(`💰 ${this.name}: Competidor ${competitorName} bajó precio de ${productId}`);
        
    const priceReduction = oldPrice - newPrice;
    const reductionPercent = (priceReduction / oldPrice) * 100;
        
    // Notificar a usuarios afectados
    for (const userId of affectedUsers) {
      this.emit('ai.sales.competitive_response', {
        userId,
        productId,
        message: '¡Tenemos una oferta especial! Igualamos el precio de la competencia y te damos un 5% adicional de descuento.',
        matchedPrice: newPrice,
        additionalDiscount: 5,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja cambios en tendencias del mercado
     */
  async handleMarketTrendChange(data) {
    const { trend, category, impact, affectedProducts } = data;
        
    logger.info(`💰 ${this.name}: Cambio de tendencia en ${category}: ${trend}`);
        
    if (impact === 'positive') {
      // Aprovechar tendencia positiva
      this.emit('ai.sales.trend_opportunity', {
        category,
        trend,
        message: `¡${category} está en tendencia! Es el momento perfecto para hacer tu compra.`,
        affectedProducts,
        urgency: 'high',
        timestamp: new Date().toISOString()
      });
    } else {
      // Mitigar tendencia negativa
      this.emit('ai.sales.trend_mitigation', {
        category,
        trend,
        message: 'Aprovecha nuestros precios especiales antes de que cambien las condiciones del mercado.',
        affectedProducts,
        strategy: 'urgency_discount',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja la hesitación del usuario
     */
  async handleUserHesitation(data) {
    const { userId, productId, hesitationSignals, timeSpent } = data;
        
    logger.info(`🤔 ${this.name}: Usuario ${userId} muestra hesitación en ${productId}`);
        
    // Generar mensaje para superar objeciones
    const objectionHandling = await this.generateObjectionHandling(userId, productId, hesitationSignals);
        
    this.emit('sales.objection_handling_initiated', {
      userId,
      productId,
      hesitationSignals,
      message: objectionHandling,
      timestamp: new Date().toISOString()
    });
        
    // Ofrecer consulta personalizada si la hesitación persiste
    if (timeSpent > 120000) { // Más de 2 minutos hesitando
      this.emit('sales.personal_consultation_offered', {
        userId,
        productId,
        reason: 'extended_hesitation',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Genera mensaje de interés personalizado
     */
  async generateInterestMessage(userId, productId, interestLevel, context) {
    const customerProfile = this.customerProfiles.get(userId) || {};
        
    const templates = {
      low: [
        `¡Veo que ${productId} te llamó la atención! 👀 ¿Te gustaría saber más sobre sus características?`,
        `${productId} es una excelente opción. ¿Hay algo específico que te gustaría conocer?`
      ],
      medium: [
        `¡Excelente elección con ${productId}! 🌟 Muchos clientes han quedado muy satisfechos. ¿Te ayudo con más detalles?`,
        `${productId} está entre nuestros productos más populares. ¿Quieres que te cuente por qué?`
      ],
      high: [
        `¡${productId} es perfecto para ti! 🎯 Tengo una oferta especial que expira pronto. ¿Hablamos?`,
        `¡Increíble elección! ${productId} está volando de nuestro inventario. ¿Aseguramos el tuyo ahora?`
      ]
    };
        
    const levelTemplates = templates[interestLevel] || templates.medium;
    const template = levelTemplates[Math.floor(Math.random() * levelTemplates.length)];
        
    return this.personalizeMessage(template, userId, customerProfile, context);
  }

  /**
     * Genera mensaje para vistas repetidas
     */
  async generateRepeatedViewMessage(userId, productId, viewCount) {
    const messages = [
      `Veo que ${productId} realmente te interesa (${viewCount}ª vez que lo ves) 😊 ¿Hay algo que te detiene? ¡Estoy aquí para ayudarte!`,
      `${productId} sigue llamando tu atención 👀 ¿Qué tal si te ofrezco un 10% de descuento para decidirte hoy?`,
      `¡${viewCount} veces viendo ${productId}! Debe gustarte mucho 😍 ¿Te ayudo a completar la compra?`
    ];
        
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
     * Genera mensaje de recuperación de carrito
     */
  async generateCartRecoveryMessage(userId, cartItems, strategy, reason) {
    const itemNames = cartItems.map(item => item.name).join(', ');
        
    const strategies = {
      basic_reminder: `¡Hola! Notamos que dejaste ${itemNames} en tu carrito 🛒 ¿Te ayudamos a completar tu compra?`,
      discount_offer: `¡No pierdas ${itemNames}! 🎁 Te ofrecemos un 15% de descuento si completas tu compra en las próximas 2 horas.`,
      premium_recovery: `Tu carrito con ${itemNames} te está esperando ⭐ Como cliente VIP, tienes envío gratis y garantía extendida. ¡Aprovecha!`
    };
        
    return strategies[strategy] || strategies.basic_reminder;
  }

  /**
     * Genera alternativas de presupuesto
     */
  async generateBudgetAlternatives(userId, productId, currentPrice, userBudget) {
    const difference = currentPrice - userBudget;
    const discountPercentage = Math.min(20, (difference / currentPrice) * 100);
        
    return `Entiendo tu presupuesto de $${userBudget} para ${productId}. 💰 ` +
               `¿Qué tal si te ofrezco un ${discountPercentage.toFixed(0)}% de descuento? ` +
               'O puedo mostrarte alternativas similares dentro de tu rango de precio. ¿Qué prefieres?';
  }

  /**
     * Genera justificación de valor
     */
  async generateValueJustification(userId, productId, currentPrice) {
    return `${productId} por $${currentPrice} es una inversión excelente 💎 ` +
               'Incluye garantía de 2 años, soporte 24/7 y actualizaciones gratuitas. ' +
               'Nuestros clientes ahorran un promedio de $200 al año con este producto. ¿Te interesa conocer más beneficios?';
  }

  /**
     * Programa seguimiento
     */
  scheduleFollowUp(userId, productId, type, delay = null) {
    const followUpDelay = delay || this.salesConfig.followUpDelay;
    const followUpId = `${userId}_${productId}_${type}`;
        
    // Cancelar seguimiento anterior si existe
    if (this.followUpTimers.has(followUpId)) {
      clearTimeout(this.followUpTimers.get(followUpId));
    }
        
    const timer = setTimeout(async() => {
      await this.executeFollowUp(userId, productId, type);
      this.followUpTimers.delete(followUpId);
    }, followUpDelay);
        
    this.followUpTimers.set(followUpId, timer);
        
    logger.info(`⏰ ${this.name}: Seguimiento programado para ${userId} en ${followUpDelay}ms`);
  }

  /**
     * Ejecuta seguimiento
     */
  async executeFollowUp(userId, productId, type) {
    const customerProfile = this.customerProfiles.get(userId) || {};
    const followUpCount = customerProfile.followUpCount || 0;
        
    if (followUpCount >= this.salesConfig.maxFollowUps) {
      logger.info(`📝 ${this.name}: Máximo de seguimientos alcanzado para ${userId}`);
      return;
    }
        
    const followUpMessage = await this.generateFollowUpMessage(userId, productId, type, followUpCount);
        
    this.emit('sales.follow_up_sent', {
      userId,
      productId,
      type,
      followUpCount: followUpCount + 1,
      message: followUpMessage,
      timestamp: new Date().toISOString()
    });
        
    // Actualizar contador de seguimientos
    this.updateCustomerProfile(userId, {
      followUpCount: followUpCount + 1
    });
        
    this.salesStats.followUpsSent++;
  }

  /**
     * Ofrece descuento de recuperación
     */
  async offerRecoveryDiscount(userId, amount) {
    const discountPercentage = Math.min(25, 10 + (amount / 100)); // Hasta 25%
        
    this.emit('sales.recovery_discount_offered', {
      userId,
      originalAmount: amount,
      discountPercentage,
      message: `¡Oferta especial! 🎉 Te ofrecemos un ${discountPercentage.toFixed(0)}% de descuento para completar tu compra. ¡Solo por hoy!`,
      expiresIn: 24 * 60 * 60 * 1000, // 24 horas
      timestamp: new Date().toISOString()
    });
        
    this.salesStats.discountsOffered++;
  }

  /**
     * Actualiza perfil del cliente
     */
  updateCustomerProfile(userId, updates) {
    const currentProfile = this.customerProfiles.get(userId) || {
      firstInteraction: new Date().toISOString(),
      totalInteractions: 0
    };
        
    const updatedProfile = {
      ...currentProfile,
      ...updates,
      totalInteractions: currentProfile.totalInteractions + 1,
      lastUpdate: new Date().toISOString()
    };
        
    this.customerProfiles.set(userId, updatedProfile);
  }

  /**
     * Personaliza mensaje
     */
  personalizeMessage(template, userId, customerProfile, context) {
    // Aquí se podría implementar personalización más sofisticada
    // basada en el historial del cliente, preferencias, etc.
    return template;
  }

  /**
     * Limpia seguimientos activos
     */
  clearFollowUps(userId) {
    for (const [followUpId, timer] of this.followUpTimers) {
      if (followUpId.startsWith(userId)) {
        clearTimeout(timer);
        this.followUpTimers.delete(followUpId);
      }
    }
  }

  /**
     * Actualiza tiempo promedio de conversión
     */
  updateAverageConversionTime(conversionTime) {
    const currentAvg = this.salesStats.averageConversionTime;
    const conversions = this.salesStats.conversions;
        
    this.salesStats.averageConversionTime = 
            ((currentAvg * (conversions - 1)) + conversionTime) / conversions;
  }

  /**
     * Obtiene estadísticas de ventas
     */
  getSalesStats() {
    const conversionRate = this.salesStats.leadsGenerated > 0 ? 
      (this.salesStats.conversions / this.salesStats.leadsGenerated) * 100 : 0;
        
    return {
      ...this.salesStats,
      conversionRate: conversionRate.toFixed(2),
      activeCustomers: this.customerProfiles.size,
      activeFollowUps: this.followUpTimers.size,
      activeOffers: this.activeOffers.size
    };
  }

  /**
     * Limpieza al detener el agente
     */
  async onStop() {
    // Limpiar todos los timers
    for (const timer of this.followUpTimers.values()) {
      clearTimeout(timer);
    }
    this.followUpTimers.clear();
        
    logger.info(`💰 ${this.name}: Limpieza completada - ${this.customerProfiles.size} perfiles de clientes guardados`);
  }
}

export default SalesAgent;