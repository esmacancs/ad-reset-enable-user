// portal-server.cjs - loads .env exactly like the app, then starts the production standalone server.
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
require('./.next/standalone/server.js');
