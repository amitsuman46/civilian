const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Database pool ──────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || 'root@123',
  database: process.env.DB_NAME     || 'civilian_db',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Uploads dir ────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: 'civilian-dbms-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
}));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer ─────────────────────────────────────────────────────
const ALLOWED_IMAGE  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC    = ['image/jpeg', 'image/png', 'application/pdf'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    cb(null, `${base}_${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [...ALLOWED_IMAGE, ...ALLOWED_DOC].includes(file.mimetype);
    cb(null, ok);
  },
});

// ── Helpers ────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
}

function saveBase64(str, prefix) {
  if (!str || !str.startsWith('data:image/')) return null;
  const [, data] = str.split(',');
  if (!data) return null;
  const buf = Buffer.from(data, 'base64');
  const filename = `${prefix}_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  return filename;
}

function deleteFile(filename) {
  if (!filename) return;
  const fp = path.join(UPLOADS_DIR, filename);
  try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
}

function parseFamily(raw) {
  if (!raw || raw === '[]') return '[]';
  try { return JSON.stringify(JSON.parse(raw)); } catch { return '[]'; }
}

const DEFINED_AREAS = ['A Coy','B Coy','C Coy','D Coy','E Coy','F Coy','HQ Coy'];
const DEFINED_VILLAGES = [
  'Gagariyan','Barmiya and Doba','Upper Gagariyan','Wazli','kainth',
  'Sawjiya(Maidan)','Sawjiya','Sawjian(Mir Muhallah)','Sawjian(Bandi Muhallah)',
  'Sawjian(Ladhi Muhallah)','Sawjian(Purya Muhallah)','Sawjian(Tantary Muhallah)',
  'Sawjian(Gantar)','Sawjian(Sundri)',
];

// ══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════

app.post('/api/login', async (req, res) => {
  const { user_id, password } = req.body;
  if (!user_id || !password)
    return res.json({ success: false, message: 'Please enter both User ID and Password.' });
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, full_name FROM users WHERE user_id = ? AND password = ? LIMIT 1',
      [user_id, password]
    );
    if (!rows.length)
      return res.json({ success: false, message: 'Invalid credentials. Please check your User ID and Password.' });
    req.session.userId   = rows[0].user_id;
    req.session.userName = rows[0].full_name;
    res.json({ success: true, user: { user_id: rows[0].user_id, user_name: rows[0].full_name } });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Database connection error.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ success: false });
  res.json({ success: true, user: { user_id: req.session.userId, user_name: req.session.userName } });
});

// ══════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    // KPI counts
    const [[kpi]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(DATE(created_at) = CURDATE()) AS today,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS week,
        SUM(YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())) AS month
      FROM civilians
    `);

    // Daily (last 30 days)
    const [rawDaily] = await pool.query(`
      SELECT DATE(created_at) AS dt, COUNT(*) AS cnt
      FROM civilians
      WHERE created_at >= CURDATE() - INTERVAL 29 DAY
      GROUP BY DATE(created_at)
    `);
    const dailyMap = Object.fromEntries(rawDaily.map(r => [r.dt.toISOString().slice(0,10), Number(r.cnt)]));
    const daily = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
      daily.push({ label, count: dailyMap[key] || 0 });
    }

    // Monthly (last 6 months)
    const [rawMonthly] = await pool.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS ym, COUNT(*) AS cnt
      FROM civilians
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY ym ORDER BY ym
    `);
    const monthMap = Object.fromEntries(rawMonthly.map(r => [r.ym, Number(r.cnt)]));
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('en-GB', { month:'short', year:'numeric' });
      monthly.push({ label, count: monthMap[key] || 0 });
    }

    // Area-wise
    const [rawArea] = await pool.query(`
      SELECT area, COUNT(*) AS cnt FROM civilians
      WHERE area IS NOT NULL AND area != '' GROUP BY area
    `);
    const areaMap = Object.fromEntries(rawArea.map(r => [r.area, Number(r.cnt)]));
    const area = DEFINED_AREAS.map(a => ({ label: a, count: areaMap[a] || 0 }));

    // Village-wise
    const [rawVillage] = await pool.query(`
      SELECT village, COUNT(*) AS cnt FROM civilians
      WHERE village IS NOT NULL AND village != '' GROUP BY village
    `);
    const villageMap = Object.fromEntries(rawVillage.map(r => [r.village, Number(r.cnt)]));
    const village = DEFINED_VILLAGES.map(v => ({ label: v, count: villageMap[v] || 0 }));

    res.json({
      success: true,
      kpi: { total: Number(kpi.total), today: Number(kpi.today), week: Number(kpi.week), month: Number(kpi.month) },
      daily, monthly, area, village,
    });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Stats error' });
  }
});

// ══════════════════════════════════════════════════════════════
// CIVILIANS CRUD
// ══════════════════════════════════════════════════════════════

// GET all
app.get('/api/civilians', requireAuth, async (req, res) => {
  try {
    const [records] = await pool.query('SELECT * FROM civilians ORDER BY created_at DESC');
    res.json({ success: true, records });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'DB error' });
  }
});

// GET map pins (must be before /:id to avoid route conflict)
app.get('/api/civilians/map-pins', requireAuth, async (req, res) => {
  try {
    const [pins] = await pool.query(
      'SELECT id, name, house_no, area, lat, lng FROM civilians WHERE lat IS NOT NULL AND lng IS NOT NULL'
    );
    res.json({ success: true, pins });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'DB error' });
  }
});

// GET single
app.get('/api/civilians/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM civilians WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Record not found.' });
    res.json({ success: true, record: rows[0] });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'DB error' });
  }
});

// POST create
app.post('/api/civilians', requireAuth,
  upload.fields([{ name: 'photo_file', maxCount: 1 }, { name: 'document_file', maxCount: 1 }]),
  async (req, res) => {
    try {
      const b = req.body;
      const name   = (b.name   || '').trim();
      const mobile = (b.mobile || '').trim();
      const house_no = (b.house_no || '').trim();

      if (!house_no) return res.json({ success: false, message: 'House No is required.' });
      if (!name)     return res.json({ success: false, message: 'Name is required.' });
      if (!mobile)   return res.json({ success: false, message: 'Contact number is required.' });
      if (!/^[6-9]\d{9}$/.test(mobile))
        return res.json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });

      // Photo
      let photo_path = saveBase64(b.photo_base64, 'photo');
      if (!photo_path && req.files?.photo_file?.[0]) photo_path = req.files.photo_file[0].filename;

      // Document
      let document_path = saveBase64(b.doc_base64, 'doc');
      if (!document_path && req.files?.document_file?.[0]) document_path = req.files.document_file[0].filename;

      const salary      = isNaN(b.salary)      ? 0 : parseFloat(b.salary);
      const income      = isNaN(b.income)      ? 0 : parseFloat(b.income);
      const expenditure = isNaN(b.expenditure) ? 0 : parseFloat(b.expenditure);
      const lat         = b.lat  ? parseFloat(b.lat)  : null;
      const lng         = b.lng  ? parseFloat(b.lng)  : null;
      const polygon     = b.polygon || null;

      const [result] = await pool.query(`
        INSERT INTO civilians
          (house_no,name,mobile,community,religion,occupation,
           immovable_property,movable_property,salary,income,expenditure,
           health_status,area,village,lat,lng,polygon,family_details,photo_path,document_path)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        house_no || null, name, mobile,
        b.community || null, b.religion || null, b.occupation || null,
        b.immovable_property || null, b.movable_property || null,
        salary, income, expenditure,
        b.health_status || null, b.area || null, b.village || null,
        lat, lng, polygon,
        parseFamily(b.family_details), photo_path || null, document_path || null,
      ]);

      res.json({ success: true, message: 'Record saved successfully!', id: result.insertId });
    } catch (e) {
      console.error(e); res.json({ success: false, message: 'Failed to save record.' });
    }
  }
);

// PUT update
app.put('/api/civilians/:id', requireAuth,
  upload.fields([{ name: 'photo_file', maxCount: 1 }, { name: 'document_file', maxCount: 1 }]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await pool.query('SELECT * FROM civilians WHERE id = ? LIMIT 1', [id]);
      if (!existing.length) return res.json({ success: false, message: 'Record not found.' });
      const rec = existing[0];

      const b = req.body;
      const name   = (b.name   || '').trim();
      const mobile = (b.mobile || '').trim();
      if (!name)   return res.json({ success: false, message: 'Name is required.' });
      if (!mobile) return res.json({ success: false, message: 'Contact number is required.' });
      if (!/^[6-9]\d{9}$/.test(mobile))
        return res.json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });

      // Photo
      let photo_path = rec.photo_path;
      const newPhotoB64 = saveBase64(b.photo_base64, 'photo');
      if (newPhotoB64) { deleteFile(photo_path); photo_path = newPhotoB64; }
      else if (req.files?.photo_file?.[0]) {
        deleteFile(photo_path);
        photo_path = req.files.photo_file[0].filename;
      }

      // Document
      let document_path = rec.document_path;
      const newDocB64 = saveBase64(b.doc_base64, 'doc');
      if (newDocB64) { deleteFile(document_path); document_path = newDocB64; }
      else if (req.files?.document_file?.[0]) {
        deleteFile(document_path);
        document_path = req.files.document_file[0].filename;
      }

      const salary      = isNaN(b.salary)      ? 0 : parseFloat(b.salary);
      const income      = isNaN(b.income)      ? 0 : parseFloat(b.income);
      const expenditure = isNaN(b.expenditure) ? 0 : parseFloat(b.expenditure);
      const lat         = b.lat  ? parseFloat(b.lat)  : null;
      const lng         = b.lng  ? parseFloat(b.lng)  : null;
      const polygon     = b.polygon || null;

      await pool.query(`
        UPDATE civilians SET
          house_no=?,name=?,mobile=?,community=?,religion=?,occupation=?,
          immovable_property=?,movable_property=?,salary=?,income=?,expenditure=?,
          health_status=?,area=?,village=?,lat=?,lng=?,polygon=?,family_details=?,photo_path=?,document_path=?
        WHERE id=?
      `, [
        b.house_no || null, name, mobile,
        b.community || null, b.religion || null, b.occupation || null,
        b.immovable_property || null, b.movable_property || null,
        salary, income, expenditure,
        b.health_status || null, b.area || null, b.village || null,
        lat, lng, polygon,
        parseFamily(b.family_details), photo_path || null, document_path || null,
        id,
      ]);

      res.json({ success: true, message: 'Record updated successfully!' });
    } catch (e) {
      console.error(e); res.json({ success: false, message: 'Failed to update record.' });
    }
  }
);

// DELETE
app.delete('/api/civilians/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.query('SELECT photo_path, document_path FROM civilians WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.json({ success: false, message: 'Record not found.' });
    await pool.query('DELETE FROM civilians WHERE id = ?', [id]);
    deleteFile(rows[0].photo_path);
    deleteFile(rows[0].document_path);
    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'Failed to delete.' });
  }
});

// PATCH house number
app.patch('/api/civilians/:id/house-no', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const house_no = (req.body.house_no || '').trim() || null;
    const [rows] = await pool.query('SELECT id FROM civilians WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.json({ success: false, message: 'Record not found.' });
    await pool.query('UPDATE civilians SET house_no = ? WHERE id = ?', [house_no, id]);
    res.json({ success: true, message: 'House number updated.' });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'Failed to update.' });
  }
});

// ══════════════════════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════════════════════

app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const q    = (req.query.q || '').trim();
    const mode = req.query.mode || 'update';
    let records;
    if (!q) {
      [records] = await pool.query('SELECT * FROM civilians ORDER BY created_at DESC');
    } else {
      const like = `%${q}%`;
      [records] = await pool.query(`
        SELECT * FROM civilians
        WHERE name LIKE ? OR mobile LIKE ? OR village LIKE ?
           OR area LIKE ? OR occupation LIKE ? OR health_status LIKE ?
           OR family_details LIKE ?
        ORDER BY created_at DESC
      `, Array(7).fill(like));
    }
    res.json({ success: true, records, mode });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'Search error' });
  }
});

// ══════════════════════════════════════════════════════════════
// HOUSE BULK LIST
// ══════════════════════════════════════════════════════════════

app.get('/api/house-list', requireAuth, async (req, res) => {
  try {
    const [records] = await pool.query(
      'SELECT id, house_no, name, mobile, village, area FROM civilians ORDER BY CAST(house_no AS UNSIGNED) ASC, name ASC'
    );
    res.json({ success: true, records });
  } catch (e) {
    console.error(e); res.json({ success: false, message: 'DB error' });
  }
});

// ── Start server ───────────────────────────────────────────────
app.listen(PORT, () => console.log(`Civilian backend running on http://localhost:${PORT}`));
