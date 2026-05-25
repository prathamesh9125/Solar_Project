const express = require('express')
const router  = express.Router()
const db      = require('../config/db')
const auth = require('../middleware/auth');
// GET all payments for admin dashboard
router.get('/all', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, COALESCE(p.method, 'razorpay') AS method, c.name AS customer_name, c.email
      FROM payments p
      JOIN customers c ON p.customer_id = c.customer_id
      ORDER BY p.payment_date DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET all payments (with filters)
router.get('/', async (req, res) => {
  try {
    const { status, method, customer_id } = req.query
    let sql = `
      SELECT p.*, COALESCE(p.method, 'razorpay') AS method, c.name AS customer_name
      FROM payments p
      JOIN customers c ON p.customer_id = c.customer_id
      WHERE 1=1`
    const params = []
    if (status)      { sql += ' AND p.status = ?';      params.push(status) }
    if (method)      { sql += ' AND p.method = ?';      params.push(method) }
    if (customer_id) { sql += ' AND p.customer_id = ?'; params.push(customer_id) }
    sql += ' ORDER BY p.payment_date DESC'
    const [rows] = await db.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET single payment
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name AS customer_name, c.email, c.phone
       FROM payments p JOIN customers c ON p.customer_id = c.customer_id
       WHERE p.payment_id = ?`, [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: 'Payment not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST record a payment
router.post('/', async (req, res) => {
  const { order_id, customer_id, amount, method, transaction_id, bank_ref, invoice_no, due_date, notes } = req.body
  if (!order_id || !customer_id || !amount) {
    return res.status(400).json({ message: 'order_id, customer_id and amount are required' })
  }
  try {
    const [result] = await db.query(
      `INSERT INTO payments (order_id, customer_id, amount, method, transaction_id, bank_ref, invoice_no, due_date, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,'completed')`,
      [order_id, customer_id, amount, method||'upi', transaction_id, bank_ref,
       invoice_no || `INV-${Date.now().toString().slice(-6)}`, due_date, notes]
    )
    res.status(201).json({ payment_id: result.insertId, message: 'Payment recorded successfully' })
    req.io?.emit('dashboard_update');
    req.io?.emit('payment_completed'); // triggers revenue refresh
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH update payment status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  const valid = ['pending','completed','failed','refunded']
  if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' })
  try {
    await db.query('UPDATE payments SET status = ? WHERE payment_id = ?', [status, req.params.id])
    res.json({ message: 'Payment status updated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET monthly revenue report
router.get('/report/monthly', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(payment_date, '%b %Y') AS month,
        DATE_FORMAT(payment_date, '%Y-%m') AS sort_key,
        SUM(amount)  AS total_revenue,
        COUNT(*)     AS transaction_count,
        AVG(amount)  AS avg_transaction
      FROM payments
      WHERE status = 'completed'
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY sort_key DESC
      LIMIT 12
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET revenue summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const [total] = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS total_revenue,
        COUNT(*) AS total_payments,
        COALESCE(SUM(CASE WHEN MONTH(payment_date) = MONTH(CURDATE()) AND YEAR(payment_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS this_month,
        COALESCE(SUM(CASE WHEN MONTH(payment_date) = MONTH(CURDATE())-1 AND YEAR(payment_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS last_month
      FROM payments WHERE status = 'completed'
    `)
    const row = total[0]
    const pct = row.last_month > 0
      ? Math.round(((row.this_month - row.last_month) / row.last_month) * 100)
      : 0
    res.json({
      total_revenue: Number(row.total_revenue) || 0,
      total_payments: Number(row.total_payments) || 0,
      this_month: Number(row.this_month) || 0,
      last_month: Number(row.last_month) || 0,
      month_change_pct: pct
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router