// Script de inicialización para MongoDB
// Este script se ejecuta automáticamente cuando se crea el contenedor

// Crear base de datos y usuario
db = db.getSiblingDB('chatbot_enterprise');

// Crear usuario para la aplicación
db.createUser({
  user: 'chatbot_user',
  pwd: 'chatbot_secure_password',
  roles: [
    {
      role: 'readWrite',
      db: 'chatbot_enterprise'
    }
  ]
});

// Crear colecciones principales con validación
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 8
        },
        role: {
          bsonType: 'string',
          enum: ['admin', 'user', 'manager']
        },
        isActive: {
          bsonType: 'bool'
        },
        createdAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('conversations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'phoneNumber', 'createdAt'],
      properties: {
        userId: {
          bsonType: 'objectId'
        },
        phoneNumber: {
          bsonType: 'string',
          pattern: '^\\+[1-9]\\d{1,14}$'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'closed', 'pending']
        },
        createdAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('messages', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['conversationId', 'content', 'timestamp'],
      properties: {
        conversationId: {
          bsonType: 'objectId'
        },
        content: {
          bsonType: 'string',
          maxLength: 4096
        },
        messageType: {
          bsonType: 'string',
          enum: ['text', 'image', 'audio', 'video', 'document']
        },
        direction: {
          bsonType: 'string',
          enum: ['inbound', 'outbound']
        },
        timestamp: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('templates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'content', 'category'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100
        },
        content: {
          bsonType: 'string',
          maxLength: 1024
        },
        category: {
          bsonType: 'string',
          enum: ['marketing', 'utility', 'authentication']
        },
        status: {
          bsonType: 'string',
          enum: ['approved', 'pending', 'rejected']
        }
      }
    }
  }
});

// Crear índices para optimizar consultas
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });
db.users.createIndex({ role: 1 });

db.conversations.createIndex({ userId: 1 });
db.conversations.createIndex({ phoneNumber: 1 });
db.conversations.createIndex({ createdAt: 1 });
db.conversations.createIndex({ status: 1 });

db.messages.createIndex({ conversationId: 1 });
db.messages.createIndex({ timestamp: 1 });
db.messages.createIndex({ messageType: 1 });
db.messages.createIndex({ direction: 1 });

db.templates.createIndex({ name: 1 }, { unique: true });
db.templates.createIndex({ category: 1 });
db.templates.createIndex({ status: 1 });

// Insertar datos de ejemplo
db.users.insertOne({
  email: 'admin@chatbot.com',
  password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIpu', // password: admin123
  role: 'admin',
  isActive: true,
  createdAt: new Date(),
  profile: {
    firstName: 'Admin',
    lastName: 'User',
    phone: '+1234567890'
  }
});

db.templates.insertMany([
  {
    name: 'welcome_message',
    content: 'Bienvenido a nuestro servicio de atención al cliente. ¿En qué podemos ayudarte hoy?',
    category: 'utility',
    status: 'approved',
    createdAt: new Date()
  },
  {
    name: 'business_hours',
    content: 'Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM.',
    category: 'utility',
    status: 'approved',
    createdAt: new Date()
  },
  {
    name: 'thank_you',
    content: 'Gracias por contactarnos. Tu consulta es importante para nosotros.',
    category: 'utility',
    status: 'approved',
    createdAt: new Date()
  }
]);

print('Base de datos inicializada correctamente con colecciones, índices y datos de ejemplo.');