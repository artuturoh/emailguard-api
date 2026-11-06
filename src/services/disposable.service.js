import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory Set for O(1) lookups (<1ms)
let disposableSet = new Set();

// Provider mapping for known popular disposable services
const PROVIDER_SIGNATURES = [
  { match: 'mailinator', name: 'mailinator' },
  { match: 'yopmail', name: 'yopmail' },
  { match: 'guerrillamail', name: 'guerrillamail' },
  { match: 'guerillamail', name: 'guerrillamail' },
  { match: 'tempmail', name: 'tempmail' },
  { match: 'temp-mail', name: 'tempmail' },
  { match: '10minutemail', name: '10minutemail' },
  { match: '10minute', name: '10minutemail' },
  { match: 'trashmail', name: 'trashmail' },
  { match: 'sharklasers', name: 'guerrillamail' },
  { match: 'dispostable', name: 'dispostable' },
  { match: 'getairmail', name: 'airmail' },
  { match: 'nada.ltd', name: 'nada' },
  { match: 'getnada', name: 'nada' },
  { match: 'burnermail', name: 'burnermail' },
  { match: 'mohmal', name: 'mohmal' },
  { match: 'crazymailing', name: 'crazymailing' },
  { match: 'emailondeck', name: 'emailondeck' },
  { match: 'generator.email', name: 'generatoremail' },
  { match: 'maildrop', name: 'maildrop' },
  { match: 'dropmail', name: 'dropmail' },
  { match: 'inboxkitten', name: 'inboxkitten' },
];

/**
 * Initializes disposable domains into an in-memory Set.
 */
export function initDisposableService() {
  try {
    const dataPath = join(__dirname, '../../data/disposable-domains.json');
    const rawData = readFileSync(dataPath, 'utf-8');
    const domains = JSON.parse(rawData);

    disposableSet = new Set(
      Array.isArray(domains) ? domains.map((d) => d.toLowerCase().trim()) : []
    );

    console.log(
      `[DisposableService] Loaded ${disposableSet.size} disposable domains in memory (O(1) lookups).`
    );
  } catch (error) {
    console.error('[DisposableService] Error loading disposable domains:', error.message);
    disposableSet = new Set();
  }
}

// Auto-initialize on module load
initDisposableService();

/**
 * Checks if a domain is a known disposable or temporary email address.
 * Supports direct match and parent domain matching (subdomains).
 *
 * @param {string} domain
 * @returns {{ is_disposable: boolean, provider: string | null }}
 */
export function checkDisposable(domain) {
  if (!domain || typeof domain !== 'string') {
    return { is_disposable: false, provider: null };
  }

  const cleanDomain = domain.toLowerCase().trim();

  // 1. Direct O(1) lookup
  if (disposableSet.has(cleanDomain)) {
    return {
      is_disposable: true,
      provider: resolveProviderName(cleanDomain),
    };
  }

  // 2. Subdomain check (e.g., sub.mailinator.com -> mailinator.com)
  const parts = cleanDomain.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (disposableSet.has(parentDomain)) {
        return {
          is_disposable: true,
          provider: resolveProviderName(parentDomain),
        };
      }
    }
  }

  return {
    is_disposable: false,
    provider: null,
  };
}

/**
 * Resolves a friendly provider name for a disposable domain.
 * @param {string} domain
 * @returns {string}
 */
function resolveProviderName(domain) {
  for (const sig of PROVIDER_SIGNATURES) {
    if (domain.includes(sig.match)) {
      return sig.name;
    }
  }
  // Fallback: extract base name before the TLD
  const base = domain.split('.')[0] || 'disposable';
  return base;
}

/**
 * Returns the current total count of loaded disposable domains.
 * @returns {number}
 */
export function getDisposableCount() {
  return disposableSet.size;
}
