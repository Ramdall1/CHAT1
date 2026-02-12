/**
 * Script de prueba para crear campos personalizados
 * Ejecutar con: node test-custom-fields.mjs
 */

async function makeRequest(method, path, data = null) {
    const url = `http://localhost:3000${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    return {
        status: response.status,
        data: responseData
    };
}

async function testCustomFields() {
    console.log('🧪 Iniciando pruebas de campos personalizados...\n');

    try {
        // Test 1: Obtener campos personalizados existentes
        console.log('📋 Test 1: Obtener campos personalizados existentes');
        const getFields = await makeRequest('GET', '/api/custom-fields');
        console.log(`Status: ${getFields.status}`);
        console.log(`Campos encontrados: ${getFields.data.data.length}`);
        console.log(`Respuesta:`, JSON.stringify(getFields.data, null, 2));
        console.log('✅ Test 1 completado\n');

        // Test 2: Crear campo de texto
        console.log('📝 Test 2: Crear campo personalizado "Empresa" (texto)');
        const newField1 = {
            name: 'Empresa',
            type: 'text',
            description: 'Nombre de la empresa del cliente'
        };
        console.log(`Enviando: ${JSON.stringify(newField1)}`);
        const createField1 = await makeRequest('POST', '/api/custom-fields', newField1);
        console.log(`Status: ${createField1.status}`);
        console.log(`Respuesta:`, JSON.stringify(createField1.data, null, 2));
        console.log('✅ Test 2 completado\n');

        // Test 3: Crear campo de número
        console.log('📝 Test 3: Crear campo personalizado "Ingresos Anuales" (número)');
        const newField2 = {
            name: 'Ingresos Anuales',
            type: 'number',
            description: 'Ingresos anuales del cliente'
        };
        console.log(`Enviando: ${JSON.stringify(newField2)}`);
        const createField2 = await makeRequest('POST', '/api/custom-fields', newField2);
        console.log(`Status: ${createField2.status}`);
        console.log(`Respuesta:`, JSON.stringify(createField2.data, null, 2));
        console.log('✅ Test 3 completado\n');

        // Test 4: Crear campo de email
        console.log('📝 Test 4: Crear campo personalizado "Email Corporativo" (email)');
        const newField3 = {
            name: 'Email Corporativo',
            type: 'email',
            description: 'Email corporativo del cliente'
        };
        console.log(`Enviando: ${JSON.stringify(newField3)}`);
        const createField3 = await makeRequest('POST', '/api/custom-fields', newField3);
        console.log(`Status: ${createField3.status}`);
        console.log(`Respuesta:`, JSON.stringify(createField3.data, null, 2));
        console.log('✅ Test 4 completado\n');

        // Test 5: Crear campo de fecha
        console.log('📝 Test 5: Crear campo personalizado "Fecha de Contrato" (fecha)');
        const newField4 = {
            name: 'Fecha de Contrato',
            type: 'date',
            description: 'Fecha de inicio del contrato'
        };
        console.log(`Enviando: ${JSON.stringify(newField4)}`);
        const createField4 = await makeRequest('POST', '/api/custom-fields', newField4);
        console.log(`Status: ${createField4.status}`);
        console.log(`Respuesta:`, JSON.stringify(createField4.data, null, 2));
        console.log('✅ Test 5 completado\n');

        // Test 6: Crear campo de texto largo
        console.log('📝 Test 6: Crear campo personalizado "Notas" (texto largo)');
        const newField5 = {
            name: 'Notas',
            type: 'textarea',
            description: 'Notas adicionales sobre el cliente'
        };
        console.log(`Enviando: ${JSON.stringify(newField5)}`);
        const createField5 = await makeRequest('POST', '/api/custom-fields', newField5);
        console.log(`Status: ${createField5.status}`);
        console.log(`Respuesta:`, JSON.stringify(createField5.data, null, 2));
        console.log('✅ Test 6 completado\n');

        // Test 7: Obtener campos después de crear
        console.log('🔍 Test 7: Obtener campos personalizados después de crear');
        const getFieldsAfter = await makeRequest('GET', '/api/custom-fields');
        console.log(`Status: ${getFieldsAfter.status}`);
        console.log(`Total de campos: ${getFieldsAfter.data.data.length}`);
        console.log(`Respuesta:`, JSON.stringify(getFieldsAfter.data, null, 2));
        console.log('✅ Test 7 completado\n');

        // Test 8: Intentar crear campo duplicado (debe fallar)
        console.log('⚠️ Test 8: Intentar crear campo duplicado "Empresa" (debe fallar)');
        const duplicateField = {
            name: 'Empresa',
            type: 'text',
            description: 'Intento de duplicado'
        };
        console.log(`Enviando: ${JSON.stringify(duplicateField)}`);
        const createDuplicate = await makeRequest('POST', '/api/custom-fields', duplicateField);
        console.log(`Status: ${createDuplicate.status}`);
        console.log(`Respuesta:`, JSON.stringify(createDuplicate.data, null, 2));
        console.log('✅ Test 8 completado\n');

        // Test 9: Obtener carpetas de campos
        console.log('📁 Test 9: Obtener carpetas de campos personalizados');
        const getFolders = await makeRequest('GET', '/api/custom-fields/folders');
        console.log(`Status: ${getFolders.status}`);
        console.log(`Respuesta:`, JSON.stringify(getFolders.data, null, 2));
        console.log('✅ Test 9 completado\n');

        console.log('✅ ¡Todas las pruebas completadas exitosamente!');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
        process.exit(1);
    }
}

testCustomFields();
