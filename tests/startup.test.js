import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('storefront starts without database configuration and database routes explain the missing setup', () => {
  const probe = `
    const assert = (await import('node:assert/strict')).default;
    const { default: app } = await import('./server.js');
    const server = app.listen(0);
    try {
      await new Promise(resolve => server.once('listening', resolve));
      const base = \`http://127.0.0.1:\${server.address().port}\`;
      const storefront = await fetch(base);
      assert.equal(storefront.status, 200);
      assert.match(await storefront.text(), /<!doctype html/i);
      const health = await fetch(\`\${base}/api/health\`);
      assert.equal(health.status, 503);
      assert.match((await health.json()).message, /DATABASE_URL_POOLED/);
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  `;

  execFileSync(process.execPath, ['--input-type=module', '--eval', probe], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      VERCEL: '1',
      DATABASE_URL: '',
      DATABASE_URL_POOLED: ''
    }
  });
});
