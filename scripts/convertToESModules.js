import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para convertir archivos de CommonJS a ES modules
 */
class ESModuleConverter {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.filesToConvert = [];
    this.conversions = 0;
  }

  /**
     * Encuentra todos los archivos JS que necesitan conversión
     */
  findJSFiles(dir) {
    const files = fs.readdirSync(dir);
        
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
            
      if (stat.isDirectory()) {
        // Evitar node_modules y otros directorios
        if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
          this.findJSFiles(fullPath);
        }
      } else if (file.endsWith('.js') && !file.includes('convertToESModules')) {
        this.filesToConvert.push(fullPath);
      }
    }
  }

  /**
     * Convierte un archivo de CommonJS a ES modules
     */
  convertFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Convertir require() a import
      content = content.replace(
        /const\s+(\w+)\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g,
        (match, varName, modulePath) => {
          modified = true;
          // Agregar .js si es un módulo local
          if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            if (!modulePath.endsWith('.js')) {
              modulePath += '.js';
            }
          }
          return `import ${varName} from '${modulePath}';`;
        }
      );

      // Convertir require() con destructuring
      content = content.replace(
        /const\s+\{([^}]+)\}\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g,
        (match, destructured, modulePath) => {
          modified = true;
          if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            if (!modulePath.endsWith('.js')) {
              modulePath += '.js';
            }
          }
          return `import { ${destructured} } from '${modulePath}';`;
        }
      );

      // Convertir module.exports
      content = content.replace(
        /module\.exports\s*=\s*(\w+);?/g,
        (match, exportName) => {
          modified = true;
          return `export default ${exportName};`;
        }
      );

      // Convertir exports.something
      content = content.replace(
        /exports\.(\w+)\s*=\s*([^;]+);?/g,
        (match, exportName, value) => {
          modified = true;
          return `export const ${exportName} = ${value};`;
        }
      );

      // Convertir require.main === module
      content = content.replace(
        /require\.main\s*===\s*module/g,
        () => {
          modified = true;
          return 'import.meta.url === `file://${process.argv[1]}`';
        }
      );

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        this.conversions++;
        console.log(`✅ Convertido: ${path.relative(this.projectRoot, filePath)}`);
      }

    } catch (error) {
      console.error(`❌ Error convirtiendo ${filePath}:`, error.message);
    }
  }

  /**
     * Ejecuta la conversión completa
     */
  async convert() {
    console.log('🔄 Iniciando conversión a ES modules...');
    console.log('=' .repeat(50));

    // Encontrar archivos
    this.findJSFiles(this.projectRoot);
    console.log(`📁 Encontrados ${this.filesToConvert.length} archivos JS`);

    // Convertir archivos
    for (const filePath of this.filesToConvert) {
      this.convertFile(filePath);
    }

    console.log('=' .repeat(50));
    console.log(`✅ Conversión completada: ${this.conversions} archivos modificados`);
        
    if (this.conversions > 0) {
      console.log('\n📝 Notas importantes:');
      console.log('- Todos los imports ahora incluyen extensión .js');
      console.log('- module.exports convertido a export default');
      console.log('- require() convertido a import');
      console.log('- Verifica que no haya errores de sintaxis');
    }
  }
}

// Ejecutar conversión si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const converter = new ESModuleConverter();
  converter.convert().catch(console.error);
}

export default ESModuleConverter;