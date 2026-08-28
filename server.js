const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PORT = 8000;

// ================= 数据库 =================
const db = new DatabaseSync(path.join(ROOT, 'data.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    profile_json TEXT,
    is_static INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    sport TEXT,
    city TEXT,
    time TEXT,
    location TEXT,
    creator_id INTEGER NOT NULL,
    max_people INTEGER DEFAULT 6,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(creator_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS event_joins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ================= 密码 =================
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');
  const test = crypto.scryptSync(pw, salt, 64);
  return hash.length === test.length && crypto.timingSafeEqual(hash, test);
}

// ================= 会话 =================
const sessions = new Map(); // token -> userId
const SESSION_TTL = 7 * 24 * 3600 * 1000;
function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId, expire: Date.now() + SESSION_TTL });
  return token;
}
function getUserId(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/xyzy_token=([^;]+)/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s) return null;
  if (s.expire < Date.now()) { sessions.delete(m[1]); return null; }
  return s.userId;
}

// ================= 种子数据 =================
const STATIC_MEMBERS = [
  { name: "徐冬冬", age: 30, gender: "男", province: "河南", city: "许昌", nation: "汉族", education: "本科", job: "国企", height: 179, weight: 76, marry: "未婚", income: "15‑20万", hobby: "长跑、挑战自我", honor: "三等功一枚", isSoldier: true, selfIntro: "军人出身，转业后在国企工作。坚持长跑多年，喜欢挑战自我，做事踏实有担当，希望在许你之约遇见真诚的另一半。", want: "真诚善良，性格开朗，愿意一起跑步、一起成长。", avatar: "img1.jpg" },
  { name: "陈锐", age: 29, gender: "男", province: "河南", city: "许昌", nation: "汉族", education: "本科", job: "国企", height: 178, weight: 82, marry: "未婚", income: "15‑20万", hobby: "长跑、健身、器械运动", honor: "三等功一枚", isSoldier: true, selfIntro: "性格踏实稳重，热爱运动，坚持长跑锻炼，做事有责任心，希望遇见真诚相伴的另一半。", want: "年龄25‑29岁，性格开朗，三观端正，愿意一起运动跑步。", avatar: "https://p3-flow-image-sign.byteimg.com/tos-cn-i-a9rned3rph/0e10001200944008992021f210440311~tplv-a9rned3rph-image.image" },
  { name: "林知夏", age: 27, gender: "女", province: "浙江", nation: "汉族", education: "本科", job: "国企", city: "杭州", height: 165, weight: 54, marry: "未婚", income: "10‑15万", hobby: "羽毛球、旅行、看书", honor: "无", selfIntro: "性格温柔，喜欢安静生活，空闲时间爱出游看风景。", want: "成熟稳重，有上进心，热爱生活。", avatar: "https://picsum.photos/id/64/400/400" },
  { name: "周奕辰", age: 30, gender: "男", province: "上海", nation: "汉族", education: "硕士", job: "央企", city: "上海", height: 180, weight: 78, marry: "未婚", income: "25‑30万", hobby: "篮球、跑步、摄影", honor: "无", selfIntro: "热爱生活，平时喜欢户外，待人真诚。", want: "性格随和，愿意一起探索城市美景。", avatar: "https://picsum.photos/id/91/400/400" },
  { name: "许清瑶", age: 26, gender: "女", province: "广东", nation: "壮族", education: "本科", job: "自由职业", city: "广州", height: 163, weight: 51, marry: "未婚", income: "12‑18万", hobby: "网球、咖啡、画画", honor: "无", selfIntro: "自由职业时间灵活，热爱艺术，享受慢节奏生活。", want: "情绪稳定，有共同话题，热爱生活。", avatar: "https://picsum.photos/id/26/400/400" },
  { name: "陈浩然", age: 32, gender: "男", province: "北京", nation: "满族", education: "博士", job: "高校教师", city: "北京", height: 176, weight: 75, marry: "未婚", income: "20‑25万", hobby: "乒乓球、爬山、读书", honor: "无", selfIntro: "喜欢阅读和登山，生活作息规律。", want: "喜欢读书，性格温柔，热爱学习。", avatar: "https://picsum.photos/id/1005/400/400" },
  { name: "赵雨桐", age: 28, gender: "女", province: "江苏", nation: "汉族", education: "本科", job: "互联网", city: "南京", height: 166, weight: 53, marry: "未婚", income: "18‑22万", hobby: "瑜伽、跑步、探店", honor: "无", selfIntro: "性格活泼开朗，周末爱打卡美食。", want: "阳光开朗，喜欢运动，三观契合。", avatar: "https://picsum.photos/id/65/400/400" },
  { name: "孙景阳", age: 29, gender: "男", province: "四川", nation: "汉族", education: "本科", job: "自由职业", city: "成都", height: 177, weight: 80, marry: "未婚", income: "13‑18万", hobby: "足球、音乐、自驾", honor: "无", selfIntro: "自由职业，热爱自驾游，性格随和幽默。", want: "热爱旅行，性格乐观，相处轻松愉快。", avatar: "https://picsum.photos/id/1012/400/400" },
  { name: "马依娜", age: 27, gender: "女", province: "河南", nation: "回族", education: "硕士", job: "国企", city: "郑州", height: 164, weight: 52, marry: "未婚", income: "14‑19万", hobby: "羽毛球、烘焙、电影", honor: "无", selfIntro: "热爱美食烘焙，闲暇喜欢看电影。", want: "踏实上进，有稳定工作，性格温和。", avatar: "https://picsum.photos/id/292/400/400" }
];

const STATIC_EVENTS = [
  { title: "周六下午长跑组队", sport: "长跑", city: "许昌", time: "2026‑09‑06 06:30", location: "许昌中央公园跑道", creator: "徐冬冬", maxPeople: 6, joinedPeople: 2, desc: "休闲慢跑，配速适中，坚持就是胜利，长跑爱好者欢迎一起。" },
  { title: "周六下午羽毛球组队", sport: "羽毛球", city: "杭州", time: "2026-06-21 14:00", location: "西湖区某羽毛球馆", creator: "林知夏", maxPeople: 4, joinedPeople: 2, desc: "轻松强度，欢迎新手和爱好者一起打球。" },
  { title: "周日篮球半场约战", sport: "篮球", city: "上海", time: "2026-06-22 15:30", location: "徐汇区室内篮球场", creator: "周奕辰", maxPeople: 6, joinedPeople: 5, desc: "水平中等，打半场为主，费用AA。" },
  { title: "周末网球新手练习", sport: "网球", city: "广州", time: "2026-06-22 10:00", location: "天河区体育中心网球场", creator: "许清瑶", maxPeople: 2, joinedPeople: 1, desc: "新手友好，已有教练基础，可一起练习。" },
  { title: "周三晚上乒乓球局", sport: "乒乓球", city: "北京", time: "2026-06-18 19:00", location: "朝阳区乒乓球馆", creator: "陈浩然", maxPeople: 4, joinedPeople: 4, desc: "固定练球局，人满为止，感谢理解。" },
  { title: "夜跑小分队集合", sport: "跑步", city: "南京", time: "2026-06-19 20:00", location: "玄武湖公园入口", creator: "赵雨桐", maxPeople: 6, joinedPeople: 3, desc: "慢跑5公里，配速不追求，安全和轻松最重要。" }
];

function seed() {
  const c = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (c > 0) return;
  const insUser = db.prepare('INSERT INTO users (name, phone, pass_hash, profile_json, is_static) VALUES (?, ?, ?, ?, 1)');
  const insEvent = db.prepare('INSERT INTO events (title, sport, city, time, location, creator_id, max_people, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insJoin = db.prepare('INSERT INTO event_joins (event_id, user_id) VALUES (?, ?)');
  const uid = {};
  for (const m of STATIC_MEMBERS) {
    const info = insUser.run(m.name, 'static_' + m.name, crypto.randomBytes(16).toString('hex'), JSON.stringify(m));
    uid[m.name] = Number(info.lastInsertRowid);
  }
  for (const e of STATIC_EVENTS) {
    const cid = uid[e.creator];
    const info = insEvent.run(e.title, e.sport, e.city, e.time, e.location, cid, e.maxPeople, e.desc);
    const eid = Number(info.lastInsertRowid);
    insJoin.run(eid, cid);
    let extra = e.joinedPeople - 1;
    for (const m of STATIC_MEMBERS) {
      if (extra <= 0) break;
      if (m.name === e.creator) continue;
      try { insJoin.run(eid, uid[m.name]); extra--; } catch (err) {}
    }
  }
}
seed();

// ================= 工具 =================
function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function ok(res, data) { sendJson(res, 200, { ok: true, data }); }
function fail(res, code, error) { sendJson(res, code, { ok: false, error }); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (ch) => {
      raw += ch;
      if (raw.length > 1e6) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function parseProfile(json) {
  try { return json ? JSON.parse(json) : null; }
  catch (e) { return null; }
}
function userView(u) {
  const p = parseProfile(u.profile_json);
  if (u.is_static || p) {
    const base = p || {};
    return { id: u.id, ...base };
  }
  return { id: u.id, name: u.name, phone: u.phone, hasProfile: false };
}

function eventView(row, userId) {
  const p = parseProfile(row.creator_profile);
  const joinedCount = db.prepare('SELECT COUNT(*) AS c FROM event_joins WHERE event_id = ?').get(row.id).c;
  const joined = userId ? db.prepare('SELECT 1 AS x FROM event_joins WHERE event_id = ? AND user_id = ?').get(row.id, userId) : null;
  const max = row.max_people;
  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    city: row.city,
    time: row.time,
    location: row.location,
    description: row.description,
    creatorId: row.creator_id,
    creator: (p && p.name) || row.creator_name,
    creatorAvatar: (p && p.avatar) || '',
    maxPeople: max,
    joinedPeople: joinedCount,
    joined: !!joined,
    isFull: joinedCount >= max
  };
}

// ================= 静态文件 =================
const STATIC_FILES = ['index.html', 'img1.jpg'];
function serveStatic(req, res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (!STATIC_FILES.includes(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const full = path.join(ROOT, file);
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/jpeg';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

// ================= 路由 =================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method;

  // 静态资源
  const isStaticPath = p === '/' || p === '/index.html' || p === '/img1.jpg';
  if (method === 'GET' && isStaticPath) return serveStatic(req, res, p);

  try {
    // ---------------- 认证 ----------------
    if (method === 'POST' && p === '/api/register') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');
      if (!name || !phone || !password) return fail(res, 400, '请填写完整的注册信息');
      if (!/^1\d{10}$/.test(phone)) return fail(res, 400, '请输入正确的手机号');
      if (password.length < 4) return fail(res, 400, '密码至少4位');
      const exists = db.prepare('SELECT 1 AS x FROM users WHERE name = ? OR phone = ?').get(name, phone);
      if (exists) return fail(res, 400, '该昵称或手机号已被注册');
      const info = db.prepare('INSERT INTO users (name, phone, pass_hash) VALUES (?, ?, ?)')
        .run(name, phone, hashPassword(password));
      const token = createSession(Number(info.lastInsertRowid));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `xyzy_token=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL / 1000}`
      });
      res.end(JSON.stringify({ ok: true, data: { name } }));
      return;
    }

    if (method === 'POST' && p === '/api/login') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      if (!name || !password) return fail(res, 400, '请输入账号和密码');
      const u = db.prepare('SELECT * FROM users WHERE name = ? OR phone = ?').get(name, name);
      if (!u || u.is_static || !verifyPassword(password, u.pass_hash)) return fail(res, 400, '账号或密码错误');
      const token = createSession(u.id);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `xyzy_token=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL / 1000}`
      });
      res.end(JSON.stringify({ ok: true, data: { name: u.name } }));
      return;
    }

    if (method === 'POST' && p === '/api/logout') {
      const cookie = req.headers.cookie || '';
      const m = cookie.match(/xyzy_token=([^;]+)/);
      if (m) sessions.delete(m[1]);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'xyzy_token=; HttpOnly; Path=/; Max-Age=0'
      });
      res.end(JSON.stringify({ ok: true, data: null }));
      return;
    }

    // ---------------- 当前用户 ----------------
    if (method === 'GET' && p === '/api/me') {
      const userId = getUserId(req);
      if (!userId) return ok(res, null);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!u) return ok(res, null);
      const pdata = parseProfile(u.profile_json);
      return ok(res, { id: u.id, name: u.name, phone: u.phone, profile: pdata });
    }

    // ---------------- 保存个人资料 ----------------
    if (method === 'PUT' && p === '/api/profile') {
      const userId = getUserId(req);
      if (!userId) return fail(res, 401, '请先登录');
      const body = await readBody(req);
      if (!body.name || !String(body.name).trim()) return fail(res, 400, '姓名不能为空');
      const profile = {
        avatar: body.avatar || '',
        name: String(body.name).trim(),
        gender: body.gender || '男',
        age: body.age || '',
        nation: body.nation || '汉族',
        province: body.province || '河南',
        city: body.city || '',
        height: body.height || '',
        weight: body.weight || '',
        education: body.education || '本科',
        job: body.job || '国企',
        marry: body.marry || '未婚',
        income: body.income || '10‑20万',
        hobby: body.hobby || '',
        honor: body.honor || '',
        selfIntro: body.selfIntro || '',
        want: body.want || ''
      };
      db.prepare('UPDATE users SET profile_json = ? WHERE id = ?').run(JSON.stringify(profile), userId);
      return ok(res, { profile });
    }

    // ---------------- 会员列表 ----------------
    if (method === 'GET' && p === '/api/members') {
      const rows = db.prepare('SELECT * FROM users').all();
      const members = rows
        .filter(r => r.is_static || r.profile_json)
        .map(r => userView(r));
      return ok(res, members);
    }

    // ---------------- 约球列表 ----------------
    if (method === 'GET' && p === '/api/events') {
      const userId = getUserId(req);
      const rows = db.prepare(`
        SELECT e.*, u.name AS creator_name, u.profile_json AS creator_profile
        FROM events e JOIN users u ON u.id = e.creator_id
        ORDER BY e.id ASC
      `).all();
      return ok(res, rows.map(r => eventView(r, userId)));
    }

    // ---------------- 我的约球 ----------------
    if (method === 'GET' && p === '/api/my/events') {
      const userId = getUserId(req);
      if (!userId) return fail(res, 401, '请先登录');
      const rows = db.prepare(`
        SELECT e.*, u.name AS creator_name, u.profile_json AS creator_profile
        FROM events e JOIN users u ON u.id = e.creator_id
        WHERE e.creator_id = ? ORDER BY e.id DESC
      `).all(userId);
      return ok(res, rows.map(r => eventView(r, userId)));
    }

    // ---------------- 我应约的约球 ----------------
    if (method === 'GET' && p === '/api/my/joins') {
      const userId = getUserId(req);
      if (!userId) return fail(res, 401, '请先登录');
      const rows = db.prepare(`
        SELECT e.*, u.name AS creator_name, u.profile_json AS creator_profile
        FROM event_joins j
        JOIN events e ON e.id = j.event_id
        JOIN users u ON u.id = e.creator_id
        WHERE j.user_id = ? AND e.creator_id != ?
        ORDER BY e.id DESC
      `).all(userId, userId);
      return ok(res, rows.map(r => eventView(r, userId)));
    }

    // ---------------- 发布约球 ----------------
    if (method === 'POST' && p === '/api/events') {
      const userId = getUserId(req);
      if (!userId) return fail(res, 401, '请先登录');
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const pdata = parseProfile(u.profile_json);
      if (!pdata) return fail(res, 400, '请先完善个人资料');
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const time = String(body.time || '').trim();
      const location = String(body.location || '').trim();
      if (!title || !time || !location) return fail(res, 400, '请填写活动标题、时间和地点');
      const info = db.prepare(`
        INSERT INTO events (title, sport, city, time, location, creator_id, max_people, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, body.sport || '长跑', body.city || '许昌', time, location, userId, parseInt(body.maxPeople, 10) || 6, String(body.desc || '').trim());
      const eid = Number(info.lastInsertRowid);
      db.prepare('INSERT INTO event_joins (event_id, user_id) VALUES (?, ?)').run(eid, userId);
      return ok(res, { id: eid });
    }

    // ---------------- 应约 ----------------
    const joinMatch = p.match(/^\/api\/events\/(\d+)\/join$/);
    if (method === 'POST' && joinMatch) {
      const userId = getUserId(req);
      if (!userId) return fail(res, 401, '请先登录');
      const eid = parseInt(joinMatch[1], 10);
      const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eid);
      if (!ev) return fail(res, 404, '活动不存在');
      const already = db.prepare('SELECT 1 AS x FROM event_joins WHERE event_id = ? AND user_id = ?').get(eid, userId);
      if (already) return fail(res, 400, '你已应约该活动');
      const count = db.prepare('SELECT COUNT(*) AS c FROM event_joins WHERE event_id = ?').get(eid).c;
      if (count >= ev.max_people) return fail(res, 400, '活动已满员');
      db.prepare('INSERT INTO event_joins (event_id, user_id) VALUES (?, ?)').run(eid, userId);
      return ok(res, { joinedPeople: count + 1 });
    }

    return fail(res, 404, '接口不存在');
  } catch (err) {
    return fail(res, 400, err.message || '请求处理失败');
  }
});

server.listen(PORT, () => {
  console.log(`[许你之约] 服务已启动: http://localhost:${PORT}`);
});
