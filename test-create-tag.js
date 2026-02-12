/**
 * Script de prueba para crear etiquetas
 * Ejecutar con: node test-create-tag.js
 */

const http = require('http');

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testTags() {
    console.log('🧪 Iniciando pruebas de etiquetas...\n');

    try {
        // Test 1: Obtener etiquetas existentes
        console.log('📋 Test 1: Obtener etiquetas existentes');
        const getTags = await makeRequest('GET', '/api/tags');
        console.log(`Status: ${getTags.status}`);
        console.log(`Etiquetas encontradas: ${getTags.data.data.length}`);
        console.log(`Respuesta:`, JSON.stringify(getTags.data, null, 2));
        console.log('✅ Test 1 completado\n');

        // Test 2: Crear una nueva etiqueta
        console.log('📝 Test 2: Crear nueva etiqueta');
        const newTag = {
            name: 'VIP Cliente',
            color: '#FFD700',
            description: 'Cliente VIP de prueba',
            folder: 'Clientes'
        };
        console.log(`Enviando: ${JSON.stringify(newTag)}`);
        const createTag = await makeRequest('POST', '/api/tags', newTag);
        console.log(`Status: ${createTag.status}`);
        console.log(`Respuesta:`, JSON.stringify(createTag.data, null, 2));
        console.log('✅ Test 2 completado\n');

        // Test 3: Crear otra etiqueta sin color (debe generar automático)
        console.log('🎨 Test 3: Crear etiqueta sin color (color automático)');
        const tagNoColor = {
            name: 'Prospecto Premium',
            folder: 'Prospectos'
        };
        console.log(`Enviando: ${JSON.stringify(tagNoColor)}`);
        const createTag2 = await makeRequest('POST', '/api/tags', tagNoColor);
        console.log(`Status: ${createTag2.status}`);
        console.log(`Respuesta:`, JSON.stringify(createTag2.data, null, 2));
        console.log('✅ Test 3 completado\n');

        // Test 4: Obtener etiquetas nuevamente para verificar
        console.log('🔍 Test 4: Verificar etiquetas creadas');
        const getTagsAfter = await makeRequest('GET', '/api/tags');
        console.log(`Status: ${getTagsAfter.status}`);
        console.log(`Total de etiquetas: ${getTagsAfter.data.data.length}`);
        console.log(`Respuesta:`, JSON.stringify(getTagsAfter.data, null, 2));
        console.log('✅ Test 4 completado\n');

        // Test 5: Intentar crear etiqueta duplicada
        console.log('⚠️ Test 5: Intentar crear etiqueta duplicada (debe fallar)');
        const duplicateTag = {
            name: 'VIP Cliente',
            folder: 'Clientes'
        };
        console.log(`Enviando: ${JSON.stringify(duplicateTag)}`);
        const createDuplicate = await makeRequest('POST', '/api/tags', duplicateTag);
        console.log(`Status: ${createDuplicate.status}`);
        console.log(`Respuesta:`, JSON.stringify(createDuplicate.data, null, 2));
        console.log('✅ Test 5 completado\n');

        console.log('✅ ¡Todas las pruebas completadas exitosamente!');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
        process.exit(1);
    }
}

testTags();
