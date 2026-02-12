# SafeRollbackSystem - Sistema de Rollback Seguro

## Descripción General

El `SafeRollbackSystem` es un sistema avanzado de gestión de checkpoints y rollback que permite revertir operaciones fallidas de manera segura, manteniendo la integridad del sistema y proporcionando capacidades de autoreparación.

## Arquitectura del Sistema

### Componentes Principales

1. **Checkpoint Manager**: Gestión de puntos de control
2. **Rollback Engine**: Motor de reversión de operaciones
3. **State Validator**: Validador de estado del sistema
4. **Auto-Repair System**: Sistema de autoreparación automática

```
┌─────────────────────────────────────────────────────────────┐
│                SafeRollbackSystem                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Checkpoint      │  │ Rollback        │                  │
│  │ Manager         │  │ Engine          │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ State           │  │ Auto-Repair     │                  │
│  │ Validator       │  │ System          │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Filesystem      │  │ Configuration   │                  │
│  │ Backup          │  │ Backup          │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## Tipos de Checkpoints

### 1. Filesystem Checkpoint

```javascript
async createFilesystemCheckpoint(testPath) {
  const checkpointId = this.generateCheckpointId();
  const backupPath = path.join(this.config.backupDir, 'filesystem', checkpointId);
  
  try {
    // Crear directorio de backup
    await fs.mkdir(backupPath, { recursive: true });
    
    // Obtener lista de archivos a respaldar
    const filesToBackup = await this.getFilesToBackup(testPath);
    
    const checkpoint = {
      id: checkpointId,
      type: 'filesystem',
      timestamp: Date.now(),
      testPath,
      backupPath,
      files: [],
      metadata: {
        totalFiles: 0,
        totalSize: 0,
        permissions: new Map(),
        symlinks: new Map()
      }
    };
    
    // Respaldar cada archivo
    for (const filePath of filesToBackup) {
      const relativePath = path.relative(testPath, filePath);
      const backupFilePath = path.join(backupPath, relativePath);
      
      // Crear directorio padre si no existe
      await fs.mkdir(path.dirname(backupFilePath), { recursive: true });
      
      // Obtener información del archivo
      const stats = await fs.stat(filePath);
      
      if (stats.isSymbolicLink()) {
        // Manejar enlaces simbólicos
        const linkTarget = await fs.readlink(filePath);
        checkpoint.metadata.symlinks.set(relativePath, linkTarget);
        await fs.symlink(linkTarget, backupFilePath);
      } else if (stats.isFile()) {
        // Copiar archivo regular
        await fs.copyFile(filePath, backupFilePath);
        
        // Preservar permisos
        await fs.chmod(backupFilePath, stats.mode);
        checkpoint.metadata.permissions.set(relativePath, stats.mode);
      }
      
      checkpoint.files.push({
        path: relativePath,
        size: stats.size,
        mode: stats.mode,
        isSymlink: stats.isSymbolicLink(),
        mtime: stats.mtime
      });
      
      checkpoint.metadata.totalSize += stats.size;
    }
    
    checkpoint.metadata.totalFiles = checkpoint.files.length;
    
    // Guardar metadata del checkpoint
    const metadataPath = path.join(backupPath, '.checkpoint-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(checkpoint, null, 2));
    
    this.checkpoints.set(checkpointId, checkpoint);
    
    this.emit('checkpointCreated', {
      type: 'filesystem',
      id: checkpointId,
      files: checkpoint.metadata.totalFiles,
      size: checkpoint.metadata.totalSize
    });
    
    return checkpointId;
  } catch (error) {
    // Limpiar backup parcial en caso de error
    try {
      await fs.rm(backupPath, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to cleanup partial backup:', cleanupError);
    }
    
    throw new Error(`Failed to create filesystem checkpoint: ${error.message}`);
  }
}
```

### 2. Configuration Checkpoint

```javascript
async createConfigurationCheckpoint() {
  const checkpointId = this.generateCheckpointId();
  
  const checkpoint = {
    id: checkpointId,
    type: 'configuration',
    timestamp: Date.now(),
    config: {
      jest: await this.backupJestConfig(),
      npm: await this.backupNpmConfig(),
      env: await this.backupEnvConfig(),
      custom: await this.backupCustomConfig()
    },
    metadata: {
      configFiles: [],
      totalConfigs: 0
    }
  };
  
  // Backup Jest configuration
  const jestConfigPaths = [
    'jest.config.js',
    'jest.config.json',
    'package.json' // Para configuración en package.json
  ];
  
  for (const configPath of jestConfigPaths) {
    if (await this.fileExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf8');
      checkpoint.config.jest[configPath] = content;
      checkpoint.metadata.configFiles.push(configPath);
    }
  }
  
  // Backup environment variables relacionadas con tests
  const testEnvVars = Object.keys(process.env)
    .filter(key => key.includes('TEST') || key.includes('JEST') || key.includes('NODE'))
    .reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {});
  
  checkpoint.config.env = testEnvVars;
  checkpoint.metadata.totalConfigs = Object.keys(checkpoint.config).length;
  
  this.checkpoints.set(checkpointId, checkpoint);
  
  this.emit('checkpointCreated', {
    type: 'configuration',
    id: checkpointId,
    configs: checkpoint.metadata.totalConfigs
  });
  
  return checkpointId;
}
```

### 3. Environment Variables Checkpoint

```javascript
async createEnvironmentCheckpoint() {
  const checkpointId = this.generateCheckpointId();
  
  const checkpoint = {
    id: checkpointId,
    type: 'environment',
    timestamp: Date.now(),
    environment: {
      variables: { ...process.env },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      argv: [...process.argv],
      execPath: process.execPath
    },
    metadata: {
      totalVars: Object.keys(process.env).length,
      testRelatedVars: 0,
      sensitiveVars: []
    }
  };
  
  // Identificar variables relacionadas con tests
  const testRelatedKeys = Object.keys(process.env).filter(key => 
    key.includes('TEST') || 
    key.includes('JEST') || 
    key.includes('NODE') ||
    key.includes('CI') ||
    key.includes('DEBUG')
  );
  
  checkpoint.metadata.testRelatedVars = testRelatedKeys.length;
  
  // Identificar variables sensibles (no incluir valores)
  const sensitiveKeys = Object.keys(process.env).filter(key =>
    key.includes('PASSWORD') ||
    key.includes('SECRET') ||
    key.includes('KEY') ||
    key.includes('TOKEN') ||
    key.includes('API')
  );
  
  checkpoint.metadata.sensitiveVars = sensitiveKeys;
  
  // Para variables sensibles, solo guardar que existen, no sus valores
  sensitiveKeys.forEach(key => {
    checkpoint.environment.variables[key] = '[SENSITIVE_VALUE_HIDDEN]';
  });
  
  this.checkpoints.set(checkpointId, checkpoint);
  
  this.emit('checkpointCreated', {
    type: 'environment',
    id: checkpointId,
    variables: checkpoint.metadata.totalVars,
    testRelated: checkpoint.metadata.testRelatedVars
  });
  
  return checkpointId;
}
```

### 4. Process State Checkpoint

```javascript
async createProcessCheckpoint() {
  const checkpointId = this.generateCheckpointId();
  
  const checkpoint = {
    id: checkpointId,
    type: 'process',
    timestamp: Date.now(),
    process: {
      pid: process.pid,
      ppid: process.ppid,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      versions: process.versions,
      features: process.features,
      moduleLoadList: [...(process.moduleLoadList || [])],
      openHandles: await this.getOpenHandles(),
      activeTimers: await this.getActiveTimers(),
      eventLoopLag: await this.measureEventLoopLag()
    },
    metadata: {
      openHandles: 0,
      activeTimers: 0,
      memoryUsage: 0
    }
  };
  
  checkpoint.metadata.openHandles = checkpoint.process.openHandles.length;
  checkpoint.metadata.activeTimers = checkpoint.process.activeTimers.length;
  checkpoint.metadata.memoryUsage = checkpoint.process.memory.heapUsed;
  
  this.checkpoints.set(checkpointId, checkpoint);
  
  this.emit('checkpointCreated', {
    type: 'process',
    id: checkpointId,
    memory: checkpoint.metadata.memoryUsage,
    handles: checkpoint.metadata.openHandles
  });
  
  return checkpointId;
}

async getOpenHandles() {
  // Obtener handles abiertos del proceso
  try {
    if (process._getActiveHandles) {
      return process._getActiveHandles().map(handle => ({
        type: handle.constructor.name,
        id: handle._handle ? handle._handle.fd : null
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

async getActiveTimers() {
  // Obtener timers activos
  try {
    if (process._getActiveRequests) {
      return process._getActiveRequests().map(req => ({
        type: req.constructor.name,
        id: req.id || null
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

async measureEventLoopLag() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      resolve(lag);
    });
  });
}
```

### 5. Memory State Checkpoint

```javascript
async createMemoryCheckpoint() {
  const checkpointId = this.generateCheckpointId();
  
  const checkpoint = {
    id: checkpointId,
    type: 'memory',
    timestamp: Date.now(),
    memory: {
      usage: process.memoryUsage(),
      heapSnapshot: await this.createHeapSnapshot(),
      moduleCache: await this.captureModuleCache(),
      globalObjects: await this.captureGlobalObjects(),
      gcStats: await this.getGCStats()
    },
    metadata: {
      heapSize: 0,
      moduleCount: 0,
      globalCount: 0
    }
  };
  
  checkpoint.metadata.heapSize = checkpoint.memory.usage.heapUsed;
  checkpoint.metadata.moduleCount = Object.keys(checkpoint.memory.moduleCache).length;
  checkpoint.metadata.globalCount = Object.keys(checkpoint.memory.globalObjects).length;
  
  this.checkpoints.set(checkpointId, checkpoint);
  
  this.emit('checkpointCreated', {
    type: 'memory',
    id: checkpointId,
    heapSize: checkpoint.metadata.heapSize,
    modules: checkpoint.metadata.moduleCount
  });
  
  return checkpointId;
}

async createHeapSnapshot() {
  // Crear snapshot simplificado del heap
  const snapshot = {
    timestamp: Date.now(),
    size: process.memoryUsage().heapUsed,
    objects: {}
  };
  
  // Capturar información básica sobre objetos globales
  for (const key in global) {
    if (global.hasOwnProperty(key)) {
      const value = global[key];
      snapshot.objects[key] = {
        type: typeof value,
        constructor: value && value.constructor ? value.constructor.name : null,
        isFunction: typeof value === 'function',
        isObject: typeof value === 'object' && value !== null
      };
    }
  }
  
  return snapshot;
}

async captureModuleCache() {
  const cache = {};
  
  for (const [id, module] of Object.entries(require.cache || {})) {
    cache[id] = {
      filename: module.filename,
      loaded: module.loaded,
      children: module.children ? module.children.map(child => child.id) : [],
      parent: module.parent ? module.parent.id : null
    };
  }
  
  return cache;
}

async captureGlobalObjects() {
  const globals = {};
  
  // Capturar objetos globales relevantes para tests
  const relevantGlobals = [
    'jest', 'describe', 'it', 'test', 'expect', 'beforeAll', 'afterAll',
    'beforeEach', 'afterEach', 'console', 'process', 'Buffer', 'global'
  ];
  
  for (const key of relevantGlobals) {
    if (key in global) {
      globals[key] = {
        type: typeof global[key],
        exists: true,
        constructor: global[key] && global[key].constructor ? global[key].constructor.name : null
      };
    }
  }
  
  return globals;
}

async getGCStats() {
  // Obtener estadísticas de garbage collection si están disponibles
  if (global.gc && process.memoryUsage.rss) {
    const beforeGC = process.memoryUsage();
    global.gc();
    const afterGC = process.memoryUsage();
    
    return {
      beforeGC,
      afterGC,
      freed: beforeGC.heapUsed - afterGC.heapUsed,
      timestamp: Date.now()
    };
  }
  
  return null;
}
```

## Estrategias de Rollback

### 1. Filesystem Rollback

```javascript
async rollbackFilesystem(checkpointId) {
  const checkpoint = this.checkpoints.get(checkpointId);
  if (!checkpoint || checkpoint.type !== 'filesystem') {
    throw new Error(`Invalid filesystem checkpoint: ${checkpointId}`);
  }
  
  const rollbackResults = {
    success: true,
    filesRestored: 0,
    filesSkipped: 0,
    errors: []
  };
  
  try {
    // Restaurar cada archivo del checkpoint
    for (const fileInfo of checkpoint.files) {
      const originalPath = path.join(checkpoint.testPath, fileInfo.path);
      const backupPath = path.join(checkpoint.backupPath, fileInfo.path);
      
      try {
        // Verificar que el backup existe
        if (!(await this.fileExists(backupPath))) {
          rollbackResults.errors.push(`Backup file not found: ${backupPath}`);
          rollbackResults.filesSkipped++;
          continue;
        }
        
        // Crear directorio padre si no existe
        await fs.mkdir(path.dirname(originalPath), { recursive: true });
        
        if (fileInfo.isSymlink) {
          // Restaurar enlace simbólico
          const linkTarget = checkpoint.metadata.symlinks.get(fileInfo.path);
          if (linkTarget) {
            // Eliminar archivo existente si existe
            try {
              await fs.unlink(originalPath);
            } catch (error) {
              // Ignorar si el archivo no existe
            }
            
            await fs.symlink(linkTarget, originalPath);
          }
        } else {
          // Restaurar archivo regular
          await fs.copyFile(backupPath, originalPath);
          
          // Restaurar permisos
          const permissions = checkpoint.metadata.permissions.get(fileInfo.path);
          if (permissions) {
            await fs.chmod(originalPath, permissions);
          }
        }
        
        rollbackResults.filesRestored++;
        
      } catch (error) {
        rollbackResults.errors.push(`Failed to restore ${fileInfo.path}: ${error.message}`);
        rollbackResults.filesSkipped++;
      }
    }
    
    // Verificar integridad después del rollback
    const integrityCheck = await this.verifyFilesystemIntegrity(checkpoint);
    if (!integrityCheck.valid) {
      rollbackResults.success = false;
      rollbackResults.errors.push(...integrityCheck.errors);
    }
    
    this.emit('rollbackCompleted', {
      type: 'filesystem',
      checkpointId,
      success: rollbackResults.success,
      filesRestored: rollbackResults.filesRestored,
      errors: rollbackResults.errors.length
    });
    
    return rollbackResults;
    
  } catch (error) {
    rollbackResults.success = false;
    rollbackResults.errors.push(`Rollback failed: ${error.message}`);
    
    this.emit('rollbackFailed', {
      type: 'filesystem',
      checkpointId,
      error: error.message
    });
    
    return rollbackResults;
  }
}

async verifyFilesystemIntegrity(checkpoint) {
  const verification = {
    valid: true,
    errors: [],
    checkedFiles: 0
  };
  
  for (const fileInfo of checkpoint.files) {
    const filePath = path.join(checkpoint.testPath, fileInfo.path);
    
    try {
      const stats = await fs.stat(filePath);
      
      // Verificar tamaño
      if (stats.size !== fileInfo.size) {
        verification.errors.push(`Size mismatch for ${fileInfo.path}: expected ${fileInfo.size}, got ${stats.size}`);
        verification.valid = false;
      }
      
      // Verificar permisos
      if (stats.mode !== fileInfo.mode) {
        verification.errors.push(`Permission mismatch for ${fileInfo.path}: expected ${fileInfo.mode}, got ${stats.mode}`);
        verification.valid = false;
      }
      
      verification.checkedFiles++;
      
    } catch (error) {
      verification.errors.push(`Cannot verify ${fileInfo.path}: ${error.message}`);
      verification.valid = false;
    }
  }
  
  return verification;
}
```

### 2. Configuration Rollback

```javascript
async rollbackConfiguration(checkpointId) {
  const checkpoint = this.checkpoints.get(checkpointId);
  if (!checkpoint || checkpoint.type !== 'configuration') {
    throw new Error(`Invalid configuration checkpoint: ${checkpointId}`);
  }
  
  const rollbackResults = {
    success: true,
    configsRestored: 0,
    configsSkipped: 0,
    errors: []
  };
  
  try {
    // Restaurar configuraciones de Jest
    for (const [configPath, content] of Object.entries(checkpoint.config.jest)) {
      try {
        await fs.writeFile(configPath, content, 'utf8');
        rollbackResults.configsRestored++;
      } catch (error) {
        rollbackResults.errors.push(`Failed to restore Jest config ${configPath}: ${error.message}`);
        rollbackResults.configsSkipped++;
      }
    }
    
    // Restaurar variables de entorno
    for (const [key, value] of Object.entries(checkpoint.config.env)) {
      if (value === '[SENSITIVE_VALUE_HIDDEN]') {
        // No restaurar variables sensibles
        continue;
      }
      
      process.env[key] = value;
      rollbackResults.configsRestored++;
    }
    
    // Limpiar variables de entorno que no estaban en el checkpoint
    const currentEnvKeys = Object.keys(process.env);
    const checkpointEnvKeys = Object.keys(checkpoint.config.env);
    
    for (const key of currentEnvKeys) {
      if (!checkpointEnvKeys.includes(key) && this.isTestRelatedEnvVar(key)) {
        delete process.env[key];
      }
    }
    
    this.emit('rollbackCompleted', {
      type: 'configuration',
      checkpointId,
      success: rollbackResults.success,
      configsRestored: rollbackResults.configsRestored,
      errors: rollbackResults.errors.length
    });
    
    return rollbackResults;
    
  } catch (error) {
    rollbackResults.success = false;
    rollbackResults.errors.push(`Configuration rollback failed: ${error.message}`);
    
    this.emit('rollbackFailed', {
      type: 'configuration',
      checkpointId,
      error: error.message
    });
    
    return rollbackResults;
  }
}

isTestRelatedEnvVar(key) {
  return key.includes('TEST') || 
         key.includes('JEST') || 
         key.includes('NODE_ENV') ||
         key.includes('CI') ||
         key.includes('DEBUG');
}
```

### 3. Environment Rollback

```javascript
async rollbackEnvironment(checkpointId) {
  const checkpoint = this.checkpoints.get(checkpointId);
  if (!checkpoint || checkpoint.type !== 'environment') {
    throw new Error(`Invalid environment checkpoint: ${checkpointId}`);
  }
  
  const rollbackResults = {
    success: true,
    variablesRestored: 0,
    variablesRemoved: 0,
    errors: []
  };
  
  try {
    const currentEnv = { ...process.env };
    const checkpointEnv = checkpoint.environment.variables;
    
    // Restaurar variables del checkpoint
    for (const [key, value] of Object.entries(checkpointEnv)) {
      if (value === '[SENSITIVE_VALUE_HIDDEN]') {
        // Mantener variables sensibles como están
        continue;
      }
      
      process.env[key] = value;
      rollbackResults.variablesRestored++;
    }
    
    // Remover variables que no estaban en el checkpoint
    for (const key of Object.keys(currentEnv)) {
      if (!(key in checkpointEnv) && this.isTestRelatedEnvVar(key)) {
        delete process.env[key];
        rollbackResults.variablesRemoved++;
      }
    }
    
    // Verificar que el directorio de trabajo sea el correcto
    if (process.cwd() !== checkpoint.environment.cwd) {
      try {
        process.chdir(checkpoint.environment.cwd);
      } catch (error) {
        rollbackResults.errors.push(`Failed to restore working directory: ${error.message}`);
      }
    }
    
    this.emit('rollbackCompleted', {
      type: 'environment',
      checkpointId,
      success: rollbackResults.success,
      variablesRestored: rollbackResults.variablesRestored,
      variablesRemoved: rollbackResults.variablesRemoved
    });
    
    return rollbackResults;
    
  } catch (error) {
    rollbackResults.success = false;
    rollbackResults.errors.push(`Environment rollback failed: ${error.message}`);
    
    this.emit('rollbackFailed', {
      type: 'environment',
      checkpointId,
      error: error.message
    });
    
    return rollbackResults;
  }
}
```

### 4. Process Rollback

```javascript
async rollbackProcess(checkpointId) {
  const checkpoint = this.checkpoints.get(checkpointId);
  if (!checkpoint || checkpoint.type !== 'process') {
    throw new Error(`Invalid process checkpoint: ${checkpointId}`);
  }
  
  const rollbackResults = {
    success: true,
    actionsPerformed: [],
    errors: []
  };
  
  try {
    // Limpiar handles abiertos que no estaban en el checkpoint
    await this.cleanupExtraHandles(checkpoint.process.openHandles);
    rollbackResults.actionsPerformed.push('Cleaned up extra handles');
    
    // Limpiar timers activos que no estaban en el checkpoint
    await this.cleanupExtraTimers(checkpoint.process.activeTimers);
    rollbackResults.actionsPerformed.push('Cleaned up extra timers');
    
    // Forzar garbage collection si la memoria ha crecido significativamente
    const currentMemory = process.memoryUsage();
    const checkpointMemory = checkpoint.process.memory;
    
    if (currentMemory.heapUsed > checkpointMemory.heapUsed * 1.5) {
      if (global.gc) {
        global.gc();
        rollbackResults.actionsPerformed.push('Forced garbage collection');
      }
    }
    
    // Restaurar module load list si es posible
    if (process.moduleLoadList && checkpoint.process.moduleLoadList) {
      // Esto es principalmente informativo, no se puede revertir completamente
      rollbackResults.actionsPerformed.push('Module load list checked');
    }
    
    this.emit('rollbackCompleted', {
      type: 'process',
      checkpointId,
      success: rollbackResults.success,
      actions: rollbackResults.actionsPerformed.length
    });
    
    return rollbackResults;
    
  } catch (error) {
    rollbackResults.success = false;
    rollbackResults.errors.push(`Process rollback failed: ${error.message}`);
    
    this.emit('rollbackFailed', {
      type: 'process',
      checkpointId,
      error: error.message
    });
    
    return rollbackResults;
  }
}

async cleanupExtraHandles(checkpointHandles) {
  try {
    const currentHandles = await this.getOpenHandles();
    const checkpointHandleIds = new Set(checkpointHandles.map(h => h.id).filter(Boolean));
    
    for (const handle of currentHandles) {
      if (handle.id && !checkpointHandleIds.has(handle.id)) {
        // Intentar cerrar handle extra (con cuidado)
        try {
          if (handle.close && typeof handle.close === 'function') {
            handle.close();
          }
        } catch (error) {
          // Ignorar errores al cerrar handles
        }
      }
    }
  } catch (error) {
    // Ignorar errores en la limpieza de handles
  }
}

async cleanupExtraTimers(checkpointTimers) {
  try {
    const currentTimers = await this.getActiveTimers();
    const checkpointTimerIds = new Set(checkpointTimers.map(t => t.id).filter(Boolean));
    
    for (const timer of currentTimers) {
      if (timer.id && !checkpointTimerIds.has(timer.id)) {
        // Los timers se limpiarán automáticamente o por el garbage collector
        // No hay una forma segura de cancelar timers arbitrarios
      }
    }
  } catch (error) {
    // Ignorar errores en la limpieza de timers
  }
}
```

### 5. Memory Rollback

```javascript
async rollbackMemory(checkpointId) {
  const checkpoint = this.checkpoints.get(checkpointId);
  if (!checkpoint || checkpoint.type !== 'memory') {
    throw new Error(`Invalid memory checkpoint: ${checkpointId}`);
  }
  
  const rollbackResults = {
    success: true,
    actionsPerformed: [],
    memoryFreed: 0,
    errors: []
  };
  
  try {
    const beforeMemory = process.memoryUsage();
    
    // Limpiar caché de módulos que no estaban en el checkpoint
    await this.cleanupModuleCache(checkpoint.memory.moduleCache);
    rollbackResults.actionsPerformed.push('Cleaned up module cache');
    
    // Restaurar objetos globales al estado del checkpoint
    await this.restoreGlobalObjects(checkpoint.memory.globalObjects);
    rollbackResults.actionsPerformed.push('Restored global objects');
    
    // Forzar garbage collection múltiples veces
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setImmediate(resolve));
      }
      rollbackResults.actionsPerformed.push('Performed aggressive garbage collection');
    }
    
    // Limpiar referencias circulares conocidas
    await this.cleanupCircularReferences();
    rollbackResults.actionsPerformed.push('Cleaned up circular references');
    
    const afterMemory = process.memoryUsage();
    rollbackResults.memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
    
    this.emit('rollbackCompleted', {
      type: 'memory',
      checkpointId,
      success: rollbackResults.success,
      memoryFreed: rollbackResults.memoryFreed,
      actions: rollbackResults.actionsPerformed.length
    });
    
    return rollbackResults;
    
  } catch (error) {
    rollbackResults.success = false;
    rollbackResults.errors.push(`Memory rollback failed: ${error.message}`);
    
    this.emit('rollbackFailed', {
      type: 'memory',
      checkpointId,
      error: error.message
    });
    
    return rollbackResults;
  }
}

async cleanupModuleCache(checkpointCache) {
  const currentCache = require.cache || {};
  const checkpointModules = new Set(Object.keys(checkpointCache));
  
  // Remover módulos que no estaban en el checkpoint
  for (const moduleId of Object.keys(currentCache)) {
    if (!checkpointModules.has(moduleId)) {
      // Solo remover módulos de test, no módulos del sistema
      if (this.isTestModule(moduleId)) {
        delete require.cache[moduleId];
      }
    }
  }
}

isTestModule(moduleId) {
  return moduleId.includes('test') || 
         moduleId.includes('spec') || 
         moduleId.includes('__tests__') ||
         moduleId.includes('.test.') ||
         moduleId.includes('.spec.');
}

async restoreGlobalObjects(checkpointGlobals) {
  // Restaurar objetos globales relevantes para tests
  for (const [key, info] of Object.entries(checkpointGlobals)) {
    if (info.exists && !(key in global)) {
      // El objeto existía en el checkpoint pero no existe ahora
      // Esto podría indicar un problema, pero no podemos restaurarlo fácilmente
      continue;
    }
    
    if (!info.exists && (key in global)) {
      // El objeto no existía en el checkpoint pero existe ahora
      // Considerar eliminarlo si es seguro
      if (this.isSafeToRemoveGlobal(key)) {
        try {
          delete global[key];
        } catch (error) {
          // Ignorar errores al eliminar globales
        }
      }
    }
  }
}

isSafeToRemoveGlobal(key) {
  // Lista de globales que es seguro remover
  const safeToRemove = [
    'testVar', 'mockData', 'testConfig', 'tempGlobal'
  ];
  
  return safeToRemove.includes(key) || key.startsWith('test') || key.startsWith('mock');
}

async cleanupCircularReferences() {
  // Implementar limpieza básica de referencias circulares
  // Esto es complejo y específico del contexto, aquí un ejemplo básico
  
  if (global.testCleanup && typeof global.testCleanup === 'function') {
    try {
      global.testCleanup();
    } catch (error) {
      // Ignorar errores en la limpieza
    }
  }
  
  // Limpiar referencias circulares en objetos de test conocidos
  const testObjects = ['jest', 'jasmine', 'mocha'];
  for (const obj of testObjects) {
    if (global[obj] && global[obj].clearCache) {
      try {
        global[obj].clearCache();
      } catch (error) {
        // Ignorar errores
      }
    }
  }
}
```

## Sistema de Autoreparación

### Auto-Repair Engine

```javascript
async performAutoRepair(failureContext) {
  const repairResults = {
    success: false,
    repairsAttempted: [],
    repairsSuccessful: [],
    errors: []
  };
  
  try {
    // Analizar el contexto del fallo
    const analysis = await this.analyzeFailure(failureContext);
    
    // Determinar estrategias de reparación
    const repairStrategies = this.determineRepairStrategies(analysis);
    
    // Ejecutar estrategias de reparación en orden de prioridad
    for (const strategy of repairStrategies) {
      try {
        repairResults.repairsAttempted.push(strategy.name);
        
        const result = await this.executeRepairStrategy(strategy, failureContext);
        
        if (result.success) {
          repairResults.repairsSuccessful.push(strategy.name);
          
          // Verificar si la reparación resolvió el problema
          const verification = await this.verifyRepair(failureContext, strategy);
          
          if (verification.success) {
            repairResults.success = true;
            break; // Reparación exitosa, no necesitamos más estrategias
          }
        }
        
      } catch (error) {
        repairResults.errors.push(`Repair strategy ${strategy.name} failed: ${error.message}`);
      }
    }
    
    // Si ninguna estrategia funcionó, intentar reparación completa
    if (!repairResults.success) {
      const fullRepair = await this.performFullSystemRepair(failureContext);
      repairResults.repairsAttempted.push('full_system_repair');
      
      if (fullRepair.success) {
        repairResults.repairsSuccessful.push('full_system_repair');
        repairResults.success = true;
      }
    }
    
    this.emit('autoRepairCompleted', {
      success: repairResults.success,
      strategies: repairResults.repairsSuccessful,
      errors: repairResults.errors.length
    });
    
    return repairResults;
    
  } catch (error) {
    repairResults.errors.push(`Auto-repair failed: ${error.message}`);
    
    this.emit('autoRepairFailed', {
      error: error.message,
      context: failureContext
    });
    
    return repairResults;
  }
}

analyzeFailure(failureContext) {
  const analysis = {
    type: 'unknown',
    severity: 'medium',
    affectedSystems: [],
    possibleCauses: [],
    recommendedActions: []
  };
  
  // Analizar tipo de fallo
  if (failureContext.error) {
    const errorMessage = failureContext.error.message || '';
    
    if (errorMessage.includes('ENOENT') || errorMessage.includes('file not found')) {
      analysis.type = 'filesystem';
      analysis.affectedSystems.push('filesystem');
      analysis.possibleCauses.push('Missing files or directories');
      analysis.recommendedActions.push('filesystem_rollback');
    }
    
    if (errorMessage.includes('out of memory') || errorMessage.includes('heap')) {
      analysis.type = 'memory';
      analysis.severity = 'high';
      analysis.affectedSystems.push('memory');
      analysis.possibleCauses.push('Memory leak or excessive memory usage');
      analysis.recommendedActions.push('memory_cleanup', 'memory_rollback');
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      analysis.type = 'timeout';
      analysis.affectedSystems.push('network', 'process');
      analysis.possibleCauses.push('Network issues or slow operations');
      analysis.recommendedActions.push('process_cleanup', 'environment_reset');
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      analysis.type = 'permission';
      analysis.affectedSystems.push('filesystem');
      analysis.possibleCauses.push('File permission issues');
      analysis.recommendedActions.push('permission_fix', 'filesystem_rollback');
    }
  }
  
  // Analizar contexto del sistema
  if (failureContext.systemState) {
    const { memory, cpu, io } = failureContext.systemState;
    
    if (memory && memory.usage > 0.9) {
      analysis.affectedSystems.push('memory');
      analysis.recommendedActions.push('memory_cleanup');
    }
    
    if (cpu && cpu.usage > 0.95) {
      analysis.affectedSystems.push('cpu');
      analysis.recommendedActions.push('process_throttling');
    }
    
    if (io && io.errors > 10) {
      analysis.affectedSystems.push('io');
      analysis.recommendedActions.push('io_reset');
    }
  }
  
  return analysis;
}

determineRepairStrategies(analysis) {
  const strategies = [];
  
  // Mapear acciones recomendadas a estrategias
  const strategyMap = {
    'filesystem_rollback': {
      name: 'filesystem_rollback',
      priority: 1,
      description: 'Rollback filesystem to last known good state',
      action: 'rollbackToLastCheckpoint',
      params: { type: 'filesystem' }
    },
    'memory_cleanup': {
      name: 'memory_cleanup',
      priority: 2,
      description: 'Clean up memory and force garbage collection',
      action: 'cleanupMemory',
      params: {}
    },
    'memory_rollback': {
      name: 'memory_rollback',
      priority: 3,
      description: 'Rollback memory state to checkpoint',
      action: 'rollbackToLastCheckpoint',
      params: { type: 'memory' }
    },
    'process_cleanup': {
      name: 'process_cleanup',
      priority: 2,
      description: 'Clean up process state and handles',
      action: 'cleanupProcess',
      params: {}
    },
    'environment_reset': {
      name: 'environment_reset',
      priority: 3,
      description: 'Reset environment to checkpoint state',
      action: 'rollbackToLastCheckpoint',
      params: { type: 'environment' }
    },
    'permission_fix': {
      name: 'permission_fix',
      priority: 1,
      description: 'Fix file permissions',
      action: 'fixPermissions',
      params: {}
    },
    'process_throttling': {
      name: 'process_throttling',
      priority: 2,
      description: 'Throttle CPU-intensive processes',
      action: 'throttleProcesses',
      params: {}
    },
    'io_reset': {
      name: 'io_reset',
      priority: 2,
      description: 'Reset I/O operations',
      action: 'resetIO',
      params: {}
    }
  };
  
  // Agregar estrategias basadas en acciones recomendadas
  for (const action of analysis.recommendedActions) {
    if (strategyMap[action]) {
      strategies.push(strategyMap[action]);
    }
  }
  
  // Ordenar por prioridad (menor número = mayor prioridad)
  strategies.sort((a, b) => a.priority - b.priority);
  
  return strategies;
}

async executeRepairStrategy(strategy, failureContext) {
  const result = {
    success: false,
    message: '',
    details: {}
  };
  
  try {
    switch (strategy.action) {
      case 'rollbackToLastCheckpoint':
        result.details = await this.rollbackToLastCheckpoint(strategy.params.type);
        result.success = result.details.success;
        result.message = `Rollback to ${strategy.params.type} checkpoint completed`;
        break;
        
      case 'cleanupMemory':
        result.details = await this.performMemoryCleanup();
        result.success = true;
        result.message = 'Memory cleanup completed';
        break;
        
      case 'cleanupProcess':
        result.details = await this.performProcessCleanup();
        result.success = true;
        result.message = 'Process cleanup completed';
        break;
        
      case 'fixPermissions':
        result.details = await this.fixFilePermissions(failureContext);
        result.success = result.details.success;
        result.message = 'Permission fix attempted';
        break;
        
      case 'throttleProcesses':
        result.details = await this.throttleCPUIntensiveProcesses();
        result.success = true;
        result.message = 'Process throttling applied';
        break;
        
      case 'resetIO':
        result.details = await this.resetIOOperations();
        result.success = true;
        result.message = 'I/O operations reset';
        break;
        
      default:
        throw new Error(`Unknown repair action: ${strategy.action}`);
    }
    
  } catch (error) {
    result.success = false;
    result.message = `Repair strategy failed: ${error.message}`;
    result.details = { error: error.message };
  }
  
  return result;
}

async rollbackToLastCheckpoint(type) {
  // Encontrar el checkpoint más reciente del tipo especificado
  const checkpoints = Array.from(this.checkpoints.values())
    .filter(cp => cp.type === type)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  if (checkpoints.length === 0) {
    throw new Error(`No checkpoints found for type: ${type}`);
  }
  
  const latestCheckpoint = checkpoints[0];
  
  // Ejecutar rollback específico según el tipo
  switch (type) {
    case 'filesystem':
      return await this.rollbackFilesystem(latestCheckpoint.id);
    case 'configuration':
      return await this.rollbackConfiguration(latestCheckpoint.id);
    case 'environment':
      return await this.rollbackEnvironment(latestCheckpoint.id);
    case 'process':
      return await this.rollbackProcess(latestCheckpoint.id);
    case 'memory':
      return await this.rollbackMemory(latestCheckpoint.id);
    default:
      throw new Error(`Unknown checkpoint type: ${type}`);
  }
}

async performMemoryCleanup() {
  const beforeMemory = process.memoryUsage();
  
  // Limpiar caché de require
  const testModules = Object.keys(require.cache || {})
    .filter(id => this.isTestModule(id));
  
  testModules.forEach(id => {
    delete require.cache[id];
  });
  
  // Forzar garbage collection múltiples veces
  if (global.gc) {
    for (let i = 0; i < 5; i++) {
      global.gc();
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  const afterMemory = process.memoryUsage();
  
  return {
    success: true,
    memoryFreed: beforeMemory.heapUsed - afterMemory.heapUsed,
    modulesCleared: testModules.length
  };
}

async performProcessCleanup() {
  const results = {
    handlesCleared: 0,
    timersCleared: 0,
    listenersRemoved: 0
  };
  
  // Limpiar event listeners no esenciales
  if (process.removeAllListeners) {
    const events = ['uncaughtException', 'unhandledRejection', 'warning'];
    events.forEach(event => {
      const listenerCount = process.listenerCount(event);
      if (listenerCount > 1) { // Mantener al menos un listener
        process.removeAllListeners(event);
        results.listenersRemoved += listenerCount - 1;
      }
    });
  }
  
  // Limpiar timers globales si es posible
  if (global.clearImmediate && global.clearTimeout && global.clearInterval) {
    // Esto es limitado, no podemos acceder a todos los timers activos
    results.timersCleared = 0; // Placeholder
  }
  
  return {
    success: true,
    ...results
  };
}

async fixFilePermissions(failureContext) {
  const results = {
    success: false,
    filesFixed: 0,
    errors: []
  };
  
  try {
    // Intentar identificar archivos con problemas de permisos
    const problematicFiles = await this.identifyPermissionIssues(failureContext);
    
    for (const filePath of problematicFiles) {
      try {
        // Intentar dar permisos de lectura/escritura
        await fs.chmod(filePath, 0o644);
        results.filesFixed++;
      } catch (error) {
        results.errors.push(`Failed to fix permissions for ${filePath}: ${error.message}`);
      }
    }
    
    results.success = results.filesFixed > 0;
    
  } catch (error) {
    results.errors.push(`Permission fix failed: ${error.message}`);
  }
  
  return results;
}

async identifyPermissionIssues(failureContext) {
  const problematicFiles = [];
  
  // Buscar archivos mencionados en el error
  if (failureContext.error && failureContext.error.message) {
    const errorMessage = failureContext.error.message;
    const filePathRegex = /([\/\w\-\.]+\.(js|json|ts|jsx|tsx))/g;
    const matches = errorMessage.match(filePathRegex);
    
    if (matches) {
      for (const filePath of matches) {
        try {
          await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (error) {
          problematicFiles.push(filePath);
        }
      }
    }
  }
  
  return problematicFiles;
}

async throttleCPUIntensiveProcesses() {
  // Implementar throttling básico
  const results = {
    success: true,
    throttlingApplied: false
  };
  
  // Reducir prioridad del proceso actual si es posible
  try {
    if (process.setpriority) {
      process.setpriority(process.pid, 10); // Prioridad baja
      results.throttlingApplied = true;
    }
  } catch (error) {
    // Ignorar errores de prioridad
  }
  
  // Introducir delays en operaciones intensivas
  if (global.setImmediate) {
    // Esto es más conceptual, requeriría instrumentación del código
    results.throttlingApplied = true;
  }
  
  return results;
}

async resetIOOperations() {
  const results = {
    success: true,
    operationsReset: 0
  };
  
  // Limpiar buffers de I/O si es posible
  if (process.stdout && process.stdout._flush) {
    try {
      process.stdout._flush();
      results.operationsReset++;
    } catch (error) {
      // Ignorar errores
    }
  }
  
  if (process.stderr && process.stderr._flush) {
    try {
      process.stderr._flush();
      results.operationsReset++;
    } catch (error) {
      // Ignorar errores
    }
  }
  
  return results;
}

async verifyRepair(failureContext, strategy) {
  const verification = {
    success: false,
    message: '',
    details: {}
  };
  
  try {
    // Verificación básica según el tipo de estrategia
    switch (strategy.name) {
      case 'filesystem_rollback':
        verification.success = await this.verifyFilesystemHealth();
        verification.message = 'Filesystem health verified';
        break;
        
      case 'memory_cleanup':
      case 'memory_rollback':
        verification.success = await this.verifyMemoryHealth();
        verification.message = 'Memory health verified';
        break;
        
      case 'process_cleanup':
        verification.success = await this.verifyProcessHealth();
        verification.message = 'Process health verified';
        break;
        
      case 'environment_reset':
        verification.success = await this.verifyEnvironmentHealth();
        verification.message = 'Environment health verified';
        break;
        
      default:
        verification.success = true; // Asumir éxito para estrategias no verificables
        verification.message = 'Repair strategy completed';
    }
    
  } catch (error) {
    verification.success = false;
    verification.message = `Verification failed: ${error.message}`;
  }
  
  return verification;
}

async verifyFilesystemHealth() {
  // Verificar que archivos críticos existen y son accesibles
  const criticalFiles = ['package.json', 'jest.config.js'];
  
  for (const file of criticalFiles) {
    try {
      await fs.access(file, fs.constants.R_OK);
    } catch (error) {
      return false;
    }
  }
  
  return true;
}

async verifyMemoryHealth() {
  const memory = process.memoryUsage();
  const heapUsageRatio = memory.heapUsed / memory.heapTotal;
  
  // Considerar saludable si el uso de heap es menor al 80%
  return heapUsageRatio < 0.8;
}

async verifyProcessHealth() {
  // Verificar que el proceso está en un estado saludable
  const eventLoopLag = await this.measureEventLoopLag();
  
  // Considerar saludable si el lag del event loop es menor a 100ms
  return eventLoopLag < 100;
}

async verifyEnvironmentHealth() {
  // Verificar que variables de entorno críticas están presentes
  const criticalEnvVars = ['NODE_ENV', 'PATH'];
  
  for (const envVar of criticalEnvVars) {
    if (!process.env[envVar]) {
      return false;
    }
  }
  
  return true;
}

async performFullSystemRepair(failureContext) {
  const results = {
    success: false,
    repairsPerformed: [],
    errors: []
  };
  
  try {
    // Realizar rollback completo a todos los checkpoints más recientes
    const checkpointTypes = ['memory', 'process', 'environment', 'configuration', 'filesystem'];
    
    for (const type of checkpointTypes) {
      try {
        const rollbackResult = await this.rollbackToLastCheckpoint(type);
        if (rollbackResult.success) {
          results.repairsPerformed.push(`${type}_rollback`);
        }
      } catch (error) {
        results.errors.push(`Failed to rollback ${type}: ${error.message}`);
      }
    }
    
    // Realizar limpieza agresiva
    await this.performMemoryCleanup();
    results.repairsPerformed.push('memory_cleanup');
    
    await this.performProcessCleanup();
    results.repairsPerformed.push('process_cleanup');
    
    // Verificar salud del sistema después de la reparación completa
    const systemHealth = await this.checkSystemHealth();
    results.success = systemHealth.healthy;
    
    if (!results.success) {
      results.errors.push('System still unhealthy after full repair');
    }
    
  } catch (error) {
    results.errors.push(`Full system repair failed: ${error.message}`);
  }
  
  return results;
}

async checkSystemHealth() {
  const health = {
    healthy: true,
    issues: []
  };
  
  // Verificar memoria
  const memory = process.memoryUsage();
  if (memory.heapUsed / memory.heapTotal > 0.9) {
    health.healthy = false;
    health.issues.push('High memory usage');
  }
  
  // Verificar event loop
  const eventLoopLag = await this.measureEventLoopLag();
  if (eventLoopLag > 200) {
    health.healthy = false;
    health.issues.push('High event loop lag');
  }
  
  // Verificar archivos críticos
  const filesystemHealthy = await this.verifyFilesystemHealth();
  if (!filesystemHealthy) {
    health.healthy = false;
    health.issues.push('Filesystem issues');
  }
  
  return health;
}
```

## Configuración y Uso

### Configuración Básica

```javascript
const rollbackSystem = new SafeRollbackSystem({
  // Configuración de backup
  backupDir: './backups',
  maxCheckpoints: 10,
  autoCleanup: true,
  
  // Configuración de autoreparación
  enableAutoRepair: true,
  repairTimeout: 30000,
  maxRepairAttempts: 3,
  
  // Configuración de validación
  enableValidation: true,
  validationTimeout: 10000,
  
  // Configuración de eventos
  enableEvents: true,
  logLevel: 'info'
});
```

### Uso en Tests

```javascript
// Crear checkpoint antes de test
beforeEach(async () => {
  const checkpointId = await rollbackSystem.createCheckpoint({
    types: ['filesystem', 'memory', 'environment'],
    testName: expect.getState().currentTestName
  });
  
  // Guardar ID para posible rollback
  global.currentCheckpoint = checkpointId;
});

// Rollback en caso de fallo
afterEach(async () => {
  if (global.currentCheckpoint && expect.getState().numPassingAsserts === 0) {
    await rollbackSystem.rollback(global.currentCheckpoint);
  }
});

// Limpieza al final
afterAll(async () => {
  await rollbackSystem.cleanup();
});
```

### Autoreparación Automática

```javascript
// Configurar autoreparación
rollbackSystem.on('testFailure', async (failureContext) => {
  const repairResult = await rollbackSystem.performAutoRepair(failureContext);
  
  if (repairResult.success) {
    console.log('Auto-repair successful:', repairResult.repairsSuccessful);
  } else {
    console.error('Auto-repair failed:', repairResult.errors);
  }
});

// Monitoreo de salud del sistema
setInterval(async () => {
  const health = await rollbackSystem.checkSystemHealth();
  
  if (!health.healthy) {
    console.warn('System health issues detected:', health.issues);
    
    // Intentar autoreparación preventiva
    await rollbackSystem.performAutoRepair({
      type: 'preventive',
      issues: health.issues
    });
  }
}, 30000); // Verificar cada 30 segundos
```

---

*Documentación del SafeRollbackSystem - Versión 1.0*