# Certificados SSL

Este directorio debe contener los certificados SSL para HTTPS.

## Para desarrollo local:

Generar certificados auto-firmados:

```bash
# Crear certificado auto-firmado para desarrollo
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## Para producción:

### Opción 1: Let's Encrypt (Recomendado)

```bash
# Instalar certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Renovación automática
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Opción 2: Certificado comercial

1. Generar CSR (Certificate Signing Request)
2. Enviar CSR a la autoridad certificadora
3. Descargar certificados
4. Colocar archivos en este directorio

## Archivos necesarios:

- `cert.pem` - Certificado público
- `key.pem` - Clave privada
- `chain.pem` - Cadena de certificados (opcional)

## Permisos de seguridad:

```bash
chmod 644 cert.pem
chmod 600 key.pem
chown root:root cert.pem key.pem
```

## Verificación:

```bash
# Verificar certificado
openssl x509 -in cert.pem -text -noout

# Verificar clave privada
openssl rsa -in key.pem -check

# Verificar que coincidan
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```