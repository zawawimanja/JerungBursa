const path = require('path');
const express = require('express');
const chatHandler = require('./smart-money-tracker/api/chat');
const cronHandler = require('./smart-money-tracker/api/cron-scrape');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const STATIC_ROOT = path.join(__dirname, 'smart-money-tracker');

// Parse JSON payloads while handling malformed JSON gracefully for /api/chat compatibility
app.use(express.json({ limit: '1mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    req.body = err.body;
    return next();
  }
  next(err);
});

// Block private portfolio and alert files as configured in vercel.json
app.use((req, res, next) => {
  const urlPath = req.path || '/';
  if (
    /(?:^|\/)\.[^/]+/.test(urlPath) ||
    /\/node_modules\//.test(urlPath) ||
    /^\/(user_portfolio|user_portfolio_realized|portfolio_alerts_history|buy_alert_latest)\.json$/i.test(urlPath)
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

// API Routes (migrated from Vercel serverless functions)
app.all('/api/chat', (req, res) => chatHandler(req, res));
app.all(['/api/cron-scrape', '/api/cron-alert', '/api/cron-dispatch'], (req, res) => cronHandler(req, res));

// No-cache headers for dynamic data scripts and JSON files
app.use((req, res, next) => {
  if (
    /\.json$/i.test(req.path) ||
    /^\/(live-refresh|live_data|fresh_rider_tracker|hot_theme_tracker|daily_equity_tracker|scanner_history|execution_backtest|jerung-data|news_data)\.js$/i.test(req.path)
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
  next();
});

// Serve static files from smart-money-tracker/ with ETag and static asset caching
app.use(express.static(STATIC_ROOT, {
  dotfiles: 'deny',
  extensions: ['html'],
  etag: true,
  setHeaders: (res, filePath) => {
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (/\/scripts\/lib\/.*\.js$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JerungBursa server running on http://0.0.0.0:${PORT}`);
});
