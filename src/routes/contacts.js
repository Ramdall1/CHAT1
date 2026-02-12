import express from 'express';
import { dbUtils } from '../apps/api/src/core/localDB.js';

export default function createContactsRouter(io) {
  const router = express.Router();

  // ===== API GESTIÓN DE CONTACTOS =====

  router.get('/contact/:phone', async (req, res) => {
    try {
      const phone = req.params.phone;
      const messages = dbUtils.getMessagesByPhone(phone);
      
      if (messages.length === 0) {
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }

      // Construir información del contacto desde los mensajes
      const latestMessage = messages[messages.length - 1];
      const contact = {
        phone: phone,
        name: latestMessage.contact_name || null,
        last_seen: latestMessage.created_at,
        last_text: latestMessage.message_text || '',
        tags: [], // Los tags se pueden implementar como metadata
        fields: {},
        messageCount: messages.length
      };

      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener contacto' });
    }
  });

  router.post('/contact/:phone/tag', async (req, res) => {
    try {
      const phone = req.params.phone;
      const { tag } = req.body;
      
      if (!tag) {
        return res.status(400).json({ error: 'Falta el tag' });
      }

      // Obtener el último mensaje para actualizar metadata
      const messages = dbUtils.getMessagesByPhone(phone);
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        const metadata = JSON.parse(latestMessage.metadata || '{}');
        
        if (!metadata.tags) metadata.tags = [];
        if (!metadata.tags.includes(tag)) {
          metadata.tags.push(tag);
        }

        dbUtils.updateMessage(latestMessage.id, {
          metadata: JSON.stringify(metadata)
        });

        // Emitir actualización
        io.emit('inbox_snapshot', dbUtils.getUniqueContacts());
        
        res.json({ success: true, tag: tag });
      } else {
        res.status(404).json({ error: 'Contacto no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al agregar tag' });
    }
  });

  router.delete('/contact/:phone/tag', async (req, res) => {
    try {
      const phone = req.params.phone;
      const { tag } = req.body;
      
      if (!tag) {
        return res.status(400).json({ error: 'Falta el tag' });
      }

      // Obtener el último mensaje para actualizar metadata
      const messages = dbUtils.getMessagesByPhone(phone);
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        const metadata = JSON.parse(latestMessage.metadata || '{}');
        
        if (metadata.tags) {
          metadata.tags = metadata.tags.filter(t => t !== tag);
        }

        dbUtils.updateMessage(latestMessage.id, {
          metadata: JSON.stringify(metadata)
        });

        // Emitir actualización
        io.emit('inbox_snapshot', dbUtils.getUniqueContacts());
        
        res.json({ success: true, tag: tag });
      } else {
        res.status(404).json({ error: 'Contacto no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar tag' });
    }
  });

  router.post('/contact/:phone/field', async (req, res) => {
    try {
      const phone = req.params.phone;
      const { field, value } = req.body;
      
      if (!field || value === undefined) {
        return res.status(400).json({ error: 'Faltan field o value' });
      }

      // Obtener el último mensaje para actualizar metadata
      const messages = dbUtils.getMessagesByPhone(phone);
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        const metadata = JSON.parse(latestMessage.metadata || '{}');
        
        if (!metadata.fields) metadata.fields = {};
        metadata.fields[field] = value;

        dbUtils.updateMessage(latestMessage.id, {
          metadata: JSON.stringify(metadata)
        });

        // Emitir actualización
        io.emit('inbox_snapshot', dbUtils.getUniqueContacts());
        
        res.json({ success: true, field: field, value: value });
      } else {
        res.status(404).json({ error: 'Contacto no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar campo' });
    }
  });

  router.get('/inbox', async (req, res) => {
    try {
      const contacts = dbUtils.getUniqueContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener inbox' });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      const phone = req.query.phone;
      if (!phone) return res.json([]);

      const messages = dbUtils.getMessagesByPhone(phone);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener historial' });
    }
  });

  // Import contacts from CSV/Excel file
  router.post('/import', async (req, res) => {
    try {
      const file = req.files?.file || req.body?.file;
      if (!file) {
        return res.status(400).json({ error: 'No se encontró el archivo' });
      }

      // For now, return success - implement actual import logic later
      res.json({
        success: true,
        imported: 0,
        message: 'Importación no implementada aún'
      });
    } catch (error) {
      logger.error('Error importing contacts:', error);
      res.status(500).json({ error: 'Error al importar contactos' });
    }
  });

  return router;
}
