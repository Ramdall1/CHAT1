import Database from 'better-sqlite3';
import path from 'path';

class LocalContactManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'database.sqlite');
    this.db = null;

    this.isInitialized = false;
  }

  async init() {
    try {
      this.db = new Database(this.dbPath);

      // Ensure tables exist
      this.createTables();

      this.isInitialized = true;
    } catch (error) {
      console.error('Error inicializando LocalContactManager:', error);
      throw error;
    }
  }

  createTables() {
    // Create contacts table if it doesn't exist - using unified schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        email VARCHAR(100),
        profile_picture_url TEXT,
        status TEXT DEFAULT 'active',
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        last_interaction DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
      CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction);

      CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp
      AFTER UPDATE ON contacts
      BEGIN
        UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    // Create tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(7) DEFAULT '#007bff',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create custom fields table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        description TEXT,
        options TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  // ===== GESTIÓN DE CONTACTOS =====
  createContact(phone, contactData = {}) {
    try {
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO contacts
        (phone_number, name, first_name, last_name, email, tags, custom_fields, status, last_interaction, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const result = insert.run(
        phone,
        contactData.name || null,
        contactData.firstName || contactData.first_name || null,
        contactData.lastName || contactData.last_name || null,
        contactData.email || null,
        JSON.stringify(contactData.tags || []),
        JSON.stringify(contactData.customFields || {}),
        'active',
        contactData.lastActivity || now,
        contactData.createdAt || now,
        now
      );

      return this.getContact(phone);
    } catch (error) {
      console.error('Error creando contacto:', error);
      return null;
    }
  }

  getContact(phone) {
    try {
      const select = this.db.prepare('SELECT * FROM contacts WHERE phone_number = ?');
      const row = select.get(phone);

      if (!row) return null;

      return {
        id: row.id,
        phone: row.phone_number,
        name: row.name,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        profile_picture_url: row.profile_picture_url,
        tags: JSON.parse(row.tags || '[]'),
        customFields: JSON.parse(row.custom_fields || '{}'),
        status: row.status,
        lastActivity: row.last_interaction,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessage: '' // This would need to be fetched from messages table
      };
    } catch (error) {
      console.error('Error obteniendo contacto:', error);
      return null;
    }
  }

  updateContact(phone, updateData) {
    try {
      const contact = this.getContact(phone);
      if (!contact) return null;

      const update = this.db.prepare(`
        UPDATE contacts SET
        name = ?, first_name = ?, last_name = ?, email = ?, profile_picture_url = ?,
        tags = ?, custom_fields = ?, status = ?, last_interaction = ?, notes = ?, updated_at = ?
        WHERE phone_number = ?
      `);

      const now = new Date().toISOString();
      const newName = updateData.name !== undefined ? updateData.name : contact.name;
      const newFirstName = updateData.firstName !== undefined || updateData.first_name !== undefined
        ? (updateData.firstName || updateData.first_name)
        : contact.firstName;
      const newLastName = updateData.lastName !== undefined || updateData.last_name !== undefined
        ? (updateData.lastName || updateData.last_name)
        : contact.lastName;

      const result = update.run(
        newName,
        newFirstName,
        newLastName,
        updateData.email !== undefined ? updateData.email : contact.email,
        updateData.profile_picture_url !== undefined ? updateData.profile_picture_url : contact.profile_picture_url,
        JSON.stringify(updateData.tags !== undefined ? updateData.tags : contact.tags),
        JSON.stringify(updateData.customFields !== undefined ? updateData.customFields : contact.customFields),
        updateData.status !== undefined ? updateData.status : contact.status,
        updateData.lastActivity || now,
        updateData.notes !== undefined ? updateData.notes : contact.notes,
        now,
        phone
      );

      if (result.changes > 0) {
        console.log(`✅ Contacto ${phone} actualizado: "${contact.name}" → "${newName}"`);
        // Retornar el contacto actualizado sin hacer otra consulta para evitar errores de BD
        return {
          ...contact,
          name: newName,
          firstName: newFirstName,
          lastName: newLastName,
          email: updateData.email !== undefined ? updateData.email : contact.email,
          profile_picture_url: updateData.profile_picture_url !== undefined ? updateData.profile_picture_url : contact.profile_picture_url,
          tags: updateData.tags !== undefined ? updateData.tags : contact.tags,
          customFields: updateData.customFields !== undefined ? updateData.customFields : contact.customFields,
          status: updateData.status !== undefined ? updateData.status : contact.status,
          lastActivity: updateData.lastActivity || now,
          notes: updateData.notes !== undefined ? updateData.notes : contact.notes,
          updatedAt: now
        };
      }

      return contact;
    } catch (error) {
      console.error('❌ Error actualizando contacto:', error);
      return null;
    }
  }

  deleteContact(phone) {
    try {
      const deleteStmt = this.db.prepare('DELETE FROM contacts WHERE phone_number = ?');
      const result = deleteStmt.run(phone);
      return result.changes > 0;
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      return false;
    }
  }

  getAllContacts() {
    try {
      const select = this.db.prepare('SELECT * FROM contacts ORDER BY created_at DESC');
      const rows = select.all();

      return rows.map(row => ({
        id: row.id,
        phone: row.phone_number,
        name: row.name,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        profile_picture_url: row.profile_picture_url,
        tags: JSON.parse(row.tags || '[]'),
        customFields: JSON.parse(row.custom_fields || '{}'),
        status: row.status,
        lastActivity: row.last_interaction,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessage: '' // This would need to be fetched from messages table
      }));
    } catch (error) {
      console.error('Error obteniendo todos los contactos:', error);
      return [];
    }
  }

  searchContacts(filters = {}) {
    let contacts = this.getAllContacts();

    if (filters.query) {
      const query = filters.query.toLowerCase();
      contacts = contacts.filter(
        contact =>
          contact.name.toLowerCase().includes(query) ||
          contact.phone.includes(query) ||
          contact.email.toLowerCase().includes(query)
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      contacts = contacts.filter(contact =>
        filters.tags.some(tag => contact.tags.includes(tag))
      );
    }

    return contacts;
  }

  updateLastContact(phone) {
    const contact = this.getContact(phone);
    if (contact) {
      this.updateContact(phone, { lastActivity: new Date().toISOString() });
    }
  }

  // ===== GESTIÓN DE ETIQUETAS =====
  createTag(tagData) {
    try {
      const insert = this.db.prepare(`
        INSERT INTO contact_tags (name, color, description)
        VALUES (?, ?, ?)
      `);

      const result = insert.run(
        tagData.name,
        tagData.color || '#007bff',
        tagData.description || null
      );

      return {
        id: result.lastInsertRowid,
        name: tagData.name,
        color: tagData.color || '#007bff',
        description: tagData.description || null,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creando etiqueta:', error);
      return null;
    }
  }

  getAllTags() {
    try {
      const select = this.db.prepare('SELECT * FROM contact_tags ORDER BY name');
      const rows = select.all();
      return rows;
    } catch (error) {
      console.error('Error obteniendo etiquetas:', error);
      return [];
    }
  }

  updateTag(tagId, updateData) {
    try {
      const update = this.db.prepare(`
        UPDATE contact_tags SET
        name = ?, color = ?, description = ?
        WHERE id = ?
      `);

      const result = update.run(
        updateData.name,
        updateData.color,
        updateData.description,
        tagId
      );

      if (result.changes > 0) {
        return this.getTagById(tagId);
      }
      return null;
    } catch (error) {
      console.error('Error actualizando etiqueta:', error);
      return null;
    }
  }

  deleteTag(tagId) {
    try {
      const deleteStmt = this.db.prepare('DELETE FROM contact_tags WHERE id = ?');
      const result = deleteStmt.run(tagId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error eliminando etiqueta:', error);
      return false;
    }
  }

  getTagById(tagId) {
    try {
      const select = this.db.prepare('SELECT * FROM contact_tags WHERE id = ?');
      return select.get(tagId);
    } catch (error) {
      console.error('Error obteniendo etiqueta por ID:', error);
      return null;
    }
  }

  addTagToContact(phone, tagName) {
    const contact = this.getContact(phone);
    if (contact && !contact.tags.includes(tagName)) {
      contact.tags.push(tagName);
      this.updateContact(phone, { tags: contact.tags });
    }
  }

  removeTagFromContact(phone, tagName) {
    const contact = this.getContact(phone);
    if (contact) {
      contact.tags = contact.tags.filter(tag => tag !== tagName);
      this.updateContact(phone, { tags: contact.tags });
    }
  }

  // ===== CAMPOS PERSONALIZADOS =====
  createCustomField(fieldData) {
    try {
      const insert = this.db.prepare(`
        INSERT INTO contact_custom_fields (name, type, description, options)
        VALUES (?, ?, ?, ?)
      `);

      const result = insert.run(
        fieldData.name,
        fieldData.type || 'text',
        fieldData.description || null,
        fieldData.options ? JSON.stringify(fieldData.options) : null
      );

      return {
        id: result.lastInsertRowid,
        name: fieldData.name,
        type: fieldData.type || 'text',
        description: fieldData.description || null,
        options: fieldData.options || null,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creando campo personalizado:', error);
      return null;
    }
  }

  getAllCustomFields() {
    try {
      const select = this.db.prepare('SELECT * FROM contact_custom_fields ORDER BY name');
      const rows = select.all();
      return rows.map(row => ({
        ...row,
        options: row.options ? JSON.parse(row.options) : null
      }));
    } catch (error) {
      console.error('Error obteniendo campos personalizados:', error);
      return [];
    }
  }

  updateCustomField(fieldId, updateData) {
    try {
      const update = this.db.prepare(`
        UPDATE contact_custom_fields SET
        name = ?, type = ?, description = ?, options = ?
        WHERE id = ?
      `);

      const result = update.run(
        updateData.name,
        updateData.type,
        updateData.description,
        updateData.options ? JSON.stringify(updateData.options) : null,
        fieldId
      );

      if (result.changes > 0) {
        return this.getCustomFieldById(fieldId);
      }
      return null;
    } catch (error) {
      console.error('Error actualizando campo personalizado:', error);
      return null;
    }
  }

  deleteCustomField(fieldId) {
    try {
      const deleteStmt = this.db.prepare('DELETE FROM contact_custom_fields WHERE id = ?');
      const result = deleteStmt.run(fieldId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error eliminando campo personalizado:', error);
      return false;
    }
  }

  getCustomFieldById(fieldId) {
    try {
      const select = this.db.prepare('SELECT * FROM contact_custom_fields WHERE id = ?');
      const row = select.get(fieldId);
      if (row) {
        return {
          ...row,
          options: row.options ? JSON.parse(row.options) : null
        };
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo campo personalizado por ID:', error);
      return null;
    }
  }

  setCustomFieldValue(phone, fieldName, value) {
    const contact = this.getContact(phone);
    if (contact) {
      if (!contact.customFields) {
        contact.customFields = {};
      }
      contact.customFields[fieldName] = value;
      this.updateContact(phone, { customFields: contact.customFields });
    }
  }

  // ===== IMPORTACIÓN/EXPORTACIÓN =====
  async importContacts(contacts, options = {}) {
    let imported = 0;
    let errors = 0;

    for (const contactData of contacts) {
      try {
        if (contactData.phone) {
          this.createContact(contactData.phone, contactData);
          imported++;
        }
      } catch (error) {
        errors++;
        console.error('Error importando contacto:', error.message);
      }
    }

    return { imported, errors };
  }

  async exportContacts(format = 'json', filters = {}) {
    const contacts = this.searchContacts(filters);

    if (format === 'json') {
      return contacts;
    }

    // Para otros formatos, retornar JSON por ahora
    return contacts;
  }

  // ===== SEGMENTACIÓN =====
  getSegmentContacts(segmentId) {
    // Implementación básica - retorna todos los contactos por ahora
    return this.getAllContacts();
  }

  segmentAudience(criteria) {
    // Implementación básica de segmentación
    return this.searchContacts(criteria);
  }

  // ===== ESTADÍSTICAS =====
  getStats() {
    try {
      const contacts = this.getAllContacts();
      const totalContacts = contacts.length;

      // Get total tags
      const tagCount = this.db.prepare('SELECT COUNT(*) as count FROM contact_tags').get();
      const totalTags = tagCount.count;

      // Get total custom fields
      const fieldCount = this.db.prepare('SELECT COUNT(*) as count FROM contact_custom_fields').get();
      const totalCustomFields = fieldCount.count;

      // Get recent contacts (last 24 hours)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentCount = this.db.prepare('SELECT COUNT(*) as count FROM contacts WHERE created_at > ?').get(dayAgo);
      const recentContacts = recentCount.count;

      return {
        totalContacts,
        totalTags,
        totalCustomFields,
        recentContacts,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        totalContacts: 0,
        totalTags: 0,
        totalCustomFields: 0,
        recentContacts: 0,
      };
    }
  }
}

export default LocalContactManager;
