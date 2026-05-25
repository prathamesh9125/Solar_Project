import styles from './Services.module.css'

const SERVICES = [
  { title: 'Residential Solar',  desc: '1kW–10kW rooftop solutions for homes. Net metering, battery backup & smart monitoring app included.' },
  { title: 'Commercial Solar',   desc: '10kW–500kW systems for offices, malls & factories. Reduce OPEX drastically with solar power.' },
  { title: 'Industrial Solar',   desc: 'Mega-scale installations above 500kW. Complete EPC services with performance guarantees.' },
  { title: 'AMC & Maintenance',  desc: 'Annual maintenance contracts with cleaning, inverter checks and performance monitoring reports.' },
  { title: 'Subsidy Assistance', desc: 'Full support for PM Surya Ghar / MNRE government subsidy applications. We handle all paperwork.' },
  { title: 'Battery Storage',    desc: 'Lithium-ion battery backup systems for 24/7 power availability even during grid outages.' },
]

export default function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <div className={styles.header}>
          <span className="section-badge">Our Services</span>
          <h2 className="section-title">Complete Solar Solutions</h2>
          <p className="section-sub">From rooftop homes to industrial solar farms — we handle everything end to end.</p>
        </div>
        <div className={styles.grid}>
          {SERVICES.map(s => (
            <div key={s.title} className={styles.card}>
             
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
