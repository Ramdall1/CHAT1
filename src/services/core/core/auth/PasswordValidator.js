import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class PasswordValidator {
  constructor(config = {}) {
    this.config = {
      minLength: config.minLength || 12,
      maxLength: config.maxLength || 128,
      requireUppercase: config.requireUppercase !== false,
      requireLowercase: config.requireLowercase !== false,
      requireNumbers: config.requireNumbers !== false,
      requireSpecialChars: config.requireSpecialChars !== false,
      minUppercase: config.minUppercase || 1,
      minLowercase: config.minLowercase || 1,
      minNumbers: config.minNumbers || 1,
      minSpecialChars: config.minSpecialChars || 1,
      maxRepeatingChars: config.maxRepeatingChars || 3,
      maxSequentialChars: config.maxSequentialChars || 3,
      preventCommonPatterns: config.preventCommonPatterns !== false,
      preventPersonalInfo: config.preventPersonalInfo !== false,
      preventDictionaryWords: config.preventDictionaryWords !== false,
      entropyThreshold: config.entropyThreshold || 3.5,
      customBlacklist: config.customBlacklist || [],
      ...config
    };

    // Common weak passwords and patterns
    this.commonPasswords = new Set([
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      'qwerty123', 'admin123', 'root', 'toor', 'pass', '12345678',
      'football', 'baseball', 'basketball', 'superman', 'batman'
    ]);

    // Common keyboard patterns
    this.keyboardPatterns = [
      'qwerty', 'asdf', 'zxcv', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
      '1234567890', '0987654321', 'abcdefg', 'zyxwvu'
    ];

    // Special characters
    this.specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
    this.loadCommonDictionary();
  }

  async loadCommonDictionary() {
    try {
      // In a real implementation, you would load from a dictionary file
      this.dictionaryWords = new Set([
        'password', 'admin', 'user', 'login', 'welcome', 'hello',
        'world', 'computer', 'internet', 'security', 'system',
        'database', 'server', 'network', 'application', 'software'
      ]);
    } catch (error) {
      this.dictionaryWords = new Set();
    }
  }

  validatePassword(password, userInfo = {}) {
    const result = {
      isValid: false,
      score: 0,
      strength: 'very_weak',
      errors: [],
      warnings: [],
      suggestions: [],
      entropy: 0,
      estimatedCrackTime: '0 seconds'
    };

    if (!password || typeof password !== 'string') {
      result.errors.push('Password must be a valid string');
      return result;
    }

    // Basic length validation
    this.validateLength(password, result);
        
    // Character composition validation
    this.validateCharacterComposition(password, result);
        
    // Pattern validation
    this.validatePatterns(password, result);
        
    // Common password validation
    this.validateCommonPasswords(password, result);
        
    // Dictionary word validation
    this.validateDictionaryWords(password, result);
        
    // Personal information validation
    this.validatePersonalInfo(password, userInfo, result);
        
    // Entropy calculation
    this.calculateEntropy(password, result);
        
    // Calculate overall score and strength
    this.calculateScore(password, result);
        
    // Estimate crack time
    this.estimateCrackTime(password, result);
        
    // Generate suggestions
    this.generateSuggestions(password, result);

    result.isValid = result.errors.length === 0 && result.score >= 70;
        
    return result;
  }

  validateLength(password, result) {
    if (password.length < this.config.minLength) {
      result.errors.push(`Password must be at least ${this.config.minLength} characters long`);
    } else if (password.length > this.config.maxLength) {
      result.errors.push(`Password must not exceed ${this.config.maxLength} characters`);
    } else {
      result.score += Math.min(20, (password.length - this.config.minLength) * 2);
    }
  }

  validateCharacterComposition(password, result) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = new RegExp(`[${this.escapeRegex(this.specialChars)}]`).test(password);

    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    const numberCount = (password.match(/[0-9]/g) || []).length;
    const specialCharCount = (password.match(new RegExp(`[${this.escapeRegex(this.specialChars)}]`, 'g')) || []).length;

    if (this.config.requireUppercase && !hasUppercase) {
      result.errors.push('Password must contain at least one uppercase letter');
    } else if (this.config.requireUppercase && uppercaseCount < this.config.minUppercase) {
      result.errors.push(`Password must contain at least ${this.config.minUppercase} uppercase letters`);
    }

    if (this.config.requireLowercase && !hasLowercase) {
      result.errors.push('Password must contain at least one lowercase letter');
    } else if (this.config.requireLowercase && lowercaseCount < this.config.minLowercase) {
      result.errors.push(`Password must contain at least ${this.config.minLowercase} lowercase letters`);
    }

    if (this.config.requireNumbers && !hasNumbers) {
      result.errors.push('Password must contain at least one number');
    } else if (this.config.requireNumbers && numberCount < this.config.minNumbers) {
      result.errors.push(`Password must contain at least ${this.config.minNumbers} numbers`);
    }

    if (this.config.requireSpecialChars && !hasSpecialChars) {
      result.errors.push(`Password must contain at least one special character (${this.specialChars})`);
    } else if (this.config.requireSpecialChars && specialCharCount < this.config.minSpecialChars) {
      result.errors.push(`Password must contain at least ${this.config.minSpecialChars} special characters`);
    }

    // Score based on character diversity
    let diversityScore = 0;
    if (hasUppercase) diversityScore += 5;
    if (hasLowercase) diversityScore += 5;
    if (hasNumbers) diversityScore += 5;
    if (hasSpecialChars) diversityScore += 10;
        
    result.score += diversityScore;
  }

  validatePatterns(password, result) {
    // Check for repeating characters
    const repeatingPattern = new RegExp(`(.)\\1{${this.config.maxRepeatingChars - 1},}`, 'i');
    if (repeatingPattern.test(password)) {
      result.errors.push(`Password cannot contain more than ${this.config.maxRepeatingChars} repeating characters`);
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password, this.config.maxSequentialChars)) {
      result.errors.push(`Password cannot contain more than ${this.config.maxSequentialChars} sequential characters`);
    }

    // Check for keyboard patterns
    if (this.config.preventCommonPatterns) {
      for (const pattern of this.keyboardPatterns) {
        if (password.toLowerCase().includes(pattern)) {
          result.warnings.push(`Password contains keyboard pattern: ${pattern}`);
          result.score -= 10;
        }
      }
    }

    // Check for common substitutions (e.g., @ for a, 3 for e)
    const commonSubstitutions = password
      .replace(/[@4]/g, 'a')
      .replace(/[3]/g, 'e')
      .replace(/[1!]/g, 'i')
      .replace(/[0]/g, 'o')
      .replace(/[5$]/g, 's')
      .replace(/[7]/g, 't');

    if (this.commonPasswords.has(commonSubstitutions.toLowerCase())) {
      result.warnings.push('Password is a common password with simple character substitutions');
      result.score -= 15;
    }
  }

  validateCommonPasswords(password, result) {
    const lowerPassword = password.toLowerCase();
        
    if (this.commonPasswords.has(lowerPassword)) {
      result.errors.push('Password is too common and easily guessable');
    }

    // Check if password is in custom blacklist
    for (const blacklisted of this.config.customBlacklist) {
      if (lowerPassword.includes(blacklisted.toLowerCase())) {
        result.errors.push(`Password contains blacklisted term: ${blacklisted}`);
      }
    }
  }

  validateDictionaryWords(password, result) {
    if (!this.config.preventDictionaryWords) return;

    const lowerPassword = password.toLowerCase();
        
    for (const word of this.dictionaryWords) {
      if (lowerPassword.includes(word) && word.length > 3) {
        result.warnings.push(`Password contains dictionary word: ${word}`);
        result.score -= 5;
      }
    }
  }

  validatePersonalInfo(password, userInfo, result) {
    if (!this.config.preventPersonalInfo || !userInfo) return;

    const lowerPassword = password.toLowerCase();
    const personalFields = ['username', 'email', 'firstName', 'lastName', 'birthDate', 'phone'];

    for (const field of personalFields) {
      if (userInfo[field]) {
        const value = userInfo[field].toString().toLowerCase();
        if (value.length > 2 && lowerPassword.includes(value)) {
          result.errors.push(`Password cannot contain personal information (${field})`);
        }
      }
    }
  }

  calculateEntropy(password, result) {
    const charsetSize = this.getCharsetSize(password);
    result.entropy = Math.log2(Math.pow(charsetSize, password.length));
        
    if (result.entropy < this.config.entropyThreshold * password.length) {
      result.warnings.push('Password has low entropy and may be predictable');
      result.score -= 10;
    } else {
      result.score += Math.min(15, Math.floor(result.entropy / 10));
    }
  }

  getCharsetSize(password) {
    let size = 0;
        
    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/[0-9]/.test(password)) size += 10;
    if (new RegExp(`[${this.escapeRegex(this.specialChars)}]`).test(password)) size += this.specialChars.length;
        
    return size;
  }

  calculateScore(password, result) {
    // Bonus for length beyond minimum
    if (password.length > this.config.minLength) {
      result.score += Math.min(10, (password.length - this.config.minLength) * 2);
    }

    // Penalty for errors
    result.score -= result.errors.length * 20;
        
    // Penalty for warnings
    result.score -= result.warnings.length * 5;

    // Ensure score is between 0 and 100
    result.score = Math.max(0, Math.min(100, result.score));

    // Determine strength
    if (result.score >= 90) result.strength = 'very_strong';
    else if (result.score >= 80) result.strength = 'strong';
    else if (result.score >= 60) result.strength = 'moderate';
    else if (result.score >= 40) result.strength = 'weak';
    else result.strength = 'very_weak';
  }

  estimateCrackTime(password, result) {
    const charsetSize = this.getCharsetSize(password);
    const combinations = Math.pow(charsetSize, password.length);
        
    // Assume 1 billion guesses per second (modern hardware)
    const guessesPerSecond = 1e9;
    const secondsToCrack = combinations / (2 * guessesPerSecond); // Average case
        
    result.estimatedCrackTime = this.formatTime(secondsToCrack);
  }

  formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
    return `${Math.round(seconds / 31536000)} years`;
  }

  generateSuggestions(password, result) {
    if (password.length < this.config.minLength) {
      result.suggestions.push(`Increase length to at least ${this.config.minLength} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      result.suggestions.push('Add uppercase letters');
    }

    if (!/[a-z]/.test(password)) {
      result.suggestions.push('Add lowercase letters');
    }

    if (!/[0-9]/.test(password)) {
      result.suggestions.push('Add numbers');
    }

    if (!new RegExp(`[${this.escapeRegex(this.specialChars)}]`).test(password)) {
      result.suggestions.push('Add special characters');
    }

    if (result.entropy < 50) {
      result.suggestions.push('Use a more random combination of characters');
    }

    if (result.warnings.length > 0) {
      result.suggestions.push('Avoid common patterns and dictionary words');
    }
  }

  hasSequentialChars(password, maxSequential) {
    for (let i = 0; i <= password.length - maxSequential; i++) {
      const substring = password.substring(i, i + maxSequential);
            
      // Check for ascending sequence
      let isAscending = true;
      let isDescending = true;
            
      for (let j = 1; j < substring.length; j++) {
        const current = substring.charCodeAt(j);
        const previous = substring.charCodeAt(j - 1);
                
        if (current !== previous + 1) isAscending = false;
        if (current !== previous - 1) isDescending = false;
      }
            
      if (isAscending || isDescending) return true;
    }
        
    return false;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Generate a secure password suggestion
  generateSecurePassword(length = this.config.minLength) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = this.specialChars;
        
    let password = '';
    let charset = '';
        
    // Ensure at least one character from each required set
    if (this.config.requireUppercase) {
      password += uppercase[crypto.randomInt(uppercase.length)];
      charset += uppercase;
    }
        
    if (this.config.requireLowercase) {
      password += lowercase[crypto.randomInt(lowercase.length)];
      charset += lowercase;
    }
        
    if (this.config.requireNumbers) {
      password += numbers[crypto.randomInt(numbers.length)];
      charset += numbers;
    }
        
    if (this.config.requireSpecialChars) {
      password += special[crypto.randomInt(special.length)];
      charset += special;
    }
        
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }
        
    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
  }
}

export default PasswordValidator;