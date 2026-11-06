import { verifyEmail } from '../services/verify.service.js';
import { checkDisposable, getDisposableCount } from '../services/disposable.service.js';
import { getDnsCacheStats } from '../services/dns.service.js';

/**
 * Controller for single email validation.
 * POST /v1/verify
 */
export async function verifySingle(req, res, next) {
  try {
    const { email } = req.validatedBody;
    const result = await verifyEmail(email);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for batch email validation (up to 50 emails).
 * POST /v1/verify/batch
 */
export async function verifyBatch(req, res, next) {
  try {
    const startHr = process.hrtime.bigint();
    const { emails } = req.validatedBody;

    // Run verifications concurrently with Promise.allSettled
    const settledResults = await Promise.allSettled(
      emails.map((email) => verifyEmail(email))
    );

    const data = settledResults.map((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        return outcome.value;
      }
      return {
        email: emails[idx],
        error: outcome.reason?.message || 'Verification failed',
        score: 0,
        verdict: 'invalid',
        recommendation: 'block',
      };
    });

    const endHr = process.hrtime.bigint();
    const executionTimeMs = Math.max(1, Number((endHr - startHr) / 1_000_000n));

    return res.status(200).json({
      status: 'success',
      total: data.length,
      data,
      meta: {
        execution_time_ms: executionTimeMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for fast O(1) in-memory disposable domain lookup.
 * GET /v1/disposable/:domain
 */
export async function checkDisposableDomain(req, res, next) {
  try {
    const startHr = process.hrtime.bigint();
    const rawDomain = req.params.domain || '';
    const cleanDomain = rawDomain.toLowerCase().trim();

    const disposableResult = checkDisposable(cleanDomain);

    const endHr = process.hrtime.bigint();
    const executionTimeMs = Number((endHr - startHr) / 1_000_000n);

    return res.status(200).json({
      status: 'success',
      data: {
        domain: cleanDomain,
        is_disposable: disposableResult.is_disposable,
        provider: disposableResult.provider,
      },
      meta: {
        execution_time_ms: executionTimeMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Health check controller for RapidAPI and uptime monitors.
 * GET /health
 */
export function getHealth(req, res) {
  const memory = process.memoryUsage();

  return res.status(200).json({
    status: 'healthy',
    service: 'EmailGuard API',
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    metrics: {
      disposable_domains_loaded: getDisposableCount(),
      dns_cache: getDnsCacheStats(),
      memory_mb: {
        rss: Math.round(memory.rss / (1024 * 1024)),
        heapUsed: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(memory.heapTotal / (1024 * 1024)),
      },
    },
  });
}
