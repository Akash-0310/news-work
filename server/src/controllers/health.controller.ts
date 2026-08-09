import type { Request, Response } from 'express';
import { getHealthReport, healthStatusCode } from '../services/health.service.js';
import { getMetricsSnapshot } from '../services/metrics.service.js';

/**
 * GET /health
 *
 * Full dependency report. Returns 503 only when the API genuinely cannot serve data.
 * Note this bypasses the success envelope: health endpoints are consumed by
 * orchestrators and uptime checks that expect a flat, stable document.
 */
export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const report = await getHealthReport();
  res.status(healthStatusCode(report)).json(report);
};

/**
 * GET /health/live
 *
 * Liveness only: is the process running and able to answer? Never touches a
 * dependency, so a database blip cannot cause an orchestrator to kill healthy pods.
 */
export const getLiveness = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
};

/**
 * GET /health/metrics
 *
 * Process-local counters and latency percentiles for the admin dashboard.
 */
export const getMetrics = (_req: Request, res: Response): void => {
  res.status(200).json(getMetricsSnapshot());
};
