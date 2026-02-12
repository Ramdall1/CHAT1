# Guía de Testing - ChatBot Enterprise

## 🎯 Filosofía de Testing

### Pirámide de Testing
```
    /\
   /E2E\     ← Pocas pruebas, alto valor
  /______\
 /Integration\ ← Pruebas de módulos
/______________\
/  Unit Tests  \ ← Muchas pruebas, rápidas
________________
```

### Principios
1. **Fast**: Pruebas rápidas para feedback inmediato
2. **Independent**: Cada prueba es independiente
3. **Repeatable**: Resultados consistentes
4. **Self-Validating**: Pass/Fail claro
5. **Timely**: Escritas junto con el código

## 🧪 Tipos de Pruebas

### 1. Pruebas Unitarias
**Objetivo**: Probar funciones/métodos individuales

```javascript
// tests/unit/utils.test.js
import { formatMessage } from '../../src/utils/messageFormatter.js';

describe('formatMessage', () => {
    it('should format simple text message', () => {
        const input = 'Hello World';
        const result = formatMessage(input);
        
        expect(result).toEqual({
            text: 'Hello World',
            type: 'text',
            timestamp: expect.any(Number)
        });
    });

    it('should handle empty message', () => {
        const result = formatMessage('');
        
        expect(result).toBeNull();
    });

    it('should sanitize HTML content', () => {
        const input = '<script>alert("xss")</script>Hello';
        const result = formatMessage(input);
        
        expect(result.text).toBe('Hello');
        expect(result.text).not.toContain('<script>');
    });
});
```

### 2. Pruebas de Integración
**Objetivo**: Probar interacción entre módulos

```javascript
// tests/integration/chat-flow.test.js
import ChatBot from '../../src/core/ChatBot.js';
import MessageProcessor from '../../src/core/MessageProcessor.js';

describe('Chat Flow Integration', () => {
    let chatBot;
    let messageProcessor;

    beforeEach(() => {
        chatBot = new ChatBot();
        messageProcessor = new MessageProcessor();
    });

    it('should process message through complete flow', async () => {
        // Arrange
        const userMessage = 'Hello, I need help';
        
        // Act
        const response = await chatBot.processMessage(userMessage);
        
        // Assert
        expect(response).toMatchObject({
            text: expect.any(String),
            type: 'response',
            confidence: expect.any(Number)
        });
        expect(response.confidence).toBeGreaterThan(0.5);
    });
});
```

### 3. Pruebas End-to-End
**Objetivo**: Probar flujos completos de usuario

```javascript
// tests/e2e/chat-session.test.js
import { test, expect } from '@playwright/test';

test('complete chat session', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Iniciar chat
    await page.click('[data-testid="start-chat"]');
    
    // Enviar mensaje
    await page.fill('[data-testid="message-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');
    
    // Verificar respuesta
    await expect(page.locator('[data-testid="chat-response"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-response"]')).toContainText('Hello');
});
```

## 🛠️ Configuración de Testing

### Jest Configuration
```javascript
// jest.config.js
export default {
    testEnvironment: 'node',
    transform: {},
    extensionsToTreatAsEsm: ['.js'],
    globals: {
        'ts-jest': {
            useESM: true
        }
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/src/**/*.test.js'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/tests/**'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    }
};
```

### Setup Global
```javascript
// tests/setup.js
import { jest } from '@jest/globals';

// Mock global console para pruebas más limpias
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Setup global antes de cada prueba
beforeEach(() => {
    jest.clearAllMocks();
});

// Cleanup después de cada prueba
afterEach(() => {
    jest.restoreAllMocks();
});
```

## 🎭 Mocking Strategies

### 1. Module Mocking
```javascript
// __mocks__/DatabaseManager.js
export default class DatabaseManager {
    constructor() {
        this.connected = true;
    }

    async connect() {
        return Promise.resolve();
    }

    async query(sql, params) {
        return Promise.resolve([]);
    }

    async close() {
        return Promise.resolve();
    }
}
```

### 2. Function Mocking
```javascript
// tests/services/auth.test.js
import { jest } from '@jest/globals';
import AuthService from '../../src/services/AuthService.js';

// Mock external dependencies
const mockHashPassword = jest.fn();
const mockVerifyToken = jest.fn();

jest.mock('../../src/utils/crypto.js', () => ({
    hashPassword: mockHashPassword,
    verifyToken: mockVerifyToken
}));

describe('AuthService', () => {
    beforeEach(() => {
        mockHashPassword.mockResolvedValue('hashed_password');
        mockVerifyToken.mockResolvedValue(true);
    });

    it('should authenticate user with valid credentials', async () => {
        const authService = new AuthService();
        const result = await authService.login('user@test.com', 'password');
        
        expect(mockHashPassword).toHaveBeenCalledWith('password');
        expect(result.success).toBe(true);
    });
});
```

### 3. API Mocking
```javascript
// tests/integration/api.test.js
import nock from 'nock';
import ApiClient from '../../src/services/ApiClient.js';

describe('API Integration', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it('should handle API response correctly', async () => {
        // Mock API response
        nock('https://api.example.com')
            .get('/users/123')
            .reply(200, {
                id: 123,
                name: 'Test User',
                email: 'test@example.com'
            });

        const client = new ApiClient();
        const user = await client.getUser(123);

        expect(user.name).toBe('Test User');
    });
});
```

## 📊 Testing Patterns

### 1. Arrange-Act-Assert (AAA)
```javascript
it('should calculate total price with tax', () => {
    // Arrange
    const items = [
        { price: 10, quantity: 2 },
        { price: 5, quantity: 1 }
    ];
    const taxRate = 0.1;

    // Act
    const total = calculateTotal(items, taxRate);

    // Assert
    expect(total).toBe(27.5); // (20 + 5) * 1.1
});
```

### 2. Given-When-Then (BDD)
```javascript
describe('User Registration', () => {
    describe('Given a new user wants to register', () => {
        describe('When they provide valid information', () => {
            it('Then they should be registered successfully', async () => {
                // Given
                const userData = {
                    email: 'new@user.com',
                    password: 'SecurePass123!',
                    name: 'New User'
                };

                // When
                const result = await userService.register(userData);

                // Then
                expect(result.success).toBe(true);
                expect(result.user.email).toBe(userData.email);
            });
        });
    });
});
```

### 3. Test Data Builders
```javascript
// tests/builders/UserBuilder.js
export class UserBuilder {
    constructor() {
        this.user = {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            active: true
        };
    }

    withEmail(email) {
        this.user.email = email;
        return this;
    }

    withRole(role) {
        this.user.role = role;
        return this;
    }

    inactive() {
        this.user.active = false;
        return this;
    }

    build() {
        return { ...this.user };
    }
}

// Usage in tests
import { UserBuilder } from '../builders/UserBuilder.js';

it('should not allow inactive admin users', () => {
    const user = new UserBuilder()
        .withRole('admin')
        .inactive()
        .build();

    expect(() => validateUser(user)).toThrow('Inactive admin not allowed');
});
```

## 🚀 Advanced Testing Techniques

### 1. Snapshot Testing
```javascript
it('should render chat message correctly', () => {
    const message = {
        id: '123',
        text: 'Hello World',
        timestamp: 1234567890,
        user: 'testuser'
    };

    const rendered = renderMessage(message);
    expect(rendered).toMatchSnapshot();
});
```

### 2. Property-Based Testing
```javascript
import fc from 'fast-check';

describe('Message Validation', () => {
    it('should validate any non-empty string as message', () => {
        fc.assert(fc.property(
            fc.string({ minLength: 1 }),
            (message) => {
                const result = validateMessage(message);
                expect(result.valid).toBe(true);
            }
        ));
    });
});
```

### 3. Async Testing
```javascript
describe('Async Operations', () => {
    it('should handle promise resolution', async () => {
        const result = await asyncFunction();
        expect(result).toBe('expected');
    });

    it('should handle promise rejection', async () => {
        await expect(failingAsyncFunction()).rejects.toThrow('Error message');
    });

    it('should timeout long operations', async () => {
        jest.setTimeout(5000);
        await expect(longRunningOperation()).resolves.toBeDefined();
    }, 10000);
});
```

## 🎯 Testing Best Practices

### 1. Test Naming
```javascript
// ❌ Bad
it('test user', () => {});

// ✅ Good
it('should create user with valid email and password', () => {});
it('should throw error when email is invalid', () => {});
it('should return null when user not found', () => {});
```

### 2. Test Organization
```javascript
describe('UserService', () => {
    describe('register', () => {
        describe('with valid data', () => {
            it('should create user successfully', () => {});
            it('should hash password', () => {});
            it('should send welcome email', () => {});
        });

        describe('with invalid data', () => {
            it('should reject invalid email', () => {});
            it('should reject weak password', () => {});
        });
    });
});
```

### 3. Test Data Management
```javascript
// ❌ Bad - Magic numbers/strings
expect(user.age).toBe(25);
expect(user.email).toBe('test@example.com');

// ✅ Good - Named constants
const VALID_AGE = 25;
const VALID_EMAIL = 'test@example.com';

expect(user.age).toBe(VALID_AGE);
expect(user.email).toBe(VALID_EMAIL);
```

### 4. Error Testing
```javascript
describe('Error Handling', () => {
    it('should throw specific error for invalid input', () => {
        expect(() => {
            processData(null);
        }).toThrow('Input cannot be null');
    });

    it('should handle async errors', async () => {
        await expect(asyncOperation()).rejects.toMatchObject({
            message: 'Operation failed',
            code: 'OP_FAILED'
        });
    });
});
```

## 📈 Coverage Guidelines

### Coverage Targets
- **Critical Code**: 90%+ (auth, payments, security)
- **Business Logic**: 80%+ (core features)
- **Utilities**: 70%+ (helpers, formatters)
- **UI Components**: 60%+ (presentational)

### Coverage Analysis
```bash
# Generate detailed coverage
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html

# Check specific file coverage
npm run test:coverage -- --collectCoverageFrom="src/core/ChatBot.js"
```

### Improving Coverage
1. **Identify uncovered lines**: Use coverage report
2. **Add missing tests**: Focus on edge cases
3. **Test error paths**: Don't forget error handling
4. **Test all branches**: If/else, switch cases

## 🔧 Debugging Tests

### 1. Debug with VS Code
```json
{
    "type": "node",
    "request": "launch",
    "name": "Debug Jest Tests",
    "program": "${workspaceFolder}/node_modules/.bin/jest",
    "args": ["--runInBand", "--no-cache"],
    "console": "integratedTerminal"
}
```

### 2. Debug Specific Test
```bash
# Debug single test
node --inspect-brk node_modules/.bin/jest --runInBand tests/specific.test.js

# Debug with Chrome DevTools
node --inspect node_modules/.bin/jest --runInBand
```

### 3. Logging in Tests
```javascript
// Use console.log sparingly
console.log('Debug value:', value);

// Better: Use expect for debugging
expect(actualValue).toEqual(expectedValue);

// Or use custom matchers
expect(response).toHaveProperty('data.user.id');
```

## 📚 Resources

### Documentation
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)

### Books
- "The Art of Unit Testing" by Roy Osherove
- "Test Driven Development" by Kent Beck
- "Growing Object-Oriented Software, Guided by Tests"

### Tools
- **Jest**: Test runner and framework
- **Playwright**: E2E testing
- **Nock**: HTTP mocking
- **Fast-check**: Property-based testing
- **Coverage Gutters**: VS Code extension

---

**Remember**: Good tests are your safety net. Write them with care! 🛡️