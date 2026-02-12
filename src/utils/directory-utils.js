/**
 * Utilidades para manejo de directorios
 * Funciones centralizadas para evitar duplicación de código
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Asegura que los directorios especificados existan, creándolos si es necesario
 * @param {string|string[]} directories - Directorio o array de directorios a crear
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.recursive - Crear directorios padre si no existen (default: true)
 * @param {number} options.mode - Permisos del directorio (default: 0o755)
 * @returns {Promise<void>}
 */
export async function ensureDirectories(directories, options = {}) {
    const { recursive = true, mode = 0o755 } = options;
    
    // Normalizar entrada a array
    const dirs = Array.isArray(directories) ? directories : [directories];
    
    for (const dir of dirs) {
        if (!dir) continue;
        
        try {
            // Verificar si el directorio ya existe
            const stats = await fs.stat(dir);
            if (!stats.isDirectory()) {
                throw new Error(`${dir} exists but is not a directory`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // El directorio no existe, crearlo
                await fs.mkdir(dir, { recursive, mode });
                logger.debug(`✓ Directory created: ${dir}`);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Crea un directorio de respaldo con timestamp
 * @param {string} baseDir - Directorio base
 * @param {string} prefix - Prefijo para el directorio de respaldo
 * @returns {Promise<string>} - Ruta del directorio de respaldo creado
 */
export async function createBackupDirectory(baseDir, prefix = 'backup') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(baseDir, `${prefix}-${timestamp}`);
    
    await ensureDirectories(backupDir);
    return backupDir;
}

/**
 * Verifica si un directorio existe y es accesible
 * @param {string} directory - Ruta del directorio
 * @returns {Promise<boolean>}
 */
export async function directoryExists(directory) {
    try {
        const stats = await fs.stat(directory);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Obtiene el tamaño total de un directorio
 * @param {string} directory - Ruta del directorio
 * @returns {Promise<number>} - Tamaño en bytes
 */
export async function getDirectorySize(directory) {
    let totalSize = 0;
    
    try {
        const items = await fs.readdir(directory, { withFileTypes: true });
        
        for (const item of items) {
            const itemPath = path.join(directory, item.name);
            
            if (item.isDirectory()) {
                totalSize += await getDirectorySize(itemPath);
            } else {
                const stats = await fs.stat(itemPath);
                totalSize += stats.size;
            }
        }
    } catch (error) {
        logger.warn(`Warning: Could not calculate size for ${directory}:`, error.message);
    }
    
    return totalSize;
}

/**
 * Limpia directorios antiguos basado en un patrón y edad
 * @param {string} baseDir - Directorio base donde buscar
 * @param {string} pattern - Patrón de nombre de directorio (regex)
 * @param {number} maxAge - Edad máxima en días
 * @returns {Promise<string[]>} - Array de directorios eliminados
 */
export async function cleanupOldDirectories(baseDir, pattern, maxAge = 7) {
    const deletedDirs = [];
    const cutoffDate = new Date(Date.now() - (maxAge * 24 * 60 * 60 * 1000));
    
    try {
        const items = await fs.readdir(baseDir, { withFileTypes: true });
        const regex = new RegExp(pattern);
        
        for (const item of items) {
            if (item.isDirectory() && regex.test(item.name)) {
                const dirPath = path.join(baseDir, item.name);
                const stats = await fs.stat(dirPath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.rm(dirPath, { recursive: true, force: true });
                    deletedDirs.push(dirPath);
                    logger.debug(`✓ Cleaned up old directory: ${dirPath}`);
                }
            }
        }
    } catch (error) {
        logger.warn(`Warning: Could not cleanup directories in ${baseDir}:`, error.message);
    }
    
    return deletedDirs;
}

/**
 * Crea una copia de respaldo de un directorio
 * @param {string} sourceDir - Directorio fuente
 * @param {string} targetDir - Directorio destino
 * @param {Object} options - Opciones de respaldo
 * @param {boolean} options.includeCompression - Comprimir archivos
 * @param {Array} options.excludePatterns - Patrones de archivos a excluir
 * @param {Function} options.progressCallback - Callback de progreso
 * @returns {Promise<Object>} - Resultado del respaldo
 */
export async function backupDirectory(sourceDir, targetDir, options = {}) {
    const {
        includeCompression = false,
        excludePatterns = ['.git', 'node_modules', '.DS_Store', 'Thumbs.db'],
        progressCallback = null
    } = options;
    
    const results = {
        totalFiles: 0,
        copiedFiles: 0,
        compressedFiles: 0,
        skippedFiles: 0,
        errors: [],
        totalSize: 0
    };
    
    await ensureDirectories(targetDir);
    await _backupDirectoryRecursive(sourceDir, targetDir, includeCompression, excludePatterns, results, progressCallback);
    
    return results;
}

/**
 * Función recursiva interna para backup de directorios
 */
async function _backupDirectoryRecursive(sourceDir, targetDir, includeCompression, excludePatterns, results, progressCallback, relativePath = '') {
    try {
        const items = await fs.readdir(sourceDir, { withFileTypes: true });
        
        for (const item of items) {
            const sourcePath = path.join(sourceDir, item.name);
            const targetPath = path.join(targetDir, item.name);
            const itemRelativePath = path.join(relativePath, item.name);
            
            // Verificar si debe excluirse
            if (shouldExcludeItem(item.name, excludePatterns)) {
                results.skippedFiles++;
                continue;
            }
            
            if (item.isDirectory()) {
                await ensureDirectories(targetPath);
                await _backupDirectoryRecursive(sourcePath, targetPath, includeCompression, excludePatterns, results, progressCallback, itemRelativePath);
            } else {
                try {
                    const stats = await fs.stat(sourcePath);
                    results.totalSize += stats.size;
                    results.totalFiles++;
                    
                    if (includeCompression && shouldCompressFile(sourcePath)) {
                        await compressFile(sourcePath, targetPath + '.gz');
                        results.compressedFiles++;
                    } else {
                        await fs.copyFile(sourcePath, targetPath);
                    }
                    
                    results.copiedFiles++;
                    
                    if (progressCallback) {
                        progressCallback({
                            type: 'file',
                            source: sourcePath,
                            target: targetPath,
                            progress: results.copiedFiles / results.totalFiles
                        });
                    }
                } catch (error) {
                    results.errors.push({
                        file: sourcePath,
                        error: error.message
                    });
                }
            }
        }
    } catch (error) {
        results.errors.push({
            directory: sourceDir,
            error: error.message
        });
    }
}

/**
 * Restaura un directorio desde un respaldo
 * @param {string} sourceDir - Directorio de respaldo
 * @param {string} targetDir - Directorio destino
 * @param {Object} options - Opciones de restauración
 * @param {boolean} options.overwrite - Sobrescribir archivos existentes
 * @param {boolean} options.dryRun - Solo simular la restauración
 * @param {Function} options.progressCallback - Callback de progreso
 * @returns {Promise<Object>} - Resultado de la restauración
 */
export async function restoreDirectory(sourceDir, targetDir, options = {}) {
    const {
        overwrite = false,
        dryRun = false,
        progressCallback = null
    } = options;
    
    const results = {
        totalFiles: 0,
        restoredFiles: 0,
        skippedFiles: 0,
        decompressedFiles: 0,
        errors: [],
        conflicts: []
    };
    
    if (!dryRun) {
        await ensureDirectories(targetDir);
    }
    
    await _restoreDirectoryRecursive(sourceDir, targetDir, overwrite, dryRun, results, progressCallback);
    
    return results;
}

/**
 * Función recursiva interna para restore de directorios
 */
async function _restoreDirectoryRecursive(sourceDir, targetDir, overwrite, dryRun, results, progressCallback, relativePath = '') {
    try {
        const items = await fs.readdir(sourceDir, { withFileTypes: true });
        
        for (const item of items) {
            const sourcePath = path.join(sourceDir, item.name);
            const targetPath = path.join(targetDir, item.name);
            const itemRelativePath = path.join(relativePath, item.name);
            
            if (item.isDirectory()) {
                if (!dryRun) {
                    await ensureDirectories(targetPath);
                }
                await _restoreDirectoryRecursive(sourcePath, targetPath, overwrite, dryRun, results, progressCallback, itemRelativePath);
            } else {
                results.totalFiles++;
                
                try {
                    // Verificar si el archivo ya existe
                    const targetExists = await directoryExists(targetPath) || await fs.access(targetPath).then(() => true).catch(() => false);
                    
                    if (targetExists && !overwrite) {
                        results.conflicts.push({
                            file: targetPath,
                            reason: 'File exists and overwrite is disabled'
                        });
                        results.skippedFiles++;
                        continue;
                    }
                    
                    if (!dryRun) {
                        // Verificar si es un archivo comprimido
                        if (item.name.endsWith('.gz')) {
                            const decompressedPath = targetPath.slice(0, -3); // Remover .gz
                            await decompressFile(sourcePath, decompressedPath);
                            results.decompressedFiles++;
                        } else {
                            await fs.copyFile(sourcePath, targetPath);
                        }
                    }
                    
                    results.restoredFiles++;
                    
                    if (progressCallback) {
                        progressCallback({
                            type: 'file',
                            source: sourcePath,
                            target: targetPath,
                            progress: results.restoredFiles / results.totalFiles
                        });
                    }
                } catch (error) {
                    results.errors.push({
                        file: sourcePath,
                        error: error.message
                    });
                }
            }
        }
    } catch (error) {
        results.errors.push({
            directory: sourceDir,
            error: error.message
        });
    }
}

/**
 * Verifica si un archivo debe excluirse del respaldo
 */
function shouldExcludeItem(itemName, excludePatterns) {
    return excludePatterns.some(pattern => {
        if (pattern.includes('*') || pattern.includes('?')) {
            // Patrón con wildcards
            const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
            return regex.test(itemName);
        }
        return itemName === pattern || itemName.includes(pattern);
    });
}

/**
 * Determina si un archivo debe comprimirse
 */
function shouldCompressFile(filePath) {
    const compressibleExtensions = ['.txt', '.log', '.json', '.js', '.css', '.html', '.xml', '.csv'];
    const ext = path.extname(filePath).toLowerCase();
    return compressibleExtensions.includes(ext);
}

/**
 * Comprime un archivo usando gzip
 */
async function compressFile(sourcePath, targetPath) {
    const { createGzip } = await import('zlib');
    const { pipeline } = await import('stream/promises');
    
    const readStream = (await import('fs')).createReadStream(sourcePath);
    const writeStream = (await import('fs')).createWriteStream(targetPath);
    const gzipStream = createGzip();
    
    await pipeline(readStream, gzipStream, writeStream);
}

/**
 * Descomprime un archivo gzip
 */
async function decompressFile(sourcePath, targetPath) {
    const { createGunzip } = await import('zlib');
    const { pipeline } = await import('stream/promises');
    
    const readStream = (await import('fs')).createReadStream(sourcePath);
    const writeStream = (await import('fs')).createWriteStream(targetPath);
    const gunzipStream = createGunzip();
    
    await pipeline(readStream, gunzipStream, writeStream);
}

export default {
    ensureDirectories,
    createBackupDirectory,
    directoryExists,
    getDirectorySize,
    cleanupOldDirectories,
    backupDirectory,
    restoreDirectory
};