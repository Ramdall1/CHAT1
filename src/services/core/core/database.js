import { Sequelize, DataTypes } from '../../../adapters/SequelizeAdapter.js';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('DATABASE');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'data', 'database.sqlite'),
  logging: (msg) => logger.debug(msg)
});

const Contact = sequelize.define('Contact', {
  phone: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  lastInteraction: {
    type: DataTypes.DATE,
    allowNull: true
  },
  interactionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  }
});

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'text'
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'outbound'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  from: {
    type: DataTypes.STRING,
    allowNull: false
  },
  to: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  templateId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  templateData: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  errorCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  whatsappMessageId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  conversationId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  campaignId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  automationRuleId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Connection has been established successfully.');
    await sequelize.sync({ alter: true });
    logger.info('All models were synchronized successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
}

export function getDatabase() {
  return {
    sequelize,
    models: {
      Contact,
      Message
    }
  };
}

export function generateId(prefix = '', length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export { Contact, Message };
