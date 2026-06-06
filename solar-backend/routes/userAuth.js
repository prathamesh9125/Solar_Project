const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'user_secret_key';
const JWT_EXPIRES = '7d';

// ── POST /api/user/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const emailLC = email.trim().toLowerCase();

    // Check duplicate
    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?', [emailLC]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
      [name.trim(), emailLC, hash, phone || null]
    );

    const token = jwt.sign(
      { userId: result.insertId, email: emailLC, role: 'user' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { userId: result.insertId, name: name.trim(), email: emailLC }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/user/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const emailLC = email.trim().toLowerCase();
    const [rows] = await pool.execute(
      'SELECT user_id, name, email, password_hash, is_active FROM users WHERE email = ?',
      [emailLC]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact support.' });
    }

    const match = await bcrypt.compare(password.trim(), user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: { userId: user.user_id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── GET /api/user/me  (protected) ────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.execute(
      'SELECT user_id, name, email, phone, created_at FROM users WHERE user_id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    return res.json({ user: rows[0] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

// ── POST /api/user/change-password (protected) ───────────────
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ?', [decoded.userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, decoded.userId]);

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

module.exports = router;

// ── GET /api/user/all  (admin - get all users) ───────────────
router.get('/all', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    // Try both admin secret and user secret
    let decoded;
    try {
      decoded = jwt.verify(token, 'secretkey');
    } catch {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'user_secret_key');
    }
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });

    const [rows] = await pool.execute(
      'SELECT user_id, name, email, phone, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json({ users: rows });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

// ── PATCH /api/user/:id/toggle  (admin - activate/deactivate) ─
router.patch('/:id/toggle', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, 'secretkey');
    } catch {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'user_secret_key');
    }
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });

    const [rows] = await pool.execute('SELECT is_active FROM users WHERE user_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    const newStatus = rows[0].is_active ? 0 : 1;
    await pool.execute('UPDATE users SET is_active = ? WHERE user_id = ?', [newStatus, req.params.id]);
    return res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'} successfully.`, is_active: newStatus });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});