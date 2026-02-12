#!/bin/bash

# =============================================================================
# Script de Diagnóstico Web - Trae AI & Safari
# =============================================================================
# Este script diagnostica problemas de carga de páginas web en Trae AI y Safari
# Autor: Asistente AI
# Fecha: $(date)
# =============================================================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir headers
print_header() {
    echo -e "\n${BLUE}=============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=============================================================================${NC}\n"
}

# Función para imprimir resultados
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Función para imprimir warnings
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Función para imprimir información
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Variables globales
REPORT_FILE="web-diagnostics-report-$(date +%Y%m%d-%H%M%S).txt"
LOCAL_SERVER_URL="http://localhost:3000"
TEST_URLS=("https://www.google.com" "https://www.apple.com" "https://github.com")

# Inicializar reporte
echo "==============================================================================" > $REPORT_FILE
echo "REPORTE DE DIAGNÓSTICO WEB - $(date)" >> $REPORT_FILE
echo "==============================================================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

print_header "🔍 DIAGNÓSTICO DE CONECTIVIDAD WEB"

# =============================================================================
# 1. VERIFICACIÓN DE CONECTIVIDAD BÁSICA
# =============================================================================
print_header "1. VERIFICACIÓN DE CONECTIVIDAD BÁSICA"

echo "1. CONECTIVIDAD BÁSICA" >> $REPORT_FILE
echo "======================" >> $REPORT_FILE

# Test de ping
print_info "Probando conectividad básica (ping)..."
ping -c 4 8.8.8.8 > /dev/null 2>&1
PING_RESULT=$?
print_result $PING_RESULT "Conectividad básica (ping a 8.8.8.8)"
echo "Ping a 8.8.8.8: $([ $PING_RESULT -eq 0 ] && echo "EXITOSO" || echo "FALLIDO")" >> $REPORT_FILE

# Test de DNS
print_info "Probando resolución DNS..."
nslookup google.com > /dev/null 2>&1
DNS_RESULT=$?
print_result $DNS_RESULT "Resolución DNS (google.com)"
echo "Resolución DNS: $([ $DNS_RESULT -eq 0 ] && echo "EXITOSO" || echo "FALLIDO")" >> $REPORT_FILE

# Test de conectividad HTTP
print_info "Probando conectividad HTTP..."
curl -I --connect-timeout 10 https://www.google.com > /dev/null 2>&1
HTTP_RESULT=$?
print_result $HTTP_RESULT "Conectividad HTTP (google.com)"
echo "Conectividad HTTP: $([ $HTTP_RESULT -eq 0 ] && echo "EXITOSO" || echo "FALLIDO")" >> $REPORT_FILE

echo "" >> $REPORT_FILE

# =============================================================================
# 2. VERIFICACIÓN DEL SERVIDOR LOCAL
# =============================================================================
print_header "2. VERIFICACIÓN DEL SERVIDOR LOCAL"

echo "2. SERVIDOR LOCAL" >> $REPORT_FILE
echo "=================" >> $REPORT_FILE

# Verificar si el puerto 3000 está en uso
print_info "Verificando puerto 3000..."
lsof -i :3000 > /dev/null 2>&1
PORT_RESULT=$?
print_result $PORT_RESULT "Puerto 3000 en uso"
echo "Puerto 3000: $([ $PORT_RESULT -eq 0 ] && echo "EN USO" || echo "LIBRE")" >> $REPORT_FILE

# Test de conectividad al servidor local
if [ $PORT_RESULT -eq 0 ]; then
    print_info "Probando conectividad al servidor local..."
    curl -I --connect-timeout 5 $LOCAL_SERVER_URL > /dev/null 2>&1
    LOCAL_SERVER_RESULT=$?
    print_result $LOCAL_SERVER_RESULT "Servidor local responde"
    echo "Servidor local: $([ $LOCAL_SERVER_RESULT -eq 0 ] && echo "RESPONDE" || echo "NO RESPONDE")" >> $REPORT_FILE
    
    # Test específico del dashboard
    curl -I --connect-timeout 5 $LOCAL_SERVER_URL/dashboard.html > /dev/null 2>&1
    DASHBOARD_RESULT=$?
    print_result $DASHBOARD_RESULT "Dashboard accesible"
    echo "Dashboard: $([ $DASHBOARD_RESULT -eq 0 ] && echo "ACCESIBLE" || echo "NO ACCESIBLE")" >> $REPORT_FILE
else
    print_warning "Servidor local no está ejecutándose en puerto 3000"
    echo "Servidor local: NO EJECUTÁNDOSE" >> $REPORT_FILE
fi

echo "" >> $REPORT_FILE

# =============================================================================
# 3. CONFIGURACIONES DEL SISTEMA
# =============================================================================
print_header "3. CONFIGURACIONES DEL SISTEMA"

echo "3. CONFIGURACIONES DEL SISTEMA" >> $REPORT_FILE
echo "==============================" >> $REPORT_FILE

# Verificar configuraciones de proxy
print_info "Verificando configuraciones de proxy..."
PROXY_CONFIG=$(scutil --proxy)
echo "Configuraciones de proxy:" >> $REPORT_FILE
echo "$PROXY_CONFIG" >> $REPORT_FILE

if echo "$PROXY_CONFIG" | grep -q "HTTPProxy\|HTTPSProxy\|SOCKSProxy"; then
    print_warning "Se detectaron configuraciones de proxy activas"
    echo "Estado proxy: ACTIVO" >> $REPORT_FILE
else
    print_result 0 "No hay proxies configurados"
    echo "Estado proxy: INACTIVO" >> $REPORT_FILE
fi

# Verificar firewall
print_info "Verificando estado del firewall..."
FIREWALL_STATUS=$(sudo pfctl -s info 2>/dev/null | grep "Status:" | awk '{print $2}')
if [ "$FIREWALL_STATUS" = "Enabled" ]; then
    print_warning "Firewall está habilitado"
    echo "Firewall: HABILITADO" >> $REPORT_FILE
else
    print_result 0 "Firewall está deshabilitado"
    echo "Firewall: DESHABILITADO" >> $REPORT_FILE
fi

# Verificar DNS
print_info "Verificando configuraciones DNS..."
DNS_SERVERS=$(scutil --dns | grep "nameserver\[0\]" | head -3)
echo "Servidores DNS:" >> $REPORT_FILE
echo "$DNS_SERVERS" >> $REPORT_FILE

echo "" >> $REPORT_FILE

# =============================================================================
# 4. PRUEBAS DE SITIOS WEB EXTERNOS
# =============================================================================
print_header "4. PRUEBAS DE SITIOS WEB EXTERNOS"

echo "4. SITIOS WEB EXTERNOS" >> $REPORT_FILE
echo "======================" >> $REPORT_FILE

for url in "${TEST_URLS[@]}"; do
    print_info "Probando $url..."
    
    # Test con curl
    RESPONSE=$(curl -I --connect-timeout 10 --max-time 15 "$url" 2>/dev/null)
    CURL_RESULT=$?
    
    if [ $CURL_RESULT -eq 0 ]; then
        STATUS_CODE=$(echo "$RESPONSE" | head -1 | awk '{print $2}')
        print_result 0 "$url - Código: $STATUS_CODE"
        echo "$url: EXITOSO (Código: $STATUS_CODE)" >> $REPORT_FILE
    else
        print_result 1 "$url - Error de conexión"
        echo "$url: FALLIDO" >> $REPORT_FILE
    fi
done

echo "" >> $REPORT_FILE

# =============================================================================
# 5. INFORMACIÓN DEL SISTEMA
# =============================================================================
print_header "5. INFORMACIÓN DEL SISTEMA"

echo "5. INFORMACIÓN DEL SISTEMA" >> $REPORT_FILE
echo "==========================" >> $REPORT_FILE

# Información del sistema operativo
OS_INFO=$(sw_vers)
echo "Sistema operativo:" >> $REPORT_FILE
echo "$OS_INFO" >> $REPORT_FILE

# Información de red
NETWORK_INFO=$(ifconfig | grep "inet " | grep -v "127.0.0.1")
echo "" >> $REPORT_FILE
echo "Interfaces de red:" >> $REPORT_FILE
echo "$NETWORK_INFO" >> $REPORT_FILE

# Información de Safari (si está disponible)
if [ -d "/Applications/Safari.app" ]; then
    SAFARI_VERSION=$(defaults read /Applications/Safari.app/Contents/Info CFBundleShortVersionString 2>/dev/null)
    echo "" >> $REPORT_FILE
    echo "Safari versión: $SAFARI_VERSION" >> $REPORT_FILE
    print_info "Safari versión: $SAFARI_VERSION"
fi

echo "" >> $REPORT_FILE

# =============================================================================
# 6. RECOMENDACIONES
# =============================================================================
print_header "6. RECOMENDACIONES Y PASOS SIGUIENTES"

echo "6. RECOMENDACIONES" >> $REPORT_FILE
echo "==================" >> $REPORT_FILE

# Generar recomendaciones basadas en los resultados
if [ $PING_RESULT -ne 0 ] || [ $DNS_RESULT -ne 0 ] || [ $HTTP_RESULT -ne 0 ]; then
    print_warning "PROBLEMA DE CONECTIVIDAD DETECTADO"
    echo "PROBLEMA: Conectividad básica fallida" >> $REPORT_FILE
    echo "RECOMENDACIONES:" >> $REPORT_FILE
    echo "- Verificar conexión a internet" >> $REPORT_FILE
    echo "- Probar con diferentes redes (WiFi/datos móviles)" >> $REPORT_FILE
    echo "- Contactar al proveedor de internet" >> $REPORT_FILE
elif [ $PORT_RESULT -ne 0 ]; then
    print_warning "SERVIDOR LOCAL NO EJECUTÁNDOSE"
    echo "PROBLEMA: Servidor local no está ejecutándose" >> $REPORT_FILE
    echo "RECOMENDACIONES:" >> $REPORT_FILE
    echo "- Ejecutar: npm start o node server.js" >> $REPORT_FILE
    echo "- Verificar que no haya errores en el servidor" >> $REPORT_FILE
elif [ $LOCAL_SERVER_RESULT -ne 0 ]; then
    print_warning "SERVIDOR LOCAL NO RESPONDE"
    echo "PROBLEMA: Servidor local no responde" >> $REPORT_FILE
    echo "RECOMENDACIONES:" >> $REPORT_FILE
    echo "- Reiniciar el servidor" >> $REPORT_FILE
    echo "- Verificar logs del servidor" >> $REPORT_FILE
    echo "- Comprobar configuración del firewall" >> $REPORT_FILE
else
    print_result 0 "TODAS LAS PRUEBAS BÁSICAS PASARON"
    echo "ESTADO: Todas las pruebas básicas exitosas" >> $REPORT_FILE
    echo "RECOMENDACIONES PARA SAFARI:" >> $REPORT_FILE
    echo "- Probar en modo privado/incógnito" >> $REPORT_FILE
    echo "- Limpiar caché y cookies" >> $REPORT_FILE
    echo "- Desactivar extensiones temporalmente" >> $REPORT_FILE
    echo "- Verificar configuraciones de seguridad" >> $REPORT_FILE
fi

echo "" >> $REPORT_FILE

# =============================================================================
# FINALIZACIÓN
# =============================================================================
print_header "✅ DIAGNÓSTICO COMPLETADO"

echo "DIAGNÓSTICO COMPLETADO - $(date)" >> $REPORT_FILE
echo "Reporte guardado en: $REPORT_FILE" >> $REPORT_FILE

print_info "Reporte completo guardado en: $REPORT_FILE"
print_info "Para ver el reporte: cat $REPORT_FILE"

# Mostrar resumen final
echo -e "\n${BLUE}📊 RESUMEN EJECUTIVO:${NC}"
if [ $PING_RESULT -eq 0 ] && [ $DNS_RESULT -eq 0 ] && [ $HTTP_RESULT -eq 0 ]; then
    if [ $PORT_RESULT -eq 0 ] && [ $LOCAL_SERVER_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ Conectividad: EXCELENTE${NC}"
        echo -e "${GREEN}✅ Servidor local: FUNCIONANDO${NC}"
        echo -e "${YELLOW}⚠️  Si Safari no carga páginas, el problema es específico del navegador${NC}"
    else
        echo -e "${GREEN}✅ Conectividad: EXCELENTE${NC}"
        echo -e "${RED}❌ Servidor local: PROBLEMA${NC}"
    fi
else
    echo -e "${RED}❌ Conectividad: PROBLEMA${NC}"
fi

echo -e "\n${BLUE}🔧 PRÓXIMOS PASOS:${NC}"
echo "1. Revisar el reporte detallado: cat $REPORT_FILE"
echo "2. Seguir las recomendaciones específicas"
echo "3. Si el problema persiste, contactar soporte técnico"

exit 0