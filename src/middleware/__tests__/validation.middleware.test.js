/**
 * Tests para Validation Middleware
 * 
 * Pruebas unitarias del middleware de validación
 */

import {
  validateContact,
  validateTemplate,
  validateCampaign,
  validateMessage,
  validatePagination,
  validateId,
  handleValidationErrors
} from '../validation.middleware.js';

describe('Validation Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('handleValidationErrors', () => {
    test('debería pasar al siguiente middleware si no hay errores', () => {
      const validationResult = {
        isEmpty: jest.fn().mockReturnValue(true)
      };

      jest.mock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(validationResult)
      }));

      handleValidationErrors(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('debería retornar error si hay validaciones fallidas', () => {
      const validationResult = {
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { param: 'email', msg: 'Email inválido' }
        ])
      };

      jest.mock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(validationResult)
      }));

      handleValidationErrors(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateContact', () => {
    test('debería tener validadores para crear contacto', () => {
      expect(validateContact.create).toBeDefined();
      expect(Array.isArray(validateContact.create)).toBe(true);
    });

    test('debería tener validadores para actualizar contacto', () => {
      expect(validateContact.update).toBeDefined();
      expect(Array.isArray(validateContact.update)).toBe(true);
    });
  });

  describe('validateTemplate', () => {
    test('debería tener validadores para crear plantilla', () => {
      expect(validateTemplate.create).toBeDefined();
      expect(Array.isArray(validateTemplate.create)).toBe(true);
    });

    test('debería tener validadores para actualizar plantilla', () => {
      expect(validateTemplate.update).toBeDefined();
      expect(Array.isArray(validateTemplate.update)).toBe(true);
    });
  });

  describe('validateCampaign', () => {
    test('debería tener validadores para crear campaña', () => {
      expect(validateCampaign.create).toBeDefined();
      expect(Array.isArray(validateCampaign.create)).toBe(true);
    });

    test('debería tener validadores para actualizar campaña', () => {
      expect(validateCampaign.update).toBeDefined();
      expect(Array.isArray(validateCampaign.update)).toBe(true);
    });
  });

  describe('validateMessage', () => {
    test('debería tener validadores para crear mensaje', () => {
      expect(validateMessage.create).toBeDefined();
      expect(Array.isArray(validateMessage.create)).toBe(true);
    });
  });

  describe('validatePagination', () => {
    test('debería ser un array de validadores', () => {
      expect(Array.isArray(validatePagination)).toBe(true);
    });
  });

  describe('validateId', () => {
    test('debería ser un array de validadores', () => {
      expect(Array.isArray(validateId)).toBe(true);
    });
  });
});
