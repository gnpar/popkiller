const config = {
  server: {
    port: process.env.POPKILLER_PORT || 2525,
    host: process.env.POPKILLER_HOST || 'localhost'
  },
  broker_url: process.env.BROKER_URL || 'amqp://localhost',
  routes: {}
};

if (process.env.POPKILLER_ROUTES) {
  config.routes = JSON.parse(process.env.POPKILLER_ROUTES);
}

module.exports = config;
