/**
 * Advanced Security Service
 * Proporciona funcionalidades avanzadas de seguridad para el sistema ChatBot
 */

class AdvancedSecurity {
    constructor() {
        this.securityLevel = 'high';
        this.encryptionEnabled = true;
        this.auditLog = [];
    }

    /**
     * Valida tokens de autenticación
     * @param {string} token - Token a validar
     * @returns {boolean} - True si el token es válido
     */
    validateToken(token) {
        if (!token || typeof token !== 'string') {
            this.logSecurityEvent('Invalid token format', 'warning');
            return false;
        }

        // Validación básica de token
        const isValid = token.length >= 32 && /^[a-zA-Z0-9]+$/.test(token);
        
        if (!isValid) {
            this.logSecurityEvent('Token validation failed', 'warning');
        }

        return isValid;
    }

    /**
     * Encripta datos sensibles
     * @param {string} data - Datos a encriptar
     * @returns {string} - Datos encriptados
     */
    encryptData(data) {
        if (!this.encryptionEnabled) {
            return data;
        }

        // Implementación básica de encriptación (en producción usar crypto real)
        const encrypted = Buffer.from(data).toString('base64');
        this.logSecurityEvent('Data encrypted', 'info');
        return encrypted;
    }

    /**
     * Desencripta datos
     * @param {string} encryptedData - Datos encriptados
     * @returns {string} - Datos desencriptados
     */
    decryptData(encryptedData) {
        if (!this.encryptionEnabled) {
            return encryptedData;
        }

        try {
            const decrypted = Buffer.from(encryptedData, 'base64').toString('utf8');
            this.logSecurityEvent('Data decrypted', 'info');
            return decrypted;
        } catch (error) {
            this.logSecurityEvent('Decryption failed', 'error');
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Verifica permisos de usuario
     * @param {string} userId - ID del usuario
     * @param {string} action - Acción a verificar
     * @returns {boolean} - True si tiene permisos
     */
    checkPermissions(userId, action) {
        if (!userId || !action) {
            this.logSecurityEvent('Invalid permission check parameters', 'warning');
            return false;
        }

        // Implementación básica de permisos
        const allowedActions = ['read', 'write', 'admin'];
        const hasPermission = allowedActions.includes(action);

        this.logSecurityEvent(`Permission check for ${userId}: ${action} - ${hasPermission ? 'granted' : 'denied'}`, 'info');
        return hasPermission;
    }

    /**
     * Registra eventos de seguridad
     * @param {string} message - Mensaje del evento
     * @param {string} level - Nivel del evento (info, warning, error)
     */
    logSecurityEvent(message, level = 'info') {
        const event = {
            timestamp: new Date().toISOString(),
            level,
            message,
            source: 'AdvancedSecurity'
        };

        this.auditLog.push(event);

        // Mantener solo los últimos 1000 eventos
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }

        logger.debug(`[SECURITY ${level.toUpperCase()}] ${message}`);
    }

    /**
     * Obtiene el log de auditoría
     * @returns {Array} - Array de eventos de seguridad
     */
    getAuditLog() {
        return [...this.auditLog];
    }

    /**
     * Limpia el log de auditoría
     */
    clearAuditLog() {
        this.auditLog = [];
        this.logSecurityEvent('Audit log cleared', 'info');
    }

    /**
     * Configura el nivel de seguridad
     * @param {string} level - Nivel de seguridad (low, medium, high)
     */
    setSecurityLevel(level) {
        const validLevels = ['low', 'medium', 'high'];
        if (validLevels.includes(level)) {
            this.securityLevel = level;
            this.logSecurityEvent(`Security level set to ${level}`, 'info');
        } else {
            this.logSecurityEvent(`Invalid security level: ${level}`, 'warning');
        }
    }

    /**
     * Obtiene el estado actual de seguridad
     * @returns {Object} - Estado de seguridad
     */
    getSecurityStatus() {
        return {
            securityLevel: this.securityLevel,
            encryptionEnabled: this.encryptionEnabled,
            auditLogSize: this.auditLog.length,
            lastEvent: this.auditLog[this.auditLog.length - 1] || null
        };
    }
}

export default AdvancedSecurity;