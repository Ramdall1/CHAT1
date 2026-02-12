/**
 * Client Hub Routes
 *
 * Rutas para gestionar múltiples clientes y sus configuraciones WABA
 */

import express from 'express';
import ClientHubService from '../services/ClientHubService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/client-hub/clients
 * @desc Obtener todos los clientes
 */
router.get('/clients', async (req, res) => {
  try {
    const result = await ClientHubService.getAllClients();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/client-hub/clients:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/client-hub/clients/:clientId
 * @desc Obtener un cliente específico
 */
router.get('/clients/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    const result = await ClientHubService.getClient(clientId);

    if (result.success) {
      res.json(result);
    } else {
      res
        .status(result.error === 'Cliente no encontrado' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/client-hub/clients/:clientId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/client-hub/clients
 * @desc Crear un nuevo cliente con WABA automatizada
 */
router.post('/clients', async (req, res) => {
  try {
    const clientData = req.body;

    // Validar datos del cliente
    const validation = ClientHubService.validateClientData(clientData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Datos de cliente inválidos',
        details: validation.errors,
      });
    }

    const result = await ClientHubService.createClient(clientData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in POST /api/client-hub/clients:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route PATCH /api/client-hub/clients/:clientId
 * @desc Actualizar un cliente
 */
router.patch('/clients/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const updateData = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Datos de actualización requeridos',
      });
    }

    const result = await ClientHubService.updateClient(clientId, updateData);

    if (result.success) {
      res.json(result);
    } else {
      res
        .status(result.error === 'Cliente no encontrado' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error('Error in PATCH /api/client-hub/clients/:clientId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route DELETE /api/client-hub/clients/:clientId
 * @desc Eliminar un cliente
 */
router.delete('/clients/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    const result = await ClientHubService.deleteClient(clientId);

    if (result.success) {
      res.json(result);
    } else {
      res
        .status(result.error === 'Cliente no encontrado' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error('Error in DELETE /api/client-hub/clients/:clientId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/client-hub/clients/:clientId/config
 * @desc Obtener configuración de un cliente
 */
router.get('/clients/:clientId/config', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    const result = await ClientHubService.getClientConfig(clientId);

    if (result.success) {
      res.json(result);
    } else {
      res
        .status(result.error === 'Configuración no encontrada' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error(
      'Error in GET /api/client-hub/clients/:clientId/config:',
      error
    );
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route PATCH /api/client-hub/clients/:clientId/config
 * @desc Actualizar configuración de un cliente
 */
router.patch('/clients/:clientId/config', async (req, res) => {
  try {
    const { clientId } = req.params;
    const updateData = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Datos de actualización requeridos',
      });
    }

    const result = await ClientHubService.updateClientConfig(
      clientId,
      updateData
    );

    if (result.success) {
      res.json(result);
    } else {
      res
        .status(result.error === 'Configuración no encontrada' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error(
      'Error in PATCH /api/client-hub/clients/:clientId/config:',
      error
    );
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/client-hub/stats
 * @desc Obtener estadísticas del Client Hub
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await ClientHubService.getHubStats();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/client-hub/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/client-hub/clients/validate
 * @desc Validar datos de cliente antes de crear
 */
router.post('/clients/validate', async (req, res) => {
  try {
    const clientData = req.body;

    const validation = ClientHubService.validateClientData(clientData);

    res.json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors,
    });
  } catch (error) {
    logger.error('Error in POST /api/client-hub/clients/validate:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/client-hub/clients/:clientId/activate
 * @desc Activar un cliente
 */
router.post('/clients/:clientId/activate', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    const result = await ClientHubService.updateClient(clientId, {
      status: 'active',
      activatedAt: new Date().toISOString(),
    });

    if (result.success) {
      logger.info(`Client activated: ${clientId}`);
      res.json({
        success: true,
        message: 'Cliente activado exitosamente',
        client: result.client,
      });
    } else {
      res
        .status(result.error === 'Cliente no encontrado' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error(
      'Error in POST /api/client-hub/clients/:clientId/activate:',
      error
    );
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/client-hub/clients/:clientId/deactivate
 * @desc Desactivar un cliente
 */
router.post('/clients/:clientId/deactivate', async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido',
      });
    }

    const result = await ClientHubService.updateClient(clientId, {
      status: 'inactive',
      deactivatedAt: new Date().toISOString(),
    });

    if (result.success) {
      logger.info(`Client deactivated: ${clientId}`);
      res.json({
        success: true,
        message: 'Cliente desactivado exitosamente',
        client: result.client,
      });
    } else {
      res
        .status(result.error === 'Cliente no encontrado' ? 404 : 500)
        .json(result);
    }
  } catch (error) {
    logger.error(
      'Error in POST /api/client-hub/clients/:clientId/deactivate:',
      error
    );
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

export default router;
