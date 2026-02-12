/**
 * CircuitBreaker - Patrón Circuit Breaker para servicios de IA
 * 
 * Implementa el patrón Circuit Breaker para proteger los servicios de IA
 * de fallos en cascada y permitir recuperación automática.
 */

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minuto
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 segundos
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Verificar si se puede ejecutar una operación
   */
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      return false;
    }
    
    if (this.state === 'HALF_OPEN') {
      return true;
    }
    
    return false;
  }

  /**
   * Registrar una operación exitosa
   */
  recordSuccess() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  /**
   * Registrar una operación fallida
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
    }
  }

  /**
   * Obtener el estado actual del circuit breaker
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      successCount: this.successCount
    };
  }

  /**
   * Resetear el circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
}

export default CircuitBreaker;