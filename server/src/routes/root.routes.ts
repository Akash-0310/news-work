import { Router } from 'express';
import { env } from '../config/env.js';

/**
 * Service descriptor at `/`.
 *
 * Exists because opening the API's port in a browser is the first thing anyone does,
 * and a bare 404 there tells them nothing about whether the server is working. This
 * answers "what is this, and where is the app?" in one response.
 */
export const rootRouter = Router();

rootRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'NewsFlow API',
      version: '0.1.0',
      status: 'running',
      environment: env.NODE_ENV,
      // The most common reason someone lands here: they wanted the web app.
      webApp: env.CLIENT_URL,
      docs: {
        apiIndex: '/api',
        health: '/health',
        metrics: '/health/metrics',
      },
      hint: 'This is the JSON API. The web interface runs separately - see webApp above.',
    },
    message: 'NewsFlow API is running',
  });
});

/**
 * Browsers request /favicon.ico on every page visit. Answering 204 keeps the access log
 * free of 404s that mean nothing. `end()` rather than `json()` because 204 must have
 * no body.
 */
rootRouter.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});
