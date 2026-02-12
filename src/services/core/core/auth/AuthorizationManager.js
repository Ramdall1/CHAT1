import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createLogger } from '../logger.js';

/**
 * Gestor de autorización para el sistema de seguridad
 * Maneja el control de acceso basado en roles (RBAC) y permisos
 */
class AuthorizationManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      enabled: true,
            
      // Configuración de roles
      roles: {
        hierarchical: true,
        inheritance: true,
        maxDepth: 5,
        defaultRole: 'user',
        adminRole: 'admin',
        superAdminRole: 'superadmin'
      },
            
      // Configuración de permisos
      permissions: {
        granular: true,
        wildcards: true,
        negation: true,
        caching: true,
        cacheTtl: 300000 // 5 minutos
      },
            
      // Configuración de políticas
      policies: {
        enabled: true,
        dynamic: true,
        contextual: true,
        timeBasedAccess: true,
        locationBasedAccess: false,
        deviceBasedAccess: false
      },
            
      // Configuración de auditoría
      audit: {
        enabled: true,
        logAccess: true,
        logDenials: true,
        logRoleChanges: true,
        logPermissionChanges: true,
        retentionDays: 90
      },
            
      // Configuración de caché
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutos
        maxSize: 10000,
        strategy: 'lru'
      },
            
      ...config
    };
        
    this.state = 'initialized';
    this.logger = createLogger('AUTHORIZATION_MANAGER');
        
    // Almacenamiento de datos
    this.roles = new Map();
    this.permissions = new Map();
    this.policies = new Map();
    this.userRoles = new Map();
    this.userPermissions = new Map();
    this.roleHierarchy = new Map();
    this.permissionCache = new Map();
    this.accessLog = [];
        
    // Estadísticas
    this.statistics = {
      totalRoles: 0,
      totalPermissions: 0,
      totalPolicies: 0,
      accessChecks: 0,
      accessGranted: 0,
      accessDenied: 0,
      cacheHits: 0,
      cacheMisses: 0,
      roleAssignments: 0,
      permissionGrants: 0
    };
        
    this._initializeDefaultRoles();
    this._initializeDefaultPermissions();
    this._initializeCleanupTimers();
  }
    
  /**
     * Inicializa el gestor de autorización
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea un nuevo rol
     */
  createRole(roleData) {
    try {
      const { name, description, permissions = [], parent = null, metadata = {} } = roleData;
            
      if (this.roles.has(name)) {
        throw new Error(`Role '${name}' already exists`);
      }
            
      const role = {
        id: crypto.randomUUID(),
        name: name,
        description: description,
        permissions: new Set(permissions),
        parent: parent,
        children: new Set(),
        level: parent ? this._calculateRoleLevel(parent) + 1 : 0,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
            
      // Validar jerarquía
      if (parent && !this.roles.has(parent)) {
        throw new Error(`Parent role '${parent}' does not exist`);
      }
            
      if (role.level > this.config.roles.maxDepth) {
        throw new Error(`Role hierarchy exceeds maximum depth of ${this.config.roles.maxDepth}`);
      }
            
      this.roles.set(name, role);
            
      // Actualizar jerarquía
      if (parent) {
        const parentRole = this.roles.get(parent);
        parentRole.children.add(name);
        this.roleHierarchy.set(name, this._buildRoleHierarchy(name));
      }
            
      this.statistics.totalRoles++;
            
      this.emit('roleCreated', { roleName: name, roleId: role.id });
      this._logAuditEvent('ROLE_CREATED', { roleName: name, permissions, parent });
            
      return role;
    } catch (error) {
      this.emit('roleCreationError', error);
      throw error;
    }
  }
    
  /**
     * Crea un nuevo permiso
     */
  createPermission(permissionData) {
    try {
      const { name, description, resource, action, conditions = [], metadata = {} } = permissionData;
            
      if (this.permissions.has(name)) {
        throw new Error(`Permission '${name}' already exists`);
      }
            
      const permission = {
        id: crypto.randomUUID(),
        name: name,
        description: description,
        resource: resource,
        action: action,
        conditions: conditions,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
            
      this.permissions.set(name, permission);
      this.statistics.totalPermissions++;
            
      this.emit('permissionCreated', { permissionName: name, permissionId: permission.id });
      this._logAuditEvent('PERMISSION_CREATED', { permissionName: name, resource, action });
            
      return permission;
    } catch (error) {
      this.emit('permissionCreationError', error);
      throw error;
    }
  }
    
  /**
     * Crea una nueva política
     */
  createPolicy(policyData) {
    try {
      const { name, description, rules, effect = 'allow', conditions = [], metadata = {} } = policyData;
            
      if (this.policies.has(name)) {
        throw new Error(`Policy '${name}' already exists`);
      }
            
      const policy = {
        id: crypto.randomUUID(),
        name: name,
        description: description,
        rules: rules,
        effect: effect, // 'allow' o 'deny'
        conditions: conditions,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
            
      this.policies.set(name, policy);
      this.statistics.totalPolicies++;
            
      this.emit('policyCreated', { policyName: name, policyId: policy.id });
      this._logAuditEvent('POLICY_CREATED', { policyName: name, effect, rules });
            
      return policy;
    } catch (error) {
      this.emit('policyCreationError', error);
      throw error;
    }
  }
    
  /**
     * Asigna un rol a un usuario
     */
  assignRole(userId, roleName, options = {}) {
    try {
      const { expiresAt = null, assignedBy = null, reason = null } = options;
            
      if (!this.roles.has(roleName)) {
        throw new Error(`Role '${roleName}' does not exist`);
      }
            
      if (!this.userRoles.has(userId)) {
        this.userRoles.set(userId, new Map());
      }
            
      const userRoleMap = this.userRoles.get(userId);
            
      const assignment = {
        roleName: roleName,
        assignedAt: new Date(),
        assignedBy: assignedBy,
        expiresAt: expiresAt,
        reason: reason,
        active: true
      };
            
      userRoleMap.set(roleName, assignment);
            
      // Limpiar caché de permisos del usuario
      this._clearUserPermissionCache(userId);
            
      this.statistics.roleAssignments++;
            
      this.emit('roleAssigned', { userId, roleName, assignment });
      this._logAuditEvent('ROLE_ASSIGNED', { userId, roleName, assignedBy, reason });
            
      return assignment;
    } catch (error) {
      this.emit('roleAssignmentError', error);
      throw error;
    }
  }
    
  /**
     * Revoca un rol de un usuario
     */
  revokeRole(userId, roleName, options = {}) {
    try {
      const { revokedBy = null, reason = null } = options;
            
      const userRoleMap = this.userRoles.get(userId);
      if (!userRoleMap || !userRoleMap.has(roleName)) {
        throw new Error(`User does not have role '${roleName}'`);
      }
            
      const assignment = userRoleMap.get(roleName);
      assignment.active = false;
      assignment.revokedAt = new Date();
      assignment.revokedBy = revokedBy;
      assignment.revokeReason = reason;
            
      // Limpiar caché de permisos del usuario
      this._clearUserPermissionCache(userId);
            
      this.emit('roleRevoked', { userId, roleName, assignment });
      this._logAuditEvent('ROLE_REVOKED', { userId, roleName, revokedBy, reason });
            
      return assignment;
    } catch (error) {
      this.emit('roleRevocationError', error);
      throw error;
    }
  }
    
  /**
     * Otorga un permiso directo a un usuario
     */
  grantPermission(userId, permissionName, options = {}) {
    try {
      const { expiresAt = null, grantedBy = null, reason = null } = options;
            
      if (!this.permissions.has(permissionName)) {
        throw new Error(`Permission '${permissionName}' does not exist`);
      }
            
      if (!this.userPermissions.has(userId)) {
        this.userPermissions.set(userId, new Map());
      }
            
      const userPermissionMap = this.userPermissions.get(userId);
            
      const grant = {
        permissionName: permissionName,
        grantedAt: new Date(),
        grantedBy: grantedBy,
        expiresAt: expiresAt,
        reason: reason,
        active: true
      };
            
      userPermissionMap.set(permissionName, grant);
            
      // Limpiar caché de permisos del usuario
      this._clearUserPermissionCache(userId);
            
      this.statistics.permissionGrants++;
            
      this.emit('permissionGranted', { userId, permissionName, grant });
      this._logAuditEvent('PERMISSION_GRANTED', { userId, permissionName, grantedBy, reason });
            
      return grant;
    } catch (error) {
      this.emit('permissionGrantError', error);
      throw error;
    }
  }
    
  /**
     * Verifica si un usuario tiene un permiso específico
     */
  hasPermission(userId, permissionName, context = {}) {
    try {
      this.statistics.accessChecks++;
            
      // Verificar caché
      const cacheKey = this._generateCacheKey(userId, permissionName, context);
      if (this.config.cache.enabled && this.permissionCache.has(cacheKey)) {
        const cached = this.permissionCache.get(cacheKey);
        if (cached.expiresAt > new Date()) {
          this.statistics.cacheHits++;
          return cached.result;
        } else {
          this.permissionCache.delete(cacheKey);
        }
      }
            
      this.statistics.cacheMisses++;
            
      // Verificar permiso directo
      const directPermission = this._checkDirectPermission(userId, permissionName);
      if (directPermission) {
        const result = { granted: true, source: 'direct', permission: permissionName };
        this._cacheResult(cacheKey, result);
        this._logAccessCheck(userId, permissionName, true, 'direct', context);
        this.statistics.accessGranted++;
        return result;
      }
            
      // Verificar permisos por roles
      const rolePermission = this._checkRolePermissions(userId, permissionName);
      if (rolePermission.granted) {
        this._cacheResult(cacheKey, rolePermission);
        this._logAccessCheck(userId, permissionName, true, 'role', context);
        this.statistics.accessGranted++;
        return rolePermission;
      }
            
      // Verificar políticas
      const policyResult = this._checkPolicies(userId, permissionName, context);
      if (policyResult.granted) {
        this._cacheResult(cacheKey, policyResult);
        this._logAccessCheck(userId, permissionName, true, 'policy', context);
        this.statistics.accessGranted++;
        return policyResult;
      }
            
      // Acceso denegado
      const deniedResult = { granted: false, reason: 'No matching permissions found' };
      this._cacheResult(cacheKey, deniedResult);
      this._logAccessCheck(userId, permissionName, false, 'none', context);
      this.statistics.accessDenied++;
            
      return deniedResult;
            
    } catch (error) {
      this.emit('permissionCheckError', error);
      this.statistics.accessDenied++;
      return { granted: false, error: error.message };
    }
  }
    
  /**
     * Verifica si un usuario tiene un rol específico
     */
  hasRole(userId, roleName) {
    try {
      const userRoleMap = this.userRoles.get(userId);
      if (!userRoleMap) {
        return false;
      }
            
      const assignment = userRoleMap.get(roleName);
      if (!assignment || !assignment.active) {
        return false;
      }
            
      // Verificar expiración
      if (assignment.expiresAt && assignment.expiresAt < new Date()) {
        assignment.active = false;
        return false;
      }
            
      return true;
    } catch (error) {
      this.emit('roleCheckError', error);
      return false;
    }
  }
    
  /**
     * Obtiene todos los roles de un usuario
     */
  getUserRoles(userId, includeInherited = true) {
    try {
      const userRoleMap = this.userRoles.get(userId);
      if (!userRoleMap) {
        return [];
      }
            
      const roles = [];
      const now = new Date();
            
      for (const [roleName, assignment] of userRoleMap) {
        if (assignment.active && (!assignment.expiresAt || assignment.expiresAt > now)) {
          roles.push({
            name: roleName,
            assignment: assignment,
            role: this.roles.get(roleName)
          });
                    
          // Incluir roles heredados
          if (includeInherited && this.config.roles.inheritance) {
            const inheritedRoles = this._getInheritedRoles(roleName);
            for (const inheritedRole of inheritedRoles) {
              if (!roles.some(r => r.name === inheritedRole)) {
                roles.push({
                  name: inheritedRole,
                  inherited: true,
                  inheritedFrom: roleName,
                  role: this.roles.get(inheritedRole)
                });
              }
            }
          }
        }
      }
            
      return roles;
    } catch (error) {
      this.emit('getUserRolesError', error);
      return [];
    }
  }
    
  /**
     * Obtiene todos los permisos efectivos de un usuario
     */
  getUserPermissions(userId) {
    try {
      const permissions = new Set();
            
      // Permisos directos
      const userPermissionMap = this.userPermissions.get(userId);
      if (userPermissionMap) {
        const now = new Date();
        for (const [permissionName, grant] of userPermissionMap) {
          if (grant.active && (!grant.expiresAt || grant.expiresAt > now)) {
            permissions.add(permissionName);
          }
        }
      }
            
      // Permisos por roles
      const userRoles = this.getUserRoles(userId, true);
      for (const userRole of userRoles) {
        const role = userRole.role;
        if (role) {
          for (const permission of role.permissions) {
            permissions.add(permission);
          }
        }
      }
            
      return Array.from(permissions);
    } catch (error) {
      this.emit('getUserPermissionsError', error);
      return [];
    }
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStatistics() {
    return {
      ...this.statistics,
      activeRoles: this.roles.size,
      activePermissions: this.permissions.size,
      activePolicies: this.policies.size,
      usersWithRoles: this.userRoles.size,
      usersWithDirectPermissions: this.userPermissions.size,
      cacheSize: this.permissionCache.size,
      cacheHitRate: this.statistics.accessChecks > 0 ? 
        (this.statistics.cacheHits / this.statistics.accessChecks * 100).toFixed(2) + '%' : '0%'
    };
  }
    
  /**
     * Obtiene el log de acceso
     */
  getAccessLog(limit = 100) {
    return this.accessLog.slice(-limit);
  }
    
  /**
     * Limpia datos expirados
     */
  async cleanup() {
    const now = new Date();
        
    // Limpiar asignaciones de roles expiradas
    for (const [userId, userRoleMap] of this.userRoles) {
      for (const [roleName, assignment] of userRoleMap) {
        if (assignment.expiresAt && assignment.expiresAt < now) {
          assignment.active = false;
        }
      }
    }
        
    // Limpiar permisos directos expirados
    for (const [userId, userPermissionMap] of this.userPermissions) {
      for (const [permissionName, grant] of userPermissionMap) {
        if (grant.expiresAt && grant.expiresAt < now) {
          grant.active = false;
        }
      }
    }
        
    // Limpiar caché expirado
    for (const [key, cached] of this.permissionCache) {
      if (cached.expiresAt < now) {
        this.permissionCache.delete(key);
      }
    }
        
    // Limpiar log de acceso antiguo
    const retentionDate = new Date(now.getTime() - (this.config.audit.retentionDays * 24 * 60 * 60 * 1000));
    this.accessLog = this.accessLog.filter(entry => entry.timestamp > retentionDate);
        
    this.emit('cleanupCompleted');
  }
    
  /**
     * Habilita o deshabilita el gestor
     */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled');
  }
    
  /**
     * Destruye el gestor
     */
  async destroy() {
    this.state = 'destroyed';
        
    // Limpiar timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Limpiar datos
    this.roles.clear();
    this.permissions.clear();
    this.policies.clear();
    this.userRoles.clear();
    this.userPermissions.clear();
    this.roleHierarchy.clear();
    this.permissionCache.clear();
    this.accessLog = [];
        
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _validateConfig() {
    if (this.config.roles.maxDepth < 1) {
      throw new Error('Role hierarchy max depth must be at least 1');
    }
        
    if (this.config.cache.ttl < 1000) {
      throw new Error('Cache TTL must be at least 1000ms');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      if (this.logger) this.logger.error('Authorization error:', error);
    });
  }
    
  _initializeDefaultRoles() {
    // Rol de super administrador
    this.createRole({
      name: 'superadmin',
      description: 'Super Administrator with full system access',
      permissions: ['*']
    });
        
    // Rol de administrador
    this.createRole({
      name: 'admin',
      description: 'Administrator with management access',
      permissions: ['manage:*', 'read:*'],
      parent: 'superadmin'
    });
        
    // Rol de usuario
    this.createRole({
      name: 'user',
      description: 'Standard user with basic access',
      permissions: ['read:own', 'write:own']
    });
        
    // Rol de invitado
    this.createRole({
      name: 'guest',
      description: 'Guest user with limited access',
      permissions: ['read:public']
    });
  }
    
  _initializeDefaultPermissions() {
    const defaultPermissions = [
      { name: '*', description: 'All permissions', resource: '*', action: '*' },
      { name: 'manage:*', description: 'Manage all resources', resource: '*', action: 'manage' },
      { name: 'read:*', description: 'Read all resources', resource: '*', action: 'read' },
      { name: 'write:*', description: 'Write all resources', resource: '*', action: 'write' },
      { name: 'delete:*', description: 'Delete all resources', resource: '*', action: 'delete' },
      { name: 'read:own', description: 'Read own resources', resource: 'own', action: 'read' },
      { name: 'write:own', description: 'Write own resources', resource: 'own', action: 'write' },
      { name: 'read:public', description: 'Read public resources', resource: 'public', action: 'read' }
    ];
        
    for (const permission of defaultPermissions) {
      this.createPermission(permission);
    }
  }
    
  _initializeCleanupTimers() {
    // Limpiar datos expirados cada 10 minutos
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.emit('error', error);
      });
    }, 10 * 60 * 1000);
  }
    
  _calculateRoleLevel(parentName) {
    const parent = this.roles.get(parentName);
    return parent ? parent.level : 0;
  }
    
  _buildRoleHierarchy(roleName) {
    const hierarchy = [];
    let currentRole = this.roles.get(roleName);
        
    while (currentRole && currentRole.parent) {
      hierarchy.push(currentRole.parent);
      currentRole = this.roles.get(currentRole.parent);
    }
        
    return hierarchy;
  }
    
  _getInheritedRoles(roleName) {
    const hierarchy = this.roleHierarchy.get(roleName) || [];
    return hierarchy;
  }
    
  _checkDirectPermission(userId, permissionName) {
    const userPermissionMap = this.userPermissions.get(userId);
    if (!userPermissionMap) {
      return false;
    }
        
    const grant = userPermissionMap.get(permissionName);
    if (!grant || !grant.active) {
      return false;
    }
        
    // Verificar expiración
    if (grant.expiresAt && grant.expiresAt < new Date()) {
      grant.active = false;
      return false;
    }
        
    return true;
  }
    
  _checkRolePermissions(userId, permissionName) {
    const userRoles = this.getUserRoles(userId, true);
        
    for (const userRole of userRoles) {
      const role = userRole.role;
      if (role && this._roleHasPermission(role, permissionName)) {
        return {
          granted: true,
          source: 'role',
          role: role.name,
          inherited: userRole.inherited || false,
          inheritedFrom: userRole.inheritedFrom
        };
      }
    }
        
    return { granted: false };
  }
    
  _roleHasPermission(role, permissionName) {
    // Verificar permiso exacto
    if (role.permissions.has(permissionName)) {
      return true;
    }
        
    // Verificar wildcards
    if (this.config.permissions.wildcards) {
      for (const permission of role.permissions) {
        if (this._matchesWildcard(permission, permissionName)) {
          return true;
        }
      }
    }
        
    return false;
  }
    
  _matchesWildcard(pattern, permission) {
    if (pattern === '*') {
      return true;
    }
        
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return permission.startsWith(prefix);
    }
        
    return pattern === permission;
  }
    
  _checkPolicies(userId, permissionName, context) {
    if (!this.config.policies.enabled) {
      return { granted: false };
    }
        
    for (const [policyName, policy] of this.policies) {
      if (this._evaluatePolicy(policy, userId, permissionName, context)) {
        return {
          granted: policy.effect === 'allow',
          source: 'policy',
          policy: policyName,
          effect: policy.effect
        };
      }
    }
        
    return { granted: false };
  }
    
  _evaluatePolicy(policy, userId, permissionName, context) {
    // Implementación simplificada de evaluación de políticas
    // En producción, esto sería mucho más complejo
        
    for (const rule of policy.rules) {
      if (rule.permission === permissionName || rule.permission === '*') {
        // Evaluar condiciones
        if (this._evaluateConditions(policy.conditions, userId, context)) {
          return true;
        }
      }
    }
        
    return false;
  }
    
  _evaluateConditions(conditions, userId, context) {
    // Implementación simplificada de evaluación de condiciones
    for (const condition of conditions) {
      switch (condition.type) {
      case 'time':
        if (!this._evaluateTimeCondition(condition, context)) {
          return false;
        }
        break;
      case 'location':
        if (!this._evaluateLocationCondition(condition, context)) {
          return false;
        }
        break;
      case 'device':
        if (!this._evaluateDeviceCondition(condition, context)) {
          return false;
        }
        break;
      }
    }
        
    return true;
  }
    
  _evaluateTimeCondition(condition, context) {
    if (!this.config.policies.timeBasedAccess) {
      return true;
    }
        
    const now = new Date();
    const currentHour = now.getHours();
        
    if (condition.allowedHours) {
      return condition.allowedHours.includes(currentHour);
    }
        
    return true;
  }
    
  _evaluateLocationCondition(condition, context) {
    if (!this.config.policies.locationBasedAccess) {
      return true;
    }
        
    // Implementación simplificada
    return true;
  }
    
  _evaluateDeviceCondition(condition, context) {
    if (!this.config.policies.deviceBasedAccess) {
      return true;
    }
        
    // Implementación simplificada
    return true;
  }
    
  _generateCacheKey(userId, permissionName, context) {
    const contextHash = crypto.createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');
    return `${userId}:${permissionName}:${contextHash}`;
  }
    
  _cacheResult(key, result) {
    if (!this.config.cache.enabled) {
      return;
    }
        
    // Implementar estrategia LRU si el caché está lleno
    if (this.permissionCache.size >= this.config.cache.maxSize) {
      const firstKey = this.permissionCache.keys().next().value;
      this.permissionCache.delete(firstKey);
    }
        
    this.permissionCache.set(key, {
      result: result,
      expiresAt: new Date(Date.now() + this.config.cache.ttl)
    });
  }
    
  _clearUserPermissionCache(userId) {
    for (const [key] of this.permissionCache) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }
    
  _logAccessCheck(userId, permissionName, granted, source, context) {
    if (!this.config.audit.enabled) {
      return;
    }
        
    const logEntry = {
      userId: userId,
      permission: permissionName,
      granted: granted,
      source: source,
      context: context,
      timestamp: new Date()
    };
        
    this.accessLog.push(logEntry);
        
    // Mantener solo los últimos 10000 registros
    if (this.accessLog.length > 10000) {
      this.accessLog = this.accessLog.slice(-10000);
    }
        
    this.emit('accessCheck', logEntry);
  }
    
  _logAuditEvent(type, data) {
    if (!this.config.audit.enabled) {
      return;
    }
        
    const event = {
      type: type,
      data: data,
      timestamp: new Date()
    };
        
    this.emit('auditEvent', event);
  }
}

export default AuthorizationManager;