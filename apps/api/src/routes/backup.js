import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import BackupService from '../services/BackupService.js';

const router = express.Router();
const backupService = new BackupService();

// Configurar multer para subida de archivos de backup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'temp', 'backup-uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `import-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB límite
  },
  fileFilter: function (req, file, cb) {
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      path.extname(file.originalname).toLowerCase() === '.zip'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos ZIP'));
    }
  },
});

// Inicializar servicio de backup
backupService.initialize().catch(console.error);

// Middleware para verificar que el servicio esté inicializado
const ensureInitialized = (req, res, next) => {
  if (!backupService.isInitialized) {
    return res.status(503).json({
      success: false,
      message: 'Servicio de backup no inicializado',
    });
  }
  next();
};

// GET /api/backup/status - Obtener estado del servicio
router.get('/status', ensureInitialized, async (req, res) => {
  try {
    const status = backupService.getStatus();
    const backups = await backupService.listBackups();

    res.json({
      success: true,
      status: {
        ...status,
        totalBackups: backups.length,
        lastBackup: backups[0] || null,
        totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
      },
    });
  } catch (error) {
    console.error('Error obteniendo estado de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado del servicio',
      error: error.message,
    });
  }
});

// GET /api/backup/config - Obtener configuración
router.get('/config', ensureInitialized, (req, res) => {
  try {
    const config = backupService.getConfig();
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error obteniendo configuración de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo configuración',
      error: error.message,
    });
  }
});

// PUT /api/backup/config - Actualizar configuración
router.put('/config', ensureInitialized, async (req, res) => {
  try {
    const result = await backupService.updateConfig(req.body);
    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      config: result.config,
    });
  } catch (error) {
    console.error('Error actualizando configuración de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando configuración',
      error: error.message,
    });
  }
});

// GET /api/backup/list - Listar todos los backups
router.get('/list', ensureInitialized, async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({
      success: true,
      backups,
      total: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
    });
  } catch (error) {
    console.error('Error listando backups:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo lista de backups',
      error: error.message,
    });
  }
});

// GET /api/backup/:id - Obtener información de un backup específico
router.get('/:id', ensureInitialized, async (req, res) => {
  try {
    const backupInfo = await backupService.getBackupInfo(req.params.id);

    if (!backupInfo) {
      return res.status(404).json({
        success: false,
        message: 'Backup no encontrado',
      });
    }

    res.json({
      success: true,
      backup: backupInfo,
    });
  } catch (error) {
    console.error('Error obteniendo información de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del backup',
      error: error.message,
    });
  }
});

// POST /api/backup/create - Crear nuevo backup
router.post('/create', ensureInitialized, async (req, res) => {
  try {
    const { name, type } = req.body;

    const result = await backupService.createBackup({
      name,
      type: type || 'manual',
    });

    res.json({
      success: true,
      message: 'Backup creado exitosamente',
      backup: result,
    });
  } catch (error) {
    console.error('Error creando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando backup',
      error: error.message,
    });
  }
});

// POST /api/backup/:id/restore - Restaurar backup
router.post('/:id/restore', ensureInitialized, async (req, res) => {
  try {
    const {
      restoreData = true,
      restoreTemplates = true,
      restoreConfig = true,
      restoreUploads = true,
      skipSafetyBackup = false,
    } = req.body;

    const result = await backupService.restoreBackup(req.params.id, {
      restoreData,
      restoreTemplates,
      restoreConfig,
      restoreUploads,
      skipSafetyBackup,
    });

    res.json({
      success: true,
      message: 'Backup restaurado exitosamente',
      restoration: result,
    });
  } catch (error) {
    console.error('Error restaurando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error restaurando backup',
      error: error.message,
    });
  }
});

// DELETE /api/backup/:id - Eliminar backup
router.delete('/:id', ensureInitialized, async (req, res) => {
  try {
    const result = await backupService.deleteBackup(req.params.id);

    res.json({
      success: true,
      message: 'Backup eliminado exitosamente',
      deletedBackup: result.deletedBackup,
    });
  } catch (error) {
    console.error('Error eliminando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando backup',
      error: error.message,
    });
  }
});

// POST /api/backup/:id/validate - Validar integridad de backup
router.post('/:id/validate', ensureInitialized, async (req, res) => {
  try {
    const validation = await backupService.validateBackup(req.params.id);

    res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('Error validando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error validando backup',
      error: error.message,
    });
  }
});

// GET /api/backup/:id/download - Descargar backup
router.get('/:id/download', ensureInitialized, async (req, res) => {
  try {
    const backupInfo = await backupService.getBackupInfo(req.params.id);

    if (!backupInfo) {
      return res.status(404).json({
        success: false,
        message: 'Backup no encontrado',
      });
    }

    if (!(await fs.pathExists(backupInfo.path))) {
      return res.status(404).json({
        success: false,
        message: 'Archivo de backup no encontrado',
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${backupInfo.name}.zip"`
    );
    res.setHeader('Content-Length', backupInfo.size);

    const fileStream = fs.createReadStream(backupInfo.path);
    fileStream.pipe(res);

    fileStream.on('error', error => {
      console.error('Error enviando archivo de backup:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error enviando archivo',
          error: error.message,
        });
      }
    });
  } catch (error) {
    console.error('Error descargando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error descargando backup',
      error: error.message,
    });
  }
});

// POST /api/backup/import - Importar backup
router.post(
  '/import',
  ensureInitialized,
  upload.single('backup'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó archivo de backup',
        });
      }

      const { name } = req.body;

      const result = await backupService.importBackup(req.file.path, name);

      // Limpiar archivo temporal
      await fs.remove(req.file.path);

      res.json({
        success: true,
        message: 'Backup importado exitosamente',
        backup: result,
      });
    } catch (error) {
      console.error('Error importando backup:', error);

      // Limpiar archivo temporal en caso de error
      if (req.file && req.file.path) {
        await fs.remove(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        message: 'Error importando backup',
        error: error.message,
      });
    }
  }
);

// POST /api/backup/:id/export - Exportar backup a ubicación específica
router.post('/:id/export', ensureInitialized, async (req, res) => {
  try {
    const { exportPath } = req.body;

    if (!exportPath) {
      return res.status(400).json({
        success: false,
        message: 'Ruta de exportación requerida',
      });
    }

    const result = await backupService.exportBackup(req.params.id, exportPath);

    res.json({
      success: true,
      message: 'Backup exportado exitosamente',
      export: result,
    });
  } catch (error) {
    console.error('Error exportando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error exportando backup',
      error: error.message,
    });
  }
});

// POST /api/backup/cleanup - Limpiar backups antiguos manualmente
router.post('/cleanup', ensureInitialized, async (req, res) => {
  try {
    await backupService.cleanOldBackups();

    const backups = await backupService.listBackups();

    res.json({
      success: true,
      message: 'Limpieza de backups completada',
      remainingBackups: backups.length,
    });
  } catch (error) {
    console.error('Error limpiando backups:', error);
    res.status(500).json({
      success: false,
      message: 'Error limpiando backups antiguos',
      error: error.message,
    });
  }
});

// GET /api/backup/stats - Obtener estadísticas de backups
router.get('/stats', ensureInitialized, async (req, res) => {
  try {
    const backups = await backupService.listBackups();

    const stats = {
      total: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
      byType: {},
      byMonth: {},
      averageSize: 0,
      oldestBackup: null,
      newestBackup: null,
    };

    if (backups.length > 0) {
      // Estadísticas por tipo
      backups.forEach(backup => {
        const type = backup.type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      // Estadísticas por mes
      backups.forEach(backup => {
        const month = new Date(backup.timestamp).toISOString().substring(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      });

      // Tamaño promedio
      stats.averageSize = stats.totalSize / backups.length;

      // Backup más antiguo y más nuevo
      const sortedByDate = [...backups].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      stats.oldestBackup = sortedByDate[0];
      stats.newestBackup = sortedByDate[sortedByDate.length - 1];
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message,
    });
  }
});

// Middleware de manejo de errores
router.use((error, req, res, next) => {
  console.error('Error en rutas de backup:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Archivo demasiado grande (máximo 500MB)',
      });
    }
  }

  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: error.message,
  });
});

export default router;
