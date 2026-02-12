/**
 * Coordinador de Documentación
 * Orquesta todos los generadores de documentación y coordina la generación completa
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../core/core/logger.js';
import JSDocGenerator from '../jsdoc/JSDocGenerator.js';
import SwaggerGenerator from '../swagger/SwaggerGenerator.js';
import ComponentAnalyzer from '../components/ComponentAnalyzer.js';
import ReadmeGenerator from '../readme/ReadmeGenerator.js';

class DocumentationCoordinator {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './docs',
      projectRoot: config.projectRoot || '.',
      sourceDir: config.sourceDir || './src',
      publicDir: config.publicDir || './public',
      generateJSDoc: config.generateJSDoc !== false,
      generateSwagger: config.generateSwagger !== false,
      generateComponents: config.generateComponents !== false,
      generateReadme: config.generateReadme !== false,
      generateIndex: config.generateIndex !== false,
      ...config
    };
    
    this.logger = createLogger('DOC_COORDINATOR');
    this.generators = {};
    this.stats = {
      startTime: null,
      endTime: null,
      duration: 0,
      generated: {
        jsdoc: false,
        swagger: false,
        components: false,
        readme: false,
        index: false
      },
      errors: [],
      warnings: []
    };
    
    this.initializeGenerators();
  }

  /**
   * Inicializa todos los generadores
   */
  initializeGenerators() {
    try {
      if (this.config.generateJSDoc) {
        this.generators.jsdoc = new JSDocGenerator({
          sourceDir: this.config.sourceDir,
          outputDir: path.join(this.config.outputDir, 'jsdoc'),
          projectRoot: this.config.projectRoot
        });
      }

      if (this.config.generateSwagger) {
        this.generators.swagger = new SwaggerGenerator({
          sourceDir: this.config.sourceDir,
          outputDir: path.join(this.config.outputDir, 'swagger'),
          projectRoot: this.config.projectRoot
        });
      }

      if (this.config.generateComponents) {
        this.generators.components = new ComponentAnalyzer({
          sourceDir: this.config.publicDir,
          outputDir: path.join(this.config.outputDir, 'components'),
          projectRoot: this.config.projectRoot
        });
      }

      if (this.config.generateReadme) {
        this.generators.readme = new ReadmeGenerator({
          outputDir: this.config.outputDir,
          projectRoot: this.config.projectRoot
        });
      }

      this.logger.info('✅ Generadores inicializados correctamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando generadores:', error);
      throw error;
    }
  }

  /**
   * Genera toda la documentación
   */
  async generateAll() {
    this.logger.info('🚀 Iniciando generación completa de documentación...');
    this.stats.startTime = Date.now();
    
    try {
      // Crear directorio principal
      this.ensureOutputDirectory();
      
      // Generar documentación en paralelo donde sea posible
      const results = await this.executeGenerationPipeline();
      
      // Generar índice principal
      if (this.config.generateIndex) {
        await this.generateMainIndex(results);
        this.stats.generated.index = true;
      }
      
      // Calcular estadísticas finales
      this.calculateFinalStats();
      
      this.logger.info('✅ Documentación generada exitosamente');
      this.logger.info(`⏱️  Tiempo total: ${this.stats.duration}ms`);
      
      return {
        success: true,
        stats: this.stats,
        results
      };
      
    } catch (error) {
      this.stats.errors.push(error.message);
      this.logger.error('❌ Error en generación de documentación:', error);
      throw error;
    } finally {
      this.stats.endTime = Date.now();
      this.stats.duration = this.stats.endTime - this.stats.startTime;
    }
  }

  /**
   * Ejecuta el pipeline de generación
   */
  async executeGenerationPipeline() {
    const results = {};
    
    // Fase 1: Generación independiente (paralelo)
    const independentTasks = [];
    
    if (this.generators.jsdoc) {
      independentTasks.push(
        this.executeWithErrorHandling('jsdoc', () => this.generators.jsdoc.generate())
      );
    }
    
    if (this.generators.swagger) {
      independentTasks.push(
        this.executeWithErrorHandling('swagger', () => this.generators.swagger.generate())
      );
    }
    
    if (this.generators.components) {
      independentTasks.push(
        this.executeWithErrorHandling('components', () => this.generators.components.generate())
      );
    }
    
    // Ejecutar tareas independientes en paralelo
    const independentResults = await Promise.allSettled(independentTasks);
    
    // Procesar resultados de tareas independientes
    independentResults.forEach((result, index) => {
      const taskNames = ['jsdoc', 'swagger', 'components'];
      const taskName = taskNames[index];
      
      if (result.status === 'fulfilled') {
        results[taskName] = result.value;
        this.stats.generated[taskName] = true;
      } else {
        this.stats.errors.push(`Error en ${taskName}: ${result.reason}`);
        this.logger.error(`❌ Error en ${taskName}:`, result.reason);
      }
    });
    
    // Fase 2: README (depende de estadísticas de otros generadores)
    if (this.generators.readme) {
      try {
        results.readme = await this.executeWithErrorHandling('readme', () => 
          this.generators.readme.generate()
        );
        this.stats.generated.readme = true;
      } catch (error) {
        this.stats.errors.push(`Error en README: ${error.message}`);
        this.logger.error('❌ Error generando README:', error);
      }
    }
    
    return results;
  }

  /**
   * Ejecuta una tarea con manejo de errores
   */
  async executeWithErrorHandling(taskName, taskFunction) {
    try {
      this.logger.info(`📝 Generando ${taskName}...`);
      const result = await taskFunction();
      this.logger.info(`✅ ${taskName} generado exitosamente`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error generando ${taskName}:`, error);
      throw error;
    }
  }

  /**
   * Asegura que el directorio de salida existe
   */
  ensureOutputDirectory() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Genera el índice principal de documentación
   */
  async generateMainIndex(results) {
    this.logger.info('📋 Generando índice principal...');
    
    const indexContent = this.generateIndexHTML(results);
    const indexPath = path.join(this.config.outputDir, 'index.html');
    
    fs.writeFileSync(indexPath, indexContent);
    
    // También generar un índice JSON para APIs
    const indexData = this.generateIndexData(results);
    const indexDataPath = path.join(this.config.outputDir, 'index.json');
    
    fs.writeFileSync(indexDataPath, JSON.stringify(indexData, null, 2));
  }

  /**
   * Genera el HTML del índice principal
   */
  generateIndexHTML(results) {
    const packageInfo = this.getPackageInfo();
    const generationTime = new Date().toLocaleString();
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentación - ${packageInfo.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 3rem;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .docs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        
        .doc-card {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .doc-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 48px rgba(0,0,0,0.15);
        }
        
        .doc-card h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .doc-card p {
            color: #666;
            margin-bottom: 1.5rem;
        }
        
        .doc-card .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .doc-card .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
        }
        
        .doc-card.disabled {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .stats {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 2rem;
            color: white;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .stats h3 {
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .stat-item {
            text-align: center;
            padding: 1rem;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            display: block;
        }
        
        .stat-label {
            font-size: 0.9rem;
            opacity: 0.8;
        }
        
        .footer {
            text-align: center;
            color: white;
            margin-top: 3rem;
            opacity: 0.8;
        }
        
        .icon {
            font-size: 1.2rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .docs-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Centro de Documentación</h1>
            <p>${packageInfo.description}</p>
            <p><strong>Versión:</strong> ${packageInfo.version} | <strong>Generado:</strong> ${generationTime}</p>
        </div>
        
        <div class="docs-grid">
            <div class="doc-card ${this.stats.generated.jsdoc ? '' : 'disabled'}">
                <h3><span class="icon">📖</span> Documentación JSDoc</h3>
                <p>Documentación completa del código fuente con JSDoc. Incluye clases, funciones, módulos y constantes.</p>
                ${this.stats.generated.jsdoc ? 
                  '<a href="./jsdoc/index.html" class="btn">Ver Documentación</a>' : 
                  '<span class="btn" style="background: #ccc;">No Disponible</span>'
                }
            </div>
            
            <div class="doc-card ${this.stats.generated.swagger ? '' : 'disabled'}">
                <h3><span class="icon">🔌</span> API Documentation</h3>
                <p>Documentación interactiva de la API REST con Swagger/OpenAPI. Prueba endpoints directamente.</p>
                ${this.stats.generated.swagger ? 
                  '<a href="./swagger/index.html" class="btn">Ver API Docs</a>' : 
                  '<span class="btn" style="background: #ccc;">No Disponible</span>'
                }
            </div>
            
            <div class="doc-card ${this.stats.generated.components ? '' : 'disabled'}">
                <h3><span class="icon">🧩</span> Catálogo de Componentes</h3>
                <p>Documentación de componentes UI, elementos HTML, CSS y JavaScript del frontend.</p>
                ${this.stats.generated.components ? 
                  '<a href="./components/index.html" class="btn">Ver Componentes</a>' : 
                  '<span class="btn" style="background: #ccc;">No Disponible</span>'
                }
            </div>
            
            <div class="doc-card ${this.stats.generated.readme ? '' : 'disabled'}">
                <h3><span class="icon">📋</span> README del Proyecto</h3>
                <p>Guía completa del proyecto con instalación, configuración, uso y contribución.</p>
                ${this.stats.generated.readme ? 
                  '<a href="./README.md" class="btn">Ver README</a>' : 
                  '<span class="btn" style="background: #ccc;">No Disponible</span>'
                }
            </div>
        </div>
        
        <div class="stats">
            <h3>📊 Estadísticas de Generación</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${this.stats.duration}ms</span>
                    <span class="stat-label">Tiempo de Generación</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${Object.values(this.stats.generated).filter(Boolean).length}</span>
                    <span class="stat-label">Documentos Generados</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${this.stats.errors.length}</span>
                    <span class="stat-label">Errores</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${this.stats.warnings.length}</span>
                    <span class="stat-label">Advertencias</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Generado automáticamente por DocumentationCoordinator v1.0.0</p>
            <p>Sistema de ChatBot - ${packageInfo.author}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Genera datos del índice en formato JSON
   */
  generateIndexData(results) {
    return {
      project: this.getPackageInfo(),
      generation: {
        timestamp: new Date().toISOString(),
        duration: this.stats.duration,
        generated: this.stats.generated,
        errors: this.stats.errors,
        warnings: this.stats.warnings
      },
      documentation: {
        jsdoc: this.stats.generated.jsdoc ? {
          url: './jsdoc/index.html',
          available: true,
          stats: results.jsdoc?.stats || null
        } : { available: false },
        swagger: this.stats.generated.swagger ? {
          url: './swagger/index.html',
          available: true,
          stats: results.swagger?.stats || null
        } : { available: false },
        components: this.stats.generated.components ? {
          url: './components/index.html',
          available: true,
          stats: results.components?.stats || null
        } : { available: false },
        readme: this.stats.generated.readme ? {
          url: './README.md',
          available: true,
          stats: results.readme?.stats || null
        } : { available: false }
      }
    };
  }

  /**
   * Obtiene información del package.json
   */
  getPackageInfo() {
    try {
      const packagePath = path.join(this.config.projectRoot, 'package.json');
      if (fs.existsSync(packagePath)) {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      }
    } catch (error) {
      this.logger.warn('No se pudo leer package.json:', error.message);
    }
    
    return {
      name: 'ChatBot System',
      version: '1.0.0',
      description: 'Sistema de ChatBot avanzado con múltiples funcionalidades',
      author: 'Equipo de Desarrollo'
    };
  }

  /**
   * Calcula estadísticas finales
   */
  calculateFinalStats() {
    const generatedCount = Object.values(this.stats.generated).filter(Boolean).length;
    const totalPossible = Object.keys(this.stats.generated).length;
    
    this.stats.completionRate = (generatedCount / totalPossible) * 100;
    this.stats.success = this.stats.errors.length === 0;
  }

  /**
   * Genera solo un tipo específico de documentación
   */
  async generateSpecific(type) {
    if (!this.generators[type]) {
      throw new Error(`Generador no disponible: ${type}`);
    }
    
    this.logger.info(`📝 Generando documentación específica: ${type}`);
    
    try {
      const result = await this.generators[type].generate();
      this.logger.info(`✅ ${type} generado exitosamente`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error generando ${type}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de todos los generadores
   */
  getGeneratorsStatus() {
    return {
      available: Object.keys(this.generators),
      configured: {
        jsdoc: this.config.generateJSDoc,
        swagger: this.config.generateSwagger,
        components: this.config.generateComponents,
        readme: this.config.generateReadme,
        index: this.config.generateIndex
      },
      stats: this.stats
    };
  }

  /**
   * Limpia la documentación generada
   */
  async clean() {
    this.logger.info('🧹 Limpiando documentación anterior...');
    
    if (fs.existsSync(this.config.outputDir)) {
      fs.rmSync(this.config.outputDir, { recursive: true, force: true });
    }
    
    this.logger.info('✅ Documentación limpiada');
  }

  /**
   * Obtiene estadísticas del proyecto
   */
  async getProjectStats() {
    try {
      const packageInfo = this.getPackageInfo();
      const stats = {
        project: {
          name: packageInfo.name || 'Unknown',
          version: packageInfo.version || '1.0.0',
          description: packageInfo.description || ''
        },
        files: {
          total: 0,
          source: 0,
          tests: 0,
          docs: 0
        },
        lines: {
          total: 0,
          code: 0,
          comments: 0,
          blank: 0
        },
        generators: this.getGeneratorsStatus(),
        lastGenerated: new Date().toISOString()
      };

      // Scan source directory for file statistics
      if (fs.existsSync(this.config.sourceDir)) {
        await this.scanDirectoryStats(this.config.sourceDir, stats);
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting project stats:', error);
      return {
        project: { name: 'Unknown', version: '1.0.0', description: '' },
        files: { total: 0, source: 0, tests: 0, docs: 0 },
        lines: { total: 0, code: 0, comments: 0, blank: 0 },
        generators: this.getGeneratorsStatus(),
        lastGenerated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Escanea un directorio para obtener estadísticas
   */
  async scanDirectoryStats(dirPath, stats) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(item)) {
            await this.scanDirectoryStats(itemPath, stats);
          }
        } else if (stat.isFile()) {
          stats.files.total++;
          
          const ext = path.extname(item);
          if (['.js', '.ts', '.jsx', '.tsx', '.vue'].includes(ext)) {
            stats.files.source++;
            
            if (item.includes('.test.') || item.includes('.spec.')) {
              stats.files.tests++;
            }
          } else if (['.md', '.txt', '.html'].includes(ext)) {
            stats.files.docs++;
          }
          
          // Count lines (simplified)
          try {
            const content = fs.readFileSync(itemPath, 'utf8');
            const lines = content.split('\n');
            stats.lines.total += lines.length;
            
            // Simple heuristic for code vs comments vs blank
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) {
                stats.lines.blank++;
              } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                stats.lines.comments++;
              } else {
                stats.lines.code++;
              }
            }
          } catch (err) {
            // Skip files that can't be read as text
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error scanning directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Valida la configuración del coordinador
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.outputDir) {
      errors.push('Directorio de salida no especificado');
    }
    
    if (!fs.existsSync(this.config.projectRoot)) {
      errors.push(`Directorio raíz del proyecto no existe: ${this.config.projectRoot}`);
    }
    
    if (!fs.existsSync(this.config.sourceDir)) {
      errors.push(`Directorio fuente no existe: ${this.config.sourceDir}`);
    }
    
    return errors;
  }
}

export default DocumentationCoordinator;