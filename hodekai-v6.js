// ═══════════════════════════════════════════════════════════
// 🖤 HODEKAI BOT v6.1 — CONCLAVE HOLDINGS
// ═══════════════════════════════════════════════════════════

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// ─── CONFIG ─────────────────────────────
const PREFIX = ":";
const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "256775032199";
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = "Hodekai";
const BOT_VERSION = "6.1.0"; // internal only — never shown in chat text
const OWNER_SETUP_KEY = process.env.OWNER_SETUP_KEY || null;

const FATHER_NUMBERS = ["263787876771", "0787876771", "787876771"];
const CO_CREATOR_NUMBERS = ["263717306869", "0717306869", "717306869"];
const OWNERS = { FATHER: "263787876771", CO_CREATOR: "263717306869" };

let MODS = ["2348123885002", "2349168527304", "256795955270", "2347031331295"];
let BLACKLIST = [];
let LOCKED_GROUPS = [];
let COUNCIL_GROUP = null;

const CONFIG = {
    COMPANY_TAX: 0.15,
    COMPANY_TAX_BANKRUPTCY: 600,
    USER_TAX: 0.05,
    LOAN_INTEREST: 0.003,
    LOAN_INTEREST_TICK: 172800000,
    BANKRUPTCY: 500000,
    COMPANY_MIN: 5000,
    CONTRACT_MIN_MS: 172800000, // 2 days minimum before an employee can leave penalty-free
    CONTRACT_BREAK_FEE: 400,    // compensation owed to the company if they quit early
    TAGALL_COOLDOWN: 300000,
    CHEQUE_EXPIRY: 172800000,
    CHEQUE_COOLDOWN: 10000,
    RESPONSE_DELAY: 3000,
    CHAT_DELAY: 2000,
    BANK_INTEREST: 0.001,
    ECONOMY_TICK: 86400000,
    FUN_COOLDOWN: 8000,
    SUGGEST_LIMIT_PER_DAY: 3
};

// ─── STATE ──────────────────────────────
let USERS = {};
let BANKS = {};
let COMPANIES = {};
let CHEQUES = [];
let COOLDOWNS = {};
let GROUP_MESSAGES = {};
let GOVERNMENT_FUNDS = 10000000;
let CHAT_MODE = {};
let UNACTIVATED_GROUPS = [];
let WHITELISTED_GROUPS = [];
let LID_MAP = {};            // lidDigits -> real phone number (owners, mods, or anyone)
let LOGS = [];
let SUGGESTIONS = [];
let CLAIMED_FATHER = false;
let CLAIMED_COCREATOR = false;
let PENDING_PLAY = {};
let MSG_DATE = new Date().toDateString();
let MSG_COUNT_TODAY = 0;
const CONVO_HISTORY = {}; // in-memory only, not persisted
if (!global.PENDING_HIRES) global.PENDING_HIRES = {};
global.BOT_ACTIVE = true; // must default true or every message gets silently dropped

const TIER_ORDER = ["LOWER", "WORKING", "MIDDLE", "UPPER", "ELITE"];

// ─── PATHS ──────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'conclave_data.json');
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys_v11');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ─── SAVE / LOAD ────────────────────────
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const d = JSON.parse(fs.readFileSync(DATA_FILE));
            USERS = d.USERS || {};
            BANKS = d.BANKS || {};
            COMPANIES = d.COMPANIES || {};
            CHEQUES = d.CHEQUES || [];
            BLACKLIST = d.BLACKLIST || [];
            LOCKED_GROUPS = d.LOCKED_GROUPS || [];
            COUNCIL_GROUP = d.COUNCIL_GROUP || null;
            GOVERNMENT_FUNDS = d.GOVERNMENT_FUNDS || 10000000;
            GROUP_MESSAGES = d.GROUP_MESSAGES || {};
            CHAT_MODE = d.CHAT_MODE || {};
            UNACTIVATED_GROUPS = d.UNACTIVATED_GROUPS || [];
            WHITELISTED_GROUPS = d.WHITELISTED_GROUPS || [];
            LID_MAP = d.LID_MAP || {};
            LOGS = d.LOGS || [];
            SUGGESTIONS = d.SUGGESTIONS || [];
            CLAIMED_FATHER = d.CLAIMED_FATHER || false;
            CLAIMED_COCREATOR = d.CLAIMED_COCREATOR || false;
            if (d.MODS) MODS = d.MODS;
            console.log('📂 Loaded:', Object.keys(USERS).length, 'users |', Object.keys(BANKS).length, 'banks |', Object.keys(COMPANIES).length, 'companies');
        }
    } catch (e) { console.error('Load:', e.message); }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            USERS, BANKS, COMPANIES, CHEQUES, BLACKLIST,
            LOCKED_GROUPS, COUNCIL_GROUP, GOVERNMENT_FUNDS,
            GROUP_MESSAGES, MODS, CHAT_MODE, UNACTIVATED_GROUPS,
            WHITELISTED_GROUPS, LID_MAP, LOGS, SUGGESTIONS,
            CLAIMED_FATHER, CLAIMED_COCREATOR
        }, null, 2));
    } catch (e) { console.error('Save:', e.message); }
}

// ─── HELPERS ────────────────────────────
function random(a) { return a[Math.floor(Math.random() * a.length)]; }
function clean(n) { return n ? String(n).replace(/\D/g, '') : ""; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(type, actor, target) {
    LOGS.push({ time: Date.now(), type, actor, target });
    if (LOGS.length > 200) LOGS.shift();
}

function checkCooldown(key, ms) {
    const now = Date.now();
    const last = COOLDOWNS[key] || 0;
    if (now - last < ms) return Math.ceil((ms - (now - last)) / 1000);
    COOLDOWNS[key] = now;
    return 0;
}

function trackMessage() {
    const today = new Date().toDateString();
    if (today !== MSG_DATE) { MSG_DATE = today; MSG_COUNT_TODAY = 0; }
    MSG_COUNT_TODAY++;
}

// target resolution: explicit number arg > @mention > reply, then LID-resolved
function getTarget(args, argIndex, msg) {
    const resolve = (n) => { const c = clean(n); return c ? (LID_MAP[c] || c) : null; };
    if (args[argIndex]) { const r = resolve(args[argIndex]); if (r) return r; }
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctx?.mentionedJid;
    if (mentioned && mentioned.length) return resolve(mentioned[0]);
    if (ctx?.participant) return resolve(ctx.participant);
    return null;
}

function tierAtLeast(cls, min) { return TIER_ORDER.indexOf(cls) >= TIER_ORDER.indexOf(min); }

// ─── PERSONALITY (Hyouka calm + light Sherlock deduction) ──
function getPersonalityLine(sender) {
    if (sender && isFather(sender)) return random(["🖤 As you wish, Father.", "🖤 Noted, Father. I'll handle it quietly.", "🖤 Understood."]);
    if (sender && isCoCreator(sender)) return random(["🖤 Sure, Katsuki. Try not to break it.", "🖤 Mm. Fine.", "🖤 I'll allow it — this once."]);
    if (sender && isMod(sender)) return random(["🖤 Handled.", "🖤 Noted, mod.", "🖤 On it."]);
    if (sender && tierAtLeast(getUserClass(sender), "UPPER")) return random(["🖤 A reasonable request. Done.", "🖤 Efficient. I appreciate that."]);
    return random(["🖤 I didn't want to solve that, but the pattern was obvious.", "🖤 Curious. Anyway — done.", "🖤 Elementary, honestly."]);
}
function isHostileGroupName(name) { return !(name || "").toLowerCase().includes("conclave"); }

// ─── POWER CHECKS (LID-aware) ───────────
function isFather(n) { const c = clean(n); return FATHER_NUMBERS.includes(c) || LID_MAP[c] === FATHER_NUMBERS[0]; }
function isCoCreator(n) { const c = clean(n); return CO_CREATOR_NUMBERS.includes(c) || LID_MAP[c] === CO_CREATOR_NUMBERS[0]; }
function isOwner(n) { return isFather(n) || isCoCreator(n); }
function isMod(n) { const c = clean(n); return MODS.map(clean).includes(c) || MODS.map(clean).includes(LID_MAP[c]); }
function isProtected(n) { return isOwner(n) || isMod(n); }
function isBlacklisted(n) { return BLACKLIST.includes(clean(n)); }
function isLocked(g) { return LOCKED_GROUPS.includes(g); }

// Resolve a message sender to a real phone number even when WhatsApp
// hands us a @lid identifier instead of a phone-number JID.
async function resolveSenderNumber(sock, msg, groupId) {
    const rawJid = groupId ? msg.key.participant : msg.key.remoteJid;
    if (!rawJid) return null;
    const altJid = msg.key.participantAlt || msg.key.participantPn || msg.key.senderPn || null;
    let candidate = altJid || rawJid;
    if (String(candidate).endsWith('@lid')) {
        const lidDigits = clean(candidate);
        if (LID_MAP[lidDigits]) return LID_MAP[lidDigits];
        if (groupId) {
            try {
                const meta = await sock.groupMetadata(groupId);
                const p = meta.participants.find(x => x.id === candidate || x.lid === candidate);
                if (p && p.jid && String(p.jid).endsWith('@s.whatsapp.net')) return clean(p.jid);
            } catch (e) {}
        }
        return lidDigits;
    }
    return clean(candidate);
}

// LID-aware: matches on raw id, alt jid, or a known LID_MAP entry.
async function isWaAdmin(sock, g, n, cachedMeta) {
    try {
        const m = cachedMeta || await sock.groupMetadata(g);
        const target = clean(n);
        const p = m.participants.find(x => {
            const xNum = clean((x.id || '').split('@')[0]);
            const xJidNum = x.jid ? clean(x.jid) : null;
            return xNum === target || xJidNum === target || LID_MAP[xNum] === target;
        });
        return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
    } catch (e) { return false; }
}

// LID-aware bot-self admin check — this was the cause of "bot needs to be
// admin" firing even when the bot really was an admin: the bot's own
// participant entry can show up as a @lid identifier that doesn't match
// sock.user.id's phone-number form.
function adminErrorText(e) {
    const msg = (e && e.message) || '';
    if (/forbidden|not-authorized|401|403|not an admin|admin/i.test(msg)) {
        return "❌ WhatsApp rejected that — I'm probably not an admin in this group (or lost admin). Check my role in group settings.";
    }
    return `❌ ${msg || 'Unknown error.'}`;
}

async function isBotAdmin(sock, g, cachedMeta) {
    try {
        const m = cachedMeta || await sock.groupMetadata(g);
        const myRaw = sock.user.id.split(':')[0];
        const myNum = clean(myRaw);
        const myLid = sock.user.lid ? clean(String(sock.user.lid).split(':')[0]) : null;
        const p = m.participants.find(x => {
            const xNum = clean((x.id || '').split('@')[0]);
            const xJidNum = x.jid ? clean(x.jid) : null;
            return xNum === myNum || xJidNum === myNum || (myLid && xNum === myLid) || LID_MAP[xNum] === myNum;
        });
        return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
    } catch (e) { return false; }
}

// ─── USER ───────────────────────────────
function getUser(num) {
    num = clean(num);
    if (!USERS[num]) {
        let role = "CITIZEN";
        if (isFather(num)) role = "FATHER";
        if (isCoCreator(num)) role = "CO_CREATOR";
        if (isMod(num)) role = "MOD";
        const profileId = "CLV-" + String(num).slice(-5).padStart(5, '0');
        USERS[num] = {
            number: num, profileId, name: null, registered: false,
            xenoShards: 0, role, status: "Citizen", level: 1,
            joinDate: new Date().toDateString(), warns: 0, muted: false,
            muteUntil: 0, arrested: 0, job: null, company: null, debt: 0,
            interactions: 0, totalEarned: 0, totalSpent: 0, workShifts: 0
        };
    }
    USERS[num].interactions++;
    return USERS[num];
}
function giveXS(num, amt) { const u = getUser(num); u.xenoShards += amt; u.totalEarned += amt; }
function takeXS(num, amt) { const u = getUser(num); if (u.xenoShards < amt) return false; u.xenoShards -= amt; u.totalSpent += amt; return true; }

// ─── BANK ───────────────────────────────
function getBank(num) {
    num = clean(num);
    if (!BANKS[num]) BANKS[num] = { account: "XNC-" + Math.floor(10000000 + Math.random() * 90000000), balance: 0, opened: new Date().toDateString(), transactions: [], interestEarned: 0 };
    return BANKS[num];
}
function bankDeposit(num, amt) { const b = getBank(num); if (!takeXS(num, amt)) return false; b.balance += amt; b.transactions.push({ type: "DEPOSIT", amount: amt, time: Date.now() }); if (b.transactions.length > 50) b.transactions.shift(); return true; }
function bankWithdraw(num, amt) { const b = getBank(num); if (b.balance < amt) return false; b.balance -= amt; giveXS(num, amt); b.transactions.push({ type: "WITHDRAW", amount: amt, time: Date.now() }); if (b.transactions.length > 50) b.transactions.shift(); return true; }
function bankTransfer(from, to, amt) { const bFrom = getBank(from), bTo = getBank(to); if (bFrom.balance < amt) return false; bFrom.balance -= amt; bTo.balance += amt; bFrom.transactions.push({ type: "SENT", to, amount: amt, time: Date.now() }); bTo.transactions.push({ type: "RECEIVED", from, amount: amt, time: Date.now() }); return true; }

// ─── JOBS ───────────────────────────────
const GOV_JOBS = [
    { id: 1, title: "🗑️ Garbage Collector", salary: 80, tier: "LOWER" },
    { id: 2, title: "🧹 Street Sweeper", salary: 70, tier: "LOWER" },
    { id: 3, title: "🌳 Gardener", salary: 85, tier: "LOWER" },
    { id: 4, title: "💡 Lamplighter", salary: 65, tier: "LOWER" },
    { id: 5, title: "📦 Warehouse Worker", salary: 90, tier: "LOWER" },
    { id: 6, title: "🧑‍🏫 Teacher", salary: 130, tier: "WORKING" },
    { id: 7, title: "🚑 Medic", salary: 145, tier: "WORKING" },
    { id: 8, title: "🛡️ Guard", salary: 120, tier: "WORKING" },
    { id: 9, title: "📝 Clerk", salary: 90, tier: "WORKING" },
    { id: 10, title: "🍳 Cook", salary: 115, tier: "WORKING" },
    { id: 11, title: "💻 Developer", salary: 230, tier: "MIDDLE" },
    { id: 12, title: "📊 Data Analyst", salary: 215, tier: "MIDDLE" },
    { id: 13, title: "💰 Accountant", salary: 220, tier: "MIDDLE" },
    { id: 14, title: "🔬 Researcher", salary: 235, tier: "MIDDLE" },
    { id: 15, title: "⚡ Energy Tech", salary: 205, tier: "MIDDLE" },
    { id: 16, title: "🏗️ Architect", salary: 260, tier: "UPPER" },
    { id: 17, title: "⚖️ Lawyer", salary: 275, tier: "UPPER" },
    { id: 18, title: "🧪 Scientist", salary: 265, tier: "UPPER" },
    { id: 19, title: "🩺 Doctor", salary: 300, tier: "UPPER" },
    { id: 20, title: "📋 Project Manager", salary: 245, tier: "UPPER" },
    { id: 21, title: "🚀 Engineer", salary: 340, tier: "ELITE" },
    { id: 22, title: "✈️ Pilot", salary: 355, tier: "ELITE" },
    { id: 23, title: "🩹 Surgeon", salary: 370, tier: "ELITE" },
    { id: 24, title: "⚖️ Judge", salary: 360, tier: "ELITE" },
    { id: 25, title: "🧑‍💼 CEO", salary: 380, tier: "ELITE" }
];
const BANK_JOBS = [
    { id: 1, title: "🏦 Bank Teller", salary: 210, minTier: "MIDDLE" },
    { id: 2, title: "📑 Loan Officer", salary: 260, minTier: "UPPER" },
    { id: 3, title: "🔐 Vault Security", salary: 225, minTier: "MIDDLE" },
    { id: 4, title: "📈 Financial Analyst", salary: 285, minTier: "UPPER" },
    { id: 5, title: "👔 Bank Manager", salary: 350, minTier: "ELITE" }
];
function getUserClass(num) {
    const u = getUser(num);
    let s = u.level * 2 + Math.floor((u.totalEarned || 0) / 1000) + (u.workShifts || 0);
    if (s > 350) return "ELITE";
    if (s > 200) return "UPPER";
    if (s > 100) return "MIDDLE";
    if (s > 50) return "WORKING";
    return "LOWER";
}

// ─── FUN CONTENT ────────────────────────
const ROASTS = ["you're the reason the group chat needs a manual.", "even the void has more direction than you.", "if disappointment had a face, congratulations.", "you bring the same energy as a dead battery.", "I've seen better decisions from a coin flip."];
const COMPLIMENTS = ["you're doing better than you think. noted.", "rare to see someone actually worth the interactions counter.", "you have a presence people remember.", "solid. genuinely.", "you're the reason this group isn't completely dead."];
const SHAME_LINES = ["let it be known, publicly, that this happened.", "the Conclave has witnessed this. there is no undoing it.", "this moment is now permanent record.", "everyone, take notes."];
const JOKES = [
    "I asked my WiFi why it disconnected. It said it needed space. Relatable.",
    "My bank account and my will to work drain at the exact same rate.",
    "Whoever named it 'rush hour' clearly never sat in it for two.",
    "I don't procrastinate. I just give tomorrow-me more responsibilities.",
    "Somewhere out there, a group project member is doing absolutely nothing. Deduced.",
    "Adulting is just googling how to do things you should already know, then pretending you knew all along.",
    "I put 'attend to Conclave duties' on my to-do list just so I'd have one thing checked off today.",
    "The only cardio some of you get is jumping to conclusions in this chat.",
    "I'm not saying this group is dead, but even the ghosts left a read receipt.",
    "My patience has the same battery percentage as your phone right now."
];
const TRIVIA = [
    { q: "What planet is known as the Red Planet?", a: "mars" },
    { q: "How many continents are there on Earth?", a: "7" },
    { q: "What's the largest ocean on Earth?", a: "pacific" },
    { q: "What language has the most native speakers worldwide?", a: "mandarin" },
    { q: "What year did WWII end?", a: "1945" },
    { q: "What's the smallest country in the world?", a: "vatican" },
    { q: "How many bones are in the adult human body?", a: "206" }
];
const RIDDLES = [
    { q: "What has keys but can't open locks?", a: "piano" },
    { q: "What has a face and two hands but no arms or legs?", a: "clock" },
    { q: "The more you take, the more you leave behind. What am I?", a: "footsteps" },
    { q: "I speak without a mouth and hear without ears. What am I?", a: "echo" },
    { q: "What has to be broken before you can use it?", a: "egg" }
];
const WYR = [
    "have the ability to fly, or be invisible?",
    "always be 10 minutes late, or always be 20 minutes early?",
    "fight one horse-sized duck, or 100 duck-sized horses?",
    "lose all your money, or lose every WhatsApp contact you have?",
    "never use social media again, or never watch another movie/show?"
];

// ═══════════════════════════════════════════════════════════
// MENU — ONE unified box, scrollable, with pfp + bot info
// ═══════════════════════════════════════════════════════════
const MENU_SECTIONS = [
    { title: "🛡️ ADMIN & MOD", items: [
        [`${PREFIX}kick`, "Remove user (reply/mention)"], [`${PREFIX}mute <mins>`, "Mute for X minutes"],
        [`${PREFIX}unmute`, "Unmute"], [`${PREFIX}warn`, "Warn user"], [`${PREFIX}tagall`, "Mention everyone"],
        [`${PREFIX}promote`, "Make admin"], [`${PREFIX}demote`, "Remove admin"], [`${PREFIX}close`, "Lock group chat"],
        [`${PREFIX}open`, "Unlock group chat"], [`${PREFIX}delete`, "Delete replied message"], [`${PREFIX}gclink`, "Group invite link"],
        [`${PREFIX}active`, "Top active members"], [`${PREFIX}inactive`, "Least active members"], [`${PREFIX}chat on/off`, "Toggle free conversation"],
        [`${PREFIX}activate`, "Reactivate bot here"], [`${PREFIX}logs`, "Suspicious activity (mods+)"],
        [`${PREFIX}banuser`, "Ban from bot (mods+)"], [`${PREFIX}unbanuser`, "Unban (mods+)"], [`${PREFIX}whitelist`, "Whitelist this group (mods+)"],
        [`${PREFIX}groups`, "List every group I'm in (mods+)"]
    ]},
    { title: "🏦 BANK & ECONOMY", items: [
        [`${PREFIX}signup`, "Register your Conclave ID"], [`${PREFIX}bank`, "Bank menu"], [`${PREFIX}bank open`, "Open account"],
        [`${PREFIX}bank bal`, "Check balance"], [`${PREFIX}bank dep <amt>`, "Deposit"], [`${PREFIX}bank wit <amt>`, "Withdraw"],
        [`${PREFIX}bank send <id> <amt>`, "Transfer"], [`${PREFIX}bank stmt`, "Statement"], [`${PREFIX}daily`, "Claim 100 XS/day"],
        [`${PREFIX}pay <num> <amt>`, "Send money"], [`${PREFIX}loan <amt>`, "Bank loan (needs collateral)"], [`${PREFIX}repay <amt>`, "Repay loan"],
        [`${PREFIX}cheque`, "Cheque system (sign/cash/give/cancel/list)"], [`${PREFIX}rob`, "Attempt robbery"]
    ]},
    { title: "💼 JOBS & COMPANY", items: [
        [`${PREFIX}jobs`, "Jobs for your class"], [`${PREFIX}govjob <id>`, "Take a government job"], [`${PREFIX}bankjob <id>`, "Take a bank job"],
        [`${PREFIX}work`, "Work your shift — get paid"], [`${PREFIX}myjob`, "View your job"], [`${PREFIX}resign`, "Quit your job"],
        [`${PREFIX}company create <name>`, "Register company (5000 XS)"], [`${PREFIX}company info`, "Company stats"],
        [`${PREFIX}company work`, "Work your own company — get paid"],
        [`${PREFIX}company hire`, "Hire (reply/mention)"], [`${PREFIX}company fire`, "Fire (reply/mention)"],
        [`${PREFIX}company leave`, "Quit early = break fee, or free after 48h"], [`${PREFIX}company close`, "CEO dissolves the company"], [`${PREFIX}company pay`, "Pay employee"],
        [`${PREFIX}company deposit <amt>`, "Deposit to company bank"], [`${PREFIX}company tax`, "Pay company tax"], [`${PREFIX}company top`, "Top 10 companies"],
        [`${PREFIX}accept`, "Accept job offer"], [`${PREFIX}decline`, "Decline job offer"], ["🔜 stock/invest/shares", "Coming soon"]
    ]},
    { title: "🎮 GAMES & FUN", items: [
        [`${PREFIX}roast`, "Roast someone"], [`${PREFIX}compliment`, "Compliment someone"], [`${PREFIX}shame`, "Shame someone"],
        [`${PREFIX}joke`, "A joke that's actually funny"], [`${PREFIX}truth`, "Truth question"], [`${PREFIX}dare`, "Dare"], [`${PREFIX}tod`, "Truth or dare"],
        [`${PREFIX}wyr`, "Would you rather"], [`${PREFIX}trivia`, "Trivia (+30 XS)"], [`${PREFIX}riddle`, "Riddle (+40 XS)"],
        [`${PREFIX}8ball <q>`, "Magic 8-ball"], [`${PREFIX}coinflip`, "Flip a coin"], [`${PREFIX}dice`, "Roll dice"],
        [`${PREFIX}guess <1-100>`, "Guessing game"], [`${PREFIX}slot`, "Slot machine"], [`${PREFIX}rps <choice>`, "Rock paper scissors"]
    ]},
    { title: "🎨 STICKERS & MEDIA", items: [
        [`${PREFIX}s`, "Reply to image → sticker"], [`${PREFIX}st`, "Reply to sticker → image"], [`${PREFIX}play <song>`, "Search & download a song"]
    ]},
    { title: "ℹ️ INFO & OTHER", items: [
        [`${PREFIX}profile`, "Your ID card"], [`${PREFIX}status`, "Your status"], [`${PREFIX}whoami`, "Debug your identity"],
        [`${PREFIX}modlist`, "Power hierarchy"], [`${PREFIX}rules`, "Conclave rules"], [`${PREFIX}gs`, "Group stats"],
        [`${PREFIX}members`, "Member count"], [`${PREFIX}suggest <cat>|<title>|<desc>`, "Submit suggestion (3/day)"],
        [`${PREFIX}help <cmd>`, "Help for a command"], [`${PREFIX}ping`, "Ping the bot"]
    ]}
];
function totalCommandCount() { return MENU_SECTIONS.reduce((s, sec) => s + sec.items.length, 0); }

function menuBox(sender) {
    const u = getUser(sender);
    const registeredCount = Object.values(USERS).filter(x => x.registered).length;
    let out = `🖤 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 | 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘\n`;
    out += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🟢 Status: ONLINE\n`;
    out += `👥 Registered Citizens: ${registeredCount}\n`;
    out += `🏢 Companies: ${Object.keys(COMPANIES).length}\n`;
    out += `🏛️ Treasury: ${GOVERNMENT_FUNDS} XS\n`;
    out += `👤 You: ${u.name || 'unknown name'} • ${u.profileId} • ${getUserClass(sender)} class\n`;
    out += `\n📋 𝗔𝗟𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 (${totalCommandCount()}) — scroll for more ↓\n`;
    MENU_SECTIONS.forEach(sec => {
        out += `\n${sec.title}\n──────────────\n`;
        sec.items.forEach(it => { out += `${it[0]} — ${it[1]}\n`; });
    });
    out += `\n${getPersonalityLine(sender)}`;
    return out;
}
async function getBotPfpBuffer() {
    try {
        if (process.env.BOT_PFP_URL) {
            const res = await fetch(process.env.BOT_PFP_URL);
            if (!res.ok) return null;
            return Buffer.from(await res.arrayBuffer());
        }
        const localPath = process.env.BOT_PFP_PATH || path.join(__dirname, 'assets', 'pfp.jpg');
        if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
        return null;
    } catch (e) { return null; }
}

// ═══════════════════════════════════════════════════════════
// OTHER BOXES
// ═══════════════════════════════════════════════════════════
function profileBox(sender) {
    const u = getUser(sender);
    const b = BANKS[clean(sender)] || { account: "—", balance: 0 };
    return `╔══════════════════════════════════════════╗
║           🧥 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗜𝗗 𝗖𝗔𝗥𝗗             ║
╠══════════════════════════════════════════╣
║  🗣️ Name: ${u.name || 'Unknown'}
║  🆔 Profile ID: ${u.profileId}
║  📱 Number: ${u.number}
║  👤 Role: ${u.role}
║  ✅ Registered: ${u.registered ? 'Yes' : 'No (' + PREFIX + 'signup)'}
║  📊 Status: ${u.status}
║  ⭐ Level: ${u.level}
║  🎓 Class: ${getUserClass(sender)}
║  📅 Joined: ${u.joinDate}
╠══════════════════════════════════════════╣
║  💰 Wallet: ${u.xenoShards} XS
║  🏦 Bank Balance: ${b.balance} XS
║  💎 Total: ${u.xenoShards + b.balance} XS
║  💳 Debt: ${u.debt || 0} XS
╠══════════════════════════════════════════╣
║  ⚠️ Warns: ${u.warns}/3
║  🔇 Muted: ${u.muted ? 'Yes' : 'No'}
║  💼 Job: ${u.job ? u.job.title : 'None'}
║  🏢 Company: ${u.company || 'None'}
╚══════════════════════════════════════════╝

${getPersonalityLine(sender)}`;
}
function statusBox(sender) {
    const u = getUser(sender);
    return `╔══════════════════════════════════════════╗
║           📊 𝗬𝗢𝗨𝗥 𝗦𝗧𝗔𝗧𝗨𝗦                  ║
╠══════════════════════════════════════════╣
║  🆔 ID: ${u.profileId}
║  🎓 Class: ${getUserClass(sender)}
║  ⭐ Level: ${u.level}
║  👤 Role: ${u.role}
╠══════════════════════════════════════════╣
║  💼 ${u.job ? u.job.title + ' — ' + u.job.salary + ' XS/shift (' + (u.job.employer || 'Government') + ')' : 'Unemployed'}
║  🏢 ${u.company ? u.company + ' (Owner)' : 'Not a business owner'}
╠══════════════════════════════════════════╣
║  📈 Earned: ${u.totalEarned || 0} XS
║  📉 Spent: ${u.totalSpent || 0} XS
║  🧾 Shifts: ${u.workShifts || 0}
╚══════════════════════════════════════════╝

${getPersonalityLine(sender)}`;
}
function bankBox(sender) {
    const b = getBank(sender);
    return `╔══════════════════════════════════════════╗
║           🏦 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗕𝗔𝗡𝗞                  ║
╠══════════════════════════════════════════╣
║  🆔 Account: ${b.account}
║  📅 Opened: ${b.opened}
║  💰 Balance: ${b.balance} XS
║  📈 Interest Earned: ${b.interestEarned} XS
╠══════════════════════════════════════════╣
║  ${PREFIX}bank open / bal / dep / wit / send / stmt / close
╚══════════════════════════════════════════╝

${getPersonalityLine(sender)}`;
}
function companyBox(sender) {
    const u = getUser(sender);
    const c = u.company ? COMPANIES[u.company] : null;
    if (c) {
        const profit = c.revenue - c.expenses;
        return `╔══════════════════════════════════════════╗
║           🏢 ${c.name}
╠══════════════════════════════════════════╣
║  👔 CEO: ${c.owner}
║  👥 Employees: ${c.employees.length}
║  💰 Bank: ${c.bank} XS
║  📈 Revenue: ${c.revenue} XS
║  📉 Expenses: ${c.expenses} XS
║  💵 Profit: ${profit} XS
║  🏛️ Tax Paid: ${c.taxPaid} XS
║  ⚠️ Tax Owed: ${c.taxOwed || 0} XS (bankrupt at ${CONFIG.COMPANY_TAX_BANKRUPTCY})
║  📅 Founded: ${c.founded}
╚══════════════════════════════════════════╝

${getPersonalityLine(sender)}`;
    }
    return `╔══════════════════════════════════════════╗
║           🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 𝗦𝗬𝗦𝗧𝗘𝗠                ║
╠══════════════════════════════════════════╣
║  ${PREFIX}company create <name>  — Register
║  💰 Cost: ${CONFIG.COMPANY_MIN} XS | one company per person
╠══════════════════════════════════════════╣
║  🔜 stock / invest / buy shares / sell shares
╚══════════════════════════════════════════╝

${getPersonalityLine(sender)}`;
}
function secretBox() {
    return `╔══════════════════════════════════════════╗
║        🔒 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗦𝗘𝗖𝗥𝗘𝗧 🔒               ║
╠══════════════════════════════════════════╣
║  👑 FATHER & CO-CREATOR ONLY — DM ONLY
║  💰 ${PREFIX}addmoney <num> <amt>
║  💰 ${PREFIX}removemoney <num> <amt>
║  💰 ${PREFIX}setmoney <num> <amt>
║  👤 ${PREFIX}resetuser <num>
║  👤 ${PREFIX}setrole <num> <role>
║  👤 ${PREFIX}viewall
║  ⚡ ${PREFIX}mod add/remove <num>
║  🏢 ${PREFIX}seizecompany <name>
║  🔒 ${PREFIX}emergency
║  🔓 ${PREFIX}shutdown / ${PREFIX}startup
║  🔗 ${PREFIX}trust <lid> <realnumber> — fix LID mismatch (father/mod/anyone)
╚══════════════════════════════════════════╝`;
}
function gsBox(g, meta) {
    const msgs = GROUP_MESSAGES[g] || {};
    const users = Object.entries(msgs).sort((a, b) => b[1] - a[1]);
    const total = users.reduce((s, [_, cnt]) => s + cnt, 0);
    const top = users.slice(0, 3).map(([n, cnt], i) => `  ${['🥇', '🥈', '🥉'][i]} ${n} — ${cnt} msgs`).join('\n') || '  (none)';
    const admins = meta ? meta.participants.filter(p => p.admin).length : '?';
    const participants = meta ? meta.participants.length : '?';
    let powerCount = 0;
    if (meta) {
        meta.participants.forEach(p => {
            const n = clean((p.id || '').split('@')[0]);
            const resolved = LID_MAP[n] || n;
            if (isOwner(resolved) || isMod(resolved)) powerCount++;
        });
    }
    const groupName = meta?.subject || 'this group';
    return `╔═ ❰ 📊 𝗚𝗥𝗢𝗨𝗣 𝗦𝗧𝗔𝗧𝗦 📊 ❱ ═╗
║ 📛 ${groupName}
║ 👥 Participants: ${participants}
║ 🛡️ WA Admins: ${admins}
║ 👑 Conclave power present: ${powerCount > 0 ? 'Yes (' + powerCount + ')' : 'None'}
║ 💬 Free chat: ${CHAT_MODE[g] ? 'ON' : 'OFF'}
║ 📈 Messages tracked: ${total}
║ 🔒 Locked: ${isLocked(g) ? 'Yes' : 'No'}
╠═══════════════════════════╣
║ 🏆 Top citizens:
${top}
╚═══════════════════════════╝

${getPersonalityLine()}`;
}
function rulesBox() {
    return `📜 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗥𝗨𝗟𝗘𝗦
──────────────────────
1. Loyalty above all.
2. Respect all citizens.
3. No scamming members.
4. Pay your taxes.
5. Honor your debts.
6. Thieves risk arrest and shame.
7. Mods are the law in their groups.
8. Do not betray CONCLAVE.
9. Work hard. Earn well. Live long.
10. Father and Co-Creator are respected, not worshipped —
    they serve the Conclave, they aren't the government.

${getPersonalityLine()}`;
}
function formatLog(logs) {
    let msg = `┏━━━🕵️ 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬 𝗙𝗘𝗘𝗗 ━━━┓\n`;
    logs.forEach(log => {
        const icon = log.type === 'BAN' ? '⚠️' : '🚨';
        const actorName = USERS[clean(log.actor)]?.name;
        msg += `┃\n┃ [${new Date(log.time).toLocaleTimeString()}] ${icon} ${log.type}\n`;
        msg += `┃  └─ Target: ${log.target}\n`;
        msg += `┃  └─ By: ${log.actor}${actorName ? ' (' + actorName + ')' : ''}\n`;
    });
    msg += `┗━━━ END OF TRANSMISSION ━━━┛`;
    return msg;
}
function logsBox() {
    if (!LOGS.length) return "📭 No suspicious activity logged.";
    return formatLog(LOGS.slice(-15).reverse());
}

// ═══════════════════════════════════════════════════════════
// CONVERSATION — real AI layer (optional) + canned fallback
// ═══════════════════════════════════════════════════════════
async function getAIResponse(sender, text, u) {
    if (!process.env.ANTHROPIC_API_KEY) return null; // no key configured — fall back to canned lines
    try {
        if (!CONVO_HISTORY[sender]) CONVO_HISTORY[sender] = [];
        const hist = CONVO_HISTORY[sender];
        hist.push({ role: 'user', content: text });
        if (hist.length > 12) hist.splice(0, hist.length - 12);

        const respectTier = isFather(sender) ? "Father — the highest respect, deferential and warm"
            : isCoCreator(sender) ? "Co-Creator — respected, a little sassy/familiar"
            : isMod(sender) ? "Mod — respected, professional"
            : `${getUserClass(sender)} class citizen — respect scales with class: LOWER gets curt, ELITE gets real respect`;

        const system = `You are Hodekai, the WhatsApp bot-government persona of a roleplay economy called CONCLAVE. Personality: calm and economical with words, like Hyouka's Oreki, with a light Sherlock-Holmes deductive streak. You're talking to ${u.name || 'a citizen'} (Conclave class: ${getUserClass(sender)}). Their standing: ${respectTier}. Keep replies short (1-3 sentences), in character, a little dry/witty, never breaking persona, never mention being an AI or language model. At most one emoji.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5', max_tokens: 200, system, messages: hist })
        });
        if (!res.ok) return null;
        const data = await res.json();
        const reply = (data.content || []).map(b => b.text || '').join('').trim();
        if (!reply) return null;
        hist.push({ role: 'assistant', content: reply });
        return reply;
    } catch (e) { return null; }
}

function getHumanResponse(msg, sender, groupName) {
    const lower = msg.toLowerCase().trim();
    const hostile = isHostileGroupName(groupName);
    if ((/hodekai|katsuki/.test(lower)) && !isOwner(sender) && /i am (hodekai|katsuki)|this is (hodekai|katsuki)/.test(lower)) {
        return "🖤 Interesting claim. Your number says otherwise.";
    }
    if (/^(hi|hello|hey|yo|sup|wassup)$/i.test(lower)) {
        if (isFather(sender)) return random(["Father. I'm listening.", "Yes, Father.", "What do you need, Father?"]);
        if (isCoCreator(sender)) return random(["Tch. You again, Katsuki.", "The clumsy one returns."]);
        if (isMod(sender)) return random(["Hey, mod.", "Everything under control?"]);
        if (tierAtLeast(getUserClass(sender), "UPPER")) return random(["Good to see you.", "Yes?"]);
        if (hostile) return random(["what do you want.", "this isn't my house. talk fast."]);
        return random(["tch. you're here again.", "oh. it's you.", "sup."]);
    }
    if (lower.includes('how are you')) { if (isFather(sender)) return "Better now, Father."; return random(["*sigh* tired.", "could be better."]); }
    if (/\b(bye|goodbye|later|cya)\b/i.test(lower)) return random(["later.", "finally. peace.", "bye."]);
    if (lower.includes('thanks') || lower.includes('thank')) return random(["mhm.", "sure.", "noted."]);
    if (lower.endsWith('?')) { if (isFather(sender)) return "Good question, Father. Give me a moment."; return random(["hm. give me a second — I don't like guessing.", "figure it out."]); }
    if (isProtected(sender)) return random(["mhm.", "okay.", "noted."]);
    return null;
}

// ═══════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════
async function handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, isDM, isWaAdminFlag, groupMeta) {
    const user = getUser(sender);
    const c = cmd.toLowerCase();
    function needRegistered() { return !user.registered ? `❌ Register first: ${PREFIX}signup` : null; }

    if (c === 'menu') {
        const pfp = await getBotPfpBuffer();
        const caption = menuBox(sender);
        if (pfp) { try { await sock.sendMessage(groupId || sender, { image: pfp, caption }, { quoted: msg }); return null; } catch (e) { return caption; } }
        return caption;
    }
    if (c === 'signup' || c === 'register') {
        if (user.registered) return "ℹ️ Already registered.";
        user.registered = true; user.xenoShards = 1000; saveData();
        return `✅ 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗜𝗗 𝗖𝗥𝗘𝗔𝗧𝗘𝗗\n🆔 ${user.profileId}\n💰 Starting balance: 1000 XS\n\n${getPersonalityLine(sender)}`;
    }
    if (c === 'whoami') return `🆔 Resolved number: ${sender}\n🗣️ Name: ${user.name || 'unknown'}\n👤 Role: ${user.role}\n📱 Raw JID: ${(groupId ? msg.key.participant : msg.key.remoteJid) || '—'}`;
    if (c === 'claim') {
        if (!isDM) return "❌ DM only.";
        if (!OWNER_SETUP_KEY) return "❌ No setup key configured on this bot.";
        const key = args[0]; const role = (args[1] || '').toLowerCase();
        if (key !== OWNER_SETUP_KEY) return "❌ Invalid key.";
        const rawJid = msg.key.remoteJid;
        const lidDigits = String(rawJid).endsWith('@lid') ? clean(rawJid) : null;
        if (role === 'father' && !CLAIMED_FATHER) { if (lidDigits) LID_MAP[lidDigits] = FATHER_NUMBERS[0]; CLAIMED_FATHER = true; saveData(); return "🖤 Father identity linked."; }
        if (role === 'cocreator' && !CLAIMED_COCREATOR) { if (lidDigits) LID_MAP[lidDigits] = CO_CREATOR_NUMBERS[0]; CLAIMED_COCREATOR = true; saveData(); return "🖤 Co-Creator identity linked."; }
        return "❌ Already claimed or invalid role (father/cocreator).";
    }
    if (c === 'trust') {
        if (!isOwner(sender) || !isDM) return null;
        const lid = clean(args[0]); const real = clean(args[1]);
        if (!lid || !real) return `❌ ${PREFIX}trust <lid> <realNumber> — maps any LID to any real number (works for mods too)`;
        LID_MAP[lid] = real; saveData();
        return `✅ LID ${lid} now resolves to ${real}.`;
    }
    if (c === 'profile') return profileBox(sender);
    if (c === 'status') return statusBox(sender);
    if (c === 'bank' && args.length === 0) return needRegistered() || bankBox(sender);
    if (c === 'company' && args.length === 0) return needRegistered() || companyBox(sender);
    if (c === 'rules') return rulesBox();
    if (c === 'gs') { if (!groupId) return "❌ Groups only."; return gsBox(groupId, groupMeta); }
    if (c === 'secret') { if (isDM && isOwner(sender)) return secretBox(); return null; }
    if (c === 'logs') { if (!isProtected(sender)) return null; return logsBox(); }
    if (c === 'modlist') {
        const fatherName = USERS[OWNERS.FATHER]?.name;
        const coName = USERS[OWNERS.CO_CREATOR]?.name;
        let out = `╔═ ❰ ⚡ 𝗣𝗢𝗪𝗘𝗥 𝗛𝗜𝗘𝗥𝗔𝗥𝗖𝗛𝗬 ❱ ═╗\n║ 👑 OWNERS\n`;
        out += `║  1. ${OWNERS.FATHER}${fatherName ? ' — ' + fatherName : ''} (Father)\n`;
        out += `║  2. ${OWNERS.CO_CREATOR}${coName ? ' — ' + coName : ''} (Co-Creator)\n`;
        out += `╠═══════════════╣\n║ ⚡ MODS (${MODS.length})\n`;
        MODS.forEach((m, i) => { const nm = USERS[clean(m)]?.name; out += `║  ${i + 1}. ${m}${nm ? ' — ' + nm : ''}\n`; });
        out += `╚═══════════════╝`;
        return out;
    }
    if (c === 'bal') { const b = BANKS[clean(sender)]; return `💰 Wallet: ${user.xenoShards} XS\n🏦 Bank: ${b ? b.balance : 0} XS\n💎 Total: ${user.xenoShards + (b ? b.balance : 0)} XS\n💳 Debt: ${user.debt || 0} XS`; }
    if (c === 'members') return `👥 Members: ${Object.keys(USERS).length}\n⚡ Mods: ${MODS.length}`;
    if (c === 'ping') {
        try { await sock.sendMessage(groupId || sender, { react: { text: '🏓', key: msg.key } }); } catch (e) {}
        const up = Math.floor(process.uptime());
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
        if (isProtected(sender)) {
            const mem = process.memoryUsage();
            const total = os.totalmem(), free = os.freemem();
            const ramPct = (((total - free) / total) * 100).toFixed(1);
            const cpus = os.cpus();
            return `╔═ ❰ 🏓 𝗣𝗢𝗡𝗚 — 𝗗𝗜𝗔𝗚𝗡𝗢𝗦𝗧𝗜𝗖𝗦 ❱ ═╗\n║ ⏱️ Uptime: ${h}h ${m}m ${s}s\n║ 🟢 Node: ${process.version}\n║ 💻 CPU: ${cpus[0]?.model || 'unknown'} (${cpus.length} cores)\n║ 🧠 RAM: ${ramPct}% used\n║ 📦 Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB\n║ 📨 Messages today: ${MSG_COUNT_TODAY}\n║ 🕵️ Logs recorded: ${LOGS.length}\n╚═══════════════════════╝\n\n${getPersonalityLine(sender)}`;
        }
        return `╔═ ❰ 🏓 𝗣𝗢𝗡𝗚 ❱ ═╗\n║ ⏱️ Uptime: ${h}h ${m}m ${s}s\n╚═══════════════╝`;
    }

    // ─── BANK ─────────────────────────
    if (c === 'bank') {
        const gate = needRegistered(); if (gate) return gate;
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'open') { const b = getBank(sender); saveData(); return `🏦 Account opened.\n🆔 ${b.account}\n💰 ${b.balance} XS`; }
        if (sub === 'bal' || sub === 'balance') { const b = getBank(sender); return `🏦 ${b.account}\n💰 ${b.balance} XS | 💵 Wallet ${user.xenoShards} XS`; }
        if (sub === 'dep' || sub === 'deposit') { const amt = parseInt(args[1]); if (!amt || amt <= 0) return `❌ ${PREFIX}bank dep <amt>`; if (!bankDeposit(sender, amt)) return `❌ You have ${user.xenoShards} XS.`; saveData(); return `✅ Deposited ${amt} XS. Bank: ${getBank(sender).balance}`; }
        if (sub === 'wit' || sub === 'withdraw') { const amt = parseInt(args[1]); if (!amt || amt <= 0) return `❌ ${PREFIX}bank wit <amt>`; if (!bankWithdraw(sender, amt)) return `❌ Insufficient bank balance.`; saveData(); return `✅ Withdrew ${amt} XS. Wallet: ${user.xenoShards}`; }
        if (sub === 'send' || sub === 'transfer') {
            const targetId = args[1]; const amt = parseInt(args[2]);
            if (!targetId || !amt || amt <= 0) return `❌ ${PREFIX}bank send <profileId|number> <amt>`;
            let targetNum = null; const cleanId = targetId.trim().toUpperCase();
            if (cleanId.startsWith('CLV-')) { for (const n in USERS) if (USERS[n].profileId === cleanId) { targetNum = n; break; } }
            else { targetNum = clean(targetId); if (!USERS[targetNum]) getUser(targetNum); }
            if (!targetNum) return `❌ User not found.`;
            if (targetNum === sender) return "❌ Can't send to yourself.";
            if (!bankTransfer(sender, targetNum, amt)) return `❌ Insufficient bank balance.`;
            saveData(); return `✅ Sent ${amt} XS to ${targetNum} (${USERS[targetNum].profileId})`;
        }
        if (sub === 'stmt' || sub === 'statement') { const b = getBank(sender); if (!b.transactions.length) return `📋 No transactions yet.`; let out = `📋 𝗦𝗧𝗔𝗧𝗘𝗠𝗘𝗡𝗧\n🆔 ${b.account}\n──────────────\n`; b.transactions.slice(-10).reverse().forEach(t => { out += `  ${t.type} ${t.amount} XS — ${new Date(t.time).toLocaleString()}\n`; }); return out; }
        if (sub === 'close') { delete BANKS[clean(sender)]; saveData(); return `🏦 Account closed.`; }
        return bankBox(sender);
    }

    // ─── CHEQUE (5 core commands) ─────
    if (c === 'cheque') {
        const gate = needRegistered(); if (gate) return gate;
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'sign') {
            const wait = checkCooldown(`chequesign:${sender}`, 60000);
            if (wait) return `⏳ Wait ${wait}s before signing another cheque.`;
            let target = getTarget(args, 1, msg); const amt = parseInt(args[2]);
            if (!target || !amt || amt <= 0) return `❌ ${PREFIX}cheque sign <number> <amt>`;
            if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
            if (target === sender) return "❌ Can't sign to yourself.";
            const id = "CHQ" + Date.now().toString().slice(-6);
            takeXS(sender, amt);
            CHEQUES.push({ id, from: sender, to: target, amount: amt, signed: Date.now(), expires: Date.now() + CONFIG.CHEQUE_EXPIRY, cashed: false });
            saveData();
            return `📝 Cheque #${id} signed for ${amt} XS to ${target}.\n⏰ Cash within 2 days: ${PREFIX}cheque cash ${id}`;
        }
        if (sub === 'cash') {
            const id = args[1]; if (!id) return `❌ ${PREFIX}cheque cash <id>`;
            const ch = CHEQUES.find(x => x.id === id && !x.cashed);
            if (!ch) return `❌ Not found or already cashed.`;
            if (ch.to !== clean(sender)) return `❌ Not your cheque.`;
            if (Date.now() > ch.expires) return `❌ Expired.`;
            giveXS(sender, ch.amount); ch.cashed = true; ch.cashedAt = Date.now(); saveData();
            return `💰 Cashed #${ch.id} — +${ch.amount} XS. Balance: ${user.xenoShards}`;
        }
        if (sub === 'give') {
            const id = args[1]; const newTo = clean(args[2]);
            if (!id || !newTo) return `❌ ${PREFIX}cheque give <id> <number>`;
            const ch = CHEQUES.find(x => x.id === id && !x.cashed);
            if (!ch) return `❌ Not found.`;
            if (ch.to !== clean(sender)) return `❌ Not yours to give.`;
            ch.to = newTo; saveData(); return `📝 Cheque #${id} transferred to ${newTo}`;
        }
        if (sub === 'cancel') {
            const id = args[1];
            const ch = CHEQUES.find(x => x.id === id && !x.cashed && x.from === clean(sender));
            if (!ch) return `❌ Not found or already cashed.`;
            giveXS(sender, ch.amount); ch.cashed = true; ch.cancelled = true; saveData();
            return `✅ Cancelled. ${ch.amount} XS refunded.`;
        }
        if (sub === 'list' || !sub) {
            const incoming = CHEQUES.filter(x => x.to === clean(sender) && !x.cashed && x.expires > Date.now());
            const outgoing = CHEQUES.filter(x => x.from === clean(sender) && !x.cashed);
            let out = `📋 𝗖𝗛𝗘𝗤𝗨𝗘𝗦\n📥 IN (${incoming.length})\n`;
            incoming.forEach(x => { out += `  #${x.id} — ${x.amount} XS from ${x.from}\n`; });
            out += `📤 OUT (${outgoing.length})\n`;
            outgoing.forEach(x => { out += `  #${x.id} — ${x.amount} XS to ${x.to}\n`; });
            out += `\n💡 sign <num> <amt> | cash <id> | give <id> <num> | cancel <id> | list\n⏰ Cheques expire in 2 days — unclaimed ones auto-refund back to whoever signed them.`;
            return out;
        }
        return `💡 ${PREFIX}cheque sign/cash/give/cancel/list`;
    }

    // ─── ECONOMY ──────────────────────
    if (c === 'daily') { const gate = needRegistered(); if (gate) return gate; const wait = checkCooldown(`daily:${sender}`, 86400000); if (wait) return `⏳ Come back in ${Math.ceil(wait / 3600)}h`; giveXS(sender, 100); saveData(); return `📅 +100 XS! Balance: ${user.xenoShards}`; }
    if (c === 'pay') {
        const gate = needRegistered(); if (gate) return gate;
        let target = getTarget(args, 0, msg); const amt = parseInt(args[1]) || parseInt(args[0]);
        if (!target || !amt || amt <= 0) return `❌ ${PREFIX}pay <number> <amt> (or reply + amt)`;
        if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
        if (user.debt > 0) return `🚫 Pay debts first (${user.debt}).`;
        takeXS(sender, amt); if (!USERS[target]) getUser(target);
        if (BANKS[target]) BANKS[target].balance += amt; else giveXS(target, amt);
        saveData(); return { text: `💸 Sent ${amt} XS to @${target}`, mentions: [target + '@s.whatsapp.net'] };
    }
    if (c === 'loan') {
        const gate = needRegistered(); if (gate) return gate;
        if (!BANKS[clean(sender)]) return `❌ Open a bank account first: ${PREFIX}bank open`;
        if (user.debt > 0) return `🚫 You owe ${user.debt} XS.`;
        const amt = parseInt(args[0]); if (!amt || amt < 100) return `❌ ${PREFIX}loan <amt> (min 100)`; if (amt > 10000) return "❌ Max 10,000 XS";
        const assets = user.xenoShards + (BANKS[sender] ? BANKS[sender].balance : 0);
        if (assets <= 0) return "❌ No collateral.";
        giveXS(sender, amt); user.debt = (user.debt || 0) + amt; user.lastLoanTick = Date.now(); saveData();
        return `💰 LOAN APPROVED\nAmount: ${amt} XS\nInterest: 0.3% every 2 days\nTotal debt: ${user.debt}`;
    }
    if (c === 'repay') { if (!user.debt || user.debt <= 0) return "ℹ️ No debt."; const amt = parseInt(args[0]); if (!amt || amt <= 0) return `❌ ${PREFIX}repay <amt>`; if (!takeXS(sender, amt)) return "❌ Insufficient."; user.debt -= amt; if (user.debt < 0) { giveXS(sender, -user.debt); user.debt = 0; } GOVERNMENT_FUNDS += amt; saveData(); return `✅ Repaid ${amt}. Remaining: ${user.debt}`; }
    if (c === 'rob' || c === 'thief') {
        if (c === 'thief') return `🥷 ${PREFIX}rob <@user> — 50% success, steal up to 20%.\n🚔 Caught = jail + 500 fine + public shame.`;
        const gate = needRegistered(); if (gate) return gate;
        let target = getTarget(args, 0, msg);
        if (!target) return `❌ ${PREFIX}rob <@user> (or reply)`;
        if (target === sender) return "❌ Can't rob yourself.";
        if (isProtected(target)) return "❌ Protected user.";
        const wait = checkCooldown(`rob:${sender}`, 300000); if (wait) return `⏳ Wait ${Math.ceil(wait / 60)}min.`;
        const t = getUser(target);
        if (Math.random() > 0.5) {
            const stolen = Math.min(t.xenoShards, Math.floor(t.xenoShards * 0.2));
            if (stolen <= 0) return "😐 Target has nothing.";
            takeXS(target, stolen); giveXS(sender, stolen); saveData();
            return { text: `🥷 ROBBERY SUCCESS\nStole: ${stolen} XS from @${target}`, mentions: [target + '@s.whatsapp.net'] };
        } else {
            user.arrested = Date.now() + 3600000; user.status = "Arrested 🚔";
            const fine = Math.min(user.xenoShards, 500); takeXS(sender, fine); GOVERNMENT_FUNDS += fine; saveData();
            return `🚔 CAUGHT!\nJailed 1hr. Fine: ${fine} XS.\n💀 ${random(SHAME_LINES)}`;
        }
    }

    // ─── JOBS ─────────────────────────
    if (c === 'jobs') { const cls = getUserClass(sender); let out = `💼 𝗝𝗢𝗕𝗦 𝗙𝗢𝗥 𝗬𝗢𝗨𝗥 𝗖𝗟𝗔𝗦𝗦: ${cls}\n──────────────\n`; GOV_JOBS.filter(j => j.tier === cls).forEach(j => { out += `  ${j.id}. ${j.title} — ${j.salary} XS\n`; }); return out + `\n💡 ${PREFIX}govjob <id> | 🔜 more roles soon`; }
    if (c === 'govjob') {
        const gate = needRegistered(); if (gate) return gate;
        if (user.company) return "❌ Resign your company role first.";
        if (user.job) return "❌ You already have a job.";
        const id = parseInt(args[0]);
        if (!id) { let out = `💼 𝗔𝗟𝗟 𝗚𝗢𝗩 𝗝𝗢𝗕𝗦\n`; GOV_JOBS.forEach(j => { out += `  ${j.id}. ${j.title} — ${j.salary} XS (${j.tier})\n`; }); return out; }
        const job = GOV_JOBS.find(j => j.id === id); if (!job) return "❌ Invalid ID.";
        user.job = { ...job, employer: "Government", shifts: 0, lastWork: 0 }; saveData();
        return `🏛️ Job taken: ${job.title} — ${job.salary} XS/shift\n💡 ${PREFIX}work to get paid`;
    }
    if (c === 'bankjob') {
        const gate = needRegistered(); if (gate) return gate;
        if (user.company) return "❌ Resign your company role first.";
        if (user.job) return "❌ You already have a job.";
        if (!BANKS[clean(sender)]) return `❌ Need a bank account first: ${PREFIX}bank open`;
        const id = parseInt(args[0]);
        if (!id) { let out = `🏦 𝗕𝗔𝗡𝗞 𝗝𝗢𝗕𝗦\n`; BANK_JOBS.forEach(j => { out += `  ${j.id}. ${j.title} — ${j.salary} XS (needs ${j.minTier}+)\n`; }); return out; }
        const job = BANK_JOBS.find(j => j.id === id); if (!job) return "❌ Invalid ID.";
        if (!tierAtLeast(getUserClass(sender), job.minTier)) return `❌ Needs ${job.minTier}+ class.`;
        user.job = { ...job, tier: 'BANK', employer: "Conclave Bank", shifts: 0, lastWork: 0 }; saveData();
        return `🏦 Bank job taken: ${job.title} — ${job.salary} XS/shift`;
    }
    if (c === 'work') {
        if (!user.job) return `❌ No job. Type ${PREFIX}jobs or ${PREFIX}bankjob`;
        const now = Date.now(); if (now - (user.job.lastWork || 0) < 300000) return `⏳ Wait ${Math.ceil((300000 - (now - user.job.lastWork)) / 60000)}min`;
        let pay = user.job.salary; if (Math.random() > 0.8) pay += Math.floor(pay * 0.3);
        const tax = Math.floor(pay * CONFIG.USER_TAX); const net = pay - tax;
        giveXS(sender, net); GOVERNMENT_FUNDS += tax; user.job.shifts++; user.job.lastWork = now; user.workShifts++; saveData();
        return `✅ Shift done at ${user.job.employer}.\n💰 You were paid: ${net} XS\n📈 Shifts: ${user.job.shifts}`;
    }
    if (c === 'myjob') { if (!user.job) return "❌ No job."; return `💼 ${user.job.title} (${user.job.employer})\n💰 ${user.job.salary} XS/shift\n📊 Shifts: ${user.job.shifts || 0}`; }
    if (c === 'resign') { if (!user.job) return "❌ No job."; const t = user.job.title; user.job = null; saveData(); return `📋 Resigned from ${t}.`; }

    // ─── COMPANY ──────────────────────
    if (c === 'company') {
        const gate = needRegistered(); if (gate) return gate;
        const sub = (args[0] || '').toLowerCase();
        if (!sub) return companyBox(sender);
        if (sub === 'create') {
            const cname = args.slice(1).join(' ');
            if (!cname) return `❌ ${PREFIX}company create <name>`;
            if (user.company) return "❌ Only one company per person.";
            if (user.job) return "❌ Resign your job first.";
            if (COMPANIES[cname]) return `❌ Name taken.`;
            if (user.xenoShards < CONFIG.COMPANY_MIN) return `❌ Need ${CONFIG.COMPANY_MIN} XS.`;
            if (!BANKS[clean(sender)]) return `❌ Open a bank account first: ${PREFIX}bank open`;
            if (user.debt > 0) return `❌ Pay debts first.`;
            takeXS(sender, CONFIG.COMPANY_MIN);
            COMPANIES[cname] = { name: cname, owner: sender, employees: [sender], employeeSince: { [sender]: Date.now() }, bank: 0, revenue: 0, expenses: CONFIG.COMPANY_MIN, taxPaid: 0, taxOwed: 0, founded: new Date().toDateString() };
            user.company = cname; user.status = "Businessman"; saveData();
            return `🏢 Registered: ${cname}\n👔 CEO: ${sender}\n🏛️ Tax: 15% of profit\n\n💡 ${PREFIX}company hire`;
        }
        if (sub === 'work') {
            const c2 = COMPANIES[user.company];
            if (!c2) return "❌ No company. Create one or accept a job offer first.";
            if (!c2.employees.includes(sender)) return "❌ You're not part of this company.";
            const wait = checkCooldown(`companywork:${sender}`, 300000);
            if (wait) return `⏳ Wait ${Math.ceil(wait / 60)}min`;
            const isBoss = c2.owner === sender;
            const clsBonus = { LOWER: 0, WORKING: 20, MIDDLE: 50, UPPER: 90, ELITE: 140 }[getUserClass(sender)] || 0;
            let pay = (isBoss ? 150 : 100) + clsBonus;
            if (Math.random() > 0.85) pay += Math.floor(pay * 0.25);
            const revenue = Math.floor(pay * 1.8);
            c2.revenue += revenue;
            c2.bank += (revenue - pay);
            c2.expenses += pay;
            giveXS(sender, pay);
            saveData();
            return `🏢 Shift done at ${c2.name}${isBoss ? ' (as CEO)' : ''}.\n💰 You earned: ${pay} XS\n📈 Company revenue: +${revenue} XS\n🏦 Company bank: ${c2.bank} XS`;
        }
        if (sub === 'info') { const c2 = COMPANIES[args[1] || user.company]; if (!c2) return `❌ Not found.`; return companyBox(sender); }
        if (sub === 'hire') {
            const c2 = COMPANIES[user.company]; if (!c2 || c2.owner !== sender) return "❌ Only CEO.";
            const target = getTarget(args, 1, msg); if (!target) return `❌ ${PREFIX}company hire <@user> (or reply)`;
            if (c2.employees.includes(target)) return "❌ Already hired.";
            if (!global.PENDING_HIRES) global.PENDING_HIRES = {};
            global.PENDING_HIRES[target] = { company: c2.name, from: sender }; saveData();
            try { await sock.sendMessage(target + '@s.whatsapp.net', { text: `📨 JOB OFFER\n🏢 ${c2.name}\n👔 From: ${sender}\n\n${PREFIX}accept or ${PREFIX}decline` }); } catch (e) {}
            return `📨 Offer sent to ${target}.`;
        }
        if (sub === 'fire') {
            const c2 = COMPANIES[user.company]; if (!c2 || c2.owner !== sender) return "❌ Only CEO.";
            const target = getTarget(args, 1, msg); if (!target || target === sender) return "❌ Invalid.";
            if (!c2.employees.includes(target)) return "❌ Not employed.";
            c2.employees = c2.employees.filter(e => e !== target); if (c2.employeeSince) delete c2.employeeSince[target]; if (USERS[target]) USERS[target].company = null; saveData();
            return `🚪 ${target} fired.`;
        }
        if (sub === 'leave' || sub === 'quit') {
            const c2 = COMPANIES[user.company];
            if (!c2) return "❌ You're not part of a company.";
            if (c2.owner === sender) return `❌ You're the CEO — use ${PREFIX}company close to dissolve it instead.`;
            const since = (c2.employeeSince && c2.employeeSince[sender]) || 0;
            const served = Date.now() - since;
            const removeFromCompany = () => {
                c2.employees = c2.employees.filter(e => e !== sender);
                if (c2.employeeSince) delete c2.employeeSince[sender];
                user.company = null;
            };
            if (served < CONFIG.CONTRACT_MIN_MS) {
                const fee = CONFIG.CONTRACT_BREAK_FEE;
                const paidFromWallet = Math.min(user.xenoShards, fee);
                const shortfall = fee - paidFromWallet;
                takeXS(sender, paidFromWallet);
                c2.bank += fee; // company is compensated in full regardless of shortfall
                if (shortfall > 0) user.debt = (user.debt || 0) + shortfall;
                removeFromCompany(); saveData();
                const hrsServed = Math.floor(served / 3600000);
                const hrsNeeded = Math.floor(CONFIG.CONTRACT_MIN_MS / 3600000);
                return `⚠️ 𝗖𝗢𝗡𝗧𝗥𝗔𝗖𝗧 𝗕𝗥𝗢𝗞𝗘𝗡 𝗘𝗔𝗥𝗟𝗬\nServed: ${hrsServed}h of the required ${hrsNeeded}h\n💸 Compensation paid to ${c2.name}: ${fee} XS${shortfall > 0 ? ` (${shortfall} added to your debt — you didn't have enough on hand)` : ''}\n🚪 You've left ${c2.name}.`;
            }
            removeFromCompany(); saveData();
            return `🚪 You completed your contract and left ${c2.name} cleanly. No penalty.`;
        }
        if (sub === 'close' || sub === 'dissolve') {
            const c2 = COMPANIES[user.company];
            if (!c2 || c2.owner !== sender) return "❌ Only the CEO can close the company.";
            const refund = c2.bank;
            c2.employees.forEach(e => { if (USERS[e] && e !== sender) USERS[e].company = null; });
            giveXS(sender, refund);
            delete COMPANIES[user.company];
            user.company = null; user.status = "Citizen";
            saveData();
            return `🏢 ${c2.name} closed.${refund > 0 ? ` Remaining company bank (${refund} XS) returned to you.` : ''} All employees released.`;
        }
        if (sub === 'pay') {
            const c2 = COMPANIES[user.company]; if (!c2 || c2.owner !== sender) return "❌ Only CEO.";
            const emp = getTarget(args, 1, msg); const amt = parseInt(args[2]) || parseInt(args[1]);
            if (!emp || !amt) return `❌ ${PREFIX}company pay <@> <amt>`;
            if (!c2.employees.includes(emp)) return "❌ Not employee.";
            if (c2.bank < amt) return "❌ Company bank insufficient.";
            c2.bank -= amt; if (!USERS[emp]) getUser(emp); giveXS(emp, amt); c2.expenses += amt; saveData();
            return `💸 Paid ${amt} to ${emp}.`;
        }
        if (sub === 'deposit') { const c2 = COMPANIES[user.company]; const amt = parseInt(args[1]); if (!c2) return "❌ No company."; if (!amt || amt <= 0) return `❌ ${PREFIX}company deposit <amt>`; if (!takeXS(sender, amt)) return "❌ Insufficient."; c2.bank += amt; c2.revenue += amt; saveData(); return `🏦 Deposited ${amt}. Company bank: ${c2.bank}`; }
        if (sub === 'tax') { const c2 = COMPANIES[user.company]; if (!c2) return "❌ No company."; const owed = c2.taxOwed || 0; if (owed <= 0) return "ℹ️ No tax owed."; if (c2.bank < owed) return `⚠️ Can't cover ${owed} XS. Bank: ${c2.bank}`; c2.bank -= owed; c2.taxPaid += owed; c2.taxOwed = 0; GOVERNMENT_FUNDS += owed; saveData(); return `🏛️ Paid ${owed} XS tax.`; }
        if (sub === 'top') { const sorted = Object.values(COMPANIES).sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses)).slice(0, 10); if (!sorted.length) return "📭 None yet."; let out = `🏆 𝗧𝗢𝗣 𝟭𝟬\n`; sorted.forEach((c2, i) => { out += `  ${i + 1}. ${c2.name} — ${c2.revenue - c2.expenses} XS\n`; }); return out; }
        return companyBox(sender);
    }
    if (c === 'accept') {
        if (!global.PENDING_HIRES || !global.PENDING_HIRES[sender]) return "❌ No pending offers.";
        const p = global.PENDING_HIRES[sender]; const comp = COMPANIES[p.company]; if (!comp) return "❌ Company gone.";
        if (getUser(sender).job) return "❌ Resign your job first.";
        if (!comp.employees.includes(sender)) comp.employees.push(sender);
        if (!comp.employeeSince) comp.employeeSince = {};
        comp.employeeSince[sender] = Date.now();
        USERS[sender].company = p.company; delete global.PENDING_HIRES[sender]; saveData();
        return `✅ You joined ${p.company}.\n📜 Minimum commitment: ${CONFIG.CONTRACT_MIN_MS / 3600000}h before you can leave without a break fee.`;
    }
    if (c === 'decline') { if (!global.PENDING_HIRES || !global.PENDING_HIRES[sender]) return "❌ No offer."; delete global.PENDING_HIRES[sender]; return "❌ Declined."; }

    // ─── FUN / GAMES ──────────────────
    if (['roast', 'compliment', 'shame'].includes(c)) {
        const wait = checkCooldown(`fun:${sender}`, CONFIG.FUN_COOLDOWN); if (wait) return `⏳ ${wait}s`;
        const target = getTarget(args, 0, msg);
        const line = c === 'roast' ? random(ROASTS) : c === 'compliment' ? random(COMPLIMENTS) : random(SHAME_LINES);
        const emoji = c === 'roast' ? '🔥' : c === 'compliment' ? '💐' : '📢';
        if (target) return { text: `${emoji} @${target} — ${line}`, mentions: [target + '@s.whatsapp.net'] };
        return `${emoji} ${line}`;
    }
    if (c === 'joke') return `😈 ${random(JOKES)}`;
    if (c === 'wyr') return `🤔 Would you rather ${random(WYR)}`;
    if (c === 'trivia') {
        if (args.length) {
            const guess = args.join(' ').toLowerCase();
            if (!user._triviaAnswer) return `❌ No active trivia. Type ${PREFIX}trivia to start one.`;
            if (guess.includes(user._triviaAnswer)) { giveXS(sender, 30); user._triviaAnswer = null; return `✅ Correct! +30 XS`; }
            return `❌ Not quite — try again, or ${PREFIX}trivia for a new question.`;
        }
        const t = random(TRIVIA); user._triviaAnswer = t.a;
        return `🧠 TRIVIA\n${t.q}\n💡 ${PREFIX}trivia <answer>`;
    }
    if (c === 'riddle') {
        if (args.length) {
            const guess = args.join(' ').toLowerCase();
            if (!user._riddleAnswer) return `❌ No active riddle. Type ${PREFIX}riddle to start one.`;
            if (guess.includes(user._riddleAnswer)) { giveXS(sender, 40); user._riddleAnswer = null; return `✅ Correct! +40 XS`; }
            return `❌ Not quite — try again, or ${PREFIX}riddle for a new one.`;
        }
        const r = random(RIDDLES); user._riddleAnswer = r.a;
        return `🧩 RIDDLE\n${r.q}\n💡 ${PREFIX}riddle <answer>`;
    }
    if (c === 'truth') return `🎯 TRUTH\n${random(["What's the last lie you told?", "Who would you trust with a secret?", "What's your biggest regret?"])}`;
    if (c === 'dare') return `🎯 DARE\n${random(["Send the last photo in your gallery.", "Send a selfie right now.", "Confess a crush."])}`;
    if (c === 'tod') return Math.random() > 0.5 ? `🎯 TRUTH\n${random(["What's the last lie you told?", "Who's your secret crush?"])}` : `🎯 DARE\n${random(["Send a selfie right now.", "Confess a crush."])}`;
    if (c === '8ball') { if (!args.length) return `❌ ${PREFIX}8ball <question>`; return `🎱 ${random(["Yes.", "No.", "Maybe.", "Ask again later.", "Signs point to yes.", "Very doubtful."])}`; }
    if (c === 'coinflip') return `🪙 ${Math.random() > 0.5 ? 'HEADS' : 'TAILS'}`;
    if (c === 'dice') return `🎲 You rolled: ${Math.floor(Math.random() * 6) + 1}`;
    if (c === 'guess') { const n = parseInt(args[0]); if (!n || n < 1 || n > 100) return `🎮 ${PREFIX}guess <1-100>`; const secret = user._guessSecret || Math.floor(Math.random() * 100) + 1; user._guessSecret = secret; if (n === secret) { user._guessSecret = null; giveXS(sender, 50); return `🎯 CORRECT! +50 XS`; } return n < secret ? `📈 Higher!` : `📉 Lower!`; }
    if (c === 'slot') { const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎']; const s1 = random(symbols), s2 = random(symbols), s3 = random(symbols); const slot = `🎰 ${s1} | ${s2} | ${s3}`; if (s1 === s2 && s2 === s3) { giveXS(sender, 500); return slot + `\n💎 JACKPOT! +500 XS`; } if (s1 === s2 || s2 === s3 || s1 === s3) { giveXS(sender, 100); return slot + `\n✨ +100 XS`; } return slot + `\n❌ Try again`; }
    if (c === 'rps') { const choice = (args[0] || '').toLowerCase(); const options = ['rock', 'paper', 'scissors']; if (!options.includes(choice)) return `❌ ${PREFIX}rps rock/paper/scissors`; const bot = random(options); let result; if (choice === bot) result = "🤝 Draw!"; else if ((choice === 'rock' && bot === 'scissors') || (choice === 'paper' && bot === 'rock') || (choice === 'scissors' && bot === 'paper')) { result = "🎉 You win!"; giveXS(sender, 50); } else result = "💀 You lose."; return `✊ You: ${choice}\n🤖 Bot: ${bot}\n${result}`; }

    // ─── STICKERS / MEDIA (fixed conversion) ──
    if (c === 's') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted?.imageMessage) return `❌ Reply to an image with ${PREFIX}s`;
        try {
            const buffer = await sock.downloadMediaMessage({ key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant }, message: quoted });
            const { Sticker, StickerTypes } = require('wa-sticker-formatter');
            const sticker = new Sticker(buffer, { pack: 'Conclave', author: 'Hodekai', type: StickerTypes.FULL, quality: 60 });
            const webp = await sticker.toBuffer();
            await sock.sendMessage(groupId || sender, { sticker: webp }, { quoted: msg });
            return null;
        } catch (e) { return `❌ Sticker failed: ${e.message}. Needs 'wa-sticker-formatter' installed.`; }
    }
    if (c === 'st') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted?.stickerMessage) return `❌ Reply to a sticker with ${PREFIX}st`;
        try {
            const buffer = await sock.downloadMediaMessage({ key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant }, message: quoted });
            const sharp = require('sharp');
            const png = await sharp(buffer).png().toBuffer();
            await sock.sendMessage(groupId || sender, { image: png, caption: "🖤" }, { quoted: msg });
            return null;
        } catch (e) { return `❌ ${e.message}. Needs 'sharp' installed.`; }
    }
    if (c === 'play') {
        try { await sock.sendMessage(groupId || sender, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
        const pick = parseInt(args[0]);
        if (pick && PENDING_PLAY[sender] && PENDING_PLAY[sender][pick - 1]) {
            const track = PENDING_PLAY[sender][pick - 1];
            try {
                const ytdl = require('@distube/ytdl-core');
                const stream = ytdl(track.url, { filter: 'audioonly', quality: 'highestaudio' });
                await sock.sendMessage(groupId || sender, { audio: { stream }, mimetype: 'audio/mp4', fileName: track.title + '.mp3' }, { quoted: msg });
                return null;
            } catch (e) { return `❌ Download failed: ${e.message}.`; }
        }
        const query = args.join(' '); if (!query) return `❌ ${PREFIX}play <song name>, then ${PREFIX}play <number> to pick.`;
        try {
            const ytSearch = require('yt-search');
            const r = await ytSearch(query);
            const top5 = (r.videos || []).slice(0, 5);
            if (!top5.length) return "❌ No results found.";
            PENDING_PLAY[sender] = top5;
            let out = `🎵 𝗧𝗢𝗣 𝟱 𝗥𝗘𝗦𝗨𝗟𝗧𝗦\n`; top5.forEach((v, i) => { out += `${i + 1}. ${v.title} (${v.timestamp})\n`; });
            return out + `\n💡 ${PREFIX}play <number> to download`;
        } catch (e) { return `❌ Search failed: ${e.message}.`; }
    }

    // ─── ADMIN ────────────────────────
    if (['kick', 'mute', 'unmute', 'warn', 'close', 'open', 'delete', 'tagall', 'promote', 'demote', 'active', 'inactive', 'gclink'].includes(c)) {
        if (!(isProtected(sender) || isWaAdminFlag)) { addLog('UNAUTHORIZED_ATTEMPT', sender, `tried ${PREFIX}${c}`); return `❌ Admins/Mods/Owners only.`; }
        if (!groupId) return "❌ Groups only.";
        const target = getTarget(args, 0, msg);
        if (c === 'kick') { if (!target) return `❌ Reply or ${PREFIX}kick @user`; if (isProtected(target)) return "❌ Protected."; try { await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "remove"); addLog('KICK', sender, target); return `⚠️ ${target} kicked.`; } catch (e) { return adminErrorText(e); } }
        if (c === 'mute') { if (!target) return `❌ ${PREFIX}mute @user <mins>`; const mins = parseInt(args[1]) || parseInt(args[0]) || 0; const t = getUser(target); t.muted = true; t.muteUntil = mins > 0 ? Date.now() + mins * 60000 : 0; saveData(); addLog('MUTE', sender, `${target} for ${mins || '∞'}min`); return `🔇 ${target} muted${mins ? ` for ${mins}min` : ''}.`; }
        if (c === 'unmute') { if (!target) return `❌ ${PREFIX}unmute @user`; getUser(target).muted = false; getUser(target).muteUntil = 0; return `🔊 ${target} unmuted.`; }
        if (c === 'warn') { if (!target) return `❌ ${PREFIX}warn @user`; const t = getUser(target); t.warns++; addLog('WARN', sender, target); return `⚠️ ${target} warned (${t.warns}/3).`; }
        if (c === 'close') { try { await sock.groupSettingUpdate(groupId, "announcement"); return "🔒 Closed."; } catch (e) { return adminErrorText(e); } }
        if (c === 'open') { try { await sock.groupSettingUpdate(groupId, "not_announcement"); return "🔓 Opened."; } catch (e) { return adminErrorText(e); } }
        if (c === 'delete') { const ctx = msg.message?.extendedTextMessage?.contextInfo; if (!ctx?.stanzaId) return `❌ Reply to a message with ${PREFIX}delete`; try { await sock.sendMessage(groupId, { delete: { remoteJid: groupId, fromMe: false, id: ctx.stanzaId, participant: ctx.participant } }); return null; } catch (e) { return adminErrorText(e); } }
        if (c === 'tagall') {
            const wait = checkCooldown(`tagall:${groupId}`, CONFIG.TAGALL_COOLDOWN); if (wait) return `⏳ Cooldown: ${Math.ceil(wait / 60)}min`;
            try {
                const meta = groupMeta || await sock.groupMetadata(groupId);
                const mentions = meta.participants.map(p => p.id);
                let txt = `╔═ ❰ 📢 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗔𝗟𝗘𝗥𝗧 ❱ ═╗\n║ 📛 ${meta.subject}\n║ 👥 ${meta.participants.length} summoned\n╠═══════════════╣\n`;
                meta.participants.forEach(p => { txt += `║ @${p.id.split('@')[0]}\n`; });
                txt += `╚═══════════════╝`;
                await sock.sendMessage(groupId, { text: txt, mentions });
                return null;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'promote') { if (!target) return `❌ ${PREFIX}promote @user`; try { await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "promote"); return `👑 ${target} promoted.`; } catch (e) { return adminErrorText(e); } }
        if (c === 'demote') { if (!target) return `❌ ${PREFIX}demote @user`; if (isProtected(target)) return "❌ Can't demote protected."; try { await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "demote"); return `⬇️ ${target} demoted.`; } catch (e) { return adminErrorText(e); } }
        if (c === 'gclink') { try { const code = await sock.groupInviteCode(groupId); return `🔗 https://chat.whatsapp.com/${code}`; } catch (e) { return adminErrorText(e); } }
        if (c === 'active' || c === 'inactive') {
            const msgs = GROUP_MESSAGES[groupId] || {};
            const entries = Object.entries(msgs);
            if (!entries.length) return "📭 No data tracked yet in this group.";
            const sorted = entries.sort((a, b) => c === 'active' ? b[1] - a[1] : a[1] - b[1]);
            let out = c === 'active' ? `📈 𝗧𝗢𝗣 𝗔𝗖𝗧𝗜𝗩𝗘 (since bot last restarted)\n` : `📉 𝗟𝗘𝗔𝗦𝗧 𝗔𝗖𝗧𝗜𝗩𝗘 (since bot last restarted)\n`;
            sorted.slice(0, 10).forEach(([n, count], i) => { const nm = USERS[n]?.name; out += `  ${i + 1}. ${n}${nm ? ' (' + nm + ')' : ''} — ${count} msgs\n`; });
            out += `\n💡 Only counts messages sent while I was awake — I don't have your full group history.`;
            return out;
        }
    }
    if (c === 'groups') {
        if (!isProtected(sender)) return null;
        try {
            const all = await sock.groupFetchAllParticipating();
            const list = Object.values(all);
            if (!list.length) return "📭 Not in any groups.";
            let out = `╔═ ❰ 🌐 𝗚𝗥𝗢𝗨𝗣𝗦 (${list.length}) ❱ ═╗\n`;
            list.forEach((g, i) => { out += `║ ${i + 1}. ${g.subject} — ${g.participants.length} members\n`; });
            out += `╚═══════════════╝`;
            return out;
        } catch (e) { return `❌ ${e.message}`; }
    }

    // ─── MOD ──────────────────────────
    if (c === 'chat') { if (!(isProtected(sender) || isWaAdminFlag)) return null; if (!groupId) return "❌ Groups only."; const mode = (args[0] || '').toLowerCase(); if (mode !== 'on' && mode !== 'off') return `❌ ${PREFIX}chat on/off`; CHAT_MODE[groupId] = mode === 'on'; saveData(); return `💬 Free conversation ${mode.toUpperCase()} for this group.`; }
    if (c === 'activate') { if (!isProtected(sender)) return "❌ Mods/Owners only."; if (!groupId) return "❌ Groups only."; UNACTIVATED_GROUPS = UNACTIVATED_GROUPS.filter(g => g !== groupId); saveData(); return "✅ Bot activated in this group."; }
    if (c === 'whitelist') { if (!isProtected(sender)) return "❌ Mods/Owners only."; if (!groupId) return "❌ Groups only."; if (!WHITELISTED_GROUPS.includes(groupId)) WHITELISTED_GROUPS.push(groupId); UNACTIVATED_GROUPS = UNACTIVATED_GROUPS.filter(g => g !== groupId); saveData(); return "✅ Group whitelisted."; }
    if (c === 'banuser' || c === 'unbanuser') { if (!isProtected(sender)) return "❌ Mods/Owners only."; const target = getTarget(args, 0, msg); if (!target) return `❌ ${PREFIX}${c} @user`; if (c === 'banuser') { if (!BLACKLIST.includes(target)) BLACKLIST.push(target); addLog('BAN', sender, target); } else BLACKLIST = BLACKLIST.filter(x => x !== target); saveData(); return c === 'banuser' ? `🚫 ${target} banned from using the bot.` : `✅ ${target} unbanned.`; }
    if (c === 'lockdown') { if (!isProtected(sender)) return "❌ Owners/Mods only."; if (!groupId) return "❌ Groups only."; if (!LOCKED_GROUPS.includes(groupId)) LOCKED_GROUPS.push(groupId); saveData(); return "🔒 Locked."; }
    if (c === 'unlock') { if (!isProtected(sender)) return "❌ Owners/Mods only."; if (!groupId) return "❌ Groups only."; LOCKED_GROUPS = LOCKED_GROUPS.filter(g => g !== groupId); saveData(); return "🔓 Unlocked."; }
    if (c === 'setcouncil') { if (!isOwner(sender)) return "❌ Owners only."; if (!groupId) return "❌ Groups only."; COUNCIL_GROUP = groupId; saveData(); return "✅ Council set."; }
    if (c === 'mod') {
        if (!isOwner(sender)) return "❌ Owners only.";
        const sub = (args[0] || '').toLowerCase();
        const target = getTarget(args, 1, msg);
        if (sub === 'add') {
            if (!target) return `❌ ${PREFIX}mod add <number> (or reply/@mention)`;
            if (MODS.map(clean).includes(target)) return "ℹ️ Already a mod.";
            MODS.push(target); saveData();
            return `✅ ${target}${USERS[target]?.name ? ' (' + USERS[target].name + ')' : ''} is now a MOD.`;
        }
        if (sub === 'remove') {
            if (!target) return `❌ ${PREFIX}mod remove <number> (or reply/@mention)`;
            if (!MODS.map(clean).includes(target)) return "❌ Not a mod.";
            MODS = MODS.filter(m => clean(m) !== target); saveData();
            return `✅ ${target} removed as mod.`;
        }
        let modOut = `╔═ ❰ ⚡ 𝗠𝗢𝗗𝗦 (${MODS.length}) ❱ ═╗\n`;
        MODS.forEach((m, i) => { const nm = USERS[clean(m)]?.name; modOut += `║ ${i + 1}. ${m}${nm ? ' — ' + nm : ''}\n`; });
        modOut += `╚═══════════════╝`;
        return modOut;
    }
    if (c === 'shutdown') { if (!isProtected(sender)) return "❌ Mods/Owners only."; global.BOT_ACTIVE = false; return `😴 Taking a nap. I'll only respond to Father/Co-Creator until ${PREFIX}startup wakes me up.`; }
    if (c === 'startup') { if (!isProtected(sender)) return "❌ Mods/Owners only."; global.BOT_ACTIVE = true; return "🌅 Awake. Back to work."; }

    // ─── SUGGESTIONS ──────────────────
    if (c === 'suggest') {
        const today = new Date().toDateString();
        const countToday = SUGGESTIONS.filter(s => s.from === sender && s.date === today).length;
        if (countToday >= CONFIG.SUGGEST_LIMIT_PER_DAY) return `❌ Limit reached (${CONFIG.SUGGEST_LIMIT_PER_DAY}/day).`;
        const full = args.join(' '); const parts = full.split('|').map(s => s.trim());
        if (parts.length < 3) return `❌ ${PREFIX}suggest <cat> | <title> | <desc>`;
        SUGGESTIONS.push({ from: sender, text: full, date: today }); saveData();
        if (COUNCIL_GROUP) { try { await sock.sendMessage(COUNCIL_GROUP, { text: `📨 SUGGESTION\nFrom: ${sender}\n📂 ${parts[0]}\n📌 ${parts[1]}\n📝 ${parts[2]}` }); } catch (e) {} }
        return `✅ Sent to council. (${countToday + 1}/${CONFIG.SUGGEST_LIMIT_PER_DAY} today)`;
    }
    if (c === 'help') {
        const q = args[0]; if (!q) return `💡 ${PREFIX}help <command>`;
        const help = { bank: "Full banking system. Needed for loans and companies.", cheque: "Signed promise to pay. Cashed with recipient's Conclave ID within 2 days.", company: "One per person, 5000 XS. Hire/fire/pay employees. 15% profit tax; unpaid tax over 600 = bankruptcy.", jobs: "Choose a job based on your class. Can't hold a job and a company at once.", rob: "50% success. Caught = jail + fine + public shame." };
        return help[q.toLowerCase()] || `❌ No help for '${q}'.`;
    }

    // ─── OWNER-ONLY ───────────────────
    if (isOwner(sender)) {
        if (c === 'addmoney') { const t = clean(args[0]); const a = parseInt(args[1]); if (!t || !a) return `❌ ${PREFIX}addmoney <num> <amt>`; if (!USERS[t]) getUser(t); giveXS(t, a); saveData(); return `✅ +${a} XS to ${t}`; }
        if (c === 'removemoney') { const t = clean(args[0]); const a = parseInt(args[1]); if (!t || !a) return `❌ ${PREFIX}removemoney <num> <amt>`; takeXS(t, a); saveData(); return `✅ -${a} XS from ${t}`; }
        if (c === 'setmoney') { const t = clean(args[0]); const a = parseInt(args[1]); if (!t || isNaN(a)) return `❌ ${PREFIX}setmoney <num> <amt>`; getUser(t).xenoShards = a; saveData(); return `✅ ${t} set to ${a} XS`; }
        if (c === 'resetuser') { const t = clean(args[0]); if (!t) return `❌ ${PREFIX}resetuser <num>`; delete USERS[t]; delete BANKS[t]; getUser(t); saveData(); return `✅ ${t} reset.`; }
        if (c === 'setrole') { const t = clean(args[0]); const role = (args[1] || '').toUpperCase(); if (!t || !role) return `❌ ${PREFIX}setrole <num> <role>`; getUser(t).role = role; saveData(); return `✅ ${t} role set to ${role}`; }
        if (c === 'seizecompany') { const name = args.join(' '); const comp = COMPANIES[name]; if (!comp) return "❌ Not found."; if (USERS[comp.owner]) USERS[comp.owner].company = null; GOVERNMENT_FUNDS += comp.bank; delete COMPANIES[name]; saveData(); return `🏛️ Seized ${name}. ${comp.bank} XS added to treasury.`; }
        if (c === 'viewall') { let out = `📊 ALL USERS (${Object.keys(USERS).length})\n`; Object.entries(USERS).slice(0, 20).forEach(([n, u]) => { out += `${n}: ${u.xenoShards} XS | ${u.role}\n`; }); return out; }
        if (c === 'emergency') { LOCKED_GROUPS = []; saveData(); return "⚠️ Emergency: all groups unlocked."; }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════
// ECONOMY TICK
// ═══════════════════════════════════════════════════════════
function processExpiredCheques() {
    let changed = false;
    CHEQUES.forEach(ch => {
        if (!ch.cashed && Date.now() > ch.expires) {
            giveXS(ch.from, ch.amount);
            ch.cashed = true;
            ch.expiredRefund = true;
            changed = true;
        }
    });
    if (changed) saveData();
}

function runEconomyTick() {
    const now = Date.now();
    for (const num in BANKS) { const b = BANKS[num]; if (b.balance > 0) { const interest = Math.floor(b.balance * CONFIG.BANK_INTEREST); if (interest > 0) { b.balance += interest; b.interestEarned += interest; } } }
    for (const num in USERS) { const u = USERS[num]; if (u.debt > 0) { if (!u.lastLoanTick || now - u.lastLoanTick >= CONFIG.LOAN_INTEREST_TICK) { u.debt = Math.ceil(u.debt * (1 + CONFIG.LOAN_INTEREST)); u.lastLoanTick = now; } } }
    for (const name in COMPANIES) {
        const c = COMPANIES[name];
        const profit = Math.max(0, c.revenue - c.expenses - c.taxPaid);
        const newTax = Math.floor(profit * CONFIG.COMPANY_TAX) - (c.taxOwed || 0);
        if (newTax > 0) c.taxOwed = (c.taxOwed || 0) + newTax;
        if ((c.taxOwed || 0) > CONFIG.COMPANY_TAX_BANKRUPTCY) {
            const remaining = c.taxOwed - c.bank;
            GOVERNMENT_FUNDS += c.bank;
            if (USERS[c.owner]) { USERS[c.owner].company = null; if (remaining > 0) USERS[c.owner].debt = (USERS[c.owner].debt || 0) + remaining; }
            delete COMPANIES[name];
            addLog('BANKRUPTCY', 'SYSTEM', `${name} (owner ${c.owner}) seized, debt +${Math.max(0, remaining)}`);
        }
    }
    saveData();
}

// ═══════════════════════════════════════════════════════════
// SESSION SAVE / RESTORE
// ═══════════════════════════════════════════════════════════
function saveSession() {
    try {
        const files = fs.readdirSync(AUTH_DIR).filter(f => f.endsWith('.json'));
        const packed = {}; files.forEach(f => { packed[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8'); });
        const encoded = Buffer.from(JSON.stringify(packed)).toString('base64');
        console.log('\n═══════════════════════════════\n💾 SESSION_ID:\nSESSION_ID=' + encoded + '\n═══════════════════════════════\n');
        return encoded;
    } catch (e) { return null; }
}
function restoreSession() {
    if (!SESSION_ID) return false;
    try { const decoded = JSON.parse(Buffer.from(SESSION_ID, 'base64').toString('utf8')); for (const [file, content] of Object.entries(decoded)) fs.writeFileSync(path.join(AUTH_DIR, file), content); console.log('📂 Session restored'); return true; }
    catch (e) { return false; }
}

// ═══════════════════════════════════════════════════════════
// WHATSAPP CONNECTION
// ═══════════════════════════════════════════════════════════
const app = express();
app.use(cors()); app.use(express.json());

let pairingRequested = false, isConnected = false, reconnectAttempts = 0, activeSocket = null, currentPairingCode = null;

async function connectWhatsApp() {
    if (isConnected && activeSocket) return;
    try {
        console.log(`📱 Connecting (attempt ${reconnectAttempts})...`);
        if (activeSocket) { try { activeSocket.end(undefined); } catch (e) {} activeSocket = null; }
        restoreSession();
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ version, auth: state, keepAliveIntervalMs: 25000, markOnlineOnConnect: true, syncFullHistory: false, generateHighQualityLinkPreview: false, defaultQueryTimeoutMs: 60000 });
        activeSocket = sock;

        if (!state.creds.registered && !pairingRequested) {
            pairingRequested = true;
            setTimeout(async () => { try { if (state.creds.registered) return; console.log('🔑 Requesting pairing code...'); const code = await sock.requestPairingCode(BOT_NUMBER); currentPairingCode = code; console.log(`\n🔑 PAIRING CODE: ${code}\n`); } catch (err) { console.error('Pairing:', err.message); } }, 3000);
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') { isConnected = true; reconnectAttempts = 0; console.log('\n🖤 HODEKAI CONNECTED!\n'); setTimeout(saveSession, 5000); }
            if (connection === 'close') {
                isConnected = false;
                const code = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut;
                console.log(`⚠️ Closed: ${code}`);
                if (loggedOut) { console.log('🚪 Logged out. Delete auth folder and re-pair.'); return; }
                reconnectAttempts++;
                const delay = Math.min(5000 * reconnectAttempts, 60000);
                console.log(`🔄 Reconnecting in ${delay / 1000}s`);
                setTimeout(connectWhatsApp, delay);
            }
        });

        sock.ev.on('group-participants.update', async (event) => {
            try {
                const { id: groupId, participants, action } = event;
                const botNum = clean(sock.user.id.split(':')[0].split('@')[0]);
                if (action === 'add') {
                    const addedBot = participants.some(p => clean(p.split('@')[0]) === botNum);
                    if (addedBot) {
                        const meta = await sock.groupMetadata(groupId);
                        const adderRaw = event.author ? clean(event.author.split('@')[0]) : null;
                        const adderResolved = adderRaw ? (LID_MAP[adderRaw] || adderRaw) : null;
                        const adderIsPower = adderResolved && (isOwner(adderResolved) || isMod(adderResolved));
                        const hasAuthority = meta.participants.some(p => { const n = clean(p.id.split('@')[0]); const resolved = LID_MAP[n] || n; return isOwner(resolved) || isMod(resolved); });
                        if (!adderIsPower && !hasAuthority && !WHITELISTED_GROUPS.includes(groupId)) {
                            UNACTIVATED_GROUPS.push(groupId); saveData();
                            addLog('UNAUTHORIZED_ADD', adderRaw || 'unknown', meta.subject);
                            if (COUNCIL_GROUP) await sock.sendMessage(COUNCIL_GROUP, { text: `🚨 ADDED TO UNKNOWN GROUP\n📛 ${meta.subject}\n👤 Added by: ${adderRaw || 'unknown'}\n\nDormant here until ${PREFIX}activate is run by a mod/owner.` });
                        } else {
                            addLog('GROUP_ADD', adderRaw || 'unknown', meta.subject);
                            try { await sock.sendMessage(groupId, { text: `🖤 Hodekai online. Added by a trusted authority — active immediately.\nType ${PREFIX}menu to begin.` }); } catch (e) {}
                        }
                    }
                }
                if (action === 'remove') {
                    for (const p of participants) {
                        const n = clean(p.split('@')[0]);
                        const resolved = LID_MAP[n] || n;
                        if (isOwner(resolved) || isMod(resolved)) {
                            UNACTIVATED_GROUPS.push(groupId); saveData();
                            if (COUNCIL_GROUP) await sock.sendMessage(COUNCIL_GROUP, { text: `⚠️ AUTHORITY REMOVED\n👤 ${resolved} was kicked from a group.\nBot paused there until ${PREFIX}activate.` });
                        }
                    }
                }
            } catch (e) { console.error('group event:', e.message); }
        });

        sock.ev.on('messages.upsert', async m => {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                try {
                    if (!msg.message || msg.key.fromMe) continue;
                    const isGroup = msg.key.remoteJid.endsWith('@g.us');
                    const groupId = isGroup ? msg.key.remoteJid : null;
                    const sender = await resolveSenderNumber(sock, msg, groupId);
                    if (!sender) continue;
                    if (!global.BOT_ACTIVE && !isProtected(sender)) continue;

                    trackMessage();
                    if (msg.pushName) getUser(sender).name = msg.pushName;

                    if (isGroup && UNACTIVATED_GROUPS.includes(groupId)) {
                        const text0 = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                        if (!(text0.startsWith(PREFIX + 'activate') && isProtected(sender))) continue;
                    }
                    if (isGroup && isLocked(groupId) && !isProtected(sender)) continue;
                    if (isBlacklisted(sender) && !isOwner(sender)) continue;
                    const uCheck = getUser(sender);
                    if (uCheck.muted && !isOwner(sender)) { if (uCheck.muteUntil && Date.now() > uCheck.muteUntil) { uCheck.muted = false; uCheck.muteUntil = 0; } else continue; }
                    if (!isGroup && !isProtected(sender)) { console.log(`🚫 DM blocked: ${sender}`); continue; }

                    let groupMeta = null;
                    if (isGroup) {
                        try { groupMeta = await sock.groupMetadata(groupId); } catch (e) {}
                        if (!GROUP_MESSAGES[groupId]) GROUP_MESSAGES[groupId] = {};
                        GROUP_MESSAGES[groupId][sender] = (GROUP_MESSAGES[groupId][sender] || 0) + 1;
                    }

                    let text = '', isSticker = false;
                    if (msg.message.conversation) text = msg.message.conversation;
                    else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
                    else if (msg.message.stickerMessage) isSticker = true;
                    else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;

                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;

                    if (isSticker) { if (isProtected(sender) || Math.random() > 0.85) { await sock.sendMessage(msg.key.remoteJid, { text: "🎨 " + random(["nice sticker", "cool"]) }, { quoted: msg }); } continue; }

                    if (text && text.startsWith(PREFIX)) {
                        const command = text.slice(1).trim();
                        const args = command.split(/\s+/);
                        const cmd = args.shift().toLowerCase();
                        const isWaAdminFlag = isGroup ? await isWaAdmin(sock, groupId, sender, groupMeta) : false;
                        const reply = await handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, !isGroup, isWaAdminFlag, groupMeta);
                        if (reply) {
                            await sleep(CONFIG.RESPONSE_DELAY);
                            if (typeof reply === 'string') await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                            else await sock.sendMessage(msg.key.remoteJid, { text: reply.text, mentions: reply.mentions || [] }, { quoted: msg });
                        }
                        continue;
                    }

                    if (text) {
                        const mentioned = /\bhodekai\b/i.test(text);
                        const freeChat = isGroup && CHAT_MODE[groupId];
                        if (!isGroup || mentioned || freeChat) {
                            let reply = await getAIResponse(sender, text, uCheck);
                            if (!reply) reply = getHumanResponse(text, sender, groupMeta?.subject);
                            if (reply) { await sleep(CONFIG.CHAT_DELAY); await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg }); }
                        }
                    }
                } catch (e) { console.error('Msg error:', e.message); }
            }
        });

        sock.ev.on('creds.update', async () => { await saveCreds(); setTimeout(saveSession, 2000); });
    } catch (err) {
        console.error('Connect:', err.message);
        reconnectAttempts++;
        setTimeout(connectWhatsApp, Math.min(5000 * reconnectAttempts, 60000));
    }
}

function startSelfPing() {
    const url = process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL;
    if (!url) { console.log('⚠️ No SELF_URL/RENDER_EXTERNAL_URL set — self-ping disabled.'); return; }
    setInterval(() => { const client = url.startsWith('https') ? require('https') : require('http'); client.get(url, res => res.resume()).on('error', () => {}); }, 4 * 60 * 1000);
    console.log(`🔁 Self-ping enabled → ${url}`);
}

app.get('/', (req, res) => { res.json({ status: "🖤 HODEKAI ONLINE", members: Object.keys(USERS).length, banks: Object.keys(BANKS).length, companies: Object.keys(COMPANIES).length, treasury: GOVERNMENT_FUNDS, whatsapp: isConnected ? "CONNECTED" : "DISCONNECTED", pairingCode: currentPairingCode || "none" }); });
app.get('/ping', (req, res) => res.send('pong'));
app.listen(PORT, () => console.log(`🌐 Port ${PORT}`));

loadData();
setInterval(saveData, 30000);
setInterval(runEconomyTick, CONFIG.ECONOMY_TICK);
setInterval(processExpiredCheques, 600000);
startSelfPing();

console.log('🖤 HODEKAI v6.1\n🏛️ CONCLAVE AWAITS!!!');
connectWhatsApp();

process.on('SIGINT', () => { saveData(); process.exit(0); });
process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('uncaughtException', (e) => { console.error('❌', e.message); });
process.on('unhandledRejection', (e) => { console.error('❌', e); });
