import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('HTTP API Endpoints', () => {
  test('GET /health returns healthy status and metrics', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'healthy');
    assert.equal(json.service, 'EmailGuard API');
    assert.ok(json.metrics.disposable_domains_loaded > 0);
  });

  test('GET /v1/disposable/:domain returns disposable check', async () => {
    const res = await fetch(`${baseUrl}/v1/disposable/mailinator.com`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'success');
    assert.equal(json.data.is_disposable, true);
    assert.equal(json.data.domain, 'mailinator.com');
  });

  test('POST /v1/verify returns 400 when body is invalid', async () => {
    const res = await fetch(`${baseUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.status, 'error');
    assert.equal(json.code, 'VALIDATION_ERROR');
  });

  test('POST /v1/verify validates email with exact contract structure', async () => {
    const res = await fetch(`${baseUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'juan.perez@gmial.com' }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.status, 'success');
    assert.equal(json.data.email, 'juan.perez@gmial.com');
    assert.equal(json.data.normalized_email, 'juan.perez@gmail.com');
    assert.equal(json.data.score, 45);
    assert.equal(json.data.verdict, 'risky');
    assert.equal(json.data.recommendation, 'review');
    assert.equal(json.data.checks.syntax.valid, true);
    assert.equal(json.data.checks.typo_guard.has_typo, true);
  });

  test('POST /v1/verify/batch validates array of emails concurrently', async () => {
    const res = await fetch(`${baseUrl}/v1/verify/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: [
          'test@mailinator.com',
          'support@company.com',
          'invalid..syntax@bad',
        ],
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.status, 'success');
    assert.equal(json.total, 3);
    assert.equal(json.data.length, 3);

    // mailinator is disposable -> recommendation block
    assert.equal(json.data[0].recommendation, 'block');
    assert.equal(json.data[0].checks.disposable.is_disposable, true);

    // invalid syntax -> recommendation block
    assert.equal(json.data[2].recommendation, 'block');
    assert.equal(json.data[2].checks.syntax.valid, false);
  });

  test('POST /v1/verify/batch rejects more than 50 emails with 400', async () => {
    const list = Array.from({ length: 51 }, (_, i) => `user${i}@example.com`);
    const res = await fetch(`${baseUrl}/v1/verify/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: list }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, 'VALIDATION_ERROR');
  });
});
