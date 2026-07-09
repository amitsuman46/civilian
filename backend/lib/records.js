const {
  encryptField,
  encryptLookup,
  decryptField,
} = require('./crypto');

const CIVILIAN_LOOKUP_FIELDS = ['mobile', 'house_no', 'village', 'area'];
const CIVILIAN_FIELD_ENCRYPT = ['family_details'];
const DIRECTORY_LOOKUP_FIELDS = ['mobile', 'village', 'area'];

function encryptCivilianFields(data) {
  const out = { ...data };
  for (const f of CIVILIAN_LOOKUP_FIELDS) {
    if (out[f] != null && out[f] !== '') out[f] = encryptLookup(out[f]);
  }
  for (const f of CIVILIAN_FIELD_ENCRYPT) {
    if (out[f] != null && out[f] !== '') out[f] = encryptField(out[f]);
  }
  return out;
}

function decryptCivilian(record) {
  if (!record) return record;
  const out = { ...record };
  for (const f of [...CIVILIAN_LOOKUP_FIELDS, ...CIVILIAN_FIELD_ENCRYPT]) {
    if (out[f] == null || out[f] === '') continue;
    let val = out[f];
    if (f === 'family_details' && typeof val === 'object') val = JSON.stringify(val);
    out[f] = decryptField(val);
  }
  return out;
}

function decryptCivilians(records) {
  return records.map(decryptCivilian);
}

function encryptDirectoryFields(data) {
  const out = { ...data };
  for (const f of DIRECTORY_LOOKUP_FIELDS) {
    if (out[f] != null && out[f] !== '') out[f] = encryptLookup(out[f]);
  }
  return out;
}

function decryptDirectory(record) {
  if (!record) return record;
  const out = { ...record };
  for (const f of DIRECTORY_LOOKUP_FIELDS) {
    if (out[f] != null && out[f] !== '') out[f] = decryptField(out[f]);
  }
  return out;
}

function decryptDirectories(records) {
  return records.map(decryptDirectory);
}

function parseFamily(raw) {
  if (!raw || raw === '[]') return '[]';
  try { return JSON.stringify(JSON.parse(raw)); } catch { return '[]'; }
}

function recordMatchesQuery(record, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  const scalarFields = [
    'name', 'mobile', 'village', 'area', 'occupation', 'health_status',
    'house_no', 'community', 'religion', 'suspicious', 'immovable_property', 'movable_property',
    'designation',
  ];
  for (const f of scalarFields) {
    if (String(record[f] ?? '').toLowerCase().includes(lower)) return true;
  }
  const fam = record.family_details;
  const famStr = typeof fam === 'string' ? fam : JSON.stringify(fam || []);
  if (famStr.toLowerCase().includes(lower)) return true;
  for (const n of ['salary', 'income', 'expenditure']) {
    if (String(record[n] ?? '').includes(q)) return true;
  }
  return false;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function aggregateCounts(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const label = row[field];
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

module.exports = {
  CIVILIAN_LOOKUP_FIELDS,
  encryptCivilianFields,
  decryptCivilian,
  decryptCivilians,
  encryptDirectoryFields,
  decryptDirectory,
  decryptDirectories,
  parseFamily,
  recordMatchesQuery,
  uniqueSorted,
  aggregateCounts,
};
