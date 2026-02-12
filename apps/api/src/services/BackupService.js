import fs from 'fs-extra';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import unzipper from 'unzipper';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.dataDir = path.join(process.cwd(), 'data');
    this.publicDir = path.join(process.cwd(), 'public');
    this.configDir = path.join(process.cwd(), 'config');
    this.templatesDir = path.join(process.cwd(), 'templates');

    this.backupConfig = {
      maxBackups: 30, // Mantener máximo 30 backups
      autoBackupEnabled: true,
      backupSchedule: '0 2 * * *', // Diario a las 2 AM
      compressionLevel: 6,
      includeUploads: true,
      includeTemplates: true,
      includeConfig: true,
      includeDatabase: true,
    };

    this.backupJobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Crear directorio de backups si no existe
      await fs.ensureDir(this.backupDir);

      // Cargar configuración de backup
      await this.loadBackupConfig();

      // Inicializar backup automático
      if (this.backupConfig.autoBackupEnabled) {
        this.scheduleAutoBackup();
      }

      // Limpiar backups antiguos al inicializar
      await this.cleanOldBackups();

      this.isInitialized = true;
      console.log('✅ BackupService inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando BackupService:', error);
      throw error;
    }
  }

  async loadBackupConfig() {
    const configPath = path.join(this.configDir, 'backup-config.json');

    try {
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        this.backupConfig = { ...this.backupConfig, ...config };
      } else {
        await this.saveBackupConfig();
      }
    } catch (error) {
      console.warn(
        '⚠️ Error cargando configuración de backup, usando valores por defecto'
      );
    }
  }

  async saveBackupConfig() {
    const configPath = path.join(this.configDir, 'backup-config.json');

    try {
      await fs.ensureDir(this.configDir);
      await fs.writeJson(configPath, this.backupConfig, { spaces: 2 });
    } catch (error) {
      console.error('❌ Error guardando configuración de backup:', error);
    }
  }

  async createBackup(options = {}) {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = options.name || `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);

    try {
      console.log(`🔄 Iniciando backup: ${backupName}`);

      const archive = archiver('zip', {
        zlib: { level: this.backupConfig.compressionLevel },
      });

      const output = createWriteStream(backupPath);
      archive.pipe(output);

      // Crear manifiesto del backup
      const manifest = {
        id: backupId,
        name: backupName,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        type: options.type || 'full',
        size: 0,
        files: [],
        config: { ...this.backupConfig },
      };

      // Agregar datos de la aplicación
      if (
        this.backupConfig.includeDatabase &&
        (await fs.pathExists(this.dataDir))
      ) {
        archive.directory(this.dataDir, 'data');
        manifest.files.push('data/');
        console.log('📁 Agregando datos de la aplicación');
      }

      // Agregar plantillas
      if (
        this.backupConfig.includeTemplates &&
        (await fs.pathExists(this.templatesDir))
      ) {
        archive.directory(this.templatesDir, 'templates');
        manifest.files.push('templates/');
        console.log('📄 Agregando plantillas');
      }

      // Agregar configuración
      if (
        this.backupConfig.includeConfig &&
        (await fs.pathExists(this.configDir))
      ) {
        archive.directory(this.configDir, 'config');
        manifest.files.push('config/');
        console.log('⚙️ Agregando configuración');
      }

      // Agregar uploads si está habilitado
      if (this.backupConfig.includeUploads) {
        const uploadsDir = path.join(this.publicDir, 'uploads');
        if (await fs.pathExists(uploadsDir)) {
          archive.directory(uploadsDir, 'uploads');
          manifest.files.push('uploads/');
          console.log('📎 Agregando archivos subidos');
        }
      }

      // Agregar archivos específicos importantes
      const importantFiles = [
        'package.json',
        'package-lock.json',
        '.env.example',
        'server.js',
      ];

      for (const file of importantFiles) {
        const filePath = path.join(process.cwd(), file);
        if (await fs.pathExists(filePath)) {
          archive.file(filePath, { name: file });
          manifest.files.push(file);
        }
      }

      // Agregar manifiesto al archivo
      archive.append(JSON.stringify(manifest, null, 2), {
        name: 'backup-manifest.json',
      });

      // Finalizar el archivo
      await archive.finalize();

      // Esperar a que termine la escritura
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
      });

      // Obtener información del archivo creado
      const stats = await fs.stat(backupPath);
      manifest.size = stats.size;

      // Guardar información del backup
      await this.saveBackupInfo(backupId, {
        ...manifest,
        path: backupPath,
        sizeFormatted: this.formatFileSize(stats.size),
      });

      console.log(
        `✅ Backup completado: ${backupName} (${this.formatFileSize(stats.size)})`
      );

      // Limpiar backups antiguos
      await this.cleanOldBackups();

      // Notificar si hay servicio de notificaciones disponible
      if (global.notificationService) {
        await global.notificationService.sendNotification({
          type: 'system',
          title: 'Backup Completado',
          message: `Backup ${backupName} creado exitosamente (${this.formatFileSize(stats.size)})`,
          data: { backupId, backupName, size: stats.size },
        });
      }

      return {
        success: true,
        backupId,
        backupName,
        path: backupPath,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        manifest,
      };
    } catch (error) {
      console.error(`❌ Error creando backup ${backupName}:`, error);

      // Limpiar archivo parcial si existe
      if (await fs.pathExists(backupPath)) {
        await fs.remove(backupPath);
      }

      // Notificar error
      if (global.notificationService) {
        await global.notificationService.sendNotification({
          type: 'error',
          title: 'Error en Backup',
          message: `Error creando backup: ${error.message}`,
          data: { error: error.message },
        });
      }

      throw error;
    }
  }

  async restoreBackup(backupId, options = {}) {
    try {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        throw new Error('Backup no encontrado');
      }

      console.log(`🔄 Iniciando restauración: ${backupInfo.name}`);

      // Crear backup de seguridad antes de restaurar
      if (!options.skipSafetyBackup) {
        console.log('🛡️ Creando backup de seguridad...');
        await this.createBackup({
          name: `safety-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`,
          type: 'safety',
        });
      }

      // Crear directorio temporal para extracción
      const tempDir = path.join(this.backupDir, 'temp', backupId);
      await fs.ensureDir(tempDir);

      try {
        // Extraer backup
        await pipeline(
          createReadStream(backupInfo.path),
          unzipper.Extract({ path: tempDir })
        );

        // Leer manifiesto
        const manifestPath = path.join(tempDir, 'backup-manifest.json');
        let manifest = {};
        if (await fs.pathExists(manifestPath)) {
          manifest = await fs.readJson(manifestPath);
        }

        // Restaurar datos
        if (
          options.restoreData !== false &&
          (await fs.pathExists(path.join(tempDir, 'data')))
        ) {
          console.log('📁 Restaurando datos...');
          await fs.remove(this.dataDir);
          await fs.move(path.join(tempDir, 'data'), this.dataDir);
        }

        // Restaurar plantillas
        if (
          options.restoreTemplates !== false &&
          (await fs.pathExists(path.join(tempDir, 'templates')))
        ) {
          console.log('📄 Restaurando plantillas...');
          await fs.remove(this.templatesDir);
          await fs.move(path.join(tempDir, 'templates'), this.templatesDir);
        }

        // Restaurar configuración
        if (
          options.restoreConfig !== false &&
          (await fs.pathExists(path.join(tempDir, 'config')))
        ) {
          console.log('⚙️ Restaurando configuración...');
          await fs.remove(this.configDir);
          await fs.move(path.join(tempDir, 'config'), this.configDir);
        }

        // Restaurar uploads
        if (
          options.restoreUploads !== false &&
          (await fs.pathExists(path.join(tempDir, 'uploads')))
        ) {
          console.log('📎 Restaurando archivos subidos...');
          const uploadsDir = path.join(this.publicDir, 'uploads');
          await fs.remove(uploadsDir);
          await fs.move(path.join(tempDir, 'uploads'), uploadsDir);
        }

        // Restaurar archivos importantes
        const importantFiles = [
          'package.json',
          'package-lock.json',
          '.env.example',
        ];
        for (const file of importantFiles) {
          const sourcePath = path.join(tempDir, file);
          const targetPath = path.join(process.cwd(), file);
          if (await fs.pathExists(sourcePath)) {
            await fs.copy(sourcePath, targetPath);
          }
        }

        console.log(`✅ Restauración completada: ${backupInfo.name}`);

        // Notificar éxito
        if (global.notificationService) {
          await global.notificationService.sendNotification({
            type: 'system',
            title: 'Restauración Completada',
            message: `Backup ${backupInfo.name} restaurado exitosamente`,
            data: { backupId, backupName: backupInfo.name },
          });
        }

        return {
          success: true,
          backupId,
          backupName: backupInfo.name,
          restoredFiles: manifest.files || [],
          manifest,
        };
      } finally {
        // Limpiar directorio temporal
        await fs.remove(tempDir);
      }
    } catch (error) {
      console.error(`❌ Error restaurando backup ${backupId}:`, error);

      // Notificar error
      if (global.notificationService) {
        await global.notificationService.sendNotification({
          type: 'error',
          title: 'Error en Restauración',
          message: `Error restaurando backup: ${error.message}`,
          data: { backupId, error: error.message },
        });
      }

      throw error;
    }
  }

  async listBackups() {
    try {
      const backupsInfoPath = path.join(this.backupDir, 'backups-info.json');
      let backupsInfo = {};

      if (await fs.pathExists(backupsInfoPath)) {
        backupsInfo = await fs.readJson(backupsInfoPath);
      }

      // Verificar que los archivos de backup existan
      const validBackups = {};
      for (const [id, info] of Object.entries(backupsInfo)) {
        if (await fs.pathExists(info.path)) {
          validBackups[id] = info;
        }
      }

      // Actualizar archivo si se eliminaron backups
      if (
        Object.keys(validBackups).length !== Object.keys(backupsInfo).length
      ) {
        await fs.writeJson(backupsInfoPath, validBackups, { spaces: 2 });
      }

      return Object.values(validBackups).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('❌ Error listando backups:', error);
      return [];
    }
  }

  async getBackupInfo(backupId) {
    try {
      const backupsInfoPath = path.join(this.backupDir, 'backups-info.json');

      if (await fs.pathExists(backupsInfoPath)) {
        const backupsInfo = await fs.readJson(backupsInfoPath);
        return backupsInfo[backupId] || null;
      }

      return null;
    } catch (error) {
      console.error('❌ Error obteniendo información de backup:', error);
      return null;
    }
  }

  async deleteBackup(backupId) {
    try {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        throw new Error('Backup no encontrado');
      }

      // Eliminar archivo de backup
      if (await fs.pathExists(backupInfo.path)) {
        await fs.remove(backupInfo.path);
      }

      // Actualizar información de backups
      const backupsInfoPath = path.join(this.backupDir, 'backups-info.json');
      if (await fs.pathExists(backupsInfoPath)) {
        const backupsInfo = await fs.readJson(backupsInfoPath);
        delete backupsInfo[backupId];
        await fs.writeJson(backupsInfoPath, backupsInfo, { spaces: 2 });
      }

      console.log(`🗑️ Backup eliminado: ${backupInfo.name}`);

      return { success: true, deletedBackup: backupInfo };
    } catch (error) {
      console.error(`❌ Error eliminando backup ${backupId}:`, error);
      throw error;
    }
  }

  async saveBackupInfo(backupId, info) {
    try {
      const backupsInfoPath = path.join(this.backupDir, 'backups-info.json');
      let backupsInfo = {};

      if (await fs.pathExists(backupsInfoPath)) {
        backupsInfo = await fs.readJson(backupsInfoPath);
      }

      backupsInfo[backupId] = info;
      await fs.writeJson(backupsInfoPath, backupsInfo, { spaces: 2 });
    } catch (error) {
      console.error('❌ Error guardando información de backup:', error);
    }
  }

  async cleanOldBackups() {
    try {
      const backups = await this.listBackups();

      if (backups.length > this.backupConfig.maxBackups) {
        const backupsToDelete = backups
          .slice(this.backupConfig.maxBackups)
          .filter(backup => backup.type !== 'manual'); // No eliminar backups manuales

        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.id);
        }

        if (backupsToDelete.length > 0) {
          console.log(
            `🧹 Eliminados ${backupsToDelete.length} backups antiguos`
          );
        }
      }
    } catch (error) {
      console.error('❌ Error limpiando backups antiguos:', error);
    }
  }

  scheduleAutoBackup() {
    // Cancelar job anterior si existe
    if (this.backupJobs.has('auto')) {
      this.backupJobs.get('auto').stop();
    }

    // Programar nuevo backup automático
    const job = cron.schedule(
      this.backupConfig.backupSchedule,
      async () => {
        try {
          console.log('⏰ Ejecutando backup automático programado');
          await this.createBackup({
            name: `auto-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`,
            type: 'automatic',
          });
        } catch (error) {
          console.error('❌ Error en backup automático:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'America/Mexico_City',
      }
    );

    job.start();
    this.backupJobs.set('auto', job);

    console.log(
      `⏰ Backup automático programado: ${this.backupConfig.backupSchedule}`
    );
  }

  async updateConfig(newConfig) {
    try {
      this.backupConfig = { ...this.backupConfig, ...newConfig };
      await this.saveBackupConfig();

      // Reprogramar backup automático si cambió
      if (
        newConfig.autoBackupEnabled !== undefined ||
        newConfig.backupSchedule
      ) {
        if (this.backupConfig.autoBackupEnabled) {
          this.scheduleAutoBackup();
        } else {
          // Detener backup automático
          if (this.backupJobs.has('auto')) {
            this.backupJobs.get('auto').stop();
            this.backupJobs.delete('auto');
          }
        }
      }

      return { success: true, config: this.backupConfig };
    } catch (error) {
      console.error('❌ Error actualizando configuración de backup:', error);
      throw error;
    }
  }

  getConfig() {
    return { ...this.backupConfig };
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      autoBackupEnabled: this.backupConfig.autoBackupEnabled,
      backupSchedule: this.backupConfig.backupSchedule,
      maxBackups: this.backupConfig.maxBackups,
      activeJobs: Array.from(this.backupJobs.keys()),
      backupDir: this.backupDir,
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async validateBackup(backupId) {
    try {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        return { valid: false, error: 'Backup no encontrado' };
      }

      // Verificar que el archivo existe
      if (!(await fs.pathExists(backupInfo.path))) {
        return { valid: false, error: 'Archivo de backup no encontrado' };
      }

      // Verificar integridad básica del ZIP
      const tempDir = path.join(this.backupDir, 'temp', `validate-${backupId}`);
      await fs.ensureDir(tempDir);

      try {
        await pipeline(
          createReadStream(backupInfo.path),
          unzipper.Extract({ path: tempDir })
        );

        // Verificar que existe el manifiesto
        const manifestPath = path.join(tempDir, 'backup-manifest.json');
        if (!(await fs.pathExists(manifestPath))) {
          return { valid: false, error: 'Manifiesto de backup no encontrado' };
        }

        const manifest = await fs.readJson(manifestPath);

        return {
          valid: true,
          manifest,
          size: backupInfo.size,
          sizeFormatted: backupInfo.sizeFormatted,
        };
      } finally {
        await fs.remove(tempDir);
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async exportBackup(backupId, exportPath) {
    try {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        throw new Error('Backup no encontrado');
      }

      await fs.copy(backupInfo.path, exportPath);

      return {
        success: true,
        exportPath,
        originalPath: backupInfo.path,
        size: backupInfo.size,
      };
    } catch (error) {
      console.error(`❌ Error exportando backup ${backupId}:`, error);
      throw error;
    }
  }

  async importBackup(importPath, backupName) {
    try {
      if (!(await fs.pathExists(importPath))) {
        throw new Error('Archivo de backup no encontrado');
      }

      const backupId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalName = backupName || `imported-backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, `${finalName}.zip`);

      // Copiar archivo
      await fs.copy(importPath, backupPath);

      // Obtener información del archivo
      const stats = await fs.stat(backupPath);

      // Intentar leer manifiesto
      let manifest = {};
      const tempDir = path.join(this.backupDir, 'temp', `import-${backupId}`);

      try {
        await fs.ensureDir(tempDir);
        await pipeline(
          createReadStream(backupPath),
          unzipper.Extract({ path: tempDir })
        );

        const manifestPath = path.join(tempDir, 'backup-manifest.json');
        if (await fs.pathExists(manifestPath)) {
          manifest = await fs.readJson(manifestPath);
        }
      } catch (error) {
        console.warn('⚠️ No se pudo leer el manifiesto del backup importado');
      } finally {
        await fs.remove(tempDir);
      }

      // Guardar información del backup
      const backupInfo = {
        id: backupId,
        name: finalName,
        timestamp: new Date().toISOString(),
        type: 'imported',
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        path: backupPath,
        ...manifest,
      };

      await this.saveBackupInfo(backupId, backupInfo);

      console.log(
        `📥 Backup importado: ${finalName} (${this.formatFileSize(stats.size)})`
      );

      return {
        success: true,
        backupId,
        backupName: finalName,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
      };
    } catch (error) {
      console.error('❌ Error importando backup:', error);
      throw error;
    }
  }
}

export default BackupService;
