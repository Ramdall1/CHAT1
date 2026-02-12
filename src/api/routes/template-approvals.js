/**
 * Rutas para Gestión de Aprobación de Plantillas
 * Endpoints para el flujo completo de aprobación
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import Dialog360Service from '../../services/Dialog360Service.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');
const logger = createLogger('TEMPLATE_APPROVALS_ROUTES');

// Utilidades
const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all(sql, params, (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
    });
});

const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get(sql, params, (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row || null);
    });
});

const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(sql, params, function(err) {
        db.close();
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

/**
 * GET /api/template-approvals/pending
 * Obtener plantillas pendientes de aprobación
 */
router.get('/pending', async (req, res) => {
    try {
        const templates = await queryAll(`
            SELECT * FROM template_approvals 
            WHERE status = 'PENDING' 
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            templates: templates || []
        });
    } catch (error) {
        console.error('Error obteniendo plantillas pendientes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/approved
 * Obtener plantillas aprobadas
 */
router.get('/approved', async (req, res) => {
    try {
        const templates = await queryAll(`
            SELECT * FROM template_approvals 
            WHERE status = 'APPROVED' 
            ORDER BY updated_at DESC
        `);

        res.json({
            success: true,
            templates: templates || []
        });
    } catch (error) {
        console.error('Error obteniendo plantillas aprobadas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/rejected
 * Obtener plantillas rechazadas
 */
router.get('/rejected', async (req, res) => {
    try {
        const templates = await queryAll(`
            SELECT * FROM template_approvals 
            WHERE status = 'REJECTED' 
            ORDER BY updated_at DESC
        `);

        res.json({
            success: true,
            templates: templates || []
        });
    } catch (error) {
        console.error('Error obteniendo plantillas rechazadas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/stats
 * Obtener estadísticas de aprobación
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await queryGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
            FROM template_approvals
        `);

        res.json({
            success: true,
            stats: {
                total: stats?.total || 0,
                pending: stats?.pending || 0,
                approved: stats?.approved || 0,
                rejected: stats?.rejected || 0,
                approvalRate: stats?.total > 0 ? 
                    ((stats.approved / stats.total) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/template-approvals/request
 * Solicitar aprobación de una plantilla
 */
router.post('/request', async (req, res) => {
    try {
        const { templateData, requestedBy } = req.body;

        if (!templateData || !templateData.name) {
            return res.status(400).json({
                success: false,
                error: 'Nombre de plantilla requerido'
            });
        }

        // Validar plantilla
        const validation = validateTemplate(templateData);

        // Insertar en BD
        const result = await queryRun(`
            INSERT INTO template_approvals (
                template_name, 
                template_data, 
                status, 
                requested_by, 
                validation_score,
                validation_errors,
                validation_warnings
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            templateData.name,
            JSON.stringify(templateData),
            'PENDING',
            requestedBy || 'admin',
            validation.score,
            JSON.stringify(validation.errors),
            JSON.stringify(validation.warnings)
        ]);

        res.json({
            success: true,
            id: result.lastID,
            message: 'Plantilla enviada para aprobación',
            validation
        });
    } catch (error) {
        console.error('Error solicitando aprobación:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/template-approvals/approve/:id
 * Aprobar una plantilla
 */
router.post('/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { approvedBy = 'admin', notes = '' } = req.body;

        await queryRun(`
            UPDATE template_approvals 
            SET status = 'APPROVED', 
                approved_by = ?, 
                approval_notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [approvedBy, notes, id]);

        const template = await queryGet('SELECT * FROM template_approvals WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Plantilla aprobada correctamente',
            template
        });
    } catch (error) {
        console.error('Error aprobando plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/template-approvals/reject/:id
 * Rechazar una plantilla
 */
router.post('/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectedBy = 'admin', reason = '' } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'La razón del rechazo es requerida'
            });
        }

        await queryRun(`
            UPDATE template_approvals 
            SET status = 'REJECTED', 
                rejected_by = ?, 
                rejection_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [rejectedBy, reason, id]);

        const template = await queryGet('SELECT * FROM template_approvals WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Plantilla rechazada correctamente',
            template
        });
    } catch (error) {
        console.error('Error rechazando plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/template-approvals/validate
 * Validar una plantilla
 */
router.post('/validate', async (req, res) => {
    try {
        const { templateData } = req.body;

        if (!templateData) {
            return res.status(400).json({
                success: false,
                error: 'templateData requerido'
            });
        }

        const validation = validateTemplate(templateData);

        res.json({
            success: true,
            validation
        });
    } catch (error) {
        console.error('Error validando plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/:id
 * Obtener detalles de una plantilla
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const template = await queryGet(
            'SELECT * FROM template_approvals WHERE id = ?',
            [id]
        );

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Plantilla no encontrada'
            });
        }

        // Parsear JSON
        if (template.template_data) {
            template.template_data = JSON.parse(template.template_data);
        }
        if (template.validation_errors) {
            template.validation_errors = JSON.parse(template.validation_errors);
        }
        if (template.validation_warnings) {
            template.validation_warnings = JSON.parse(template.validation_warnings);
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        console.error('Error obteniendo plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Función para validar plantilla
 */
function validateTemplate(templateData) {
    const errors = [];
    const warnings = [];
    let score = 100;

    // Validaciones básicas
    if (!templateData.name || templateData.name.trim().length === 0) {
        errors.push('El nombre de la plantilla es requerido');
        score -= 20;
    }

    if (!templateData.language) {
        errors.push('El idioma de la plantilla es requerido');
        score -= 20;
    }

    if (!templateData.category) {
        warnings.push('Se recomienda especificar una categoría');
        score -= 5;
    }

    // Validar componentes
    if (!templateData.components || !Array.isArray(templateData.components)) {
        errors.push('La plantilla debe tener al menos un componente');
        score -= 20;
    } else {
        let hasBody = false;
        templateData.components.forEach((component, index) => {
            if (!component.type) {
                errors.push(`Componente ${index}: tipo requerido`);
                score -= 10;
            }

            if (component.type === 'BODY') {
                hasBody = true;
                if (!component.text) {
                    errors.push(`Componente ${index}: texto del body requerido`);
                    score -= 15;
                }
            }
        });

        if (!hasBody) {
            errors.push('La plantilla debe tener un componente BODY');
            score -= 20;
        }
    }

    // Validar longitud de texto
    const templateText = extractTemplateText(templateData);
    if (templateText.length > 1024) {
        errors.push('El texto de la plantilla excede el límite de 1024 caracteres');
        score -= 15;
    }

    // Validar palabras prohibidas
    const prohibitedWords = ['gratis', 'free', 'urgente', 'urgent', 'limitado', 'limited'];
    const lowerText = templateText.toLowerCase();
    prohibitedWords.forEach(word => {
        if (lowerText.includes(word)) {
            warnings.push(`Palabra potencialmente problemática detectada: "${word}"`);
            score -= 3;
        }
    });

    // Asegurar score entre 0 y 100
    score = Math.max(0, Math.min(100, score));

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        score
    };
}

/**
 * Extraer texto de plantilla
 */
function extractTemplateText(templateData) {
    let text = '';

    if (templateData.components && Array.isArray(templateData.components)) {
        templateData.components.forEach(component => {
            if (component.text) {
                text += component.text + ' ';
            }
            if (component.buttons && Array.isArray(component.buttons)) {
                component.buttons.forEach(button => {
                    if (button.text) {
                        text += button.text + ' ';
                    }
                });
            }
        });
    }

    return text.trim();
}

/**
 * POST /api/template-approvals/send-to-360dialog/:id
 * Enviar plantilla aprobada a 360Dialog
 */
router.post('/send-to-360dialog/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener plantilla de BD
        const template = await queryGet(
            'SELECT * FROM template_approvals WHERE id = ?',
            [id]
        );

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Plantilla no encontrada'
            });
        }

        if (template.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Solo se pueden enviar plantillas aprobadas'
            });
        }

        // Parsear datos de plantilla
        const templateData = JSON.parse(template.template_data);

        logger.info(`📤 Enviando plantilla "${templateData.name}" a 360Dialog`);

        // Enviar a 360Dialog
        const result = await Dialog360Service.submitTemplateForApproval(templateData);

        // Actualizar BD con ID de 360Dialog
        await queryRun(`
            UPDATE template_approvals 
            SET dialog360_id = ?, 
                dialog360_status = 'PENDING',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [result.templateId, id]);

        res.json({
            success: true,
            message: 'Plantilla enviada a 360Dialog',
            dialog360Id: result.templateId,
            dialog360Status: result.status
        });
    } catch (error) {
        logger.error('Error enviando a 360Dialog:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/sync-360dialog
 * Sincronizar estado de plantillas con 360Dialog
 */
router.get('/sync-360dialog', async (req, res) => {
    try {
        logger.info('🔄 Sincronizando plantillas con 360Dialog');

        // Obtener plantillas con ID de 360Dialog
        const templates = await queryAll(`
            SELECT * FROM template_approvals 
            WHERE dialog360_id IS NOT NULL 
            AND dialog360_status != 'APPROVED'
        `);

        let updated = 0;
        const results = [];

        for (const template of templates) {
            try {
                // Obtener estado de 360Dialog
                const status = await Dialog360Service.getTemplateStatus(template.dialog360_id);

                // Actualizar BD
                await queryRun(`
                    UPDATE template_approvals 
                    SET dialog360_status = ?, 
                        rejection_reason = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [status.status, status.rejectionReason || null, template.id]);

                updated++;
                results.push({
                    id: template.id,
                    dialog360Id: template.dialog360_id,
                    status: status.status
                });

                logger.info(`✅ Plantilla ${template.id} actualizada: ${status.status}`);
            } catch (error) {
                logger.error(`❌ Error actualizando plantilla ${template.id}: ${error.message}`);
                results.push({
                    id: template.id,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `${updated} plantillas sincronizadas`,
            updated,
            results
        });
    } catch (error) {
        logger.error('Error sincronizando con 360Dialog:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/validate-api-key
 * Validar que la API Key de 360Dialog sea válida
 */
router.get('/validate-api-key', async (req, res) => {
    try {
        logger.info('🔐 Validando API Key de 360Dialog');

        const validation = await Dialog360Service.validateApiKey();

        res.json({
            success: validation.valid,
            valid: validation.valid,
            message: validation.message
        });
    } catch (error) {
        logger.error('Error validando API Key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/template-approvals/list-360dialog
 * Obtener lista de plantillas de 360Dialog
 */
router.get('/list-360dialog', async (req, res) => {
    try {
        logger.info('📋 Obteniendo plantillas de 360Dialog');

        const result = await Dialog360Service.getTemplates();

        res.json({
            success: result.success,
            templates: result.templates,
            count: result.count
        });
    } catch (error) {
        logger.error('Error obteniendo plantillas de 360Dialog:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
