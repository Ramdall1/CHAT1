import axios from 'axios';

// Test webhook con media (imagen)
const testWebhookPayload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "835384855703270",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "573022753557",
              "phone_number_id": "812973988574965"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Nia"
                },
                "wa_id": "573246874692"
              }
            ],
            "messages": [
              {
                "id": "wamid.HBgNNTczMjQ2ODc0NjkyFQIAERgSQTlBRDlEM0Q4QzQ5NzY4NzY4AA==",
                "from": "573246874692",
                "timestamp": "1732069050",
                "type": "image",
                "image": {
                  "mime_type": "image/jpeg",
                  "sha256": "hash_here",
                  "id": "1868213827124787",
                  "caption": "Test image"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

async function testWebhook() {
  try {
    console.log('🧪 Enviando webhook de prueba con imagen...');

    const response = await axios.post('http://localhost:3000/api/webhooks/360dialog', testWebhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-360dialog-Signature': 'test_signature'
      }
    });

    console.log('✅ Webhook enviado exitosamente:', response.data);

  } catch (error) {
    console.error('❌ Error enviando webhook:', error.response?.data || error.message);
  }
}

testWebhook();