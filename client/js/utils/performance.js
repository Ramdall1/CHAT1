// Performance Utils - Utils version
console.log('Performance utils (utils) loaded');

// Performance monitoring utilities
window.PerformanceUtils = {
    // Measure page load time
    measurePageLoad: function() {
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            console.log('Page load time:', loadTime + 'ms');
            return loadTime;
        }
        return null;
    },
    
    // Measure function execution time
    measureFunction: function(fn, name = 'function') {
        return function(...args) {
            const start = performance.now();
            const result = fn.apply(this, args);
            const end = performance.now();
            console.log(`${name} execution time:`, (end - start) + 'ms');
            return result;
        };
    },
    
    // Monitor memory usage
    getMemoryUsage: function() {
        if (window.performance && window.performance.memory) {
            return {
                used: window.performance.memory.usedJSHeapSize,
                total: window.performance.memory.totalJSHeapSize,
                limit: window.performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
};