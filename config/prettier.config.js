export default {
  // Configuración básica
  semi: true,
  trailingComma: 'none',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // Configuración de objetos y arrays
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Configuración de funciones
  arrowParens: 'avoid',
  
  // Configuración de strings
  quoteProps: 'as-needed',
  
  // Configuración de JSX (si se usa React)
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Configuración de HTML
  htmlWhitespaceSensitivity: 'css',
  
  // Configuración de Vue (si se usa)
  vueIndentScriptAndStyle: false,
  
  // Configuración de archivos específicos
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2
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
    }
  ]
};