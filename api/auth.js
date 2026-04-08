import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'auth_check') {
    const token = req.cookies.admin_token;
    if (!token) return res.status(200).json({ loggedIn: false });
    try {
      jwt.verify(token, JWT_SECRET);
      return res.status(200).json({ loggedIn: true });
    } catch (e) {
      return res.status(200).json({ loggedIn: false });
    }
  }

  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.setHeader('Set-Cookie', serialize('admin_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 1 day
      }));
      return res.status(200).json({ success: true });
    }
    return res.status(200).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác!' });
  }

  if (action === 'logout') {
    res.setHeader('Set-Cookie', serialize('admin_token', '', {
      path: '/',
      maxAge: -1
    }));
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
