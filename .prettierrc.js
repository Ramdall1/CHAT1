/**
 * Prettier Configuration - ChatBot Enterprise
 * Configuración optimizada para ES Modules
 * @version 5.1.0
 */

export default {
  // ===== CONFIGURACIÓN BÁSICA =====
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  
  // ===== CONFIGURACIÓN DE OBJETOS Y ARRAYS =====
  trailingComma: 'none',
  bracketSpacing: true,
  bracketSameLine: false,
  
  // ===== CONFIGURACIÓN DE FUNCIONES =====
  arrowParens: 'avoid',
  
  // ===== CONFIGURACIÓN DE ARCHIVOS =====
  endOfLine: 'lf',
  insertPragma: false,
  requirePragma: false,
  proseWrap: 'preserve',
  
  // ===== CONFIGURACIÓN ESPECÍFICA POR TIPO DE ARCHIVO =====
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: ['*.test.js', '*.spec.js'],
      options: {
        printWidth: 100
      }
    }
  ]
};
