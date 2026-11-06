import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let freeProvidersSet = new Set();
let rolePrefixesMap = new Map();

/**
 * Initializes free providers and role prefixes datasets into memory.
 */
export function initScorerDatasets() {
  try {
    const freePath = join(__dirname, '../../data/free-providers.json');
    const freeData = JSON.parse(readFileSync(freePath, 'utf-8'));
    freeProvidersSet = new Set(
      Array.isArray(freeData) ? freeData.map((d) => d.toLowerCase().trim()) : []
    );

    const rolePath = join(__dirname, '../../data/role-prefixes.json');
    const roleData = JSON.parse(readFileSync(rolePath, 'utf-8'));
    rolePrefixesMap = new Map(
      Object.entries(roleData).map(([k, v]) => [k.toLowerCase().trim(), v])
    );

    console.log(
      `[ScorerService] Loaded ${freeProvidersSet.size} free providers and ${rolePrefixesMap.size} role prefixes.`
    );
  } catch (error) {
    console.error('[ScorerService] Error loading scorer datasets:', error.message);
  }
}

// Auto-initialize on load
initScorerDatasets();

/**
 * Evaluates account type characteristics (free provider vs corporate, role-based).
 *
 * @param {string} user
 * @param {string} domain
 * @returns {{
 *   is_free_provider: boolean,
 *   is_role_based: boolean,
 *   role_category: string | null
 * }}
 */
export function checkAccountType(user, domain) {
  const cleanDomain = (domain || '').toLowerCase().trim();
  const cleanUser = (user || '').toLowerCase().trim();

  // 1. Free provider check O(1)
  const isFreeProvider = freeProvidersSet.has(cleanDomain);

  // 2. Role-based check
  let isRoleBased = false;
  let roleCategory = null;

  if (cleanUser) {
    // Direct match on role prefix
    if (rolePrefixesMap.has(cleanUser)) {
      isRoleBased = true;
      roleCategory = rolePrefixesMap.get(cleanUser);
    } else {
      // Check prefix tokens (e.g., support-team, admin.dept, sales_eu)
      const tokens = cleanUser.split(/[-._+]/);
      for (const token of tokens) {
        if (rolePrefixesMap.has(token)) {
          isRoleBased = true;
          roleCategory = rolePrefixesMap.get(token);
          break;
        }
      }
    }
  }

  return {
    is_free_provider: isFreeProvider,
    is_role_based: isRoleBased,
    role_category: roleCategory,
  };
}

/**
 * Calculates email hygiene score (0-100), verdict, and recommendation.
 *
 * @param {Object} params
 * @param {Object} params.syntax - { valid: boolean, rfc_compliant: boolean }
 * @param {Object} params.dns - { has_mx_records: boolean, mx_host: string | null, has_a_records?: boolean }
 * @param {Object} params.disposable - { is_disposable: boolean, provider: string | null }
 * @param {Object} params.accountType - { is_free_provider: boolean, is_role_based: boolean, role_category: string | null }
 * @param {Object} params.typo - { has_typo: boolean, suggested_domain: string | null }
 * @returns {{
 *   score: number,
 *   verdict: 'valid' | 'risky' | 'invalid',
 *   recommendation: 'allow' | 'review' | 'block'
 * }}
 */
export function calculateScoreAndVerdict({
  syntax,
  dns,
  disposable,
  accountType,
  typo,
}) {
  // Hard stop 1: Invalid RFC syntax -> immediate block
  if (!syntax || !syntax.valid) {
    return {
      score: 0,
      verdict: 'invalid',
      recommendation: 'block',
    };
  }

  // Hard stop 2: Disposable / Temporary Email -> block
  if (disposable && disposable.is_disposable) {
    return {
      score: 0,
      verdict: 'invalid',
      recommendation: 'block',
    };
  }

  // Case 3: Typo detected (e.g. juan.perez@gmial.com)
  // Even if DNS fails, we know it's a likely typo of a real service
  if (typo && typo.has_typo) {
    let typoScore = 45;
    if (accountType && accountType.is_role_based) {
      typoScore -= 10;
    }
    return {
      score: Math.max(10, Math.min(100, typoScore)),
      verdict: 'risky',
      recommendation: 'review',
    };
  }

  // Case 4: No MX records and no typo
  if (!dns || !dns.has_mx_records) {
    // If domain has fallback A records per RFC 5321
    if (dns && dns.has_a_records) {
      return {
        score: 50,
        verdict: 'risky',
        recommendation: 'review',
      };
    }

    // Completely unresolvable domain
    return {
      score: 0,
      verdict: 'invalid',
      recommendation: 'block',
    };
  }

  // Case 5: Domain has valid MX records
  let score = 100;

  // Role-based penalty (e.g. info@, admin@, support@)
  if (accountType && accountType.is_role_based) {
    if (accountType.role_category === 'automated') {
      score -= 25; // no-reply, bounce, daemon
    } else {
      score -= 15; // admin, info, sales
    }
  }

  // Determine verdict and actionable recommendation based on final score
  let verdict = 'valid';
  let recommendation = 'allow';

  if (score >= 80) {
    verdict = 'valid';
    recommendation = 'allow';
  } else if (score >= 40) {
    verdict = 'risky';
    recommendation = 'review';
  } else {
    verdict = 'invalid';
    recommendation = 'block';
  }

  return {
    score,
    verdict,
    recommendation,
  };
}
