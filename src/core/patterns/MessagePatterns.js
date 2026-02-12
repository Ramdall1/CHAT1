/**
 * MessagePatterns - Sistema de reconocimiento de patrones en mensajes
 * Proporciona funcionalidades para identificar intenciones, entidades y contexto
 */

import { EventEmitter } from 'events';

class MessagePatterns extends EventEmitter {
    constructor(options = {}) {
        super();
        this.patterns = new Map();
        this.intentClassifiers = new Map();
        this.entityExtractors = new Map();
        this.contextAnalyzers = new Map();
        this.options = {
            enableFuzzyMatching: options.enableFuzzyMatching !== false,
            fuzzyThreshold: options.fuzzyThreshold || 0.8,
            enableLearning: options.enableLearning !== false,
            maxPatterns: options.maxPatterns || 1000,
            ...options
        };
        
        this.setupDefaultPatterns();
        this.setupDefaultClassifiers();
        this.setupDefaultExtractors();
    }

    /**
     * Analiza un mensaje y extrae patrones, intenciones y entidades
     */
    async analyzeMessage(message, context = {}) {
        const analysis = {
            message: message.content || message,
            timestamp: new Date(),
            patterns: [],
            intents: [],
            entities: [],
            context: {},
            confidence: 0,
            metadata: {}
        };

        try {
            // Detectar patrones
            analysis.patterns = await this.detectPatterns(analysis.message, context);
            
            // Clasificar intenciones
            analysis.intents = await this.classifyIntents(analysis.message, context);
            
            // Extraer entidades
            analysis.entities = await this.extractEntities(analysis.message, context);
            
            // Analizar contexto
            analysis.context = await this.analyzeContext(analysis.message, context);
            
            // Calcular confianza general
            analysis.confidence = this.calculateOverallConfidence(analysis);
            
            // Agregar metadata
            analysis.metadata = this.generateMetadata(analysis, context);
            
            this.emit('messageAnalyzed', analysis);
            
            return analysis;
            
        } catch (error) {
            this.emit('analysisError', { message: analysis.message, error, context });
            throw error;
        }
    }

    /**
     * Detecta patrones en el mensaje
     */
    async detectPatterns(message, context) {
        const detectedPatterns = [];
        const normalizedMessage = this.normalizeMessage(message);
        
        for (const [name, pattern] of this.patterns) {
            try {
                const match = await this.matchPattern(normalizedMessage, pattern, context);
                if (match) {
                    detectedPatterns.push({
                        name,
                        confidence: match.confidence,
                        matches: match.matches,
                        metadata: match.metadata
                    });
                }
            } catch (error) {
                this.emit('patternError', { pattern: name, error, message });
            }
        }
        
        return detectedPatterns.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Clasifica intenciones del mensaje
     */
    async classifyIntents(message, context) {
        const intents = [];
        const normalizedMessage = this.normalizeMessage(message);
        
        for (const [name, classifier] of this.intentClassifiers) {
            try {
                const result = await classifier.classify(normalizedMessage, context);
                if (result && result.confidence > 0.3) {
                    intents.push({
                        intent: name,
                        confidence: result.confidence,
                        parameters: result.parameters || {},
                        metadata: result.metadata || {}
                    });
                }
            } catch (error) {
                this.emit('classificationError', { classifier: name, error, message });
            }
        }
        
        return intents.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Extrae entidades del mensaje
     */
    async extractEntities(message, context) {
        const entities = [];
        const normalizedMessage = this.normalizeMessage(message);
        
        for (const [type, extractor] of this.entityExtractors) {
            try {
                const extracted = await extractor.extract(normalizedMessage, context);
                if (extracted && extracted.length > 0) {
                    entities.push(...extracted.map(entity => ({
                        type,
                        value: entity.value,
                        confidence: entity.confidence || 1.0,
                        position: entity.position || { start: 0, end: 0 },
                        metadata: entity.metadata || {}
                    })));
                }
            } catch (error) {
                this.emit('extractionError', { extractor: type, error, message });
            }
        }
        
        return entities.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Analiza el contexto del mensaje
     */
    async analyzeContext(message, context) {
        const contextAnalysis = {
            sentiment: null,
            urgency: null,
            topic: null,
            language: null,
            formality: null
        };
        
        for (const [name, analyzer] of this.contextAnalyzers) {
            try {
                const result = await analyzer.analyze(message, context);
                if (result) {
                    contextAnalysis[name] = result;
                }
            } catch (error) {
                this.emit('contextError', { analyzer: name, error, message });
            }
        }
        
        return contextAnalysis;
    }

    /**
     * Registra un nuevo patrón
     */
    registerPattern(name, pattern) {
        if (this.patterns.size >= this.options.maxPatterns) {
            throw new Error('Maximum number of patterns reached');
        }
        
        this.patterns.set(name, {
            ...pattern,
            createdAt: new Date(),
            usageCount: 0
        });
        
        this.emit('patternRegistered', { name, pattern });
    }

    /**
     * Registra un clasificador de intenciones
     */
    registerIntentClassifier(name, classifier) {
        this.intentClassifiers.set(name, classifier);
        this.emit('classifierRegistered', { name, classifier });
    }

    /**
     * Registra un extractor de entidades
     */
    registerEntityExtractor(type, extractor) {
        this.entityExtractors.set(type, extractor);
        this.emit('extractorRegistered', { type, extractor });
    }

    /**
     * Registra un analizador de contexto
     */
    registerContextAnalyzer(name, analyzer) {
        this.contextAnalyzers.set(name, analyzer);
        this.emit('analyzerRegistered', { name, analyzer });
    }

    /**
     * Normaliza el mensaje para procesamiento
     */
    normalizeMessage(message) {
        return message
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-_.]/g, '');
    }

    /**
     * Hace match de un patrón con el mensaje
     */
    async matchPattern(message, pattern, context) {
        let confidence = 0;
        let matches = [];
        let metadata = {};
        
        if (pattern.regex) {
            const regexMatch = message.match(pattern.regex);
            if (regexMatch) {
                confidence = 1.0;
                matches = regexMatch;
                metadata.type = 'regex';
            }
        }
        
        if (pattern.keywords && confidence === 0) {
            const keywordMatch = this.matchKeywords(message, pattern.keywords);
            if (keywordMatch.score > 0) {
                confidence = keywordMatch.score;
                matches = keywordMatch.matches;
                metadata.type = 'keywords';
            }
        }
        
        if (pattern.fuzzy && this.options.enableFuzzyMatching && confidence === 0) {
            const fuzzyMatch = this.fuzzyMatch(message, pattern.fuzzy);
            if (fuzzyMatch.score >= this.options.fuzzyThreshold) {
                confidence = fuzzyMatch.score;
                matches = [fuzzyMatch.match];
                metadata.type = 'fuzzy';
            }
        }
        
        if (confidence > 0) {
            pattern.usageCount++;
            return { confidence, matches, metadata };
        }
        
        return null;
    }

    /**
     * Hace match de palabras clave
     */
    matchKeywords(message, keywords) {
        const words = message.split(' ');
        const matches = [];
        let score = 0;
        
        for (const keyword of keywords) {
            if (words.includes(keyword.toLowerCase())) {
                matches.push(keyword);
                score += 1 / keywords.length;
            }
        }
        
        return { score, matches };
    }

    /**
     * Realiza matching difuso
     */
    fuzzyMatch(message, target) {
        const distance = this.levenshteinDistance(message, target);
        const maxLength = Math.max(message.length, target.length);
        const score = 1 - (distance / maxLength);
        
        return { score, match: target };
    }

    /**
     * Calcula la distancia de Levenshtein
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Calcula la confianza general del análisis
     */
    calculateOverallConfidence(analysis) {
        let totalConfidence = 0;
        let count = 0;
        
        if (analysis.patterns.length > 0) {
            totalConfidence += analysis.patterns[0].confidence;
            count++;
        }
        
        if (analysis.intents.length > 0) {
            totalConfidence += analysis.intents[0].confidence;
            count++;
        }
        
        if (analysis.entities.length > 0) {
            const avgEntityConfidence = analysis.entities.reduce((sum, entity) => 
                sum + entity.confidence, 0) / analysis.entities.length;
            totalConfidence += avgEntityConfidence;
            count++;
        }
        
        return count > 0 ? totalConfidence / count : 0;
    }

    /**
     * Genera metadata del análisis
     */
    generateMetadata(analysis, context) {
        return {
            processingTime: Date.now() - analysis.timestamp.getTime(),
            patternCount: analysis.patterns.length,
            intentCount: analysis.intents.length,
            entityCount: analysis.entities.length,
            messageLength: analysis.message.length,
            wordCount: analysis.message.split(' ').length,
            context: context.sessionId || null
        };
    }

    /**
     * Configura patrones por defecto
     */
    setupDefaultPatterns() {
        // Saludos
        this.registerPattern('greeting', {
            keywords: ['hola', 'buenos', 'buenas', 'saludos', 'hey'],
            regex: /^(hola|buenos|buenas|saludos|hey)/i
        });
        
        // Despedidas
        this.registerPattern('farewell', {
            keywords: ['adiós', 'hasta', 'nos vemos', 'chau', 'bye'],
            regex: /(adiós|hasta|nos vemos|chau|bye)/i
        });
        
        // Preguntas
        this.registerPattern('question', {
            keywords: ['qué', 'cómo', 'cuándo', 'dónde', 'por qué', 'quién'],
            regex: /^(qué|cómo|cuándo|dónde|por qué|quién)/i
        });
        
        // Comandos
        this.registerPattern('command', {
            regex: /^\/\w+/
        });
    }

    /**
     * Configura clasificadores por defecto
     */
    setupDefaultClassifiers() {
        // Clasificador de información
        this.registerIntentClassifier('information', {
            classify: async (message, context) => {
                const infoKeywords = ['información', 'datos', 'detalles', 'explicar'];
                const score = this.matchKeywords(message, infoKeywords).score;
                return score > 0 ? { confidence: score } : null;
            }
        });
        
        // Clasificador de ayuda
        this.registerIntentClassifier('help', {
            classify: async (message, context) => {
                const helpKeywords = ['ayuda', 'help', 'asistencia', 'soporte'];
                const score = this.matchKeywords(message, helpKeywords).score;
                return score > 0 ? { confidence: score } : null;
            }
        });
    }

    /**
     * Configura extractores por defecto
     */
    setupDefaultExtractors() {
        // Extractor de números
        this.registerEntityExtractor('number', {
            extract: async (message, context) => {
                const numbers = message.match(/\d+/g);
                return numbers ? numbers.map(num => ({
                    value: parseInt(num),
                    confidence: 1.0
                })) : [];
            }
        });
        
        // Extractor de emails
        this.registerEntityExtractor('email', {
            extract: async (message, context) => {
                const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
                const emails = message.match(emailRegex);
                return emails ? emails.map(email => ({
                    value: email,
                    confidence: 1.0
                })) : [];
            }
        });
    }

    /**
     * Obtiene estadísticas del sistema de patrones
     */
    getStats() {
        const patternStats = {};
        for (const [name, pattern] of this.patterns) {
            patternStats[name] = {
                usageCount: pattern.usageCount,
                createdAt: pattern.createdAt
            };
        }
        
        return {
            patterns: patternStats,
            totalPatterns: this.patterns.size,
            intentClassifiers: this.intentClassifiers.size,
            entityExtractors: this.entityExtractors.size,
            contextAnalyzers: this.contextAnalyzers.size
        };
    }
}

// Instancia singleton
const messagePatterns = new MessagePatterns();

export {
    MessagePatterns,
    messagePatterns
};