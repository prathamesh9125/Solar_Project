const mysql = require('mysql2/promise')
require('dotenv').config()

console.log('Database Configuration:')
console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`)
console.log(`   Port: ${process.env.DB_PORT || 3307}`)
console.log(`   User: ${process.env.DB_USER || 'root'}`)
console.log(`   Database: ${process.env.DB_NAME || 'solar_db'}`)

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'solar_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30',
})

async function testConnection() {
  try {
    const conn = await pool.getConnection()
    console.log('MySQL Connected Successfully!')
    console.log(`Database: ${process.env.DB_NAME}`)
    conn.release()
    return true
  } catch (err) {
    console.error('DATABASE CONNECTION FAILED!')
    console.error('Error Details:', err.message)
    console.error('\nTroubleshooting:')
    console.error('   1. Make sure MySQL is running')
    console.error('   2. Check DB credentials in .env file')
    console.error('   3. Verify database exists: CREATE DATABASE ' + (process.env.DB_NAME || 'solar_db'))
    console.error('   4. Check MySQL port (default: 3306, configured: ' + (process.env.DB_PORT || 3307) + ')')
    process.exit(1)
  }
}

module.exports = {
  pool,
  testConnection,
  query: (sql, params) => pool.execute(sql, params)
}