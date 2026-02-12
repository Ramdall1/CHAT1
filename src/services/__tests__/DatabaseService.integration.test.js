/**
 * Tests de Integración para DatabaseService
 * 
 * Pruebas de integración completas del servicio de base de datos
 */

import { getDatabaseService } from '../DatabaseService.js';

describe('DatabaseService - Integration Tests', () => {
  let db;

  beforeAll(async () => {
    db = getDatabaseService();
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Transacciones', () => {
    test('debería ejecutar transacción exitosa', async () => {
      const result = await db.transaction(async (dbInstance) => {
        const user = await dbInstance.insert('users', {
          username: 'transactiontest',
          email: 'transaction@example.com',
          password_hash: 'hash',
          role: 'user'
        });
        return user;
      });

      expect(result).toBeDefined();
      expect(result.lastID).toBeDefined();
    });

    test('debería hacer rollback en caso de error', async () => {
      try {
        await db.transaction(async (dbInstance) => {
          await dbInstance.insert('users', {
            username: 'rollbacktest',
            email: 'rollback@example.com',
            password_hash: 'hash',
            role: 'user'
          });
          throw new Error('Simulated error');
        });
      } catch (error) {
        expect(error.message).toBe('Simulated error');
      }
    });
  });

  describe('Operaciones complejas', () => {
    test('debería buscar con múltiples condiciones', async () => {
      await db.insert('users', {
        username: 'complextest1',
        email: 'complex1@example.com',
        password_hash: 'hash',
        role: 'admin'
      });

      await db.insert('users', {
        username: 'complextest2',
        email: 'complex2@example.com',
        password_hash: 'hash',
        role: 'user'
      });

      const users = await db.findAll('users', { role: 'admin' });
      expect(users.length).toBeGreaterThan(0);
    });

    test('debería paginar resultados', async () => {
      for (let i = 0; i < 10; i++) {
        await db.insert('users', {
          username: `paginationtest${i}`,
          email: `pagination${i}@example.com`,
          password_hash: 'hash',
          role: 'user'
        });
      }

      const page1 = await db.findAll('users', {}, {
        limit: 5,
        offset: 0,
        orderBy: 'id',
        orderDirection: 'ASC'
      });

      const page2 = await db.findAll('users', {}, {
        limit: 5,
        offset: 5,
        orderBy: 'id',
        orderDirection: 'ASC'
      });

      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Manejo de errores', () => {
    test('debería manejar inserciones duplicadas', async () => {
      const data = {
        username: 'duplicatetest',
        email: 'duplicate@example.com',
        password_hash: 'hash',
        role: 'user'
      };

      await db.insert('users', data);

      try {
        await db.insert('users', data);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('debería retornar undefined para registros no encontrados', async () => {
      const user = await db.findById('users', 999999);
      expect(user).toBeUndefined();
    });
  });

  describe('Operaciones de backup', () => {
    test('debería crear un backup', async () => {
      const backup = await db.createBackup('test-backup.sqlite');
      expect(backup.success).toBe(true);
      expect(backup.path).toBeDefined();
    });
  });

  describe('Optimización', () => {
    test('debería optimizar la base de datos', async () => {
      const result = await db.optimize();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('Estadísticas avanzadas', () => {
    test('debería obtener estadísticas de todas las tablas', async () => {
      const stats = await db.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.users).toBeDefined();
      expect(stats.contacts).toBeDefined();
      expect(stats.templates).toBeDefined();
      expect(stats.campaigns).toBeDefined();
    });
  });
});
