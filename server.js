// Smart Pantry API Server
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// Token generation function (KITCH-XXXXXX format)
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'KITCH-';

  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }

  return token;
}

// Initialize database
async function initDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pantry_users (
        id SERIAL PRIMARY KEY,
        token VARCHAR(20) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ingredients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pantry_ingredients (
        user_token VARCHAR(20) PRIMARY KEY REFERENCES pantry_users(token) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Recipes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pantry_recipes (
        user_token VARCHAR(20) PRIMARY KEY REFERENCES pantry_users(token) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Shopping list table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pantry_shopping (
        user_token VARCHAR(20) PRIMARY KEY REFERENCES pantry_users(token) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Meal plan table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pantry_mealplan (
        user_token VARCHAR(20) PRIMARY KEY REFERENCES pantry_users(token) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_updated
      ON pantry_ingredients(updated_at);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_updated
      ON pantry_recipes(updated_at);
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Smart Pantry API' });
});

// Register new user
app.post('/api/pantry/register', async (req, res) => {
  try {
    let token;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      token = generateToken();
      const existing = await pool.query(
        'SELECT token FROM pantry_users WHERE token = $1',
        [token]
      );

      if (existing.rows.length === 0) break;
      attempts++;
    }

    if (attempts === maxAttempts) {
      return res.status(500).json({
        success: false,
        error: 'Could not generate unique token'
      });
    }

    await pool.query(
      'INSERT INTO pantry_users (token) VALUES ($1)',
      [token]
    );

    console.log(`✅ New user registered: ${token}`);
    res.json({ success: true, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login with existing token
app.post('/api/pantry/login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required'
      });
    }

    const result = await pool.query(
      'SELECT token, created_at FROM pantry_users WHERE token = $1',
      [token.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    console.log(`✅ User logged in: ${token}`);
    res.json({
      success: true,
      token: result.rows[0].token,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get ingredients
app.get('/api/pantry/ingredients/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const userCheck = await pool.query(
      'SELECT token FROM pantry_users WHERE token = $1',
      [token.toUpperCase()]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const result = await pool.query(
      'SELECT data FROM pantry_ingredients WHERE user_token = $1',
      [token.toUpperCase()]
    );

    const data = result.rows.length > 0 ? result.rows[0].data : { pantry: [], fridge: [], freezer: [] };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get ingredients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update ingredients
app.post('/api/pantry/ingredients/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data required'
      });
    }

    await pool.query(
      `INSERT INTO pantry_ingredients (user_token, data)
       VALUES ($1, $2)
       ON CONFLICT (user_token)
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [token.toUpperCase(), data]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update ingredients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recipes
app.get('/api/pantry/recipes/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const userCheck = await pool.query(
      'SELECT token FROM pantry_users WHERE token = $1',
      [token.toUpperCase()]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const result = await pool.query(
      'SELECT data FROM pantry_recipes WHERE user_token = $1',
      [token.toUpperCase()]
    );

    const data = result.rows.length > 0 ? result.rows[0].data : [];
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update recipes
app.post('/api/pantry/recipes/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data required'
      });
    }

    await pool.query(
      `INSERT INTO pantry_recipes (user_token, data)
       VALUES ($1, $2)
       ON CONFLICT (user_token)
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [token.toUpperCase(), data]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update recipes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shopping list
app.get('/api/pantry/shopping/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const userCheck = await pool.query(
      'SELECT token FROM pantry_users WHERE token = $1',
      [token.toUpperCase()]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const result = await pool.query(
      'SELECT data FROM pantry_shopping WHERE user_token = $1',
      [token.toUpperCase()]
    );

    const data = result.rows.length > 0 ? result.rows[0].data : [];
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get shopping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shopping list
app.post('/api/pantry/shopping/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data required'
      });
    }

    await pool.query(
      `INSERT INTO pantry_shopping (user_token, data)
       VALUES ($1, $2)
       ON CONFLICT (user_token)
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [token.toUpperCase(), data]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update shopping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get meal plan
app.get('/api/pantry/mealplan/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const userCheck = await pool.query(
      'SELECT token FROM pantry_users WHERE token = $1',
      [token.toUpperCase()]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const result = await pool.query(
      'SELECT data FROM pantry_mealplan WHERE user_token = $1',
      [token.toUpperCase()]
    );

    const data = result.rows.length > 0 ? result.rows[0].data : {
      monday: { breakfast: null, lunch: null, dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null }
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get meal plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update meal plan
app.post('/api/pantry/mealplan/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data required'
      });
    }

    await pool.query(
      `INSERT INTO pantry_mealplan (user_token, data)
       VALUES ($1, $2)
       ON CONFLICT (user_token)
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [token.toUpperCase(), data]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update meal plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart Pantry API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  initDatabase();
});
