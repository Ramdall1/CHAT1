import crypto from 'crypto';
import { createLogger } from '../logger.js';

class GeoLocation {
  constructor(config = {}) {
    this.config = {
      // IP geolocation service configuration
      ipGeolocationService: config.ipGeolocationService || 'ipapi', // ipapi, ipinfo, maxmind
      apiKey: config.apiKey || null,
      enableCaching: config.enableCaching !== false,
      cacheTimeout: config.cacheTimeout || 24 * 60 * 60 * 1000, // 24 hours
            
      // Privacy settings
      enableLocationHashing: config.enableLocationHashing || true,
      precisionLevel: config.precisionLevel || 'city', // country, region, city, precise
            
      // Risk assessment
      riskCountries: config.riskCountries || [
        'CN', 'RU', 'KP', 'IR' // Example high-risk countries
      ],
      allowedCountries: config.allowedCountries || null, // null = all allowed
            
      // VPN/Proxy detection
      enableVPNDetection: config.enableVPNDetection || true,
      vpnDatabases: config.vpnDatabases || ['builtin'],
            
      ...config
    };
        
    // Cache for IP geolocation results
    this.locationCache = new Map();
    this.vpnCache = new Map();
    this.logger = createLogger('GEO_LOCATION');
        
    // Known VPN/Proxy IP ranges (simplified example)
    this.knownVPNRanges = new Set([
      // Add known VPN IP ranges here
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ]);
        
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000); // Cleanup every hour
  }
    
  // Get location from IP address
  async getLocationFromIP(ip) {
    if (!ip || this.isPrivateIP(ip)) {
      return {
        ip,
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        latitude: null,
        longitude: null,
        isPrivate: true,
        accuracy: 'unknown'
      };
    }
        
    // Check cache first
    if (this.config.enableCaching && this.locationCache.has(ip)) {
      const cached = this.locationCache.get(ip);
      if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }
    }
        
    try {
      let locationData;
            
      switch (this.config.ipGeolocationService) {
      case 'ipapi':
        locationData = await this.getLocationFromIPAPI(ip);
        break;
      case 'ipinfo':
        locationData = await this.getLocationFromIPInfo(ip);
        break;
      case 'maxmind':
        locationData = await this.getLocationFromMaxMind(ip);
        break;
      default:
        locationData = await this.getLocationFromIPAPI(ip);
      }
            
      // Apply precision level
      locationData = this.applyPrecisionLevel(locationData);
            
      // Cache the result
      if (this.config.enableCaching) {
        this.locationCache.set(ip, {
          data: locationData,
          timestamp: Date.now()
        });
      }
            
      return locationData;
            
    } catch (error) {
      if (this.logger) this.logger.error(`Failed to get location for IP ${ip}:`, error.message);
      return {
        ip,
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        latitude: null,
        longitude: null,
        error: error.message,
        accuracy: 'unknown'
      };
    }
  }
    
  // Get location from IP-API service
  async getLocationFromIPAPI(ip) {
    const url = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting`;
        
    const response = await fetch(url);
    const data = await response.json();
        
    if (data.status === 'fail') {
      throw new Error(data.message || 'IP-API request failed');
    }
        
    return {
      ip,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      organization: data.org,
      asn: data.as,
      isProxy: data.proxy || false,
      isHosting: data.hosting || false,
      accuracy: 'city',
      source: 'ip-api'
    };
  }
    
  // Get location from IPInfo service
  async getLocationFromIPInfo(ip) {
    const token = this.config.apiKey ? `?token=${this.config.apiKey}` : '';
    const url = `https://ipinfo.io/${ip}/json${token}`;
        
    const response = await fetch(url);
    const data = await response.json();
        
    if (data.error) {
      throw new Error(data.error.message || 'IPInfo request failed');
    }
        
    const [latitude, longitude] = (data.loc || '0,0').split(',').map(Number);
        
    return {
      ip,
      country: data.country,
      countryCode: data.country,
      region: data.region,
      city: data.city,
      latitude,
      longitude,
      timezone: data.timezone,
      isp: data.org,
      organization: data.org,
      postal: data.postal,
      accuracy: 'city',
      source: 'ipinfo'
    };
  }
    
  // Placeholder for MaxMind GeoIP service
  /**
   * Get location data from MaxMind GeoIP2 service
   * Supports both database and web service approaches
   * @param {string} ip - IP address to lookup
   * @returns {Promise<Object>} Location data
   * @throws {Error} If MaxMind service fails or is not configured
   */
  async getLocationFromMaxMind(ip) {
    try {
      // Check if we have MaxMind configuration
      if (!this.config.maxmind) {
        throw new Error('MaxMind configuration not found');
      }

      const { type, apiKey, userId, databasePath, timeout = 5000 } = this.config.maxmind;

      if (type === 'webservice') {
        return await this._getLocationFromMaxMindWebService(ip, apiKey, userId, timeout);
      } else if (type === 'database') {
        return await this._getLocationFromMaxMindDatabase(ip, databasePath);
      } else {
        throw new Error('Invalid MaxMind type. Must be "webservice" or "database"');
      }
    } catch (error) {
      this.logger.error('MaxMind geolocation failed:', error);
      throw new Error(`MaxMind geolocation failed: ${error.message}`);
    }
  }

  /**
   * Get location from MaxMind Web Service
   * @private
   */
  async _getLocationFromMaxMindWebService(ip, apiKey, userId, timeout) {
    if (!apiKey || !userId) {
      throw new Error('MaxMind API key and user ID are required for web service');
    }

    const url = `https://geoip.maxmind.com/geoip/v2.1/city/${ip}`;
    const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'User-Agent': 'ChatBot-GeoLocation/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid MaxMind credentials');
        } else if (response.status === 402) {
          throw new Error('MaxMind account has insufficient funds');
        } else if (response.status === 403) {
          throw new Error('MaxMind access forbidden');
        } else if (response.status === 404) {
          throw new Error('IP address not found in MaxMind database');
        }
        throw new Error(`MaxMind API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this._parseMaxMindResponse(data, ip);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('MaxMind request timeout');
      }
      throw error;
    }
  }

  /**
   * Get location from MaxMind Database (requires maxmind npm package)
   * @private
   */
  async _getLocationFromMaxMindDatabase(ip, databasePath) {
    try {
      // Dynamic import to avoid requiring maxmind package if not used
      const maxmind = await import('maxmind');
      
      if (!databasePath) {
        throw new Error('MaxMind database path is required');
      }

      // Open the database
      const lookup = await maxmind.open(databasePath);
      const result = lookup.get(ip);

      if (!result) {
        throw new Error('IP address not found in MaxMind database');
      }

      return this._parseMaxMindDatabaseResponse(result, ip);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('MaxMind package not installed. Run: npm install maxmind');
      }
      throw error;
    }
  }

  /**
   * Parse MaxMind web service response
   * @private
   */
  _parseMaxMindResponse(data, ip) {
    const country = data.country || {};
    const subdivisions = data.subdivisions || [];
    const city = data.city || {};
    const location = data.location || {};
    const postal = data.postal || {};

    return {
      ip,
      country: country.names?.en || 'Unknown',
      countryCode: country.iso_code || null,
      region: subdivisions[0]?.names?.en || 'Unknown',
      regionCode: subdivisions[0]?.iso_code || null,
      city: city.names?.en || 'Unknown',
      postalCode: postal.code || null,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      timezone: location.time_zone || null,
      accuracy: location.accuracy_radius || null,
      isPrivate: false,
      provider: 'maxmind',
      confidence: {
        country: country.confidence || null,
        city: city.confidence || null,
        location: location.accuracy_radius || null
      }
    };
  }

  /**
   * Parse MaxMind database response
   * @private
   */
  _parseMaxMindDatabaseResponse(data, ip) {
    const country = data.country || {};
    const subdivisions = data.subdivisions || [];
    const city = data.city || {};
    const location = data.location || {};
    const postal = data.postal || {};

    return {
      ip,
      country: country.names?.en || 'Unknown',
      countryCode: country.iso_code || null,
      region: subdivisions[0]?.names?.en || 'Unknown',
      regionCode: subdivisions[0]?.iso_code || null,
      city: city.names?.en || 'Unknown',
      postalCode: postal.code || null,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      timezone: location.time_zone || null,
      accuracy: location.accuracy_radius || null,
      isPrivate: false,
      provider: 'maxmind',
      confidence: {
        country: null, // Database doesn't provide confidence scores
        city: null,
        location: location.accuracy_radius || null
      }
    };
  }
    
  // Apply precision level to location data
  applyPrecisionLevel(locationData) {
    const result = { ...locationData };
        
    switch (this.config.precisionLevel) {
    case 'country':
      result.region = 'Hidden';
      result.city = 'Hidden';
      result.latitude = null;
      result.longitude = null;
      result.accuracy = 'country';
      break;
                
    case 'region':
      result.city = 'Hidden';
      result.latitude = null;
      result.longitude = null;
      result.accuracy = 'region';
      break;
                
    case 'city':
      // Round coordinates to city level precision
      if (result.latitude && result.longitude) {
        result.latitude = Math.round(result.latitude * 100) / 100;
        result.longitude = Math.round(result.longitude * 100) / 100;
      }
      result.accuracy = 'city';
      break;
                
    case 'precise':
      // Keep full precision
      result.accuracy = 'precise';
      break;
    }
        
    // Hash sensitive data if enabled
    if (this.config.enableLocationHashing) {
      result.hashedLocation = this.hashLocation(result);
    }
        
    return result;
  }
    
  // Hash location data for privacy
  hashLocation(locationData) {
    const locationString = `${locationData.country}:${locationData.region}:${locationData.city}`;
    return crypto.createHash('sha256').update(locationString).digest('hex');
  }
    
  // Check if IP is private/local
  isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
        
    return privateRanges.some(range => range.test(ip));
  }
    
  // Detect VPN/Proxy usage
  async detectVPN(ip, locationData = null) {
    if (!this.config.enableVPNDetection) {
      return { isVPN: false, confidence: 0 };
    }
        
    // Check cache first
    if (this.vpnCache.has(ip)) {
      const cached = this.vpnCache.get(ip);
      if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }
    }
        
    const vpnIndicators = [];
    let confidence = 0;
        
    // Get location data if not provided
    if (!locationData) {
      locationData = await this.getLocationFromIP(ip);
    }
        
    // Check if IP is marked as proxy/hosting by geolocation service
    if (locationData.isProxy) {
      vpnIndicators.push('marked_as_proxy');
      confidence += 40;
    }
        
    if (locationData.isHosting) {
      vpnIndicators.push('hosting_provider');
      confidence += 30;
    }
        
    // Check against known VPN IP ranges
    if (this.isKnownVPNIP(ip)) {
      vpnIndicators.push('known_vpn_range');
      confidence += 50;
    }
        
    // Check ISP/Organization for VPN keywords
    const vpnKeywords = ['vpn', 'proxy', 'tunnel', 'anonymous', 'private', 'secure'];
    const orgText = (locationData.organization || '').toLowerCase();
        
    for (const keyword of vpnKeywords) {
      if (orgText.includes(keyword)) {
        vpnIndicators.push(`org_contains_${keyword}`);
        confidence += 20;
        break;
      }
    }
        
    // Additional heuristics
    if (locationData.isp && locationData.organization && 
            locationData.isp.toLowerCase() !== locationData.organization.toLowerCase()) {
      vpnIndicators.push('isp_org_mismatch');
      confidence += 10;
    }
        
    const result = {
      isVPN: confidence >= 50,
      confidence: Math.min(100, confidence),
      indicators: vpnIndicators,
      checkedAt: new Date()
    };
        
    // Cache the result
    this.vpnCache.set(ip, {
      data: result,
      timestamp: Date.now()
    });
        
    return result;
  }
    
  // Check if IP is in known VPN ranges
  isKnownVPNIP(ip) {
    // This is a simplified check - in production, use a comprehensive VPN database
    return this.knownVPNRanges.has(ip) || this.isPrivateIP(ip);
  }
    
  // Assess location risk
  assessLocationRisk(locationData) {
    const risks = [];
    let riskScore = 0;
        
    // Check against high-risk countries
    if (this.config.riskCountries.includes(locationData.countryCode)) {
      risks.push({
        type: 'high_risk_country',
        severity: 'high',
        description: `Location in high-risk country: ${locationData.country}`
      });
      riskScore += 40;
    }
        
    // Check against allowed countries (if configured)
    if (this.config.allowedCountries && 
            !this.config.allowedCountries.includes(locationData.countryCode)) {
      risks.push({
        type: 'restricted_country',
        severity: 'critical',
        description: `Location in restricted country: ${locationData.country}`
      });
      riskScore += 60;
    }
        
    // Check for unknown/error locations
    if (locationData.country === 'Unknown' || locationData.error) {
      risks.push({
        type: 'unknown_location',
        severity: 'medium',
        description: 'Unable to determine location'
      });
      riskScore += 20;
    }
        
    return {
      riskScore: Math.min(100, riskScore),
      riskLevel: this.getRiskLevel(riskScore),
      risks,
      isBlocked: riskScore >= 80
    };
  }
    
  // Get risk level based on score
  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
    
  // Calculate distance between two locations
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return null;
    }
        
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
        
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
    
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
    
  // Analyze location change patterns
  analyzeLocationPattern(userId, currentLocation, locationHistory = []) {
    const analysis = {
      suspicious: false,
      reasons: [],
      travelDistance: null,
      travelTime: null,
      impossibleTravel: false
    };
        
    if (locationHistory.length === 0) {
      return analysis;
    }
        
    const lastLocation = locationHistory[locationHistory.length - 1];
    const distance = this.calculateDistance(
      lastLocation.latitude, lastLocation.longitude,
      currentLocation.latitude, currentLocation.longitude
    );
        
    if (distance === null) {
      return analysis;
    }
        
    const timeDiff = Date.now() - lastLocation.timestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
        
    analysis.travelDistance = Math.round(distance);
    analysis.travelTime = Math.round(hoursDiff * 100) / 100;
        
    // Check for impossible travel (too fast)
    const maxSpeedKmh = 1000; // Including commercial flights
    const possibleDistance = maxSpeedKmh * hoursDiff;
        
    if (distance > possibleDistance && distance > 100) {
      analysis.suspicious = true;
      analysis.impossibleTravel = true;
      analysis.reasons.push({
        type: 'impossible_travel',
        description: `Travel of ${Math.round(distance)}km in ${Math.round(hoursDiff)}h is impossible`,
        maxPossibleDistance: Math.round(possibleDistance)
      });
    }
        
    // Check for rapid country changes
    const recentLocations = locationHistory.slice(-5);
    const uniqueCountries = new Set([
      ...recentLocations.map(loc => loc.countryCode),
      currentLocation.countryCode
    ]);
        
    if (uniqueCountries.size > 3) {
      analysis.suspicious = true;
      analysis.reasons.push({
        type: 'multiple_countries',
        description: `Activity from ${uniqueCountries.size} different countries recently`,
        countries: Array.from(uniqueCountries)
      });
    }
        
    // Check for VPN hopping pattern
    const vpnCount = recentLocations.filter(loc => loc.isVPN).length;
    if (vpnCount > 2) {
      analysis.suspicious = true;
      analysis.reasons.push({
        type: 'vpn_hopping',
        description: 'Multiple VPN locations detected',
        vpnCount
      });
    }
        
    return analysis;
  }
    
  // Get comprehensive location report
  async getLocationReport(ip, userId = null, locationHistory = []) {
    const locationData = await this.getLocationFromIP(ip);
    const vpnData = await this.detectVPN(ip, locationData);
    const riskAssessment = this.assessLocationRisk(locationData);
        
    const report = {
      ip,
      userId,
      location: locationData,
      vpnDetection: vpnData,
      riskAssessment,
      timestamp: new Date()
    };
        
    // Add pattern analysis if history is available
    if (locationHistory.length > 0) {
      report.patternAnalysis = this.analyzeLocationPattern(userId, locationData, locationHistory);
    }
        
    return report;
  }
    
  // Cleanup expired cache entries
  cleanupCache() {
    const now = Date.now();
        
    // Cleanup location cache
    for (const [key, value] of this.locationCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.locationCache.delete(key);
      }
    }
        
    // Cleanup VPN cache
    for (const [key, value] of this.vpnCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.vpnCache.delete(key);
      }
    }
  }
    
  // Get cache statistics
  getCacheStats() {
    return {
      locationCacheSize: this.locationCache.size,
      vpnCacheSize: this.vpnCache.size,
      cacheTimeout: this.config.cacheTimeout,
      lastCleanup: new Date()
    };
  }
    
  // Clear all caches
  clearCache() {
    this.locationCache.clear();
    this.vpnCache.clear();
    return { success: true, message: 'All caches cleared' };
  }
    
  // Close and cleanup
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
        
    this.locationCache.clear();
    this.vpnCache.clear();
  }
}

export default GeoLocation;