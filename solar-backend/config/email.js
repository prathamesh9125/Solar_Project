const nodemailer = require('nodemailer')
require('dotenv').config()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

const FROM = `"${process.env.SMTP_FROM_NAME || 'SolarTech Pro'}" <${process.env.SMTP_USER}>`

// ─── Email Templates ──────────────────────────────────────────
function enquiryConfirmationHTML(data) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;border-radius:12px;overflow:hidden">
    <div style="background:#F59E0B;padding:20px 30px">
      <h1 style="margin:0;color:#000;font-size:1.3rem">☀ SolarTech Pro — Enquiry Received</h1>
    </div>
    <div style="padding:30px">
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Thank you for contacting SolarTech Pro! We have received your enquiry and our solar expert will call you within <strong style="color:#F59E0B">24 hours</strong>.</p>
      <div style="background:#1F2937;border-radius:8px;padding:16px;margin:20px 0">
        <h3 style="margin:0 0 12px;color:#F59E0B">Your Enquiry Summary</h3>
        <table style="width:100%;font-size:0.88rem">
          <tr><td style="color:#9CA3AF;padding:4px 0">Service</td><td>${data.service_type}</td></tr>
          <tr><td style="color:#9CA3AF;padding:4px 0">Monthly Bill</td><td>₹${data.monthly_bill || 'Not provided'}</td></tr>
          <tr><td style="color:#9CA3AF;padding:4px 0">City</td><td>${data.city || 'Not provided'}</td></tr>
          <tr><td style="color:#9CA3AF;padding:4px 0">Reference ID</td><td style="color:#10B981">ENQ-${Date.now().toString().slice(-6)}</td></tr>
        </table>
      </div>
      <p>Our team will contact you on <strong>${data.phone}</strong>.</p>
      <a href="https://solartechpro.in/calculator" style="display:inline-block;background:#F59E0B;color:#000;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
        ⚡ Calculate Your Savings
      </a>
    </div>
    <div style="padding:16px 30px;border-top:1px solid #374151;font-size:0.78rem;color:#6B7280">
      SolarTech Pro · Plot 45, MIDC Nagpur · +91 98765 43210 · info@solartechpro.in
    </div>
  </div>`
}

function orderConfirmationHTML(order, customer) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;border-radius:12px;overflow:hidden">
    <div style="background:#F59E0B;padding:20px 30px">
      <h1 style="margin:0;color:#000;font-size:1.3rem">☀ SolarTech Pro — Order Confirmed</h1>
    </div>
    <div style="padding:30px">
      <p>Dear <strong>${customer.name}</strong>,</p>
      <p>Your solar order has been <strong style="color:#10B981">confirmed!</strong> Our installation team will contact you shortly.</p>
      <div style="background:#1F2937;border-radius:8px;padding:16px;margin:20px 0">
        <h3 style="margin:0 0 12px;color:#F59E0B">Order Details — ORD-${String(order.order_id).padStart(3,'0')}</h3>
        <table style="width:100%;font-size:0.88rem">
          <tr><td style="color:#9CA3AF;padding:4px 0">System Size</td><td>${order.system_size_kw} kW</td></tr>
          <tr><td style="color:#9CA3AF;padding:4px 0">Total Amount</td><td style="color:#F59E0B;font-weight:700">₹${Number(order.total_amount).toLocaleString('en-IN')}</td></tr>
          <tr><td style="color:#9CA3AF;padding:4px 0">Govt. Subsidy</td><td style="color:#10B981">₹${Number(order.subsidy_amount).toLocaleString('en-IN')}</td></tr>
        </table>
      </div>
    </div>
    <div style="padding:16px 30px;border-top:1px solid #374151;font-size:0.78rem;color:#6B7280">
      SolarTech Pro · Plot 45, MIDC Nagpur · +91 98765 43210
    </div>
  </div>`
}

// ─── Send Functions ───────────────────────────────────────────
async function sendEnquiryConfirmation(enquiry) {
  if (!process.env.EMAIL_USER) return  // Skip if email not configured
  try {
    await transporter.sendMail({
      from: FROM,
      to:      enquiry.email,
      subject: '✅ Enquiry Received — SolarTech Pro',
      html:    enquiryConfirmationHTML(enquiry),
    })
    // Also notify internal team
    await transporter.sendMail({
      from: FROM,
      to:      process.env.EMAIL_USER,
      subject: `🔔 New Enquiry: ${enquiry.name} — ${enquiry.service_type}`,
      html:    `<p>New enquiry from <strong>${enquiry.name}</strong> (${enquiry.phone})<br>Service: ${enquiry.service_type}<br>City: ${enquiry.city}</p>`,
    })
    console.log('📧 Email sent to:', enquiry.email)
  } catch (err) {
    console.error('❌ Email failed:', err.message)
  }
}

async function sendOrderConfirmation(order, customer) {
  if (!process.env.EMAIL_USER || !customer.email) return
  try {
    await transporter.sendMail({
      from: FROM,
      to:      customer.email,
      subject: `✅ Order Confirmed ORD-${String(order.order_id).padStart(3,'0')} — SolarTech Pro`,
      html:    orderConfirmationHTML(order, customer),
    })
  } catch (err) {
    console.error('❌ Order email failed:', err.message)
  }
}

function paymentConfirmationHTML(payment, customer) {
  const orderId = `ORD-${String(payment.order_id).padStart(3,'0')}`
  const payId   = `PAY-${String(payment.payment_id).padStart(3,'0')}`
  const amount  = Number(payment.amount).toLocaleString('en-IN')
  const method  = (payment.method || 'Online').toUpperCase()
  const date    = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:24px 30px">
      <h1 style="margin:0;color:#fff;font-size:1.4rem">Payment Successful</h1>
      <p style="margin:6px 0 0;color:#D1FAE5;font-size:0.9rem">SolarTech Pro — Payment Confirmation</p>
    </div>
    <div style="padding:30px">
      <p>Dear <strong>${customer.name}</strong>,</p>
      <p>We have received your payment successfully. Thank you for choosing SolarTech Pro!</p>

      <div style="background:#1F2937;border-radius:10px;padding:20px;margin:20px 0">
        <h3 style="margin:0 0 16px;color:#10B981;font-size:1rem">Payment Receipt</h3>
        <table style="width:100%;font-size:0.9rem;border-collapse:collapse">
          <tr style="border-bottom:1px solid #374151">
            <td style="color:#9CA3AF;padding:8px 0">Payment ID</td>
            <td style="font-weight:700;color:#F59E0B;text-align:right">${payId}</td>
          </tr>
          <tr style="border-bottom:1px solid #374151">
            <td style="color:#9CA3AF;padding:8px 0">Order ID</td>
            <td style="font-weight:700;text-align:right">${orderId}</td>
          </tr>
          <tr style="border-bottom:1px solid #374151">
            <td style="color:#9CA3AF;padding:8px 0">Amount Paid</td>
            <td style="font-weight:800;color:#10B981;font-size:1.1rem;text-align:right">&#8377;${amount}</td>
          </tr>
          <tr style="border-bottom:1px solid #374151">
            <td style="color:#9CA3AF;padding:8px 0">Payment Method</td>
            <td style="text-align:right">${method}</td>
          </tr>
          <tr>
            <td style="color:#9CA3AF;padding:8px 0">Date</td>
            <td style="text-align:right">${date}</td>
          </tr>
        </table>
      </div>

      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:14px;margin-bottom:20px">
        <p style="margin:0;font-size:0.88rem;color:#10B981">
          Your order is now <strong>confirmed</strong>. Our installation team will contact you within 24-48 hours to schedule your solar panel installation.
        </p>
      </div>

      <p style="font-size:0.85rem;color:#9CA3AF">
        For any queries, contact us at <a href="mailto:${process.env.SMTP_USER}" style="color:#F59E0B">${process.env.SMTP_USER}</a> or call <strong>+91 74982 05899</strong>
      </p>
    </div>
    <div style="padding:16px 30px;border-top:1px solid #374151;font-size:0.78rem;color:#6B7280">
      SolarTech Pro &middot; Pune, Maharashtra &middot; This is an automated payment confirmation email.
    </div>
  </div>`
}

async function sendPaymentConfirmation(payment, customer) {
  if (!process.env.SMTP_USER || !customer.email) return
  try {
    await transporter.sendMail({
      from: FROM,
      to: customer.email,
      subject: `Payment Confirmed - ORD-${String(payment.order_id).padStart(3,'0')} - SolarTech Pro`,
      html: paymentConfirmationHTML(payment, customer),
    })
    console.log('Payment confirmation email sent to:', customer.email)
  } catch (err) {
    console.error('Payment email failed:', err.message)
  }
}

async function sendInvoiceEmail({ email, name, invNo, total, items, sizeKw, subsidy, gst }) {
  if (!process.env.SMTP_USER) throw new Error('Email not configured')
  const itemRows = (items || []).map(i =>
    `<tr style="border-bottom:1px solid #374151">
      <td style="padding:8px 0;color:#F9FAFB">${i[0]}</td>
      <td style="padding:8px 0;text-align:center;color:#9CA3AF">${i[1]}</td>
      <td style="padding:8px 0;text-align:right;color:#9CA3AF">₹${Number(i[2]).toLocaleString('en-IN')}</td>
      <td style="padding:8px 0;text-align:right;color:#F59E0B;font-weight:700">₹${Number(i[3]).toLocaleString('en-IN')}</td>
    </tr>`
  ).join('')

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1F2937,#111827);padding:24px 30px;border-bottom:2px solid #F59E0B">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="margin:0;color:#F59E0B;font-size:1.4rem">SolarTech Pro</h1>
          <p style="margin:4px 0 0;color:#9CA3AF;font-size:0.8rem">Plot 45, MIDC Nagpur · GST: 27AABCS1234D1Z5</p>
        </div>
        <div style="text-align:right">
          <div style="color:#9CA3AF;font-size:0.8rem">Invoice No</div>
          <div style="font-weight:800;color:#F9FAFB">${invNo}</div>
          <div style="color:#9CA3AF;font-size:0.8rem;margin-top:4px">Date</div>
          <div style="font-weight:700">${new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>
    </div>
    <div style="padding:24px 30px">
      <p>Dear <strong>${name || 'Customer'}</strong>,</p>
      <p style="color:#9CA3AF">Please find your solar system quotation invoice below.</p>
      <div style="background:#1F2937;border-radius:8px;padding:12px 16px;margin-bottom:20px">
        <span style="color:#9CA3AF;font-size:0.85rem">System: </span>
        <span style="color:#F59E0B;font-weight:700">${sizeKw} kW Solar Rooftop System</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
        <thead>
          <tr style="border-bottom:2px solid #374151">
            <th style="padding:8px 0;text-align:left;color:#9CA3AF">ITEM</th>
            <th style="padding:8px 0;text-align:center;color:#9CA3AF">QTY</th>
            <th style="padding:8px 0;text-align:right;color:#9CA3AF">RATE</th>
            <th style="padding:8px 0;text-align:right;color:#9CA3AF">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:16px;border-top:1px solid #374151;padding-top:12px">
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#9CA3AF;font-size:0.88rem">
          <span>Subtotal</span><span>₹${Number(total).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#9CA3AF;font-size:0.88rem">
          <span>GST (18%)</span><span>₹${Number(gst).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#10B981;font-size:0.88rem">
          <span>Govt. Subsidy (−)</span><span>₹${Number(subsidy).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:2px solid #F59E0B;margin-top:8px">
          <span style="font-weight:800;font-size:1.1rem;color:#F59E0B">TOTAL</span>
          <span style="font-weight:800;font-size:1.1rem;color:#F59E0B">₹${Number(total - subsidy + gst).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <p style="margin-top:24px;font-size:0.85rem;color:#9CA3AF">
        To proceed with installation, contact us at <a href="mailto:${process.env.SMTP_USER}" style="color:#F59E0B">${process.env.SMTP_USER}</a> or call <strong style="color:#F9FAFB">+91 74982 05899</strong>
      </p>
    </div>
    <div style="padding:14px 30px;border-top:1px solid #374151;font-size:0.75rem;color:#6B7280">
      SolarTech Pro · Pune, Maharashtra · This invoice was generated automatically.
    </div>
  </div>`

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Your Solar Invoice ${invNo} - SolarTech Pro`,
    html,
  })
  console.log('Invoice email sent to:', email)
}

module.exports = { sendEnquiryConfirmation, sendOrderConfirmation, sendPaymentConfirmation, sendInvoiceEmail }