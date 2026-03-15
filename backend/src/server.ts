import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  app.log.info(`API running on ${env.HOST}:${env.PORT}`);
});
