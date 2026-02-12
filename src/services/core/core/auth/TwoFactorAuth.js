import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

class TwoFactorAuth {
  constructor(config = {}) {
    this.config = {
      issuer: config.issuer || 'YourApp',
      window: config.window || 1,
      backupCodeCount: config.backupCodeCount || 10,
      ...config
    };
    
    // Configure TOTP settings
    authenticator.options = {
      window: this.config.window,
      step: 30
    };
  }
    
  // Generate a secret for TOTP
  generateSecret(userIdentifier) {
    const secret = authenticator.generateSecret();
    const keyUri = authenticator.keyuri(
      userIdentifier,
      this.config.issuer,
      secret
    );
        
    return {
      secret,
      keyUri,
      manualEntryKey: secret.replace(/(.{4})/g, '$1 ').trim()
    };
  }
    
  // Generate QR code for TOTP setup
  async generateQRCode(keyUri) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(keyUri, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
            
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }
    
  // Verify TOTP token
  verifyTOTP(token, secret) {
    try {
      return authenticator.verify({
        token: token.toString(),
        secret: secret
      });
    } catch (error) {
      return false;
    }
  }
    
  // Generate backup codes
  generateBackupCodes(count = null) {
    const codesCount = count || this.config.backupCodesCount;
    const codes = [];
        
    for (let i = 0; i < codesCount; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
        
    return codes;
  }
    
  // Hash backup codes for storage
  hashBackupCodes(codes) {
    return codes.map(code => ({
      hash: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
      createdAt: new Date()
    }));
  }
    
  // Verify backup code
  verifyBackupCode(inputCode, hashedCodes) {
    const inputHash = crypto.createHash('sha256').update(inputCode.toUpperCase()).digest('hex');
        
    const codeIndex = hashedCodes.findIndex(
      codeObj => codeObj.hash === inputHash && !codeObj.used
    );
        
    if (codeIndex !== -1) {
      hashedCodes[codeIndex].used = true;
      hashedCodes[codeIndex].usedAt = new Date();
      return true;
    }
        
    return false;
  }
    

    
  // Setup 2FA for a user
  async setup2FA(userIdentifier, method = 'totp') {
    const setup = {
      method,
      createdAt: new Date(),
      verified: false
    };
        
    switch (method) {
    case 'totp':
      const totpData = this.generateSecret(userIdentifier);
      const qrCode = await this.generateQRCode(totpData.keyUri);
      const backupCodes = this.generateBackupCodes();
                
      setup.totp = {
        secret: totpData.secret,
        keyUri: totpData.keyUri,
        manualEntryKey: totpData.manualEntryKey,
        qrCode: qrCode
      };
      setup.backupCodes = this.hashBackupCodes(backupCodes);
      setup.plainBackupCodes = backupCodes; // Return once for user to save
      break;
                
    default:
      throw new Error(`Unsupported 2FA method: ${method}`);
    }
        
    return setup;
  }
    
  // Verify 2FA setup
  async verify2FASetup(setup, verificationCode, method = 'totp') {
    switch (method) {
    case 'totp':
      if (!setup.totp || !setup.totp.secret) {
        return { success: false, error: 'TOTP not configured' };
      }
                
      const isValid = this.verifyTOTP(verificationCode, setup.totp.secret);
      if (isValid) {
        setup.verified = true;
        setup.verifiedAt = new Date();
        // Remove QR code and plain backup codes after verification
        delete setup.totp.qrCode;
        delete setup.plainBackupCodes;
      }
                
      return { success: isValid, setup };
                
    default:
      return { success: false, error: `Unsupported method: ${method}` };
    }
  }
    
  // Authenticate with 2FA
  async authenticate2FA(userConfig, code, method = null) {
    if (!userConfig || !userConfig.verified) {
      return { success: false, error: '2FA not configured or verified' };
    }
        
    const authMethod = method || userConfig.method;
        
    switch (authMethod) {
    case 'totp':
      if (!userConfig.totp) {
        return { success: false, error: 'TOTP not configured' };
      }
                
      const totpValid = this.verifyTOTP(code, userConfig.totp.secret);
      if (totpValid) {
        return { 
          success: true, 
          method: 'totp',
          authenticatedAt: new Date()
        };
      }
                
      // Try backup codes if TOTP fails
      if (userConfig.backupCodes) {
        const backupValid = this.verifyBackupCode(code, userConfig.backupCodes);
        if (backupValid) {
          return { 
            success: true, 
            method: 'backup_code',
            authenticatedAt: new Date(),
            warning: 'Backup code used. Consider regenerating backup codes.'
          };
        }
      }
                
      return { success: false, error: 'Invalid code' };
                
    default:
      return { success: false, error: `Unsupported method: ${authMethod}` };
    }
  }
    

    
  // Regenerate backup codes
  regenerateBackupCodes(userConfig) {
    if (!userConfig || !userConfig.verified || userConfig.method !== 'totp') {
      throw new Error('TOTP 2FA not configured');
    }
        
    const newCodes = this.generateBackupCodes();
    userConfig.backupCodes = this.hashBackupCodes(newCodes);
    userConfig.backupCodesRegeneratedAt = new Date();
        
    return {
      backupCodes: newCodes,
      userConfig: userConfig
    };
  }
    
  // Disable 2FA
  disable2FA(userConfig) {
    return {
      method: null,
      verified: false,
      disabledAt: new Date(),
      previousConfig: {
        method: userConfig.method,
        disabledAt: new Date()
      }
    };
  }
    
  // Get 2FA status
  get2FAStatus(userConfig) {
    if (!userConfig) {
      return {
        enabled: false,
        method: null,
        verified: false
      };
    }
        
    const status = {
      enabled: userConfig.verified || false,
      method: userConfig.method || null,
      verified: userConfig.verified || false,
      createdAt: userConfig.createdAt || null,
      verifiedAt: userConfig.verifiedAt || null
    };
        
    if (userConfig.method === 'totp' && userConfig.backupCodes) {
      const unusedCodes = userConfig.backupCodes.filter(code => !code.used).length;
      status.backupCodesRemaining = unusedCodes;
    }
        
    return status;
  }
    
  // Generate recovery information
  generateRecoveryInfo(userConfig) {
    if (!userConfig || !userConfig.verified) {
      throw new Error('2FA not configured');
    }
        
    const recovery = {
      method: userConfig.method,
      generatedAt: new Date(),
      recoveryCode: crypto.randomBytes(16).toString('hex').toUpperCase()
    };
        
    if (userConfig.method === 'totp') {
      recovery.backupCodesCount = userConfig.backupCodes ? 
        userConfig.backupCodes.filter(code => !code.used).length : 0;
    }
        
    return recovery;
  }
}

export default TwoFactorAuth;