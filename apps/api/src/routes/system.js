import express from 'express';
import axios from 'axios';
import { log } from '../core/logger.js';
import { localModeManager } from '../core/localMode.js';

const router = express.Router();

// Configuración temporal (debería venir de config)
const CONFIG = {
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',
  D360_API_KEY: process.env.D360_API_KEY,
};

// GET /message-limits - Verificar límites de mensajería y calificación de calidad
router.get('/message-limits', async (req, res) => {
  try {
    // Si está en modo local, simular respuesta
    if (localModeManager.isLocalMode) {
      const simulatedHealth = await localModeManager.simulateHealthStatus();
      return res.json(simulatedHealth);
    }

    log('📊 Verificando límites de mensajería y calificación de calidad');

    // Usar el endpoint /health_status de la Messaging API
    const healthUrl = `${CONFIG.WABA_API_BASE}/health_status`;

    // Realizar la petición a la API de 360dialog
    const response = await axios.get(healthUrl, {
      headers: {
        'D360-API-KEY': CONFIG.D360_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const healthData = response.data;

    // Extraer información del health status
    const phoneNumberEntity = healthData.health_status?.entities?.find(
      entity => entity.entity_type === 'PHONE_NUMBER'
    );
    const wabaEntity = healthData.health_status?.entities?.find(
      entity => entity.entity_type === 'WABA'
    );

    // Construir respuesta con información disponible
    const limits = {
      overall_status: healthData.health_status?.can_send_message || 'UNKNOWN',
      phone_number_status: phoneNumberEntity?.can_send_message || 'UNKNOWN',
      phone_number_id: phoneNumberEntity?.id || 'N/A',
      waba_status: wabaEntity?.can_send_message || 'UNKNOWN',
      waba_id: wabaEntity?.id || 'N/A',
      additional_info: phoneNumberEntity?.additional_info || [],
      errors: phoneNumberEntity?.errors || [],
      node_id: healthData.id || 'N/A',
    };

    log(
      `✅ Estado de salud obtenido - General: ${limits.overall_status}, Teléfono: ${limits.phone_number_status}`
    );
    res.json({
      success: true,
      limits: limits,
      raw_data: healthData, // Para debugging si es necesario
    });
  } catch (e) {
    log(
      '❌ Error obteniendo límites de mensajería:',
      e.response?.data || e.message
    );
    res.status(500).json({
      error: e.response?.data || e.message,
      details:
        'Error al obtener los límites de mensajería y calificación de calidad',
    });
  }
});

export default router;
