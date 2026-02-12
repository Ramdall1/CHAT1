/**
 * Analizador de Componentes UI
 * Maneja el análisis y documentación de componentes de interfaz de usuario
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../core/core/logger.js';

class ComponentAnalyzer {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './docs/components',
      componentsDir: config.componentsDir || './public',
      srcComponentsDir: config.srcComponentsDir || './src/components',
      excludePatterns: config.excludePatterns || ['node_modules', '.git', 'tests'],
      ...config
    };
    
    this.logger = createLogger('COMPONENT_ANALYZER');
  }

  /**
   * Genera documentación de componentes completa
   */
  async generate() {
    this.logger.info('🧩 Generando documentación de componentes...');
    
    try {
      // Crear directorio de salida
      this.ensureOutputDirectory();
      
      // Escanear componentes
      const components = await this.scanComponents();
      
      // Generar documentación HTML
      await this.generateHTML(components);
      
      // Generar catálogo de componentes
      await this.generateCatalog(components);
      
      this.logger.info('✅ Documentación de componentes generada exitosamente');
      return components;
      
    } catch (error) {
      this.logger.error('❌ Error generando documentación de componentes:', error);
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
   * Escanea componentes del sistema
   */
  async scanComponents() {
    const components = [];
    
    // Escanear componentes HTML
    const htmlComponents = await this.scanHTMLComponents();
    components.push(...htmlComponents);
    
    // Escanear componentes JavaScript
    const jsComponents = await this.scanJSComponents();
    components.push(...jsComponents);
    
    // Escanear componentes CSS
    const cssComponents = await this.scanCSSComponents();
    components.push(...cssComponents);
    
    return components;
  }

  /**
   * Escanea componentes HTML
   */
  async scanHTMLComponents() {
    const components = [];
    const htmlFiles = this.scanDirectory(this.config.componentsDir, ['.html']);
    
    for (const file of htmlFiles) {
      const component = this.analyzeHTMLComponent(file);
      if (component) {
        components.push(component);
      }
    }
    
    return components;
  }

  /**
   * Escanea componentes JavaScript
   */
  async scanJSComponents() {
    const components = [];
    const jsFiles = this.scanDirectory(this.config.srcComponentsDir, ['.js', '.jsx']);
    
    for (const file of jsFiles) {
      const component = this.analyzeJSComponent(file);
      if (component) {
        components.push(component);
      }
    }
    
    return components;
  }

  /**
   * Escanea componentes CSS
   */
  async scanCSSComponents() {
    const components = [];
    const cssFiles = this.scanDirectory(this.config.componentsDir, ['.css']);
    
    for (const file of cssFiles) {
      const component = this.analyzeCSSComponent(file);
      if (component) {
        components.push(component);
      }
    }
    
    return components;
  }

  /**
   * Analiza componente HTML
   */
  analyzeHTMLComponent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.html');
    
    // Extraer título
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : fileName;
    
    // Extraer descripción de meta
    const descMatch = content.match(/<meta name="description" content="(.*?)"/);
    const description = descMatch ? descMatch[1] : 'Sin descripción';
    
    // Analizar elementos interactivos
    const interactiveElements = this.analyzeInteractiveElements(content);
    
    // Analizar estructura
    const structure = this.analyzeHTMLStructure(content);
    
    // Extraer estilos inline
    const inlineStyles = this.extractInlineStyles(content);
    
    // Extraer scripts
    const scripts = this.extractScripts(content);
    
    return {
      name: fileName,
      title,
      description,
      file: filePath,
      type: 'html',
      stats: interactiveElements,
      structure,
      styles: inlineStyles,
      scripts,
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath)
    };
  }

  /**
   * Analiza componente JavaScript
   */
  analyzeJSComponent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extraer comentarios de documentación
    const docComment = this.extractDocComment(content);
    
    // Analizar clases y funciones
    const classes = this.extractClasses(content);
    const functions = this.extractFunctions(content);
    
    // Analizar imports/exports
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    
    // Analizar dependencias
    const dependencies = this.analyzeDependencies(content);
    
    return {
      name: fileName,
      title: docComment.title || fileName,
      description: docComment.description || 'Componente JavaScript',
      file: filePath,
      type: 'javascript',
      classes,
      functions,
      imports,
      exports,
      dependencies,
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath)
    };
  }

  /**
   * Analiza componente CSS
   */
  analyzeCSSComponent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.css');
    
    // Analizar selectores
    const selectors = this.extractCSSSelectors(content);
    
    // Analizar variables CSS
    const variables = this.extractCSSVariables(content);
    
    // Analizar media queries
    const mediaQueries = this.extractMediaQueries(content);
    
    // Analizar animaciones
    const animations = this.extractAnimations(content);
    
    return {
      name: fileName,
      title: fileName,
      description: 'Hoja de estilos CSS',
      file: filePath,
      type: 'css',
      selectors,
      variables,
      mediaQueries,
      animations,
      size: this.getFileSize(filePath),
      lastModified: this.getLastModified(filePath)
    };
  }

  /**
   * Analiza elementos interactivos en HTML
   */
  analyzeInteractiveElements(content) {
    return {
      buttons: (content.match(/<button/g) || []).length,
      forms: (content.match(/<form/g) || []).length,
      inputs: (content.match(/<input/g) || []).length,
      links: (content.match(/<a\s+href/g) || []).length,
      selects: (content.match(/<select/g) || []).length,
      textareas: (content.match(/<textarea/g) || []).length,
      images: (content.match(/<img/g) || []).length,
      videos: (content.match(/<video/g) || []).length,
      audios: (content.match(/<audio/g) || []).length
    };
  }

  /**
   * Analiza estructura HTML
   */
  analyzeHTMLStructure(content) {
    return {
      hasHeader: /<header/i.test(content),
      hasNav: /<nav/i.test(content),
      hasMain: /<main/i.test(content),
      hasAside: /<aside/i.test(content),
      hasFooter: /<footer/i.test(content),
      hasSections: (content.match(/<section/g) || []).length,
      hasArticles: (content.match(/<article/g) || []).length,
      hasDivs: (content.match(/<div/g) || []).length
    };
  }

  /**
   * Extrae estilos inline
   */
  extractInlineStyles(content) {
    const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    return styleMatches.map(match => {
      const styleContent = match.replace(/<\/?style[^>]*>/gi, '');
      return styleContent.trim();
    });
  }

  /**
   * Extrae scripts
   */
  extractScripts(content) {
    const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    return scriptMatches.map(match => {
      const scriptContent = match.replace(/<\/?script[^>]*>/gi, '');
      return scriptContent.trim();
    });
  }

  /**
   * Extrae comentario de documentación
   */
  extractDocComment(content) {
    const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (!docMatch) return {};
    
    const comment = docMatch[1];
    const lines = comment.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    
    let title = '';
    let description = '';
    
    for (const line of lines) {
      if (line.startsWith('@title')) {
        title = line.replace('@title', '').trim();
      } else if (line.startsWith('@description')) {
        description = line.replace('@description', '').trim();
      } else if (line.trim() && !title) {
        title = line;
      } else if (line.trim() && !description) {
        description = line;
      }
    }
    
    return { title, description };
  }

  /**
   * Extrae clases de JavaScript
   */
  extractClasses(content) {
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    return classMatches.map(match => match.replace('class ', ''));
  }

  /**
   * Extrae funciones de JavaScript
   */
  extractFunctions(content) {
    const functionMatches = content.match(/(?:function\s+(\w+)|(\w+)\s*\()/g) || [];
    return functionMatches.map(match => {
      return match.replace(/function\s+|[\(\s]/g, '');
    }).filter(name => name && name !== 'if' && name !== 'for' && name !== 'while');
  }

  /**
   * Extrae imports de JavaScript
   */
  extractImports(content) {
    const importMatches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
    return importMatches.map(match => {
      const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
      return moduleMatch ? moduleMatch[1] : '';
    });
  }

  /**
   * Extrae exports de JavaScript
   */
  extractExports(content) {
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g) || [];
    return exportMatches.map(match => {
      const nameMatch = match.match(/(?:class|function|const|let|var)\s+(\w+)/);
      return nameMatch ? nameMatch[1] : '';
    });
  }

  /**
   * Analiza dependencias
   */
  analyzeDependencies(content) {
    const dependencies = new Set();
    
    // Buscar imports de librerías externas
    const importMatches = content.match(/import\s+.*?from\s+['"`]([^'"`\.\/][^'"`]*)['"`]/g) || [];
    importMatches.forEach(match => {
      const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
      if (moduleMatch) {
        dependencies.add(moduleMatch[1]);
      }
    });
    
    return Array.from(dependencies);
  }

  /**
   * Extrae selectores CSS
   */
  extractCSSSelectors(content) {
    const selectorMatches = content.match(/([^{}]+)\s*\{[^{}]*\}/g) || [];
    return selectorMatches.map(match => {
      return match.split('{')[0].trim();
    });
  }

  /**
   * Extrae variables CSS
   */
  extractCSSVariables(content) {
    const variableMatches = content.match(/--[\w-]+/g) || [];
    return [...new Set(variableMatches)];
  }

  /**
   * Extrae media queries
   */
  extractMediaQueries(content) {
    const mediaMatches = content.match(/@media[^{]+/g) || [];
    return mediaMatches.map(match => match.trim());
  }

  /**
   * Extrae animaciones CSS
   */
  extractAnimations(content) {
    const animationMatches = content.match(/@keyframes\s+[\w-]+/g) || [];
    return animationMatches.map(match => match.replace('@keyframes ', '').trim());
  }

  /**
   * Genera documentación HTML
   */
  async generateHTML(components) {
    const template = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentación de Componentes - ChatBot</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; border-radius: 8px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .component { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .component-header { display: flex; justify-content: between; align-items: center; margin-bottom: 15px; }
        .component-name { font-size: 1.3em; font-weight: bold; color: #007bff; }
        .component-type { background: #007bff; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.8em; margin-left: 10px; }
        .component-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
        .meta-item { background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .meta-label { font-weight: bold; color: #6c757d; font-size: 0.9em; }
        .meta-value { color: #333; }
        .stats { display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap; }
        .stat { background: #e9ecef; padding: 5px 10px; border-radius: 15px; font-size: 0.8em; }
        .filter-bar { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .filter-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        .filter-btn { background: #e9ecef; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; transition: all 0.3s; }
        .filter-btn.active { background: #007bff; color: white; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .summary-item { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .summary-label { color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧩 Documentación de Componentes</h1>
            <p>Catálogo completo de componentes del sistema ChatBot</p>
            <p><strong>Generado:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-number">${components.length}</div>
                <div class="summary-label">Total Componentes</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${components.filter(c => c.type === 'html').length}</div>
                <div class="summary-label">HTML</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${components.filter(c => c.type === 'javascript').length}</div>
                <div class="summary-label">JavaScript</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${components.filter(c => c.type === 'css').length}</div>
                <div class="summary-label">CSS</div>
            </div>
        </div>
        
        <div class="filter-bar">
            <h3>Filtrar por tipo:</h3>
            <div class="filter-buttons">
                <button class="filter-btn active" onclick="filterComponents('all')">Todos</button>
                <button class="filter-btn" onclick="filterComponents('html')">HTML</button>
                <button class="filter-btn" onclick="filterComponents('javascript')">JavaScript</button>
                <button class="filter-btn" onclick="filterComponents('css')">CSS</button>
            </div>
        </div>
        
        <div id="components-container">
            ${components.map(component => this.generateComponentHTML(component)).join('')}
        </div>
    </div>
    
    <script>
        function filterComponents(type) {
            const components = document.querySelectorAll('.component');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            components.forEach(component => {
                if (type === 'all' || component.dataset.type === type) {
                    component.style.display = 'block';
                } else {
                    component.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(`${this.config.outputDir}/index.html`, template);
  }

  /**
   * Genera HTML para un componente individual
   */
  generateComponentHTML(component) {
    let statsHTML = '';
    
    if (component.type === 'html' && component.stats) {
      statsHTML = `
                <div class="stats">
                    ${Object.entries(component.stats).map(([key, value]) => 
        `<span class="stat">${key}: ${value}</span>`
      ).join('')}
                </div>`;
    }
    
    return `
            <div class="component" data-type="${component.type}">
                <div class="component-header">
                    <div>
                        <span class="component-name">${component.title || component.name}</span>
                        <span class="component-type">${component.type.toUpperCase()}</span>
                    </div>
                </div>
                <div><strong>Descripción:</strong> ${component.description}</div>
                <div class="component-meta">
                    <div class="meta-item">
                        <div class="meta-label">Archivo</div>
                        <div class="meta-value">${component.file}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Tamaño</div>
                        <div class="meta-value">${component.size} bytes</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Última modificación</div>
                        <div class="meta-value">${component.lastModified}</div>
                    </div>
                </div>
                ${statsHTML}
            </div>`;
  }

  /**
   * Genera catálogo de componentes en JSON
   */
  async generateCatalog(components) {
    const catalog = {
      generatedAt: new Date().toISOString(),
      totalComponents: components.length,
      componentsByType: {
        html: components.filter(c => c.type === 'html').length,
        javascript: components.filter(c => c.type === 'javascript').length,
        css: components.filter(c => c.type === 'css').length
      },
      components: components.map(component => ({
        name: component.name,
        title: component.title,
        description: component.description,
        type: component.type,
        file: component.file,
        size: component.size,
        lastModified: component.lastModified
      }))
    };
    
    fs.writeFileSync(`${this.config.outputDir}/catalog.json`, JSON.stringify(catalog, null, 2));
  }

  /**
   * Escanea directorio con filtros de extensión
   */
  scanDirectory(dir, extensions = []) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!this.config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
          files.push(...this.scanDirectory(fullPath, extensions));
        }
      } else {
        if (extensions.length === 0 || extensions.some(ext => fullPath.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Obtiene el tamaño del archivo
   */
  getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Obtiene la fecha de última modificación
   */
  getLastModified(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mtime.toLocaleString();
  }

  /**
   * Obtiene estadísticas de los componentes analizados
   */
  getStats(components) {
    return {
      total: components.length,
      byType: {
        html: components.filter(c => c.type === 'html').length,
        javascript: components.filter(c => c.type === 'javascript').length,
        css: components.filter(c => c.type === 'css').length
      },
      totalSize: components.reduce((sum, c) => sum + c.size, 0),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Valida la configuración del analizador
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.outputDir) {
      errors.push('Directorio de salida no especificado');
    }
    
    if (!fs.existsSync(this.config.componentsDir) && !fs.existsSync(this.config.srcComponentsDir)) {
      errors.push('Ningún directorio de componentes existe');
    }
    
    return errors;
  }
}

export default ComponentAnalyzer;