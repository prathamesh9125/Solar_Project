require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { pool, testConnection } = require("./config/db");

console.log("Starting Solar Panel Backend Server...\n");

const app = express();
const server = http.createServer(app);

// CORS setup
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health Check Route (before DB)
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK",
    server: "Running",
    timestamp: new Date().toISOString()
  });
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Attach io to every request so routes can use req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Import and register routes
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const quotationRoutes = require("./routes/quotation");
const enquiriesRoutes = require("./routes/enquiries");
const customersRoutes = require("./routes/customers");
const supplierRoutes = require("./routes/suppliers");
const installationRoutes = require("./routes/installations");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const razorpayRoutes = require("./routes/razorpay");

// Register API routes
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/enquiries", enquiriesRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/installations", installationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/razorpay", razorpayRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("Testing Database Connection...");
    await testConnection();
    
    server.listen(PORT, () => {
      console.log("\nServer Status: ONLINE");
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`Database: ${process.env.DB_NAME || 'solar_db'}`);
      console.log("\nAll systems operational!\n");
    }).on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} already in use`);
        console.error(`Try: kill -9 $(lsof -t -i:${PORT}) or use a different port`);
        process.exit(1);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
    pool.end()
    console.log('Database pool closed')
    process.exit(0)
  })
})