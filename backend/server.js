import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import pkg from 'pg';
import crypto from 'crypto';
import helmet from 'helmet';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, login } from './auth.js';
const { Pool } = pkg;

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Load environment variables
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting removed per request. If you need to restore, re-add express-rate-limit middleware here.

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Middleware
// Configure CORS with a case-insensitive whitelist and helpful logging.
// You can provide a comma separated list via ALLOWED_ORIGINS or set CORS_ALLOW_ALL=true for dev/demo environments.
const allowAllCors = (process.env.CORS_ALLOW_ALL || '').toLowerCase() === 'true';
const rawAllowed = allowAllCors
  ? ['*']
  : (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : [
          'http://localhost:3000', // Vite default in this repo
          'http://localhost:5173', // Alternate Vite default
        ]);
const allowedOrigins = rawAllowed.map(o => o.toLowerCase());
// Derive hostname list for port-agnostic matching (e.g., allow http://host:3000 when http://host:5173 configured)
const allowedHostnames = allowedOrigins
  .filter(o => o !== '*')
  .map(o => {
    try { return new URL(o).hostname.toLowerCase(); } catch { return o.replace(/^[^:]+:\/\//,'').split(':')[0].toLowerCase(); }
  });

console.log('[CORS] allowAllCors =', allowAllCors);
console.log('[CORS] allowedOrigins =', allowedOrigins);
console.log('[CORS] allowedHostnames (port-agnostic) =', allowedHostnames);

app.use((req, res, next) => {
  // Log Origin to help debug CORS mismatches (shown in console)
  console.log('Incoming request:', req.method, req.path, 'Origin:', req.headers.origin);
  next();
});

app.use(cors(allowAllCors ? {
  // Allow any origin (development / demo only). Credentials must be disabled with wildcard.
  origin: (_origin, cb) => cb(null, true),
  credentials: false,
  optionsSuccessStatus: 200
} : {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // non-browser / same-origin

    const lowerOrigin = origin.toLowerCase();

    // 1. Explicit list (exact match)
    if (allowedOrigins.includes(lowerOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 2. Port-agnostic hostname match (allow http://same-host:OTHERPORT)
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      if (allowedHostnames.includes(host)) {
        return callback(null, true);
      }
    } catch (_) { /* ignore parse failure */ }

    console.warn('Blocked CORS origin:', origin, 'Allowed list:', allowedOrigins, 'Hint: set ALLOWED_ORIGINS or CORS_ALLOW_ALL=true');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));

// Get LiteLLM configuration from environment variables
const LITELLM_ENDPOINT = process.env.LITELLM_ENDPOINT || 'http://localhost:4141';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

console.log('LiteLLM Endpoint:', LITELLM_ENDPOINT);
console.log('LiteLLM API Key present:', !!LITELLM_API_KEY);
console.log('Database URL present:', !!DATABASE_URL);

// PostgreSQL pool with security enhancements
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    max: parseInt(process.env.DB_MAX_CLIENTS) || 10,
  });
}

async function ensureDb() {
  if (!pool) return;
  try {
    // Simple check only; schema should be created via scripts/init-chat2anyllm.sql
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
}
ensureDb();

// Helper: map DB rows to Message shape
function rowToMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.created_at
  };
}

// Helper: safely serialize error data to avoid circular reference issues
function serializeErrorData(data) {
  if (!data) return data;
  
  // If it's a string, return as is
  if (typeof data === 'string') return data;
  
  // If it's a buffer, convert to string
  if (Buffer.isBuffer(data)) return data.toString();
  
  // For objects, try to serialize, but handle circular references
  try {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(data, (key, val) => {
      // Handle circular references
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular Reference]';
        }
        seen.add(val);
      }
      // Handle non-serializable values
      if (typeof val === 'function') return '[Function]';
      if (typeof val === 'symbol') return '[Symbol]';
      return val;
    }));
  } catch (e) {
    // If serialization fails, return a safe string representation
    return '[Non-serializable Error Data]';
  }
}

// Proxy endpoint for getting model information
app.get('/api/models', async (req, res) => {
  try {
    console.log('Fetching models from LiteLLM...');
    const response = await axios.get(`${LITELLM_ENDPOINT}/v1/model/info`, {
      headers: {
        'accept': 'application/json',
        'x-litellm-api-key': LITELLM_API_KEY
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('Models response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching models:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      res.status(error.response.status).json({ error: 'Failed to fetch models', details: serializeErrorData(error.response.data) });
    } else {
      res.status(500).json({ error: 'Failed to connect to LiteLLM', message: error.message });
    }
  }
});

// Proxy endpoint for chat completions
app.post('/api/chat/completions', async (req, res) => {
  try {
    console.log('Forwarding chat completion request to LiteLLM...');
    const response = await axios.post(`${LITELLM_ENDPOINT}/v1/chat/completions`, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_API_KEY}`,
        'x-litellm-api-key': LITELLM_API_KEY
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('Chat completion response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Error in chat completion:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      res.status(error.response.status).json({ error: 'Chat completion failed', details: serializeErrorData(error.response.data) });
    } else {
      res.status(500).json({ error: 'Failed to connect to LiteLLM', message: error.message });
    }
  }
});

// Streaming proxy endpoint for chat completion
app.post('/api/chat/completions/stream', async (req, res) => {
  try {
    console.log('Forwarding streaming chat completion request to LiteLLM...');
    
    const response = await axios.post(`${LITELLM_ENDPOINT}/v1/chat/completions`, {
      ...req.body,
      stream: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_API_KEY}`,
        'x-litellm-api-key': LITELLM_API_KEY
      },
      responseType: 'stream',
      timeout: 30000 // 30 second timeout
    });

    console.log('Streaming chat completion response status:', response.status);

    // Set headers for streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Pipe the response stream to the client
    response.data.pipe(res);

    // Handle errors in the stream
    response.data.on('error', (error) => {
      console.error('Stream error:', error.message);
      if (!res.headersSent) {
        res.end();
      }
    });

    // Handle the response stream end
    response.data.on('end', () => {
      if (!res.headersSent) {
        res.end();
      }
    });

  } catch (error) {
    console.error('Error in streaming chat completion:', error.message);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        res.status(error.response.status).json({ error: 'Streaming chat completion failed', details: serializeErrorData(error.response.data) });
      } else {
        res.status(500).json({ error: 'Failed to connect to LiteLLM', message: error.message });
      }
    }
  }
});

// Sessions APIs
// Apply authentication middleware to protected resources BEFORE route definitions
app.use('/api/sessions', authenticateToken);
app.use('/api/roles', authenticateToken);

app.get('/api/sessions', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const { rows } = await pool.query(
      `SELECT id, title, created_at, updated_at
       FROM sessions
       ORDER BY updated_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sessions:', error.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ---- Roles CRUD API ----
app.get('/api/roles', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const { rows } = await pool.query('SELECT id, name, instructions, created_at, updated_at FROM roles ORDER BY name ASC');
    res.json(rows);
  } catch (e) {
    console.error('Error listing roles:', e.message);
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

app.post('/api/roles', 
  body('name').isLength({ min: 1, max: 100 }).trim().escape(),
  body('instructions').isLength({ min: 1, max: 5000 }).trim(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const { name, instructions } = req.body || {};
      if (!name || !instructions) return res.status(400).json({ error: 'Missing name or instructions' });
      const { rows } = await pool.query(
        `INSERT INTO roles(name, instructions) VALUES($1,$2) RETURNING id, name, instructions, created_at, updated_at`,
        [String(name).trim(), String(instructions).trim()]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      console.error('Error creating role:', e.message);
      if (e.code === '23505') return res.status(409).json({ error: 'Role name already exists' });
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
);

app.put('/api/roles/:id', 
  param('id').isUUID(),
  body('name').optional().isLength({ min: 1, max: 100 }).trim().escape(),
  body('instructions').optional().isLength({ min: 1, max: 5000 }).trim(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const { id } = req.params;
      const { name, instructions } = req.body || {};
      if (!name && !instructions) return res.status(400).json({ error: 'Nothing to update' });
      const fields = [];
      const values = [];
      let idx = 1;
      if (name) { fields.push(`name=$${idx++}`); values.push(String(name).trim()); }
      if (instructions) { fields.push(`instructions=$${idx++}`); values.push(String(instructions).trim()); }
      values.push(id); // where
      const { rowCount, rows } = await pool.query(
        `UPDATE roles SET ${fields.join(', ')}, updated_at=now() WHERE id=$${idx} RETURNING id, name, instructions, created_at, updated_at`,
        values
      );
      if (!rowCount) return res.status(404).json({ error: 'Role not found' });
      res.json(rows[0]);
    } catch (e) {
      console.error('Error updating role:', e.message);
      if (e.code === '23505') return res.status(409).json({ error: 'Role name already exists' });
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

app.delete('/api/roles/:id', 
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const { id } = req.params;
      const { rowCount } = await pool.query('DELETE FROM roles WHERE id=$1', [id]);
      if (!rowCount) return res.status(404).json({ error: 'Role not found' });
      res.status(204).end();
    } catch (e) {
      console.error('Error deleting role:', e.message);
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
);

// ---- Slash Commands for roles ----
// Expected environment: expose endpoint to slash command request URLs (/slack/command)
// This is a minimal implementation: verify signature if signing secret provided.
app.post('/slack/command', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    // Signature verification (optional if secret not supplied)
    if (SLACK_SIGNING_SECRET) {
      const ts = req.headers['x-slack-request-timestamp'];
      const sig = req.headers['x-slack-signature'];
      if (!ts || !sig) return res.status(401).send('Missing signature');
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
      if (Number(ts) < fiveMinutesAgo) return res.status(401).send('Stale request');
      const bodyString = Object.entries(req.body).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
      const baseString = `v0:${ts}:${bodyString}`;
      const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(baseString).digest('hex');
      const expected = `v0=${hmac}`;
      if (expected !== sig) return res.status(401).send('Invalid signature');
    }

    const { command, text } = req.body;
    if (command === '/roles') {
      if (!pool) return res.json({ text: 'Database not configured' });
      const { rows } = await pool.query('SELECT name FROM roles ORDER BY name ASC');
      if (rows.length === 0) return res.json({ text: 'No roles defined.' });
      return res.json({ text: 'Roles:\n' + rows.map(r => `• ${r.name}`).join('\n') });
    }
    if (command === '/role') {
      const roleName = (text || '').trim();
      if (!roleName) return res.json({ text: 'Usage: /role <name>' });
      if (!pool) return res.json({ text: 'Database not configured' });
      const { rows } = await pool.query('SELECT name FROM roles WHERE lower(name)=lower($1)', [roleName]);
      if (rows.length === 0) return res.json({ text: `Role not found: ${roleName}` });
      // Selection is client-specific; here we just echo (real selection handled client-side via UI).
      return res.json({ text: `Selected role (client must apply manually): ${rows[0].name}` });
    }
    res.json({ text: 'Unknown command' });
  } catch (e) {
    console.error('Command error:', e.message);
    res.json({ text: 'Error processing command' });
  }
});

app.post('/api/sessions', 
  body('title').isLength({ min: 1, max: 120 }).trim().escape(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const title = (req.body && req.body.title) ? String(req.body.title).slice(0, 120) : 'New Chat';
      const { rows } = await pool.query(
        `INSERT INTO sessions(title) VALUES($1) RETURNING id, title, created_at, updated_at`,
        [title]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Error creating session:', error.message);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

// Delete a session (and cascading messages via FK ON DELETE CASCADE)
app.delete('/api/sessions/:id', 
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const { id } = req.params;
      const { rowCount } = await pool.query('DELETE FROM sessions WHERE id=$1', [id]);
      if (!rowCount) return res.status(404).json({ error: 'Session not found' });
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting session:', error.message);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }
);

app.get('/api/sessions/:id/messages', 
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!pool) return res.status(500).json({ error: 'Database not configured' });
      const sessionId = req.params.id;
      const { rows } = await pool.query(
        `SELECT id, role, content, created_at
         FROM messages
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionId]
      );
      res.json(rows.map(rowToMessage));
    } catch (error) {
      console.error('Error fetching messages:', error.message);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

// Streaming chat within a session
app.post('/api/sessions/:id/chat/stream', 
  param('id').isUUID(),
  body('message').isLength({ min: 1, max: 10000 }).trim(),
  body('model').optional().isLength({ min: 1, max: 100 }).trim(),
  handleValidationErrors,
  async (req, res) => {
    const sessionId = req.params.id;
    const { model, message } = req.body || {};
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing message' });

    try {
    // Ensure session exists
    const sess = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [sessionId]);
    if (sess.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Insert user message
    await pool.query(
      `INSERT INTO messages(session_id, role, content) VALUES($1, 'user', $2)`,
      [sessionId, message]
    );

    // If title is default, set to first user message summary
    const msgCount = await pool.query('SELECT COUNT(1) AS c FROM messages WHERE session_id=$1', [sessionId]);
    if (msgCount.rows[0].c === '1') {
      const newTitle = message.trim().slice(0, 60) || 'New Chat';
      await pool.query('UPDATE sessions SET title=$1 WHERE id=$2', [newTitle, sessionId]);
    }

    // Fetch full message history for context
    const { rows } = await pool.query(
      `SELECT role, content FROM messages WHERE session_id=$1 ORDER BY created_at ASC`,
      [sessionId]
    );
    const llmMessages = rows.map(r => ({ role: r.role, content: r.content }));

    // Call LiteLLM with streaming
    const response = await axios.post(`${LITELLM_ENDPOINT}/v1/chat/completions`, {
      model: model,
      messages: llmMessages,
      stream: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_API_KEY}`,
        'x-litellm-api-key': LITELLM_API_KEY
      },
      responseType: 'stream',
      timeout: 30000
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    let assistantContent = '';

    response.data.on('data', (chunk) => {
      try {
        const text = chunk.toString();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) assistantContent += delta;
            } catch (_) {
              // ignore parse errors
            }
          }
        }
      } catch (_) {}
      res.write(chunk);
    });

    response.data.on('end', async () => {
      try {
        if (assistantContent.trim().length > 0) {
          await pool.query(
            `INSERT INTO messages(session_id, role, content) VALUES($1, 'assistant', $2)`,
            [sessionId, assistantContent]
          );
        }
      } catch (e) {
        console.error('Failed to save assistant message:', e.message);
      }
      if (!res.headersSent) {
        res.end();
      } else {
        res.end();
      }
    });

    response.data.on('error', (error) => {
      console.error('Stream error:', error.message);
      if (!res.headersSent) {
        res.end();
      }
    });
  } catch (error) {
    console.error('Error in session streaming:', error.message);
    if (!res.headersSent) {
      if (error.response) {
        res.status(error.response.status).json({ error: 'Session streaming failed', details: serializeErrorData(error.response.data) });
      } else {
        res.status(500).json({ error: 'Failed to connect to LiteLLM', message: error.message });
      }
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login endpoint (public)
app.post('/api/login', 
  body('username').isLength({ min: 1, max: 50 }).trim().escape(),
  body('password').isLength({ min: 1, max: 100 }).trim(),
  handleValidationErrors,
  login
);

// Centralized error handler (last)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`LiteLLM proxy server is running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    if (pool) {
      await pool.end();
    }
    console.log('Process terminated');
  });
});