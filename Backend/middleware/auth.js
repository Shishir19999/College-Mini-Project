import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';

export function signToken(user) {
  return jwt.sign({ id: String(user._id), role: user.role, name: user.name, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '1d' });
}

// Verifies a JWT, then checks the user still exists, is active and the token's version matches
// (logout and password changes bump tokenVersion). Resolves to { user } or { error }.
export async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: 'Invalid or expired token' };
  }
  const user = await User.findById(payload.id).select('role name tokenVersion active').lean();
  if (!user) return { error: 'User no longer exists' };
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return { error: 'Token has been revoked' };
  if (user.active === false) return { error: 'This account has been disabled' };
  return { user: { id: String(user._id), role: user.role, name: user.name } };
}

// "Authorization: Bearer <token>"; no header means an anonymous request.
export async function authenticateRequest(req) {
  const header = req.headers.authorization;
  if (!header) return { user: null };
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return { error: 'Authentication required' };
  return authenticateToken(token);
}

export const passwordHelpers = {
  hashPassword: (plain) => bcrypt.hash(plain, 10),
  async verifyPassword(email, plain) {
    const user = await User.findOne({ email }).lean();
    if (!user || !(await bcrypt.compare(plain, user.password))) return null;
    return JSON.parse(JSON.stringify(user));
  },
  signToken,
};
