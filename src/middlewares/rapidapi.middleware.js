/**
 * RapidAPI Proxy Secret Validation Middleware
 *
 * Protects the origin server from unauthorized direct access, ensuring all
 * production calls pass through RapidAPI's billing and rate-limiting proxy.
 */
export function rapidApiProxyMiddleware(req, res, next) {
  const proxySecret = process.env.RAPIDAPI_PROXY_SECRET;

  // If RAPIDAPI_PROXY_SECRET is configured, strictly enforce header match
  if (proxySecret && proxySecret.trim().length > 0) {
    const receivedSecret =
      req.headers['x-rapidapi-proxy-secret'] ||
      req.headers['X-RapidAPI-Proxy-Secret'];

    if (!receivedSecret || receivedSecret !== proxySecret) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message:
          'Direct access forbidden. Requests must originate through the RapidAPI proxy.',
      });
    }
  }

  // Extract RapidAPI client metadata if forwarded by the proxy
  req.rapidapi = {
    user: req.headers['x-rapidapi-user'] || null,
    subscription: req.headers['x-rapidapi-subscription'] || null,
    version: req.headers['x-rapidapi-version'] || null,
  };

  next();
}
