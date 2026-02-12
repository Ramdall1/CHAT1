/**
 * Scoring System Configuration
 * Sistema de puntuación y evaluación de interacciones
 */

/**
 * Configuración del sistema de scoring
 */
export const ScoringConfig = {
    // Configuración general
    enabled: true,
    version: '1.0.0',
    
    // Pesos para diferentes tipos de interacciones
    weights: {
        messageResponse: 1.0,
        userEngagement: 2.0,
        taskCompletion: 3.0,
        errorHandling: -1.0,
        responseTime: 1.5,
        userSatisfaction: 4.0,
        conversationFlow: 2.5,
        contextUnderstanding: 3.5
    },
    
    // Rangos de puntuación
    ranges: {
        excellent: { min: 90, max: 100, label: 'Excelente' },
        good: { min: 70, max: 89, label: 'Bueno' },
        average: { min: 50, max: 69, label: 'Promedio' },
        poor: { min: 30, max: 49, label: 'Deficiente' },
        critical: { min: 0, max: 29, label: 'Crítico' }
    },
    
    // Métricas de evaluación
    metrics: {
        responseAccuracy: {
            weight: 0.25,
            description: 'Precisión de las respuestas',
            calculation: 'percentage'
        },
        responseTime: {
            weight: 0.15,
            description: 'Tiempo de respuesta',
            calculation: 'inverse_time',
            thresholds: {
                excellent: 1000,  // < 1s
                good: 3000,       // < 3s
                average: 5000,    // < 5s
                poor: 10000       // < 10s
            }
        },
        userEngagement: {
            weight: 0.20,
            description: 'Nivel de engagement del usuario',
            calculation: 'engagement_score'
        },
        conversationFlow: {
            weight: 0.15,
            description: 'Fluidez de la conversación',
            calculation: 'flow_analysis'
        },
        taskSuccess: {
            weight: 0.25,
            description: 'Éxito en completar tareas',
            calculation: 'success_rate'
        }
    },
    
    // Configuración de penalizaciones
    penalties: {
        errors: {
            syntax: -5,
            logic: -10,
            critical: -25,
            timeout: -15
        },
        userExperience: {
            confusion: -8,
            frustration: -12,
            abandonment: -20
        }
    },
    
    // Bonificaciones
    bonuses: {
        quickResponse: 5,
        perfectAccuracy: 10,
        userSatisfaction: 15,
        innovativeSolution: 8
    }
};

/**
 * Clase principal del sistema de scoring
 */
export class ScoringSystem {
    constructor(config = ScoringConfig) {
        this.config = config;
        this.sessions = new Map();
        this.globalStats = {
            totalInteractions: 0,
            averageScore: 0,
            totalScore: 0,
            bestScore: 0,
            worstScore: 100
        };
    }

    /**
     * Inicia una nueva sesión de scoring
     * @param {string} sessionId - ID de la sesión
     * @param {object} context - Contexto inicial
     * @returns {object} Sesión creada
     */
    startSession(sessionId, context = {}) {
        const session = {
            id: sessionId,
            startTime: new Date(),
            context,
            interactions: [],
            currentScore: 0,
            metrics: {
                responseAccuracy: 0,
                responseTime: 0,
                userEngagement: 0,
                conversationFlow: 0,
                taskSuccess: 0
            },
            penalties: 0,
            bonuses: 0,
            status: 'active'
        };
        
        this.sessions.set(sessionId, session);
        return session;
    }

    /**
     * Registra una interacción y calcula el score
     * @param {string} sessionId - ID de la sesión
     * @param {object} interaction - Datos de la interacción
     * @returns {object} Resultado del scoring
     */
    scoreInteraction(sessionId, interaction) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        // Preparar datos de la interacción
        const interactionData = {
            id: this.generateId(),
            timestamp: new Date(),
            type: interaction.type || 'message',
            input: interaction.input,
            output: interaction.output,
            responseTime: interaction.responseTime || 0,
            success: interaction.success !== false,
            userFeedback: interaction.userFeedback,
            context: interaction.context || {},
            rawScore: 0,
            adjustedScore: 0,
            breakdown: {}
        };
        
        // Calcular score base
        const baseScore = this.calculateBaseScore(interactionData);
        interactionData.rawScore = baseScore;
        
        // Aplicar ajustes
        const adjustments = this.calculateAdjustments(interactionData, session);
        interactionData.adjustedScore = Math.max(0, Math.min(100, baseScore + adjustments.total));
        interactionData.breakdown = adjustments.breakdown;
        
        // Actualizar sesión
        session.interactions.push(interactionData);
        this.updateSessionMetrics(session);
        
        // Actualizar estadísticas globales
        this.updateGlobalStats(interactionData.adjustedScore);
        
        return {
            interactionId: interactionData.id,
            score: interactionData.adjustedScore,
            breakdown: interactionData.breakdown,
            sessionScore: session.currentScore,
            recommendations: this.generateRecommendations(interactionData, session)
        };
    }

    /**
     * Calcula el score base de una interacción
     * @param {object} interaction - Datos de la interacción
     * @returns {number} Score base
     */
    calculateBaseScore(interaction) {
        let score = 50; // Score base
        
        // Evaluar éxito de la tarea
        if (interaction.success) {
            score += 30;
        } else {
            score -= 20;
        }
        
        // Evaluar tiempo de respuesta
        const responseTimeScore = this.calculateResponseTimeScore(interaction.responseTime);
        score += responseTimeScore;
        
        // Evaluar feedback del usuario si existe
        if (interaction.userFeedback) {
            const feedbackScore = this.calculateFeedbackScore(interaction.userFeedback);
            score += feedbackScore;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calcula score basado en tiempo de respuesta
     * @param {number} responseTime - Tiempo en milisegundos
     * @returns {number} Score del tiempo de respuesta
     */
    calculateResponseTimeScore(responseTime) {
        const thresholds = this.config.metrics.responseTime.thresholds;
        
        if (responseTime <= thresholds.excellent) return 20;
        if (responseTime <= thresholds.good) return 15;
        if (responseTime <= thresholds.average) return 10;
        if (responseTime <= thresholds.poor) return 5;
        return -10; // Muy lento
    }

    /**
     * Calcula score basado en feedback del usuario
     * @param {object} feedback - Feedback del usuario
     * @returns {number} Score del feedback
     */
    calculateFeedbackScore(feedback) {
        if (typeof feedback === 'number') {
            // Feedback numérico (1-5)
            return (feedback - 3) * 10; // -20 a +20
        }
        
        if (typeof feedback === 'object') {
            let score = 0;
            
            if (feedback.helpful === true) score += 15;
            if (feedback.helpful === false) score -= 15;
            
            if (feedback.accurate === true) score += 10;
            if (feedback.accurate === false) score -= 10;
            
            if (feedback.satisfied === true) score += 20;
            if (feedback.satisfied === false) score -= 20;
            
            return score;
        }
        
        return 0;
    }

    /**
     * Calcula ajustes al score (penalizaciones y bonificaciones)
     * @param {object} interaction - Datos de la interacción
     * @param {object} session - Sesión actual
     * @returns {object} Ajustes calculados
     */
    calculateAdjustments(interaction, session) {
        const adjustments = {
            penalties: 0,
            bonuses: 0,
            breakdown: {
                penalties: [],
                bonuses: []
            }
        };
        
        // Penalizaciones por errores
        if (interaction.context.errors) {
            for (const error of interaction.context.errors) {
                const penalty = this.config.penalties.errors[error.type] || -5;
                adjustments.penalties += penalty;
                adjustments.breakdown.penalties.push({
                    type: error.type,
                    value: penalty,
                    description: `Error: ${error.type}`
                });
            }
        }
        
        // Bonificaciones por respuesta rápida
        if (interaction.responseTime < this.config.metrics.responseTime.thresholds.excellent) {
            const bonus = this.config.bonuses.quickResponse;
            adjustments.bonuses += bonus;
            adjustments.breakdown.bonuses.push({
                type: 'quickResponse',
                value: bonus,
                description: 'Respuesta rápida'
            });
        }
        
        // Bonificación por precisión perfecta
        if (interaction.success && interaction.userFeedback && interaction.userFeedback.accurate === true) {
            const bonus = this.config.bonuses.perfectAccuracy;
            adjustments.bonuses += bonus;
            adjustments.breakdown.bonuses.push({
                type: 'perfectAccuracy',
                value: bonus,
                description: 'Precisión perfecta'
            });
        }
        
        // Bonificación por satisfacción del usuario
        if (interaction.userFeedback && interaction.userFeedback.satisfied === true) {
            const bonus = this.config.bonuses.userSatisfaction;
            adjustments.bonuses += bonus;
            adjustments.breakdown.bonuses.push({
                type: 'userSatisfaction',
                value: bonus,
                description: 'Usuario satisfecho'
            });
        }
        
        adjustments.total = adjustments.bonuses + adjustments.penalties;
        
        return adjustments;
    }

    /**
     * Actualiza métricas de la sesión
     * @param {object} session - Sesión a actualizar
     */
    updateSessionMetrics(session) {
        const interactions = session.interactions;
        const totalInteractions = interactions.length;
        
        if (totalInteractions === 0) return;
        
        // Calcular score promedio de la sesión
        const totalScore = interactions.reduce((sum, int) => sum + int.adjustedScore, 0);
        session.currentScore = totalScore / totalInteractions;
        
        // Actualizar métricas específicas
        session.metrics.responseAccuracy = this.calculateAccuracyMetric(interactions);
        session.metrics.responseTime = this.calculateResponseTimeMetric(interactions);
        session.metrics.userEngagement = this.calculateEngagementMetric(interactions);
        session.metrics.conversationFlow = this.calculateFlowMetric(interactions);
        session.metrics.taskSuccess = this.calculateSuccessMetric(interactions);
    }

    /**
     * Calcula métrica de precisión
     * @param {array} interactions - Lista de interacciones
     * @returns {number} Métrica de precisión
     */
    calculateAccuracyMetric(interactions) {
        const successfulInteractions = interactions.filter(int => int.success).length;
        return (successfulInteractions / interactions.length) * 100;
    }

    /**
     * Calcula métrica de tiempo de respuesta
     * @param {array} interactions - Lista de interacciones
     * @returns {number} Métrica de tiempo de respuesta
     */
    calculateResponseTimeMetric(interactions) {
        const avgResponseTime = interactions.reduce((sum, int) => sum + int.responseTime, 0) / interactions.length;
        const thresholds = this.config.metrics.responseTime.thresholds;
        
        if (avgResponseTime <= thresholds.excellent) return 100;
        if (avgResponseTime <= thresholds.good) return 80;
        if (avgResponseTime <= thresholds.average) return 60;
        if (avgResponseTime <= thresholds.poor) return 40;
        return 20;
    }

    /**
     * Calcula métrica de engagement
     * @param {array} interactions - Lista de interacciones
     * @returns {number} Métrica de engagement
     */
    calculateEngagementMetric(interactions) {
        // Basado en la frecuencia y calidad de las interacciones
        const recentInteractions = interactions.slice(-10); // Últimas 10 interacciones
        const avgScore = recentInteractions.reduce((sum, int) => sum + int.adjustedScore, 0) / recentInteractions.length;
        
        return Math.min(100, avgScore + (recentInteractions.length * 2));
    }

    /**
     * Calcula métrica de fluidez de conversación
     * @param {array} interactions - Lista de interacciones
     * @returns {number} Métrica de fluidez
     */
    calculateFlowMetric(interactions) {
        if (interactions.length < 2) return 50;
        
        let flowScore = 50;
        
        // Analizar transiciones entre interacciones
        for (let i = 1; i < interactions.length; i++) {
            const prev = interactions[i - 1];
            const current = interactions[i];
            
            // Penalizar interrupciones largas
            const timeDiff = current.timestamp - prev.timestamp;
            if (timeDiff > 300000) { // 5 minutos
                flowScore -= 10;
            } else if (timeDiff < 1000) { // Muy rápido
                flowScore += 5;
            }
            
            // Bonificar continuidad temática (simplificado)
            if (current.success && prev.success) {
                flowScore += 2;
            }
        }
        
        return Math.max(0, Math.min(100, flowScore));
    }

    /**
     * Calcula métrica de éxito en tareas
     * @param {array} interactions - Lista de interacciones
     * @returns {number} Métrica de éxito
     */
    calculateSuccessMetric(interactions) {
        const taskInteractions = interactions.filter(int => int.type === 'task' || int.type === 'command');
        
        if (taskInteractions.length === 0) return 50;
        
        const successfulTasks = taskInteractions.filter(int => int.success).length;
        return (successfulTasks / taskInteractions.length) * 100;
    }

    /**
     * Actualiza estadísticas globales
     * @param {number} score - Score de la interacción
     */
    updateGlobalStats(score) {
        this.globalStats.totalInteractions++;
        this.globalStats.totalScore += score;
        this.globalStats.averageScore = this.globalStats.totalScore / this.globalStats.totalInteractions;
        
        if (score > this.globalStats.bestScore) {
            this.globalStats.bestScore = score;
        }
        
        if (score < this.globalStats.worstScore) {
            this.globalStats.worstScore = score;
        }
    }

    /**
     * Genera recomendaciones basadas en el performance
     * @param {object} interaction - Interacción actual
     * @param {object} session - Sesión actual
     * @returns {array} Lista de recomendaciones
     */
    generateRecommendations(interaction, session) {
        const recommendations = [];
        
        // Recomendaciones basadas en tiempo de respuesta
        if (interaction.responseTime > this.config.metrics.responseTime.thresholds.poor) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Optimizar tiempo de respuesta - considerar caché o procesamiento asíncrono',
                metric: 'responseTime',
                currentValue: interaction.responseTime,
                targetValue: this.config.metrics.responseTime.thresholds.good
            });
        }
        
        // Recomendaciones basadas en precisión
        if (session.metrics.responseAccuracy < 70) {
            recommendations.push({
                type: 'accuracy',
                priority: 'high',
                message: 'Mejorar precisión de respuestas - revisar entrenamiento del modelo',
                metric: 'accuracy',
                currentValue: session.metrics.responseAccuracy,
                targetValue: 85
            });
        }
        
        // Recomendaciones basadas en engagement
        if (session.metrics.userEngagement < 60) {
            recommendations.push({
                type: 'engagement',
                priority: 'medium',
                message: 'Incrementar engagement - personalizar respuestas y mejorar interactividad',
                metric: 'engagement',
                currentValue: session.metrics.userEngagement,
                targetValue: 75
            });
        }
        
        // Recomendaciones basadas en errores
        if (interaction.context.errors && interaction.context.errors.length > 0) {
            recommendations.push({
                type: 'error_handling',
                priority: 'high',
                message: 'Mejorar manejo de errores - implementar validaciones adicionales',
                metric: 'errors',
                currentValue: interaction.context.errors.length,
                targetValue: 0
            });
        }
        
        return recommendations;
    }

    /**
     * Finaliza una sesión de scoring
     * @param {string} sessionId - ID de la sesión
     * @returns {object} Resumen final de la sesión
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        session.status = 'completed';
        session.endTime = new Date();
        session.duration = session.endTime - session.startTime;
        
        // Generar resumen final
        const summary = {
            sessionId,
            duration: session.duration,
            totalInteractions: session.interactions.length,
            finalScore: session.currentScore,
            scoreRange: this.getScoreRange(session.currentScore),
            metrics: session.metrics,
            topInteractions: this.getTopInteractions(session.interactions, 5),
            worstInteractions: this.getWorstInteractions(session.interactions, 3),
            recommendations: this.generateSessionRecommendations(session)
        };
        
        return summary;
    }

    /**
     * Obtiene el rango de score
     * @param {number} score - Score a evaluar
     * @returns {object} Rango del score
     */
    getScoreRange(score) {
        for (const [range, config] of Object.entries(this.config.ranges)) {
            if (score >= config.min && score <= config.max) {
                return { range, ...config };
            }
        }
        
        return { range: 'unknown', min: 0, max: 0, label: 'Desconocido' };
    }

    /**
     * Obtiene las mejores interacciones
     * @param {array} interactions - Lista de interacciones
     * @param {number} limit - Límite de resultados
     * @returns {array} Mejores interacciones
     */
    getTopInteractions(interactions, limit = 5) {
        return interactions
            .sort((a, b) => b.adjustedScore - a.adjustedScore)
            .slice(0, limit)
            .map(int => ({
                id: int.id,
                score: int.adjustedScore,
                type: int.type,
                timestamp: int.timestamp
            }));
    }

    /**
     * Obtiene las peores interacciones
     * @param {array} interactions - Lista de interacciones
     * @param {number} limit - Límite de resultados
     * @returns {array} Peores interacciones
     */
    getWorstInteractions(interactions, limit = 3) {
        return interactions
            .sort((a, b) => a.adjustedScore - b.adjustedScore)
            .slice(0, limit)
            .map(int => ({
                id: int.id,
                score: int.adjustedScore,
                type: int.type,
                timestamp: int.timestamp,
                issues: int.breakdown.penalties || []
            }));
    }

    /**
     * Genera recomendaciones para toda la sesión
     * @param {object} session - Sesión completa
     * @returns {array} Recomendaciones de la sesión
     */
    generateSessionRecommendations(session) {
        const recommendations = [];
        
        // Análisis general de la sesión
        if (session.currentScore < 50) {
            recommendations.push({
                type: 'critical',
                message: 'Performance general crítico - requiere revisión inmediata del sistema',
                priority: 'critical'
            });
        } else if (session.currentScore < 70) {
            recommendations.push({
                type: 'improvement',
                message: 'Performance por debajo del promedio - implementar mejoras',
                priority: 'high'
            });
        }
        
        // Recomendaciones específicas por métrica
        Object.entries(session.metrics).forEach(([metric, value]) => {
            if (value < 60) {
                recommendations.push({
                    type: 'metric_improvement',
                    message: `Mejorar ${metric}: ${value.toFixed(1)}% está por debajo del objetivo`,
                    metric,
                    currentValue: value,
                    priority: value < 40 ? 'high' : 'medium'
                });
            }
        });
        
        return recommendations;
    }

    /**
     * Obtiene estadísticas globales
     * @returns {object} Estadísticas globales
     */
    getGlobalStats() {
        return {
            ...this.globalStats,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            totalSessions: this.sessions.size
        };
    }

    /**
     * Genera ID único
     * @returns {string} ID único
     */
    generateId() {
        return `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Exporta datos de scoring
     * @param {string} sessionId - ID de sesión (opcional)
     * @returns {object} Datos exportados
     */
    exportData(sessionId = null) {
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            return session ? { session, config: this.config } : null;
        }
        
        return {
            config: this.config,
            globalStats: this.globalStats,
            sessions: Array.from(this.sessions.values()),
            exportedAt: new Date()
        };
    }
}

// Instancia singleton del sistema de scoring
const scoringSystem = new ScoringSystem();

export default scoringSystem;