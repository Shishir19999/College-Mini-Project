export { money } from '../../../shared/rules.js';

const pad = (n) => String(n).padStart(2, '0');

export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
// "YYYY-MM-DD" in the viewer's local time, `offset` days from today
export const dayKeyLocal = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const fmtDayKey = (key) => new Date(`${key}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

export function ago(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE = /^[0-9 +()-]{7,20}$/;

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// Read an image file as a data URL (dish uploads). Resolves to '' when it is too large.
export function readImage(file, maxBytes = 480000) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type)) return reject(new Error('Choose a PNG, JPEG, WebP, AVIF or GIF image.'));
    if (file.size > maxBytes) return reject(new Error('That image is too large. Choose one under 450 KB.'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}
