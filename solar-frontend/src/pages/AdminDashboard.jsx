import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useToast } from '../App'
import styles from './AdminDashboard.module.css'
import { io } from 'socket.io-client'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// ─── Helpers ─────────────────────────────────────────────────
function tabIcon(t) {
  const icons = { Dashboard:'📊', Customers:'👥', Suppliers:'🏭', Products:'📦', Orders:'🛒', Installations:'🔧', Payments:'💳', Enquiries:'📩' }
  return icons[t] || '📋'
}

const StatusBadge = ({ s }) => {
  const map = {
    active:'badge-green', completed:'badge-green', installed:'badge-green', received:'badge-green',
    pending:'badge-amber', applied:'badge-amber', confirmed:'badge-blue', in_progress:'badge-blue',
    scheduled:'badge-blue', inactive:'badge-red', failed:'badge-red', cancelled:'badge-red',
  }
  return <span className={`badge ${map[s] || 'badge-amber'}`}>{s?.replace('_',' ')}</span>
}

const TABS = ['Dashboard','Customers','Suppliers','Products','Orders','Installations','Payments','Enquiries']

// ─── Reusable Table Wrapper ───────────────────────────────────
function DataTable({ heads, children, loading }) {
  return (
    <div className={styles.tableWrap}>
      {loading && <div className={styles.loading}>Loading data…</div>}
      <table className={styles.table}>
        <thead><tr>{heads.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ─── Modal for Add/Edit ───────────────────────────────────────
function AddModal({ title, fields, onSave, onClose, initialData }) {
  const [form, setForm] = useState(initialData || {})

  useEffect(() => {
    setForm(initialData || {})
  }, [initialData])

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h3>➕ {title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            {fields.map(f => (
              <div key={f.key} className={styles.mField}>
                <label>{f.label}</label>

                {f.type === 'select'
                  ? (
                    <select
                      value={form[f.key] ?? ''}
                      onChange={e => {
                        let val = e.target.value
                        if (val === 'true') val = true
                        else if (val === 'false') val = false
                        setForm(p => ({ ...p, [f.key]: val }))
                      }}
                    >
                      <option value="">Select</option>
                      {f.options?.map(o => {
                        const isObj = o !== null && typeof o === 'object'
                        const val = isObj ? o.value : o
                        const label = isObj ? o.label : String(o)
                        return <option key={String(val)} value={String(val)}>{label}</option>
                      })}
                    </select>
                  )
                  : (
                    <input
                      type={f.type || 'text'}
                      placeholder={f.placeholder || ''}
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )
                }
              </div>
            ))}
          </div>

          <div className={styles.modalActions}>
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={async () => {
                await onSave(form)
                onClose()
              }}
            >
              Save Record
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function AdminDashboard() {

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const toast = useToast()
  const [tab, setTab] = useState('Dashboard')
  const [data, setData] = useState({
    customers: [],
    suppliers: [],
    products: [],
    orders: [],
    installations: [],
    payments: [],
    enquiries: [],
  })
  const [loading, setLoading] = useState(false)
  const [addModal, setAddModal] = useState(null)
  const [viewCustomer, setViewCustomer] = useState(null)
  const [viewSupplier, setViewSupplier] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)
  const [viewOrder, setViewOrder] = useState(null)
  const [viewEnquiry, setViewEnquiry] = useState(null)
  const [viewInstallation, setViewInstallation] = useState(null)
  const [viewPayment, setViewPayment] = useState(null)
  const [orderPaymentMethod, setOrderPaymentMethod] = useState(null) // null | 'upi' | 'card'
  const [revenue, setRevenue] = useState({ total_revenue: 0, this_month: 0, month_change_pct: 0 })

  const handleViewCustomer = async (id) => {
    try {
      const res = await api.get(`/customers/${id}`)
      setViewCustomer(res.data)
    } catch (err) {
      console.error(err)
      toast("Error loading customer ❌")
    }
  }

  const generateInvoice = (order) => {
    const doc = new jsPDF()
    doc.setFontSize(22)
    doc.setTextColor(24, 24, 27)
    doc.text('INVOICE', 14, 22)

    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text(`Order ID: ORD-${String(order.order_id).padStart(3, '0')}`, 14, 32)
    doc.text(`Date: ${order.order_date?.slice(0, 10) || new Date().toISOString().slice(0, 10)}`, 14, 38)
    doc.text(`Status: ${order.status.toUpperCase()}`, 14, 44)

    doc.text('Billed To:', 14, 56)
    doc.setTextColor(24, 24, 27)
    doc.text(order.customer_name || 'Customer', 14, 62)

    doc.autoTable({
      startY: 75,
      head: [['Description', 'Amount']],
      body: [
        [`Order for ${order.customer_name}`, `Rs. ${Number(order.total_amount).toLocaleString('en-IN')}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    })

    const finalY = doc.lastAutoTable.finalY || 75
    doc.setFontSize(14)
    doc.text(`Total: Rs. ${Number(order.total_amount).toLocaleString('en-IN')}`, 14, finalY + 15)

    doc.save(`Invoice_ORD-${String(order.order_id).padStart(3, '0')}.pdf`)
    toast('Invoice downloaded! 📄')
  }

  const fetchRevenue = async () => {
    try {
      const res = await api.get('/payments/summary')
      const d = res.data
      setRevenue({
        total_revenue: Number(d.total_revenue) || 0,
        this_month: Number(d.this_month) || 0,
        last_month: Number(d.last_month) || 0,
        month_change_pct: Number(d.month_change_pct) || 0,
        total_payments: Number(d.total_payments) || 0,
      })
    } catch (err) { console.error('Revenue fetch error:', err) }
  }

  const fetchAllData = async () => {
    setLoading(true);
    fetchRevenue();

    try {
      const [cust, supp, prod, ord, inst, pay, enq] = await Promise.all([
        api.get('/customers'),
        api.get('/suppliers'),
        api.get('/admin/products'),
        api.get('/orders'),
        api.get('/installations'),
        api.get('/payments'),
        api.get('/enquiries'),
      ]);

      setData({
        customers: cust.data || [],
        suppliers: supp.data || [],
        products: prod.data?.data || prod.data || [],
        orders: ord.data || [],
        installations: inst.data || [],
        payments: pay.data || [],
        enquiries: enq.data || [],
      });

    } catch (err) {
      console.error("API ERROR:", err.response?.data || err.message);
      toast("Backend error or unauthorized ❌");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    const socket = io('http://localhost:5000');

    // Refresh data on any backend event
    const refresh = () => { fetchAllData(); };
    socket.on('dashboard_update', refresh);
    socket.on('product_updated', refresh);
    socket.on('product_added', refresh);
    socket.on('product_deleted', refresh);
    socket.on('order_status_updated', refresh);
    socket.on('low_stock_alert', refresh);
    socket.on('out_of_stock_alert', refresh);
    socket.on('payment_completed', () => { fetchRevenue(); fetchAllData(); });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const handleDeleteSupplier = async (id) => {

  const confirmDelete = window.confirm(
    "Are you sure you want to delete this supplier?"
  )

  if (!confirmDelete) return

  try {

    const token = localStorage.getItem("token")

    const res = await api.delete(`/suppliers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    console.log("DELETE RESPONSE:", res.data)

    toast("Supplier deleted successfully ✅")

    setViewSupplier(null)

    fetchAllData()

  } catch (err) {

    console.log("DELETE ERROR:", err.response?.data || err)

    toast("Delete failed ❌")
  }
}

 const handleViewSupplier = async (id) => {

  try {

    const res = await api.get(`/suppliers/${id}`)

    console.log("SUPPLIER RESPONSE:", res.data)

    if (res.data) {
      setViewSupplier(res.data)
    }

  } catch (err) {

    console.log("SUPPLIER ERROR:", err)

    toast("Error loading supplier ❌")
  }
}

  const handleViewProduct = async (id) => {
    try {
      const res = await api.get(`/products/${id}`)
      setViewProduct(res.data?.data || res.data)
    } catch (err) {
      console.error(err)
      toast("Error loading product ❌")
    }
  }

  const handleDeleteProduct = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this product?")
    if (!confirm) return

    try {
      await api.delete(`/products/${id}`)
      toast("Product deleted 🗑")
      fetchAllData()
    } catch (err) {
      console.error(err)
      toast("Cannot delete product ❌")
    }
  }

  const handleViewOrder = async (id) => {
    try {
      const res = await api.get(`/orders/${id}`)
      setViewOrder(res.data)
    } catch (err) {
      toast("Error loading order ❌")
    }
  }

  const handleDeleteOrder = async (id) => {
    if (!window.confirm("Delete order?")) return
    try {
      await api.delete(`/orders/${id}`)
      toast("Order deleted 🗑")
      fetchAllData()
    } catch (err) {
      toast("Cannot delete order ❌")
    }
  }

  const handleViewEnquiry = async (id) => {
    try {
      const res = await api.get(`/enquiries/${id}`)
      setViewEnquiry(res.data)
    } catch (err) {
      toast("Error loading enquiry ❌")
    }
  }

  const handleDeleteEnquiry = async (id) => {
    if (!window.confirm("Delete enquiry?")) return
    try {
      await api.delete(`/enquiries/${id}`)
      toast("Enquiry deleted 🗑")
      fetchAllData()
    } catch (err) {
      toast("Cannot delete enquiry ❌")
    }
  }

  const metrics = [
    { label: 'Total Revenue',
      value: revenue.total_revenue >= 10000000
        ? `₹${(revenue.total_revenue/10000000).toFixed(1)} Cr`
        : revenue.total_revenue >= 100000
        ? `₹${(revenue.total_revenue/100000).toFixed(1)} L`
        : `₹${Number(revenue.total_revenue).toLocaleString('en-IN')}`,
      sub: revenue.month_change_pct >= 0
        ? `↑ ${revenue.month_change_pct}% this month`
        : `↓ ${Math.abs(revenue.month_change_pct)}% this month`,
      color: 'var(--primary)' },
    { label: 'Active Orders', value: data.orders?.filter(o => o.status !== 'installed' && o.status !== 'cancelled').length || 0, sub: '↑ 12 new this week', color: '#60A5FA' },
    { label: 'Completed Installs', value: data.installations?.filter(i => i.status === 'completed').length || 0, sub: 'Total finished', color: 'var(--accent)' },
    { label: 'Total Customers', value: data.customers?.length || 0, sub: 'Registered', color: '#A78BFA' },
    { label: 'Pending Enquiries', value: data.enquiries?.filter(e => !e.is_responded).length || 0, sub: 'Needs follow-up', color: 'var(--red)' },
    { label: 'Products in Stock', value: data.products?.reduce((s, p) => s + (+p.stock_quantity || 0), 0) || 0, sub: 'Total units', color: 'var(--primary)' },
  ]

  // Add modals config
  const ADD_CONFIGS = {
    Customers: {
      title: 'New Customer',
      fields: [
        { key: 'name', label: 'Full Name', placeholder: 'Rajesh Kumar' },
        { key: 'email', label: 'Email', placeholder: 'rajesh@email.com' },
        { key: 'phone', label: 'Phone', placeholder: '9876543210' },
        { key: 'address', label: 'Address', placeholder: 'Full address' },
        { key: 'pincode', label: 'Pincode', placeholder: '413501' },
        { key: 'city', label: 'City', placeholder: 'Nagpur' },
        { key: 'property_type', label: 'Property Type', type: 'select', options: ['residential', 'commercial', 'industrial'] },
      ],
      onSave: async (rec) => {
        try {
          await api.post('/customers', rec)
          const res = await api.get('/customers')
          setData(d => ({ ...d, customers: res.data }))
          toast("Customer added successfully! ✅", '👥')
        } catch (err) {
          console.error(err)
          const msg = err.response?.data?.message || "Error adding customer"
          toast(`${msg} ❌`)
        }
      }
    },

Suppliers: {
  title: 'Add Supplier',

  fields: [
    {
      key: 'company_name',
      label: 'Company Name',
      placeholder: 'Exide Industries'
    },

    {
      key: 'contact_person',
      label: 'Contact Person',
      placeholder: 'Mr. Roy'
    },

    {
      key: 'email',
      label: 'Email',
      placeholder: 'supplier@email.com'
    },

    {
      key: 'phone',
      label: 'Phone',
      placeholder: '9876543210'
    },

    {
      key: 'address',
      label: 'Address',
      placeholder: 'Full Address'
    },

    {
      key: 'city',
      label: 'City',
      placeholder: 'Pune'
    },

    {
      key: 'gst_number',
      label: 'GST Number',
      placeholder: '27ABCDE1234F1Z5'
    },

    {
      key: 'pan_number',
      label: 'PAN Number',
      placeholder: 'ABCDE1234F'
    }
  ],

  onSave: async (rec) => {

    try {

      const token = localStorage.getItem("token")

      await api.post('/suppliers', rec, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const res = await api.get('/suppliers')

      setData(d => ({
        ...d,
        suppliers: res.data
      }))

      toast("Supplier added successfully ✅")

    } catch (err) {

      console.log(err)

      toast(
        err.response?.data?.message ||
        "Failed to add supplier ❌"
      )
    }
  }
},












    Orders: {
      title: 'New Order',
      fields: [
        { key: 'customer_id', label: 'Customer', type: 'select',
          options: (data.customers || []).map(c => ({ label: `${c.name} (ID: ${c.customer_id})`, value: c.customer_id })) },
        { key: 'system_size_kw', label: 'System Size (kW)', type: 'number', placeholder: '5' },
        { key: 'total_amount', label: 'Total Amount (₹)', type: 'number', placeholder: '247000' },
      ],
      onSave: async (rec) => {
        try {
          await api.post('/orders', {
            ...rec,
            customer_id: Number(rec.customer_id),
            system_size_kw: Number(rec.system_size_kw) || 0,
            total_amount: Number(rec.total_amount),
          })
          const res = await api.get('/orders')
          setData(d => ({ ...d, orders: res.data }))
          toast("Order added successfully! ✅", '🛒')
        } catch (err) {
          console.error(err)
          const msg = err.response?.data?.message || "Error adding order"
          toast(`${msg} ❌`)
        }
      }
    },

    Enquiries: {
      title: 'New Enquiry',
      fields: [
        { key: 'name', label: 'Name', placeholder: 'Customer name' },
        { key: 'phone', label: 'Phone', placeholder: '9876543210' },
        { key: 'email', label: 'Email', placeholder: 'email@example.com' },
        { key: 'service_type', label: 'Service', type: 'select', options: ['Residential Solar', 'Commercial Solar', 'Industrial Solar', 'AMC', 'Subsidy Help'] },
        { key: 'monthly_bill', label: 'Monthly Bill', type: 'number', placeholder: '3500' },
      ],
      onSave: async (rec) => {
        try {
          await api.post('/enquiries', rec)
          const res = await api.get('/enquiries')
          setData(d => ({ ...d, enquiries: res.data }))
          toast("Enquiry added successfully! ✅", '📩')
        } catch (err) {
          console.error(err)
          const msg = err.response?.data?.message || "Error adding enquiry"
          toast(`${msg} ❌`)
        }
      }
    },
  }

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.sideLogoWrap}>
          <div className={styles.sideLogo}>☀</div>
          <div>
            <div className={styles.sideLogoText}>SolarTech Pro</div>
            <div className={styles.sideLogoSub}>Admin Panel</div>
          </div>
        </Link>
        <nav className={styles.sideNav}>
          {TABS.map(t => (
            <button
              key={t}
              className={`${styles.navItem} ${tab === t ? styles.navActive : ''}`}
              onClick={() => setTab(t)}
            >
              {tabIcon(t)} {t}
            </button>
          ))}
        </nav>
        <Link to="/" className={styles.sideBack}>← Back to Website</Link>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>{tab}</h1>
            <p className={styles.pageSub}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className={styles.topActions}>
            <button className="btn-outline" onClick={() => {
              const tabDataMap = {
                Customers: data.customers,
                Suppliers: data.suppliers,
                Products: data.products,
                Orders: data.orders,
                Installations: data.installations,
                Payments: data.payments,
                Enquiries: data.enquiries,
              }
              const rows = tabDataMap[tab]
              if (!rows || rows.length === 0) {
                toast('No data to export', '⚠')
                return
              }
              const headers = Object.keys(rows[0])
              const csvContent = [
                headers.join(','),
                ...rows.map(row =>
                  headers.map(h => {
                    const val = row[h] == null ? '' : String(row[h])
                    return val.includes(',') || val.includes('"') || val.includes('\n')
                      ? `"${val.replace(/"/g, '""')}"` : val
                  }).join(',')
                )
              ].join('\n')
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${tab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
              toast(`${tab} exported as CSV! ⬇`, '✅')
            }}>⬇ Export CSV</button>
            {ADD_CONFIGS[tab] && (
              <button className="btn-primary" onClick={() => setAddModal(ADD_CONFIGS[tab])}>
                ➕ Add {tab.slice(0, -1)}
              </button>
            )}
            <button className="btn-outline" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* ─── DASHBOARD ─── */}
        {tab === 'Dashboard' && (
          <>
            <div className={styles.metrics}>
              {metrics.map(m => (
                <div key={m.label} className={styles.metricCard}>
                  <div className={styles.mLabel}>{m.label}</div>
                  <div className={styles.mValue} style={{ color: m.color }}>{m.value}</div>
                  <div className={styles.mSub} style={{ color: m.color }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div className={styles.dashGrid}>
              <div className={styles.dashCard}>
                <h3>📦 Recent Orders</h3>
                <DataTable heads={['Order', 'Customer', 'Size', 'Amount', 'Status']}>
                  {data.orders?.slice(0, 5).map(o => (
                    <tr key={o.order_id}>
                      <td className={styles.idCell}>ORD-{String(o.order_id).padStart(3, '0')}</td>
                      <td>{o.customer_name}</td>
                      <td>{o.system_size_kw} kW</td>
                      <td>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                      <td><StatusBadge s={o.status} /></td>
                    </tr>
                  ))}
                </DataTable>
              </div>
              <div className={styles.dashCard}>
                <h3>📩 Recent Enquiries</h3>
                <DataTable heads={['Name', 'Phone', 'Service', 'Status']}>
                  {data.enquiries?.slice(0, 5).map(e => (
                    <tr key={e.enquiry_id}>
                      <td><strong>{e.name}</strong></td>
                      <td>{e.phone}</td>
                      <td>{e.service_type}</td>
                      <td><StatusBadge s={e.is_responded ? 'completed' : 'pending'} /></td>
                    </tr>
                  ))}
                </DataTable>
              </div>
            </div>
          </>
        )}

        {/* ─── CUSTOMERS ─── */}
        {tab === 'Customers' && (
          <DataTable loading={loading} heads={['ID', 'Name', 'Email', 'Phone', 'City', 'Type', 'Joined', 'Action']}>
            {data.customers?.map(c => (
              <tr key={c.customer_id}>
                <td className={styles.idCell}>CUS-{String(c.customer_id).padStart(3, '0')}</td>
                <td><strong>{c.name}</strong></td>
                <td className={styles.mutedCell}>{c.email}</td>
                <td>{c.phone}</td>
                <td>{c.city}</td>
                <td><span className="badge badge-blue">{c.property_type}</span></td>
                <td className={styles.mutedCell}>{c.created_at?.slice(0, 10)}</td>
                <td>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleViewCustomer(c.customer_id)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── SUPPLIERS ─── */}
        {tab === 'Suppliers' && (
          <DataTable loading={loading} heads={['ID', 'Company', 'Contact', 'Email', 'City', 'GST No.', 'Status']}>
            {data.suppliers?.map(s => (
              <tr key={s.supplier_id}>
                <td className={styles.idCell}>SUP-{String(s.supplier_id).padStart(3, '0')}</td>
                <td><strong>{s.company_name}</strong></td>
                <td>{s.contact_person}</td>
                <td className={styles.mutedCell}>{s.email}</td>
                <td>{s.city}</td>
                <td className={styles.mutedCell} style={{ fontSize: '0.75rem' }}>{s.gst_number}</td>
                <td>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleViewSupplier(s.supplier_id)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── PRODUCTS ─── */}
        {tab === 'Products' && (
          <DataTable loading={loading} heads={['ID', 'Product Name', 'Category', 'Brand', 'Price', 'Stock', 'Status', 'Action']}>
            {data.products?.map(p => (
              <tr key={p.product_id}>
                <td className={styles.idCell}>PRD-{String(p.product_id).padStart(3, '0')}</td>
                <td><strong>{p.product_name}</strong></td>
                <td><span className="badge badge-blue">{p.category}</span></td>
                <td>{p.brand}</td>
                <td style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{Number(p.price).toLocaleString('en-IN')}</td>
                <td style={{ color: p.stock_quantity > 20 ? 'var(--accent)' : 'var(--red)' }}>{p.stock_quantity}</td>
                <td><StatusBadge s={p.is_active ? 'active' : 'inactive'} /></td>
                <td>
                  <button className={styles.actionBtn} onClick={() => handleViewProduct(p.product_id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── ORDERS ─── */}
        {tab === 'Orders' && (
          <DataTable loading={loading} heads={['Order ID', 'Customer', 'System', 'Amount', 'Date', 'Status', 'Action']}>
            {data.orders?.map(o => (
              <tr key={o.order_id}>
                <td className={styles.idCell} style={{ color: 'var(--primary)' }}>ORD-{String(o.order_id).padStart(3, '0')}</td>
                <td><strong>{o.customer_name}</strong></td>
                <td>{o.system_size_kw ? `${o.system_size_kw} kW` : 'AMC'}</td>
                <td style={{ fontWeight: 700 }}>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                <td className={styles.mutedCell}>{o.order_date?.slice(0, 10)}</td>
                <td><StatusBadge s={o.status} /></td>
                <td>
                  <button className={styles.actionBtn} onClick={() => handleViewOrder(o.order_id)}>View</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── INSTALLATIONS ─── */}
        {tab === 'Installations' && (
          <DataTable loading={loading} heads={['ID', 'Customer', 'City', 'Capacity', 'Technician', 'Completion', 'Status']}>
            {data.installations?.map(i => (
              <tr key={i.installation_id}>
                <td className={styles.idCell}>INST-{String(i.installation_id).padStart(3, '0')}</td>
                <td><strong>{i.customer_name}</strong></td>
                <td>{i.city}</td>
                <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{i.total_kw} kW</td>
                <td>{i.technician_name}</td>
                <td className={styles.mutedCell}>{i.completion_date?.slice(0, 10) || '—'}</td>
                <td><StatusBadge s={i.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── PAYMENTS ─── */}
        {tab === 'Payments' && (
          <DataTable loading={loading} heads={['Pay ID', 'Order', 'Customer', 'Amount', 'Method', 'Date', 'Status']}>
            {data.payments?.map(p => (
              <tr key={p.payment_id}>
                <td className={styles.idCell} style={{ color: 'var(--primary)' }}>PAY-{String(p.payment_id).padStart(3, '0')}</td>
                <td>ORD-{String(p.order_id).padStart(3, '0')}</td>
                <td><strong>{p.customer_name}</strong></td>
                <td style={{ fontWeight: 700 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                <td>{(() => {
                  const m = (p.method || 'razorpay').toLowerCase()
                  const colors = { upi: '#10B981', razorpay: '#6366F1', card: '#3B82F6', cash: '#F59E0B', neft: '#8B5CF6', rtgs: '#8B5CF6', cheque: '#F97316', emi: '#EC4899' }
                  const color = colors[m] || '#6366F1'
                  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 6, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>{m.toUpperCase()}</span>
                })()}</td>
                <td className={styles.mutedCell}>{p.payment_date?.slice(0, 10)}</td>
                <td><StatusBadge s={p.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* ─── ENQUIRIES ─── */}
        {tab === 'Enquiries' && (
          <DataTable loading={loading} heads={['ID', 'Name', 'Email', 'Phone', 'City', 'Service', 'Amount/Bill', 'Date', 'Responded']}>
            {data.enquiries?.map(e => (
              <tr key={e.enquiry_id}>
                <td className={styles.idCell}>ENQ-{String(e.enquiry_id).padStart(3, '0')}</td>
                <td><strong>{e.name}</strong></td>
                <td className={styles.mutedCell}>{e.email}</td>
                <td>{e.phone}</td>
                <td>{e.city || '—'}</td>
                <td style={{ fontSize: '0.8rem' }}>{e.service_type}</td>
                <td style={{ color: 'var(--primary)' }}>
                  {e.monthly_bill ? `₹${Number(e.monthly_bill).toLocaleString('en-IN')}` : '—'}
                </td>
                <td className={styles.mutedCell}>{e.submitted_at?.slice(0, 10)}</td>
                <td>
                  <StatusBadge s={e.is_responded ? 'completed' : 'pending'} />
                </td>
                <td>
                  <button className={styles.actionBtn} onClick={() => handleViewEnquiry(e.enquiry_id)}>View</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </main>

      {/* CUSTOMER MODAL */}
      {viewCustomer && (
        <div className={styles.overlay} onClick={() => setViewCustomer(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3>👤 Customer Details</h3>
              <button className={styles.closeBtn} onClick={() => setViewCustomer(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.mField}>
                  <label>Name</label>
                  <input value={viewCustomer.name || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Email</label>
                  <input value={viewCustomer.email || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Phone</label>
                  <input value={viewCustomer.phone || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Address</label>
                  <input value={viewCustomer.address || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>City</label>
                  <input value={viewCustomer.city || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Pincode</label>
                  <input value={viewCustomer.pincode || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Property Type</label>
                  <input value={viewCustomer.property_type || ''} readOnly />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className="btn-outline"
                  style={{ color: 'red' }}
                  onClick={() => handleDeleteCustomer(viewCustomer.customer_id)}
                >
                  Delete
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setAddModal({
                      title: "Edit Customer",
                      fields: [
                        { key: 'name', label: 'Full Name' },
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'address', label: 'Address' },
                        { key: 'pincode', label: 'Pincode' },
                        { key: 'city', label: 'City' },
                        { key: 'property_type', label: 'Property Type', type: 'select', options: ['residential', 'commercial', 'industrial'] },
                      ],
                      initialData: viewCustomer,
                      onSave: async (rec) => {
                        try {
                          await api.put(`/customers/${viewCustomer.customer_id}`, rec)
                          toast("Updated ✅")
                          setViewCustomer(null)
                          fetchAllData()
                        } catch (err) {
                          toast("Update failed ❌")
                        }
                      }
                    })
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {viewSupplier && (
        <div className={styles.overlay} onClick={() => setViewSupplier(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3>🏭 Supplier Details</h3>
              <button className={styles.closeBtn} onClick={() => setViewSupplier(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.mField}>
                  <label>Company</label>
                  <input value={viewSupplier.company_name || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Contact Person</label>
                  <input value={viewSupplier.contact_person || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Email</label>
                  <input value={viewSupplier.email || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Phone</label>
                  <input value={viewSupplier.phone || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>City</label>
                  <input value={viewSupplier.city || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>GST Number</label>
                  <input value={viewSupplier.gst_number || ''} readOnly />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className="btn-outline"
                  style={{
                    color: viewSupplier.products?.length ? 'gray' : 'red',
                    cursor: viewSupplier.products?.length ? 'not-allowed' : 'pointer'
                  }}
                  disabled={viewSupplier.products?.length > 0}
                  onClick={() => handleDeleteSupplier(viewSupplier.supplier_id)}
                >
                  Delete
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setAddModal({
                      title: "Edit Supplier",
                      fields: [
                        { key: 'company_name', label: 'Company Name' },
                        { key: 'contact_person', label: 'Contact Person' },
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'city', label: 'City' },
                        { key: 'gst_number', label: 'GST Number' },
                      ],
                      initialData: viewSupplier,
                      onSave: async (rec) => {
                        try {
                          await api.put(`/suppliers/${viewSupplier.supplier_id}`, rec)
                          toast("Updated ✅")
                          setViewSupplier(null)
                          fetchAllData()
                        } catch (err) {
                          toast("Update failed ❌")
                        }
                      }
                    })
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {viewProduct && (
        <div className={styles.overlay} onClick={() => setViewProduct(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3>📦 Product Details</h3>
              <button className={styles.closeBtn} onClick={() => setViewProduct(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.mField}>
                  <label>Product Name</label>
                  <input value={viewProduct.product_name || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Category</label>
                  <input value={viewProduct.category || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Brand</label>
                  <input value={viewProduct.brand || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Price</label>
                  <input value={viewProduct.price || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Stock</label>
                  <input value={viewProduct.stock_quantity || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Status</label>
                  <input value={viewProduct.is_active ? 'Active' : 'Inactive'} readOnly />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className="btn-outline"
                  style={{ color: 'red' }}
                  onClick={() => handleDeleteProduct(viewProduct.product_id)}
                >
                  Delete
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setAddModal({
                      title: "Edit Product",
                      fields: [
                        { key: 'product_name', label: 'Product Name' },
                        { key: 'category', label: 'Category' },
                        { key: 'brand', label: 'Brand' },
                        { key: 'price', label: 'Price', type: 'number' },
                        { key: 'stock_quantity', label: 'Stock', type: 'number' },
                        { key: 'is_active', label: 'Status', type: 'select', options: [{ label: 'Active', value: true }, { label: 'Inactive', value: false }] },
                      ],
                      initialData: viewProduct,
                      onSave: async (rec) => {
                        try {
                          await api.put(`/products/${viewProduct.product_id}`, rec)
                          toast("Updated ✅")
                          setViewProduct(null)
                          fetchAllData()
                        } catch (err) {
                          toast("Update failed ❌")
                        }
                      }
                    })
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER MODAL */}
      {viewOrder && (
        <div className={styles.overlay} onClick={() => { setViewOrder(null); setOrderPaymentMethod(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: orderPaymentMethod ? 460 : 500 }}>
            <div className={styles.modalHead}>
              <h3>{orderPaymentMethod === 'success' ? '✅ Payment Complete' : orderPaymentMethod === 'upi' ? '📱 Pay via UPI' : orderPaymentMethod === 'choose' ? '💳 Select Payment' : '🛒 Order Details'}</h3>
              <button className={styles.closeBtn} onClick={() => { setViewOrder(null); setOrderPaymentMethod(null); }}>✕</button>
            </div>
            <div className={styles.modalBody}>

              {/* ── ORDER DETAILS VIEW ── */}
              {!orderPaymentMethod && (<>
                <div className={styles.formGrid}>
                  <div className={styles.mField}>
                    <label>Order ID</label>
                    <input value={`ORD-${String(viewOrder.order_id).padStart(3, '0')}`} readOnly />
                  </div>
                  <div className={styles.mField}>
                    <label>Customer</label>
                    <input value={viewOrder.customer_name || ''} readOnly />
                  </div>
                  <div className={styles.mField}>
                    <label>Amount (₹)</label>
                    <input value={viewOrder.total_amount || ''} readOnly />
                  </div>
                  <div className={styles.mField}>
                    <label>Status</label>
                    <input value={viewOrder.status || ''} readOnly />
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button className="btn-outline" style={{ color: 'red' }} onClick={() => handleDeleteOrder(viewOrder.order_id)}>Delete</button>
                  <button className="btn-outline" onClick={() => generateInvoice(viewOrder)}>Download Invoice</button>
                  {viewOrder.status !== 'confirmed' && viewOrder.status !== 'completed' && viewOrder.status !== 'installed' && (
                    <button className="btn-primary" onClick={() => setOrderPaymentMethod('choose')}>Pay Now</button>
                  )}
                </div>
              </>)}

              {/* ── PAYMENT METHOD PICKER ── */}
              {orderPaymentMethod === 'choose' && (
                <div>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ORD-{String(viewOrder.order_id).padStart(3,'0')}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{Number(viewOrder.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <button
                      onClick={() => setOrderPaymentMethod('upi')}
                      style={{ padding: '20px 16px', borderRadius: 12, border: '2px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.07)', cursor: 'pointer', color: 'var(--text)' }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>📱</div>
                      <div style={{ fontWeight: 700 }}>UPI / QR Code</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>GPay, PhonePe, Paytm</div>
                    </button>
                    <button
                      onClick={async () => {
                        setOrderPaymentMethod(null)
                        try {
                          const { data } = await api.post('/razorpay/init', {
                            order_id: viewOrder.order_id,
                            amount: viewOrder.total_amount,
                            customer_id: viewOrder.customer_id,
                            description: `Order ${viewOrder.order_id}`
                          })
                          const options = {
                            key: data.data.key_id,
                            amount: data.data.amount * 100,
                            currency: 'INR',
                            name: 'SolarTech Pro',
                            description: `Payment for ORD-${viewOrder.order_id}`,
                            order_id: data.data.razorpay_order_id,
                            handler: async function (response) {
                              try {
                                await api.post('/razorpay/verify', {
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_payment_id: response.razorpay_payment_id,
                                  razorpay_signature: response.razorpay_signature,
                                  order_id: viewOrder.order_id,
                                  customer_id: viewOrder.customer_id,
                                  amount: viewOrder.total_amount
                                })
                                toast('Payment Successful ✅')
                                fetchAllData()
                                setViewOrder(null)
                              } catch (err) {
                                toast('Payment verification failed ❌')
                              }
                            }
                          }
                          if (window.Razorpay) { new window.Razorpay(options).open() }
                        } catch (err) {
                          toast('Payment initialization failed ❌')
                        }
                      }}
                      style={{ padding: '20px 16px', borderRadius: 12, border: '2px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.07)', cursor: 'pointer', color: 'var(--text)' }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>💳</div>
                      <div style={{ fontWeight: 700 }}>Card / Net Banking</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Visa, Mastercard</div>
                    </button>
                  </div>
                  <button className="btn-outline" style={{ width: '100%' }} onClick={() => setOrderPaymentMethod(null)}>← Back</button>
                </div>
              )}

              {/* ── UPI PAYMENT (Razorpay verified) ── */}
              {orderPaymentMethod === 'upi' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ORD-{String(viewOrder.order_id).padStart(3,'0')}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{Number(viewOrder.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📱</div>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>Pay via UPI</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 8, lineHeight: 1.6 }}>
                    Click below to open Razorpay's secure payment.<br/>
                    Select <strong style={{ color: 'var(--text)' }}>UPI</strong> inside and pay via GPay, PhonePe, Paytm or QR.<br/>
                    <strong style={{ color: '#10B981' }}>Payment is verified automatically — no fake confirmations.</strong>
                  </p>
                  <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    UPI ID: <strong style={{ color: 'var(--text)' }}>koleprathmesh-2@oksbi</strong>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', marginBottom: 10, padding: '14px', fontSize: '1rem' }}
                    onClick={async () => {
                      try {
                        const { data } = await api.post('/razorpay/init', {
                          order_id: viewOrder.order_id,
                          amount: viewOrder.total_amount,
                          customer_id: viewOrder.customer_id,
                          description: `Order ORD-${String(viewOrder.order_id).padStart(3,'0')}`
                        })
                        const options = {
                          key: data.data.key_id,
                          amount: Math.round(Number(data.data.amount) * 100),
                          currency: 'INR',
                          name: 'SolarTech Pro',
                          description: `ORD-${String(viewOrder.order_id).padStart(3,'0')}`,
                          order_id: data.data.razorpay_order_id,
                          prefill: { contact: viewOrder.customer_phone || '', email: viewOrder.customer_email || '' },
                          notes: { upi_id: 'koleprathmesh-2@oksbi' },
                          handler: async function (response) {
                            try {
                              await api.post('/razorpay/verify', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                order_id: viewOrder.order_id,
                                customer_id: viewOrder.customer_id,
                                amount: viewOrder.total_amount
                              })
                              setOrderPaymentMethod('success')
                              fetchAllData()
                            } catch (err) {
                              toast('Payment verification failed ❌')
                            }
                          },
                          modal: { ondismiss: () => {} },
                          theme: { color: '#F59E0B' }
                        }
                        if (window.Razorpay) { new window.Razorpay(options).open() }
                      } catch (err) {
                        toast('Could not initiate payment ❌')
                      }
                    }}
                  >
                    Open UPI Payment →
                  </button>
                  <button className="btn-outline" style={{ width: '100%' }} onClick={() => setOrderPaymentMethod('choose')}>← Back</button>
                </div>
              )}

              {/* ── PAYMENT SUCCESS VIEW ── */}
              {orderPaymentMethod === 'success' && (
                <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                  <div style={{ fontSize: '4rem', marginBottom: 12 }}>🎉</div>
                  <h3 style={{ color: '#10B981', fontSize: '1.3rem', marginBottom: 8 }}>Payment Successful!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
                    Your payment has been recorded successfully.
                  </p>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Order ID</span>
                      <span style={{ fontWeight: 700 }}>ORD-{String(viewOrder.order_id).padStart(3,'0')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Amount Paid</span>
                      <span style={{ fontWeight: 700, color: '#10B981', fontSize: '1.1rem' }}>₹{Number(viewOrder.total_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Customer</span>
                      <span style={{ fontWeight: 600 }}>{viewOrder.customer_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Payment Method</span>
                      <span style={{ fontWeight: 600 }}>📱 UPI</span>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => { setOrderPaymentMethod(null); setViewOrder(null); }}
                  >
                    Done
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}


      {/* ENQUIRY MODAL */}
      {viewEnquiry && (
        <div className={styles.overlay} onClick={() => setViewEnquiry(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3>📩 Enquiry Details</h3>
              <button className={styles.closeBtn} onClick={() => setViewEnquiry(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.mField}>
                  <label>Name</label>
                  <input value={viewEnquiry.name || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Email</label>
                  <input value={viewEnquiry.email || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Phone</label>
                  <input value={viewEnquiry.phone || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Service Type</label>
                  <input value={viewEnquiry.service_type || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Monthly Bill</label>
                  <input value={viewEnquiry.monthly_bill || ''} readOnly />
                </div>
                <div className={styles.mField}>
                  <label>Status</label>
                  <input value={viewEnquiry.is_responded ? 'Completed' : 'Pending'} readOnly />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button
                  className="btn-outline"
                  style={{ color: 'red' }}
                  onClick={() => handleDeleteEnquiry(viewEnquiry.enquiry_id)}
                >
                  Delete
                </button>

                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await api.patch(`/enquiries/${viewEnquiry.enquiry_id}/respond`, { assigned_to: 'Admin' });
                      toast('Enquiry status updated! ✅');
                      setViewEnquiry(null);
                      fetchAllData();
                    } catch (err) {
                      toast('Failed to update enquiry ❌');
                    }
                  }}
                >
                  Toggle Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <AddModal
          title={addModal.title}
          fields={addModal.fields}
          initialData={addModal.initialData}
          onClose={() => setAddModal(null)}
          onSave={async (rec) => {
            await addModal.onSave(rec);
          }}
        />
      )}
    </div>
  )
}