/**
 * Jest Setup
 * 
 * Configuración inicial para todos los tests
 */

// Aumentar timeout para tests de integración
jest.setTimeout(10000);

// Mock de console para tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock de process.env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = ':memory:';

// Limpiar después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
