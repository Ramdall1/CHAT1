/**
 * Generador de Documentación Automática
 * Orquesta la generación de documentación usando módulos especializados
 */

import DocumentationCoordinator from '../services/docs/core/DocumentationCoordinator.js';
import { createLogger } from '../services/core/core/logger.js';

class DocumentationGenerator {
  constructor(config = {}) {
    this.config = {
      sourceDir: config.sourceDir || './src',
      outputDir: config.outputDir || './docs',
      publicDir: config.publicDir || './public',
      projectRoot: config.projectRoot || '.',
      excludePatterns: config.excludePatterns || ['node_modules', '.git', 'tests'],
      ...config
    };
    
    this.logger = createLogger('DOC_GENERATOR');
    this.coordinator = new DocumentationCoordinator(this.config);
  }

  /**
   * Genera toda la documentación usando el coordinador
   */
  async generateAll() {
    this.logger.info('🚀 Iniciando generación de documentación...');
    
    try {
      await this.coordinator.generateAll();
      this.logger.info('✅ Documentación generada exitosamente');
    } catch (error) {
      this.logger.error('❌ Error generando documentación:', error);
      throw error;
    }
  }

  /**
   * Genera solo documentación JSDoc
   */
  async generateJSDoc() {
    return this.coordinator.generateJSDoc();
  }

  /**
   * Genera solo documentación Swagger
   */
  async generateSwagger() {
    return this.coordinator.generateSwagger();
  }

  /**
   * Genera solo documentación de componentes
   */
  async generateComponentDocs() {
    return this.coordinator.generateComponentDocs();
  }

  /**
   * Genera solo README
   */
  async generateReadme() {
    return this.coordinator.generateReadme();
  }

  /**
   * Genera solo índice de documentación
   */
  async generateIndex() {
    return this.coordinator.generateIndex();
  }

  /**
   * Obtiene estadísticas del proyecto
   */
  async getProjectStats() {
    return this.coordinator.getProjectStats();
  }

  /**
   * Obtiene el estado del coordinador
   */
  getStatus() {
    return this.coordinator.getGeneratorsStatus();
  }

  /**
   * Limpia la documentación generada
   */
  async clean() {
    return this.coordinator.clean();
  }

  /**
   * Valida la configuración
   */
  validateConfig() {
    return this.coordinator.validateConfig();
  }
}

export default DocumentationGenerator;

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new DocumentationGenerator();
  generator.generateAll().catch(error => {
    logger.error('Error:', error);
    process.exit(1);
  });
}