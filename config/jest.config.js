import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

export default {
  // Directorio raíz del proyecto
  rootDir: projectRoot,
  
  // Entorno de testing
  testEnvironment: 'node',
  
  // Directorios de pruebas
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Archivos a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // Configuración de cobertura
  collectCoverage: false,
  
  // Configuración de setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Timeout para pruebas
  testTimeout: 30000,
  
  // Configuración de transformación para ES modules
  transform: {},
  
  // Configuración de verbose
  verbose: true,
  
  // Configuración de detección de archivos abiertos
  detectOpenHandles: true,
  forceExit: true
};