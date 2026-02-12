/**
 * BACKUP MANAGER - Sistema de respaldos automáticos
 * 
 * Funcionalidades:
 * - Respaldos automáticos diarios programados
 * - Compresión de archivos de respaldo
 * - Política de retención configurable
 * - Respaldos manuales bajo demanda
 * - Verificación de integridad de respaldos
 * - Restauración de datos desde respaldos
 * - Limpieza automática de respaldos antiguos
 * 
 * @author Sistema Chat Bot v5.0.0
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createLogger } from '../services/core/core/logger.js';
import { ensureDirectories } from '../utils/directory-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BackupManager {
  constructor() {
    this.logger = createLogger('BACKUP_MANAGER');
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
    this.isInitialized = false;
        
    // Sistema de mutex para operaciones concurrentes
    this.operationMutex = false;
    this.operationQueue = [];
        
    // Configuración
    this.config = {
      // Programación de respaldos
      autoBackup: process.env.AUTO_BACKUP !== 'false',
      backupInterval: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24, // horas
      backupTime: process.env.BACKUP_TIME || '02:00', // HH:MM
            
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
      excludePatterns: (process.env.BACKUP_EXCLUDE || '*.tmp,*.lock').split(',')
    };
        
    // Estado
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
      lastBackupDuration: 0
    };
  }

  /**
     * Inicializa el gestor de respaldos
     */
  async initialize() {
    try {
      await this.ensureDirectories();
      await this.loadBackupHistory();
            
      if (this.config.autoBackup) {
        this.startBackupScheduler();
      }
            
      this.isInitialized = true;
      this.log('BackupManager inicializado correctamente');
      return { success: true, message: 'BackupManager inicializado' };
    } catch (error) {
      this.logError('Error inicializando BackupManager', error);
      throw error;
    }
  }

  /**
     * Asegura que los directorios necesarios existen
     */
  async ensureDirectories() {
    await ensureDirectories([this.dataDir, this.backupDir]);
  }

  /**
     * Carga el historial de respaldos existentes
     */
  async loadBackupHistory() {
    try {
      const backupDirs = await fs.readdir(this.backupDir);
      const validBackups = [];
            
      for (const dir of backupDirs) {
        if (this.isValidBackupDir(dir)) {
          const backupPath = path.join(this.backupDir, dir);
          const stats = await fs.stat(backupPath);
                    
          if (stats.isDirectory()) {
            validBackups.push({
              name: dir,
              path: backupPath,
              date: this.parseBackupDate(dir),
              size: await this.calculateDirectorySize(backupPath)
            });
          }
        }
      }
            
      // Ordenar por fecha
      validBackups.sort((a, b) => b.date - a.date);
            
      this.stats.totalBackups = validBackups.length;
      this.stats.totalSizeBytes = validBackups.reduce((sum, backup) => sum + backup.size, 0);
            
      if (validBackups.length > 0) {
        this.lastBackup = validBackups[0];
      }
            
      this.log(`Historial cargado: ${validBackups.length} respaldos encontrados`);
    } catch (error) {
      this.logError('Error cargando historial de respaldos', error);
    }
  }

  /**
     * Ejecuta operaciones de forma secuencial para evitar conflictos
     */
  async executeWithMutex(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
     * Procesa la cola de operaciones de forma secuencial
     */
  async processQueue() {
    if (this.operationMutex || this.operationQueue.length === 0) {
      return;
    }

    this.operationMutex = true;
    const { operation, resolve, reject } = this.operationQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.operationMutex = false;
      // Procesar siguiente operación en la cola
      if (this.operationQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
     * Verifica si un directorio es un respaldo válido
     */
  isValidBackupDir(dirName) {
    // Formato: backup_YYYYMMDD_HHMMSS_[manual|auto]
    const backupPattern = /^backup_\d{8}_\d{6}_(manual|auto)$/;
    return backupPattern.test(dirName);
  }

  /**
     * Parsea la fecha de un nombre de directorio de respaldo
     */
  parseBackupDate(dirName) {
    try {
      if (dirName.includes('_')) {
        // Formato: YYYY-MM-DD_HH-MM-SS
        const [datePart, timePart] = dirName.split('_');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split('-').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
      } else {
        // Formato: YYYY-MM-DD
        const [year, month, day] = dirName.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
    } catch (error) {
      return new Date(0);
    }
  }

  /**
     * Calcula el tamaño total de un directorio
     */
  async calculateDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const items = await fs.readdir(dirPath, { withFileTypes: true });
            
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
                
        if (item.isDirectory()) {
          totalSize += await this.calculateDirectorySize(itemPath);
        } else {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }
            
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
     * Inicia el programador de respaldos automáticos
     */
  startBackupScheduler() {
    if (this.backupScheduler) {
      clearInterval(this.backupScheduler);
    }
        
    const intervalMs = this.config.backupInterval * 60 * 60 * 1000; // horas a ms
        
    this.backupScheduler = setInterval(async() => {
      if (this.shouldRunScheduledBackup()) {
        await this.createBackup({ type: 'scheduled' });
      }
    }, 60 * 1000); // Verificar cada minuto
        
    this.log(`Programador de respaldos iniciado: cada ${this.config.backupInterval} horas`);
  }

  /**
     * Verifica si debe ejecutar un respaldo programado
     */
  shouldRunScheduledBackup() {
    const now = new Date();
    const [targetHour, targetMinute] = this.config.backupTime.split(':').map(Number);
        
    // Verificar si es la hora correcta
    const isCorrectTime = now.getHours() === targetHour && now.getMinutes() === targetMinute;
        
    // Verificar si ya se hizo respaldo hoy
    const today = now.toISOString().split('T')[0];
    const lastBackupDate = this.lastBackup ? this.lastBackup.date.toISOString().split('T')[0] : null;
    const alreadyBackedUpToday = lastBackupDate === today;
        
    return isCorrectTime && !alreadyBackedUpToday && !this.isBackupRunning;
  }

  /**
     * Crea un respaldo completo del sistema con mutex
     */
  async createBackup(options = {}) {
    if (!this.isInitialized) {
      throw new Error('BackupManager no está inicializado');
    }

    return this.executeWithMutex(async() => {
      if (this.isBackupRunning) {
        throw new Error('Ya hay un respaldo en progreso');
      }

      const startTime = Date.now();
      this.isBackupRunning = true;
      let backupPath = null;
            
      try {
        const {
          type = 'manual',
          includeCompression = this.config.compression,
          customName = null
        } = options;
                
        // Generar nombre del respaldo
        const timestamp = new Date();
        const backupName = customName || this.generateBackupName(timestamp, type);
        backupPath = path.join(this.backupDir, backupName);
                
        this.log(`Iniciando respaldo: ${backupName}`);
                
        // Verificar espacio disponible
        await this.checkAvailableSpace(backupPath);
                
        // Crear directorio de respaldo
        await fs.mkdir(backupPath, { recursive: true });
                
        // Crear manifiesto del respaldo
        const manifest = await this.createBackupManifest(timestamp, type);
        await fs.writeFile(
          path.join(backupPath, 'manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
                
        // Respaldar archivos
        const backupResults = await this.backupFiles(backupPath, includeCompression);
                
        // Verificar integridad si está habilitado
        let verificationResult = null;
        if (this.config.verifyBackups) {
          verificationResult = await this.verifyBackupIntegrity(backupPath);
          if (!verificationResult.success) {
            throw new Error(`Verificación de integridad falló: ${verificationResult.error}`);
          }
        }
                
        // Actualizar estadísticas
        const duration = Date.now() - startTime;
        this.updateBackupStats(true, duration, backupResults.totalSize);
                
        // Actualizar último respaldo
        this.lastBackup = {
          name: backupName,
          path: backupPath,
          date: timestamp,
          size: backupResults.totalSize,
          type,
          duration
        };
                
        // Limpiar respaldos antiguos
        await this.cleanupOldBackups();
                
        this.log(`Respaldo completado: ${backupName} (${this.formatBytes(backupResults.totalSize)}, ${duration}ms)`);
                
        return {
          success: true,
          backup: this.lastBackup,
          files: backupResults.files,
          duration,
          verification: verificationResult
        };
                
      } catch (error) {
        // Limpiar respaldo fallido
        if (backupPath) {
          try {
            await fs.rm(backupPath, { recursive: true, force: true });
          } catch (cleanupError) {
            this.logError('Error limpiando respaldo fallido', cleanupError);
          }
        }
                
        this.updateBackupStats(false, Date.now() - startTime, 0);
        this.logError('Error creando respaldo', error);
        throw error;
      } finally {
        this.isBackupRunning = false;
      }
    });
  }

  /**
     * Verifica el espacio disponible antes de crear respaldo
     */
  async checkAvailableSpace(backupPath) {
    try {
      // Estimar tamaño del directorio de datos
      const dataSize = await this.calculateDirectorySize(this.dataDir);
            
      // Verificar espacio disponible (requiere al menos 2x el tamaño de datos)
      const requiredSpace = dataSize * 2;
            
      // En sistemas Unix, verificar espacio disponible
      if (process.platform !== 'win32') {
        const { spawn } = await import('child_process');
        const df = spawn('df', ['-B1', path.dirname(backupPath)]);
                
        return new Promise((resolve, reject) => {
          let output = '';
          df.stdout.on('data', (data) => {
            output += data.toString();
          });
                    
          df.on('close', (code) => {
            if (code === 0) {
              const lines = output.trim().split('\n');
              if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                const availableSpace = parseInt(parts[3]);
                                
                if (availableSpace < requiredSpace) {
                  reject(new Error(`Espacio insuficiente: ${this.formatBytes(availableSpace)} disponible, ${this.formatBytes(requiredSpace)} requerido`));
                } else {
                  resolve(true);
                }
              } else {
                resolve(true); // No se pudo verificar, continuar
              }
            } else {
              resolve(true); // Error en verificación, continuar
            }
          });
        });
      }
            
      return true; // En Windows o si no se puede verificar, continuar
    } catch (error) {
      this.logError('Error verificando espacio disponible', error);
      return true; // Continuar en caso de error
    }
  }

  /**
     * Genera un nombre para el respaldo
     */
  generateBackupName(timestamp, type) {
    const date = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        
    if (type === 'scheduled') {
      return date; // Solo fecha para respaldos programados
    } else {
      return `${date}_${time}`; // Fecha y hora para respaldos manuales
    }
  }

  /**
     * Crea el manifiesto del respaldo
     */
  async createBackupManifest(timestamp, type) {
    return {
      version: '1.0.0',
      timestamp: timestamp.toISOString(),
      type,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        chatBotVersion: '5.0.0'
      },
      config: {
        compression: this.config.compression,
        compressionLevel: this.config.compressionLevel,
        includePatterns: this.config.includePatterns,
        excludePatterns: this.config.excludePatterns
      },
      stats: { ...this.stats }
    };
  }

  /**
     * Respalda todos los archivos del directorio de datos
     */
  async backupFiles(backupPath, includeCompression) {
    const results = {
      files: [],
      totalSize: 0,
      errors: []
    };
        
    try {
      await this.backupDirectory(this.dataDir, backupPath, includeCompression, results);
    } catch (error) {
      results.errors.push({ path: this.dataDir, error: error.message });
    }
        
    return results;
  }

  /**
     * Respalda un directorio recursivamente
     */
  async backupDirectory(sourceDir, targetDir, includeCompression, results, relativePath = '') {
    try {
      const items = await fs.readdir(sourceDir, { withFileTypes: true });
            
      for (const item of items) {
        const sourcePath = path.join(sourceDir, item.name);
        const targetPath = path.join(targetDir, relativePath, item.name);
        const itemRelativePath = path.join(relativePath, item.name);
                
        try {
          if (item.isDirectory()) {
            // Crear directorio en destino
            await fs.mkdir(targetPath, { recursive: true });
                        
            // Respaldar contenido del directorio
            await this.backupDirectory(
              sourcePath, 
              targetDir, 
              includeCompression, 
              results, 
              itemRelativePath
            );
          } else if (item.isFile()) {
            // Verificar si el archivo debe incluirse
            if (this.shouldIncludeFile(item.name)) {
              await this.backupFile(sourcePath, targetPath, includeCompression);
                            
              const stats = await fs.stat(sourcePath);
              results.files.push({
                path: itemRelativePath,
                size: stats.size,
                compressed: includeCompression
              });
              results.totalSize += stats.size;
            }
          }
        } catch (error) {
          results.errors.push({ path: itemRelativePath, error: error.message });
        }
      }
    } catch (error) {
      results.errors.push({ path: relativePath, error: error.message });
    }
  }

  /**
     * Verifica si un archivo debe incluirse en el respaldo
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
     * Verifica si un nombre de archivo coincide con un patrón
     */
  matchPattern(fileName, pattern) {
    // Convertir patrón simple con * a regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
        
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(fileName);
  }

  /**
     * Respalda un archivo individual
     */
  async backupFile(sourcePath, targetPath, includeCompression) {
    // Asegurar que el directorio padre existe
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
    if (includeCompression && this.shouldCompressFile(sourcePath)) {
      // Comprimir archivo
      const compressedPath = `${targetPath}.gz`;
      await this.compressFile(sourcePath, compressedPath);
    } else {
      // Copiar archivo sin compresión
      await fs.copyFile(sourcePath, targetPath);
    }
  }

  /**
     * Verifica si un archivo debe comprimirse
     */
  shouldCompressFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const compressibleExtensions = ['.json', '.txt', '.log', '.csv', '.xml'];
    return compressibleExtensions.includes(ext);
  }

  /**
     * Comprime un archivo usando gzip
     */
  async compressFile(sourcePath, targetPath) {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(targetPath);
    const gzipStream = createGzip({ level: this.config.compressionLevel });
        
    await pipeline(readStream, gzipStream, writeStream);
  }

  /**
     * Verifica la integridad de un respaldo
     */
  async verifyBackupIntegrity(backupPath) {
    try {
      // Verificar que el manifiesto existe
      const manifestPath = path.join(backupPath, 'manifest.json');
      await fs.access(manifestPath);
            
      // Leer y validar manifiesto
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
            
      if (!manifest.version || !manifest.timestamp) {
        throw new Error('Manifiesto inválido');
      }
            
      // Verificar que los archivos existen
      const items = await fs.readdir(backupPath, { recursive: true });
      if (items.length < 2) { // Al menos manifest.json + 1 archivo
        throw new Error('Respaldo incompleto');
      }
            
      this.log(`Integridad verificada para respaldo: ${path.basename(backupPath)}`);
      return true;
    } catch (error) {
      this.logError('Error verificando integridad del respaldo', error);
      throw error;
    }
  }

  /**
     * Limpia respaldos antiguos según la política de retención
     */
  async cleanupOldBackups() {
    try {
      const backupDirs = await fs.readdir(this.backupDir);
      const validBackups = [];
            
      // Obtener información de todos los respaldos
      for (const dir of backupDirs) {
        if (this.isValidBackupDir(dir)) {
          const backupPath = path.join(this.backupDir, dir);
          const stats = await fs.stat(backupPath);
                    
          if (stats.isDirectory()) {
            validBackups.push({
              name: dir,
              path: backupPath,
              date: this.parseBackupDate(dir),
              mtime: stats.mtime
            });
          }
        }
      }
            
      // Ordenar por fecha (más antiguos primero)
      validBackups.sort((a, b) => a.date - b.date);
            
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
            
      let removedCount = 0;
            
      // Eliminar respaldos por edad
      for (const backup of validBackups) {
        if (backup.date < cutoffDate) {
          await fs.rm(backup.path, { recursive: true, force: true });
          removedCount++;
        }
      }
            
      // Eliminar respaldos excedentes (mantener solo maxBackups)
      const remainingBackups = validBackups.filter(b => b.date >= cutoffDate);
      if (remainingBackups.length > this.config.maxBackups) {
        const toRemove = remainingBackups.slice(0, remainingBackups.length - this.config.maxBackups);
        for (const backup of toRemove) {
          await fs.rm(backup.path, { recursive: true, force: true });
          removedCount++;
        }
      }
            
      if (removedCount > 0) {
        this.log(`Limpieza completada: ${removedCount} respaldos antiguos eliminados`);
      }
            
      return { success: true, removed: removedCount };
    } catch (error) {
      this.logError('Error en limpieza de respaldos', error);
      throw error;
    }
  }

  /**
     * Restaura datos desde un respaldo
     */
  async restoreFromBackup(backupName, options = {}) {
    try {
      const { 
        targetDir = this.dataDir,
        overwrite = false,
        dryRun = false
      } = options;
            
      const backupPath = path.join(this.backupDir, backupName);
            
      // Verificar que el respaldo existe
      await fs.access(backupPath);
            
      // Leer manifiesto
      const manifestPath = path.join(backupPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
            
      this.log(`Iniciando restauración desde: ${backupName}`);
            
      const results = {
        files: [],
        errors: [],
        totalFiles: 0,
        restoredFiles: 0
      };
            
      // Restaurar archivos
      await this.restoreDirectory(backupPath, targetDir, overwrite, dryRun, results);
            
      if (!dryRun) {
        this.log(`Restauración completada: ${results.restoredFiles}/${results.totalFiles} archivos`);
      } else {
        this.log(`Simulación de restauración: ${results.totalFiles} archivos serían restaurados`);
      }
            
      return {
        success: true,
        manifest,
        results,
        dryRun
      };
    } catch (error) {
      this.logError('Error restaurando desde respaldo', error);
      throw error;
    }
  }

  /**
     * Restaura un directorio recursivamente
     */
  async restoreDirectory(sourceDir, targetDir, overwrite, dryRun, results, relativePath = '') {
    try {
      const items = await fs.readdir(sourceDir, { withFileTypes: true });
            
      for (const item of items) {
        if (item.name === 'manifest.json' && relativePath === '') {
          continue; // Saltar manifiesto en raíz
        }
                
        const sourcePath = path.join(sourceDir, item.name);
        const targetPath = path.join(targetDir, relativePath, item.name);
        const itemRelativePath = path.join(relativePath, item.name);
                
        try {
          if (item.isDirectory()) {
            if (!dryRun) {
              await fs.mkdir(targetPath, { recursive: true });
            }
                        
            await this.restoreDirectory(
              sourcePath,
              targetDir,
              overwrite,
              dryRun,
              results,
              itemRelativePath
            );
          } else if (item.isFile()) {
            results.totalFiles++;
                        
            // Verificar si el archivo ya existe
            let shouldRestore = overwrite;
            if (!overwrite) {
              try {
                await fs.access(targetPath);
                // El archivo existe, no restaurar
              } catch {
                // El archivo no existe, restaurar
                shouldRestore = true;
              }
            }
                        
            if (shouldRestore) {
              if (!dryRun) {
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                                
                if (item.name.endsWith('.gz')) {
                  // Descomprimir archivo
                  const decompressedPath = targetPath.replace('.gz', '');
                  await this.decompressFile(sourcePath, decompressedPath);
                } else {
                  // Copiar archivo
                  await fs.copyFile(sourcePath, targetPath);
                }
              }
                            
              results.restoredFiles++;
              results.files.push({
                path: itemRelativePath,
                action: 'restored'
              });
            } else {
              results.files.push({
                path: itemRelativePath,
                action: 'skipped'
              });
            }
          }
        } catch (error) {
          results.errors.push({ path: itemRelativePath, error: error.message });
        }
      }
    } catch (error) {
      results.errors.push({ path: relativePath, error: error.message });
    }
  }

  /**
     * Descomprime un archivo gzip
     */
  async decompressFile(sourcePath, targetPath) {
    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(targetPath);
    const gunzipStream = createGunzip();
        
    await pipeline(readStream, gunzipStream, writeStream);
  }

  /**
     * Lista todos los respaldos disponibles
     */
  async listBackups() {
    try {
      const backupDirs = await fs.readdir(this.backupDir);
      const backups = [];
            
      for (const dir of backupDirs) {
        if (this.isValidBackupDir(dir)) {
          const backupPath = path.join(this.backupDir, dir);
          const stats = await fs.stat(backupPath);
                    
          if (stats.isDirectory()) {
            // Leer manifiesto si existe
            let manifest = null;
            try {
              const manifestPath = path.join(backupPath, 'manifest.json');
              const manifestData = await fs.readFile(manifestPath, 'utf8');
              manifest = JSON.parse(manifestData);
            } catch {
              // Manifiesto no disponible
            }
                        
            backups.push({
              name: dir,
              date: this.parseBackupDate(dir),
              size: await this.calculateDirectorySize(backupPath),
              type: manifest?.type || 'unknown',
              version: manifest?.version || 'unknown',
              files: await this.countBackupFiles(backupPath)
            });
          }
        }
      }
            
      // Ordenar por fecha (más recientes primero)
      backups.sort((a, b) => b.date - a.date);
            
      return { success: true, backups };
    } catch (error) {
      this.logError('Error listando respaldos', error);
      throw error;
    }
  }

  /**
     * Cuenta los archivos en un respaldo
     */
  async countBackupFiles(backupPath) {
    try {
      let count = 0;
            
      const countFiles = async(dir) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
                
        for (const item of items) {
          if (item.isDirectory()) {
            await countFiles(path.join(dir, item.name));
          } else {
            count++;
          }
        }
      };
            
      await countFiles(backupPath);
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
     * Obtiene estadísticas del gestor de respaldos
     */
  async getStats() {
    try {
      const backups = await this.listBackups();
            
      return {
        success: true,
        stats: {
          ...this.stats,
          isRunning: this.isBackupRunning,
          lastBackup: this.lastBackup,
          nextScheduledBackup: this.getNextScheduledBackup(),
          availableBackups: backups.backups.length,
          config: this.config
        }
      };
    } catch (error) {
      this.logError('Error obteniendo estadísticas', error);
      throw error;
    }
  }

  /**
     * Calcula la próxima fecha de respaldo programado
     */
  getNextScheduledBackup() {
    if (!this.config.autoBackup) {
      return null;
    }
        
    const [hour, minute] = this.config.backupTime.split(':').map(Number);
    const now = new Date();
    const next = new Date(now);
        
    next.setHours(hour, minute, 0, 0);
        
    // Si ya pasó la hora de hoy, programar para mañana
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
        
    return next.toISOString();
  }

  /**
     * Actualiza las estadísticas de respaldos
     */
  updateBackupStats(success, duration, size) {
    if (success) {
      this.stats.successfulBackups++;
    } else {
      this.stats.failedBackups++;
    }
        
    this.stats.lastBackupDuration = duration;
        
    // Calcular tiempo promedio
    const totalBackups = this.stats.successfulBackups + this.stats.failedBackups;
    if (totalBackups > 0) {
      this.stats.averageBackupTime = 
                (this.stats.averageBackupTime * (totalBackups - 1) + duration) / totalBackups;
    }
        
    if (success && size > 0) {
      this.stats.totalSizeBytes += size;
    }
  }

  /**
     * Formatea bytes en formato legible
     */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
        
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
        
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
     * Logging unificado
     */
  log(message) {
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] [BackupManager] ${message}`);
  }

  /**
     * Logging de errores
     */
  logError(message, error) {
    const timestamp = new Date().toISOString();
    this.logger.error(`[${timestamp}] [BackupManager] ERROR: ${message}`, error);
  }

  /**
     * Cierre limpio del gestor
     */
  async shutdown() {
    try {
      if (this.backupScheduler) {
        clearInterval(this.backupScheduler);
        this.backupScheduler = null;
      }
            
      // Esperar a que termine el respaldo actual si está en progreso
      while (this.isBackupRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
            
      this.log('BackupManager cerrado correctamente');
    } catch (error) {
      this.logError('Error cerrando BackupManager', error);
    }
  }
}

// Instancia singleton
const backupManager = new BackupManager();

// Funciones exportadas
export const initialize = () => backupManager.initialize();
export const createBackup = (options) => backupManager.createBackup(options);
export const restoreFromBackup = (backupName, options) => backupManager.restoreFromBackup(backupName, options);
export const listBackups = () => backupManager.listBackups();
export const cleanupOldBackups = () => backupManager.cleanupOldBackups();
export const getStats = () => backupManager.getStats();
export const shutdown = () => backupManager.shutdown();

export default backupManager;