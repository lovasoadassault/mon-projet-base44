import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'chat_token';

const secret = process.env.JWT_SECRET || 'dev-secret-chatlibre';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, secret);
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

export function tokenCookie(res, userId) {
  res.cookie(COOKIE_NAME, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function requireAuth(req, res, next) {
  const userId = verifyToken(req.cookies ? req.cookies[COOKIE_NAME] : undefined);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  req.userId = userId;
  next();
}
