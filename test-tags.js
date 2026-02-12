/**
 * Script de prueba para crear etiquetas
 * Ejecutar con: node test-tags.js
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
        console.log('📝 Test 2: Crear etiqueta "VIP"');
        const newTag1 = {
            name: 'VIP',
            folder: 'Clientes'
        };
        console.log(`Enviando: ${JSON.stringify(newTag1)}`);
        const createTag1 = await makeRequest('POST', '/api/tags', newTag1);
        console.log(`Status: ${createTag1.status}`);
        console.log(`Respuesta:`, JSON.stringify(createTag1.data, null, 2));
        console.log('✅ Test 2 completado\n');

        // Test 3: Crear otra etiqueta
        console.log('📝 Test 3: Crear etiqueta "Prospecto"');
        const newTag2 = {
            name: 'Prospecto',
            folder: 'Prospectos'
        };
        console.log(`Enviando: ${JSON.stringify(newTag2)}`);
        const createTag2 = await makeRequest('POST', '/api/tags', newTag2);
        console.log(`Status: ${createTag2.status}`);
        console.log(`Respuesta:`, JSON.stringify(createTag2.data, null, 2));
        console.log('✅ Test 3 completado\n');

        // Test 4: Crear etiqueta con color personalizado
        console.log('🎨 Test 4: Crear etiqueta "Premium" con color personalizado');
        const newTag3 = {
            name: 'Premium',
            color: '#FF6B6B',
            folder: 'Clientes'
        };
        console.log(`Enviando: ${JSON.stringify(newTag3)}`);
        const createTag3 = await makeRequest('POST', '/api/tags', newTag3);
        console.log(`Status: ${createTag3.status}`);
        console.log(`Respuesta:`, JSON.stringify(createTag3.data, null, 2));
        console.log('✅ Test 4 completado\n');

        // Test 5: Obtener etiquetas nuevamente
        console.log('🔍 Test 5: Obtener etiquetas después de crear');
        const getTagsAfter = await makeRequest('GET', '/api/tags');
        console.log(`Status: ${getTagsAfter.status}`);
        console.log(`Total de etiquetas: ${getTagsAfter.data.data.length}`);
        console.log(`Respuesta:`, JSON.stringify(getTagsAfter.data, null, 2));
        console.log('✅ Test 5 completado\n');

        // Test 6: Agregar etiqueta a contacto (ID 9)
        console.log('🏷️ Test 6: Agregar etiqueta "VIP" al contacto 9');
        const addTagData = {
            tagId: 'vip'  // El ID generado para "VIP" es "vip" (lowercase)
        };
        console.log(`Enviando: ${JSON.stringify(addTagData)}`);
        const addTag = await makeRequest('POST', '/api/tags/contact/9', addTagData);
        console.log(`Status: ${addTag.status}`);
        console.log(`Respuesta:`, JSON.stringify(addTag.data, null, 2));
        console.log('✅ Test 6 completado\n');

        // Test 7: Agregar otra etiqueta al mismo contacto
        console.log('🏷️ Test 7: Agregar etiqueta "Prospecto" al contacto 9');
        const addTagData2 = {
            tagId: 'prospecto'
        };
        console.log(`Enviando: ${JSON.stringify(addTagData2)}`);
        const addTag2 = await makeRequest('POST', '/api/tags/contact/9', addTagData2);
        console.log(`Status: ${addTag2.status}`);
        console.log(`Respuesta:`, JSON.stringify(addTag2.data, null, 2));
        console.log('✅ Test 7 completado\n');

        // Test 8: Obtener etiquetas del contacto
        console.log('🔍 Test 8: Obtener etiquetas del contacto 9');
        const getContactTags = await makeRequest('GET', '/api/tags/contact/9');
        console.log(`Status: ${getContactTags.status}`);
        console.log(`Respuesta:`, JSON.stringify(getContactTags.data, null, 2));
        console.log('✅ Test 8 completado\n');

        console.log('✅ ¡Todas las pruebas completadas exitosamente!');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
        process.exit(1);
    }
}

testTags();
