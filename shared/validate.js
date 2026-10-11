// Tiny schema validator: spec = { field: { type, required, min, max, enum, pattern, label } }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => EMAIL.test(String(v || ''));
export const passwordProblem = (v) =>
  String(v || '').length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(v) || !/[0-9]/.test(v) ? 'Include a letter and a number.' : '';

export function validate(body, spec) {
  const value = {};
  const errors = [];
  const src = body && typeof body === 'object' ? body : {};
  for (const [key, rule] of Object.entries(spec)) {
    let v = src[key];
    const label = rule.label || key;
    if (v === undefined || v === null || v === '') {
      if (rule.required) errors.push(`${label} is required`);
      else if (rule.default !== undefined) value[key] = rule.default;
      continue;
    }
    switch (rule.type) {
      case 'string':
      case 'email': {
        if (typeof v !== 'string') { errors.push(`${label} must be text`); break; }
        v = v.trim();
        if (rule.min && v.length < rule.min) errors.push(`${label} must be at least ${rule.min} characters`);
        else if (v.length > (rule.max || 500)) errors.push(`${label} must be at most ${rule.max || 500} characters`);
        else if (rule.type === 'email' && !isEmail(v)) errors.push(`${label} must be a valid email`);
        else if (rule.enum && !rule.enum.includes(v)) errors.push(`${label} must be one of ${rule.enum.join(', ')}`);
        else if (rule.pattern && !rule.pattern.test(v)) errors.push(rule.message || `${label} is not valid`);
        else value[key] = rule.type === 'email' ? v.toLowerCase() : v;
        break;
      }
      case 'number': {
        const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) errors.push(`${label} must be a number`);
        else if (rule.min !== undefined && n < rule.min) errors.push(`${label} must be at least ${rule.min}`);
        else if (rule.max !== undefined && n > rule.max) errors.push(`${label} must be at most ${rule.max}`);
        else if (rule.int && !Number.isInteger(n)) errors.push(`${label} must be a whole number`);
        else value[key] = n;
        break;
      }
      case 'boolean':
        if (typeof v !== 'boolean') errors.push(`${label} must be true or false`);
        else value[key] = v;
        break;
      case 'array':
        if (!Array.isArray(v)) errors.push(`${label} must be a list`);
        else if (rule.max && v.length > rule.max) errors.push(`${label} has too many entries`);
        else value[key] = v;
        break;
      default:
        value[key] = v;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
