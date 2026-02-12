export default {
  ci: {
    // Configuración de recolección
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/health',
        'http://localhost:3000/api/status'
      ],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Server running on port',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless',
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        emulatedFormFactor: 'desktop',
        locale: 'es-ES'
      }
    },
    
    // Configuración de carga
    upload: {
      target: 'temporary-public-storage'
    },
    
    // Configuración de aserciones
    assert: {
      assertions: {
        // Métricas de rendimiento
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Métricas específicas
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
        'server-response-time': ['error', { maxNumericValue: 600 }],
        
        // Recursos
        'unused-css-rules': ['warn', { maxLength: 5 }],
        'unused-javascript': ['warn', { maxLength: 5 }],
        'unminified-css': ['error', { maxLength: 0 }],
        'unminified-javascript': ['error', { maxLength: 0 }],
        
        // Imágenes
        'modern-image-formats': ['warn', { maxLength: 3 }],
        'uses-optimized-images': ['warn', { maxLength: 3 }],
        'uses-responsive-images': ['warn', { maxLength: 3 }],
        
        // Red
        'uses-http2': ['error', { maxLength: 0 }],
        'uses-text-compression': ['error', { maxLength: 0 }],
        'efficient-animated-content': ['warn', { maxLength: 2 }],
        
        // Seguridad
        'is-on-https': ['error', { maxLength: 0 }],
        'no-vulnerable-libraries': ['error', { maxLength: 0 }],
        
        // Accesibilidad
        'color-contrast': ['error', { maxLength: 0 }],
        'image-alt': ['error', { maxLength: 0 }],
        'label': ['error', { maxLength: 0 }],
        'link-name': ['error', { maxLength: 0 }],
        
        // SEO
        'meta-description': ['error', { maxLength: 0 }],
        'document-title': ['error', { maxLength: 0 }],
        'hreflang': ['warn', { maxLength: 2 }],
        'canonical': ['warn', { maxLength: 1 }]
      }
    },
    
    // Configuración del servidor
    server: {
      port: 9001,
      storage: {
        storageMethod: 'filesystem',
        storagePath: './lighthouse-reports'
      }
    },
    
    // Configuración de wizard
    wizard: {
      preset: 'desktop'
    }
  }
};