import { useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useToast } from '../App'
import api from '../api/axios'
import styles from './InvoiceModal.module.css'

function fmt(n) { return Math.round(n).toLocaleString('en-IN') }

export default function InvoiceModal({ result, bill, onClose }) {
  const toast  = useToast()
  const invRef = useRef(null)
  const [emailTo, setEmailTo] = useState('')
  const [sending, setSending] = useState(false)
  const invNo  = 'INV-2025-' + Math.floor(Math.random() * 900 + 100)
  const today  = new Date().toLocaleDateString('en-IN')
  const sizeKw = result.sizeKw.toFixed(1)
  const panelCount = Math.ceil(result.sizeKw * 2.5)

  const items = [
    ['Mono PERC Solar Panels 400W', `${panelCount} pcs`, 18500, panelCount * 18500],
    ['Hybrid Inverter',             `${Math.ceil(result.sizeKw / 5)} unit`, 32000, Math.ceil(result.sizeKw / 5) * 32000],
    ['GI Mounting Structure',       '1 set',  12000,  12000],
    ['Installation & Labour',       '—',      15000,  15000],
    ['Net Meter & Wiring',          '1 set',   8000,   8000],
  ]

  const generatePDF = () => {
    const doc = new jsPDF()

    // Header background
    doc.setFillColor(10, 15, 30)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 0, 210, 16, 'F')

    // Title bar
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text('SOLARTECH PRO — INVOICE', 105, 11, { align: 'center' })

    // Logo & company
    doc.setTextColor(245, 158, 11)
    doc.setFontSize(16)
    doc.text('☀ SolarTech Pro', 15, 28)
    doc.setTextColor(180, 180, 180)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Plot 45, MIDC Nagpur, Maharashtra 440018', 15, 35)
    doc.text('GST: 27AABCS1234D1Z5  |  Ph: +91 98765 43210  |  info@solartechpro.in', 15, 41)

    // Divider
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.5)
    doc.line(15, 46, 195, 46)

    // Invoice meta
    doc.setFontSize(9)
    doc.setTextColor(245, 158, 11)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice No:', 15, 55)
    doc.text('Date:', 120, 55)
    doc.text('System:', 15, 63)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'normal')
    doc.text(invNo, 50, 55)
    doc.text(today, 145, 55)
    doc.text(`${sizeKw} kW Solar System`, 50, 63)

    doc.setDrawColor(55, 65, 81)
    doc.line(15, 68, 195, 68)

    // Items table
    autoTable(doc, {
      startY: 72,
      head: [['Item', 'Qty', 'Rate (₹)', 'Amount (₹)']],
      body: items.map(([n, q, r, a]) => [n, q, fmt(r), fmt(a)]),
      theme: 'plain',
      styles: { textColor: [220, 220, 220], fillColor: [26, 34, 54], fontSize: 9 },
      headStyles: { textColor: [245, 158, 11], fillColor: [31, 41, 55], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', textColor: [245, 158, 11] } },
      alternateRowStyles: { fillColor: [17, 24, 39] },
    })

    const finalY = doc.lastAutoTable.finalY + 8

    // Totals box
    doc.setFillColor(31, 41, 55)
    doc.rect(120, finalY, 75, 34, 'F')
    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175)
    doc.text('Subtotal:', 125, finalY + 8)
    doc.text('GST (18%):', 125, finalY + 16)
    doc.text('Govt. Subsidy (−):', 125, finalY + 24)
    doc.setTextColor(245, 158, 11)
    doc.text(`₹${fmt(result.cost)}`, 193, finalY + 8, { align: 'right' })
    doc.text(`₹${fmt(result.cost * 0.18)}`, 193, finalY + 16, { align: 'right' })
    doc.setTextColor(16, 185, 129)
    doc.text(`₹${fmt(result.subsidy)}`, 193, finalY + 24, { align: 'right' })

    // Grand total
    doc.setFillColor(245, 158, 11)
    doc.rect(120, finalY + 36, 75, 12, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`TOTAL: ₹${fmt(result.net)}`, 193, finalY + 44, { align: 'right' })

    // Footer
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Thank you for choosing SolarTech Pro. Warranty: 25 years panel, 10 years inverter.', 105, 278, { align: 'center' })
    doc.text('Computer generated invoice — no signature required.', 105, 284, { align: 'center' })

    doc.save(`SolarTech_${invNo}.pdf`)
    toast('PDF Invoice downloaded! 📄', '✅')
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>📄 Invoice Preview</h3>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.preview} ref={invRef}>
            {/* Header */}
            <div className={styles.invHead}>
              <div>
                <div className={styles.invLogo}>☀ SolarTech Pro</div>
                <div className={styles.invAddress}>Plot 45, MIDC Nagpur · GST: 27AABCS1234D1Z5</div>
              </div>
              <div className={styles.invMeta}>
                <span>Invoice No</span><strong>{invNo}</strong>
                <span>Date</span><strong>{today}</strong>
              </div>
            </div>

            {/* System info */}
            <div className={styles.sysBox}>
              <span>System</span>
              <strong>{sizeKw} kW Solar Rooftop System</strong>
            </div>

            {/* Table */}
            <table className={styles.table}>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {items.map(([n, q, r, a]) => (
                  <tr key={n}>
                    <td>{n}</td>
                    <td>{q}</td>
                    <td>₹{fmt(r)}</td>
                    <td className={styles.amtCell}>₹{fmt(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.tRow}><span>Subtotal</span><span>₹{fmt(result.cost)}</span></div>
              <div className={styles.tRow}><span>GST (18%)</span><span>₹{fmt(result.cost * 0.18)}</span></div>
              <div className={styles.tRow} style={{ color: 'var(--accent)' }}>
                <span>Govt. Subsidy (−)</span><span>₹{fmt(result.subsidy)}</span>
              </div>
              <div className={styles.tGrand}>
                <span>TOTAL</span><span>₹{fmt(result.net)}</span>
              </div>
            </div>
          </div>

          {/* Email input */}
          <div style={{ padding: '0 0 12px', display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="Enter customer email to send invoice..."
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
            />
          </div>
          {/* Actions */}
          <div className={styles.actions}>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={generatePDF}>
              Download PDF
            </button>
            <button
              className="btn-outline"
              style={{ flex: 1, justifyContent: 'center', opacity: sending ? 0.7 : 1 }}
              disabled={sending}
              onClick={async () => {
                if (!emailTo || !emailTo.includes('@')) {
                  toast('Please enter a valid email address')
                  return
                }
                setSending(true)
                try {
                  await api.post('/payments/send-invoice', {
                    email: emailTo,
                    name: emailTo.split('@')[0],
                    invNo,
                    sizeKw,
                    total: result.cost,
                    gst: result.cost * 0.18,
                    subsidy: result.subsidy,
                    items,
                  })
                  toast(`Invoice sent to ${emailTo}`)
                  onClose()
                } catch (err) {
                  toast(err.response?.data?.message || 'Failed to send email')
                } finally {
                  setSending(false)
                }
              }}
            >
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}