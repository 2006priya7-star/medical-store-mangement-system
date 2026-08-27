const serverless = require('serverless-http');
const app = require('../../server');

const handler = serverless(app);

module.exports.handler = (event, context) => {
  const functionPath = '/.netlify/functions/api';
  if (event.path && event.path.startsWith(functionPath)) {
    event.path = `/api${event.path.slice(functionPath.length)}`;
  }
  return handler(event, context);
};
