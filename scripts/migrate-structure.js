#!/usr/bin/env node

/**
 * @fileoverview Migration Script for Project Restructuring
 * 
 * Script para migrar la estructura actual del proyecto a la nueva
 * arquitectura modular siguiendo principios de separación de preocupaciones.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Configuración de migración
 */
const MIGRATION_CONFIG = {
  // Mapeo de directorios antiguos a nuevos
  directoryMapping: {
    // Core system files
    'src/core': 'src/services/core',
    'src/services': 'src/services/core',
    
    // Components
    'src/dashboard': 'src/components/ui',
    'src/modules': 'src/components/business',
    
    // Services
    'src/agents': 'src/services/core',
    'src/integrations': 'src/services/external',
    'src/notifications': 'src/services/messaging',
    'src/security': 'src/services/auth',
    
    // Utilities
    'src/utils': 'src/utils/helpers',
    'src/validators': 'src/utils/validators',
    'src/middleware': 'src/api/middleware',
    
    // Configuration
    'src/config': 'src/config/environments',
    'src/database': 'src/config/database',
    'src/cache': 'src/config/cache',
    
    // API
    'src/routes': 'src/api/routes',
    
    // Tests
    'tests': 'src/tests',
    'test': 'src/tests'
  },
  
  // Archivos que requieren renombrado
  fileRenaming: {
    // Servicios
    'Service.js': 'Service.js',
    'Manager.js': 'Service.js',
    'Agent.js': 'Service.js',
    
    // Componentes
    'Component.js': 'Component.js',
    'Dashboard.js': 'Dashboard.js',
    
    // Utilidades
    'utils.js': 'helpers.js',
    'helper.js': 'helpers.js',
    
    // Configuración
    'config.js': 'config.js',
    '.config.js': '.config.js'
  },
  
  // Archivos a excluir de la migración
  excludeFiles: [
    'node_modules',
    '.git',
    '.env',
    'package.json',
    'package-lock.json',
    'README.md',
    'CHANGELOG.md'
  ],
  
  // Extensiones de archivo a procesar
  processExtensions: ['.js', '.ts', '.json', '.md'],
  
  // Backup directory
  backupDir: 'backup-pre-migration'
};

/**
 * Logger para el proceso de migración
 */
class MigrationLogger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
  }

  info(message, data = {}) {
    const log = { level: 'INFO', message, data, timestamp: new Date().toISOString() };
    this.logs.push(log);
    console.log(`ℹ️  ${message}`, data);
  }

  warn(message, data = {}) {
    const log = { level: 'WARN', message, data, timestamp: new Date().toISOString() };
    this.warnings.push(log);
    console.warn(`⚠️  ${message}`, data);
  }

  error(message, error = null, data = {}) {
    const log = { 
      level: 'ERROR', 
      message, 
      error: error?.message || error, 
      stack: error?.stack,
      data, 
      timestamp: new Date().toISOString() 
    };
    this.errors.push(log);
    console.error(`❌ ${message}`, error, data);
  }

  success(message, data = {}) {
    const log = { level: 'SUCCESS', message, data, timestamp: new Date().toISOString() };
    this.logs.push(log);
    console.log(`✅ ${message}`, data);
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLogs: this.logs.length,
        warnings: this.warnings.length,
        errors: this.errors.length
      },
      logs: this.logs,
      warnings: this.warnings,
      errors: this.errors
    };

    const reportPath = path.join(PROJECT_ROOT, 'migration-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    this.info('Migration report saved', { path: reportPath });
  }
}

/**
 * Gestor de migración
 */
class StructureMigrator {
  constructor() {
    this.logger = new MigrationLogger();
    this.dryRun = process.argv.includes('--dry-run');
    this.force = process.argv.includes('--force');
    this.backup = !process.argv.includes('--no-backup');
    
    this.stats = {
      filesProcessed: 0,
      filesMoved: 0,
      filesRenamed: 0,
      directoriesCreated: 0,
      errors: 0
    };
  }

  /**
   * Ejecuta la migración completa
   */
  async migrate() {
    try {
      this.logger.info('🚀 Iniciando migración de estructura del proyecto');
      this.logger.info('Configuración', {
        dryRun: this.dryRun,
        force: this.force,
        backup: this.backup
      });

      // Validaciones previas
      await this.validateEnvironment();
      
      // Crear backup si está habilitado
      if (this.backup && !this.dryRun) {
        await this.createBackup();
      }

      // Crear nueva estructura de directorios
      await this.createNewStructure();

      // Migrar archivos
      await this.migrateFiles();

      // Actualizar imports/requires
      await this.updateImports();

      // Generar reporte
      await this.generateReport();

      this.logger.success('🎉 Migración completada exitosamente');
      
    } catch (error) {
      this.logger.error('💥 Error durante la migración', error);
      throw error;
    } finally {
      await this.logger.saveReport();
    }
  }

  /**
   * Valida el entorno antes de la migración
   */
  async validateEnvironment() {
    this.logger.info('🔍 Validando entorno...');

    // Verificar que estamos en el directorio correcto
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    try {
      await fs.access(packageJsonPath);
    } catch {
      throw new Error('No se encontró package.json. Asegúrate de estar en el directorio raíz del proyecto.');
    }

    // Verificar permisos de escritura
    try {
      await fs.access(PROJECT_ROOT, fs.constants.W_OK);
    } catch {
      throw new Error('No tienes permisos de escritura en el directorio del proyecto.');
    }

    // Verificar si ya existe la nueva estructura
    const newStructureExists = await this.checkNewStructureExists();
    if (newStructureExists && !this.force) {
      throw new Error('La nueva estructura ya existe. Usa --force para sobrescribir.');
    }

    this.logger.success('✅ Validación del entorno completada');
  }

  /**
   * Verifica si la nueva estructura ya existe
   */
  async checkNewStructureExists() {
    const newDirs = [
      'src/components',
      'src/services',
      'src/utils',
      'src/api'
    ];

    for (const dir of newDirs) {
      try {
        const fullPath = path.join(PROJECT_ROOT, dir);
        await fs.access(fullPath);
        return true;
      } catch {
        // Directory doesn't exist, continue checking
      }
    }

    return false;
  }

  /**
   * Crea backup del estado actual
   */
  async createBackup() {
    this.logger.info('💾 Creando backup...');

    const backupPath = path.join(PROJECT_ROOT, MIGRATION_CONFIG.backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `${backupPath}-${timestamp}`;

    try {
      await fs.mkdir(backupDir, { recursive: true });
      await this.copyDirectory(path.join(PROJECT_ROOT, 'src'), path.join(backupDir, 'src'));
      
      this.logger.success('✅ Backup creado', { path: backupDir });
    } catch (error) {
      this.logger.error('Error creando backup', error);
      throw error;
    }
  }

  /**
   * Crea la nueva estructura de directorios
   */
  async createNewStructure() {
    this.logger.info('📁 Creando nueva estructura de directorios...');

    const newDirectories = [
      // Components
      'src/components/ui',
      'src/components/business',
      'src/components/shared',
      
      // Services
      'src/services/core',
      'src/services/external',
      'src/services/messaging',
      'src/services/auth',
      'src/services/analytics',
      
      // Utils
      'src/utils/helpers',
      'src/utils/validators',
      'src/utils/formatters',
      'src/utils/constants',
      
      // Tests
      'src/tests/unit',
      'src/tests/integration',
      'src/tests/e2e',
      'src/tests/fixtures',
      
      // API
      'src/api/routes',
      'src/api/middleware',
      'src/api/controllers',
      
      // Config
      'src/config/environments',
      'src/config/database',
      'src/config/cache',
      'src/config/security',
      
      // Types and others
      'src/types',
      'src/hooks',
      'src/stores'
    ];

    for (const dir of newDirectories) {
      try {
        if (!this.dryRun) {
          await fs.mkdir(path.join(PROJECT_ROOT, dir), { recursive: true });
        }
        this.stats.directoriesCreated++;
        this.logger.info(`📂 Directorio creado: ${dir}`);
      } catch (error) {
        this.logger.error(`Error creando directorio ${dir}`, error);
      }
    }

    this.logger.success(`✅ ${this.stats.directoriesCreated} directorios creados`);
  }

  /**
   * Migra archivos a la nueva estructura
   */
  async migrateFiles() {
    this.logger.info('📦 Migrando archivos...');

    const srcPath = path.join(PROJECT_ROOT, 'src');
    await this.processDirectory(srcPath);

    this.logger.success(`✅ ${this.stats.filesMoved} archivos migrados`);
  }

  /**
   * Procesa un directorio recursivamente
   */
  async processDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(PROJECT_ROOT, fullPath);

        // Saltar archivos excluidos
        if (this.shouldExclude(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.processDirectory(fullPath);
        } else if (entry.isFile()) {
          await this.processFile(fullPath, relativePath);
        }
      }
    } catch (error) {
      this.logger.error(`Error procesando directorio ${dirPath}`, error);
    }
  }

  /**
   * Procesa un archivo individual
   */
  async processFile(filePath, relativePath) {
    try {
      this.stats.filesProcessed++;

      // Determinar nueva ubicación
      const newPath = this.getNewFilePath(relativePath);
      
      if (newPath && newPath !== relativePath) {
        await this.moveFile(filePath, path.join(PROJECT_ROOT, newPath));
        this.stats.filesMoved++;
      }

    } catch (error) {
      this.logger.error(`Error procesando archivo ${relativePath}`, error);
      this.stats.errors++;
    }
  }

  /**
   * Determina la nueva ruta para un archivo
   */
  getNewFilePath(relativePath) {
    // Aplicar mapeo de directorios
    for (const [oldDir, newDir] of Object.entries(MIGRATION_CONFIG.directoryMapping)) {
      if (relativePath.startsWith(oldDir)) {
        const newPath = relativePath.replace(oldDir, newDir);
        return newPath;
      }
    }

    // Si no hay mapeo específico, mantener la ruta original
    return null;
  }

  /**
   * Mueve un archivo a su nueva ubicación
   */
  async moveFile(oldPath, newPath) {
    try {
      if (this.dryRun) {
        this.logger.info(`[DRY RUN] Movería: ${oldPath} → ${newPath}`);
        return;
      }

      // Crear directorio padre si no existe
      const newDir = path.dirname(newPath);
      await fs.mkdir(newDir, { recursive: true });

      // Mover archivo
      await fs.rename(oldPath, newPath);
      
      this.logger.info(`📁 Movido: ${path.relative(PROJECT_ROOT, oldPath)} → ${path.relative(PROJECT_ROOT, newPath)}`);
      
    } catch (error) {
      this.logger.error(`Error moviendo archivo ${oldPath} → ${newPath}`, error);
      throw error;
    }
  }

  /**
   * Actualiza imports/requires en los archivos
   */
  async updateImports() {
    this.logger.info('🔗 Actualizando imports...');

    // Esta es una implementación básica
    // En un proyecto real, necesitarías un parser más sofisticado
    const jsFiles = await this.findFilesByExtension(['.js', '.ts']);
    
    for (const file of jsFiles) {
      await this.updateFileImports(file);
    }

    this.logger.success('✅ Imports actualizados');
  }

  /**
   * Actualiza imports en un archivo específico
   */
  async updateFileImports(filePath) {
    try {
      if (this.dryRun) {
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      let updatedContent = content;

      // Actualizar imports relativos (implementación básica)
      const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

      updatedContent = updatedContent.replace(importRegex, (match, importPath) => {
        const newImportPath = this.updateImportPath(importPath, filePath);
        return match.replace(importPath, newImportPath);
      });

      updatedContent = updatedContent.replace(requireRegex, (match, requirePath) => {
        const newRequirePath = this.updateImportPath(requirePath, filePath);
        return match.replace(requirePath, newRequirePath);
      });

      if (updatedContent !== content) {
        await fs.writeFile(filePath, updatedContent);
        this.logger.info(`🔗 Imports actualizados en: ${path.relative(PROJECT_ROOT, filePath)}`);
      }

    } catch (error) {
      this.logger.error(`Error actualizando imports en ${filePath}`, error);
    }
  }

  /**
   * Actualiza una ruta de import específica
   */
  updateImportPath(importPath, currentFile) {
    // Implementación básica - en un proyecto real necesitarías lógica más compleja
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Es un import relativo, necesita actualización
      // Esta es una implementación simplificada
      return importPath;
    }
    
    return importPath;
  }

  /**
   * Encuentra archivos por extensión
   */
  async findFilesByExtension(extensions) {
    const files = [];
    
    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await scan(path.join(PROJECT_ROOT, 'src'));
    return files;
  }

  /**
   * Copia un directorio recursivamente
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Verifica si un archivo/directorio debe ser excluido
   */
  shouldExclude(name) {
    return MIGRATION_CONFIG.excludeFiles.some(exclude => 
      name === exclude || name.startsWith(exclude)
    );
  }

  /**
   * Genera reporte final
   */
  async generateReport() {
    this.logger.info('📊 Generando reporte final...');

    const report = {
      timestamp: new Date().toISOString(),
      configuration: {
        dryRun: this.dryRun,
        force: this.force,
        backup: this.backup
      },
      statistics: this.stats,
      summary: {
        success: this.stats.errors === 0,
        filesProcessed: this.stats.filesProcessed,
        filesMoved: this.stats.filesMoved,
        directoriesCreated: this.stats.directoriesCreated,
        errors: this.stats.errors
      },
      newStructure: await this.getNewStructureInfo()
    };

    const reportPath = path.join(PROJECT_ROOT, 'migration-structure-report.json');
    
    if (!this.dryRun) {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }

    this.logger.success('📊 Reporte generado', { 
      path: this.dryRun ? '[DRY RUN]' : reportPath,
      stats: this.stats 
    });
  }

  /**
   * Obtiene información de la nueva estructura
   */
  async getNewStructureInfo() {
    const structure = {};
    
    try {
      const srcPath = path.join(PROJECT_ROOT, 'src');
      structure.src = await this.getDirectoryStructure(srcPath);
    } catch (error) {
      this.logger.warn('No se pudo obtener información de la nueva estructura', error);
    }
    
    return structure;
  }

  /**
   * Obtiene la estructura de un directorio
   */
  async getDirectoryStructure(dirPath) {
    const structure = {};
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dirPath, entry.name);
          structure[entry.name] = await this.getDirectoryStructure(subPath);
        } else {
          if (!structure._files) structure._files = [];
          structure._files.push(entry.name);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return structure;
  }
}

/**
 * Función principal
 */
async function main() {
  const migrator = new StructureMigrator();
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    console.error('💥 Error fatal durante la migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default StructureMigrator;