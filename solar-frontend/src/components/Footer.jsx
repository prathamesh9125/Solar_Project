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
            { title: 'Services', links: ['Residential Solar','Commercial Solar','Industrial Solar','Battery Storage','AMC & Maintenance'] },
            { title: 'Company',  links: ['About Us','Gallery','Careers','Testimonials','Blog'] },
            { title: 'Support',  links: ['FAQ','Warranty Policy','Subsidy Guide','Privacy Policy','Terms of Service'] },
          ].map(col => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(l => (
  <li key={l}>
    {l === 'Gallery' ? (
      <Link to="/gallery">{l}</Link>
    ) : (
      <a href="#">{l}</a>
    )}
  </li>
))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <p>© 2025 ARDOUR GREEN ENERGY. All rights reserved. Final Semester Project.</p>
          <p className={styles.tagline}>🌞 Go Solar. Go Green. Save Big.</p>
        </div>
      </div>
    </footer>
  )
}
