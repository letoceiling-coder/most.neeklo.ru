import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MESSENGER_SOURCES,
  isMessengerSource,
  sourceTag,
  normalizePhone,
  normalizeUsername,
  SOURCE_WEB_URLS,
} from '../index.js';

describe('@most/shared', () => {
  it('MESSENGER_SOURCES has 6 messengers', () => {
    assert.equal(MESSENGER_SOURCES.length, 6);
    assert.ok(MESSENGER_SOURCES.includes('telegram'));
    assert.ok(MESSENGER_SOURCES.includes('whatsapp'));
  });

  it('isMessengerSource type guard', () => {
    assert.equal(isMessengerSource('telegram'), true);
    assert.equal(isMessengerSource('unknown'), false);
  });

  it('sourceTag adds src: prefix', () => {
    assert.equal(sourceTag('telegram'), 'src:telegram');
    assert.equal(sourceTag('max'), 'src:max');
  });

  it('normalizePhone strips non-digits', () => {
    assert.equal(normalizePhone('+7 (900) 111-22-33'), '79001112233');
    assert.equal(normalizePhone('123'), undefined);
  });

  it('normalizeUsername lowercases and strips @', () => {
    assert.equal(normalizeUsername('@Ivan_Test'), 'ivan_test');
    assert.equal(normalizeUsername('  '), undefined);
  });

  it('SOURCE_WEB_URLS covers all sources', () => {
    for (const s of MESSENGER_SOURCES) {
      assert.ok(SOURCE_WEB_URLS[s].startsWith('https://'), `${s} missing URL`);
    }
  });
});
