/**
 * Tests para DatabaseService
 * 
 * Pruebas unitarias del servicio de base de datos
 */

import { getDatabaseService } from '../DatabaseService.js';

describe('DatabaseService', () => {
  let db;

  beforeAll(async () => {
    db = getDatabaseService();
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Métodos CRUD', () => {
    test('debería insertar un registro', async () => {
      const result = await db.insert('users', {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'user'
      });

      expect(result.lastID).toBeDefined();
      expect(result.changes).toBe(1);
    });

    test('debería obtener un registro por ID', async () => {
      const inserted = await db.insert('users', {
        username: 'testuser2',
        email: 'test2@example.com',
        password_hash: 'hashed_password',
        role: 'user'
      });

      const user = await db.findById('users', inserted.lastID);
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser2');
    });

    test('debería obtener múltiples registros', async () => {
      await db.insert('users', {
        username: 'user1',
        email: 'user1@example.com',
        password_hash: 'hash1',
        role: 'user'
      });

      await db.insert('users', {
        username: 'user2',
        email: 'user2@example.com',
        password_hash: 'hash2',
        role: 'user'
      });

      const users = await db.findAll('users');
      expect(users.length).toBeGreaterThan(0);
    });

    test('debería actualizar un registro', async () => {
      const inserted = await db.insert('users', {
        username: 'updatetest',
        email: 'update@example.com',
        password_hash: 'hash',
        role: 'user'
      });

      await db.update('users', inserted.lastID, {
        email: 'newemail@example.com'
      });

      const user = await db.findById('users', inserted.lastID);
      expect(user.email).toBe('newemail@example.com');
    });

    test('debería eliminar un registro', async () => {
      const inserted = await db.insert('users', {
        username: 'deletetest',
        email: 'delete@example.com',
        password_hash: 'hash',
        role: 'user'
      });

      await db.delete('users', inserted.lastID);

      const user = await db.findById('users', inserted.lastID);
      expect(user).toBeUndefined();
    });
  });

  describe('Métodos de búsqueda', () => {
    test('debería contar registros', async () => {
      const count = await db.count('users');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('debería verificar si existe un registro', async () => {
      const inserted = await db.insert('users', {
        username: 'existstest',
        email: 'exists@example.com',
        password_hash: 'hash',
        role: 'user'
      });

      const exists = await db.exists('users', { id: inserted.lastID });
      expect(exists).toBe(true);
    });

    test('debería buscar por campo', async () => {
      await db.insert('users', {
        username: 'fieldtest',
        email: 'field@example.com',
        password_hash: 'hash',
        role: 'user'
      });

      const user = await db.findByField('users', 'username', 'fieldtest');
      expect(user).toBeDefined();
      expect(user.username).toBe('fieldtest');
    });
  });

  describe('Health Check', () => {
    test('debería retornar estado healthy', async () => {
      const health = await db.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Estadísticas', () => {
    test('debería obtener estadísticas de tablas', async () => {
      const stats = await db.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});
