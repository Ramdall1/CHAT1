/**
 * Generador de README Automático
 * Maneja la generación automática de documentación README con estadísticas del proyecto
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../core/core/logger.js';

class ReadmeGenerator {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './docs',
      projectRoot: config.projectRoot || '.',
      excludePatterns: config.excludePatterns || ['node_modules', '.git', 'tests', 'docs'],
      templatePath: config.templatePath || null,
      ...config
    };
    
    this.logger = createLogger('README_GENERATOR');
  }

  /**
   * Genera README automático completo
   */
  async generate() {
    this.logger.info('📖 Generando README automático...');
    
    try {
      // Crear directorio de salida
      this.ensureOutputDirectory();
      
      // Obtener información del proyecto
      const packageInfo = this.getPackageInfo();
      const projectStats = await this.getProjectStats();
      const systemInfo = await this.getSystemInfo();
      
      // Generar contenido del README
      const readmeContent = await this.generateReadmeContent(packageInfo, projectStats, systemInfo);
      
      // Guardar README
      await this.saveReadme(readmeContent);
      
      this.logger.info('✅ README generado exitosamente');
      return { packageInfo, projectStats, systemInfo };
      
    } catch (error) {
      this.logger.error('❌ Error generando README:', error);
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
   * Obtiene información del package.json
   */
  getPackageInfo() {
    try {
      const packagePath = path.join(this.config.projectRoot, 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return {
          name: packageData.name || 'ChatBot System',
          version: packageData.version || '1.0.0',
          description: packageData.description || 'Sistema de ChatBot avanzado con múltiples funcionalidades',
          author: packageData.author || 'Equipo de Desarrollo',
          license: packageData.license || 'MIT',
          homepage: packageData.homepage || '',
          repository: packageData.repository || '',
          keywords: packageData.keywords || [],
          dependencies: Object.keys(packageData.dependencies || {}),
          devDependencies: Object.keys(packageData.devDependencies || {}),
          scripts: packageData.scripts || {}
        };
      }
    } catch (error) {
      this.logger.warn('No se pudo leer package.json:', error.message);
    }
    
    return {
      name: 'ChatBot System',
      version: '1.0.0',
      description: 'Sistema de ChatBot avanzado con múltiples funcionalidades',
      author: 'Equipo de Desarrollo',
      license: 'MIT',
      homepage: '',
      repository: '',
      keywords: [],
      dependencies: [],
      devDependencies: [],
      scripts: {}
    };
  }

  /**
   * Obtiene estadísticas del proyecto
   */
  async getProjectStats() {
    const stats = {
      codeFiles: 0,
      linesOfCode: 0,
      components: 0,
      tests: 0,
      documentation: 0,
      totalSize: 0,
      filesByType: {},
      directories: 0
    };

    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!this.config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            stats.directories++;
            countFiles(fullPath);
          }
        } else if (this.isSourceFile(fullPath)) {
          stats.codeFiles++;
          stats.totalSize += stat.size;
          
          const ext = path.extname(fullPath);
          stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1;
          
          const content = fs.readFileSync(fullPath, 'utf8');
          stats.linesOfCode += content.split('\n').length;
          
          // Categorizar archivos
          if (fullPath.includes('component') || fullPath.includes('Component')) {
            stats.components++;
          }
          
          if (fullPath.includes('test') || fullPath.includes('spec') || fullPath.includes('Test')) {
            stats.tests++;
          }
          
          if (fullPath.includes('doc') || fullPath.includes('README') || fullPath.includes('md')) {
            stats.documentation++;
          }
        }
      }
    };

    countFiles(this.config.projectRoot);
    return stats;
  }

  /**
   * Obtiene información del sistema
   */
  async getSystemInfo() {
    const info = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      generatedAt: new Date().toISOString(),
      generatedBy: 'ReadmeGenerator v1.0.0'
    };

    // Intentar obtener información de Git
    try {
      const gitConfigPath = path.join(this.config.projectRoot, '.git', 'config');
      if (fs.existsSync(gitConfigPath)) {
        info.hasGit = true;
      }
    } catch (error) {
      info.hasGit = false;
    }

    return info;
  }

  /**
   * Verifica si un archivo es un archivo fuente válido
   */
  isSourceFile(filePath) {
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.json', '.md'];
    return validExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Genera el contenido del README
   */
  async generateReadmeContent(packageInfo, projectStats, systemInfo) {
    const template = `# ${packageInfo.name}

${packageInfo.description}

## 📊 Estadísticas del Proyecto

- **Versión:** ${packageInfo.version}
- **Archivos de código:** ${projectStats.codeFiles}
- **Líneas de código:** ${projectStats.linesOfCode.toLocaleString()}
- **Componentes:** ${projectStats.components}
- **Pruebas:** ${projectStats.tests}
- **Directorios:** ${projectStats.directories}
- **Tamaño total:** ${this.formatBytes(projectStats.totalSize)}
- **Documentación generada:** ${new Date().toLocaleString()}

### 📁 Distribución de Archivos

${Object.entries(projectStats.filesByType)
  .sort(([,a], [,b]) => b - a)
  .map(([ext, count]) => `- **${ext}:** ${count} archivos`)
  .join('\n')}

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js ${systemInfo.nodeVersion} o superior
- npm o yarn
- ${systemInfo.platform} (${systemInfo.architecture})

### Instalación

\`\`\`bash
# Clonar el repositorio
git clone ${packageInfo.repository.url || 'https://github.com/usuario/chatbot.git'}

# Navegar al directorio
cd ${packageInfo.name.toLowerCase().replace(/\s+/g, '-')}

# Instalar dependencias
npm install
\`\`\`

### Configuración

1. Copiar el archivo de configuración de ejemplo:
\`\`\`bash
cp .env.example .env
\`\`\`

2. Editar las variables de entorno en \`.env\`

3. Configurar la base de datos (si aplica)

### Ejecución

\`\`\`bash
# Desarrollo
npm run dev

# Producción
npm start

# Pruebas
npm test

# Generar documentación
npm run docs
\`\`\`

## 📚 Documentación

- [Documentación JSDoc](./docs/jsdoc/index.html) - Documentación del código fuente
- [API Documentation (Swagger)](./docs/swagger/index.html) - Documentación de la API REST
- [Documentación de Componentes](./docs/components/index.html) - Catálogo de componentes UI
- [Análisis Comparativo](./ANALISIS_COMPARATIVO_MANYCHAT.md) - Comparación con ManyChat

## 🏗️ Arquitectura

El sistema está organizado siguiendo principios de diseño modular:

\`\`\`
${packageInfo.name.toLowerCase()}/
├── src/                    # Código fuente principal
│   ├── components/         # Componentes reutilizables
│   ├── controllers/        # Controladores de API
│   ├── routes/            # Definición de rutas
│   ├── services/          # Lógica de negocio
│   ├── utils/             # Utilidades
│   ├── monitoring/        # Sistema de monitoreo
│   └── validation/        # Validación de datos
├── public/                # Archivos estáticos
├── docs/                  # Documentación generada
├── tests/                 # Pruebas automatizadas
└── config/                # Archivos de configuración
\`\`\`

### Componentes Principales

- **Server.js** - Servidor principal Express con Socket.IO
- **App.js** - Configuración de la aplicación y middlewares
- **Services** - Servicios modulares (contactos, mensajes, IA, automatización)
- **Routes** - Endpoints de API organizados por funcionalidad
- **Monitoring** - Sistema de monitoreo y métricas en tiempo real

## 🔧 Configuración

### Variables de Entorno

\`\`\`bash
# Servidor
PORT=3000
NODE_ENV=production

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatbot
DB_USER=usuario
DB_PASS=contraseña

# WhatsApp API
WHATSAPP_TOKEN=tu_token_aqui
WHATSAPP_VERIFY_TOKEN=tu_verify_token

# IA y Automatización
OPENAI_API_KEY=tu_openai_key
AUTOMATION_ENABLED=true
\`\`\`

### PM2 (Producción)

\`\`\`bash
# Iniciar con PM2
pm2 start ecosystem.config.js

# Monitorear procesos
pm2 monit

# Ver logs
pm2 logs

# Reiniciar
pm2 restart all

# Detener
pm2 stop all
\`\`\`

## 📈 Monitoreo y Métricas

- **Uptime objetivo:** 99.9%
- **Latencia objetivo:** <200ms
- **Logging centralizado:** ✅
- **Monitoreo en tiempo real:** ✅
- **Alertas automáticas:** ✅
- **Dashboard de métricas:** http://localhost:3000/dashboard

### Métricas Disponibles

- Rendimiento del servidor
- Uso de memoria y CPU
- Latencia de respuesta
- Errores y excepciones
- Actividad de usuarios
- Estadísticas de mensajes

## 🧪 Pruebas

### Tipos de Pruebas

- **Unitarias:** Jest para lógica de negocio
- **Integración:** Supertest para APIs
- **E2E:** Cypress para flujos completos
- **Carga:** Artillery para rendimiento

### Ejecutar Pruebas

\`\`\`bash
# Todas las pruebas
npm test

# Pruebas unitarias
npm run test:unit

# Pruebas de integración
npm run test:integration

# Pruebas E2E
npm run test:e2e

# Cobertura de código
npm run test:coverage
\`\`\`

## 🚀 Despliegue

### Docker

\`\`\`bash
# Construir imagen
docker build -t ${packageInfo.name.toLowerCase()} .

# Ejecutar contenedor
docker run -p 3000:3000 ${packageInfo.name.toLowerCase()}

# Docker Compose
docker-compose up -d
\`\`\`

### Heroku

\`\`\`bash
# Login en Heroku
heroku login

# Crear aplicación
heroku create ${packageInfo.name.toLowerCase()}

# Configurar variables
heroku config:set NODE_ENV=production

# Desplegar
git push heroku main
\`\`\`

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (\`git checkout -b feature/AmazingFeature\`)
3. Commit tus cambios (\`git commit -m 'Add some AmazingFeature'\`)
4. Push a la rama (\`git push origin feature/AmazingFeature\`)
5. Abre un Pull Request

### Estándares de Código

- ESLint para JavaScript
- Prettier para formateo
- Conventional Commits
- Documentación JSDoc obligatoria
- Pruebas para nuevas funcionalidades

## 📋 Roadmap

- [ ] Integración con más plataformas de mensajería
- [ ] IA conversacional avanzada
- [ ] Dashboard de analíticas mejorado
- [ ] API GraphQL
- [ ] Aplicación móvil
- [ ] Integración con CRM

## 🐛 Reporte de Bugs

Si encuentras un bug, por favor:

1. Verifica que no esté ya reportado en [Issues](${packageInfo.repository.url}/issues)
2. Crea un nuevo issue con:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si aplica
   - Información del entorno

## 📄 Licencia

Este proyecto está bajo la Licencia ${packageInfo.license}. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Equipo

- **${packageInfo.author}** - Desarrollo principal
- **Equipo de QA** - Pruebas y calidad
- **DevOps** - Infraestructura y despliegue

## 📞 Soporte

- **Email:** soporte@chatbot.com
- **Discord:** [Servidor de la comunidad](https://discord.gg/chatbot)
- **Documentación:** [Wiki del proyecto](${packageInfo.homepage}/wiki)

## 🙏 Agradecimientos

- OpenAI por la API de IA
- WhatsApp Business API
- Comunidad de Node.js
- Contribuidores del proyecto

---

**Última actualización:** ${new Date().toLocaleString()}  
**Generado automáticamente por:** ${systemInfo.generatedBy}  
**Versión del sistema:** ${packageInfo.version}

> 💡 **Tip:** Este README se genera automáticamente. Para modificarlo, edita el generador en \`src/services/docs/readme/ReadmeGenerator.js\`
`;

    return template;
  }

  /**
   * Guarda el README generado
   */
  async saveReadme(content) {
    const readmePath = path.join(this.config.outputDir, 'README.md');
    fs.writeFileSync(readmePath, content);
    
    // También guardar en la raíz del proyecto si es diferente
    if (this.config.outputDir !== this.config.projectRoot) {
      const rootReadmePath = path.join(this.config.projectRoot, 'README.md');
      fs.writeFileSync(rootReadmePath, content);
    }
  }

  /**
   * Formatea bytes en formato legible
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Genera README personalizado con template
   */
  async generateCustomReadme(templatePath, variables = {}) {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template no encontrado: ${templatePath}`);
    }

    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Reemplazar variables en el template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, value);
    }

    return template;
  }

  /**
   * Obtiene estadísticas de la documentación generada
   */
  getStats(packageInfo, projectStats, systemInfo) {
    return {
      packageInfo: {
        name: packageInfo.name,
        version: packageInfo.version,
        dependencies: packageInfo.dependencies.length,
        devDependencies: packageInfo.devDependencies.length
      },
      projectStats: {
        codeFiles: projectStats.codeFiles,
        linesOfCode: projectStats.linesOfCode,
        totalSize: projectStats.totalSize,
        components: projectStats.components,
        tests: projectStats.tests
      },
      systemInfo: {
        nodeVersion: systemInfo.nodeVersion,
        platform: systemInfo.platform,
        generatedAt: systemInfo.generatedAt
      }
    };
  }

  /**
   * Valida la configuración del generador
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.outputDir) {
      errors.push('Directorio de salida no especificado');
    }
    
    if (!fs.existsSync(this.config.projectRoot)) {
      errors.push(`Directorio raíz del proyecto no existe: ${this.config.projectRoot}`);
    }
    
    return errors;
  }
}

export default ReadmeGenerator;