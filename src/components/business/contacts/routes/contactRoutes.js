/**
 * Rutas de Contactos Unificadas
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { Router } from 'express';
import { contactController } from '../controllers/ContactController.js';
import { authMiddleware } from '../../../../services/core/core/middleware.js';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Middleware para todas las rutas de contactos
router.use(authMiddleware);

// --- Rutas Principales de Contactos ---
router.get('/', contactController.getAllContacts);
router.post('/', contactController.createContact);
router.get('/:phone', contactController.getContact);
router.put('/:phone', contactController.updateContact);
router.delete('/:phone', contactController.deleteContact);

// --- Rutas de Etiquetas (Tags) ---
router.get('/tags/all', contactController.getAllTags);
router.post('/tags', contactController.createTag);
router.post('/:phone/tags/:tagId', contactController.addTagToContact);
router.delete('/:phone/tags/:tagId', contactController.removeTagFromContact);

// --- Rutas de Importación/Exportación ---
router.post('/import', upload.single('file'), contactController.importContacts);
router.get('/export', contactController.exportContacts);

// Nota: Las rutas de /bulk-messaging y /automation/rules se podrían mover
// a sus propios módulos (`automation`, `messaging`) en futuras refactorizaciones.
// Por ahora, se mantienen aquí para consistencia con el archivo original.

export default router;