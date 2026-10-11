import { describe, expect, it } from 'vitest';
import { ago, dayKeyLocal, fmtTime, initials, money, readImage, EMAIL, PHONE } from './format';
import { imageUrl } from '../api/config';
import { load, save, drop } from './storage';

describe('format helpers', () => {
  it('formats money like the original shop', () => {
    expect(money(50)).toBe('Rs 50');
    expect(money(12.5)).toBe('Rs 12.50');
  });
  it('formats 24h slot times', () => {
    expect(fmtTime('09:00')).toBe('9:00 AM');
    expect(fmtTime('13:30')).toBe('1:30 PM');
    expect(fmtTime('00:00')).toBe('12:00 AM');
  });
  it('relative times', () => {
    const now = Date.parse('2030-01-01T12:00:00Z');
    expect(ago('2030-01-01T11:59:50Z', now)).toBe('just now');
    expect(ago('2030-01-01T11:30:00Z', now)).toBe('30 min ago');
    expect(ago('2029-12-30T12:00:00Z', now)).toBe('2 d ago');
  });
  it('local day keys', () => {
    expect(dayKeyLocal(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dayKeyLocal(1) > dayKeyLocal(0)).toBe(true);
  });
  it('validates email and phone patterns', () => {
    expect(EMAIL.test('a@b.co')).toBe(true);
    expect(EMAIL.test('nope')).toBe(false);
    expect(PHONE.test('+00 000 000 0000')).toBe(true);
    expect(PHONE.test('12')).toBe(false);
    expect(initials('Shop Admin')).toBe('SA');
  });
  it('rejects bad or oversized images', async () => {
    await expect(readImage({ type: 'text/html', size: 10 })).rejects.toThrow(/PNG/);
    await expect(readImage({ type: 'image/png', size: 9e6 })).rejects.toThrow(/too large/);
    expect(await readImage(null)).toBe('');
  });
});

describe('image urls', () => {
  it('resolves bundled photos, uploads and data urls', () => {
    expect(imageUrl('biryani.jpg')).toBe('/food/biryani.jpg');
    expect(imageUrl('uploads/a.png')).toBe('/api/uploads/a.png');
    expect(imageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(imageUrl('')).toBe('/food/logo.png');
  });
});

describe('storage helpers never throw', () => {
  it('falls back when storage is unavailable', () => {
    expect(load('x', 5)).toBe(5);
    expect(() => save('x', 1)).not.toThrow();
    expect(() => drop('x')).not.toThrow();
  });
});
