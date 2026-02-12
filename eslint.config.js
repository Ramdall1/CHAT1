/**
 * ESLint Configuration - ChatBot Enterprise
 * Configuración optimizada para ES Modules
 * @version 5.1.0
 */

const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');
const security = require('eslint-plugin-security');
const importPlugin = require('eslint-plugin-import');
const node = require('eslint-plugin-node');

module.exports = [
  // Configuración base recomendada
  js.configs.recommended,
  
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Node.js globals
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        
        // Jest globals
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly'
      }
    },
    
    plugins: {
      prettier,
      security,
      import: importPlugin,
      node
    },
    
    rules: {
      // ===== REGLAS DE ES MODULES =====
      'import/extensions': ['error', 'always', { ignorePackages: true }],
      'import/no-unresolved': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'error',
      'import/no-webpack-loader-syntax': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      
      // ===== REGLAS DE SEGURIDAD =====
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      
      // ===== REGLAS DE NODE.JS =====
      'node/no-unsupported-features/es-syntax': 'off',
      'node/no-missing-import': 'off', // Manejado por import/no-unresolved
      'node/no-unpublished-import': 'off',
      'node/prefer-global/process': 'error',
      'node/prefer-global/buffer': 'error',
      'node/prefer-global/console': 'error',
      'node/prefer-global/url-search-params': 'error',
      'node/prefer-global/url': 'error',
      
      // ===== REGLAS DE CALIDAD DE CÓDIGO =====
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      'no-iterator': 'error',
      'no-with': 'error',
      'no-caller': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-invalid-this': 'error',
      'no-multi-spaces': 'error',
      'no-multi-str': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-undef-init': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-void': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-destructuring': ['error', {
        array: true,
        object: true
      }],
      
      // ===== REGLAS DE ESTILO =====
      'prettier/prettier': 'error',
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      
      // ===== REGLAS DE ASYNC/AWAIT =====
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // ===== REGLAS DE VARIABLES =====
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-shadow': 'error',
      'no-use-before-define': ['error', {
        functions: false,
        classes: true,
        variables: true
      }]
    },
    
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.cjs']
        }
      }
    }
  },
  
  // Configuración específica para archivos de test
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
      'node/no-unpublished-import': 'off'
    }
  },
  
  // Configuración específica para archivos de configuración
  {
    files: ['*.config.js', '*.config.mjs', '*.config.cjs'],
    rules: {
      'no-console': 'off',
      'import/no-anonymous-default-export': 'off'
    }
  },
  
  // Archivos a ignorar
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'test-reports/**',
      'logs/**',
      'custom-logs/**',
      'custom-checkpoints/**',
      '.jest-cache/**',
      '*.min.js'
    ]
  }
];