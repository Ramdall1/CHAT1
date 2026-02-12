/**
 * GeoLocation Service Configuration
 * Handles configuration for IP geolocation services including MaxMind integration
 */

/**
 * Create GeoLocation configuration from environment variables
 * @returns {Object} GeoLocation configuration object
 */
export function createGeoLocationConfig() {
  const config = {
    // Service selection
    ipGeolocationService: process.env.GEOLOCATION_SERVICE || 'ipapi',
    apiKey: process.env.GEOLOCATION_API_KEY || null,
    
    // Caching configuration
    enableCaching: process.env.GEOLOCATION_ENABLE_CACHING !== 'false',
    cacheTimeout: parseInt(process.env.GEOLOCATION_CACHE_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
    
    // Privacy settings
    enableLocationHashing: process.env.GEOLOCATION_ENABLE_HASHING !== 'false',
    precisionLevel: process.env.GEOLOCATION_PRECISION_LEVEL || 'city', // country, region, city, precise
    
    // Risk assessment
    riskCountries: process.env.RISK_COUNTRIES ? 
      process.env.RISK_COUNTRIES.split(',').map(c => c.trim()) : 
      ['CN', 'RU', 'KP', 'IR'],
    allowedCountries: process.env.ALLOWED_COUNTRIES ? 
      process.env.ALLOWED_COUNTRIES.split(',').map(c => c.trim()) : 
      null,
    
    // VPN/Proxy detection
    enableVPNDetection: process.env.ENABLE_VPN_DETECTION !== 'false',
    vpnDatabases: process.env.VPN_DATABASES ? 
      process.env.VPN_DATABASES.split(',').map(db => db.trim()) : 
      ['builtin']
  };

  // MaxMind specific configuration
  if (config.ipGeolocationService === 'maxmind') {
    config.maxmind = createMaxMindConfig();
  }

  return config;
}

/**
 * Create MaxMind specific configuration
 * @returns {Object} MaxMind configuration object
 */
export function createMaxMindConfig() {
  const type = process.env.MAXMIND_TYPE || 'webservice';
  
  const config = {
    type,
    timeout: parseInt(process.env.MAXMIND_TIMEOUT) || 5000
  };

  if (type === 'webservice') {
    config.userId = process.env.MAXMIND_USER_ID;
    config.apiKey = process.env.MAXMIND_API_KEY;
    
    if (!config.userId || !config.apiKey) {
      throw new Error('MaxMind web service requires MAXMIND_USER_ID and MAXMIND_API_KEY environment variables');
    }
  } else if (type === 'database') {
    config.databasePath = process.env.MAXMIND_DATABASE_PATH || './data/GeoLite2-City.mmdb';
    
    if (!config.databasePath) {
      throw new Error('MaxMind database requires MAXMIND_DATABASE_PATH environment variable');
    }
  } else {
    throw new Error('Invalid MAXMIND_TYPE. Must be "webservice" or "database"');
  }

  return config;
}

/**
 * Validate GeoLocation configuration
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
export function validateGeoLocationConfig(config) {
  const validServices = ['ipapi', 'ipinfo', 'maxmind'];
  if (!validServices.includes(config.ipGeolocationService)) {
    throw new Error(`Invalid geolocation service: ${config.ipGeolocationService}. Must be one of: ${validServices.join(', ')}`);
  }

  const validPrecisionLevels = ['country', 'region', 'city', 'precise'];
  if (!validPrecisionLevels.includes(config.precisionLevel)) {
    throw new Error(`Invalid precision level: ${config.precisionLevel}. Must be one of: ${validPrecisionLevels.join(', ')}`);
  }

  if (config.cacheTimeout && (config.cacheTimeout < 1000 || config.cacheTimeout > 7 * 24 * 60 * 60 * 1000)) {
    throw new Error('Cache timeout must be between 1 second and 7 days');
  }

  // Validate MaxMind configuration if present
  if (config.maxmind) {
    validateMaxMindConfig(config.maxmind);
  }
}

/**
 * Validate MaxMind specific configuration
 * @param {Object} config - MaxMind configuration object to validate
 * @throws {Error} If MaxMind configuration is invalid
 */
export function validateMaxMindConfig(config) {
  const validTypes = ['webservice', 'database'];
  if (!validTypes.includes(config.type)) {
    throw new Error(`Invalid MaxMind type: ${config.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  if (config.timeout && (config.timeout < 1000 || config.timeout > 30000)) {
    throw new Error('MaxMind timeout must be between 1 and 30 seconds');
  }

  if (config.type === 'webservice') {
    if (!config.userId || !config.apiKey) {
      throw new Error('MaxMind web service requires userId and apiKey');
    }
  } else if (config.type === 'database') {
    if (!config.databasePath) {
      throw new Error('MaxMind database requires databasePath');
    }
  }
}

/**
 * Get default configuration for different environments
 * @param {string} environment - Environment name (development, staging, production)
 * @returns {Object} Environment-specific configuration
 */
export function getEnvironmentConfig(environment = 'development') {
  const baseConfig = createGeoLocationConfig();

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        enableCaching: true,
        cacheTimeout: 30 * 60 * 1000, // 30 minutes for faster development
        precisionLevel: 'city',
        enableVPNDetection: true
      };

    case 'staging':
      return {
        ...baseConfig,
        enableCaching: true,
        cacheTimeout: 2 * 60 * 60 * 1000, // 2 hours
        precisionLevel: 'city',
        enableVPNDetection: true
      };

    case 'production':
      return {
        ...baseConfig,
        enableCaching: true,
        cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
        precisionLevel: 'region', // More privacy in production
        enableVPNDetection: true,
        enableLocationHashing: true
      };

    default:
      return baseConfig;
  }
}

/**
 * Create a GeoLocation instance with proper configuration
 * @param {string} environment - Environment name
 * @returns {Object} Configured GeoLocation instance
 */
export async function createGeoLocationInstance(environment = process.env.NODE_ENV || 'development') {
  const config = getEnvironmentConfig(environment);
  
  // Validate configuration before creating instance
  validateGeoLocationConfig(config);
  
  // Dynamic import to avoid circular dependencies
  const { default: GeoLocation } = await import('../services/core/core/auth/GeoLocation.js');
  
  return new GeoLocation(config);
}

// Export configuration constants
export const GEOLOCATION_SERVICES = {
  IPAPI: 'ipapi',
  IPINFO: 'ipinfo',
  MAXMIND: 'maxmind'
};

export const PRECISION_LEVELS = {
  COUNTRY: 'country',
  REGION: 'region',
  CITY: 'city',
  PRECISE: 'precise'
};

export const MAXMIND_TYPES = {
  WEBSERVICE: 'webservice',
  DATABASE: 'database'
};