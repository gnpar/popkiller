const server = require('./popkiller');

['SIGINT', 'SIGTERM', 'uncaughtException'].forEach((signal) => {
  process.on(signal, () => {
    console.log('Exit. Cause: %s', signal);
    server.stop();
  });
});

server.start().catch(e => process.exit(1));
