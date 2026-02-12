import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Servicio de Facturación y Gestión de Pagos
 * Maneja facturación, pagos, suscripciones, análisis de costos y reportes financieros
 */
class BillingService extends EventEmitter {
  constructor() {
    super();
    this.dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data');
    this.invoicesFile = path.join(this.dataPath, 'invoices.json');
    this.paymentsFile = path.join(this.dataPath, 'payments.json');
    this.subscriptionsFile = path.join(this.dataPath, 'subscriptions.json');
    this.usageFile = path.join(this.dataPath, 'usage-tracking.json');

    this.config = {
      currency: process.env.DEFAULT_CURRENCY || 'USD',
      taxRate: parseFloat(process.env.TAX_RATE) || 0.21, // 21% IVA por defecto
      paymentProvider: process.env.PAYMENT_PROVIDER || 'stripe',
      invoicePrefix: process.env.INVOICE_PREFIX || 'INV',
      autoGenerateInvoices: process.env.INVOICE_AUTO_GENERATION === 'true',
      gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS) || 7,
      retryAttempts: parseInt(process.env.PAYMENT_RETRY_ATTEMPTS) || 3,
    };

    this.pricingPlans = {
      starter: {
        id: 'starter',
        name: 'Starter Plan',
        monthlyPrice: 29.99,
        features: {
          messagesPerMonth: 1000,
          templatesLimit: 10,
          wabaAccounts: 1,
          supportLevel: 'basic',
        },
      },
      professional: {
        id: 'professional',
        name: 'Professional Plan',
        monthlyPrice: 99.99,
        features: {
          messagesPerMonth: 10000,
          templatesLimit: 50,
          wabaAccounts: 5,
          supportLevel: 'priority',
        },
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise Plan',
        monthlyPrice: 299.99,
        features: {
          messagesPerMonth: 100000,
          templatesLimit: 200,
          wabaAccounts: 25,
          supportLevel: 'dedicated',
        },
      },
    };

    this.usagePricing = {
      messages: {
        whatsapp: 0.005, // $0.005 por mensaje
        sms: 0.01, // $0.01 por SMS
        email: 0.001, // $0.001 por email
      },
      ai: {
        gpt4: 0.03, // $0.03 por 1K tokens
        gpt35: 0.002, // $0.002 por 1K tokens
        claude: 0.025, // $0.025 por 1K tokens
      },
      storage: 0.023, // $0.023 por GB/mes
      bandwidth: 0.09, // $0.09 por GB
    };

    this.initialize();
  }

  /**
   * Inicializar archivos de datos
   */
  async initialize() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.initializeDataFiles();
      this.emit('billing.service.initialized');
    } catch (error) {
      this.emit('billing.service.error', { error: error.message });
      throw error;
    }
  }

  /**
   * Inicializar archivos de datos si no existen
   */
  async initializeDataFiles() {
    const files = [
      { path: this.invoicesFile, data: [] },
      { path: this.paymentsFile, data: [] },
      { path: this.subscriptionsFile, data: [] },
      { path: this.usageFile, data: {} },
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
      }
    }
  }

  // ==================== GESTIÓN DE FACTURAS ====================

  /**
   * Crear nueva factura
   */
  async createInvoice(invoiceData) {
    try {
      const invoices = await this.getInvoices();

      const invoice = {
        id: this.generateInvoiceId(),
        clientId: invoiceData.clientId,
        number: `${this.config.invoicePrefix}-${Date.now()}`,
        date: new Date().toISOString(),
        dueDate: this.calculateDueDate(invoiceData.paymentTerms || 30),
        status: 'pending', // pending, paid, overdue, cancelled
        currency: invoiceData.currency || this.config.currency,
        items: invoiceData.items || [],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        paymentTerms: invoiceData.paymentTerms || 30,
        notes: invoiceData.notes || '',
        metadata: invoiceData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Calcular totales
      this.calculateInvoiceTotals(invoice);

      invoices.push(invoice);
      await this.saveInvoices(invoices);

      this.emit('invoice.created', { invoice });

      // Auto-enviar factura si está configurado
      if (this.config.autoGenerateInvoices) {
        await this.sendInvoice(invoice.id);
      }

      return invoice;
    } catch (error) {
      this.emit('invoice.creation.error', {
        error: error.message,
        invoiceData,
      });
      throw error;
    }
  }

  /**
   * Obtener factura por ID
   */
  async getInvoice(invoiceId) {
    const invoices = await this.getInvoices();
    return invoices.find(invoice => invoice.id === invoiceId);
  }

  /**
   * Listar facturas con filtros
   */
  async listInvoices(filters = {}) {
    const invoices = await this.getInvoices();
    let filtered = invoices;

    if (filters.clientId) {
      filtered = filtered.filter(
        invoice => invoice.clientId === filters.clientId
      );
    }

    if (filters.status) {
      filtered = filtered.filter(invoice => invoice.status === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(
        invoice => new Date(invoice.date) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(
        invoice => new Date(invoice.date) <= new Date(filters.dateTo)
      );
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Actualizar factura
   */
  async updateInvoice(invoiceId, updates) {
    try {
      const invoices = await this.getInvoices();
      const index = invoices.findIndex(invoice => invoice.id === invoiceId);

      if (index === -1) {
        throw new Error('Factura no encontrada');
      }

      const invoice = {
        ...invoices[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Recalcular totales si se actualizaron items
      if (updates.items) {
        this.calculateInvoiceTotals(invoice);
      }

      invoices[index] = invoice;
      await this.saveInvoices(invoices);

      this.emit('invoice.updated', { invoice });
      return invoice;
    } catch (error) {
      this.emit('invoice.update.error', {
        error: error.message,
        invoiceId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Marcar factura como pagada
   */
  async markInvoiceAsPaid(invoiceId, paymentData) {
    try {
      const invoice = await this.updateInvoice(invoiceId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId,
      });

      this.emit('invoice.paid', { invoice, paymentData });
      return invoice;
    } catch (error) {
      this.emit('invoice.payment.error', {
        error: error.message,
        invoiceId,
        paymentData,
      });
      throw error;
    }
  }

  // ==================== GESTIÓN DE PAGOS ====================

  /**
   * Procesar pago
   */
  async processPayment(paymentData) {
    try {
      // Validar datos de entrada
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error('Monto de pago inválido');
      }

      // Validar método de pago
      const validPaymentMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'subscription'];
      if (!validPaymentMethods.includes(paymentData.paymentMethod)) {
        throw new Error('Método de pago inválido');
      }

      // Validar factura si se proporciona
      if (paymentData.invoiceId) {
        const invoices = await this.getInvoices();
        const invoice = invoices.find(inv => inv.id === paymentData.invoiceId);
        if (!invoice) {
          throw new Error('Factura no encontrada');
        }
        if (invoice.status === 'paid') {
          throw new Error('La factura ya está pagada');
        }
      }

      const payment = {
        id: this.generatePaymentId(),
        clientId: paymentData.clientId,
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        currency: paymentData.currency || this.config.currency,
        paymentMethod: paymentData.paymentMethod,
        status: 'processing', // processing, completed, failed, refunded
        provider: this.config.paymentProvider,
        providerTransactionId: paymentData.providerTransactionId,
        metadata: paymentData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const payments = await this.getPayments();
      payments.push(payment);
      await this.savePayments(payments);

      this.emit('payment.initiated', { payment });

      // Simular procesamiento del pago (en producción sería con Stripe, PayPal, etc.)
      const result = await this.processWithProvider(payment);

      if (result.success) {
        await this.completePayment(payment.id, result);
      } else {
        await this.failPayment(payment.id, result.error);
      }

      return payment;
    } catch (error) {
      this.emit('payment.processing.error', {
        error: error.message,
        paymentData,
      });
      throw error;
    }
  }

  /**
   * Completar pago exitoso
   */
  async completePayment(paymentId, result) {
    try {
      const payments = await this.getPayments();
      const index = payments.findIndex(payment => payment.id === paymentId);

      if (index === -1) {
        throw new Error('Pago no encontrado');
      }

      const payment = {
        ...payments[index],
        status: 'completed',
        completedAt: new Date().toISOString(),
        providerTransactionId: result.transactionId,
        updatedAt: new Date().toISOString(),
      };

      payments[index] = payment;
      await this.savePayments(payments);

      // Marcar factura como pagada si existe
      if (payment.invoiceId) {
        await this.markInvoiceAsPaid(payment.invoiceId, {
          paymentMethod: payment.paymentMethod,
          transactionId: payment.providerTransactionId,
        });
      }

      this.emit('payment.completed', { payment });
      return payment;
    } catch (error) {
      this.emit('payment.completion.error', {
        error: error.message,
        paymentId,
      });
      throw error;
    }
  }

  /**
   * Marcar pago como fallido
   */
  async failPayment(paymentId, errorMessage) {
    try {
      const payments = await this.getPayments();
      const index = payments.findIndex(payment => payment.id === paymentId);

      if (index === -1) {
        throw new Error('Pago no encontrado');
      }

      const payment = {
        ...payments[index],
        status: 'failed',
        failedAt: new Date().toISOString(),
        errorMessage,
        updatedAt: new Date().toISOString(),
      };

      payments[index] = payment;
      await this.savePayments(payments);

      this.emit('payment.failed', { payment, error: errorMessage });
      return payment;
    } catch (error) {
      this.emit('payment.failure.error', { error: error.message, paymentId });
      throw error;
    }
  }

  // ==================== GESTIÓN DE SUSCRIPCIONES ====================

  /**
   * Crear suscripción
   */
  async createSubscription(subscriptionData) {
    try {
      const subscriptions = await this.getSubscriptions();

      const subscription = {
        id: this.generateSubscriptionId(),
        clientId: subscriptionData.clientId,
        planId: subscriptionData.planId,
        status: 'active', // active, cancelled, suspended, expired
        startDate: new Date().toISOString(),
        endDate: this.calculateSubscriptionEndDate(
          subscriptionData.billingCycle || 'monthly'
        ),
        billingCycle: subscriptionData.billingCycle || 'monthly', // monthly, yearly
        amount: this.pricingPlans[subscriptionData.planId]?.monthlyPrice || 0,
        currency: subscriptionData.currency || this.config.currency,
        paymentMethod: subscriptionData.paymentMethod,
        nextBillingDate: this.calculateNextBillingDate(
          subscriptionData.billingCycle || 'monthly'
        ),
        trialEndDate: subscriptionData.trialDays
          ? this.calculateTrialEndDate(subscriptionData.trialDays)
          : null,
        metadata: subscriptionData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      subscriptions.push(subscription);
      await this.saveSubscriptions(subscriptions);

      this.emit('subscription.created', { subscription });
      return subscription;
    } catch (error) {
      this.emit('subscription.creation.error', {
        error: error.message,
        subscriptionData,
      });
      throw error;
    }
  }

  /**
   * Actualizar suscripción
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      const subscriptions = await this.getSubscriptions();
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);

      if (index === -1) {
        throw new Error('Suscripción no encontrada');
      }

      const subscription = {
        ...subscriptions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      subscriptions[index] = subscription;
      await this.saveSubscriptions(subscriptions);

      this.emit('subscription.updated', { subscription });
      return subscription;
    } catch (error) {
      this.emit('subscription.update.error', {
        error: error.message,
        subscriptionId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(subscriptionId, reason = '') {
    try {
      const subscription = await this.updateSubscription(subscriptionId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
      });

      this.emit('subscription.cancelled', { subscription, reason });
      return subscription;
    } catch (error) {
      this.emit('subscription.cancellation.error', {
        error: error.message,
        subscriptionId,
      });
      throw error;
    }
  }

  // ==================== SEGUIMIENTO DE USO ====================

  /**
   * Registrar uso de servicio
   */
  async trackUsage(clientId, service, amount, metadata = {}) {
    try {
      const usage = await this.getUsageData();
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      if (!usage[clientId]) {
        usage[clientId] = {};
      }

      if (!usage[clientId][currentMonth]) {
        usage[clientId][currentMonth] = {};
      }

      if (!usage[clientId][currentMonth][service]) {
        usage[clientId][currentMonth][service] = {
          count: 0,
          cost: 0,
          details: [],
        };
      }

      const cost = this.calculateUsageCost(service, amount);

      usage[clientId][currentMonth][service].count += amount;
      usage[clientId][currentMonth][service].cost += cost;
      usage[clientId][currentMonth][service].details.push({
        timestamp: new Date().toISOString(),
        amount,
        cost,
        metadata,
      });

      await this.saveUsageData(usage);

      this.emit('usage.tracked', { clientId, service, amount, cost });
      return { amount, cost };
    } catch (error) {
      this.emit('usage.tracking.error', {
        error: error.message,
        clientId,
        service,
        amount,
      });
      throw error;
    }
  }

  /**
   * Obtener uso por cliente y período
   */
  async getClientUsage(clientId, startDate, endDate) {
    const usage = await this.getUsageData();
    const clientUsage = usage[clientId] || {};

    const start = new Date(startDate);
    const end = new Date(endDate);
    const result = {};

    for (const [month, services] of Object.entries(clientUsage)) {
      const monthDate = new Date(month + '-01');
      if (monthDate >= start && monthDate <= end) {
        result[month] = services;
      }
    }

    return result;
  }

  // ==================== ANÁLISIS Y REPORTES ====================

  /**
   * Generar reporte financiero
   */
  async generateFinancialReport(startDate, endDate, clientId = null) {
    try {
      const invoices = await this.listInvoices({
        dateFrom: startDate,
        dateTo: endDate,
        clientId,
      });

      const payments = await this.getPayments();
      const filteredPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.createdAt);
        return (
          paymentDate >= new Date(startDate) &&
          paymentDate <= new Date(endDate) &&
          (!clientId || payment.clientId === clientId)
        );
      });

      const report = {
        period: { startDate, endDate },
        clientId,
        summary: {
          totalInvoices: invoices.length,
          totalRevenue: invoices.reduce((sum, inv) => sum + inv.total, 0),
          paidInvoices: invoices.filter(inv => inv.status === 'paid').length,
          pendingInvoices: invoices.filter(inv => inv.status === 'pending')
            .length,
          overdueInvoices: invoices.filter(inv => inv.status === 'overdue')
            .length,
          totalPayments: filteredPayments.length,
          successfulPayments: filteredPayments.filter(
            p => p.status === 'completed'
          ).length,
          failedPayments: filteredPayments.filter(p => p.status === 'failed')
            .length,
        },
        invoices,
        payments: filteredPayments,
        generatedAt: new Date().toISOString(),
      };

      this.emit('report.generated', { report });
      return report;
    } catch (error) {
      this.emit('report.generation.error', {
        error: error.message,
        startDate,
        endDate,
        clientId,
      });
      throw error;
    }
  }

  /**
   * Obtener análisis de costos
   */
  async getCostAnalytics(clientId, period = 'month') {
    try {
      const usage = await this.getUsageData();
      const clientUsage = usage[clientId] || {};

      const analytics = {
        clientId,
        period,
        totalCost: 0,
        breakdown: {},
        trends: [],
        generatedAt: new Date().toISOString(),
      };

      for (const [month, services] of Object.entries(clientUsage)) {
        let monthTotal = 0;
        const monthBreakdown = {};

        for (const [service, data] of Object.entries(services)) {
          monthBreakdown[service] = data.cost;
          monthTotal += data.cost;
        }

        analytics.breakdown[month] = monthBreakdown;
        analytics.totalCost += monthTotal;
        analytics.trends.push({
          month,
          total: monthTotal,
          breakdown: monthBreakdown,
        });
      }

      return analytics;
    } catch (error) {
      this.emit('analytics.error', { error: error.message, clientId, period });
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Calcular totales de factura
   */
  calculateInvoiceTotals(invoice) {
    invoice.subtotal = invoice.items.reduce((sum, item) => {
      return sum + item.quantity * (item.unitPrice || item.price);
    }, 0);

    invoice.taxAmount = invoice.subtotal * this.config.taxRate;
    invoice.total = invoice.subtotal + invoice.taxAmount;
  }

  /**
   * Calcular costo de uso
   */
  calculateUsageCost(service, amount) {
    const [category, type] = service.split('.');
    const pricing = this.usagePricing[category];

    if (!pricing || !pricing[type]) {
      return 0;
    }

    return amount * pricing[type];
  }

  /**
   * Procesar con proveedor de pagos (simulado)
   */
  async processWithProvider(payment) {
    // Simular procesamiento (en producción sería Stripe, PayPal, etc.)
    return new Promise(resolve => {
      setTimeout(() => {
        const success = Math.random() > 0.1; // 90% éxito
        resolve({
          success,
          transactionId: success ? `txn_${Date.now()}` : null,
          error: success ? null : 'Payment declined by bank',
        });
      }, 1000);
    });
  }

  /**
   * Generar IDs únicos
   */
  generateInvoiceId() {
    return `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generatePaymentId() {
    return `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateSubscriptionId() {
    return `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Calcular fechas
   */
  calculateDueDate(paymentTerms) {
    const date = new Date();
    date.setDate(date.getDate() + paymentTerms);
    return date.toISOString();
  }

  calculateSubscriptionEndDate(billingCycle) {
    const date = new Date();
    if (billingCycle === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString();
  }

  calculateNextBillingDate(billingCycle) {
    return this.calculateSubscriptionEndDate(billingCycle);
  }

  calculateTrialEndDate(trialDays) {
    const date = new Date();
    date.setDate(date.getDate() + trialDays);
    return date.toISOString();
  }

  /**
   * Enviar factura (placeholder)
   */
  async sendInvoice(invoiceId) {
    // Implementar envío de factura por email
    this.emit('invoice.sent', { invoiceId });
  }

  // ==================== MÉTODOS DE DATOS ====================

  async getInvoices() {
    try {
      const data = await fs.readFile(this.invoicesFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveInvoices(invoices) {
    await fs.writeFile(this.invoicesFile, JSON.stringify(invoices, null, 2));
  }

  async getPayments() {
    try {
      const data = await fs.readFile(this.paymentsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async savePayments(payments) {
    await fs.writeFile(this.paymentsFile, JSON.stringify(payments, null, 2));
  }

  async getSubscriptions() {
    try {
      const data = await fs.readFile(this.subscriptionsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveSubscriptions(subscriptions) {
    await fs.writeFile(
      this.subscriptionsFile,
      JSON.stringify(subscriptions, null, 2)
    );
  }

  async getUsageData() {
    try {
      const data = await fs.readFile(this.usageFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveUsageData(usage) {
    await fs.writeFile(this.usageFile, JSON.stringify(usage, null, 2));
  }

  /**
   * Obtener estadísticas del servicio
   */
  async getServiceStats() {
    const invoices = await this.getInvoices();
    const payments = await this.getPayments();
    const subscriptions = await this.getSubscriptions();

    return {
      invoices: {
        total: invoices.length,
        pending: invoices.filter(inv => inv.status === 'pending').length,
        paid: invoices.filter(inv => inv.status === 'paid').length,
        overdue: invoices.filter(inv => inv.status === 'overdue').length,
      },
      payments: {
        total: payments.length,
        completed: payments.filter(pay => pay.status === 'completed').length,
        failed: payments.filter(pay => pay.status === 'failed').length,
        processing: payments.filter(pay => pay.status === 'processing').length,
      },
      subscriptions: {
        total: subscriptions.length,
        active: subscriptions.filter(sub => sub.status === 'active').length,
        cancelled: subscriptions.filter(sub => sub.status === 'cancelled')
          .length,
        suspended: subscriptions.filter(sub => sub.status === 'suspended')
          .length,
      },
    };
  }
}

export default BillingService;
