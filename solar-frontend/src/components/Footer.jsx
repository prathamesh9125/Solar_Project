import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <div className={styles.logo}>ARDOUR GREEN ENERGY</div>
            <p className={styles.about}>
              Maharashtra's most trusted solar installer. Powering homes & businesses with clean energy since 2015.
            </p>
          </div>
          {[
            { title: 'Services', links: [
              { label: 'Residential Solar', href: '/#services' },
              { label: 'Commercial Solar',  href: '/#services' },
              { label: 'Industrial Solar',  href: '/#services' },
            ]},
            { title: 'Company', links: [
              { label: 'Products', href: '/#products' },
              { label: 'Gallery',  href: '/gallery', isLink: true },
            ]},
            { title: 'Support', links: [
              { label: 'Locations', href: '/#map-section' },
              { label: 'Contact',   href: '/#contact' },
            ]},
          ].map(col => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.isLink
                      ? <Link to={l.href}>{l.label}</Link>
                      : <a href={l.href}>{l.label}</a>
                    }
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <p>© 2025 ARDOUR GREEN ENERGY. All rights reserved.</p>
          <p className={styles.tagline}>☀ Go Solar. Go Green. Save Big.</p>
        </div>
      </div>
    </footer>
  )
}