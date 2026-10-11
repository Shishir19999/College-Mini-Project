import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContactMailer, mailConfigured } from '../utils/mail.js';

test('contact mail stays off until every SMTP_* setting and the recipient are present', () => {
  assert.equal(mailConfigured({}), false);
  assert.equal(createContactMailer({}), null);
  assert.equal(mailConfigured({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'sender', SMTP_PASS: 'x' }), false);
  const env = { SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_USER: 'sender', SMTP_PASS: 'x', CONTACT_TO: 'inbox' };
  assert.equal(mailConfigured(env), true);
  assert.equal(typeof createContactMailer(env), 'function');
});
