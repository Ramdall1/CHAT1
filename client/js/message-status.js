/**
 * Gestor de Status de Mensajes (como WhatsApp)
 * Muestra: ✓ (enviado), ✓✓ (entregado), ✓✓ azul (leído)
 */

class MessageStatusManager {
  constructor() {
    this.statusMap = {
      'sent': {
        icon: '✓',
        color: '#999999',
        text: 'Enviado'
      },
      'delivered': {
        icon: '✓✓',
        color: '#999999',
        text: 'Entregado'
      },
      'read': {
        icon: '✓✓',
        color: '#007bff',
        text: 'Leído'
      },
      'failed': {
        icon: '✗',
        color: '#dc3545',
        text: 'Error'
      }
    };
  }

  /**
   * Obtener información del status
   */
  getStatusInfo(status) {
    return this.statusMap[status] || this.statusMap['sent'];
  }

  /**
   * Crear elemento HTML del status
   */
  createStatusElement(status, messageId) {
    const info = this.getStatusInfo(status);
    
    const statusEl = document.createElement('span');
    statusEl.className = `message-status status-${status}`;
    statusEl.innerHTML = info.icon;
    statusEl.style.color = info.color;
    statusEl.style.fontSize = '12px';
    statusEl.style.fontWeight = 'bold';
    statusEl.style.marginLeft = '4px';
    statusEl.style.cursor = 'pointer';
    statusEl.title = info.text;
    statusEl.dataset.messageId = messageId;
    statusEl.dataset.status = status;

    return statusEl;
  }

  /**
   * Actualizar status de un mensaje en la interfaz
   */
  updateMessageStatus(messageId, newStatus) {
    const statusEl = document.querySelector(`[data-message-id="${messageId}"]`);
    
    if (statusEl) {
      const info = this.getStatusInfo(newStatus);
      
      // Actualizar icono
      statusEl.innerHTML = info.icon;
      statusEl.style.color = info.color;
      statusEl.dataset.status = newStatus;
      statusEl.title = info.text;
      
      // Agregar animación
      statusEl.classList.add('status-updated');
      setTimeout(() => {
        statusEl.classList.remove('status-updated');
      }, 300);
    }
  }

  /**
   * Obtener status de un mensaje desde el servidor
   */
  async getMessageStatus(messageId) {
    try {
      const response = await fetch(`/api/messages/${messageId}/status`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('Error obteniendo status:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error en getMessageStatus:', error);
      return null;
    }
  }

  /**
   * Actualizar status de un mensaje en el servidor
   */
  async updateMessageStatusOnServer(messageId, newStatus) {
    try {
      const response = await fetch(`/api/messages/${messageId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Actualizar en la interfaz
        this.updateMessageStatus(messageId, newStatus);
        return data.data;
      } else {
        console.error('Error actualizando status:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error en updateMessageStatusOnServer:', error);
      return null;
    }
  }

  /**
   * Actualizar status por WAMAID (desde webhook)
   */
  async updateStatusByWamaid(wamaid, newStatus) {
    try {
      const response = await fetch(`/api/messages/wamaid/${wamaid}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Mensaje ${wamaid} actualizado a: ${newStatus}`);
        
        // Actualizar en la interfaz si el elemento existe
        if (data.data.messageId) {
          this.updateMessageStatus(data.data.messageId, newStatus);
        }
        
        return data.data;
      } else {
        console.error('Error actualizando status:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error en updateStatusByWamaid:', error);
      return null;
    }
  }

  /**
   * Simular flujo completo de WhatsApp
   */
  async simulateWhatsAppFlow(messageId, wamaid) {
    console.log(`🔄 Iniciando flujo WhatsApp para mensaje ${messageId}`);
    
    // 1. Enviado
    console.log('1️⃣  Enviado');
    await this.updateMessageStatusOnServer(messageId, 'sent');
    await this.delay(1000);
    
    // 2. Entregado
    console.log('2️⃣  Entregado');
    await this.updateStatusByWamaid(wamaid, 'delivered');
    await this.delay(2000);
    
    // 3. Leído
    console.log('3️⃣  Leído');
    await this.updateStatusByWamaid(wamaid, 'read');
    
    console.log('✅ Flujo completado');
  }

  /**
   * Utilidad para esperar
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Crear instancia global
window.messageStatusManager = new MessageStatusManager();

// Exportar para módulos
export default MessageStatusManager;
