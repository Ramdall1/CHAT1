/**
 * Adaptador simplificado para simular Sequelize sin causar errores de segmentación
 */

// Simulación de datos en memoria
const mockData = {
  campaigns: [
    {
      id: 1,
      name: 'Campaña de Prueba',
      description: 'Descripción de prueba',
      template_id: 1,
      user_id: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  contacts: [],
  messages: [],
  conversations: [],
  message_templates: [],
  media_files: [],
  campaign_contacts: [],
  audience_segments: [],
  templates: [],
  users: [
    {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
};

// Función para filtrar datos según condiciones WHERE
function applyWhereConditions(data, where = {}) {
  if (!where || Object.keys(where).length === 0) {
    return data;
  }
  
  return data.filter(item => {
    return Object.keys(where).every(key => {
      const value = where[key];
      if (typeof value === 'object' && value !== null) {
        // Manejar operadores complejos si es necesario
        return true;
      }
      return item[key] === value;
    });
  });
}

// Función para aplicar ordenamiento
function applyOrder(data, order = []) {
  if (!order || order.length === 0) {
    return data;
  }
  
  const [field, direction = 'ASC'] = order[0];
  return [...data].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (direction.toUpperCase() === 'DESC') {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
}

// Función para aplicar paginación
function applyPagination(data, limit, offset = 0) {
  if (!limit) return data;
  return data.slice(offset, offset + limit);
}

// Modelos simulados
export const Campaign = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.campaigns;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.campaigns, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.campaigns.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.campaigns.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.campaigns.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.campaigns, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.campaigns.length;
    mockData.campaigns = mockData.campaigns.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.campaigns.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.campaigns, where);
    return data.length;
  },
  
  findAndCountAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.campaigns;
    
    data = applyWhereConditions(data, where);
    const count = data.length;
    
    data = applyOrder(data, order);
    const rows = applyPagination(data, limit, offset);
    
    return { rows, count };
  }
};

export const Contact = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.contacts;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.contacts, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.contacts.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.contacts.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.contacts.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.contacts, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.contacts.length;
    mockData.contacts = mockData.contacts.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.contacts.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.contacts, where);
    return data.length;
  }
};

export const Message = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.messages;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.messages, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.messages.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.messages.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.messages.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.messages, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.messages.length;
    mockData.messages = mockData.messages.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.messages.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.messages, where);
    return data.length;
  },

  findAndCountAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.messages;
    
    data = applyWhereConditions(data, where);
    const count = data.length;
    
    data = applyOrder(data, order);
    const rows = applyPagination(data, limit, offset);
    
    return { rows, count };
  }
};

export const Conversation = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.conversations;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.conversations, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.conversations.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.conversations.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.conversations.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.conversations, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.conversations.length;
    mockData.conversations = mockData.conversations.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.conversations.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.conversations, where);
    return data.length;
  }
};

export const MessageTemplate = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.message_templates;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.message_templates, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.message_templates.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.message_templates.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.message_templates.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.message_templates, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.message_templates.length;
    mockData.message_templates = mockData.message_templates.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.message_templates.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.message_templates, where);
    return data.length;
  }
};

export const CampaignContact = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.campaign_contacts;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.campaign_contacts, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.campaign_contacts.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.campaign_contacts.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.campaign_contacts.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.campaign_contacts, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.campaign_contacts.length;
    mockData.campaign_contacts = mockData.campaign_contacts.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.campaign_contacts.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.campaign_contacts, where);
    return data.length;
  }
};

export const MediaFile = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.media_files;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.media_files, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.media_files.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.media_files.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.media_files.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.media_files, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.media_files.length;
    mockData.media_files = mockData.media_files.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.media_files.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.media_files, where);
    return data.length;
  }
};

export const User = {
  findAll: async (options = {}) => {
    const { where, order, limit, offset } = options;
    let data = mockData.users;
    
    data = applyWhereConditions(data, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.users, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.users.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.users.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.users.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.users, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.users.length;
    mockData.users = mockData.users.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.users.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.users, where);
    return data.length;
  }
};

export const AudienceSegment = {
  findAll: async (options = {}) => {
    const { where, limit, offset, order } = options;
    let data = applyWhereConditions(mockData.audience_segments, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.audience_segments, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.audience_segments.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.audience_segments.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.audience_segments.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.audience_segments, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.audience_segments.length;
    mockData.audience_segments = mockData.audience_segments.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.audience_segments.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.audience_segments, where);
    return data.length;
  },
  
  findAndCountAll: async (options = {}) => {
    const { where, limit, offset, order } = options;
    let data = applyWhereConditions(mockData.audience_segments, where);
    const count = data.length;
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return {
      rows: data,
      count: count
    };
  }
};

export const Template = {
  findAll: async (options = {}) => {
    const { where, limit, offset, order } = options;
    let data = applyWhereConditions(mockData.templates, where);
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return data;
  },
  
  findOne: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.templates, where);
    return data[0] || null;
  },
  
  findByPk: async (id) => {
    return mockData.templates.find(item => item.id === id) || null;
  },
  
  create: async (data) => {
    const newItem = {
      id: mockData.templates.length + 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockData.templates.push(newItem);
    return newItem;
  },
  
  update: async (data, options = {}) => {
    const { where } = options;
    const items = applyWhereConditions(mockData.templates, where);
    items.forEach(item => {
      Object.assign(item, data, { updated_at: new Date().toISOString() });
    });
    return [items.length];
  },
  
  destroy: async (options = {}) => {
    const { where } = options;
    const initialLength = mockData.templates.length;
    mockData.templates = mockData.templates.filter(item => {
      return !Object.keys(where).every(key => item[key] === where[key]);
    });
    return initialLength - mockData.templates.length;
  },
  
  count: async (options = {}) => {
    const { where } = options;
    const data = applyWhereConditions(mockData.templates, where);
    return data.length;
  },
  
  findAndCountAll: async (options = {}) => {
    const { where, limit, offset, order } = options;
    let data = applyWhereConditions(mockData.templates, where);
    const count = data.length;
    data = applyOrder(data, order);
    data = applyPagination(data, limit, offset);
    
    return {
      rows: data,
      count: count
    };
  }
};

// Operadores de Sequelize simulados
export const Op = {
  eq: '=',
  ne: '!=',
  gte: '>=',
  gt: '>',
  lte: '<=',
  lt: '<',
  not: 'NOT',
  is: 'IS',
  in: 'IN',
  notIn: 'NOT IN',
  like: 'LIKE',
  notLike: 'NOT LIKE',
  iLike: 'LIKE',
  notILike: 'NOT LIKE',
  between: 'BETWEEN',
  notBetween: 'NOT BETWEEN',
  and: 'AND',
  or: 'OR'
};

// DataTypes simulados
export const DataTypes = {
  STRING: 'TEXT',
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATETIME',
  UUID: 'TEXT',
  JSON: 'TEXT'
};

// Sequelize simulado
export const sequelize = {
  transaction: async (callback) => {
    return await callback();
  },
  close: async () => {
    return true;
  },
  authenticate: async () => {
    return true;
  },
  sync: async (options = {}) => {
    return true;
  },
  define: (modelName, attributes, options = {}) => {
    // Retornar un objeto que simule un modelo de Sequelize
    return {
      findAll: async (opts = {}) => [],
      findOne: async (opts = {}) => null,
      findByPk: async (id) => null,
      create: async (data) => ({ id: Date.now(), ...data }),
      update: async (data, opts = {}) => [1],
      destroy: async (opts = {}) => 1,
      count: async (opts = {}) => 0,
      findAndCountAll: async (opts = {}) => ({ count: 0, rows: [] })
    };
  }
};

// Clase Model simulada
export class Model {
  static init(attributes, options) {
    return this;
  }
  
  static associate(models) {
    return this;
  }
  
  static async findAll(options = {}) {
    return [];
  }
  
  static async findOne(options = {}) {
    return null;
  }
  
  static async create(values) {
    return values;
  }
}

// Clase Sequelize simulada
export class Sequelize {
  constructor(database, username, password, options) {
    this.database = database;
    this.username = username;
    this.password = password;
    this.options = options;
  }
  
  async authenticate() {
    return true;
  }
  
  async close() {
    return true;
  }
  
  transaction(callback) {
    return callback();
  }
  
  define(modelName, attributes, options = {}) {
    return Model;
  }
}

export default {
  Campaign,
  Contact,
  Message,
  Conversation,
  MessageTemplate,
  CampaignContact,
  MediaFile,
  User,
  AudienceSegment,
  Template,
  Op,
  DataTypes,
  sequelize,
  Model,
  Sequelize
};