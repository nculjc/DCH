const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('/workspace/data.db');

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚','文'];
const MALE_NAMES = ['浩然','子轩','宇轩','梓豪','俊杰','志强','国豪','文博','天宇','昊然','明轩','逸飞','泽宇','俊熙','睿泽','承宇','宇航','思远','铭泽','博文','辰逸','俊驰','建辉','云帆','明远','靖宇','沛霖','振华','凯旋','伟业'];
const FEMALE_NAMES = ['雨桐','诗涵','欣怡','梓萱','梦琪','思颖','若曦','婉婷','雅静','静怡','佳琪','雪晴','晓梅','文婷','丽华','丹丹','梦瑶','紫萱','语嫣','婷婷','思雨','可欣','雅雯','芳芳','慧敏','欣妍','依诺','晓彤','梦洁','芷晴'];
const NATIONS = ['汉族','汉族','汉族','汉族','汉族','汉族','汉族','回族','满族','壮族','维吾尔族','苗族','彝族'];
const CITIES = [
    { p: '河南', c: ['郑州','洛阳','开封','许昌','新乡','南阳','安阳','周口'] },
    { p: '北京', c: ['北京'] },
    { p: '上海', c: ['上海'] },
    { p: '广东', c: ['广州','深圳','珠海','佛山','东莞'] },
    { p: '江苏', c: ['南京','苏州','无锡','常州','徐州'] },
    { p: '浙江', c: ['杭州','宁波','温州','嘉兴','绍兴'] },
    { p: '四川', c: ['成都','绵阳','乐山','宜宾'] },
    { p: '湖北', c: ['武汉','宜昌','襄阳','荆州'] },
    { p: '山东', c: ['济南','青岛','烟台','潍坊'] },
    { p: '陕西', c: ['西安','咸阳','宝鸡'] }
];
const EDU = ['大专','本科','本科','本科','硕士','硕士','博士'];
const JOBS = ['国企','国企','央企','互联网','教育医疗','自由职业','其他'];
const MARRIES = ['未婚','未婚','未婚','未婚','未婚','离异'];
const INCOMES = ['5‑10万','10‑20万','10‑20万','20‑30万','20‑30万','30万以上'];
const HOBBIES = ['长跑','跑步','健身','羽毛球','篮球','足球','乒乓球','网球','游泳','爬山','骑行','瑜伽','滑雪','徒步','摄影','阅读','音乐','烘焙','书法','钓鱼','桌球','搏击','马拉松','户外露营'];
const MALE_HOBBIES = ['长跑','健身','篮球','足球','骑行','登山','游泳','搏击','马拉松','钓鱼','户外露营','桌球'];
const FEMALE_HOBBIES = ['瑜伽','跑步','羽毛球','游泳','爬山','阅读','音乐','烘焙','摄影','舞蹈','插花','旅行'];
const INTRO_TEMPLATES = [
    '性格{char}，生活自律，坚持{active}，希望遇见真诚的另一半，一起把日子过成喜欢的样子。',
    '工作稳定，为人{char}，空闲喜欢{active}，相信缘分，期待一段双向奔赴的感情。',
    '{char}是我的标签，坚持{active}让我保持好状态，想找一个聊得来、玩得到一起的人。',
    '热爱生活，习惯{active}，性格{char}，愿意在柴米油盐里经营浪漫。'
];
const WANT_TEMPLATES = [
    '希望对方{char}，三观正，最好也喜欢运动，能一起锻炼一起成长。',
    '期待一个真诚善良、{char}的人，有稳定工作，愿意共同经营家庭。',
    '喜欢{char}、热爱生活的另一半，聊得来、相处舒服最重要。'
];
const CHAR_WORDS = ['踏实稳重','阳光开朗','温柔体贴','幽默健谈','积极上进','真诚可靠','细腻温和','乐观大方'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
    const s = new Set();
    while (s.size < n) s.add(pick(arr));
    return [...s];
}

function genProfile(seq) {
    const gender = Math.random() < 0.5 ? '男' : '女';
    const name = pick(SURNAMES) + pick(gender === '男' ? MALE_NAMES : FEMALE_NAMES);
    const age = 24 + Math.floor(Math.random() * 12);
    const nation = pick(NATIONS);
    const cityObj = pick(CITIES);
    const province = cityObj.p;
    const city = pick(cityObj.c);
    const education = pick(EDU);
    const job = pick(JOBS);
    const marry = pick(MARRIES);
    const income = pick(INCOMES);
    const isSoldier = Math.random() < 0.4;
    const honor = isSoldier ? (Math.random() < 0.5 ? '三等功一枚' : (Math.random() < 0.5 ? '优秀士兵' : '嘉奖一次')) : '无';
    const hobbyList = pickN(gender === '男' ? MALE_HOBBIES : FEMALE_HOBBIES, 2 + Math.floor(Math.random() * 2));
    const hobby = hobbyList.join('、');
    const char1 = pick(CHAR_WORDS);
    const char2 = pick(CHAR_WORDS.filter(w => w !== char1));
    const active = hobbyList[0];
    const height = gender === '男' ? 172 + Math.floor(Math.random() * 12) : 158 + Math.floor(Math.random() * 10);
    const weight = gender === '男' ? 65 + Math.floor(Math.random() * 20) : 47 + Math.floor(Math.random() * 12);
    const selfIntro = (isSoldier ? `退伍军人，曾在部队服役${honor === '无' ? '' : '，荣获' + honor}。现在` + job + '工作，' : '') +
        INTRO_TEMPLATES[Math.floor(Math.random() * INTRO_TEMPLATES.length)]
            .replace('{char}', char1).replace('{active}', active);
    const want = WANT_TEMPLATES[Math.floor(Math.random() * WANT_TEMPLATES.length)].replace('{char}', char2);
    const avatar = gender === '男'
        ? `https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 100)}.jpg`
        : `https://randomuser.me/api/portraits/women/${Math.floor(Math.random() * 100)}.jpg`;

    return {
        name, age, gender, province, city, nation, education, job, marry, income,
        height, weight, hobby, honor, isSoldier, selfIntro, want, avatar
    };
}

const count = parseInt(process.argv[2], 10) || 50;

// 清理旧的自动生成用户
const old = db.prepare("SELECT id, name FROM users WHERE phone LIKE 'auto_%'").all();
const delJoins = db.prepare('DELETE FROM event_joins WHERE user_id = ?');
const delEvents = db.prepare('DELETE FROM events WHERE creator_id = ?');
const delUser = db.prepare('DELETE FROM users WHERE id = ?');
for (const u of old) {
    delJoins.run(u.id);
    delEvents.run(u.id);
    delUser.run(u.id);
}

const ins = db.prepare('INSERT INTO users (name, phone, pass_hash, profile_json, is_static) VALUES (?, ?, ?, ?, 1)');
const usedNames = new Set();
let created = 0;
for (let i = 0; i < count; i++) {
    const p = genProfile(i);
    if (usedNames.has(p.name)) { i--; continue; }
    usedNames.add(p.name);
    ins.run(p.name, 'auto_' + i + '_' + Date.now(), crypto.randomBytes(16).toString('hex'), JSON.stringify(p));
    created++;
}

const total = db.prepare('SELECT COUNT(*) c FROM users').get().c;
console.log(`已生成 ${created} 位随机会员，平台会员总数：${total}`);
