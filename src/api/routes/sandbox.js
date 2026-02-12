import express from 'express';
import { SandboxManager } from '../../sandbox/SandboxManager.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('SANDBOX_API');

// Instancia global del SandboxManager
let sandboxManager = null;

/**
 * Inicializar SandboxManager
 */
function initializeSandboxManager() {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      maxSandboxes: 20,
      cleanupInterval: 300000, // 5 minutos
      maxIdleTime: 600000, // 10 minutos
      defaultTimeout: 10000
    });
    
    logger.info('SandboxManager inicializado para API');
  }
  return sandboxManager;
}

/**
 * Middleware para validar JSON
 */
function validateJSON(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cuerpo de la petición requerido'
      });
    }
  }
  next();
}

/**
 * Middleware para manejar errores
 */
function handleError(error, req, res, next) {
  logger.error('Error en API de sandbox:', error);
  
  res.status(500).json({
    success: false,
    error: error.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
}

// Aplicar middlewares
router.use(express.json({ limit: '1mb' }));
router.use(validateJSON);

/**
 * GET /api/sandbox/status
 * Obtener estado del sistema de sandbox
 */
router.get('/status', (req, res) => {
  try {
    const manager = initializeSandboxManager();
    const stats = manager.getGlobalStats();
    
    res.json({
      success: true,
      data: {
        status: 'active',
        ...stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * GET /api/sandbox/profiles
 * Obtener perfiles disponibles
 */
router.get('/profiles', (req, res) => {
  try {
    const manager = initializeSandboxManager();
    const profiles = Object.keys(manager.config.profiles).map(name => ({
      name,
      ...manager.config.profiles[name]
    }));
    
    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * GET /api/sandbox/list
 * Listar todos los sandboxes
 */
router.get('/list', (req, res) => {
  try {
    const manager = initializeSandboxManager();
    const sandboxes = manager.listSandboxes();
    
    res.json({
      success: true,
      data: sandboxes
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/sandbox/create
 * Crear un nuevo sandbox
 */
router.post('/create', async(req, res) => {
  try {
    const { id, profile = 'standard', options = {} } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID del sandbox requerido'
      });
    }
    
    const manager = initializeSandboxManager();
    const sandbox = await manager.createSandbox(id, profile, options);
    
    res.status(201).json({
      success: true,
      data: {
        id,
        profile,
        created: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/sandbox/execute
 * Ejecutar código en un sandbox
 */
router.post('/execute', async(req, res) => {
  try {
    const { sandboxId, code, options = {} } = req.body;
    
    if (!sandboxId) {
      return res.status(400).json({
        success: false,
        error: 'ID del sandbox requerido'
      });
    }
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código a ejecutar requerido'
      });
    }
    
    const manager = initializeSandboxManager();
    const startTime = Date.now();
    const result = await manager.execute(sandboxId, code, options);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        result,
        executionTime,
        sandboxId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/sandbox/execute-temporary
 * Ejecutar código en un sandbox temporal
 */
router.post('/execute-temporary', async(req, res) => {
  try {
    const { code, profile = 'basic', options = {} } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código a ejecutar requerido'
      });
    }
    
    const manager = initializeSandboxManager();
    const startTime = Date.now();
    const result = await manager.executeTemporary(code, profile, options);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        result,
        executionTime,
        profile,
        temporary: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * GET /api/sandbox/:id/stats
 * Obtener estadísticas de un sandbox específico
 */
router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const manager = initializeSandboxManager();
    const stats = manager.getSandboxStats(id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * DELETE /api/sandbox/:id
 * Destruir un sandbox específico
 */
router.delete('/:id', async(req, res) => {
  try {
    const { id } = req.params;
    const manager = initializeSandboxManager();
    
    await manager.destroySandbox(id);
    
    res.json({
      success: true,
      data: {
        id,
        destroyed: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * DELETE /api/sandbox/cleanup/all
 * Destruir todos los sandboxes
 */
router.delete('/cleanup/all', async(req, res) => {
  try {
    const manager = initializeSandboxManager();
    const sandboxesBefore = manager.listSandboxes().length;
    
    await manager.destroyAll();
    
    res.json({
      success: true,
      data: {
        destroyed: sandboxesBefore,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/sandbox/cleanup/idle
 * Limpiar sandboxes inactivos
 */
router.post('/cleanup/idle', (req, res) => {
  try {
    const manager = initializeSandboxManager();
    const sandboxesBefore = manager.listSandboxes().length;
    
    manager.cleanupIdleSandboxes();
    
    // Esperar un poco para que la limpieza termine
    setTimeout(() => {
      const sandboxesAfter = manager.listSandboxes().length;
      const cleaned = sandboxesBefore - sandboxesAfter;
      
      res.json({
        success: true,
        data: {
          cleaned,
          remaining: sandboxesAfter,
          timestamp: new Date().toISOString()
        }
      });
    }, 100);
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/sandbox/test
 * Endpoint de prueba para validar el sistema
 */
router.post('/test', async(req, res) => {
  try {
    const { testType = 'basic' } = req.body;
    const manager = initializeSandboxManager();
    
    let testCode, expectedResult;
    
    switch (testType) {
    case 'basic':
      testCode = 'module.exports = { result: 2 + 2, message: "Hello Sandbox!" };';
      expectedResult = { result: 4, message: 'Hello Sandbox!' };
      break;
        
    case 'math':
      testCode = `
          const factorial = (n) => n <= 1 ? 1 : n * factorial(n - 1);
          module.exports = { factorial5: factorial(5), pi: Math.PI };
        `;
      expectedResult = { factorial5: 120, pi: Math.PI };
      break;
        
    case 'async':
      testCode = `
          const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
          module.exports = { 
            promise: delay(100).then(() => 'completed'),
            timestamp: Date.now()
          };
        `;
      break;
        
    case 'security':
      testCode = 'const fs = require("fs"); module.exports = { fs };';
      // Este debería fallar por seguridad
      break;
        
    default:
      return res.status(400).json({
        success: false,
        error: 'Tipo de prueba no válido'
      });
    }
    
    const startTime = Date.now();
    
    try {
      const result = await manager.executeTemporary(testCode, 'testing');
      const executionTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          testType,
          result,
          executionTime,
          passed: testType !== 'security', // Security test should fail
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Para el test de seguridad, el error es esperado
      if (testType === 'security') {
        res.json({
          success: true,
          data: {
            testType,
            error: error.message,
            passed: true, // Error esperado = test pasado
            timestamp: new Date().toISOString()
          }
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

// Aplicar middleware de manejo de errores
router.use(handleError);

// Limpiar recursos al cerrar
process.on('SIGINT', async() => {
  if (sandboxManager) {
    logger.info('Cerrando SandboxManager...');
    await sandboxManager.shutdown();
  }
});

process.on('SIGTERM', async() => {
  if (sandboxManager) {
    logger.info('Cerrando SandboxManager...');
    await sandboxManager.shutdown();
  }
});

export default router;