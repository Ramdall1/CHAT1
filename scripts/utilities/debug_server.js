// Debug script to capture uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION DETAILS:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('Name:', error.name);
  console.error('Code:', error.code);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION:');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
});

// Import and start the server
console.log('Starting server with debug handlers...');
import('./server.js').catch(error => {
  console.error('🚨 ERROR IMPORTING SERVER:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
});