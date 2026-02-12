# 🚀 Guía de Inicio Rápido - Sistema de Calidad

## Comandos Principales

### Ejecutar Pruebas
```bash
npm run test:all          # Suite completa con puntuación
npm run test:coverage     # Pruebas con cobertura
npm run test:quality      # Verificación de calidad
```

### Gestión de Umbrales
```bash
npm run test:thresholds        # Analizar umbrales progresivos
npm run test:thresholds:apply  # Aplicar nuevos umbrales
```

### Notificaciones
```bash
npm run notify:quality     # Verificar y notificar calidad
npm run notify:config      # Ver configuración actual
npm run notify:configure   # Configurar notificaciones
```

### Mantenimiento
```bash
npm run test:cleanup       # Limpiar reportes antiguos
```

## Archivos de Configuración

- `.github/quality-thresholds.json` - Umbrales de calidad
- `.github/notification-config.json` - Configuración de notificaciones
- `quality-history.json` - Historial de métricas

## Flujo de Trabajo Recomendado

1. **Desarrollo**: Ejecuta `npm run test:all` regularmente
2. **Pre-commit**: Ejecuta `npm run test:quality`
3. **CI/CD**: Los workflows automáticamente verifican calidad
4. **Mantenimiento**: Revisa umbrales progresivos semanalmente

## Métricas de Calidad

### Cobertura de Código
- **Statements**: Porcentaje de declaraciones ejecutadas
- **Branches**: Porcentaje de ramas de código cubiertas
- **Functions**: Porcentaje de funciones probadas
- **Lines**: Porcentaje de líneas ejecutadas

### Calidad de Pruebas
- **Pass Rate**: Porcentaje de pruebas que pasan
- **Score**: Puntuación basada en criterios de calidad
- **Test Count**: Número total de pruebas

## Configuración Avanzada

### Slack Notifications
```bash
npm run notify:configure
# Luego edita .github/notification-config.json
```

### Email Notifications
Edita `.github/notification-config.json`:
```json
{
  "channels": {
    "email": {
      "enabled": true,
      "recipients": ["team@company.com"],
      "smtp": {
        "host": "smtp.company.com",
        "port": 587,
        "auth": { "user": "bot@company.com", "pass": "password" }
      }
    }
  }
}
```

## Solución de Problemas

### Cobertura 0%
1. Verifica que las pruebas se ejecuten correctamente
2. Revisa la configuración de coverage en package.json
3. Ejecuta `npm run test:coverage` manualmente

### Puntuación Baja
1. Revisa los criterios de puntuación en los archivos test-scores-*.json
2. Mejora las pruebas según los criterios fallidos
3. Ejecuta `npm run test:thresholds` para ver recomendaciones

### Notificaciones No Funcionan
1. Verifica la configuración en `.github/notification-config.json`
2. Ejecuta `npm run notify:config` para ver el estado
3. Revisa los logs de `npm run notify:quality`
