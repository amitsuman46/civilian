const crypto = require('crypto');

const ENC_PREFIX = 'enc:v1:';
const ENC_DET_PREFIX = 'encd:v1:';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

function isEncryptionEnabled() {
  return Boolean(getKey());
}

function isEncrypted(value) {
  if (value == null) return false;
  const s = String(value);
  return s.startsWith(ENC_PREFIX) || s.startsWith(ENC_DET_PREFIX);
}

function packCipher(iv, tag, data) {
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

function unpackCipher(payload) {
  const buf = Buffer.from(payload, 'base64url');
  return {
    iv: buf.subarray(0, 12),
    tag: buf.subarray(12, 28),
    data: buf.subarray(28),
  };
}

function decryptPacked(key, prefix, value) {
  const s = String(value);
  if (!s.startsWith(prefix)) return value;
  const { iv, tag, data } = unpackCipher(s.slice(prefix.length));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Random IV — for JSON blobs (family_details). */
function encryptField(value) {
  if (value == null || value === '') return value;
  const key = getKey();
  if (!key) return value;
  if (isEncrypted(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ENC_PREFIX + packCipher(iv, cipher.getAuthTag(), enc);
}

/** Deterministic — for fields used in equality filters (mobile, area, etc.). */
function encryptLookup(value) {
  if (value == null || value === '') return value;
  const key = getKey();
  if (!key) return value;
  const s = String(value);
  if (s.startsWith(ENC_DET_PREFIX)) return value;

  const iv = crypto.createHmac('sha256', key).update(s).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()]);
  return ENC_DET_PREFIX + packCipher(iv, cipher.getAuthTag(), enc);
}

function decryptField(value) {
  if (value == null || value === '') return value;
  const key = getKey();
  if (!key) return value;
  const s = String(value);
  if (s.startsWith(ENC_PREFIX)) return decryptPacked(key, ENC_PREFIX, value);
  if (s.startsWith(ENC_DET_PREFIX)) return decryptPacked(key, ENC_DET_PREFIX, value);
  return value;
}

function lookupMatchClause(column, plainValue) {
  if (!plainValue) return { sql: '', params: [] };
  const enc = encryptLookup(plainValue);
  if (enc === plainValue) {
    return { sql: `${column} = ?`, params: [plainValue] };
  }
  return { sql: `(${column} = ? OR ${column} = ?)`, params: [plainValue, enc] };
}

module.exports = {
  isEncryptionEnabled,
  isEncrypted,
  encryptField,
  encryptLookup,
  decryptField,
  lookupMatchClause,
};
