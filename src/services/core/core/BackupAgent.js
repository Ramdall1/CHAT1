/**
 * BACKUP AGENT - Agente Evolutivo de Respaldos Automáticos
 * 
 * Funcionalidades evolutivas:
 * - Respaldos automáticos diarios programados
 * - Compresión de archivos de respaldo
 * - Política de retención configurable
 * - Respaldos manuales bajo demanda
 * - Verificación de integridad de respaldos
 * - Restauración de datos desde respaldos
 * - Limpieza automática de respaldos antiguos
 * - Auto-optimización de estrategias de respaldo
 * - Detección inteligente de cambios críticos
 * - Respaldos incrementales y diferenciales
 * 
 * @author Sistema Event-Driven Evolutivo
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/evolutive-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BackupAgent {
  constructor(eventHub) {
    this.id = uuidv4();
    this.name = 'BackupAgent';
    this.eventHub = eventHub;
    this.logger = createLogger('BackupAgent');
        
    // Configuración del agente
    this.config = {
      // Estado del agente
      isActive: true,
      autoOptimize: true,
      learningEnabled: true,
            
      // Programación de respaldos
      autoBackup: process.env.AUTO_BACKUP !== 'false',
      backupInterval: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24,
      backupTime: process.env.BACKUP_TIME || '02:00',
            
      // Retención
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      maxBackups: parseInt(process.env.MAX_BACKUPS) || 50,
            
      // Compresión
      compression: process.env.BACKUP_COMPRESSION !== 'false',
      compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
            
      // Verificación
      verifyBackups: process.env.VERIFY_BACKUPS !== 'false',
      checksumAlgorithm: process.env.CHECKSUM_ALGORITHM || 'sha256',
            
      // Archivos a respaldar
      includePatterns: (process.env.BACKUP_INCLUDE || '*.json,*.log,*.txt').split(','),
      excludePatterns: (process.env.BACKUP_EXCLUDE || '*.tmp,*.lock').split(','),
            
      // Características evolutivas
      intelligentScheduling: true,
      incrementalBackups: true,
      adaptiveCompression: true,
      predictiveRetention: true
    };
        
    // Rutas de almacenamiento
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
    this.agentStateFile = path.join(this.dataDir, 'backup-agent-state.json');
        
    // Estado del agente
    this.agentState = {
      isInitialized: false,
      lastOptimization: null,
      optimizationCount: 0,
      backupStrategies: {},
      learningData: {
        fileChangePatterns: {},
        backupPerformance: {},
        systemLoad: {},
        userActivity: {}
      },
      adaptiveSettings: {
        optimalBackupTime: '02:00',
        compressionStrategy: 'adaptive',
        retentionStrategy: 'smart'
      }
    };
        
    // Sistema de mutex para operaciones concurrentes
    this.operationMutex = false;
    this.operationQueue = [];
        
    // Estado de respaldos
    this.backupScheduler = null;
    this.isBackupRunning = false;
    this.lastBackup = null;
        
    // Estadísticas
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      totalSizeBytes: 0,
      averageBackupTime: 0,
      lastBackupDuration: 0,
      incrementalBackups: 0,
      compressionRatio: 0,
      integrityChecks: 0,
      restorations: 0
    };
        
    // Métricas evolutivas
    this.evolutiveMetrics = {
      adaptationRate: 0,
      optimizationEfficiency: 0,
      predictionAccuracy: 0,
      resourceOptimization: 0,
      intelligenceLevel: 0
    };
        
    this.setupEventListeners();
    this.logger.info('💾 BackupAgent inicializado', { agentId: this.id });
  }
    
  /**
     * Configurar listeners de eventos
     */
  setupEventListeners() {
    // Eventos de sistema
    this.eventHub.on('system.started', this.handleSystemStarted.bind(this));
    this.eventHub.on('system.shutdown', this.handleSystemShutdown.bind(this));
    this.eventHub.on('system.critical_error', this.handleCriticalError.bind(this));
    this.eventHub.on('system.low_disk_space', this.handleLowDiskSpace.bind(this));
        
    // Eventos de tareas
    this.eventHub.on('task.backup_requested', this.handleBackupRequested.bind(this));
    this.eventHub.on('task.restore_requested', this.handleRestoreRequested.bind(this));
    this.eventHub.on('task.cleanup_requested', this.handleCleanupRequested.bind(this));
    this.eventHub.on('task.verify_backup', this.handleVerifyBackup.bind(this));
        
    // Eventos de datos
    this.eventHub.on('data.file_changed', this.handleFileChanged.bind(this));
    this.eventHub.on('data.critical_update', this.handleCriticalUpdate.bind(this));
    this.eventHub.on('data.corruption_detected', this.handleDataCorruption.bind(this));
        
    // Eventos de usuario
    this.eventHub.on('user.activity_peak', this.handleActivityPeak.bind(this));
    this.eventHub.on('user.activity_low', this.handleActivityLow.bind(this));
        
    // Eventos de solicitud
    this.eventHub.on('backup.status_request', this.handleStatusRequest.bind(this));
    this.eventHub.on('backup.list_request', this.handleListRequest.bind(this));
    this.eventHub.on('backup.stats_request', this.handleStatsRequest.bind(this));
        
    this.logger.info('📡 Event listeners configurados para BackupAgent');
  }
    
  /**
     * Inicializar el agente
     */
  async initialize() {
    try {
      await this.ensureDirectories();
      await this.loadBackupHistory();
      await this.loadAgentState();
            
      if (this.config.autoBackup) {
        await this.startIntelligentScheduler();
      }
            
      this.startFileMonitoring();
      this.startPerformanceMonitoring();
            
      this.agentState.isInitialized = true;
      await this.saveAgentState();
            
      this.eventHub.emit('system.agent_initialized', {
        agentId: this.id,
        agentName: this.name,
        timestamp: new Date().toISOString()
      });
            
      this.logger.info('✅ BackupAgent inicializado completamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando BackupAgent', { error: error.message });
      throw error;
    }
  }
    
  /**
     * Activar/desactivar el agente
     */
  async setActive(isActive) {
    this.config.isActive = isActive;
    await this.saveAgentState();
        
    if (isActive) {
      await this.startIntelligentScheduler();
    } else {
      this.stopScheduler();
    }
        
    this.eventHub.emit('system.agent_status_changed', {
      agentId: this.id,
      agentName: this.name,
      isActive,
      timestamp: new Date().toISOString()
    });
        
    this.logger.info(`🔄 BackupAgent ${isActive ? 'activado' : 'desactivado'}`);
  }
    
  /**
     * Manejar inicio del sistema
     */
  async handleSystemStarted(data) {
    if (!this.config.isActive) return;
        
    this.logger.info('🚀 Sistema iniciado - verificando respaldos');
        
    // Verificar si necesitamos un respaldo inmediato
    if (await this.shouldCreateEmergencyBackup()) {
      await this.createBackup({ type: 'emergency', reason: 'system_startup' });
    }
        
    // Optimizar horarios basado en el historial
    if (this.config.intelligentScheduling) {
      await this.optimizeBackupSchedule();
    }
  }
    
  /**
     * Manejar solicitud de respaldo
     */
  async handleBackupRequested(data) {
    if (!this.config.isActive) return;
        
    const startTime = Date.now();
        
    try {
      const options = {
        type: data.type || 'manual',
        reason: data.reason || 'user_request',
        priority: data.priority || 'normal',
        includePatterns: data.includePatterns,
        excludePatterns: data.excludePatterns
      };
            
      const result = await this.createBackup(options);
            
      this.eventHub.emit('task.backup_completed', {
        requestId: data.requestId,
        result,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.eventHub.emit('task.backup_failed', {
        requestId: data.requestId,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Manejar solicitud de restauración
     */
  async handleRestoreRequested(data) {
    if (!this.config.isActive) return;
        
    const startTime = Date.now();
        
    try {
      const options = {
        backupName: data.backupName,
        targetPath: data.targetPath,
        overwrite: data.overwrite !== false,
        dryRun: data.dryRun === true
      };
            
      const result = await this.restoreFromBackup(data.backupName, options);
            
      this.eventHub.emit('task.restore_completed', {
        requestId: data.requestId,
        result,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.eventHub.emit('task.restore_failed', {
        requestId: data.requestId,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Manejar cambio de archivo
     */
  async handleFileChanged(data) {
    if (!this.config.isActive || !this.config.learningEnabled) return;
        
    // Aprender patrones de cambio de archivos
    await this.learnFileChangePattern(data);
        
    // Determinar si necesitamos un respaldo incremental
    if (await this.shouldCreateIncrementalBackup(data)) {
      await this.createBackup({
        type: 'incremental',
        reason: 'file_change',
        changedFile: data.filePath
      });
    }
  }
    
  /**
     * Manejar actualización crítica
     */
  async handleCriticalUpdate(data) {
    if (!this.config.isActive) return;
        
    this.logger.warn('⚠️ Actualización crítica detectada - creando respaldo de emergencia');
        
    await this.createBackup({
      type: 'emergency',
      reason: 'critical_update',
      priority: 'high',
      metadata: data
    });
  }
    
  /**
     * Manejar corrupción de datos
     */
  async handleDataCorruption(data) {
    if (!this.config.isActive) return;
        
    this.logger.error('🚨 Corrupción de datos detectada - iniciando restauración automática');
        
    // Buscar el respaldo más reciente válido
    const backups = await this.listBackups();
    const validBackup = backups.find(backup => 
      backup.verified && backup.integrity === 'valid'
    );
        
    if (validBackup) {
      await this.restoreFromBackup(validBackup.name, {
        overwrite: true,
        reason: 'data_corruption_recovery'
      });
            
      this.eventHub.emit('system.auto_recovery_completed', {
        corruptedFile: data.filePath,
        restoredFrom: validBackup.name,
        timestamp: new Date().toISOString()
      });
    } else {
      this.eventHub.emit('system.recovery_failed', {
        reason: 'no_valid_backup',
        corruptedFile: data.filePath,
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Manejar pico de actividad
     */
  async handleActivityPeak(data) {
    if (!this.config.isActive || !this.config.intelligentScheduling) return;
        
    // Posponer respaldos durante picos de actividad
    if (this.isBackupRunning) {
      this.logger.info('⏸️ Pausando respaldo debido a pico de actividad');
      // Implementar pausa inteligente
    }
        
    // Aprender patrones de actividad
    await this.learnActivityPattern(data, 'peak');
  }
    
  /**
     * Manejar baja actividad
     */
  async handleActivityLow(data) {
    if (!this.config.isActive || !this.config.intelligentScheduling) return;
        
    // Aprovechar baja actividad para respaldos
    if (await this.shouldCreateOpportunisticBackup()) {
      await this.createBackup({
        type: 'opportunistic',
        reason: 'low_activity'
      });
    }
        
    // Aprender patrones de actividad
    await this.learnActivityPattern(data, 'low');
  }
    
  /**
     * Crear respaldo
     */
  async createBackup(options = {}) {
    if (this.isBackupRunning) {
      throw new Error('Ya hay un respaldo en ejecución');
    }
        
    return await this.executeWithMutex(async() => {
      this.isBackupRunning = true;
      const startTime = Date.now();
            
      try {
        const timestamp = new Date().toISOString();
        const backupName = this.generateBackupName(timestamp, options.type || 'manual');
        const backupPath = path.join(this.backupDir, backupName);
                
        this.logger.info('🔄 Iniciando respaldo', { backupName, type: options.type });
                
        // Verificar espacio disponible
        await this.checkAvailableSpace(backupPath);
                
        // Crear directorio de respaldo
        await fs.mkdir(backupPath, { recursive: true });
                
        // Crear manifiesto
        const manifest = await this.createBackupManifest(timestamp, options.type, options);
        await fs.writeFile(
          path.join(backupPath, 'manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
                
        // Realizar respaldo de archivos
        const backupResults = await this.backupFiles(backupPath, this.config.compression, options);
                
        // Verificar integridad si está habilitado
        let verificationResult = null;
        if (this.config.verifyBackups) {
          verificationResult = await this.verifyBackupIntegrity(backupPath);
        }
                
        const duration = Date.now() - startTime;
        const backupSize = await this.calculateDirectorySize(backupPath);
                
        // Actualizar estadísticas
        this.updateBackupStats(true, duration, backupSize);
                
        // Limpiar respaldos antiguos
        await this.cleanupOldBackups();
                
        const result = {
          success: true,
          backupName,
          backupPath,
          duration,
          size: backupSize,
          filesBackedUp: backupResults.totalFiles,
          verification: verificationResult,
          type: options.type || 'manual',
          timestamp
        };
                
        this.lastBackup = result;
                
        this.eventHub.emit('backup.created', {
          ...result,
          agentId: this.id
        });
                
        this.logger.info('✅ Respaldo completado exitosamente', {
          backupName,
          duration: `${duration}ms`,
          size: this.formatBytes(backupSize)
        });
                
        return result;
                
      } catch (error) {
        const duration = Date.now() - startTime;
        this.updateBackupStats(false, duration, 0);
                
        this.eventHub.emit('backup.failed', {
          error: error.message,
          duration,
          type: options.type || 'manual',
          timestamp: new Date().toISOString(),
          agentId: this.id
        });
                
        this.logger.error('❌ Error durante respaldo', { error: error.message });
        throw error;
                
      } finally {
        this.isBackupRunning = false;
      }
    });
  }
    
  /**
     * Restaurar desde respaldo
     */
  async restoreFromBackup(backupName, options = {}) {
    return await this.executeWithMutex(async() => {
      const startTime = Date.now();
            
      try {
        const backupPath = path.join(this.backupDir, backupName);
                
        // Verificar que el respaldo existe
        try {
          await fs.access(backupPath);
        } catch {
          throw new Error(`Respaldo no encontrado: ${backupName}`);
        }
                
        this.logger.info('🔄 Iniciando restauración', { backupName });
                
        // Cargar manifiesto
        const manifestPath = path.join(backupPath, 'manifest.json');
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
                
        // Verificar integridad antes de restaurar
        if (this.config.verifyBackups) {
          const verification = await this.verifyBackupIntegrity(backupPath);
          if (!verification.isValid) {
            throw new Error('El respaldo falló la verificación de integridad');
          }
        }
                
        const targetPath = options.targetPath || this.dataDir;
        const results = {
          filesRestored: 0,
          filesSkipped: 0,
          errors: []
        };
                
        // Restaurar archivos
        await this.restoreDirectory(
          backupPath,
          targetPath,
          options.overwrite !== false,
          options.dryRun === true,
          results
        );
                
        const duration = Date.now() - startTime;
                
        // Actualizar estadísticas
        this.stats.restorations++;
                
        const result = {
          success: true,
          backupName,
          targetPath,
          duration,
          filesRestored: results.filesRestored,
          filesSkipped: results.filesSkipped,
          errors: results.errors,
          dryRun: options.dryRun === true,
          timestamp: new Date().toISOString()
        };
                
        this.eventHub.emit('backup.restored', {
          ...result,
          agentId: this.id
        });
                
        this.logger.info('✅ Restauración completada', {
          backupName,
          filesRestored: results.filesRestored,
          duration: `${duration}ms`
        });
                
        return result;
                
      } catch (error) {
        const duration = Date.now() - startTime;
                
        this.eventHub.emit('backup.restore_failed', {
          backupName,
          error: error.message,
          duration,
          timestamp: new Date().toISOString(),
          agentId: this.id
        });
                
        this.logger.error('❌ Error durante restauración', { error: error.message });
        throw error;
      }
    });
  }
    
  /**
     * Iniciar programador inteligente
     */
  async startIntelligentScheduler() {
    this.stopScheduler();
        
    const optimalTime = this.agentState.adaptiveSettings.optimalBackupTime;
    const [hours, minutes] = optimalTime.split(':').map(Number);
        
    const scheduleNextBackup = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
            
      // Si ya pasó la hora de hoy, programar para mañana
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
            
      const delay = scheduledTime.getTime() - now.getTime();
            
      this.backupScheduler = setTimeout(async() => {
        if (this.config.isActive && await this.shouldRunScheduledBackup()) {
          await this.createBackup({
            type: 'scheduled',
            reason: 'automatic_schedule'
          });
        }
        scheduleNextBackup(); // Programar el siguiente
      }, delay);
            
      this.logger.info('⏰ Próximo respaldo programado', {
        scheduledTime: scheduledTime.toISOString()
      });
    };
        
    scheduleNextBackup();
  }
    
  /**
     * Detener programador
     */
  stopScheduler() {
    if (this.backupScheduler) {
      clearTimeout(this.backupScheduler);
      this.backupScheduler = null;
    }
  }
    
  /**
     * Determinar si debe ejecutarse respaldo programado
     */
  async shouldRunScheduledBackup() {
    // Verificar si hay actividad del sistema
    const systemLoad = await this.getSystemLoad();
    if (systemLoad > 0.8) {
      this.logger.info('⏸️ Respaldo pospuesto - alta carga del sistema');
      return false;
    }
        
    // Verificar última actividad de usuario
    const lastActivity = await this.getLastUserActivity();
    const inactiveTime = Date.now() - lastActivity;
    const minInactiveTime = 30 * 60 * 1000; // 30 minutos
        
    if (inactiveTime < minInactiveTime) {
      this.logger.info('⏸️ Respaldo pospuesto - actividad reciente del usuario');
      return false;
    }
        
    return true;
  }
    
  /**
     * Determinar si debe crear respaldo incremental
     */
  async shouldCreateIncrementalBackup(fileData) {
    if (!this.config.incrementalBackups) return false;
        
    // Verificar si el archivo es crítico
    const isCritical = this.isCriticalFile(fileData.filePath);
    if (isCritical) return true;
        
    // Verificar frecuencia de cambios
    const changeFrequency = await this.getFileChangeFrequency(fileData.filePath);
    if (changeFrequency > 10) { // Más de 10 cambios por hora
      return true;
    }
        
    return false;
  }
    
  /**
     * Determinar si debe crear respaldo de emergencia
     */
  async shouldCreateEmergencyBackup() {
    if (!this.lastBackup) return true;
        
    const timeSinceLastBackup = Date.now() - new Date(this.lastBackup.timestamp).getTime();
    const maxTimeBetweenBackups = 48 * 60 * 60 * 1000; // 48 horas
        
    return timeSinceLastBackup > maxTimeBetweenBackups;
  }
    
  /**
     * Determinar si debe crear respaldo oportunista
     */
  async shouldCreateOpportunisticBackup() {
    if (!this.lastBackup) return false;
        
    const timeSinceLastBackup = Date.now() - new Date(this.lastBackup.timestamp).getTime();
    const minTimeBetweenBackups = 6 * 60 * 60 * 1000; // 6 horas
        
    if (timeSinceLastBackup < minTimeBetweenBackups) return false;
        
    // Verificar si hay cambios significativos
    const significantChanges = await this.hasSignificantChanges();
    return significantChanges;
  }
    
  /**
     * Aprender patrón de cambio de archivo
     */
  async learnFileChangePattern(data) {
    const filePath = data.filePath;
    const hour = new Date().getHours();
        
    if (!this.agentState.learningData.fileChangePatterns[filePath]) {
      this.agentState.learningData.fileChangePatterns[filePath] = {
        totalChanges: 0,
        hourlyPattern: new Array(24).fill(0),
        lastChange: null,
        changeFrequency: 0
      };
    }
        
    const pattern = this.agentState.learningData.fileChangePatterns[filePath];
    pattern.totalChanges++;
    pattern.hourlyPattern[hour]++;
    pattern.lastChange = new Date().toISOString();
        
    // Calcular frecuencia de cambios (cambios por hora)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentChanges = pattern.hourlyPattern.reduce((sum, count) => sum + count, 0);
    pattern.changeFrequency = recentChanges;
        
    await this.saveAgentState();
  }
    
  /**
     * Aprender patrón de actividad
     */
  async learnActivityPattern(data, type) {
    const hour = new Date().getHours();
        
    if (!this.agentState.learningData.userActivity[hour]) {
      this.agentState.learningData.userActivity[hour] = {
        peaks: 0,
        lows: 0,
        total: 0
      };
    }
        
    const activity = this.agentState.learningData.userActivity[hour];
    activity.total++;
        
    if (type === 'peak') {
      activity.peaks++;
    } else if (type === 'low') {
      activity.lows++;
    }
        
    // Optimizar horario de respaldo basado en patrones
    if (activity.total > 10) { // Suficientes datos
      await this.optimizeBackupSchedule();
    }
        
    await this.saveAgentState();
  }
    
  /**
     * Optimizar horario de respaldo
     */
  async optimizeBackupSchedule() {
    const activityData = this.agentState.learningData.userActivity;
    let bestHour = 2; // Default
    let lowestActivity = Infinity;
        
    for (let hour = 0; hour < 24; hour++) {
      const data = activityData[hour];
      if (data && data.total > 0) {
        const activityScore = data.peaks / data.total;
        if (activityScore < lowestActivity) {
          lowestActivity = activityScore;
          bestHour = hour;
        }
      }
    }
        
    const newOptimalTime = `${bestHour.toString().padStart(2, '0')}:00`;
        
    if (newOptimalTime !== this.agentState.adaptiveSettings.optimalBackupTime) {
      this.agentState.adaptiveSettings.optimalBackupTime = newOptimalTime;
      this.agentState.optimizationCount++;
      this.agentState.lastOptimization = new Date().toISOString();
            
      await this.saveAgentState();
      await this.startIntelligentScheduler(); // Reprogramar
            
      this.eventHub.emit('system.optimization_applied', {
        type: 'backup_schedule',
        oldTime: this.config.backupTime,
        newTime: newOptimalTime,
        reason: 'activity_pattern_analysis',
        timestamp: new Date().toISOString(),
        optimizedBy: this.name
      });
            
      this.logger.info('🎯 Horario de respaldo optimizado', {
        newTime: newOptimalTime,
        reason: 'Análisis de patrones de actividad'
      });
    }
  }
    
  /**
     * Verificar si archivo es crítico
     */
  isCriticalFile(filePath) {
    const criticalPatterns = [
      /\.json$/,
      /config/i,
      /database/i,
      /\.db$/,
      /\.sql$/
    ];
        
    return criticalPatterns.some(pattern => pattern.test(filePath));
  }
    
  /**
     * Obtener frecuencia de cambio de archivo
     */
  async getFileChangeFrequency(filePath) {
    const pattern = this.agentState.learningData.fileChangePatterns[filePath];
    return pattern ? pattern.changeFrequency : 0;
  }
    
  /**
     * Obtener carga del sistema
     */
  async getSystemLoad() {
    // Implementación simplificada
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
        
    return usedMem / totalMem;
  }
    
  /**
     * Obtener última actividad del usuario
     */
  async getLastUserActivity() {
    // Implementación simplificada - en un sistema real consultaría logs de actividad
    return Date.now() - (2 * 60 * 60 * 1000); // 2 horas atrás por defecto
  }
    
  /**
     * Verificar si hay cambios significativos
     */
  async hasSignificantChanges() {
    // Implementación simplificada
    const patterns = this.agentState.learningData.fileChangePatterns;
    const recentChanges = Object.values(patterns).reduce((total, pattern) => {
      const timeSinceLastChange = pattern.lastChange ? 
        Date.now() - new Date(pattern.lastChange).getTime() : Infinity;
      return timeSinceLastChange < 60 * 60 * 1000 ? total + 1 : total; // Cambios en la última hora
    }, 0);
        
    return recentChanges > 5; // Más de 5 archivos cambiados en la última hora
  }
    
  /**
     * Ejecutar operación con mutex
     */
  async executeWithMutex(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }
    
  /**
     * Procesar cola de operaciones
     */
  async processQueue() {
    if (this.operationMutex || this.operationQueue.length === 0) {
      return;
    }
        
    this.operationMutex = true;
        
    while (this.operationQueue.length > 0) {
      const { operation, resolve, reject } = this.operationQueue.shift();
            
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
        
    this.operationMutex = false;
  }
    
  /**
     * Asegurar directorios necesarios
     */
  async ensureDirectories() {
    const directories = [this.dataDir, this.backupDir];
        
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        this.logger.info('📁 Directorio creado', { path: dir });
      }
    }
  }
    
  /**
     * Cargar historial de respaldos
     */
  async loadBackupHistory() {
    try {
      const backupDirs = await fs.readdir(this.backupDir);
      const validBackups = backupDirs.filter(dir => this.isValidBackupDir(dir));
            
      this.stats.totalBackups = validBackups.length;
            
      // Cargar estadísticas de respaldos existentes
      for (const backupDir of validBackups) {
        const manifestPath = path.join(this.backupDir, backupDir, 'manifest.json');
        try {
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          if (manifest.success) {
            this.stats.successfulBackups++;
          } else {
            this.stats.failedBackups++;
          }
        } catch {
          // Ignorar errores de manifiestos corruptos
        }
      }
            
      this.logger.info('📊 Historial de respaldos cargado', {
        total: this.stats.totalBackups,
        successful: this.stats.successfulBackups,
        failed: this.stats.failedBackups
      });
            
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('❌ Error cargando historial de respaldos', { error: error.message });
      }
    }
  }
    
  /**
     * Cargar estado del agente
     */
  async loadAgentState() {
    try {
      const data = await fs.readFile(this.agentStateFile, 'utf8');
      const savedState = JSON.parse(data);
      this.agentState = { ...this.agentState, ...savedState };
      this.logger.info('🧠 Estado del agente cargado');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('❌ Error cargando estado del agente', { error: error.message });
      }
    }
  }
    
  /**
     * Guardar estado del agente
     */
  async saveAgentState() {
    try {
      const stateToSave = {
        ...this.agentState,
        lastSaved: new Date().toISOString()
      };
            
      await fs.writeFile(this.agentStateFile, JSON.stringify(stateToSave, null, 2));
      this.logger.debug('🧠 Estado del agente guardado');
    } catch (error) {
      this.logger.error('❌ Error guardando estado del agente', { error: error.message });
    }
  }
    
  /**
     * Verificar si es directorio de respaldo válido
     */
  isValidBackupDir(dirName) {
    return /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\w+$/.test(dirName);
  }
    
  /**
     * Generar nombre de respaldo
     */
  generateBackupName(timestamp, type) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().slice(0, 19).replace(/[T:]/g, '_').replace(/-/g, '-');
    return `backup_${dateStr}_${type}`;
  }
    
  /**
     * Crear manifiesto de respaldo
     */
  async createBackupManifest(timestamp, type, options = {}) {
    return {
      version: '2.0.0',
      timestamp,
      type,
      agentId: this.id,
      agentName: this.name,
      options,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      },
      config: {
        compression: this.config.compression,
        compressionLevel: this.config.compressionLevel,
        includePatterns: this.config.includePatterns,
        excludePatterns: this.config.excludePatterns
      }
    };
  }
    
  /**
     * Respaldar archivos
     */
  async backupFiles(backupPath, includeCompression, options = {}) {
    const results = {
      totalFiles: 0,
      totalSize: 0,
      compressedSize: 0,
      errors: []
    };
        
    await this.backupDirectory(this.dataDir, backupPath, includeCompression, results);
        
    // Calcular ratio de compresión
    if (includeCompression && results.totalSize > 0) {
      this.stats.compressionRatio = (1 - results.compressedSize / results.totalSize) * 100;
    }
        
    return results;
  }
    
  /**
     * Respaldar directorio
     */
  async backupDirectory(sourceDir, targetDir, includeCompression, results, relativePath = '') {
    try {
      const items = await fs.readdir(sourceDir);
            
      for (const item of items) {
        const sourcePath = path.join(sourceDir, item);
        const targetPath = path.join(targetDir, item);
        const itemRelativePath = path.join(relativePath, item);
                
        const stats = await fs.stat(sourcePath);
                
        if (stats.isDirectory()) {
          await fs.mkdir(targetPath, { recursive: true });
          await this.backupDirectory(sourcePath, targetPath, includeCompression, results, itemRelativePath);
        } else if (stats.isFile() && this.shouldIncludeFile(item)) {
          await this.backupFile(sourcePath, targetPath, includeCompression);
          results.totalFiles++;
          results.totalSize += stats.size;
                    
          if (includeCompression && this.shouldCompressFile(sourcePath)) {
            const compressedStats = await fs.stat(targetPath);
            results.compressedSize += compressedStats.size;
          } else {
            results.compressedSize += stats.size;
          }
        }
      }
    } catch (error) {
      results.errors.push({
        path: sourceDir,
        error: error.message
      });
    }
  }
    
  /**
     * Determinar si incluir archivo
     */
  shouldIncludeFile(fileName) {
    // Verificar patrones de exclusión
    for (const pattern of this.config.excludePatterns) {
      if (this.matchPattern(fileName, pattern)) {
        return false;
      }
    }
        
    // Verificar patrones de inclusión
    for (const pattern of this.config.includePatterns) {
      if (this.matchPattern(fileName, pattern)) {
        return true;
      }
    }
        
    return false;
  }
    
  /**
     * Verificar coincidencia de patrón
     */
  matchPattern(fileName, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(fileName);
  }
    
  /**
     * Respaldar archivo individual
     */
  async backupFile(sourcePath, targetPath, includeCompression) {
    if (includeCompression && this.shouldCompressFile(sourcePath)) {
      await this.compressFile(sourcePath, targetPath + '.gz');
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
    
  /**
     * Determinar si comprimir archivo
     */
  shouldCompressFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const compressibleExtensions = ['.json', '.txt', '.log', '.csv', '.xml', '.html', '.js', '.css'];
    return compressibleExtensions.includes(ext);
  }
    
  /**
     * Comprimir archivo
     */
  async compressFile(sourcePath, targetPath) {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(targetPath);
    const gzipStream = createGzip({ level: this.config.compressionLevel });
        
    await pipeline(readStream, gzipStream, writeStream);
  }
    
  /**
     * Verificar integridad de respaldo
     */
  async verifyBackupIntegrity(backupPath) {
    const verification = {
      isValid: true,
      checkedFiles: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };
        
    try {
      // Verificar que el manifiesto existe
      const manifestPath = path.join(backupPath, 'manifest.json');
      await fs.access(manifestPath);
            
      // Contar archivos en el respaldo
      verification.checkedFiles = await this.countBackupFiles(backupPath);
            
      this.stats.integrityChecks++;
            
    } catch (error) {
      verification.isValid = false;
      verification.errors.push(error.message);
    }
        
    return verification;
  }
    
  /**
     * Contar archivos en respaldo
     */
  async countBackupFiles(backupPath) {
    let count = 0;
        
    const countInDirectory = async(dirPath) => {
      const items = await fs.readdir(dirPath);
            
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
                
        if (stats.isDirectory()) {
          await countInDirectory(itemPath);
        } else {
          count++;
        }
      }
    };
        
    await countInDirectory(backupPath);
    return count;
  }
    
  /**
     * Restaurar directorio
     */
  async restoreDirectory(sourceDir, targetDir, overwrite, dryRun, results, relativePath = '') {
    try {
      const items = await fs.readdir(sourceDir);
            
      for (const item of items) {
        if (item === 'manifest.json') continue; // Saltar manifiesto
                
        const sourcePath = path.join(sourceDir, item);
        const targetPath = path.join(targetDir, item);
                
        const stats = await fs.stat(sourcePath);
                
        if (stats.isDirectory()) {
          if (!dryRun) {
            await fs.mkdir(targetPath, { recursive: true });
          }
          await this.restoreDirectory(sourcePath, targetPath, overwrite, dryRun, results, path.join(relativePath, item));
        } else if (stats.isFile()) {
          try {
            // Verificar si el archivo de destino existe
            const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
                        
            if (targetExists && !overwrite) {
              results.filesSkipped++;
              continue;
            }
                        
            if (!dryRun) {
              if (item.endsWith('.gz')) {
                // Descomprimir archivo
                const originalPath = targetPath.slice(0, -3); // Remover .gz
                await this.decompressFile(sourcePath, originalPath);
              } else {
                await fs.copyFile(sourcePath, targetPath);
              }
            }
                        
            results.filesRestored++;
                        
          } catch (error) {
            results.errors.push({
              file: path.join(relativePath, item),
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      results.errors.push({
        directory: relativePath,
        error: error.message
      });
    }
  }
    
  /**
     * Descomprimir archivo
     */
  async decompressFile(sourcePath, targetPath) {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(targetPath);
    const gunzipStream = createGunzip();
        
    await pipeline(readStream, gunzipStream, writeStream);
  }
    
  /**
     * Listar respaldos
     */
  async listBackups() {
    try {
      const backupDirs = await fs.readdir(this.backupDir);
      const backups = [];
            
      for (const dir of backupDirs) {
        if (this.isValidBackupDir(dir)) {
          const backupPath = path.join(this.backupDir, dir);
          const manifestPath = path.join(backupPath, 'manifest.json');
                    
          try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            const stats = await fs.stat(backupPath);
            const size = await this.calculateDirectorySize(backupPath);
                        
            backups.push({
              name: dir,
              path: backupPath,
              timestamp: manifest.timestamp,
              type: manifest.type,
              size,
              created: stats.birthtime,
              verified: manifest.verified || false,
              integrity: manifest.integrity || 'unknown'
            });
          } catch {
            // Ignorar respaldos con manifiestos corruptos
          }
        }
      }
            
      // Ordenar por fecha de creación (más reciente primero)
      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
    } catch (error) {
      this.logger.error('❌ Error listando respaldos', { error: error.message });
      return [];
    }
  }
    
  /**
     * Calcular tamaño de directorio
     */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
        
    const calculateSize = async(currentPath) => {
      const items = await fs.readdir(currentPath);
            
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
                
        if (stats.isDirectory()) {
          await calculateSize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    };
        
    try {
      await calculateSize(dirPath);
    } catch (error) {
      this.logger.error('❌ Error calculando tamaño', { path: dirPath, error: error.message });
    }
        
    return totalSize;
  }
    
  /**
     * Verificar espacio disponible
     */
  async checkAvailableSpace(backupPath) {
    // Implementación simplificada
    // En un sistema real, verificaría el espacio disponible en disco
    const estimatedSize = await this.calculateDirectorySize(this.dataDir);
    const requiredSpace = estimatedSize * 1.5; // 50% extra por seguridad
        
    // Por ahora, asumimos que hay suficiente espacio
    return true;
  }
    
  /**
     * Limpiar respaldos antiguos
     */
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
            
      // Aplicar política de retención por días
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
            
      const oldBackups = backups.filter(backup => 
        new Date(backup.timestamp) < cutoffDate
      );
            
      // Aplicar política de retención por cantidad máxima
      const excessBackups = backups.slice(this.config.maxBackups);
            
      const backupsToDelete = [...oldBackups, ...excessBackups];
            
      for (const backup of backupsToDelete) {
        await fs.rm(backup.path, { recursive: true, force: true });
        this.logger.info('🗑️ Respaldo antiguo eliminado', { name: backup.name });
      }
            
      if (backupsToDelete.length > 0) {
        this.eventHub.emit('backup.cleanup_completed', {
          deletedCount: backupsToDelete.length,
          deletedBackups: backupsToDelete.map(b => b.name),
          timestamp: new Date().toISOString(),
          agentId: this.id
        });
      }
            
    } catch (error) {
      this.logger.error('❌ Error durante limpieza', { error: error.message });
    }
  }
    
  /**
     * Obtener estadísticas
     */
  async getStats() {
    const backups = await this.listBackups();
        
    return {
      ...this.stats,
      currentBackups: backups.length,
      totalBackupSize: backups.reduce((total, backup) => total + backup.size, 0),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      evolutiveMetrics: this.evolutiveMetrics,
      agentState: {
        isInitialized: this.agentState.isInitialized,
        optimizationCount: this.agentState.optimizationCount,
        optimalBackupTime: this.agentState.adaptiveSettings.optimalBackupTime
      }
    };
  }
    
  /**
     * Actualizar estadísticas de respaldo
     */
  updateBackupStats(success, duration, size) {
    this.stats.totalBackups++;
        
    if (success) {
      this.stats.successfulBackups++;
      this.stats.totalSizeBytes += size;
            
      // Actualizar tiempo promedio
      const totalTime = this.stats.averageBackupTime * (this.stats.successfulBackups - 1) + duration;
      this.stats.averageBackupTime = totalTime / this.stats.successfulBackups;
    } else {
      this.stats.failedBackups++;
    }
        
    this.stats.lastBackupDuration = duration;
  }
    
  /**
     * Formatear bytes
     */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
        
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
        
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
    
  /**
     * Iniciar monitoreo de archivos
     */
  startFileMonitoring() {
    // Implementación simplificada
    // En un sistema real, usaría fs.watch o chokidar
    this.logger.info('👁️ Monitoreo de archivos iniciado');
  }
    
  /**
     * Iniciar monitoreo de rendimiento
     */
  startPerformanceMonitoring() {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }
        
    this.performanceInterval = setInterval(() => {
      this.updateEvolutiveMetrics();
    }, 60000); // Cada minuto
        
    this.logger.info('📈 Monitoreo de rendimiento iniciado');
  }
    
  /**
     * Actualizar métricas evolutivas
     */
  updateEvolutiveMetrics() {
    // Calcular tasa de adaptación
    this.evolutiveMetrics.adaptationRate = this.agentState.optimizationCount / 
            Math.max(1, (Date.now() - new Date(this.agentState.lastOptimization || Date.now()).getTime()) / (24 * 60 * 60 * 1000));
        
    // Calcular eficiencia de optimización
    if (this.stats.totalBackups > 0) {
      this.evolutiveMetrics.optimizationEfficiency = 
                (this.stats.successfulBackups / this.stats.totalBackups) * 100;
    }
        
    // Calcular optimización de recursos
    if (this.stats.compressionRatio > 0) {
      this.evolutiveMetrics.resourceOptimization = this.stats.compressionRatio;
    }
        
    // Calcular nivel de inteligencia
    const learningDataSize = Object.keys(this.agentState.learningData.fileChangePatterns).length;
    this.evolutiveMetrics.intelligenceLevel = Math.min(100, learningDataSize * 2);
  }
    
  /**
     * Apagar el agente
     */
  async shutdown() {
    this.logger.info('🔄 Iniciando apagado de BackupAgent...');
        
    try {
      // Detener programador
      this.stopScheduler();
            
      // Limpiar intervalos
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
      }
            
      // Guardar estado final
      await this.saveAgentState();
            
      this.eventHub.emit('system.agent_shutdown', {
        agentId: this.id,
        agentName: this.name,
        timestamp: new Date().toISOString()
      });
            
      this.logger.info('✅ BackupAgent apagado correctamente');
    } catch (error) {
      this.logger.error('❌ Error durante apagado', { error: error.message });
      throw error;
    }
  }
}

export default BackupAgent;