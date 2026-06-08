// ============================================================================
// VOLKSCHEM OMS — Express Server Entry Point
// ============================================================================
// Company: Volkschem Crop Science Pvt. Ltd.
// GST: 24AAFCV2675N1ZU  |  CIN: U24100GJ2015PTC084879
// ============================================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const costSheetRoutes = require('./routes/costSheetRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const labelRoutes = require('./routes/labelRoutes');
const bulkPriceRoutes = require('./routes/bulkPriceRoutes');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

// ── Create Express App ──────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);

// ── Security Middleware ─────────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiter: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    data: null,
    message: 'Too many requests. Please slow down.',
    errors: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Body Parsers ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request Logger (Development Only) ───────────────────────────────────────

if (env.IS_DEV) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(
        `${statusColor}${res.statusCode}\x1b[0m ${req.method.padEnd(7)} ${req.originalUrl} — ${duration}ms`
      );
    });
    next();
  });
}

// ── Health Check ────────────────────────────────────────────────────────────

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'Volkschem OMS API',
      version: '1.0.0',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    message: 'Server is running.',
    errors: null,
  });
});

// ── Mount Routes ────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cost-sheet', costSheetRoutes);
app.use('/api/v1/quotations', quotationRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/labels', labelRoutes);
app.use('/api/v1/bulk-prices', bulkPriceRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: null,
  });
});

// ── Global Error Handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           VOLKSCHEM OMS — API Server                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 URL:         http://localhost:${env.PORT}                 ║`);
  console.log(`║  📡 API Base:    http://localhost:${env.PORT}/api/v1           ║`);
  console.log(`║  🔧 Environment: ${env.NODE_ENV.padEnd(38)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('   Available routes:');
  console.log('   ├── POST   /api/v1/auth/login');
  console.log('   ├── GET    /api/v1/auth/me');
  console.log('   ├── GET    /api/v1/admin/dashboard');
  console.log('   ├── GET    /api/v1/admin/staff');
  console.log('   ├── GET    /api/v1/products');
  console.log('   ├── GET    /api/v1/cost-sheet');
  console.log('   ├── GET    /api/v1/quotations');
  console.log('   ├── GET    /api/v1/orders');
  console.log('   ├── GET    /api/v1/labels/:productId');
  console.log('   └── GET    /api/v1/bulk-prices');
  console.log('');
});

module.exports = app;
