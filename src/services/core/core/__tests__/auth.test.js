/**
 * Tests para Auth Service
 * 
 * Pruebas unitarias del servicio de autenticación
 */

import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  validateCredentials,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSession
} from '../auth.js';

describe('Auth Service', () => {
  describe('Token Generation', () => {
    test('debería generar un token JWT válido', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user']
      };

      const token = generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT tiene 3 partes
    });

    test('debería generar un refresh token', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const refreshToken = generateRefreshToken(user);
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });

  describe('Token Verification', () => {
    test('debería verificar un token válido', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user']
      };

      const token = generateToken(user);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(user.id);
      expect(decoded.username).toBe(user.username);
    });

    test('debería rechazar un token inválido', () => {
      expect(() => {
        verifyToken('invalid.token.here');
      }).toThrow();
    });
  });

  describe('Credential Validation', () => {
    test('debería validar credenciales correctas', () => {
      const result = validateCredentials('testuser', 'password123');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('debería rechazar usuario vacío', () => {
      const result = validateCredentials('', 'password123');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('debería rechazar contraseña corta', () => {
      const result = validateCredentials('testuser', 'short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('debería rechazar usuario muy largo', () => {
      const longUsername = 'a'.repeat(101);
      const result = validateCredentials(longUsername, 'password123');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Password Hashing', () => {
    test('debería hashear una contraseña', () => {
      const password = 'mypassword123';
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    test('debería verificar una contraseña correcta', () => {
      const password = 'mypassword123';
      const hash = hashPassword(password);

      const isValid = verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('debería rechazar una contraseña incorrecta', () => {
      const password = 'mypassword123';
      const hash = hashPassword(password);

      const isValid = verifyPassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Verification Code', () => {
    test('debería generar un código de verificación', () => {
      const code = generateVerificationCode(6);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(6);
    });

    test('debería generar códigos diferentes', () => {
      const code1 = generateVerificationCode(6);
      const code2 = generateVerificationCode(6);

      expect(code1).not.toBe(code2);
    });
  });

  describe('Session Creation', () => {
    test('debería crear una sesión válida', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user']
      };

      const session = createSession(user);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.username).toBe(user.username);
      expect(session.token).toBeDefined();
      expect(session.refreshToken).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    test('debería tener fecha de expiración en el futuro', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const session = createSession(user);
      const now = new Date();

      expect(session.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
