/**
 * Tests para Response Generator
 * 
 * Pruebas unitarias del generador de respuestas inteligente
 */

import { ResponseGenerator, generateResponse } from '../response_generator.js';

describe('ResponseGenerator', () => {
  let generator;
  const mockContact = {
    id: 1,
    name: 'Juan',
    email: 'juan@example.com'
  };

  beforeEach(() => {
    generator = new ResponseGenerator();
  });

  describe('Inicialización', () => {
    test('debería inicializar con configuración por defecto', () => {
      expect(generator.config).toBeDefined();
      expect(generator.config.maxResponseLength).toBe(1000);
      expect(generator.config.minConfidence).toBe(0.5);
    });

    test('debería aceptar configuración personalizada', () => {
      const customGenerator = new ResponseGenerator({
        maxResponseLength: 500,
        minConfidence: 0.7
      });

      expect(customGenerator.config.maxResponseLength).toBe(500);
      expect(customGenerator.config.minConfidence).toBe(0.7);
    });
  });

  describe('Detección de Intención', () => {
    test('debería detectar saludo', () => {
      const result = generator.detectIntent('hola');
      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('debería detectar solicitud de ayuda', () => {
      const result = generator.detectIntent('necesito ayuda');
      expect(result.intent).toBe('help');
    });

    test('debería detectar agradecimiento', () => {
      const result = generator.detectIntent('gracias');
      expect(result.intent).toBe('thanks');
    });

    test('debería detectar despedida', () => {
      const result = generator.detectIntent('adiós');
      expect(result.intent).toBe('goodbye');
    });

    test('debería detectar queja', () => {
      const result = generator.detectIntent('tengo un problema');
      expect(result.intent).toBe('complaint');
    });

    test('debería detectar consulta', () => {
      const result = generator.detectIntent('cuál es el precio');
      expect(result.intent).toBe('inquiry');
    });

    test('debería retornar unknown para intención desconocida', () => {
      const result = generator.detectIntent('xyz abc 123');
      expect(result.intent).toBe('unknown');
    });
  });

  describe('Análisis de Sentimiento', () => {
    test('debería detectar sentimiento positivo', () => {
      const result = generator.analyzeSentiment('excelente servicio');
      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
    });

    test('debería detectar sentimiento negativo', () => {
      const result = generator.analyzeSentiment('terrible experiencia');
      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    test('debería detectar sentimiento neutral', () => {
      const result = generator.analyzeSentiment('ok');
      expect(result.sentiment).toBe('neutral');
    });

    test('debería normalizar score entre -1 y 1', () => {
      const result = generator.analyzeSentiment('excelente');
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Personalización de Respuesta', () => {
    test('debería reemplazar nombre del contacto', () => {
      const response = generator.personalizeResponse(
        'Hola {name}, ¿cómo estás?',
        mockContact
      );

      expect(response).toContain('Juan');
      expect(response).not.toContain('{name}');
    });

    test('debería reemplazar primer nombre', () => {
      const response = generator.personalizeResponse(
        'Hola {firstName}',
        mockContact
      );

      expect(response).toContain('Juan');
    });

    test('debería agregar contexto de sentimiento negativo', () => {
      const response = generator.personalizeResponse(
        'Aquí está tu respuesta',
        mockContact,
        { sentiment: 'negative' }
      );

      expect(response).toContain('Entiendo tu preocupación');
    });

    test('debería agregar contexto de sentimiento positivo', () => {
      const response = generator.personalizeResponse(
        'Aquí está tu respuesta',
        mockContact,
        { sentiment: 'positive' }
      );

      expect(response).toContain('¡Excelente!');
    });
  });

  describe('Validación de Respuesta', () => {
    test('debería validar respuesta correcta', () => {
      const validation = generator.validateResponse('Esta es una respuesta válida');
      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    test('debería rechazar respuesta vacía', () => {
      const validation = generator.validateResponse('');
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('debería rechazar respuesta muy corta', () => {
      const validation = generator.validateResponse('Hi');
      expect(validation.valid).toBe(false);
    });

    test('debería rechazar respuesta muy larga', () => {
      const longResponse = 'a'.repeat(1001);
      const validation = generator.validateResponse(longResponse);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Generación de Respuesta Completa', () => {
    test('debería generar respuesta para saludo', async () => {
      const response = await generator.generateResponse('hola', mockContact);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    test('debería generar respuesta personalizada', async () => {
      const response = await generator.generateResponse('hola', mockContact);
      expect(response).toContain('Juan');
    });

    test('debería cachear respuestas', async () => {
      const response1 = await generator.generateResponse('hola', mockContact);
      const response2 = await generator.generateResponse('hola', mockContact);

      expect(response1).toBe(response2);
    });

    test('debería manejar errores gracefully', async () => {
      const response = await generator.generateResponse('', mockContact);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('Gestión de Caché', () => {
    test('debería limpiar caché', () => {
      generator.generateResponse('hola', mockContact);
      generator.clearCache();

      const stats = generator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('debería obtener estadísticas de caché', () => {
      generator.generateResponse('hola', mockContact);
      const stats = generator.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toBeDefined();
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  describe('Función Legacy', () => {
    test('debería funcionar la función generateResponse legacy', async () => {
      const response = await generateResponse('hola', mockContact);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });
});
