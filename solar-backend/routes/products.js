const express = require('express')
const router  = express.Router()
const db      = require('../config/db')
const auth    = require('../middleware/auth')

// GET all products (with supplier name & real-time stock)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query
    let sql = `
      SELECT p.*, s.company_name AS supplier_name,
             CASE 
               WHEN p.stock_quantity > 20 THEN 'in_stock'
               WHEN p.stock_quantity > 0 THEN 'low_stock'
               ELSE 'out_of_stock'
             END AS stock_status
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
      WHERE p.is_active = 1`
    const params = []
    
    if (category && category !== 'all') {
      sql += ' AND p.category = ?'
      params.push(category)
    }
    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.brand LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    sql += ' ORDER BY p.category, p.product_name'
    const [rows] = await db.query(sql, params)
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET single product with full details
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, s.company_name, s.phone as supplier_phone,
              CASE 
                WHEN p.stock_quantity > 20 THEN 'in_stock'
                WHEN p.stock_quantity > 0 THEN 'low_stock'
                ELSE 'out_of_stock'
              END AS stock_status
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
       WHERE p.product_id = ?`, [req.params.id])
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' })
    res.json({ success: true, data: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST create product (Admin only)
router.post('/', auth, async (req, res) => {
  const { supplier_id, product_name, model_number, category, brand, wattage, efficiency,
          warranty_years, price, mrp, stock_quantity, description } = req.body
  
  if (!product_name || !category || !price) {
    return res.status(400).json({ success: false, message: 'product_name, category and price are required' })
  }
  
  try {
    const [result] = await db.query(
      `INSERT INTO products (supplier_id, product_name, model_number, category, brand, wattage,
        efficiency, warranty_years, price, mrp, stock_quantity, description, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [supplier_id, product_name, model_number, category, brand, wattage||0, efficiency||0,
       warranty_years||10, price, mrp||price, stock_quantity||0, description]
    )
    
    // Broadcast product addition
    req.io?.emit('product_added', {
      product_id: result.insertId,
      product_name,
      stock_quantity: stock_quantity || 0
    })
    
    res.status(201).json({ 
      success: true,
      message: 'Product created',
      insertId: result.insertId 
    })
    req.io?.emit('dashboard_update');
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PATCH update stock with real-time broadcast
router.patch('/:id/stock', auth, async (req, res) => {
  const { qty, reason = 'adjustment' } = req.body
  
  try {
    // Get current stock
    const [current] = await db.query(
      'SELECT stock_quantity, product_name FROM products WHERE product_id = ?',
      [req.params.id]
    )
    
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }
    
    const oldQty = current[0].stock_quantity
    const newQty = oldQty + qty
    
    // Validate stock doesn't go negative
    if (newQty < 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reduce stock below 0. Current: ${oldQty}, Attempting to reduce by: ${Math.abs(qty)}`
      })
    }
    
    // Update stock
    await db.query(
      'UPDATE products SET stock_quantity = ? WHERE product_id = ?',
      [newQty, req.params.id]
    )
    
    // Record in history
    await db.query(
      `INSERT INTO stock_history (product_id, old_quantity, new_quantity, change_reason, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, oldQty, newQty, reason, req.user?.employee_id || null]
    )
    
    // Get product for broadcast
    const [product] = await db.query('SELECT * FROM products WHERE product_id = ?', [req.params.id])
    const stockStatus = newQty > 20 ? 'in_stock' : (newQty > 0 ? 'low_stock' : 'out_of_stock')
    
    // Broadcast stock update in real-time
    req.io?.to(`product_${req.params.id}`).emit('stock_updated', {
      product_id: req.params.id,
      product_name: current[0].product_name,
      old_quantity: oldQty,
      new_quantity: newQty,
      stock_status: stockStatus,
      timestamp: new Date().toISOString()
    })
    
    // Alert if stock is low
    if (newQty <= 5 && newQty > 0) {
      req.io?.emit('low_stock_alert', {
        product_id: req.params.id,
        product_name: current[0].product_name,
        stock_quantity: newQty
      })
    }
    
    // Alert if out of stock
    if (newQty === 0 && oldQty > 0) {
      req.io?.emit('out_of_stock_alert', {
        product_id: req.params.id,
        product_name: current[0].product_name
      })
    }
    
    res.json({ 
      success: true,
      message: 'Stock updated',
      data: {
        product_id: req.params.id,
        old_quantity: oldQty,
        new_quantity: newQty,
        stock_status: stockStatus
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT full update product
router.put('/:id', auth, async (req, res) => {
  const { product_name, price, mrp, stock_quantity, description, is_active, category, brand } = req.body
  try {
    // Build dynamic update — only set fields that were actually sent
    const fields = []
    const values = []

    if (product_name  !== undefined) { fields.push('product_name=?');   values.push(product_name) }
    if (category      !== undefined) { fields.push('category=?');        values.push(category) }
    if (brand         !== undefined) { fields.push('brand=?');           values.push(brand) }
    if (price         !== undefined) { fields.push('price=?');           values.push(price) }
    if (mrp           !== undefined) { fields.push('mrp=?');             values.push(mrp) }
    if (stock_quantity !== undefined){ fields.push('stock_quantity=?');  values.push(stock_quantity) }
    if (description   !== undefined) { fields.push('description=?');     values.push(description) }
    if (is_active     !== undefined) { fields.push('is_active=?');       values.push(is_active ? 1 : 0) }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' })
    }

    values.push(req.params.id)
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE product_id=?`, values)

    // Broadcast product update
    req.io?.emit('product_updated', { product_id: req.params.id, product_name, price, stock_quantity, is_active })

    res.json({ success: true, message: 'Product updated' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE product
router.delete('/:id', auth, async (req, res) => {
  try {
    const [product] = await db.query(
      'SELECT product_name FROM products WHERE product_id = ?',
      [req.params.id]
    )
    
    if (!product.length) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }
    
    await db.query('DELETE FROM products WHERE product_id = ?', [req.params.id])
    
    // Broadcast product deletion
    req.io?.emit('product_deleted', {
      product_id: req.params.id,
      product_name: product[0].product_name
    })
    
    res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Error deleting product' })
  }
})

// GET product stock status for real-time monitoring
router.get('/:id/stock-status', async (req, res) => {
  try {
    const [product] = await db.query(
      `SELECT product_id, product_name, stock_quantity,
              CASE 
                WHEN stock_quantity > 20 THEN 'in_stock'
                WHEN stock_quantity > 0 THEN 'low_stock'
                ELSE 'out_of_stock'
              END AS stock_status
       FROM products WHERE product_id = ?`,
      [req.params.id]
    )
    
    if (!product.length) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }
    
    res.json({ success: true, data: product[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET stock history for admin
router.get('/:id/history', auth, async (req, res) => {
  try {
    const [history] = await db.query(
      `SELECT sh.*, p.product_name, e.name as changed_by_name
       FROM stock_history sh
       LEFT JOIN products p ON sh.product_id = p.product_id
       LEFT JOIN employees e ON sh.changed_by = e.employee_id
       WHERE sh.product_id = ?
       ORDER BY sh.changed_at DESC
       LIMIT 50`,
      [req.params.id]
    )
    
    res.json({ success: true, data: history })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router