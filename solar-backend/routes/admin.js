const express = require('express')
const router  = express.Router()
const db      = require('../config/db')
const auth    = require('../middleware/auth')




// Middleware to check admin role
const adminOnly = async (req, res, next) => {
  try {
    // Verify user is admin (extend this based on your auth implementation)
    const userRole = req.user?.role || 'user'
    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({ success: false, message: 'Admin access required' })
    }
    next()
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD METRICS
// ═══════════════════════════════════════════════════════════════

// DASHBOARD ROUTE (UPDATED - SAFE + SYNCED)

router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    console.log("Dashboard API hit");

    // Orders + Revenue
    const [[orders]] = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount),0) as total_revenue
      FROM orders
      WHERE status != 'cancelled'
    `);

    // Customers
    const [[customers]] = await db.query(`
      SELECT COUNT(*) as total_customers FROM customers
    `);

    // Low stock
    const [lowStock] = await db.query(`
      SELECT product_id, product_name, stock_quantity
      FROM products
      WHERE stock_quantity <= 10
      ORDER BY stock_quantity ASC
    `);

    // Monthly revenue
    const [monthlyRevenue] = await db.query(`
      SELECT DATE_FORMAT(order_date,'%b') as month,
             COALESCE(SUM(total_amount),0) as revenue
      FROM orders
      WHERE order_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      AND status != 'cancelled'
      GROUP BY DATE_FORMAT(order_date,'%Y-%m')
      ORDER BY MIN(order_date)
    `);

    // Top products (safe)
    let topProducts = [];
    try {
      const [rows] = await db.query(`
        SELECT p.product_id, p.product_name,
               SUM(oi.quantity) as total_sold,
               SUM(oi.quantity * oi.unit_price) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        GROUP BY p.product_id
        ORDER BY total_sold DESC
        LIMIT 5
      `);
      topProducts = rows;
    } catch (err) {
      console.log("⚠️ order_items table missing or not ready");
    }

    res.json({
      success: true,
      data: {
        summary: {
          total_orders: orders.total_orders || 0,
          total_revenue: orders.total_revenue || 0,
          total_customers: customers.total_customers || 0,
          low_stock_items: lowStock.length
        },
        monthly_revenue: monthlyRevenue || [],
        top_products: topProducts || [],
        low_stock_products: lowStock || []
      }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
// ═══════════════════════════════════════════════════════════════
// PRODUCTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get('/products', auth, adminOnly, async (req, res) => {
  try {
    const { search, category, status } = req.query
    let sql = 'SELECT p.*, s.company_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id WHERE 1=1'
    const params = []
    
    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.brand LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    if (category) {
      sql += ' AND p.category = ?'
      params.push(category)
    }
    if (status) {
      sql += ' AND p.is_active = ?'
      params.push(status === 'active' ? 1 : 0)
    }
    
    sql += ' ORDER BY p.created_at DESC'
    const [products] = await db.query(sql, params)
    
    res.json({ success: true, count: products.length, data: products })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/products', auth, adminOnly, async (req, res) => {
  const { supplier_id, product_name, model_number, category, brand, wattage, efficiency,
          warranty_years, price, mrp, stock_quantity, description } = req.body
  
  try {
    const [result] = await db.query(
      `INSERT INTO products (supplier_id, product_name, model_number, category, brand, wattage,
        efficiency, warranty_years, price, mrp, stock_quantity, description, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [supplier_id, product_name, model_number, category, brand, wattage||0, efficiency||0,
       warranty_years||10, price, mrp||price, stock_quantity||0, description]
    )
    
    req.io?.emit('product_added', { product_id: result.insertId, product_name })
    
    res.status(201).json({ success: true, message: 'Product created', insertId: result.insertId })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/products/:id', auth, adminOnly, async (req, res) => {
  const { product_name, price, mrp, stock_quantity, description, is_active } = req.body
  
  try {
    await db.query(
      `UPDATE products SET product_name=?, price=?, mrp=?, stock_quantity=?, description=?, is_active=?
       WHERE product_id=?`,
      [product_name, price, mrp, stock_quantity, description, is_active, req.params.id]
    )
    
    req.io?.emit('product_updated', { product_id: req.params.id, product_name })
    res.json({ success: true, message: 'Product updated' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/products/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE product_id = ?', [req.params.id])
    req.io?.emit('product_deleted', { product_id: req.params.id })
    res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get('/customers', auth, adminOnly, async (req, res) => {
  try {
    const { search, city } = req.query
    let sql = 'SELECT * FROM customers WHERE 1=1'
    const params = []
    
    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (city) {
      sql += ' AND city = ?'
      params.push(city)
    }
    
    sql += ' ORDER BY created_at DESC'
    const [customers] = await db.query(sql, params)
    
    res.json({ success: true, count: customers.length, data: customers })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/customers/:id', auth, adminOnly, async (req, res) => {
  try {
    const [customer] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id])
    if (!customer.length) return res.status(404).json({ success: false, message: 'Customer not found' })
    
    // Get customer orders
    const [orders] = await db.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC', [req.params.id])
    
    res.json({ success: true, data: { ...customer[0], orders } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/customers/:id', auth, adminOnly, async (req, res) => {
  const { name, email, phone, address, city, state, pincode } = req.body
  
  try {
    await db.query(
      'UPDATE customers SET name=?, email=?, phone=?, address=?, city=?, state=?, pincode=? WHERE customer_id=?',
      [name, email, phone, address, city, state, pincode, req.params.id]
    )
    
    res.json({ success: true, message: 'Customer updated' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/customers/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id])
    res.json({ success: true, message: 'Customer deleted' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// ORDERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get('/orders', auth, adminOnly, async (req, res) => {
  try {
    const { status, from, to } = req.query
    let sql = `SELECT o.*, c.name as customer_name, c.email, COUNT(oi.item_id) as item_count
               FROM orders o
               JOIN customers c ON o.customer_id = c.customer_id
               LEFT JOIN order_items oi ON o.order_id = oi.order_id
               WHERE 1=1`
    const params = []
    
    if (status) {
      sql += ' AND o.status = ?'
      params.push(status)
    }
    if (from) {
      sql += ' AND o.order_date >= ?'
      params.push(from)
    }
    if (to) {
      sql += ' AND o.order_date <= ?'
      params.push(to)
    }
    
    sql += ' GROUP BY o.order_id ORDER BY o.order_date DESC'
    const [orders] = await db.query(sql, params)
    
    res.json({ success: true, count: orders.length, data: orders })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.patch('/orders/:id/status', auth, adminOnly, async (req, res) => {
  const { status } = req.body
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'installed', 'cancelled']
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' })
  }
  
  try {
    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, req.params.id])
    req.io?.emit('order_status_updated', { order_id: req.params.id, status })
    res.json({ success: true, message: 'Order status updated' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// SUPPLIERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get('/suppliers', auth, adminOnly, async (req, res) => {
  try {
    const [suppliers] = await db.query('SELECT * FROM suppliers ORDER BY company_name')
    res.json({ success: true, count: suppliers.length, data: suppliers })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/suppliers', auth, adminOnly, async (req, res) => {
  const { company_name, contact_person, email, phone, address, city, gst_number, pan_number } = req.body
  
  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (company_name, contact_person, email, phone, address, city, gst_number, pan_number) VALUES (?,?,?,?,?,?,?,?)',
      [company_name, contact_person, email, phone, address, city, gst_number, pan_number]
    )
    
    res.status(201).json({ success: true, message: 'Supplier created', insertId: result.insertId })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/suppliers/:id', auth, adminOnly, async (req, res) => {
  const { company_name, contact_person, email, phone, address, city } = req.body
  
  try {
    await db.query(
      'UPDATE suppliers SET company_name=?, contact_person=?, email=?, phone=?, address=?, city=? WHERE supplier_id=?',
      [company_name, contact_person, email, phone, address, city, req.params.id]
    )
    
    res.json({ success: true, message: 'Supplier updated' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/suppliers/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM suppliers WHERE supplier_id = ?', [req.params.id])
    res.json({ success: true, message: 'Supplier deleted' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// PAYMENTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get('/payments', auth, adminOnly, async (req, res) => {
  try {
    const { status, method } = req.query
    let sql = `SELECT p.*, c.name as customer_name, c.email FROM payments p
               JOIN customers c ON p.customer_id = c.customer_id WHERE 1=1`
    const params = []
    
    if (status) {
      sql += ' AND p.status = ?'
      params.push(status)
    }
    if (method) {
      sql += ' AND p.method = ?'
      params.push(method)
    }
    
    sql += ' ORDER BY p.payment_date DESC'
    const [payments] = await db.query(sql, params)
    
    res.json({ success: true, count: payments.length, data: payments })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router


const axios = require('axios')