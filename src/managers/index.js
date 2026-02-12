/**
 * Managers Index - ChatBot Enterprise
 * 
 * Este archivo centraliza la exportación de todos los gestores del sistema,
 * proporcionando un punto único de acceso para importar cualquier gestor.
 * 
 * Gestores disponibles:
 * - BackupManager: Sistema de respaldos automáticos y manuales
 * - ContactsManager: Gestión completa de contactos
 * - ContextManager: Gestión de memoria conversacional
 * - StatsManager: Sistema de métricas y estadísticas
 * - ErrorManager: Sistema de captura centralizada de errores
 * - ConversationFlowManager: Gestión de flujos de conversación
 * - ModuleCommunicator: Comunicación entre módulos
 * - UniversalLogger: Sistema universal de logging y monitoreo
 * 
 * @author Sistema Chat Bot v5.0.0
 * @version 1.0.0
 */

// Importación de gestores
import backupManager from './backup_manager.js';
import ContactsManager from './contacts_manager.js';
import contextManager from './context_manager.js';
import statsManager from './stats_manager.js';
import errorManager from './error_manager.js';
import conversationFlowManager from './conversation_flow_manager.js';
import moduleCommunicator from './module_communicator.js';
import universalLogger from './universal_logger.js';

/**
 * Exportación por defecto de todos los gestores
 */
export default {
  backupManager,
  ContactsManager,
  contextManager,
  statsManager,
  errorManager,
  conversationFlowManager,
  moduleCommunicator,
  universalLogger
};

/**
 * Exportaciones nombradas para importación selectiva
 */
export {
  backupManager,
  ContactsManager,
  contextManager,
  statsManager,
  errorManager,
  conversationFlowManager,
  moduleCommunicator,
  universalLogger
};

/**
 * Función de inicialización de todos los gestores
 * 
 * @param {Object} config - Configuración global
 * @returns {Promise<Object>} - Estado de inicialización
 */
export async function initializeAllManagers(config = {}) {
  const results = {};
    
  try {
    // Inicializar gestores que requieren inicialización
    if (typeof backupManager.initialize === 'function') {
      results.backupManager = await backupManager.initialize();
    }
        
    if (typeof contextManager.initialize === 'function') {
      results.contextManager = await contextManager.initialize();
    }
        
    if (typeof statsManager.initialize === 'function') {
      results.statsManager = await statsManager.initialize();
    }
        
    if (typeof errorManager.initializeErrorManager === 'function') {
      results.errorManager = await errorManager.initializeErrorManager();
    }
        
    if (typeof universalLogger.initialize === 'function') {
      results.universalLogger = await universalLogger.initialize();
    }
        
    return {
      success: true,
      message: 'Todos los gestores inicializados correctamente',
      results
    };
        
  } catch (error) {
    return {
      success: false,
      message: 'Error al inicializar gestores',
      error: error.message,
      results
    };
  }
}

/**
 * Función de cierre de todos los gestores
 * 
 * @returns {Promise<Object>} - Estado de cierre
 */
export async function shutdownAllManagers() {
  const results = {};
    
  try {
    // Cerrar gestores que requieren cierre
    if (typeof backupManager.shutdown === 'function') {
      results.backupManager = await backupManager.shutdown();
    }
        
    if (typeof contextManager.shutdown === 'function') {
      results.contextManager = await contextManager.shutdown();
    }
        
    if (typeof statsManager.shutdown === 'function') {
      results.statsManager = await statsManager.shutdown();
    }
        
    if (typeof errorManager.shutdown === 'function') {
      results.errorManager = await errorManager.shutdown();
    }
        
    if (typeof universalLogger.shutdown === 'function') {
      results.universalLogger = await universalLogger.shutdown();
    }
        
    return {
      success: true,
      message: 'Todos los gestores cerrados correctamente',
      results
    };
        
  } catch (error) {
    return {
      success: false,
      message: 'Error al cerrar gestores',
      error: error.message,
      results
    };
  }
}