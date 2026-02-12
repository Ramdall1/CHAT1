#!/usr/bin/env node

/**
 * Script para desbloquear IP y resetear sistema de seguridad
 * Útil durante desarrollo cuando la IP queda bloqueada por actividad sospechosa
 */

import AdvancedSecurity from './src/services/auth/AdvancedSecurity.js';

async function unblockAndReset() {
  console.log('🔓 Iniciando proceso de desbloqueo...\n');

  try {
    // Inicializar sistema de seguridad
    const security = new AdvancedSecurity({
      jwtSecret: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
      logLevel: 'info'
    });

    await security.initialize();
    console.log('✅ Sistema de seguridad inicializado\n');

    // Obtener IP local común para desarrollo
    const developmentIPs = [
      '127.0.0.1',
      '::1',
      'localhost',
      '192.168.1.1',
      '10.0.0.1',
      '172.16.0.1'
    ];

    console.log('🧹 Limpiando bloqueos de IPs...');
        
    // Limpiar todos los bloqueos de IPs
    security.cleanupBlockedIPs();
        
    // Limpiar intentos de login
    security.clearLoginAttempts();
        
    // Resetear datos de amenazas para IPs comunes de desarrollo
    for (const ip of developmentIPs) {
      const result = security.resetThreatData(ip);
      if (result.success) {
        console.log(`  ✅ Datos de amenazas reseteados para ${ip}`);
      }
    }

    // Limpiar rate limiter si está disponible
    if (security.rateLimiter && security.rateLimiter.unbanIP) {
      for (const ip of developmentIPs) {
        security.rateLimiter.unbanIP(ip);
        console.log(`  ✅ IP desbloqueada en rate limiter: ${ip}`);
      }
    }

    // Limpiar todas las sesiones activas
    await security.clearAllSessions();
    console.log('✅ Sesiones activas limpiadas');

    // Mostrar estadísticas de seguridad
    const stats = security.getSecurityStatistics();
    console.log('\n📊 Estadísticas de seguridad actuales:');
    console.log(`  - Intentos de login totales: ${stats.totalLoginAttempts}`);
    console.log(`  - Intentos fallidos: ${stats.failedLoginAttempts}`);
    console.log(`  - Intentos bloqueados: ${stats.blockedAttempts}`);
    console.log(`  - Tokens generados: ${stats.tokensGenerated}`);
    console.log(`  - Sesiones creadas: ${stats.sessionsCreated}`);

    console.log('\n🎉 ¡Proceso de desbloqueo completado exitosamente!');
    console.log('💡 Tu IP ahora debería estar desbloqueada para continuar desarrollando.');
    console.log('\n🔧 Consejos para evitar bloqueos futuros:');
    console.log('  - Usa delays entre requests durante las pruebas');
    console.log('  - Considera aumentar los límites durante desarrollo');
    console.log('  - Ejecuta este script cuando necesites resetear bloqueos');

    // Cerrar el sistema de seguridad
    await security.close();

  } catch (error) {
    console.error('❌ Error durante el proceso de desbloqueo:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  unblockAndReset().then(() => {
    console.log('\n✅ Script completado. Puedes reiniciar el servidor ahora.');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

export default unblockAndReset;