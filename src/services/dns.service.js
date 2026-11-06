import dns from 'node:dns/promises';

// In-memory DNS cache to achieve sub-millisecond responses on repeated queries
// Key: domain, Value: { data, expiresAt }
const dnsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const MAX_CACHE_ENTRIES = 10000;
const DNS_TIMEOUT_MS = 800; // Strict 800ms limit to maintain low API latency

/**
 * Executes a promise with a hard timeout.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} errorMsg
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, errorMsg) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Resolves MX records for a domain with strict timeout and fallback to A records.
 *
 * @param {string} domain
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=800]
 * @returns {Promise<{
 *   has_mx_records: boolean,
 *   mx_host: string | null,
 *   records?: Array<{ exchange: string, priority: number }>,
 *   has_a_records?: boolean,
 *   cached?: boolean
 * }>}
 */
export async function resolveMxWithFallback(domain, options = {}) {
  if (!domain || typeof domain !== 'string') {
    return {
      has_mx_records: false,
      mx_host: null,
    };
  }

  const cleanDomain = domain.toLowerCase().trim();

  // Check in-memory cache
  const cached = dnsCache.get(cleanDomain);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return {
      ...cached.data,
      cached: true,
    };
  }

  const timeoutMs = options.timeoutMs || DNS_TIMEOUT_MS;

  try {
    // 1. Attempt MX lookup with strict timeout
    const mxRecords = await withTimeout(
      dns.resolveMx(cleanDomain),
      timeoutMs,
      `DNS MX query timed out after ${timeoutMs}ms`
    );

    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      // Sort by priority ascending (lowest number = highest priority)
      mxRecords.sort((a, b) => a.priority - b.priority);
      const primaryHost = mxRecords[0].exchange.toLowerCase();

      const result = {
        has_mx_records: true,
        mx_host: primaryHost,
        records: mxRecords,
      };

      saveToCache(cleanDomain, result);
      return result;
    }
  } catch (mxError) {
    // MX lookup failed (ENOTFOUND, ENODATA, timeout, etc.)
    // Proceed to Fallback A record lookup per RFC 5321 (Section 5.1)
  }

  // 2. Fallback to DNS A records (address lookup)
  try {
    const remainingTime = Math.max(200, timeoutMs / 2);
    const aRecords = await withTimeout(
      dns.resolve4(cleanDomain),
      remainingTime,
      `DNS A query timed out`
    );

    if (Array.isArray(aRecords) && aRecords.length > 0) {
      // Domain has A records (fallback routing possible), but strictly no MX
      const result = {
        has_mx_records: false,
        mx_host: null,
        has_a_records: true,
      };
      saveToCache(cleanDomain, result);
      return result;
    }
  } catch (aError) {
    // Domain does not resolve via A record either
  }

  const fallbackResult = {
    has_mx_records: false,
    mx_host: null,
    has_a_records: false,
  };

  saveToCache(cleanDomain, fallbackResult);
  return fallbackResult;
}

/**
 * Saves DNS query result to in-memory TTL cache.
 */
function saveToCache(domain, data) {
  if (dnsCache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest 1000 items
    const keysToDelete = Array.from(dnsCache.keys()).slice(0, 1000);
    for (const key of keysToDelete) {
      dnsCache.delete(key);
    }
  }

  dnsCache.set(domain, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Returns DNS cache metrics.
 */
export function getDnsCacheStats() {
  return {
    size: dnsCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    ttlMs: CACHE_TTL_MS,
  };
}
