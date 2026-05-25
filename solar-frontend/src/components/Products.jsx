import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useToast, useCart } from '../App' // Updated to include useCart
import styles from './Products.module.css'
import { io } from 'socket.io-client'

const FALLBACK = [
  { product_id:1, product_name:'Mono PERC Panel 400W',  category:'panel',    price:18500, brand:'Waaree',  description:'21.3% efficiency, 25-year warranty. Anti-reflective coating.', stock_quantity:150 },
  { product_id:2, product_name:'Poly Solar Panel 330W',  category:'panel',    price:14200, brand:'Waaree',  description:'Budget polycrystalline panel. Ideal for large rooftop systems.', stock_quantity:200 },
  { product_id:3, product_name:'Hybrid Inverter 5kW',    category:'inverter', price:32000, brand:'Luminous',description:'On/off-grid hybrid. WiFi monitoring, 97.6% efficiency.', stock_quantity:40 },
  { product_id:4, product_name:'String Inverter 3kW',    category:'inverter', price:18500, brand:'Luminous',description:'Grid-tied, IP65 rated. 10-year warranty extendable.', stock_quantity:60 },
  { product_id:5, product_name:'Lithium Battery 5kWh',   category:'battery',  price:85000, brand:'Exide',   description:'LiFePO4, 6000-cycle life. Built-in BMS protection.', stock_quantity:20 },
  { product_id:6, product_name:'GI Mount Structure 5kW', category:'structure',price:12000, brand:'Nexus',   description:'Hot-dip galvanized, 150 kmph wind-rated mounting.', stock_quantity:50 },
]

const ICONS = { panel:'🌞', inverter:'⚡', battery:'🔋', structure:'🏗️', accessory:'🔩', cable:'🔌' }

export default function Products() {
  const [products, setProducts] = useState(FALLBACK)
  const [filter, setFilter] = useState('all')
  const toast = useToast()
  const { addToCart } = useCart() // Get addToCart from App context

  useEffect(() => {
    api.get('/products').then(r => { 
      const arr = r.data?.data || r.data;
      if (arr?.length) {
        setProducts(arr)
      }
    }).catch(() => {})

    const socket = io('http://localhost:5000')
    
    // Setup socket connection and listeners
    socket.on('connect', () => {
      console.log('Connected to real-time inventory updates')
    })

    socket.on('stock_updated', (data) => {
      setProducts(prev => prev.map(p => 
        p.product_id === Number(data.product_id) 
          ? { ...p, stock_quantity: data.new_quantity } 
          : p
      ))
    })
    
    socket.on('product_updated', (data) => {
      setProducts(prev => prev.map(p => 
        p.product_id === Number(data.product_id) 
          ? { ...p, ...data } 
          : p
      ))
    })

    return () => socket.disconnect()
  }, [])

  const cats = ['all', ...new Set(products.map(p => p.category))]
  const shown = filter === 'all' ? products : products.filter(p => p.category === filter)

  return (
    <section className="section" id="products" style={{ background: 'var(--bg2)' }}>
      <div className="container">
        <span className="section-badge">Products</span>
        <h2 className="section-title">Premium Solar Equipment</h2>
        <p className="section-sub">Top-tier panels, inverters and batteries from globally certified manufacturers.</p>

        <div className={styles.filters}>
          {cats.map(c => (
            <button
              key={c}
              className={`${styles.filterBtn} ${filter === c ? styles.active : ''}`}
              onClick={() => setFilter(c)}
            >
              {c === 'all' ? 'All Products' : c.charAt(0).toUpperCase() + c.slice(1) + 's'}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {shown.map(p => (
            <div key={p.product_id} className={styles.card}>
              <div className={styles.imgBox}>
                {/* <span>{ICONS[p.category] || '☀'}</span> */}
              </div>
              <div className={styles.body}>
                <span className={`badge badge-green ${styles.catBadge}`}>{p.brand || p.category}</span>
                <h3>{p.product_name}</h3>
                <p>{p.description}</p>
                <div className={styles.footer}>
                  <span className={styles.price}>₹{Number(p.price).toLocaleString('en-IN')}</span>
                  <button
                    className={styles.addBtn}
                    onClick={() => {
                      addToCart(p)
                      toast(`${p.product_name} added to cart!`, '🛒')
                    }}
                  >
                    + Add to Quote
                  </button>
                </div>
                <div className={styles.stock}>
                  <span className={p.stock_quantity > 0 ? styles.inStock : styles.outStock}>
                    {p.stock_quantity > 0 ? `✓ ${p.stock_quantity} in stock` : '✗ Out of stock'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
