export const SUSPICIOUS_OPTIONS = ['Yes', 'No', 'POK'];

export function normalizeSuspicious(value) {
  const v = (value || 'No').trim();
  return SUSPICIOUS_OPTIONS.includes(v) ? v : 'No';
}

export function suspiciousCardClass(value) {
  const v = normalizeSuspicious(value);
  if (v === 'Yes') return 'civilian-card--suspicious-yes';
  if (v === 'POK') return 'civilian-card--suspicious-pok';
  return 'civilian-card--suspicious-no';
}

export function suspiciousTagClass(value) {
  const v = normalizeSuspicious(value);
  if (v === 'Yes') return 'cc-tag suspicious-yes';
  if (v === 'POK') return 'cc-tag suspicious-pok';
  return 'cc-tag suspicious-no';
}
