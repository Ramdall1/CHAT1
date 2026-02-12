/**
 * Lighthouse CI Configuration - ChatBot Enterprise
 * 
 * Este archivo es un proxy que referencia la configuración principal
 * ubicada en el directorio config/ para mantener compatibilidad
 * con herramientas que esperan encontrar lighthouserc.js en la raíz.
 * 
 * @see ./config/lighthouse.config.js - Configuración principal
 */

import lighthouseConfig from './config/environments/environments/lighthouse.config.js';

export default lighthouseConfig;