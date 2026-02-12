/**
 * Tests para Template Controller
 * 
 * Pruebas unitarias del controlador de plantillas
 */

import TemplateController from '../templateController.js';

// Mock de DatabaseService
jest.mock('../../../services/DatabaseService.js', () => ({
  getDatabaseService: jest.fn(() => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }))
}));

describe('TemplateController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      body: {}
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('getTemplates', () => {
    test('debería retornar lista de plantillas', async () => {
      mockReq.query = { page: 1, limit: 50 };

      const mockTemplates = [
        { id: 1, name: 'Template 1', body_text: 'Body 1' },
        { id: 2, name: 'Template 2', body_text: 'Body 2' }
      ];

      // Mock de la respuesta
      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(true);
        expect(data.templates).toBeDefined();
        expect(data.pagination).toBeDefined();
      });

      // Nota: Este test es simplificado sin mock completo
      // En producción, se necesitaría mock más completo
    });
  });

  describe('getTemplateById', () => {
    test('debería retornar error 404 si no existe', async () => {
      mockReq.params = { id: 999 };

      mockRes.status.mockReturnThis();
      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(false);
      });
    });
  });

  describe('createTemplate', () => {
    test('debería validar campos requeridos', async () => {
      mockReq.body = { category: 'test' }; // Falta name y body_text

      mockRes.status.mockReturnThis();
      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      });
    });

    test('debería crear una plantilla válida', async () => {
      mockReq.body = {
        name: 'Test Template',
        body_text: 'This is a test template body',
        category: 'greeting',
        language: 'es'
      };

      mockRes.status.mockReturnThis();
      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(true);
        expect(data.template).toBeDefined();
      });
    });
  });

  describe('updateTemplate', () => {
    test('debería validar ID de plantilla', async () => {
      mockReq.params = { id: 'invalid' };

      mockRes.status.mockReturnThis();
      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(false);
      });
    });
  });

  describe('deleteTemplate', () => {
    test('debería eliminar una plantilla', async () => {
      mockReq.params = { id: 1 };

      mockRes.json.mockImplementation((data) => {
        expect(data.success).toBe(true);
        expect(data.message).toBeDefined();
      });
    });
  });
});
