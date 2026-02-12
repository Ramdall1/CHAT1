/**
 * Router para manejo de Flows de WhatsApp
 * Integración con 360dialog Hub API
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// Configuración para 360dialog Hub
const CONFIG = {
  D360_PARTNER_ID: process.env.D360_PARTNER_ID || '',
  D360_WABA_ACCOUNT_ID: process.env.D360_WABA_ACCOUNT_ID || '',
  D360_API_KEY: process.env.D360_API_KEY,
};

const hubHeaders = {
  'Content-Type': 'application/json',
  'X-API-KEY': CONFIG.D360_API_KEY,
};

// GET /flows - Lista de todos los Flows
router.get('/', async (req, res) => {
  try {
    const partner_id = req.query.partner_id || CONFIG.D360_PARTNER_ID;
    const waba_account_id =
      req.query.waba_account_id || CONFIG.D360_WABA_ACCOUNT_ID;

    // Verificar si estamos en modo local o si faltan credenciales
    const isLocalMode =
      process.env.LOCAL_MODE === 'true' ||
      !CONFIG.D360_API_KEY ||
      !partner_id ||
      !waba_account_id;

    if (isLocalMode) {
      console.log(
        '🏠 Modo local activado para flows - devolviendo flows simulados'
      );

      // Devolver flows simulados para desarrollo local
      const simulatedFlows = [
        {
          id: 'local_flow_1',
          name: 'Encuesta de Satisfacción',
          status: 'PUBLISHED',
          categories: ['SURVEY'],
          validation_errors: [],
          created_time: new Date().toISOString(),
          updated_time: new Date().toISOString(),
        },
        {
          id: 'local_flow_2',
          name: 'Registro de Usuario',
          status: 'PUBLISHED',
          categories: ['LEAD_GENERATION'],
          validation_errors: [],
          created_time: new Date().toISOString(),
          updated_time: new Date().toISOString(),
        },
      ];

      return res.json({
        ok: true,
        flows: simulatedFlows,
        count: simulatedFlows.length,
        mode: 'local',
      });
    }

    const url = `https://hub.360dialog.io/api/v2/partners/${partner_id}/waba_accounts/${waba_account_id}/flows`;
    console.log(`🔄 Obteniendo flows desde: ${url}`);

    const response = await axios.get(url, { headers: hubHeaders });

    return res.json({
      ok: true,
      flows: response.data,
      count: response.data?.length || 0,
      mode: 'production',
    });
  } catch (error) {
    console.error(
      '❌ Error obteniendo flows:',
      error.response?.data || error.message
    );

    // Si hay error de autenticación, cambiar a modo local
    if (error.response?.status === 401) {
      console.log('🔄 Error 401 detectado, cambiando a modo local para flows');

      const simulatedFlows = [
        {
          id: 'local_flow_1',
          name: 'Encuesta de Satisfacción',
          status: 'PUBLISHED',
          categories: ['SURVEY'],
          validation_errors: [],
          created_time: new Date().toISOString(),
          updated_time: new Date().toISOString(),
        },
        {
          id: 'local_flow_2',
          name: 'Registro de Usuario',
          status: 'PUBLISHED',
          categories: ['LEAD_GENERATION'],
          validation_errors: [],
          created_time: new Date().toISOString(),
          updated_time: new Date().toISOString(),
        },
      ];

      return res.json({
        ok: true,
        flows: simulatedFlows,
        count: simulatedFlows.length,
        mode: 'local_fallback',
        warning: 'Usando flows simulados debido a error de autenticación',
      });
    }

    return res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data || error.message,
      details: 'Error al obtener la lista de flows desde 360dialog Hub',
    });
  }
});

// GET /flows/:flow_id - Detalles de un Flow específico
router.get('/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    const partner_id = req.query.partner_id || CONFIG.D360_PARTNER_ID;
    const waba_account_id =
      req.query.waba_account_id || CONFIG.D360_WABA_ACCOUNT_ID;

    // Verificar si estamos en modo local o si faltan credenciales
    const isLocalMode =
      process.env.LOCAL_MODE === 'true' ||
      !CONFIG.D360_API_KEY ||
      !partner_id ||
      !waba_account_id;

    if (isLocalMode || flow_id.startsWith('local_flow_')) {
      console.log(
        `🏠 Modo local activado para flow ${flow_id} - devolviendo flow simulado`
      );

      // Devolver flow simulado para desarrollo local
      const simulatedFlow = {
        id: flow_id,
        name:
          flow_id === 'local_flow_1'
            ? 'Encuesta de Satisfacción'
            : 'Registro de Usuario',
        status: 'PUBLISHED',
        categories:
          flow_id === 'local_flow_1' ? ['SURVEY'] : ['LEAD_GENERATION'],
        validation_errors: [],
        created_time: new Date().toISOString(),
        updated_time: new Date().toISOString(),
        preview: {
          preview_url: `https://business.facebook.com/wa/manage/flows/${flow_id}/`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      return res.json({
        ok: true,
        flow: simulatedFlow,
        mode: 'local',
      });
    }

    const url = `https://hub.360dialog.io/api/v2/partners/${partner_id}/waba_accounts/${waba_account_id}/flows/${flow_id}`;
    console.log(`🔄 Obteniendo flow ${flow_id} desde: ${url}`);

    const response = await axios.get(url, { headers: hubHeaders });

    return res.json({
      ok: true,
      flow: response.data,
      mode: 'production',
    });
  } catch (error) {
    console.error(
      `❌ Error obteniendo flow ${req.params.flow_id}:`,
      error.response?.data || error.message
    );

    // Si hay error de autenticación, cambiar a modo local
    if (error.response?.status === 401) {
      console.log(
        `🔄 Error 401 detectado, cambiando a modo local para flow ${req.params.flow_id}`
      );

      const simulatedFlow = {
        id: req.params.flow_id,
        name:
          req.params.flow_id === 'local_flow_1'
            ? 'Encuesta de Satisfacción'
            : 'Registro de Usuario',
        status: 'PUBLISHED',
        categories:
          req.params.flow_id === 'local_flow_1'
            ? ['SURVEY']
            : ['LEAD_GENERATION'],
        validation_errors: [],
        created_time: new Date().toISOString(),
        updated_time: new Date().toISOString(),
        preview: {
          preview_url: `https://business.facebook.com/wa/manage/flows/${req.params.flow_id}/`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      return res.json({
        ok: true,
        flow: simulatedFlow,
        mode: 'local_fallback',
        warning: 'Usando flow simulado debido a error de autenticación',
      });
    }

    return res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data || error.message,
      details: `Error al obtener el flow ${req.params.flow_id} desde 360dialog Hub`,
    });
  }
});

export default router;
