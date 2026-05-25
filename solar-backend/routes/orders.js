const express = require('express')
const router  = express.Router()
const db      = require('../config/db')
const { sendOrderConfirmation } = require('../config/email')
const auth = require('../middleware/auth');
// GET summary (for admin)
router.get('/summary',auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*, c.name AS customer_name, c.phone, c.city
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      ORDER BY o.order_date DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET all orders
router.get('/', async (req, res) => {
  try {
    const { status, customer_id } = req.query
    let sql = `SELECT o.*, c.name AS customer_name FROM orders o
               JOIN customers c ON o.customer_id = c.customer_id WHERE 1=1`
    const params = []
    if (status)      { sql += ' AND o.status = ?';      params.push(status) }
    if (customer_id) { sql += ' AND o.customer_id = ?'; params.push(customer_id) }
    sql += ' ORDER BY o.order_date DESC'
    const [rows] = await db.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET single order with items
router.get('/:id', async (req, res) => {
  try {
    const [order] = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email, c.phone FROM orders o
       JOIN customers c ON o.customer_id = c.customer_id WHERE o.order_id = ?`, [req.params.id])
    if (!order.length) return res.status(404).json({ message: 'Order not found' })
    const [items] = await db.query(
      `SELECT oi.*, p.product_name FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?`, [req.params.id])
    res.json({ ...order[0], items })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST create order
router.post('/', async (req, res) => {
  const { customer_id, system_size_kw, subtotal, gst_amount, subsidy_amount, discount, total_amount, notes, items } = req.body
  if (!customer_id || !total_amount) {
    return res.status(400).json({ message: 'customer_id and total_amount are required' })
  }
  const conn = await db.pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      `INSERT INTO orders (customer_id, system_size_kw, subtotal, gst_amount, subsidy_amount, discount, total_amount, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [customer_id, system_size_kw||0, subtotal||total_amount, gst_amount||0, subsidy_amount||0, discount||0, total_amount, notes]
    )
    const orderId = result.insertId

    // Insert order items
    if (items?.length) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)',
          [orderId, item.product_id, item.quantity, item.unit_price]
        )
        // Decrease stock
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        )
      }
    }

    await conn.commit()
    req.io?.emit('dashboard_update');
    req.io?.emit('product_updated'); // refresh stock counts
    req.io?.emit('order_status_updated');

    // Send confirmation email
    const [cust] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [customer_id])
    if (cust.length) sendOrderConfirmation({ order_id: orderId, system_size_kw, total_amount, subsidy_amount }, cust[0])

    res.status(201).json({ order_id: orderId, message: 'Order created successfully' })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ message: err.message })
  } finally {
    conn.release()
  }
})

// PUT update order status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  const valid = ['pending','confirmed','in_progress','installed','cancelled']
  if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' })
  try {
    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, req.params.id])
    res.json({ message: 'Order status updated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET revenue stats
router.get('/stats/revenue', async (req, res) => {
  try {
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(order_date,'%Y-%m') AS month,
             SUM(total_amount) AS revenue, COUNT(*) AS count
      FROM orders WHERE status != 'cancelled'
      GROUP BY month ORDER BY month DESC LIMIT 12
    `)
    const [total] = await db.query('SELECT SUM(total_amount) AS total FROM orders WHERE status != "cancelled"')
    res.json({ monthly, total: total[0].total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router