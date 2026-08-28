const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/workspace/data.db');

const SPORTS = [
    { name: '长跑', titles: ['周末长跑拉练', '清晨长跑挑战', '滨河长跑组队'], locations: ['中央公园跑道', '滨河绿道', '体育中心田径场'], times: ['06:30', '07:00'] },
    { name: '跑步', titles: ['晨跑小分队', '夜跑集结', '轻松慢跑5公里'], locations: ['公园环湖步道', '城市绿道', '江边步道'], times: ['07:00', '19:30', '20:00'] },
    { name: '羽毛球', titles: ['周末羽毛球局', '羽毛球双打约战'], locations: ['羽毛球馆', '市民体育馆'], times: ['14:00', '19:00'] },
    { name: '篮球', titles: ['周末篮球半场', '篮球对抗赛'], locations: ['室内篮球场', '社区篮球场'], times: ['15:30', '19:00'] },
    { name: '足球', titles: ['五人制足球', '周末足球友谊赛'], locations: ['足球公园', '学校足球场'], times: ['16:00'] },
    { name: '乒乓球', titles: ['乒乓球练球局', '周末乒乓约练'], locations: ['乒乓球馆', '社区活动中心'], times: ['19:00', '20:00'] },
    { name: '网球', titles: ['网球新手练习', '网球对拉局'], locations: ['体育中心网球场', '网球公园'], times: ['10:00', '16:30'] },
    { name: '骑行', titles: ['周末骑行郊游', '滨江骑行拉练'], locations: ['环城骑行道', '滨江大道'], times: ['08:00', '09:00'] },
    { name: '游泳', titles: ['周末游泳健身', '晨泳约起来'], locations: ['市游泳馆', '健身中心泳池'], times: ['09:00', '19:00'] },
    { name: '爬山', titles: ['周末登山徒步', '山野徒步组队'], locations: ['城郊风景区', '郊野公园'], times: ['08:00', '09:30'] }
];
const DESCS = [
    '强度适中，氛围轻松，欢迎新手和爱好者一起，费用AA。',
    '志同道合的朋友一起锻炼，坚持锻炼保持好状态，人满即止。',
    '运动交友两不误，期待和你一起挥洒汗水，安全第一。',
    '固定活动局，配速/强度以多数人为准，欢迎报名。'
];
const DAY_NAMES = ['周日','周一','周二','周三','周四','周五','周六'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomTime() {
    const base = new Date('2026-08-28T00:00:00');
    const day = base.getDate() + 1 + Math.floor(Math.random() * 14);
    const d = new Date(2026, 7, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 找出随机生成的用户（phone 前缀 auto_）作为发布者
const autoUsers = db.prepare("SELECT id, profile_json FROM users WHERE phone LIKE 'auto_%'").all();
if (autoUsers.length < 10) {
    console.log('随机会员数量不足，请先运行 node gen_users.js');
    process.exit(1);
}

// 清理旧的自动生成约球
const oldEvents = db.prepare(`
    SELECT e.id FROM events e JOIN users u ON u.id = e.creator_id
    WHERE u.phone LIKE 'auto_%'
`).all();
const delJoins = db.prepare('DELETE FROM event_joins WHERE event_id = ?');
const delEvent = db.prepare('DELETE FROM events WHERE id = ?');
for (const e of oldEvents) { delJoins.run(e.id); delEvent.run(e.id); }

const insEvent = db.prepare('INSERT INTO events (title, sport, city, time, location, creator_id, max_people, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insJoin = db.prepare('INSERT INTO event_joins (event_id, user_id) VALUES (?, ?)');

const count = parseInt(process.argv[2], 10) || 16;
let created = 0;
for (let i = 0; i < count; i++) {
    const sp = pick(SPORTS);
    const creator = pick(autoUsers);
    const cp = JSON.parse(creator.profile_json);
    const datePart = randomTime();
    const info = insEvent.run(
        pick(sp.titles),
        sp.name,
        cp.city || '许昌',
        datePart + ' ' + pick(sp.times),
        pick(sp.locations),
        creator.id,
        pick([4, 4, 6, 6, 6, 8, 10]),
        pick(DESCS)
    );
    const eid = Number(info.lastInsertRowid);
    const joinedIds = new Set([creator.id]);
    insJoin.run(eid, creator.id);
    // 随机应约者
    const extra = Math.floor(Math.random() * 4);
    const others = autoUsers.filter(u => u.id !== creator.id);
    for (let k = 0; k < extra && k < others.length; k++) {
        const joiner = pick(others);
        if (joinedIds.has(joiner.id)) continue;
        joinedIds.add(joiner.id);
        try { insJoin.run(eid, joiner.id); } catch (e) {}
    }
    created++;
}

const total = db.prepare('SELECT COUNT(*) c FROM events').get().c;
console.log(`已生成 ${created} 场约球，平台约球总数：${total}`);
