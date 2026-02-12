
/**
 * Template Routes
 *
 * Define las rutas para el API de plantillas.
 */
import { Router } from 'express';
import { templateController } from './templateController.js';

const router = Router();

// Rutas que leen datos locales o de WABA
router.get('/', templateController.listTemplates);
router.get('/all', templateController.listTemplates); // Alias para detalles
router.get('/waba', templateController.listWabaTemplates);
router.get('/structure', templateController.getTemplateStructure);
router.get('/:name', templateController.getTemplateByName);

// Rutas que interactúan con la IA
router.post('/ai-assist', templateController.generateAITemplate);

// Rutas para construir y previsualizar plantillas
router.post('/preview', templateController.previewTemplate);
router.post('/build', templateController.buildTemplate);
router.post('/upload', templateController.uploadTemplate); // Simulado

// Ruta para enviar plantillas
router.post('/send', templateController.sendTemplate);

export default router;
