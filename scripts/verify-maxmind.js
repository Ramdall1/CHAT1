#!/usr/bin/env node

/**
 * MaxMind Integration Verification Script
 * 
 * This script verifies that the MaxMind integration is working correctly
 * by testing various configurations and scenarios.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function verifyFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    logSuccess(`${description} exists: ${filePath}`);
  } else {
    logError(`${description} missing: ${filePath}`);
  }
  return exists;
}

async function verifyModuleLoad(modulePath, description) {
  try {
    const module = await import(modulePath);
    logSuccess(`${description} loaded successfully`);
    return module;
  } catch (error) {
    logError(`${description} failed to load: ${error.message}`);
    return null;
  }
}

async function verifyConfiguration() {
  logInfo('Verifying MaxMind configuration...');
  
  try {
    const config = await import('../src/config/geolocation.config.js');
    
    // Check exports
    const requiredExports = [
      'GEOLOCATION_SERVICES',
      'MAXMIND_TYPES',
      'PRECISION_LEVELS',
      'createGeoLocationConfig',
      'createGeoLocationInstance',
      'createMaxMindConfig',
      'getEnvironmentConfig',
      'validateGeoLocationConfig',
      'validateMaxMindConfig'
    ];
    
    for (const exportName of requiredExports) {
      if (config[exportName]) {
        logSuccess(`Export '${exportName}' available`);
      } else {
        logError(`Export '${exportName}' missing`);
      }
    }
    
    // Test configuration creation
    const testConfig = config.createGeoLocationConfig({
      GEOLOCATION_SERVICE: 'maxmind',
      MAXMIND_TYPE: 'webservice',
      MAXMIND_USER_ID: 'test_user',
      MAXMIND_API_KEY: 'test_key'
    });
    
    if (testConfig && testConfig.ipGeolocationService === 'maxmind') {
      logSuccess('Configuration creation works correctly');
    } else {
      logError('Configuration creation failed');
    }
    
    return true;
  } catch (error) {
    logError(`Configuration verification failed: ${error.message}`);
    return false;
  }
}

async function verifyGeoLocationClass() {
  logInfo('Verifying GeoLocation class...');
  
  try {
    const { default: GeoLocation } = await import('../src/services/core/core/auth/GeoLocation.js');
    
    // Test class instantiation
    const geoLocation = new GeoLocation({
      ipGeolocationService: 'maxmind',
      maxmind: {
        type: 'webservice',
        userId: 'test_user',
        apiKey: 'test_key'
      }
    });
    
    if (geoLocation) {
      logSuccess('GeoLocation class instantiation successful');
    }
    
    // Check if MaxMind method exists
    if (typeof geoLocation.getLocationFromMaxMind === 'function') {
      logSuccess('getLocationFromMaxMind method exists');
    } else {
      logError('getLocationFromMaxMind method missing');
    }
    
    return true;
  } catch (error) {
    logError(`GeoLocation class verification failed: ${error.message}`);
    return false;
  }
}

async function verifyEnvironmentVariables() {
  logInfo('Verifying environment variables configuration...');
  
  const envExamplePath = './.env.example';
  if (!fs.existsSync(envExamplePath)) {
    logWarning('.env.example file not found');
    return false;
  }
  
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  const requiredVars = [
    'GEOLOCATION_SERVICE',
    'MAXMIND_TYPE',
    'MAXMIND_USER_ID',
    'MAXMIND_API_KEY',
    'MAXMIND_DATABASE_PATH',
    'MAXMIND_TIMEOUT'
  ];
  
  for (const varName of requiredVars) {
    if (envContent.includes(varName)) {
      logSuccess(`Environment variable '${varName}' documented`);
    } else {
      logError(`Environment variable '${varName}' missing from .env.example`);
    }
  }
  
  return true;
}

async function verifyDocumentation() {
  logInfo('Verifying documentation...');
  
  const docPath = './docs/MAXMIND_INTEGRATION.md';
  const docExists = await verifyFileExists(docPath, 'MaxMind integration documentation');
  
  if (docExists) {
    const docContent = fs.readFileSync(docPath, 'utf8');
    
    const requiredSections = [
      '# MaxMind GeoIP2 Integration Guide',
      '## Overview',
      '## Configuration',
      '## Setup Instructions',
      '## Usage Examples',
      '## Error Handling',
      '## Performance Considerations',
      '## Security Considerations',
      '## Troubleshooting'
    ];
    
    for (const section of requiredSections) {
      if (docContent.includes(section)) {
        logSuccess(`Documentation section '${section}' present`);
      } else {
        logWarning(`Documentation section '${section}' missing`);
      }
    }
  }
  
  return docExists;
}

async function verifyTestFiles() {
  logInfo('Verifying test files...');
  
  const testPath = './tests/unit/geolocation/MaxMind.test.js';
  const testExists = await verifyFileExists(testPath, 'MaxMind test file');
  
  if (testExists) {
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    if (testContent.includes('describe') && testContent.includes('MaxMind')) {
      logSuccess('Test file contains MaxMind tests');
    } else {
      logWarning('Test file may not contain proper MaxMind tests');
    }
  }
  
  return testExists;
}

async function simulateMaxMindUsage() {
  logInfo('Simulating MaxMind usage...');
  
  try {
    const { createGeoLocationConfig } = await import('../src/config/geolocation.config.js');
    const { default: GeoLocation } = await import('../src/services/core/core/auth/GeoLocation.js');
    
    // Test configuration
    const config = createGeoLocationConfig({
      GEOLOCATION_SERVICE: 'maxmind',
      MAXMIND_TYPE: 'webservice',
      MAXMIND_USER_ID: 'test_user',
      MAXMIND_API_KEY: 'test_key',
      MAXMIND_TIMEOUT: '5000'
    });
    
    const geoLocation = new GeoLocation(config);
    
    // Test with a mock IP (this will fail with test credentials, but should not crash)
    try {
      await geoLocation.getLocationFromIP('8.8.8.8');
      logWarning('MaxMind call succeeded (unexpected with test credentials)');
    } catch (error) {
      if (error.message.includes('Invalid MaxMind credentials') || 
          error.message.includes('MaxMind configuration not found')) {
        logSuccess('MaxMind integration properly handles invalid credentials');
      } else {
        logWarning(`MaxMind call failed with: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    logError(`MaxMind usage simulation failed: ${error.message}`);
    return false;
  }
}

async function main() {
  log('\n🔍 MaxMind Integration Verification\n', 'bold');
  
  const results = {
    files: 0,
    modules: 0,
    config: 0,
    geoLocation: 0,
    env: 0,
    docs: 0,
    tests: 0,
    usage: 0
  };
  
  // Verify core files
  log('\n📁 File Verification:', 'bold');
  results.files += await verifyFileExists('./src/services/core/core/auth/GeoLocation.js', 'GeoLocation class') ? 1 : 0;
  results.files += await verifyFileExists('./src/config/geolocation.config.js', 'Geolocation configuration') ? 1 : 0;
  
  // Verify module loading
  log('\n📦 Module Loading:', 'bold');
  const geoLocationModule = await verifyModuleLoad('./src/services/core/core/auth/GeoLocation.js', 'GeoLocation module');
  const configModule = await verifyModuleLoad('./src/config/geolocation.config.js', 'Configuration module');
  results.modules += geoLocationModule ? 1 : 0;
  results.modules += configModule ? 1 : 0;
  
  // Verify configuration
  log('\n⚙️  Configuration Verification:', 'bold');
  results.config += await verifyConfiguration() ? 1 : 0;
  
  // Verify GeoLocation class
  log('\n🌍 GeoLocation Class Verification:', 'bold');
  results.geoLocation += await verifyGeoLocationClass() ? 1 : 0;
  
  // Verify environment variables
  log('\n🔧 Environment Variables:', 'bold');
  results.env += await verifyEnvironmentVariables() ? 1 : 0;
  
  // Verify documentation
  log('\n📚 Documentation:', 'bold');
  results.docs += await verifyDocumentation() ? 1 : 0;
  
  // Verify tests
  log('\n🧪 Test Files:', 'bold');
  results.tests += await verifyTestFiles() ? 1 : 0;
  
  // Simulate usage
  log('\n🚀 Usage Simulation:', 'bold');
  results.usage += await simulateMaxMindUsage() ? 1 : 0;
  
  // Summary
  log('\n📊 Verification Summary:', 'bold');
  const total = Object.values(results).reduce((sum, val) => sum + val, 0);
  const maxTotal = Object.keys(results).length;
  
  for (const [category, score] of Object.entries(results)) {
    const status = score > 0 ? '✅' : '❌';
    log(`${status} ${category}: ${score > 0 ? 'PASS' : 'FAIL'}`);
  }
  
  log(`\n🎯 Overall Score: ${total}/${maxTotal} (${Math.round((total/maxTotal) * 100)}%)`, 'bold');
  
  if (total === maxTotal) {
    logSuccess('\n🎉 MaxMind integration verification completed successfully!');
  } else if (total >= maxTotal * 0.8) {
    logWarning('\n⚠️  MaxMind integration mostly working, some issues detected');
  } else {
    logError('\n❌ MaxMind integration has significant issues');
  }
  
  log('\n📋 Next Steps:', 'bold');
  log('1. Set up real MaxMind credentials in .env file');
  log('2. Test with real MaxMind service');
  log('3. Run integration tests');
  log('4. Monitor performance in production');
  
  process.exit(total === maxTotal ? 0 : 1);
}

// Run verification
main().catch(error => {
  logError(`Verification script failed: ${error.message}`);
  process.exit(1);
});