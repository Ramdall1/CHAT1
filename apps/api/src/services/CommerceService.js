import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Servicio de Comercio Electrónico
 * Maneja productos, catálogo, inventario, carritos de compra y órdenes
 */
class CommerceService extends EventEmitter {
  constructor() {
    super();
    this.dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data');
    this.productsFile = path.join(this.dataPath, 'products.json');
    this.categoriesFile = path.join(this.dataPath, 'categories.json');
    this.inventoryFile = path.join(this.dataPath, 'inventory.json');
    this.cartsFile = path.join(this.dataPath, 'carts.json');
    this.ordersFile = path.join(this.dataPath, 'orders.json');
    this.wishlistsFile = path.join(this.dataPath, 'wishlists.json');
    this.reviewsFile = path.join(this.dataPath, 'reviews.json');

    this.config = {
      currency: process.env.DEFAULT_CURRENCY || 'USD',
      taxRate: parseFloat(process.env.TAX_RATE) || 0.21,
      shippingCost: parseFloat(process.env.SHIPPING_COST) || 10.0,
      freeShippingThreshold:
        parseFloat(process.env.FREE_SHIPPING_THRESHOLD) || 100.0,
      lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD) || 10,
      cartExpirationHours: parseInt(process.env.CART_EXPIRATION_HOURS) || 24,
      maxCartItems: parseInt(process.env.MAX_CART_ITEMS) || 50,
    };

    this.orderStatuses = {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      PROCESSING: 'processing',
      SHIPPED: 'shipped',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
      REFUNDED: 'refunded',
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
      this.emit('commerce.service.initialized');
    } catch (error) {
      this.emit('commerce.service.error', { error: error.message });
      throw error;
    }
  }

  /**
   * Inicializar archivos de datos si no existen
   */
  async initializeDataFiles() {
    const files = [
      { path: this.productsFile, data: [] },
      { path: this.categoriesFile, data: [] },
      { path: this.inventoryFile, data: {} },
      { path: this.cartsFile, data: [] },
      { path: this.ordersFile, data: [] },
      { path: this.wishlistsFile, data: [] },
      { path: this.reviewsFile, data: [] },
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
      }
    }
  }

  // ==================== GESTIÓN DE PRODUCTOS ====================

  /**
   * Crear nuevo producto
   */
  async createProduct(productData) {
    try {
      const products = await this.getProducts();

      const product = {
        id: productData.id || this.generateProductId(),
        sku: productData.sku || this.generateSKU(),
        name: productData.name,
        description: productData.description || '',
        shortDescription: productData.shortDescription || '',
        categoryId: productData.categoryId,
        price: parseFloat(productData.price),
        comparePrice: productData.comparePrice
          ? parseFloat(productData.comparePrice)
          : null,
        cost: productData.cost ? parseFloat(productData.cost) : null,
        currency: productData.currency || this.config.currency,
        images: productData.images || [],
        variants: productData.variants || [],
        attributes: productData.attributes || {},
        tags: productData.tags || [],
        status: productData.status || 'active', // active, inactive, draft
        featured: productData.featured || false,
        weight: productData.weight || 0,
        dimensions: productData.dimensions || {
          length: 0,
          width: 0,
          height: 0,
        },
        seoTitle: productData.seoTitle || productData.name,
        seoDescription:
          productData.seoDescription || productData.shortDescription,
        slug: this.generateSlug(productData.name),
        metadata: productData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      products.push(product);
      await this.saveProducts(products);

      // Inicializar inventario
      await this.initializeProductInventory(
        product.id,
        productData.initialStock || 0
      );

      this.emit('product.created', { product });
      return product;
    } catch (error) {
      this.emit('product.creation.error', {
        error: error.message,
        productData,
      });
      throw error;
    }
  }

  /**
   * Obtener producto por ID
   */
  async getProduct(productId) {
    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);

    if (product) {
      // Agregar información de inventario
      const inventory = await this.getInventory();
      product.stock = inventory[productId] || 0;
      product.inStock = product.stock > 0;
      product.lowStock = product.stock <= this.config.lowStockThreshold;
    }

    return product;
  }

  /**
   * Listar productos con filtros y paginación
   */
  async listProducts(filters = {}) {
    const products = await this.getProducts();
    const inventory = await this.getInventory();

    let filtered = products.map(product => ({
      ...product,
      stock: inventory[product.id] || 0,
      inStock: (inventory[product.id] || 0) > 0,
      lowStock: (inventory[product.id] || 0) <= this.config.lowStockThreshold,
    }));

    // Aplicar filtros
    if (filters.categoryId) {
      filtered = filtered.filter(p => p.categoryId === filters.categoryId);
    }

    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    if (filters.featured !== undefined) {
      filtered = filtered.filter(p => p.featured === filters.featured);
    }

    if (filters.inStock !== undefined) {
      filtered = filtered.filter(p => p.inStock === filters.inStock);
    }

    if (filters.priceMin) {
      filtered = filtered.filter(p => p.price >= parseFloat(filters.priceMin));
    }

    if (filters.priceMax) {
      filtered = filtered.filter(p => p.price <= parseFloat(filters.priceMax));
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm) ||
          p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Ordenamiento
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'price_asc':
            return a.price - b.price;
          case 'price_desc':
            return b.price - a.price;
          case 'created_desc':
            return new Date(b.createdAt) - new Date(a.createdAt);
          case 'created_asc':
            return new Date(a.createdAt) - new Date(b.createdAt);
          default:
            return 0;
        }
      });
    }

    return filtered;
  }

  /**
   * Actualizar producto
   */
  async updateProduct(productId, updates) {
    try {
      const products = await this.getProducts();
      const index = products.findIndex(p => p.id === productId);

      if (index === -1) {
        throw new Error('Producto no encontrado');
      }

      const product = {
        ...products[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Regenerar slug si cambió el nombre
      if (updates.name && updates.name !== products[index].name) {
        product.slug = this.generateSlug(updates.name);
      }

      products[index] = product;
      await this.saveProducts(products);

      this.emit('product.updated', { product, previousData: products[index] });
      return product;
    } catch (error) {
      this.emit('product.update.error', {
        error: error.message,
        productId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Eliminar producto
   */
  async deleteProduct(productId) {
    try {
      const products = await this.getProducts();
      const index = products.findIndex(p => p.id === productId);

      if (index === -1) {
        throw new Error('Producto no encontrado');
      }

      const product = products[index];
      products.splice(index, 1);
      await this.saveProducts(products);

      // Limpiar inventario
      await this.removeProductInventory(productId);

      this.emit('product.deleted', { product });
      return product;
    } catch (error) {
      this.emit('product.deletion.error', { error: error.message, productId });
      throw error;
    }
  }

  // ==================== GESTIÓN DE CATEGORÍAS ====================

  /**
   * Crear categoría
   */
  async createCategory(categoryData) {
    try {
      const categories = await this.getCategories();

      const category = {
        id: categoryData.id || this.generateCategoryId(),
        name: categoryData.name,
        description: categoryData.description || '',
        parentId: categoryData.parentId || null,
        slug: this.generateSlug(categoryData.name),
        image: categoryData.image || '',
        status: categoryData.status || 'active',
        sortOrder: categoryData.sortOrder || 0,
        metadata: categoryData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      categories.push(category);
      await this.saveCategories(categories);

      this.emit('category.created', { category });
      return category;
    } catch (error) {
      this.emit('category.creation.error', {
        error: error.message,
        categoryData,
      });
      throw error;
    }
  }

  /**
   * Listar categorías con jerarquía
   */
  async listCategories(includeHierarchy = false) {
    const categories = await this.getCategories();

    if (!includeHierarchy) {
      return categories;
    }

    // Construir jerarquía
    const categoryMap = new Map();
    categories.forEach(cat =>
      categoryMap.set(cat.id, { ...cat, children: [] })
    );

    const rootCategories = [];

    categories.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }

  // ==================== GESTIÓN DE INVENTARIO ====================

  /**
   * Actualizar stock de producto
   */
  async updateStock(productId, quantity, operation = 'set') {
    try {
      const inventory = await this.getInventory();
      const currentStock = inventory[productId] || 0;

      let newStock;
      switch (operation) {
        case 'add':
          newStock = currentStock + quantity;
          break;
        case 'subtract':
          newStock = Math.max(0, currentStock - quantity);
          break;
        case 'set':
        default:
          newStock = Math.max(0, quantity);
          break;
      }

      inventory[productId] = newStock;
      await this.saveInventory(inventory);

      // Emitir eventos de stock bajo
      if (
        newStock <= this.config.lowStockThreshold &&
        currentStock > this.config.lowStockThreshold
      ) {
        this.emit('inventory.low_stock', { productId, stock: newStock });
      }

      // Emitir evento de stock agotado
      if (newStock === 0 && currentStock > 0) {
        this.emit('inventory.out_of_stock', { productId });
      }

      this.emit('inventory.updated', {
        productId,
        previousStock: currentStock,
        newStock,
      });
      return { productId, stock: newStock };
    } catch (error) {
      this.emit('inventory.update.error', {
        error: error.message,
        productId,
        quantity,
        operation,
      });
      throw error;
    }
  }

  /**
   * Verificar disponibilidad de stock
   */
  async checkStockAvailability(productId, requestedQuantity) {
    const inventory = await this.getInventory();
    const currentStock = inventory[productId] || 0;

    return {
      productId,
      requestedQuantity,
      availableStock: currentStock,
      isAvailable: currentStock >= requestedQuantity,
      shortfall: Math.max(0, requestedQuantity - currentStock),
    };
  }

  // ==================== GESTIÓN DE CARRITOS ====================

  /**
   * Crear carrito
   */
  async createCart(userId, sessionId = null) {
    try {
      const carts = await this.getCarts();

      const cart = {
        id: this.generateCartId(),
        userId,
        sessionId,
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        currency: this.config.currency,
        status: 'active', // active, abandoned, converted
        expiresAt: this.calculateCartExpiration(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      carts.push(cart);
      await this.saveCarts(carts);

      this.emit('cart.created', { cart });
      return cart;
    } catch (error) {
      this.emit('cart.creation.error', {
        error: error.message,
        userId,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Obtener carrito por usuario o sesión
   */
  async getCart(userId, sessionId = null) {
    const carts = await this.getCarts();

    let cart = carts.find(
      c =>
        c.userId === userId &&
        c.status === 'active' &&
        new Date(c.expiresAt) > new Date()
    );

    if (!cart && sessionId) {
      cart = carts.find(
        c =>
          c.sessionId === sessionId &&
          c.status === 'active' &&
          new Date(c.expiresAt) > new Date()
      );
    }

    if (!cart) {
      cart = await this.createCart(userId, sessionId);
    }

    return cart;
  }

  /**
   * Agregar item al carrito
   */
  async addToCart(userId, productId, quantity = 1, sessionId = null) {
    try {
      // Verificar disponibilidad del producto
      const product = await this.getProduct(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      if (product.status !== 'active') {
        throw new Error('Producto no disponible');
      }

      // Verificar stock
      const stockCheck = await this.checkStockAvailability(productId, quantity);
      if (!stockCheck.isAvailable) {
        throw new Error(
          `Stock insuficiente. Disponible: ${stockCheck.availableStock}`
        );
      }

      const cart = await this.getCart(userId, sessionId);

      // Verificar límite de items en carrito
      if (cart.items.length >= this.config.maxCartItems) {
        throw new Error('Carrito lleno. Máximo de items alcanzado');
      }

      // Buscar si el producto ya está en el carrito
      const existingItemIndex = cart.items.findIndex(
        item => item.productId === productId
      );

      if (existingItemIndex >= 0) {
        // Actualizar cantidad
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;

        // Verificar stock para la nueva cantidad
        const newStockCheck = await this.checkStockAvailability(
          productId,
          newQuantity
        );
        if (!newStockCheck.isAvailable) {
          throw new Error(
            `Stock insuficiente para cantidad total: ${newQuantity}. Disponible: ${newStockCheck.availableStock}`
          );
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].subtotal = newQuantity * product.price;
      } else {
        // Agregar nuevo item
        const cartItem = {
          id: this.generateCartItemId(),
          productId,
          name: product.name,
          price: product.price,
          quantity,
          subtotal: quantity * product.price,
          image: product.images[0] || '',
          addedAt: new Date().toISOString(),
        };

        cart.items.push(cartItem);
      }

      // Recalcular totales
      await this.calculateCartTotals(cart);

      // Actualizar carrito
      await this.updateCartInStorage(cart);

      this.emit('cart.item_added', { cart, productId, quantity });
      return cart;
    } catch (error) {
      this.emit('cart.add_item.error', {
        error: error.message,
        userId,
        productId,
        quantity,
      });
      throw error;
    }
  }

  /**
   * Remover item del carrito
   */
  async removeFromCart(userId, productId, sessionId = null) {
    try {
      const cart = await this.getCart(userId, sessionId);

      const itemIndex = cart.items.findIndex(
        item => item.productId === productId
      );
      if (itemIndex === -1) {
        throw new Error('Item no encontrado en el carrito');
      }

      const removedItem = cart.items.splice(itemIndex, 1)[0];

      // Recalcular totales
      await this.calculateCartTotals(cart);

      // Actualizar carrito
      await this.updateCartInStorage(cart);

      this.emit('cart.item_removed', { cart, removedItem });
      return cart;
    } catch (error) {
      this.emit('cart.remove_item.error', {
        error: error.message,
        userId,
        productId,
      });
      throw error;
    }
  }

  /**
   * Actualizar cantidad de item en carrito
   */
  async updateCartItemQuantity(userId, productId, quantity, sessionId = null) {
    try {
      if (quantity <= 0) {
        return await this.removeFromCart(userId, productId, sessionId);
      }

      // Verificar stock
      const stockCheck = await this.checkStockAvailability(productId, quantity);
      if (!stockCheck.isAvailable) {
        throw new Error(
          `Stock insuficiente. Disponible: ${stockCheck.availableStock}`
        );
      }

      const cart = await this.getCart(userId, sessionId);

      const itemIndex = cart.items.findIndex(
        item => item.productId === productId
      );
      if (itemIndex === -1) {
        throw new Error('Item no encontrado en el carrito');
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].subtotal = quantity * cart.items[itemIndex].price;

      // Recalcular totales
      await this.calculateCartTotals(cart);

      // Actualizar carrito
      await this.updateCartInStorage(cart);

      this.emit('cart.item_updated', { cart, productId, quantity });
      return cart;
    } catch (error) {
      this.emit('cart.update_item.error', {
        error: error.message,
        userId,
        productId,
        quantity,
      });
      throw error;
    }
  }

  /**
   * Limpiar carrito
   */
  async clearCart(userId, sessionId = null) {
    try {
      const cart = await this.getCart(userId, sessionId);

      cart.items = [];
      cart.subtotal = 0;
      cart.tax = 0;
      cart.shipping = 0;
      cart.total = 0;
      cart.updatedAt = new Date().toISOString();

      await this.updateCartInStorage(cart);

      this.emit('cart.cleared', { cart });
      return cart;
    } catch (error) {
      this.emit('cart.clear.error', { error: error.message, userId });
      throw error;
    }
  }

  // ==================== GESTIÓN DE ÓRDENES ====================

  /**
   * Crear orden desde carrito
   */
  async createOrder(userId, orderData, sessionId = null) {
    try {
      const cart = await this.getCart(userId, sessionId);

      if (!cart.items || cart.items.length === 0) {
        throw new Error('Carrito vacío');
      }

      // Verificar stock de todos los items
      for (const item of cart.items) {
        const stockCheck = await this.checkStockAvailability(
          item.productId,
          item.quantity
        );
        if (!stockCheck.isAvailable) {
          throw new Error(
            `Stock insuficiente para ${item.name}. Disponible: ${stockCheck.availableStock}`
          );
        }
      }

      const order = {
        id: this.generateOrderId(),
        orderNumber: this.generateOrderNumber(),
        userId,
        status: this.orderStatuses.PENDING,
        items: [...cart.items],
        subtotal: cart.subtotal,
        tax: cart.tax,
        shipping: cart.shipping,
        total: cart.total,
        currency: cart.currency,
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress || orderData.shippingAddress,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes || '',
        metadata: orderData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const orders = await this.getOrders();
      orders.push(order);
      await this.saveOrders(orders);

      // Reducir stock
      for (const item of order.items) {
        await this.updateStock(item.productId, item.quantity, 'subtract');
      }

      // Marcar carrito como convertido
      cart.status = 'converted';
      cart.orderId = order.id;
      await this.updateCartInStorage(cart);

      this.emit('order.created', { order, cart });
      return order;
    } catch (error) {
      this.emit('order.creation.error', {
        error: error.message,
        userId,
        orderData,
      });
      throw error;
    }
  }

  /**
   * Actualizar estado de orden
   */
  async updateOrderStatus(orderId, status, notes = '') {
    try {
      const orders = await this.getOrders();
      const index = orders.findIndex(o => o.id === orderId);

      if (index === -1) {
        throw new Error('Orden no encontrada');
      }

      const previousStatus = orders[index].status;
      orders[index].status = status;
      orders[index].updatedAt = new Date().toISOString();

      if (notes) {
        if (!orders[index].statusHistory) {
          orders[index].statusHistory = [];
        }
        orders[index].statusHistory.push({
          status,
          notes,
          timestamp: new Date().toISOString(),
        });
      }

      // Restaurar stock si la orden se cancela
      if (status === 'cancelled' && previousStatus !== 'cancelled') {
        for (const item of orders[index].items) {
          await this.updateStock(item.productId, item.quantity, 'add');
        }
      }

      await this.saveOrders(orders);

      this.emit('order.status_updated', {
        order: orders[index],
        previousStatus,
        newStatus: status,
      });

      return orders[index];
    } catch (error) {
      this.emit('order.status_update.error', {
        error: error.message,
        orderId,
        status,
      });
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Calcular totales del carrito
   */
  async calculateCartTotals(cart) {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    cart.tax = cart.subtotal * this.config.taxRate;
    cart.shipping =
      cart.subtotal >= this.config.freeShippingThreshold
        ? 0
        : this.config.shippingCost;
    cart.total = cart.subtotal + cart.tax + cart.shipping;
    cart.updatedAt = new Date().toISOString();
  }

  /**
   * Actualizar carrito en almacenamiento
   */
  async updateCartInStorage(cart) {
    const carts = await this.getCarts();
    const index = carts.findIndex(c => c.id === cart.id);

    if (index >= 0) {
      carts[index] = cart;
      await this.saveCarts(carts);
    }
  }

  /**
   * Generar IDs únicos
   */
  generateProductId() {
    return `prod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateCategoryId() {
    return `cat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateCartId() {
    return `cart_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateCartItemId() {
    return `item_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateOrderId() {
    return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateSKU() {
    return `SKU-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  generateOrderNumber() {
    return `ORD-${Date.now()}`;
  }

  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Calcular expiración del carrito
   */
  calculateCartExpiration() {
    const expiration = new Date();
    expiration.setHours(
      expiration.getHours() + this.config.cartExpirationHours
    );
    return expiration.toISOString();
  }

  /**
   * Inicializar inventario de producto
   */
  async initializeProductInventory(productId, initialStock) {
    const inventory = await this.getInventory();
    inventory[productId] = initialStock;
    await this.saveInventory(inventory);
  }

  /**
   * Remover inventario de producto
   */
  async removeProductInventory(productId) {
    const inventory = await this.getInventory();
    delete inventory[productId];
    await this.saveInventory(inventory);
  }

  // ==================== MÉTODOS DE DATOS ====================

  async getProducts() {
    try {
      const data = await fs.readFile(this.productsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveProducts(products) {
    await fs.writeFile(this.productsFile, JSON.stringify(products, null, 2));
  }

  async getCategories() {
    try {
      const data = await fs.readFile(this.categoriesFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveCategories(categories) {
    await fs.writeFile(
      this.categoriesFile,
      JSON.stringify(categories, null, 2)
    );
  }

  async getInventory() {
    try {
      const data = await fs.readFile(this.inventoryFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveInventory(inventory) {
    await fs.writeFile(this.inventoryFile, JSON.stringify(inventory, null, 2));
  }

  async getCarts() {
    try {
      const data = await fs.readFile(this.cartsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveCarts(carts) {
    await fs.writeFile(this.cartsFile, JSON.stringify(carts, null, 2));
  }

  async getOrders() {
    try {
      const data = await fs.readFile(this.ordersFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveOrders(orders) {
    await fs.writeFile(this.ordersFile, JSON.stringify(orders, null, 2));
  }

  /**
   * Obtener estadísticas del servicio
   */
  async getServiceStats() {
    const products = await this.getProducts();
    const orders = await this.getOrders();
    const carts = await this.getCarts();
    const inventory = await this.getInventory();

    const lowStockProducts = Object.entries(inventory).filter(
      ([_, stock]) => stock <= this.config.lowStockThreshold
    ).length;

    const outOfStockProducts = Object.entries(inventory).filter(
      ([_, stock]) => stock === 0
    ).length;

    return {
      products: {
        total: products.length,
        active: products.filter(p => p.status === 'active').length,
        featured: products.filter(p => p.featured).length,
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts,
      },
      orders: {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      },
      carts: {
        total: carts.length,
        active: carts.filter(c => c.status === 'active').length,
        abandoned: carts.filter(c => c.status === 'abandoned').length,
        converted: carts.filter(c => c.status === 'converted').length,
      },
    };
  }

  /**
   * Buscar productos
   */
  async searchProducts(query, filters = {}) {
    const products = await this.listProducts({
      ...filters,
      search: query,
    });

    return {
      query,
      results: products,
      total: products.length,
    };
  }

  /**
   * Obtener productos relacionados
   */
  async getRelatedProducts(productId, limit = 5) {
    const product = await this.getProduct(productId);
    if (!product) {
      return [];
    }

    const products = await this.listProducts({
      categoryId: product.categoryId,
      status: 'active',
    });

    return products.filter(p => p.id !== productId).slice(0, limit);
  }

  /**
   * Obtener productos más vendidos
   */
  async getBestSellingProducts(limit = 10) {
    const orders = await this.getOrders();
    const productSales = {};

    // Contar ventas por producto
    orders.forEach(order => {
      if (order.status === 'delivered') {
        order.items.forEach(item => {
          productSales[item.productId] =
            (productSales[item.productId] || 0) + item.quantity;
        });
      }
    });

    // Obtener productos y ordenar por ventas
    const products = await this.getProducts();
    const productsWithSales = products
      .filter(p => p.status === 'active')
      .map(p => ({
        ...p,
        totalSales: productSales[p.id] || 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, limit);

    return productsWithSales;
  }
}

export default CommerceService;
