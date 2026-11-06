import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSyntax } from '../src/services/syntax.service.js';
import { checkDisposable } from '../src/services/disposable.service.js';
import { checkTypo } from '../src/services/typo.service.js';
import { checkAccountType, calculateScoreAndVerdict } from '../src/services/scorer.service.js';
import { verifyEmail } from '../src/services/verify.service.js';
import app from '../src/app.js';

describe('1. Syntax Service (RFC 5322)', () => {
  test('Validates clean standard emails', () => {
    const res = validateSyntax('juan.perez@example.com');
    assert.equal(res.valid, true);
    assert.equal(res.user, 'juan.perez');
    assert.equal(res.domain, 'example.com');
  });

  test('Rejects missing domain or user', () => {
    assert.equal(validateSyntax('juan.perez').valid, false);
    assert.equal(validateSyntax('@domain.com').valid, false);
    assert.equal(validateSyntax('juan@').valid, false);
  });

  test('Rejects consecutive dots in user or domain', () => {
    assert.equal(validateSyntax('juan..perez@gmail.com').valid, false);
    assert.equal(validateSyntax('juan@gmail..com').valid, false);
  });

  test('Rejects invalid TLD', () => {
    assert.equal(validateSyntax('juan@gmail.c').valid, false);
  });
});

describe('2. Disposable Service (O(1) Set)', () => {
  test('Detects popular disposable domains', () => {
    const res = checkDisposable('mailinator.com');
    assert.equal(res.is_disposable, true);
    assert.equal(res.provider, 'mailinator');

    const tempRes = checkDisposable('10minutemail.com');
    assert.equal(tempRes.is_disposable, true);
  });

  test('Detects disposable subdomains', () => {
    const res = checkDisposable('sub.mailinator.com');
    assert.equal(res.is_disposable, true);
    assert.equal(res.provider, 'mailinator');
  });

  test('Returns false for reputable consumer or corporate domains', () => {
    assert.equal(checkDisposable('gmail.com').is_disposable, false);
    assert.equal(checkDisposable('google.com').is_disposable, false);
  });
});

describe('3. Typo Guard Service', () => {
  test('Detects common Gmail typos', () => {
    const res = checkTypo('gmial.com', 'juan.perez');
    assert.equal(res.has_typo, true);
    assert.equal(res.suggested_domain, 'gmail.com');
    assert.equal(res.suggested_email, 'juan.perez@gmail.com');
  });

  test('Detects common Hotmail typos', () => {
    const res = checkTypo('hotmial.com', 'user');
    assert.equal(res.has_typo, true);
    assert.equal(res.suggested_domain, 'hotmail.com');
  });

  test('Detects common Yahoo typos', () => {
    const res = checkTypo('yaho.com', 'user');
    assert.equal(res.has_typo, true);
    assert.equal(res.suggested_domain, 'yahoo.com');
  });

  test('Returns false for correctly spelled domains', () => {
    assert.equal(checkTypo('gmail.com').has_typo, false);
    assert.equal(checkTypo('mycompany.io').has_typo, false);
  });
});

describe('4. Account Type & Scoring Service', () => {
  test('Identifies free email providers', () => {
    const res = checkAccountType('user', 'gmail.com');
    assert.equal(res.is_free_provider, true);
    assert.equal(res.is_role_based, false);
  });

  test('Identifies role-based accounts', () => {
    const adminRes = checkAccountType('admin', 'company.com');
    assert.equal(adminRes.is_role_based, true);
    assert.equal(adminRes.role_category, 'admin');

    const supportRes = checkAccountType('support-team', 'company.com');
    assert.equal(supportRes.is_role_based, true);
    assert.equal(supportRes.role_category, 'support');
  });

  test('Scores typo email matching the specification contract', () => {
    const syntax = { valid: true, rfc_compliant: true };
    const dns = { has_mx_records: false, mx_host: null };
    const disposable = { is_disposable: false, provider: null };
    const accountType = { is_free_provider: false, is_role_based: false, role_category: null };
    const typo = { has_typo: true, suggested_domain: 'gmail.com' };

    const scoreRes = calculateScoreAndVerdict({
      syntax,
      dns,
      disposable,
      accountType,
      typo,
    });

    assert.equal(scoreRes.score, 45);
    assert.equal(scoreRes.verdict, 'risky');
    assert.equal(scoreRes.recommendation, 'review');
  });

  test('Blocks disposable emails completely', () => {
    const scoreRes = calculateScoreAndVerdict({
      syntax: { valid: true, rfc_compliant: true },
      dns: { has_mx_records: true, mx_host: 'mail.mailinator.com' },
      disposable: { is_disposable: true, provider: 'mailinator' },
      accountType: { is_free_provider: false, is_role_based: false, role_category: null },
      typo: { has_typo: false, suggested_domain: null },
    });

    assert.equal(scoreRes.score, 0);
    assert.equal(scoreRes.verdict, 'invalid');
    assert.equal(scoreRes.recommendation, 'block');
  });
});

describe('5. Full Verification Orchestrator', () => {
  test('Verifies juan.perez@gmial.com with expected output structure', async () => {
    const result = await verifyEmail('juan.perez@gmial.com');

    assert.equal(result.email, 'juan.perez@gmial.com');
    assert.equal(result.normalized_email, 'juan.perez@gmail.com');
    assert.equal(result.user, 'juan.perez');
    assert.equal(result.domain, 'gmial.com');
    assert.equal(result.score, 45);
    assert.equal(result.verdict, 'risky');
    assert.equal(result.recommendation, 'review');
    assert.equal(result.checks.syntax.valid, true);
    assert.equal(result.checks.disposable.is_disposable, false);
    assert.equal(result.checks.typo_guard.has_typo, true);
    assert.equal(result.checks.typo_guard.suggested_domain, 'gmail.com');
    assert.equal(result.checks.typo_guard.suggested_email, 'juan.perez@gmail.com');
    assert.ok(result.meta.execution_time_ms >= 0);
  });
});
