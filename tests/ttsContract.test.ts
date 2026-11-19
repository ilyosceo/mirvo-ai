import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_EDGE_VOICE,
  MAX_TTS_TEXT_LENGTH,
  isEdgeVoice,
  normalizeEdgeVoice,
  normalizeTtsText,
} from '../lib/ttsContract';

test('only the two supported Uzbek neural voices are accepted', () => {
  assert.equal(isEdgeVoice('uz-UZ-SardorNeural'), true);
  assert.equal(isEdgeVoice('uz-UZ-MadinaNeural'), true);
  assert.equal(isEdgeVoice('en-US-AriaNeural'), false);
  assert.equal(isEdgeVoice(undefined), false);
});

test('voice settings migrate missing or invalid values to Sardor', () => {
  assert.equal(normalizeEdgeVoice(undefined), DEFAULT_EDGE_VOICE);
  assert.equal(normalizeEdgeVoice('unsupported'), DEFAULT_EDGE_VOICE);
  assert.equal(normalizeEdgeVoice('uz-UZ-MadinaNeural'), 'uz-UZ-MadinaNeural');
});

test('TTS text is trimmed, NUL-stripped, non-empty, and length bounded', () => {
  assert.equal(normalizeTtsText('  Salom\u0000 dunyo  '), 'Salom dunyo');
  assert.equal(normalizeTtsText('  '), null);
  assert.equal(normalizeTtsText('x'.repeat(MAX_TTS_TEXT_LENGTH + 1)), null);
  assert.equal(normalizeTtsText(42), null);
});
