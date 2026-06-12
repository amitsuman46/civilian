const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const RSSParser = require('rss-parser');

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

const DEFINED_AREAS = ['Saujiya','Poonch','Rajouri','Mendhar','Krishna Ghati'];
const DEFINED_VILLAGES = [
  'Gagariyan','Barmiya and Doba','Upper Gagariyan','Wazli','kainth',
  'Sawjiya(Maidan)','Sawjiya','Sawjian(Mir Muhallah)','Sawjian(Bandi Muhallah)',
  'Sawjian(Ladhi Muhallah)','Sawjian(Purya Muhallah)','Sawjian(Tantary Muhallah)',
  'Sawjian(Gantar)','Sawjian(Sundri)',
];

function parseDashFilters(query) {
  const area    = DEFINED_AREAS.includes(query.area)       ? query.area    : null;
  const village = DEFINED_VILLAGES.includes(query.village) ? query.village : null;
  const parts   = [];
  const params  = [];
  if (area)    { parts.push('area = ?');    params.push(area); }
  if (village) { parts.push('village = ?'); params.push(village); }
  const sql = parts.join(' AND ');
  return {
    area, village,
    params,
    where: sql ? `WHERE ${sql}` : '',
    and:   sql ? `AND ${sql}`   : '',
  };
}

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
    const f = parseDashFilters(req.query);

    // KPI counts
    const [[kpi]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(DATE(created_at) = CURDATE()) AS today,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS week,
        SUM(YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())) AS month
      FROM civilians
      ${f.where}
    `, f.params);

    // Daily (last 30 days)
    const [rawDaily] = await pool.query(`
      SELECT DATE(created_at) AS dt, COUNT(*) AS cnt
      FROM civilians
      WHERE created_at >= CURDATE() - INTERVAL 29 DAY
      ${f.and}
      GROUP BY DATE(created_at)
    `, f.params);
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
      ${f.and}
      GROUP BY ym ORDER BY ym
    `, f.params);
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
      WHERE area IS NOT NULL AND area != ''
      ${f.and}
      GROUP BY area
    `, f.params);
    const areaMap = Object.fromEntries(rawArea.map(r => [r.area, Number(r.cnt)]));
    const area = DEFINED_AREAS.map(a => ({ label: a, count: areaMap[a] || 0 }));

    // Village-wise
    const [rawVillage] = await pool.query(`
      SELECT village, COUNT(*) AS cnt FROM civilians
      WHERE village IS NOT NULL AND village != ''
      ${f.and}
      GROUP BY village
    `, f.params);
    const villageMap = Object.fromEntries(rawVillage.map(r => [r.village, Number(r.cnt)]));
    const village = DEFINED_VILLAGES.map(v => ({ label: v, count: villageMap[v] || 0 }));

    res.json({
      success: true,
      filters: { area: f.area, village: f.village },
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
    const f = parseDashFilters(req.query);
    const [pins] = await pool.query(
      `SELECT id, name, house_no, area, lat, lng FROM civilians
       WHERE lat IS NOT NULL AND lng IS NOT NULL ${f.and}`,
      f.params
    );
    res.json({ success: true, pins, filters: { area: f.area, village: f.village } });
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
// CIVIL DIRECTORY (separate from civilians registry)
// ══════════════════════════════════════════════════════════════

async function initDirectoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS civil_directory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      designation VARCHAR(255) DEFAULT NULL,
      village VARCHAR(255) DEFAULT NULL,
      area VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dir_name (name),
      INDEX idx_dir_area (area),
      INDEX idx_dir_village (village)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function validateDirectoryBody(body) {
  const name        = (body.name || '').trim();
  const mobile      = (body.mobile || '').trim();
  const designation = (body.designation || '').trim() || null;
  const village     = (body.village || '').trim() || null;
  const area        = (body.area || '').trim() || null;

  if (!name)   return { error: 'Name is required.' };
  if (!mobile) return { error: 'Contact number is required.' };
  if (!/^[6-9]\d{9}$/.test(mobile))
    return { error: 'Enter a valid 10-digit Indian mobile number.' };
  if (area && !DEFINED_AREAS.includes(area))
    return { error: 'Invalid area selected.' };
  if (village && !DEFINED_VILLAGES.includes(village))
    return { error: 'Invalid village selected.' };

  return { name, mobile, designation, village, area };
}

app.get('/api/directory', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let records;
    if (!q) {
      [records] = await pool.query('SELECT * FROM civil_directory ORDER BY name ASC');
    } else {
      const like = `%${q}%`;
      [records] = await pool.query(`
        SELECT * FROM civil_directory
        WHERE name LIKE ? OR mobile LIKE ? OR designation LIKE ?
           OR village LIKE ? OR area LIKE ?
        ORDER BY name ASC
      `, Array(5).fill(like));
    }
    res.json({ success: true, records });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Directory load error' });
  }
});

app.get('/api/directory/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM civil_directory WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Entry not found.' });
    res.json({ success: true, record: rows[0] });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Directory load error' });
  }
});

app.post('/api/directory', requireAuth, async (req, res) => {
  try {
    const v = validateDirectoryBody(req.body);
    if (v.error) return res.json({ success: false, message: v.error });
    const [result] = await pool.query(`
      INSERT INTO civil_directory (name, mobile, designation, village, area)
      VALUES (?, ?, ?, ?, ?)
    `, [v.name, v.mobile, v.designation, v.village, v.area]);
    res.json({ success: true, message: 'Directory entry added.', id: result.insertId });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Failed to add entry.' });
  }
});

app.put('/api/directory/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.query('SELECT id FROM civil_directory WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) return res.json({ success: false, message: 'Entry not found.' });
    const v = validateDirectoryBody(req.body);
    if (v.error) return res.json({ success: false, message: v.error });
    await pool.query(`
      UPDATE civil_directory SET name=?, mobile=?, designation=?, village=?, area=?
      WHERE id=?
    `, [v.name, v.mobile, v.designation, v.village, v.area, id]);
    res.json({ success: true, message: 'Directory entry updated.' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Failed to update entry.' });
  }
});

app.delete('/api/directory/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.query('SELECT id FROM civil_directory WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.json({ success: false, message: 'Entry not found.' });
    await pool.query('DELETE FROM civil_directory WHERE id = ?', [id]);
    res.json({ success: true, message: 'Directory entry deleted.' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: 'Failed to delete entry.' });
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
           OR family_details LIKE ? OR house_no LIKE ?
           OR community LIKE ? OR religion LIKE ?
           OR immovable_property LIKE ? OR movable_property LIKE ?
           OR CAST(salary AS CHAR) LIKE ? OR CAST(income AS CHAR) LIKE ?
           OR CAST(expenditure AS CHAR) LIKE ?
        ORDER BY created_at DESC
      `, Array(14).fill(like));
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

// ══════════════════════════════════════════════════════════════
// NEWS (Times of India RSS proxy)
// ══════════════════════════════════════════════════════════════

const TOI = 'https://timesofindia.indiatimes.com';
const rssParser = new RSSParser({
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Official TOI RSS endpoints (see https://timesofindia.indiatimes.com/rss.cms)
const RSS_FEEDS = {
  // —— Main feeds ——
  top_stories:    { label: 'Top Stories',      group: 'Main', url: `${TOI}/rssfeedstopstories.cms` },
  most_recent:    { label: 'Most Recent',      group: 'Main', url: `${TOI}/rssfeedmostrecent.cms` },
  india:          { label: 'India',            group: 'Main', url: `${TOI}/rssfeeds/-2128936835.cms` },
  world:          { label: 'World',            group: 'Main', url: `${TOI}/rssfeeds/296589292.cms` },
  nri:            { label: 'NRI',              group: 'Main', url: `${TOI}/rssfeeds/7098551.cms` },
  business:       { label: 'Business',         group: 'Main', url: `${TOI}/rssfeeds/1898055.cms` },
  us:             { label: 'US',               group: 'Main', url: `${TOI}/rssfeeds_us/72258322.cms` },
  cricket:        { label: 'Cricket',          group: 'Main', url: `${TOI}/rssfeeds/54829575.cms` },
  sports:         { label: 'Sports',           group: 'Main', url: `${TOI}/rssfeeds/4719148.cms` },
  science:        { label: 'Science',          group: 'Main', url: `${TOI}/rssfeeds/-2128672765.cms` },
  environment:    { label: 'Environment',      group: 'Main', url: `${TOI}/rssfeeds/2647163.cms` },
  tech:           { label: 'Tech',             group: 'Main', url: `${TOI}/rssfeeds/66949542.cms` },
  education:      { label: 'Education',        group: 'Main', url: `${TOI}/rssfeeds/913168846.cms` },
  entertainment:  { label: 'Entertainment',    group: 'Main', url: `${TOI}/rssfeeds/1081479906.cms` },
  life_style:     { label: 'Life & Style',     group: 'Main', url: `${TOI}/rssfeeds/2886704.cms` },
  most_read:      { label: 'Most Read',        group: 'Main', url: `${TOI}/rssfeedmostread.cms` },
  most_shared:    { label: 'Most Shared',      group: 'Main', url: `${TOI}/rssfeedmostshared.cms` },
  most_commented: { label: 'Most Commented',   group: 'Main', url: `${TOI}/rssfeedmostcommented.cms` },
  astrology:      { label: 'Astrology',        group: 'Main', url: `${TOI}/rssfeeds/65857041.cms` },
  auto:           { label: 'Auto',             group: 'Main', url: `${TOI}/rssfeeds/74317216.cms` },

  // —— Cities ——
  mumbai:              { label: 'Mumbai',               group: 'Cities', url: `${TOI}/rssfeeds/-2128838597.cms` },
  delhi:               { label: 'Delhi',                group: 'Cities', url: `${TOI}/rssfeeds/-2128839596.cms` },
  bengaluru:           { label: 'Bengaluru',            group: 'Cities', url: `${TOI}/rssfeeds/-2128833038.cms` },
  hyderabad:           { label: 'Hyderabad',            group: 'Cities', url: `${TOI}/rssfeeds/-2128816011.cms` },
  chennai:             { label: 'Chennai',              group: 'Cities', url: `${TOI}/rssfeeds/2950623.cms` },
  ahmedabad:           { label: 'Ahmedabad',            group: 'Cities', url: `${TOI}/rssfeeds/-2128821153.cms` },
  allahabad:           { label: 'Prayagraj (Allahabad)', group: 'Cities', url: `${TOI}/rssfeeds/3947060.cms` },
  bhubaneswar:         { label: 'Bhubaneswar',          group: 'Cities', url: `${TOI}/rssfeeds/4118235.cms` },
  coimbatore:          { label: 'Coimbatore',           group: 'Cities', url: `${TOI}/rssfeeds/7503091.cms` },
  gurgaon:             { label: 'Gurgaon',              group: 'Cities', url: `${TOI}/rssfeeds/6547154.cms` },
  guwahati:            { label: 'Guwahati',             group: 'Cities', url: `${TOI}/rssfeeds/4118215.cms` },
  hubli:               { label: 'Hubli',                group: 'Cities', url: `${TOI}/rssfeeds/3942695.cms` },
  kanpur:              { label: 'Kanpur',               group: 'Cities', url: `${TOI}/rssfeeds/3947067.cms` },
  kolkata:             { label: 'Kolkata',              group: 'Cities', url: `${TOI}/rssfeeds/-2128830821.cms` },
  ludhiana:            { label: 'Ludhiana',             group: 'Cities', url: `${TOI}/rssfeeds/3947051.cms` },
  mangalore:           { label: 'Mangalore',            group: 'Cities', url: `${TOI}/rssfeeds/3942690.cms` },
  mysore:              { label: 'Mysore',               group: 'Cities', url: `${TOI}/rssfeeds/3942693.cms` },
  noida:               { label: 'Noida',                group: 'Cities', url: `${TOI}/rssfeeds/8021716.cms` },
  pune:                { label: 'Pune',                 group: 'Cities', url: `${TOI}/rssfeeds/-2128821991.cms` },
  goa:                 { label: 'Goa',                  group: 'Cities', url: `${TOI}/rssfeeds/3012535.cms` },
  chandigarh:          { label: 'Chandigarh',           group: 'Cities', url: `${TOI}/rssfeeds/-2128816762.cms` },
  lucknow:             { label: 'Lucknow',              group: 'Cities', url: `${TOI}/rssfeeds/-2128819658.cms` },
  patna:               { label: 'Patna',                group: 'Cities', url: `${TOI}/rssfeeds/-2128817995.cms` },
  jaipur:              { label: 'Jaipur',               group: 'Cities', url: `${TOI}/rssfeeds/3012544.cms` },
  nagpur:              { label: 'Nagpur',               group: 'Cities', url: `${TOI}/rssfeeds/442002.cms` },
  rajkot:              { label: 'Rajkot',               group: 'Cities', url: `${TOI}/rssfeeds/3942663.cms` },
  ranchi:              { label: 'Ranchi',               group: 'Cities', url: `${TOI}/rssfeeds/4118245.cms` },
  surat:               { label: 'Surat',                group: 'Cities', url: `${TOI}/rssfeeds/3942660.cms` },
  vadodara:            { label: 'Vadodara',             group: 'Cities', url: `${TOI}/rssfeeds/3942666.cms` },
  varanasi:            { label: 'Varanasi',             group: 'Cities', url: `${TOI}/rssfeeds/3947071.cms` },
  thane:               { label: 'Thane',                group: 'Cities', url: `${TOI}/rssfeeds/3831863.cms` },
  thiruvananthapuram:  { label: 'Thiruvananthapuram',   group: 'Cities', url: `${TOI}/rssfeeds/878156304.cms` },

  // Jammu & Kashmir: Srinagar/Jammu are not on TOI’s public rss.cms city list; India national RSS routinely leads with UT stories.
  jammu_kashmir: { label: 'Jammu & Kashmir (India headlines)', group: 'Cities', url: `${TOI}/rssfeeds/-2128936835.cms` },

  // —— World (section feeds) ——
  world_us:        { label: 'US (World)',      group: 'World', url: `${TOI}/rssfeeds/30359486.cms` },
  pakistan:        { label: 'Pakistan',        group: 'World', url: `${TOI}/rssfeeds/30359534.cms` },
  south_asia:      { label: 'South Asia',      group: 'World', url: `${TOI}/rssfeeds/3907412.cms` },
  uk:              { label: 'UK',              group: 'World', url: `${TOI}/rssfeeds/2177298.cms` },
  europe:          { label: 'Europe',          group: 'World', url: `${TOI}/rssfeeds/1898274.cms` },
  china:           { label: 'China',           group: 'World', url: `${TOI}/rssfeeds/1898184.cms` },
  middle_east:     { label: 'Middle East',     group: 'World', url: `${TOI}/rssfeeds/1898272.cms` },
  rest_of_world:   { label: 'Rest of World',   group: 'World', url: `${TOI}/rssfeeds/671314.cms` },

  // —— Blogs ——
  all_blogs: { label: 'All Blogs', group: 'Blogs', url: 'https://blogs.timesofindia.indiatimes.com/feed/defaultrss' },
};

function rssItemImage(item) {
  const enc = item.enclosure;
  if (enc?.url && (!enc.type || String(enc.type).startsWith('image'))) return enc.url;
  const html = item['content:encoded'] || item.content || item.summary || item.description || '';
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

app.get('/api/news', requireAuth, async (req, res) => {
  const key  = req.query.feed || 'jammu_kashmir';
  const feed = RSS_FEEDS[key];
  if (!feed) return res.json({ success: false, message: 'Unknown feed key.' });
  try {
    const parsed = await rssParser.parseURL(feed.url);
    const items  = (parsed.items || []).slice(0, 20).map(item => ({
      title:       item.title        || '',
      description: item.contentSnippet || item.summary || '',
      link:        item.link         || '',
      pubDate:     item.pubDate      || '',
      image:       rssItemImage(item),
    }));
    res.json({ success: true, label: feed.label, items });
  } catch (e) {
    console.error('RSS fetch error:', e.message);
    res.json({ success: false, message: 'Could not fetch news feed. Please try again.' });
  }
});

const RSS_GROUP_ORDER = ['Main', 'Cities', 'World', 'Blogs'];
app.get('/api/news/feeds', requireAuth, (req, res) => {
  const rank = g => {
    const i = RSS_GROUP_ORDER.indexOf(g);
    return i === -1 ? 99 : i;
  };
  const feeds = Object.entries(RSS_FEEDS)
    .map(([key, { label, group }]) => ({ key, label, group }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.label.localeCompare(b.label));
  res.json({ success: true, feeds });
});

// ── Start server ───────────────────────────────────────────────
initDirectoryTable()
  .then(() => {
    app.listen(PORT, () => console.log(`Civilian backend running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to init civil_directory table:', err);
    process.exit(1);
  });
