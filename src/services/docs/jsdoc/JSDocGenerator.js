/**
 * Generador de Documentación JSDoc
 * Maneja la extracción de comentarios JSDoc y generación de documentación HTML
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../core/core/logger.js';

class JSDocGenerator {
  constructor(config = {}) {
    this.config = {
      sourceDir: config.sourceDir || './src',
      outputDir: config.outputDir || './docs/jsdoc',
      excludePatterns: config.excludePatterns || ['node_modules', '.git', 'tests'],
      ...config
    };
    
    this.logger = createLogger('JSDOC_GENERATOR');
  }

  /**
   * Genera documentación JSDoc completa
   */
  async generate() {
    this.logger.info('📝 Generando documentación JSDoc...');
    
    try {
      // Crear directorio de salida
      this.ensureOutputDirectory();
      
      // Escanear archivos fuente
      const sourceFiles = await this.scanSourceFiles();
      
      // Extraer comentarios JSDoc
      const jsdocData = await this.extractJSDocComments(sourceFiles);
      
      // Generar HTML
      await this.generateHTML(jsdocData);
      
      this.logger.info('✅ JSDoc generado exitosamente');
      return jsdocData;
      
    } catch (error) {
      this.logger.error('❌ Error generando JSDoc:', error);
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
   * Escanea archivos fuente para documentación
   */
  async scanSourceFiles() {
    const files = [];
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!this.config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            scanDirectory(fullPath);
          }
        } else if (this.isSourceFile(fullPath)) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(this.config.sourceDir);
    return files;
  }

  /**
   * Verifica si un archivo es un archivo fuente válido
   */
  isSourceFile(filePath) {
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx'];
    return validExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Extrae comentarios JSDoc de los archivos
   */
  async extractJSDocComments(files) {
    const jsdocData = {
      classes: [],
      functions: [],
      modules: [],
      constants: []
    };

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(process.cwd(), file);
      
      // Extraer diferentes tipos de elementos
      const classes = this.extractClasses(content, relativePath);
      jsdocData.classes.push(...classes);
      
      const functions = this.extractFunctions(content, relativePath);
      jsdocData.functions.push(...functions);
      
      const modules = this.extractModules(content, relativePath);
      jsdocData.modules.push(...modules);
      
      const constants = this.extractConstants(content, relativePath);
      jsdocData.constants.push(...constants);
    }

    return jsdocData;
  }

  /**
   * Extrae información de clases
   */
  extractClasses(content, filePath) {
    const classes = [];
    const classRegex = /\/\*\*([\s\S]*?)\*\/\s*class\s+(\w+)/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const [, comment, className] = match;
      classes.push({
        name: className,
        description: this.parseJSDocComment(comment),
        file: filePath,
        type: 'class'
      });
    }

    return classes;
  }

  /**
   * Extrae información de funciones
   */
  extractFunctions(content, filePath) {
    const functions = [];
    const functionRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?(?:function\s+)?(\w+)\s*\(/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const [, comment, functionName] = match;
      functions.push({
        name: functionName,
        description: this.parseJSDocComment(comment),
        file: filePath,
        type: 'function'
      });
    }

    return functions;
  }

  /**
   * Extrae información de módulos
   */
  extractModules(content, filePath) {
    const modules = [];
    const moduleRegex = /\/\*\*([\s\S]*?)\*\/\s*module\.exports/g;
    let match;

    while ((match = moduleRegex.exec(content)) !== null) {
      const [, comment] = match;
      modules.push({
        name: path.basename(filePath, path.extname(filePath)),
        description: this.parseJSDocComment(comment),
        file: filePath,
        type: 'module'
      });
    }

    return modules;
  }

  /**
   * Extrae constantes importantes
   */
  extractConstants(content, filePath) {
    const constants = [];
    const constantRegex = /\/\*\*([\s\S]*?)\*\/\s*const\s+(\w+)/g;
    let match;

    while ((match = constantRegex.exec(content)) !== null) {
      const [, comment, constantName] = match;
      constants.push({
        name: constantName,
        description: this.parseJSDocComment(comment),
        file: filePath,
        type: 'constant'
      });
    }

    return constants;
  }

  /**
   * Parsea comentarios JSDoc
   */
  parseJSDocComment(comment) {
    try {
      const lines = comment.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
      const description = [];
      const tags = {};

      let currentTag = null;

      for (const line of lines) {
        if (line.startsWith('@')) {
          const tagMatch = line.match(/@(\w+)\s*(.*)/);
          if (tagMatch) {
            currentTag = tagMatch[1];
            // Ensure tags[currentTag] is always an array
            if (!Array.isArray(tags[currentTag])) {
              tags[currentTag] = [];
            }
            tags[currentTag].push(tagMatch[2] || '');
          }
        } else if (currentTag && Array.isArray(tags[currentTag]) && tags[currentTag].length > 0) {
          const lastIndex = tags[currentTag].length - 1;
          tags[currentTag][lastIndex] += ' ' + line;
        } else if (line.trim()) {
          description.push(line);
        }
      }

      return {
        description: description.join(' '),
        tags
      };
    } catch (error) {
      this.logger.error('Error parsing JSDoc comment:', error);
      return {
        description: '',
        tags: {}
      };
    }
  }

  /**
   * Genera HTML para JSDoc
   */
  async generateHTML(jsdocData) {
    const template = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentación JSDoc - ChatBot</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .item { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 15px; }
        .item-name { font-size: 1.2em; font-weight: bold; color: #007bff; }
        .item-type { background: #007bff; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; }
        .item-file { color: #6c757d; font-size: 0.9em; }
        .item-description { margin-top: 10px; }
        .nav { background: #343a40; color: white; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .nav a { color: #fff; text-decoration: none; margin-right: 20px; }
        .nav a:hover { text-decoration: underline; }
        .stats { background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; text-align: center; }
        .stat-item { background: white; padding: 10px; border-radius: 3px; }
        .stat-number { font-size: 1.5em; font-weight: bold; color: #007bff; }
        .stat-label { font-size: 0.9em; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Documentación JSDoc - ChatBot</h1>
            <p>Documentación automática generada el ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="stats">
            <h3>📊 Estadísticas de Documentación</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${jsdocData.classes.length}</div>
                    <div class="stat-label">Clases</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${jsdocData.functions.length}</div>
                    <div class="stat-label">Funciones</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${jsdocData.modules.length}</div>
                    <div class="stat-label">Módulos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${jsdocData.constants.length}</div>
                    <div class="stat-label">Constantes</div>
                </div>
            </div>
        </div>
        
        <div class="nav">
            <a href="#classes">Clases</a>
            <a href="#functions">Funciones</a>
            <a href="#modules">Módulos</a>
            <a href="#constants">Constantes</a>
        </div>

        <div id="classes" class="section">
            <h2>🏗️ Clases (${jsdocData.classes.length})</h2>
            ${jsdocData.classes.map(item => this.generateItemHTML(item)).join('')}
        </div>

        <div id="functions" class="section">
            <h2>⚙️ Funciones (${jsdocData.functions.length})</h2>
            ${jsdocData.functions.map(item => this.generateItemHTML(item)).join('')}
        </div>

        <div id="modules" class="section">
            <h2>📦 Módulos (${jsdocData.modules.length})</h2>
            ${jsdocData.modules.map(item => this.generateItemHTML(item)).join('')}
        </div>

        <div id="constants" class="section">
            <h2>🔧 Constantes (${jsdocData.constants.length})</h2>
            ${jsdocData.constants.map(item => this.generateItemHTML(item)).join('')}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(`${this.config.outputDir}/index.html`, template);
  }

  /**
   * Genera HTML para un elemento individual
   */
  generateItemHTML(item) {
    return `
            <div class="item">
                <div>
                    <span class="item-name">${item.name}</span>
                    <span class="item-type">${item.type}</span>
                </div>
                <div class="item-file">📁 ${item.file}</div>
                <div class="item-description">${item.description.description || 'Sin descripción'}</div>
                ${item.description.tags && Object.keys(item.description.tags).length > 0 ? 
      `<div style="margin-top: 10px; font-size: 0.9em;">
                        ${Object.entries(item.description.tags).map(([tag, values]) => 
        `<strong>@${tag}:</strong> ${values.join(', ')}`
      ).join('<br>')}
                    </div>` : ''
    }
            </div>`;
  }

  /**
   * Obtiene estadísticas de la documentación generada
   */
  getStats(jsdocData) {
    return {
      totalElements: jsdocData.classes.length + jsdocData.functions.length + 
                    jsdocData.modules.length + jsdocData.constants.length,
      classes: jsdocData.classes.length,
      functions: jsdocData.functions.length,
      modules: jsdocData.modules.length,
      constants: jsdocData.constants.length,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Valida la configuración del generador
   */
  validateConfig() {
    const errors = [];
    
    if (!fs.existsSync(this.config.sourceDir)) {
      errors.push(`Directorio fuente no existe: ${this.config.sourceDir}`);
    }
    
    if (!this.config.outputDir) {
      errors.push('Directorio de salida no especificado');
    }
    
    return errors;
  }
}

export default JSDocGenerator;