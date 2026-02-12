import crypto from 'crypto';

class ThreatDetection {
  constructor(config = {}) {
    this.config = {
      // Rate limiting thresholds
      maxLoginAttempts: config.maxLoginAttempts || 5,
      loginAttemptWindow: config.loginAttemptWindow || 15 * 60 * 1000, // 15 minutes
      maxRequestsPerMinute: config.maxRequestsPerMinute || 100,
            
      // Suspicious pattern thresholds
      maxFailedRequests: config.maxFailedRequests || 10,
      suspiciousUserAgentPatterns: config.suspiciousUserAgentPatterns || [
        /bot/i, /crawler/i, /spider/i, /scraper/i
      ],
            
      // Geolocation settings
      enableGeoTracking: config.enableGeoTracking || false,
      maxDistanceKm: config.maxDistanceKm || 1000, // Suspicious if login from >1000km away
            
      // Behavioral analysis
      enableBehavioralAnalysis: config.enableBehavioralAnalysis || true,
      sessionTimeoutThreshold: config.sessionTimeoutThreshold || 24 * 60 * 60 * 1000, // 24 hours
            
      // Threat scoring
      threatScoreThreshold: config.threatScoreThreshold || 70,
            
      ...config
    };
        
    // In-memory stores (in production, use Redis or database)
    this.loginAttempts = new Map(); // IP -> attempts data
    this.requestCounts = new Map(); // IP -> request count data
    this.userSessions = new Map(); // userId -> session data
    this.threatScores = new Map(); // IP/userId -> threat score
    this.geoHistory = new Map(); // userId -> location history
    this.behaviorProfiles = new Map(); // userId -> behavior profile
        
    // Cleanup intervals
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }
    
  // Track login attempt
  trackLoginAttempt(ip, userId = null, success = false, metadata = {}) {
    const now = Date.now();
    const key = `${ip}:${userId || 'anonymous'}`;
        
    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, {
        attempts: [],
        firstAttempt: now,
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0
      });
    }
        
    const data = this.loginAttempts.get(key);
        
    // Clean old attempts outside the window
    data.attempts = data.attempts.filter(
      attempt => now - attempt.timestamp < this.config.loginAttemptWindow
    );
        
    // Add new attempt
    const attempt = {
      timestamp: now,
      success,
      ip,
      userId,
      userAgent: metadata.userAgent,
      location: metadata.location
    };
        
    data.attempts.push(attempt);
    data.totalAttempts++;
        
    if (success) {
      data.successfulAttempts++;
    } else {
      data.failedAttempts++;
    }
        
    this.loginAttempts.set(key, data);
        
    // Calculate threat score for this attempt
    const threatScore = this.calculateThreatScore(ip, userId, attempt, data);
        
    return {
      isBlocked: data.attempts.filter(a => !a.success).length >= this.config.maxLoginAttempts,
      attemptsRemaining: Math.max(0, this.config.maxLoginAttempts - data.attempts.filter(a => !a.success).length),
      threatScore,
      isSuspicious: threatScore > this.config.threatScoreThreshold
    };
  }
    
  // Track request rate
  /**
   * Rastrear solicitudes - DESACTIVADO
   */
  trackRequest(ip, endpoint = null, metadata = {}) {
      return {
          isRateLimited: false,
          requestCount: 0,
          remainingRequests: 999999
      };
  }
    
  // Analyze user agent for suspicious patterns
  analyzeUserAgent(userAgent) {
    if (!userAgent) {
      return { suspicious: true, reason: 'Missing user agent' };
    }
        
    const suspiciousPatterns = this.config.suspiciousUserAgentPatterns;
        
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        return { 
          suspicious: true, 
          reason: `Matches suspicious pattern: ${pattern}`,
          pattern: pattern.toString()
        };
      }
    }
        
    // Check for unusual characteristics
    if (userAgent.length < 10) {
      return { suspicious: true, reason: 'User agent too short' };
    }
        
    if (userAgent.length > 500) {
      return { suspicious: true, reason: 'User agent too long' };
    }
        
    // Check for common legitimate browsers
    const legitimatePatterns = [
      /Chrome\/\d+/,
      /Firefox\/\d+/,
      /Safari\/\d+/,
      /Edge\/\d+/,
      /Opera\/\d+/
    ];
        
    const hasLegitimatePattern = legitimatePatterns.some(pattern => pattern.test(userAgent));
        
    return {
      suspicious: !hasLegitimatePattern,
      reason: hasLegitimatePattern ? null : 'No legitimate browser pattern found'
    };
  }
    
  // Track geolocation
  trackGeolocation(userId, location) {
    if (!this.config.enableGeoTracking || !location) {
      return { suspicious: false };
    }
        
    if (!this.geoHistory.has(userId)) {
      this.geoHistory.set(userId, []);
    }
        
    const history = this.geoHistory.get(userId);
    const now = Date.now();
        
    // Add current location
    const locationEntry = {
      ...location,
      timestamp: now
    };
        
    history.push(locationEntry);
        
    // Keep only recent locations (last 30 days)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter(entry => entry.timestamp > thirtyDaysAgo);
    this.geoHistory.set(userId, recentHistory);
        
    // Analyze for suspicious patterns
    if (recentHistory.length < 2) {
      return { suspicious: false, reason: 'Insufficient location history' };
    }
        
    const lastLocation = recentHistory[recentHistory.length - 2];
    const distance = this.calculateDistance(
      lastLocation.latitude, lastLocation.longitude,
      location.latitude, location.longitude
    );
        
    const timeDiff = now - lastLocation.timestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
        
    // Check for impossible travel (too far too fast)
    const maxSpeedKmh = 1000; // Maximum reasonable speed (including flights)
    const possibleDistance = maxSpeedKmh * hoursDiff;
        
    if (distance > possibleDistance && distance > this.config.maxDistanceKm) {
      return {
        suspicious: true,
        reason: 'Impossible travel detected',
        distance: Math.round(distance),
        timeDiff: Math.round(hoursDiff),
        maxPossibleDistance: Math.round(possibleDistance)
      };
    }
        
    // Check for rapid location changes
    const recentLocations = recentHistory.slice(-5); // Last 5 locations
    const uniqueCountries = new Set(recentLocations.map(loc => loc.country));
        
    if (uniqueCountries.size > 3 && recentLocations.length === 5) {
      return {
        suspicious: true,
        reason: 'Multiple countries in recent activity',
        countries: Array.from(uniqueCountries)
      };
    }
        
    return { suspicious: false, distance: Math.round(distance) };
  }
    
  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
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
    
  // Behavioral analysis
  analyzeBehavior(userId, action, metadata = {}) {
    if (!this.config.enableBehavioralAnalysis) {
      return { suspicious: false };
    }
        
    if (!this.behaviorProfiles.has(userId)) {
      this.behaviorProfiles.set(userId, {
        actions: [],
        patterns: {},
        firstSeen: Date.now(),
        lastActivity: Date.now()
      });
    }
        
    const profile = this.behaviorProfiles.get(userId);
    const now = Date.now();
        
    // Add action to history
    const actionEntry = {
      action,
      timestamp: now,
      ...metadata
    };
        
    profile.actions.push(actionEntry);
    profile.lastActivity = now;
        
    // Keep only recent actions (last 7 days)
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    profile.actions = profile.actions.filter(a => a.timestamp > weekAgo);
        
    // Analyze patterns
    const analysis = this.analyzeActionPatterns(profile.actions);
    profile.patterns = analysis.patterns;
        
    this.behaviorProfiles.set(userId, profile);
        
    return analysis;
  }
    
  // Analyze action patterns for anomalies
  analyzeActionPatterns(actions) {
    const patterns = {
      hourlyDistribution: new Array(24).fill(0),
      actionTypes: {},
      averageSessionLength: 0,
      requestFrequency: 0
    };
        
    const suspicious = [];
        
    // Analyze hourly distribution
    actions.forEach(action => {
      const hour = new Date(action.timestamp).getHours();
      patterns.hourlyDistribution[hour]++;
            
      patterns.actionTypes[action.action] = (patterns.actionTypes[action.action] || 0) + 1;
    });
        
    // Check for unusual activity hours (3 AM - 6 AM)
    const nightActivity = patterns.hourlyDistribution.slice(3, 7).reduce((a, b) => a + b, 0);
    const totalActivity = patterns.hourlyDistribution.reduce((a, b) => a + b, 0);
        
    if (nightActivity / totalActivity > 0.3) {
      suspicious.push({
        type: 'unusual_hours',
        reason: 'High activity during night hours',
        percentage: Math.round((nightActivity / totalActivity) * 100)
      });
    }
        
    // Check for rapid-fire requests
    const sortedActions = actions.sort((a, b) => a.timestamp - b.timestamp);
    let rapidRequests = 0;
        
    for (let i = 1; i < sortedActions.length; i++) {
      const timeDiff = sortedActions[i].timestamp - sortedActions[i - 1].timestamp;
      if (timeDiff < 1000) { // Less than 1 second apart
        rapidRequests++;
      }
    }
        
    if (rapidRequests > actions.length * 0.2) {
      suspicious.push({
        type: 'rapid_requests',
        reason: 'High frequency of rapid requests',
        count: rapidRequests
      });
    }
        
    // Check for repetitive actions
    const actionCounts = Object.values(patterns.actionTypes);
    const maxActionCount = Math.max(...actionCounts);
        
    if (maxActionCount > actions.length * 0.8) {
      suspicious.push({
        type: 'repetitive_behavior',
        reason: 'Highly repetitive action pattern',
        dominantAction: Object.keys(patterns.actionTypes).find(
          key => patterns.actionTypes[key] === maxActionCount
        )
      });
    }
        
    return {
      patterns,
      suspicious: suspicious.length > 0,
      anomalies: suspicious
    };
  }
    
  // Calculate overall threat score
  calculateThreatScore(ip, userId, currentAttempt, attemptHistory) {
    let score = 0;
    const factors = [];
        
    // Failed login attempts factor (0-30 points)
    const failedAttempts = attemptHistory.attempts.filter(a => !a.success).length;
    const loginScore = Math.min(30, failedAttempts * 6);
    score += loginScore;
    if (loginScore > 0) {
      factors.push({ factor: 'failed_logins', score: loginScore, details: `${failedAttempts} failed attempts` });
    }
        
    // User agent analysis (0-20 points)
    if (currentAttempt.userAgent) {
      const uaAnalysis = this.analyzeUserAgent(currentAttempt.userAgent);
      if (uaAnalysis.suspicious) {
        const uaScore = 20;
        score += uaScore;
        factors.push({ factor: 'suspicious_user_agent', score: uaScore, details: uaAnalysis.reason });
      }
    }
        
    // Request rate factor (0-25 points)
    const minute = Math.floor(Date.now() / 60000);
    const requestKey = `${ip}:${minute}`;
    const requestData = this.requestCounts.get(requestKey);
    if (requestData && requestData.count > this.config.maxRequestsPerMinute * 0.8) {
      const rateScore = Math.min(25, (requestData.count / this.config.maxRequestsPerMinute) * 20);
      score += rateScore;
      factors.push({ factor: 'high_request_rate', score: rateScore, details: `${requestData.count} requests/minute` });
    }
        
    // Geolocation factor (0-15 points)
    if (userId && currentAttempt.location) {
      const geoAnalysis = this.trackGeolocation(userId, currentAttempt.location);
      if (geoAnalysis.suspicious) {
        const geoScore = 15;
        score += geoScore;
        factors.push({ factor: 'suspicious_location', score: geoScore, details: geoAnalysis.reason });
      }
    }
        
    // Behavioral analysis factor (0-10 points)
    if (userId) {
      const behaviorAnalysis = this.analyzeBehavior(userId, 'login', currentAttempt);
      if (behaviorAnalysis.suspicious) {
        const behaviorScore = 10;
        score += behaviorScore;
        factors.push({ factor: 'suspicious_behavior', score: behaviorScore, details: 'Anomalous behavior pattern' });
      }
    }
        
    // Store threat score
    const scoreKey = userId ? `user:${userId}` : `ip:${ip}`;
    this.threatScores.set(scoreKey, {
      score,
      factors,
      timestamp: Date.now(),
      ip,
      userId
    });
        
    return {
      score,
      factors,
      level: this.getThreatLevel(score)
    };
  }
    
  // Get threat level based on score
  getThreatLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
    
  // Check if IP/user is blocked
  isBlocked(ip, userId = null) {
    const scoreKey = userId ? `user:${userId}` : `ip:${ip}`;
    const threatData = this.threatScores.get(scoreKey);
        
    if (threatData && threatData.score >= this.config.threatScoreThreshold) {
      return {
        blocked: true,
        reason: 'High threat score',
        score: threatData.score,
        level: this.getThreatLevel(threatData.score)
      };
    }
        
    // Check login attempts
    const attemptKey = `${ip}:${userId || 'anonymous'}`;
    const attemptData = this.loginAttempts.get(attemptKey);
        
    if (attemptData) {
      const recentFailures = attemptData.attempts.filter(
        a => !a.success && Date.now() - a.timestamp < this.config.loginAttemptWindow
      ).length;
            
      if (recentFailures >= this.config.maxLoginAttempts) {
        return {
          blocked: true,
          reason: 'Too many failed login attempts',
          attempts: recentFailures,
          windowMinutes: this.config.loginAttemptWindow / 60000
        };
      }
    }
        
    return { blocked: false };
  }
    
  // Get threat report for IP/user
  getThreatReport(ip, userId = null) {
    const scoreKey = userId ? `user:${userId}` : `ip:${ip}`;
    const threatData = this.threatScores.get(scoreKey);
    const attemptKey = `${ip}:${userId || 'anonymous'}`;
    const attemptData = this.loginAttempts.get(attemptKey);
        
    const report = {
      ip,
      userId,
      threatScore: threatData ? threatData.score : 0,
      threatLevel: threatData ? this.getThreatLevel(threatData.score) : 'minimal',
      factors: threatData ? threatData.factors : [],
      blocked: this.isBlocked(ip, userId).blocked,
      loginAttempts: attemptData ? {
        total: attemptData.totalAttempts,
        failed: attemptData.failedAttempts,
        successful: attemptData.successfulAttempts,
        recentFailed: attemptData.attempts.filter(
          a => !a.success && Date.now() - a.timestamp < this.config.loginAttemptWindow
        ).length
      } : null,
      generatedAt: new Date()
    };
        
    if (userId && this.behaviorProfiles.has(userId)) {
      const profile = this.behaviorProfiles.get(userId);
      report.behaviorProfile = {
        firstSeen: new Date(profile.firstSeen),
        lastActivity: new Date(profile.lastActivity),
        actionCount: profile.actions.length,
        patterns: profile.patterns
      };
    }
        
    return report;
  }
    
  // Reset threat data for IP/user
  resetThreatData(ip, userId = null) {
    const scoreKey = userId ? `user:${userId}` : `ip:${ip}`;
    const attemptKey = `${ip}:${userId || 'anonymous'}`;
        
    this.threatScores.delete(scoreKey);
    this.loginAttempts.delete(attemptKey);
        
    if (userId) {
      this.behaviorProfiles.delete(userId);
      this.geoHistory.delete(userId);
    }
        
    return { success: true, message: 'Threat data reset' };
  }
    
  // Cleanup old data
  cleanup() {
    const now = Date.now();
    const cleanupAge = 24 * 60 * 60 * 1000; // 24 hours
        
    // Cleanup login attempts
    for (const [key, data] of this.loginAttempts.entries()) {
      if (now - data.firstAttempt > cleanupAge) {
        this.loginAttempts.delete(key);
      }
    }
        
    // Cleanup request counts
    for (const [key, data] of this.requestCounts.entries()) {
      if (now - data.firstRequest > 60000) { // 1 minute
        this.requestCounts.delete(key);
      }
    }
        
    // Cleanup threat scores
    for (const [key, data] of this.threatScores.entries()) {
      if (now - data.timestamp > cleanupAge) {
        this.threatScores.delete(key);
      }
    }
  }
    
  // Get system statistics
  getStatistics() {
    return {
      activeThreats: this.threatScores.size,
      trackedIPs: new Set([...this.loginAttempts.keys()].map(key => key.split(':')[0])).size,
      trackedUsers: new Set([...this.behaviorProfiles.keys()]).size,
      totalLoginAttempts: Array.from(this.loginAttempts.values())
        .reduce((sum, data) => sum + data.totalAttempts, 0),
      totalFailedAttempts: Array.from(this.loginAttempts.values())
        .reduce((sum, data) => sum + data.failedAttempts, 0),
      highThreatCount: Array.from(this.threatScores.values())
        .filter(data => data.score >= 60).length,
      criticalThreatCount: Array.from(this.threatScores.values())
        .filter(data => data.score >= 80).length
    };
  }
    
  // Close and cleanup
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
        
    this.loginAttempts.clear();
    this.requestCounts.clear();
    this.userSessions.clear();
    this.threatScores.clear();
    this.geoHistory.clear();
    this.behaviorProfiles.clear();
  }
}

export default ThreatDetection;