# MaxMind GeoIP2 Integration Guide

This document provides comprehensive information about the MaxMind GeoIP2 integration in the ChatBot system.

## Overview

MaxMind GeoIP2 is a premium geolocation service that provides highly accurate IP geolocation data. Our integration supports both MaxMind's web service API and local database files.

## Features

- **Web Service Integration**: Real-time API calls to MaxMind's GeoIP2 web service
- **Database Integration**: Local database file support for offline geolocation
- **Comprehensive Error Handling**: Detailed error messages and fallback mechanisms
- **Caching Support**: Built-in caching to reduce API calls and improve performance
- **Privacy Controls**: Configurable precision levels and data hashing
- **Multiple Response Formats**: Standardized response format across all providers

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```bash
# Geolocation Service Configuration
GEOLOCATION_SERVICE=maxmind
GEOLOCATION_API_KEY=your_geolocation_api_key

# MaxMind Configuration
MAXMIND_TYPE=webservice
MAXMIND_USER_ID=your_maxmind_user_id
MAXMIND_API_KEY=your_maxmind_api_key
MAXMIND_DATABASE_PATH=./data/GeoLite2-City.mmdb
MAXMIND_TIMEOUT=5000
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEOLOCATION_SERVICE` | Geolocation provider | `ipapi` | No |
| `MAXMIND_TYPE` | MaxMind service type (`webservice` or `database`) | `webservice` | Yes (when using MaxMind) |
| `MAXMIND_USER_ID` | MaxMind account user ID | - | Yes (for web service) |
| `MAXMIND_API_KEY` | MaxMind account API key | - | Yes (for web service) |
| `MAXMIND_DATABASE_PATH` | Path to MaxMind database file | `./data/GeoLite2-City.mmdb` | Yes (for database) |
| `MAXMIND_TIMEOUT` | Request timeout in milliseconds | `5000` | No |

## Setup Instructions

### Option 1: Web Service (Recommended)

1. **Create MaxMind Account**
   - Sign up at [MaxMind](https://www.maxmind.com/en/geolite2/signup)
   - Navigate to "My Account" → "Manage License Keys"
   - Generate a new license key

2. **Configure Environment Variables**
   ```bash
   GEOLOCATION_SERVICE=maxmind
   MAXMIND_TYPE=webservice
   MAXMIND_USER_ID=your_user_id
   MAXMIND_API_KEY=your_api_key
   ```

3. **Test Configuration**
   ```javascript
   import { createGeoLocationInstance } from './src/config/geolocation.config.js';
   
   const geoLocation = await createGeoLocationInstance();
   const result = await geoLocation.getLocationFromIP('8.8.8.8');
   console.log(result);
   ```

### Option 2: Local Database

1. **Download Database**
   - Download GeoLite2 or GeoIP2 database from MaxMind
   - Extract to your preferred location (e.g., `./data/GeoLite2-City.mmdb`)

2. **Install MaxMind Package**
   ```bash
   npm install maxmind
   ```

3. **Configure Environment Variables**
   ```bash
   GEOLOCATION_SERVICE=maxmind
   MAXMIND_TYPE=database
   MAXMIND_DATABASE_PATH=./data/GeoLite2-City.mmdb
   ```

## Usage Examples

### Basic Usage

```javascript
import { createGeoLocationInstance } from './src/config/geolocation.config.js';

// Create instance with environment configuration
const geoLocation = await createGeoLocationInstance();

// Get location for an IP address
try {
  const location = await geoLocation.getLocationFromIP('8.8.8.8');
  console.log('Location:', location);
} catch (error) {
  console.error('Geolocation failed:', error.message);
}
```

### Custom Configuration

```javascript
import GeoLocation from './src/services/core/core/auth/GeoLocation.js';

const geoLocation = new GeoLocation({
  ipGeolocationService: 'maxmind',
  maxmind: {
    type: 'webservice',
    userId: 'your_user_id',
    apiKey: 'your_api_key',
    timeout: 10000
  },
  enableCaching: true,
  cacheTimeout: 60 * 60 * 1000, // 1 hour
  precisionLevel: 'city'
});

const location = await geoLocation.getLocationFromIP('8.8.8.8');
```

### Response Format

```javascript
{
  ip: '8.8.8.8',
  country: 'United States',
  countryCode: 'US',
  region: 'California',
  regionCode: 'CA',
  city: 'Mountain View',
  postalCode: '94043',
  latitude: 37.4056,
  longitude: -122.0775,
  timezone: 'America/Los_Angeles',
  accuracy: 1000,
  isPrivate: false,
  provider: 'maxmind',
  confidence: {
    country: 99,
    city: 95,
    location: 1000
  }
}
```

## Error Handling

The MaxMind integration provides detailed error handling for various scenarios:

### Common Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `MaxMind configuration not found` | MaxMind config missing | Add `maxmind` configuration object |
| `Invalid MaxMind credentials` | Wrong API credentials | Verify `MAXMIND_USER_ID` and `MAXMIND_API_KEY` |
| `MaxMind account has insufficient funds` | Account balance too low | Add funds to MaxMind account |
| `IP address not found in MaxMind database` | IP not in database | Normal for some IP ranges |
| `MaxMind request timeout` | Request took too long | Increase `MAXMIND_TIMEOUT` value |
| `MaxMind package not installed` | Missing npm package | Run `npm install maxmind` |

### Error Handling Example

```javascript
try {
  const location = await geoLocation.getLocationFromIP('192.168.1.1');
} catch (error) {
  if (error.message.includes('not found in MaxMind database')) {
    console.log('IP address is not in the geolocation database');
  } else if (error.message.includes('insufficient funds')) {
    console.error('MaxMind account needs funding');
  } else {
    console.error('Geolocation error:', error.message);
  }
}
```

## Performance Considerations

### Caching

- **Enable Caching**: Always enable caching in production
- **Cache Duration**: Set appropriate cache timeout (default: 24 hours)
- **Memory Usage**: Monitor cache size for high-traffic applications

```javascript
const config = {
  enableCaching: true,
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
  // ... other config
};
```

### Rate Limiting

MaxMind web service has rate limits:
- **Free accounts**: 1,000 requests per day
- **Paid accounts**: Varies by plan

### Database vs Web Service

| Aspect | Database | Web Service |
|--------|----------|-------------|
| **Latency** | Very low | Higher (network) |
| **Accuracy** | Monthly updates | Real-time updates |
| **Cost** | One-time/annual | Per-request |
| **Offline** | Yes | No |
| **Setup** | More complex | Simple |

## Security Considerations

### API Key Protection

- Store API keys in environment variables
- Never commit API keys to version control
- Use different keys for different environments
- Rotate keys regularly

### Privacy Controls

```javascript
const config = {
  precisionLevel: 'region', // Reduce precision for privacy
  enableLocationHashing: true, // Hash sensitive data
  // ... other config
};
```

### Data Retention

- Configure appropriate cache timeouts
- Implement data cleanup policies
- Consider GDPR compliance for EU users

## Monitoring and Debugging

### Logging

The integration provides detailed logging:

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Logs will include:
// - API request details
// - Response parsing
// - Error conditions
// - Cache operations
```

### Metrics

Monitor these metrics:
- Request success rate
- Response times
- Cache hit rate
- Error rates by type

### Health Checks

```javascript
// Check service health
const stats = geoLocation.getCacheStats();
console.log('Cache stats:', stats);

// Test with known IP
try {
  await geoLocation.getLocationFromIP('8.8.8.8');
  console.log('MaxMind service is healthy');
} catch (error) {
  console.error('MaxMind service issue:', error.message);
}
```

## Testing

### Unit Tests

Run the MaxMind-specific tests:

```bash
npm test tests/unit/geolocation/MaxMind.test.js
```

### Integration Tests

Test with real MaxMind service:

```bash
# Set real credentials
export MAXMIND_USER_ID=your_real_user_id
export MAXMIND_API_KEY=your_real_api_key

# Run integration tests
npm test tests/integration/geolocation/
```

### Manual Testing

```javascript
import { createGeoLocationInstance } from './src/config/geolocation.config.js';

const geoLocation = await createGeoLocationInstance();

// Test various IP types
const testIPs = [
  '8.8.8.8',        // Google DNS
  '1.1.1.1',        // Cloudflare DNS
  '192.168.1.1',    // Private IP
  '127.0.0.1'       // Localhost
];

for (const ip of testIPs) {
  try {
    const result = await geoLocation.getLocationFromIP(ip);
    console.log(`${ip}:`, result);
  } catch (error) {
    console.error(`${ip} failed:`, error.message);
  }
}
```

## Troubleshooting

### Common Issues

1. **"MaxMind configuration not found"**
   - Ensure `GEOLOCATION_SERVICE=maxmind`
   - Verify MaxMind configuration is properly set

2. **"Invalid MaxMind credentials"**
   - Check `MAXMIND_USER_ID` and `MAXMIND_API_KEY`
   - Verify credentials in MaxMind account

3. **"MaxMind package not installed"**
   - Run `npm install maxmind` for database support

4. **High response times**
   - Check network connectivity
   - Consider using database instead of web service
   - Verify cache is enabled

5. **Accuracy issues**
   - Ensure using latest database version
   - Consider upgrading to paid MaxMind service

### Debug Mode

Enable detailed debugging:

```bash
export DEBUG=geolocation:*
export LOG_LEVEL=debug
```

## Migration from Other Providers

### From IP-API

```javascript
// Old configuration
const oldConfig = {
  ipGeolocationService: 'ipapi'
};

// New MaxMind configuration
const newConfig = {
  ipGeolocationService: 'maxmind',
  maxmind: {
    type: 'webservice',
    userId: 'your_user_id',
    apiKey: 'your_api_key'
  }
};
```

### Response Format Differences

MaxMind provides additional fields:
- `confidence` scores
- `accuracy` radius
- `timezone` information
- More detailed subdivision data

## Best Practices

1. **Use Database for High Volume**: For applications with high request volumes
2. **Enable Caching**: Always enable caching in production
3. **Monitor Usage**: Track API usage to avoid rate limits
4. **Handle Errors Gracefully**: Implement proper fallback mechanisms
5. **Regular Updates**: Keep database files updated monthly
6. **Security**: Protect API keys and implement proper access controls

## Support

For issues related to:
- **MaxMind Service**: Contact MaxMind support
- **Integration Issues**: Check this documentation and logs
- **Feature Requests**: Submit to the development team

## References

- [MaxMind GeoIP2 Documentation](https://dev.maxmind.com/geoip/docs/)
- [MaxMind Account Management](https://www.maxmind.com/en/account)
- [GeoIP2 Web Service API](https://dev.maxmind.com/geoip/docs/web-services/)
- [GeoIP2 Database Documentation](https://dev.maxmind.com/geoip/docs/databases/)