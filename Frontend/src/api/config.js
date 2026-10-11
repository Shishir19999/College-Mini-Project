export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === 'true';

let authToken = null;
export const setAuthToken = (token) => {
  authToken = token || null;
};
export const getAuthToken = () => authToken;

// Where a dish image lives: bundled photos, uploads served by the API, or an inline data URL (Live preview uploads).
export function imageUrl(image) {
  if (!image) return `${import.meta.env.BASE_URL}food/logo.png`;
  if (/^(data:|https?:|\/)/.test(image)) return image;
  if (image.startsWith('uploads/')) return `${API_URL}/${image}`;
  return `${import.meta.env.BASE_URL}food/${image}`;
}
