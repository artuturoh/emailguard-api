/**
 * Typo Guard Service
 * Detects common misspellings in popular email domains using direct hash lookups
 * and Levenshtein distance algorithms.
 */

// Popular email domains to protect against typos
const POPULAR_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'msn.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'aol.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
];

// High-speed direct mapping for the most frequent typos
const DIRECT_TYPO_MAP = new Map([
  // Gmail typos
  ['gmial.com', 'gmail.com'],
  ['gmaill.com', 'gmail.com'],
  ['gamil.com', 'gmail.com'],
  ['gmai.com', 'gmail.com'],
  ['gmaio.com', 'gmail.com'],
  ['gmaik.com', 'gmail.com'],
  ['gmail.co', 'gmail.com'],
  ['gmail.cm', 'gmail.com'],
  ['gmail.con', 'gmail.com'],
  ['gmail.cmo', 'gmail.com'],
  ['gmail.comm', 'gmail.com'],
  ['gmail.coom', 'gmail.com'],
  ['gemail.com', 'gmail.com'],
  ['gmeil.com', 'gmail.com'],
  ['gmal.com', 'gmail.com'],
  ['gmajl.com', 'gmail.com'],
  ['gnail.com', 'gmail.com'],
  ['fmail.com', 'gmail.com'],

  // Hotmail typos
  ['hotmial.com', 'hotmail.com'],
  ['hotmaill.com', 'hotmail.com'],
  ['hotamil.com', 'hotmail.com'],
  ['hotmai.com', 'hotmail.com'],
  ['hotmal.com', 'hotmail.com'],
  ['hormail.com', 'hotmail.com'],
  ['hotmil.com', 'hotmail.com'],
  ['hotmail.co', 'hotmail.com'],
  ['hotmail.con', 'hotmail.com'],
  ['hotmail.cmo', 'hotmail.com'],
  ['hotmail.comm', 'hotmail.com'],

  // Outlook typos
  ['outlok.com', 'outlook.com'],
  ['outloo.com', 'outlook.com'],
  ['outllok.com', 'outlook.com'],
  ['putlook.com', 'outlook.com'],
  ['outlook.co', 'outlook.com'],
  ['outlook.con', 'outlook.com'],
  ['outlook.cmo', 'outlook.com'],
  ['outlook.comm', 'outlook.com'],

  // Yahoo typos
  ['yaho.com', 'yahoo.com'],
  ['yahooo.com', 'yahoo.com'],
  ['yhoo.com', 'yahoo.com'],
  ['yahu.com', 'yahoo.com'],
  ['yahoo.co', 'yahoo.com'],
  ['yahoo.con', 'yahoo.com'],
  ['yahoo.cmo', 'yahoo.com'],
  ['yahoo.comm', 'yahoo.com'],
  ['uahoo.com', 'yahoo.com'],

  // iCloud typos
  ['icldou.com', 'icloud.com'],
  ['iclod.com', 'icloud.com'],
  ['iclud.com', 'icloud.com'],
  ['icloud.co', 'icloud.com'],
  ['icloud.con', 'icloud.com'],

  // Live & Proton
  ['live.co', 'live.com'],
  ['live.con', 'live.com'],
  ['protonmal.com', 'protonmail.com'],
  ['protonmaill.com', 'protonmail.com'],
  ['proton.mobi', 'proton.me'],
]);

// Set of exact popular domains for quick negative checks
const POPULAR_SET = new Set(POPULAR_DOMAINS);

/**
 * Calculates Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = [];

  for (let i = 0; i <= m; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (a[i - 1] === b[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1, // deletion
          d[i][j - 1] + 1, // insertion
          d[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return d[m][n];
}

/**
 * Checks if a domain has a suspected typo and suggests the correct domain.
 *
 * @param {string} domain
 * @param {string} [user='']
 * @returns {{
 *   has_typo: boolean,
 *   suggested_domain: string | null,
 *   suggested_email: string | null
 * }}
 */
export function checkTypo(domain, user = '') {
  if (!domain || typeof domain !== 'string') {
    return {
      has_typo: false,
      suggested_domain: null,
      suggested_email: null,
    };
  }

  const cleanDomain = domain.toLowerCase().trim();

  // If it's already an exact popular domain, no typo
  if (POPULAR_SET.has(cleanDomain)) {
    return {
      has_typo: false,
      suggested_domain: null,
      suggested_email: null,
    };
  }

  // 1. Fast O(1) direct lookup map
  if (DIRECT_TYPO_MAP.has(cleanDomain)) {
    const suggestedDomain = DIRECT_TYPO_MAP.get(cleanDomain);
    return {
      has_typo: true,
      suggested_domain: suggestedDomain,
      suggested_email: user ? `${user}@${suggestedDomain}` : null,
    };
  }

  // 2. Fuzzy Levenshtein match across popular domains
  // Allow max edit distance of 1 for shorter domains (<8 chars), max 2 for longer ones
  for (const popular of POPULAR_DOMAINS) {
    const lengthDiff = Math.abs(cleanDomain.length - popular.length);
    if (lengthDiff > 2) continue;

    const distance = levenshteinDistance(cleanDomain, popular);
    const maxAllowedDistance = popular.length <= 9 ? 1 : 2;

    if (distance > 0 && distance <= maxAllowedDistance) {
      return {
        has_typo: true,
        suggested_domain: popular,
        suggested_email: user ? `${user}@${popular}` : null,
      };
    }
  }

  return {
    has_typo: false,
    suggested_domain: null,
    suggested_email: null,
  };
}
