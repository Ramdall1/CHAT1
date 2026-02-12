import fs from 'fs-extra';
import path from 'path';

class AdvancedTagManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.tagsFile = path.join(dataDir, 'advanced_tags.json');
    this.tagCategoriesFile = path.join(dataDir, 'tag_categories.json');
    this.contactTagsFile = path.join(dataDir, 'contact_tags.json');

    this.tags = new Map();
    this.categories = new Map();
    this.contactTags = new Map(); // phone -> Set of tag IDs

    this.init();
  }

  async init() {
    await fs.ensureDir(this.dataDir);
    await this.loadTags();
    await this.loadCategories();
    await this.loadContactTags();
    await this.createDefaultCategories();
  }

  // ===== GESTIÓN DE CATEGORÍAS =====
  async loadCategories() {
    try {
      if (await fs.pathExists(this.tagCategoriesFile)) {
        const data = await fs.readJson(this.tagCategoriesFile);
        this.categories = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando categorías:', error.message);
    }
  }

  async saveCategories() {
    try {
      const data = Object.fromEntries(this.categories);
      await fs.writeJson(this.tagCategoriesFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando categorías:', error.message);
    }
  }

  async createDefaultCategories() {
    const defaultCategories = [
      {
        id: 'customer-status',
        name: 'Estado del Cliente',
        color: '#4CAF50',
        icon: '👤',
        description: 'Clasificación del estado del cliente',
      },
      {
        id: 'interest-level',
        name: 'Nivel de Interés',
        color: '#FF9800',
        icon: '🔥',
        description: 'Nivel de interés en productos/servicios',
      },
      {
        id: 'product-interest',
        name: 'Interés en Productos',
        color: '#2196F3',
        icon: '🛍️',
        description: 'Productos o servicios de interés',
      },
      {
        id: 'communication',
        name: 'Comunicación',
        color: '#9C27B0',
        icon: '💬',
        description: 'Preferencias y estado de comunicación',
      },
      {
        id: 'behavior',
        name: 'Comportamiento',
        color: '#607D8B',
        icon: '📊',
        description: 'Patrones de comportamiento del usuario',
      },
      {
        id: 'custom',
        name: 'Personalizado',
        color: '#795548',
        icon: '🏷️',
        description: 'Etiquetas personalizadas',
      },
    ];

    for (const category of defaultCategories) {
      if (!this.categories.has(category.id)) {
        this.categories.set(category.id, {
          ...category,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await this.saveCategories();
    await this.createDefaultTags();
  }

  createCategory(name, color = '#666666', icon = '🏷️', description = '') {
    const id = `category-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const category = {
      id,
      name,
      color,
      icon,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.categories.set(id, category);
    this.saveCategories();
    return category;
  }

  // ===== GESTIÓN DE ETIQUETAS =====
  async loadTags() {
    try {
      if (await fs.pathExists(this.tagsFile)) {
        const data = await fs.readJson(this.tagsFile);
        this.tags = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log('⚠️ Error cargando etiquetas:', error.message);
    }
  }

  async saveTags() {
    try {
      const data = Object.fromEntries(this.tags);
      await fs.writeJson(this.tagsFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando etiquetas:', error.message);
    }
  }

  async createDefaultTags() {
    const defaultTags = [
      // Estado del Cliente
      {
        name: 'Cliente Nuevo',
        categoryId: 'customer-status',
        color: '#4CAF50',
        icon: '🆕',
      },
      {
        name: 'Cliente Activo',
        categoryId: 'customer-status',
        color: '#2196F3',
        icon: '✅',
      },
      {
        name: 'Cliente VIP',
        categoryId: 'customer-status',
        color: '#FFD700',
        icon: '⭐',
      },
      {
        name: 'Cliente Inactivo',
        categoryId: 'customer-status',
        color: '#9E9E9E',
        icon: '😴',
      },

      // Nivel de Interés
      {
        name: 'Muy Interesado',
        categoryId: 'interest-level',
        color: '#F44336',
        icon: '🔥',
      },
      {
        name: 'Interesado',
        categoryId: 'interest-level',
        color: '#FF9800',
        icon: '👀',
      },
      {
        name: 'Poco Interés',
        categoryId: 'interest-level',
        color: '#FFC107',
        icon: '🤔',
      },
      {
        name: 'Sin Interés',
        categoryId: 'interest-level',
        color: '#9E9E9E',
        icon: '❌',
      },

      // Productos/Servicios
      {
        name: 'Coaching Personal',
        categoryId: 'product-interest',
        color: '#E91E63',
        icon: '🎯',
      },
      {
        name: 'Talleres Online',
        categoryId: 'product-interest',
        color: '#9C27B0',
        icon: '💻',
      },
      {
        name: 'Consultoría',
        categoryId: 'product-interest',
        color: '#673AB7',
        icon: '🤝',
      },
      {
        name: 'Cursos',
        categoryId: 'product-interest',
        color: '#3F51B5',
        icon: '📚',
      },

      // Comunicación
      {
        name: 'Prefiere WhatsApp',
        categoryId: 'communication',
        color: '#25D366',
        icon: '📱',
      },
      {
        name: 'Prefiere Email',
        categoryId: 'communication',
        color: '#1976D2',
        icon: '📧',
      },
      {
        name: 'No Molestar',
        categoryId: 'communication',
        color: '#F44336',
        icon: '🚫',
      },
      {
        name: 'Horario Específico',
        categoryId: 'communication',
        color: '#FF9800',
        icon: '⏰',
      },

      // Comportamiento
      {
        name: 'Responde Rápido',
        categoryId: 'behavior',
        color: '#4CAF50',
        icon: '⚡',
      },
      {
        name: 'Responde Lento',
        categoryId: 'behavior',
        color: '#FF9800',
        icon: '🐌',
      },
      {
        name: 'Hace Preguntas',
        categoryId: 'behavior',
        color: '#2196F3',
        icon: '❓',
      },
      {
        name: 'Comprador Impulso',
        categoryId: 'behavior',
        color: '#E91E63',
        icon: '💳',
      },
    ];

    for (const tagData of defaultTags) {
      const existingTag = Array.from(this.tags.values()).find(
        tag => tag.name === tagData.name
      );
      if (!existingTag) {
        this.createTag(
          tagData.name,
          tagData.categoryId,
          tagData.color,
          tagData.icon
        );
      }
    }
  }

  createTag(
    name,
    categoryId = 'custom',
    color = null,
    icon = '🏷️',
    description = ''
  ) {
    const id = `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Si no se especifica color, usar el de la categoría
    if (!color && this.categories.has(categoryId)) {
      color = this.categories.get(categoryId).color;
    }

    const tag = {
      id,
      name,
      categoryId,
      color: color || '#666666',
      icon,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    this.tags.set(id, tag);
    this.saveTags();
    return tag;
  }

  updateTag(tagId, updates) {
    const tag = this.tags.get(tagId);
    if (!tag) return null;

    const updatedTag = {
      ...tag,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.tags.set(tagId, updatedTag);
    this.saveTags();
    return updatedTag;
  }

  deleteTag(tagId) {
    const deleted = this.tags.delete(tagId);
    if (deleted) {
      // Remover la etiqueta de todos los contactos
      for (const [phone, tagSet] of this.contactTags) {
        if (tagSet.has(tagId)) {
          tagSet.delete(tagId);
        }
      }
      this.saveTags();
      this.saveContactTags();
    }
    return deleted;
  }

  // ===== GESTIÓN DE ETIQUETAS DE CONTACTOS =====
  async loadContactTags() {
    try {
      if (await fs.pathExists(this.contactTagsFile)) {
        const data = await fs.readJson(this.contactTagsFile);
        this.contactTags = new Map();
        for (const [phone, tagIds] of Object.entries(data)) {
          this.contactTags.set(phone, new Set(tagIds));
        }
      }
    } catch (error) {
      console.log('⚠️ Error cargando etiquetas de contactos:', error.message);
    }
  }

  async saveContactTags() {
    try {
      const data = {};
      for (const [phone, tagSet] of this.contactTags) {
        data[phone] = Array.from(tagSet);
      }
      await fs.writeJson(this.contactTagsFile, data, { spaces: 2 });
    } catch (error) {
      console.log('❌ Error guardando etiquetas de contactos:', error.message);
    }
  }

  addTagToContact(phone, tagId) {
    if (!this.tags.has(tagId)) return false;

    if (!this.contactTags.has(phone)) {
      this.contactTags.set(phone, new Set());
    }

    const added = !this.contactTags.get(phone).has(tagId);
    this.contactTags.get(phone).add(tagId);

    if (added) {
      // Incrementar contador de uso
      const tag = this.tags.get(tagId);
      tag.usageCount = (tag.usageCount || 0) + 1;
      this.tags.set(tagId, tag);
      this.saveTags();
    }

    this.saveContactTags();
    return true;
  }

  removeTagFromContact(phone, tagId) {
    if (!this.contactTags.has(phone)) return false;

    const removed = this.contactTags.get(phone).delete(tagId);

    if (removed) {
      // Decrementar contador de uso
      const tag = this.tags.get(tagId);
      if (tag) {
        tag.usageCount = Math.max(0, (tag.usageCount || 0) - 1);
        this.tags.set(tagId, tag);
        this.saveTags();
      }
    }

    this.saveContactTags();
    return removed;
  }

  getContactTags(phone) {
    const tagIds = this.contactTags.get(phone) || new Set();
    return Array.from(tagIds)
      .map(id => this.tags.get(id))
      .filter(Boolean);
  }

  getContactsByTag(tagId) {
    const contacts = [];
    for (const [phone, tagSet] of this.contactTags) {
      if (tagSet.has(tagId)) {
        contacts.push(phone);
      }
    }
    return contacts;
  }

  // ===== BÚSQUEDA Y FILTRADO =====
  searchTags(query) {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.tags.values()).filter(
      tag =>
        tag.name.toLowerCase().includes(lowercaseQuery) ||
        tag.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  getTagsByCategory(categoryId) {
    return Array.from(this.tags.values()).filter(
      tag => tag.categoryId === categoryId
    );
  }

  getContactsByMultipleTags(tagIds, operator = 'AND') {
    const contactSets = tagIds.map(
      tagId => new Set(this.getContactsByTag(tagId))
    );

    if (operator === 'AND') {
      // Intersección: contactos que tienen TODAS las etiquetas
      return Array.from(
        contactSets.reduce(
          (acc, set) => new Set([...acc].filter(x => set.has(x)))
        )
      );
    } else {
      // Unión: contactos que tienen AL MENOS UNA etiqueta
      const union = new Set();
      contactSets.forEach(set => set.forEach(contact => union.add(contact)));
      return Array.from(union);
    }
  }

  // ===== AUTOMATIZACIÓN =====
  autoTagByBehavior(phone, behavior) {
    const behaviorTags = {
      quick_responder: 'Responde Rápido',
      slow_responder: 'Responde Lento',
      asks_questions: 'Hace Preguntas',
      impulse_buyer: 'Comprador Impulso',
      very_interested: 'Muy Interesado',
      interested: 'Interesado',
      low_interest: 'Poco Interés',
      no_interest: 'Sin Interés',
    };

    const tagName = behaviorTags[behavior];
    if (tagName) {
      const tag = Array.from(this.tags.values()).find(t => t.name === tagName);
      if (tag) {
        this.addTagToContact(phone, tag.id);
        return tag;
      }
    }
    return null;
  }

  // ===== ESTADÍSTICAS =====
  getTagStats() {
    const stats = {
      totalTags: this.tags.size,
      totalCategories: this.categories.size,
      totalTaggedContacts: this.contactTags.size,
      mostUsedTags: Array.from(this.tags.values())
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 10),
      tagsByCategory: {},
    };

    for (const category of this.categories.values()) {
      stats.tagsByCategory[category.id] = {
        name: category.name,
        count: this.getTagsByCategory(category.id).length,
      };
    }

    return stats;
  }

  // ===== GETTERS =====
  getAllTags() {
    return Array.from(this.tags.values());
  }

  getAllCategories() {
    return Array.from(this.categories.values());
  }

  getTag(tagId) {
    return this.tags.get(tagId) || null;
  }

  getCategory(categoryId) {
    return this.categories.get(categoryId) || null;
  }
}

export default AdvancedTagManager;
