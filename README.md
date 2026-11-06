# 🛡️ EmailGuard API

> **High-Performance Email Hygiene & Verification Microservice for RapidAPI**  
> Designed for **sub-50ms latency**, **99.9% uptime**, zero heavy database dependencies, and **actionable fraud decisioning** (`allow` | `review` | `block`).

---

## 🚀 Key Advantages ("Level Pro")

Unlike legacy APIs that only return `{ "is_disposable": true }`, **EmailGuard API** provides a complete hygiene audit designed specifically to monetize on RapidAPI:

- **1-Line Backend Integration**: Integration developers simply check `if (data.recommendation === "block") return res.status(400);`
- **Sub-50ms Latency**: In-memory JavaScript `Set()` lookups ($O(1)$ in $<0.1\text{ ms}$) + in-memory DNS caching with TTL.
- **Native DNS & MX Lookup**: Built on `node:dns/promises` with strict 800ms timeouts and RFC 5321 A-record fallback.
- **Typo Guard**: Detects and auto-corrects typos in popular domains (e.g. `gmial.com` $\to$ `gmail.com`).
- **Role & Free Account Profiling**: Flags generic prefixes (`admin`, `soporte`, `billing`, etc.) and consumer providers (`gmail`, `outlook`, `yahoo`, `protonmail`).
- **RapidAPI Ready**: Native `X-RapidAPI-Proxy-Secret` authentication middleware preventing origin IP bypass.

---

## 📁 Project Structure

```plaintext
emailguard-api/
├── data/
│   ├── disposable-domains.json   # In-memory Set of disposable/burner domains
│   ├── free-providers.json       # Set of free consumer email providers
│   └── role-prefixes.json        # Role prefix to category mapping
├── src/
│   ├── controllers/
│   │   └── verify.controller.js  # HTTP Request Orchestrator
│   ├── services/
│   │   ├── syntax.service.js     # RFC 5322 strict syntax validator
│   │   ├── dns.service.js        # Native MX/A DNS resolver with 800ms timeout
│   │   ├── disposable.service.js # O(1) in-memory disposable checker
│   │   ├── typo.service.js       # Levenshtein & direct typo detector
│   │   ├── scorer.service.js     # 0-100 Scoring & Recommendation Engine
│   │   └── verify.service.js     # Aggregator service
│   ├── middlewares/
│   │   ├── rapidapi.middleware.js # RapidAPI Proxy Secret gatekeeper
│   │   ├── validator.middleware.js# Zod body validation schemas
│   │   └── error.middleware.js   # Centralized error & 404 handler
│   ├── routes/
│   │   └── v1.routes.js          # API v1 routes
│   └── app.js                    # Express, Helmet & CORS setup
├── test/
│   ├── emailguard.test.js        # Unit test suite
│   └── api.test.js               # End-to-end API route tests
├── server.js                     # Production entry point
├── package.json
└── README.md
```

---

## 📡 API Endpoints & Contract

### 1. Verify Single Email (Main Endpoint)
`POST /v1/verify`

#### Headers:
- `Content-Type: application/json`
- `X-RapidAPI-Proxy-Secret: <your-secret>` *(Optional in dev, enforced if configured in `.env`)*

#### Request Body:
```json
{
  "email": "juan.perez@gmial.com"
}
```

#### Response Body (`200 OK`):
```json
{
  "status": "success",
  "data": {
    "email": "juan.perez@gmial.com",
    "normalized_email": "juan.perez@gmail.com",
    "user": "juan.perez",
    "domain": "gmial.com",
    "score": 45,
    "verdict": "risky",
    "recommendation": "review",
    "checks": {
      "syntax": {
        "valid": true,
        "rfc_compliant": true
      },
      "dns": {
        "has_mx_records": false,
        "mx_host": null
      },
      "disposable": {
        "is_disposable": false,
        "provider": null
      },
      "account_type": {
        "is_free_provider": false,
        "is_role_based": false,
        "role_category": null
      },
      "typo_guard": {
        "has_typo": true,
        "suggested_domain": "gmail.com",
        "suggested_email": "juan.perez@gmail.com"
      }
    },
    "meta": {
      "execution_time_ms": 32,
      "timestamp": "2026-11-05T19:30:00.000Z"
    }
  }
}
```

---

### 2. Batch Verification (Pro Tier Endpoint)
`POST /v1/verify/batch`

Receives an array of up to 50 emails and executes verifications concurrently using `Promise.allSettled()`.

#### Request Body:
```json
{
  "emails": [
    "user1@gmail.com",
    "spammer@mailinator.com",
    "admin@company.com"
  ]
}
```

#### Response Body (`200 OK`):
```json
{
  "status": "success",
  "total": 3,
  "data": [
    { /* Verification Object 1 */ },
    { /* Verification Object 2 */ },
    { /* Verification Object 3 */ }
  ],
  "meta": {
    "execution_time_ms": 48,
    "timestamp": "2026-11-05T19:30:00.000Z"
  }
}
```

---

### 3. Disposable Domain Instant Lookup ($O(1)$)
`GET /v1/disposable/:domain`

Ultra-fast check ($<1\text{ ms}$) directly against the in-memory `Set`.

#### Response Body (`200 OK`):
```json
{
  "status": "success",
  "data": {
    "domain": "mailinator.com",
    "is_disposable": true,
    "provider": "mailinator"
  },
  "meta": {
    "execution_time_ms": 0,
    "timestamp": "2026-11-05T19:30:00.000Z"
  }
}
```

---

### 4. Healthcheck & Metrics
`GET /health`

Used by RapidAPI monitors, BetterStack, or Datadog to verify 99.9% uptime.

#### Response Body (`200 OK`):
```json
{
  "status": "healthy",
  "service": "EmailGuard API",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "timestamp": "2026-11-05T19:30:00.000Z",
  "metrics": {
    "disposable_domains_loaded": 759,
    "dns_cache": {
      "size": 142,
      "maxSize": 10000,
      "ttlMs": 300000
    },
    "memory_mb": {
      "rss": 42,
      "heapUsed": 18,
      "heapTotal": 24
    }
  }
}
```

---

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the HTTP server |
| `HOST` | `0.0.0.0` | Host bind address |
| `NODE_ENV` | `development` | Set to `production` in live deployment |
| `RAPIDAPI_PROXY_SECRET` | *(empty)* | Secret key provided by RapidAPI under your API proxy configuration |
| `DNS_TIMEOUT_MS` | `800` | Maximum timeout for DNS lookups |

---

## 🔒 RapidAPI Proxy Security

To protect your server from being called directly (bypassing RapidAPI quotas and subscriptions):

1. Go to your **RapidAPI Developer Dashboard** $\to$ **API Definition** $\to$ **Security**.
2. Copy your **RapidAPI Proxy Secret**.
3. Set `RAPIDAPI_PROXY_SECRET="your-proxy-secret"` in your `.env`.
4. The middleware (`rapidapi.middleware.js`) will immediately reject any direct calls missing this header with `403 Forbidden`.

---

## 🧪 Testing

The test suite runs with Node.js 20+ native test runner (zero extra test dependencies):

```bash
# Run all unit and integration tests
npm test
```

---

## ⚡ Production Deployment (PM2 / Docker)

### Using PM2 (Cluster Mode):
```bash
npm install -g pm2
pm2 start server.js -i max --name emailguard-api
```

### Using Node directly:
```bash
npm start
```
