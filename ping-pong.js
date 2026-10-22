const express = require('express');
const { Pool } = require('pg');

const app = express();

const PORT = process.env.PORT || 8085;

// Configure the PostgreSQL connection pool using environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-svc',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'appdb',
  user: process.env.POSTGRES_USER || 'appuser',
  password: process.env.POSTGRES_PASSWORD || 'supersecretpassword',
  connectionTimeoutMillis: 2000, // Fail fast (2s) on individual connection attempts
});

let isDbInitialized = false;

// Initialize the database table and seed the initial counter
async function initDb( retryDelayMs = 2000 ) {
  while(!isDbInitialized) {
    try{
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS app_counters (
          counter_name VARCHAR(64) PRIMARY KEY,
          value BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      // ON CONFLICT DO NOTHING ensures existing counts survive app restarts
      const seedCounterQuery = `
        INSERT INTO app_counters (counter_name, value)
        VALUES ('pongs', 0)
        ON CONFLICT (counter_name) DO NOTHING;
      `;

      await pool.query(createTableQuery);
      await pool.query(seedCounterQuery);

      isDbInitialized = true;
      console.log('Database connected and initialized successfully!');
    }catch(err){
      console.error(`DB connection failed (${err.message}). Retrying in ${retryDelayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    
  }
  
  console.log('Database initialized and "pongs" counter ready.');
}

// Respond to GET requests on the root URL
app.get('/health', (req, res) => {
  res.send("Hello! Ako's PingPong v2 is running.");
});

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('OK');
  } catch (err) {
    console.error('Database readiness check failed:', err.message);
    res.status(500).send('Database not connected');
  }
});


// HTTP endpoint returning JSON status
app.get('/', async (req, res) => {
  try {
    // Atomically increment by 1, returning the value BEFORE the increment
    // to match your original post-increment (pongs++) behavior
    const result = await pool.query(`
      UPDATE app_counters
      SET value = value + 1, updated_at = NOW()
      WHERE counter_name = 'pongs'
      RETURNING value - 1 AS previous_pong;
    `);

    res.json({
      status: 'running',
      pong: Number(result.rows[0].previous_pong),
    });
  } catch (err) {
    console.error('Error updating pong counter:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// HTTP endpoint returning JSON status
app.get('/pings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT value FROM app_counters WHERE counter_name = 'pongs';
    `);

    res.json({
      status: 'running',
      pong: Number(result.rows[0].value),
    });
  } catch (err) {
    console.error('Error reading pong counter:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// Initialize DB first, then start the Express server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started in port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database. Exiting... \n', err);
    process.exit(1);
  });
