import { validateSyntax } from './syntax.service.js';
import { checkDisposable } from './disposable.service.js';
import { resolveMxWithFallback } from './dns.service.js';
import { checkTypo } from './typo.service.js';
import { checkAccountType, calculateScoreAndVerdict } from './scorer.service.js';

/**
 * Performs a comprehensive email verification analysis.
 *
 * @param {string} email - Raw input email string
 * @returns {Promise<Object>} Formatted email verification data contract
 */
export async function verifyEmail(email) {
  const startHr = process.hrtime.bigint();
  const rawEmail = typeof email === 'string' ? email.trim() : '';

  // 1. Syntax & RFC Validation
  const syntax = validateSyntax(rawEmail);

  if (!syntax.valid) {
    const endHr = process.hrtime.bigint();
    const executionTimeMs = Number((endHr - startHr) / 1_000_000n);

    return {
      email: rawEmail,
      normalized_email: rawEmail.toLowerCase(),
      user: syntax.user || '',
      domain: syntax.domain || '',
      score: 0,
      verdict: 'invalid',
      recommendation: 'block',
      checks: {
        syntax: {
          valid: false,
          rfc_compliant: false,
        },
        dns: {
          has_mx_records: false,
          mx_host: null,
        },
        disposable: {
          is_disposable: false,
          provider: null,
        },
        account_type: {
          is_free_provider: false,
          is_role_based: false,
          role_category: null,
        },
        typo_guard: {
          has_typo: false,
          suggested_domain: null,
          suggested_email: null,
        },
      },
      meta: {
        execution_time_ms: executionTimeMs,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const { user, domain } = syntax;

  // 2. High-speed in-memory checks (<0.1ms)
  const disposable = checkDisposable(domain);
  const typo = checkTypo(domain, user);
  const accountType = checkAccountType(user, domain);

  // 3. DNS MX record lookup (with strict 800ms timeout and A-record fallback)
  let dns = { has_mx_records: false, mx_host: null };

  // Skip external DNS if already identified as disposable
  if (!disposable.is_disposable) {
    dns = await resolveMxWithFallback(domain);
  }

  // 4. Scoring, Verdict & Recommendation calculation
  const { score, verdict, recommendation } = calculateScoreAndVerdict({
    syntax,
    dns,
    disposable,
    accountType,
    typo,
  });

  // 5. Normalized email calculation
  const normalizedEmail = typo.has_typo && typo.suggested_email
    ? typo.suggested_email
    : `${user}@${domain}`;

  const endHr = process.hrtime.bigint();
  const executionTimeMs = Math.max(1, Number((endHr - startHr) / 1_000_000n));

  return {
    email: rawEmail,
    normalized_email: normalizedEmail,
    user,
    domain,
    score,
    verdict,
    recommendation,
    checks: {
      syntax: {
        valid: syntax.valid,
        rfc_compliant: syntax.rfc_compliant,
      },
      dns: {
        has_mx_records: dns.has_mx_records,
        mx_host: dns.mx_host,
      },
      disposable: {
        is_disposable: disposable.is_disposable,
        provider: disposable.provider,
      },
      account_type: {
        is_free_provider: accountType.is_free_provider,
        is_role_based: accountType.is_role_based,
        role_category: accountType.role_category,
      },
      typo_guard: {
        has_typo: typo.has_typo,
        suggested_domain: typo.suggested_domain,
        suggested_email: typo.suggested_email,
      },
    },
    meta: {
      execution_time_ms: executionTimeMs,
      timestamp: new Date().toISOString(),
    },
  };
}
