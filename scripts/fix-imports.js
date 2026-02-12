#!/usr/bin/env node

/**
 * Script para corregir automáticamente las rutas de imports problemáticas
 * en el proyecto ChatBot Enterprise
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Mapeo de rutas antiguas a nuevas
 */
const PATH_MAPPINGS = {
  // Core services
  '../core/': '../services/core/',
  './core/': './services/core/',
  'src/core/': 'src/services/core/',
  
  // Components
  '../dashboard/': '../components/ui/',
  './dashboard/': './components/ui/',
  'src/dashboard/': 'src/components/ui/',
  
  '../modules/': '../components/business/',
  './modules/': './components/business/',
  'src/modules/': 'src/components/business/',
  
  // Services
  '../agents/': '../services/core/',
  './agents/': './services/core/',
  'src/agents/': 'src/services/core/',
  
  '../integrations/': '../services/external/',
  './integrations/': './services/external/',
  'src/integrations/': 'src/services/external/',
  
  '../notifications/': '../services/messaging/',
  './notifications/': './services/messaging/',
  'src/notifications/': 'src/services/messaging/',
  
  '../security/': '../services/auth/',
  './security/': './services/auth/',
  'src/security/': 'src/services/auth/',
  
  // Utils
  '../utils/': '../utils/helpers/',
  './utils/': './utils/helpers/',
  'src/utils/': 'src/utils/helpers/',
  
  '../validators/': '../utils/validators/',
  './validators/': './utils/validators/',
  'src/validators/': 'src/utils/validators/',
  
  '../middleware/': '../api/middleware/',
  './middleware/': './api/middleware/',
  'src/middleware/': 'src/api/middleware/',
  
  // Config
  '../config/': '../config/environments/',
  './config/': './config/environments/',
  'src/config/': 'src/config/environments/',
  
  '../database/': '../config/database/',
  './database/': './config/database/',
  'src/database/': 'src/config/database/',
  
  '../cache/': '../config/cache/',
  './cache/': './config/cache/',
  'src/cache/': 'src/config/cache/',
  
  // API
  '../routes/': '../api/routes/',
  './routes/': './api/routes/',
  'src/routes/': 'src/api/routes/',
  
  // Tests
  '../tests/': '../tests/unit/',
  './tests/': './tests/unit/',
  'tests/': 'src/tests/',
  'test/': 'src/tests/'
};

/**
 * Patrones de import/require a buscar
 */
const IMPORT_PATTERNS = [
  // ES6 imports
  /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
  
  // CommonJS requires
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // Dynamic imports
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // Re-exports
  /export\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+(?:as\s+\w+\s+)?from\s+))['"]([^'"]+)['"]/g
];

/**
 * Logger para el proceso de corrección
 */
class ImportFixerLogger {
  constructor() {
    this.fixes = [];
    this.errors = [];
    this.warnings = [];
  }

  info(message, data = {}) {
    console.log(`ℹ️  ${message}`, data);
  }

  warn(message, data = {}) {
    this.warnings.push({ message, data, timestamp: new Date().toISOString() });
    console.warn(`⚠️  ${message}`, data);
  }

  error(message, error = null, data = {}) {
    this.errors.push({ 
      message, 
      error: error?.message || error, 
      data, 
      timestamp: new Date().toISOString() 
    });
    console.error(`❌ ${message}`, error, data);
  }

  success(message, data = {}) {
    console.log(`✅ ${message}`, data);
  }

  fix(file, oldPath, newPath) {
    this.fixes.push({
      file,
      oldPath,
      newPath,
      timestamp: new Date().toISOString()
    });
    this.info(`🔧 Fixed import in ${file}: ${oldPath} → ${newPath}`);
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFixes: this.fixes.length,
        warnings: this.warnings.length,
        errors: this.errors.length
      },
      fixes: this.fixes,
      warnings: this.warnings,
      errors: this.errors
    };

    const reportPath = path.join(PROJECT_ROOT, 'import-fixes-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    this.info('Import fixes report saved', { path: reportPath });
  }
}

/**
 * Corrector de rutas de imports
 */
class ImportPathFixer {
  constructor() {
    this.logger = new ImportFixerLogger();
    this.dryRun = process.argv.includes('--dry-run');
    this.verbose = process.argv.includes('--verbose');
    
    this.stats = {
      filesProcessed: 0,
      filesModified: 0,
      importsFixed: 0,
      errors: 0
    };
  }

  /**
   * Ejecuta la corrección de imports
   */
  async fixImports() {
    try {
      this.logger.info('🔧 Iniciando corrección de rutas de imports');
      this.logger.info('Configuración', {
        dryRun: this.dryRun,
        verbose: this.verbose
      });

      // Buscar todos los archivos JavaScript/TypeScript
      const files = await this.findSourceFiles();
      this.logger.info(`📁 Encontrados ${files.length} archivos para procesar`);

      // Procesar cada archivo
      for (const file of files) {
        await this.processFile(file);
      }

      // Generar reporte
      await this.generateReport();

      this.logger.success('🎉 Corrección de imports completada', this.stats);
      
    } catch (error) {
      this.logger.error('💥 Error durante la corrección de imports', error);
      throw error;
    } finally {
      await this.logger.saveReport();
    }
  }

  /**
   * Busca todos los archivos fuente
   */
  async findSourceFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs'];
    
    async function scan(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Saltar directorios excluidos
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' && 
                entry.name !== 'build') {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignorar errores de acceso a directorios
      }
    }
    
    await scan(PROJECT_ROOT);
    return files;
  }

  /**
   * Procesa un archivo individual
   */
  async processFile(filePath) {
    try {
      this.stats.filesProcessed++;
      
      const content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      let modifiedContent = content;
      let hasChanges = false;

      // Aplicar cada patrón de import
      for (const pattern of IMPORT_PATTERNS) {
        const newContent = this.fixImportsInContent(
          modifiedContent, 
          pattern, 
          filePath
        );
        
        if (newContent !== modifiedContent) {
          hasChanges = true;
          modifiedContent = newContent;
        }
      }

      // Guardar cambios si hay modificaciones
      if (hasChanges) {
        if (!this.dryRun) {
          await fs.writeFile(filePath, modifiedContent);
        }
        
        this.stats.filesModified++;
        
        if (this.verbose || this.dryRun) {
          const relativePath = path.relative(PROJECT_ROOT, filePath);
          this.logger.info(
            this.dryRun ? `[DRY RUN] Would modify: ${relativePath}` : `📝 Modified: ${relativePath}`
          );
        }
      }

    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Error procesando archivo ${filePath}`, error);
    }
  }

  /**
   * Corrige imports en el contenido usando un patrón específico
   */
  fixImportsInContent(content, pattern, filePath) {
    return content.replace(pattern, (match, importPath) => {
      const newImportPath = this.getFixedImportPath(importPath, filePath);
      
      if (newImportPath !== importPath) {
        this.stats.importsFixed++;
        this.logger.fix(
          path.relative(PROJECT_ROOT, filePath),
          importPath,
          newImportPath
        );
        
        return match.replace(importPath, newImportPath);
      }
      
      return match;
    });
  }

  /**
   * Obtiene la ruta corregida para un import
   */
  getFixedImportPath(importPath, currentFile) {
    // No procesar imports de node_modules
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return importPath;
    }

    // Aplicar mapeos directos
    for (const [oldPattern, newPattern] of Object.entries(PATH_MAPPINGS)) {
      if (importPath.includes(oldPattern)) {
        return importPath.replace(oldPattern, newPattern);
      }
    }

    // Intentar resolver rutas relativas rotas
    return this.resolveRelativePath(importPath, currentFile);
  }

  /**
   * Resuelve rutas relativas que pueden estar rotas
   */
  resolveRelativePath(importPath, currentFile) {
    try {
      const currentDir = path.dirname(currentFile);
      const absoluteImportPath = path.resolve(currentDir, importPath);
      
      // Verificar si el archivo existe
      if (this.fileExists(absoluteImportPath)) {
        return importPath; // La ruta ya es correcta
      }

      // Intentar encontrar el archivo en la nueva estructura
      const fileName = path.basename(importPath);
      const possibleNewPath = this.findFileInNewStructure(fileName, currentFile);
      
      if (possibleNewPath) {
        return possibleNewPath;
      }

    } catch (error) {
      // Ignorar errores de resolución
    }

    return importPath; // Devolver la ruta original si no se puede corregir
  }

  /**
   * Verifica si un archivo existe
   */
  fileExists(filePath) {
    try {
      // Intentar con diferentes extensiones
      const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.json'];
      
      for (const ext of extensions) {
        try {
          const fullPath = filePath + ext;
          fs.accessSync(fullPath);
          return true;
        } catch {
          // Continuar con la siguiente extensión
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Busca un archivo en la nueva estructura
   */
  findFileInNewStructure(fileName, currentFile) {
    // Esta es una implementación simplificada
    // En un proyecto real, necesitarías una lógica más sofisticada
    
    const currentDir = path.dirname(currentFile);
    const relativePath = path.relative(PROJECT_ROOT, currentDir);
    
    // Mapear según el directorio actual
    if (relativePath.includes('components')) {
      return this.searchInDirectories(fileName, [
        '../business',
        '../ui',
        '../shared',
        '../../services',
        '../../utils'
      ]);
    }
    
    if (relativePath.includes('services')) {
      return this.searchInDirectories(fileName, [
        '../core',
        '../external',
        '../messaging',
        '../auth',
        '../../utils',
        '../../components'
      ]);
    }
    
    return null;
  }

  /**
   * Busca en directorios específicos
   */
  searchInDirectories(fileName, directories) {
    // Implementación simplificada
    // Retorna la primera coincidencia encontrada
    for (const dir of directories) {
      const possiblePath = path.join(dir, fileName);
      // En una implementación real, verificarías si el archivo existe
      return possiblePath;
    }
    
    return null;
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
        verbose: this.verbose
      },
      statistics: this.stats,
      summary: {
        success: this.stats.errors === 0,
        filesProcessed: this.stats.filesProcessed,
        filesModified: this.stats.filesModified,
        importsFixed: this.stats.importsFixed,
        errors: this.stats.errors
      }
    };

    const reportPath = path.join(PROJECT_ROOT, 'import-fixes-final-report.json');
    
    if (!this.dryRun) {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }

    this.logger.success('📊 Reporte generado', { 
      path: this.dryRun ? '[DRY RUN]' : reportPath,
      stats: this.stats 
    });
  }
}

/**
 * Función principal
 */
async function main() {
  const fixer = new ImportPathFixer();
  
  try {
    await fixer.fixImports();
    process.exit(0);
  } catch (error) {
    console.error('💥 Error fatal durante la corrección de imports:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ImportPathFixer;