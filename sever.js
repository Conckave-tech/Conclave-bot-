// ═══════════════════════════════════════════════════════════
// 🖤 HODEKAI BOT v5.0 — CONCLAVE HOLDINGS
// ═══════════════════════════════════════════════════════════

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// ─── CONFIG ─────────────────────────────
const PREFIX = ":";
const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "256775032199";
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = "Hodekai";
const BOT_VERSION = "5.0.0";

// OWNER NUMBERS - accept ALL formats
const FATHER_NUMBERS = ["263787876771", "0787876771", "787876771"];
const CO_CREATOR_NUMBERS = ["263717306869", "0717306869", "717306869"];

const OWNERS = {
    FATHER: "263787876771",
    CO_CREATOR: "263717306869"
};

let MODS = ["2348123885002", "2349168527304", "256795955270", "2347031331295"];
let BLACKLIST = [];
let LOCKED_GROUPS = [];
let COUNCIL_GROUP = null;

// ─── STATE ──────────────────────────────
let USERS = {};
let BANKS = {};       // { userId: { account: "XNC-XXXX", balance: 0, transactions: [] } }
let COMPANIES = {};
let CHEQUES = [];     // [{ id, from, to, amount, signed, expires, cashed, transferred }]
let COOLDOWNS = {};
let GROUP_MESSAGES = {};
let GOVERNMENT_FUNDS = 10000000;

const CONFIG = {
    COMPANY_TAX: 0.15,
    USER_TAX: 0.05,
    LOAN_INTEREST: 0.001,
    BANKRUPTCY: 500000,
    COMPANY_MIN: 10000,
    TAGALL_COOLDOWN: 300000,
    CHEQUE_EXPIRY: 172800000,
    CHEQUE_COOLDOWN: 10000,
    RESPONSE_DELAY: 3000,
    BANK_INTEREST: 0.001
};

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
            GROUP_MESSAGES, MODS
        }, null, 2));
    } catch (e) { console.error('Save:', e.message); }
}

// ─── HELPERS ────────────────────────────
function random(a) { return a[Math.floor(Math.random() * a.length)]; }
function clean(n) { return n ? String(n).replace(/\D/g, '') : ""; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getMixedResponse() {
    return random([
        "life is just a series of disappointments.",
        "another day, another struggle.",
        "the void stares back.",
        "existence is pain.",
        "nobody really cares.",
        "Power is not given, it is taken.",
        "In CONCLAVE, loyalty is the only currency that matters.",
        "The night is darkest before the dawn.",
        "In the end, only the strong survive.",
        "Trust is a luxury we cannot afford."
    ]);
}

// ─── POWER CHECKS (FLEXIBLE) ────────────
function isFather(n) { return FATHER_NUMBERS.includes(clean(n)); }
function isCoCreator(n) { return CO_CREATOR_NUMBERS.includes(clean(n)); }
function isOwner(n) { return isFather(n) || isCoCreator(n); }
function isMod(n) { return MODS.map(clean).includes(clean(n)); }
function isProtected(n) { return isOwner(n) || isMod(n); }
function isBlacklisted(n) { return BLACKLIST.includes(clean(n)); }
function isLocked(g) { return LOCKED_GROUPS.includes(g); }

async function isWaAdmin(sock, g, n) {
    try {
        const m = await sock.groupMetadata(g);
        const p = m.participants.find(x => clean(x.id.split('@')[0].split(':')[0]) === clean(n));
        return p && (p.admin === 'admin' || p.admin === 'superadmin');
    } catch (e) { return false; }
}

async function isBotAdmin(sock, g) {
    try {
        const m = await sock.groupMetadata(g);
        const b = clean(sock.user.id.split(':')[0].split('@')[0]);
        const p = m.participants.find(x => clean(x.id.split('@')[0].split(':')[0]) === b);
        return p && (p.admin === 'admin' || p.admin === 'superadmin');
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
        // Profile ID: last 5 digits of number
        const profileId = "CLV-" + String(num).slice(-5).padStart(5, '0');
        USERS[num] = {
            number: num,
            profileId: profileId,
            xenoShards: 1000,
            role: role,
            status: "Citizen",
            level: 1,
            joinDate: new Date().toDateString(),
            warns: 0,
            muted: false,
            arrested: 0,
            job: null,
            company: null,
            debt: 0,
            interactions: 0,
            totalEarned: 0,
            totalSpent: 0,
            workShifts: 0
        };
    }
    USERS[num].interactions++;
    return USERS[num];
}

function giveXS(num, amt) {
    const u = getUser(num);
    u.xenoShards += amt;
    u.totalEarned += amt;
}
function takeXS(num, amt) {
    const u = getUser(num);
    if (u.xenoShards < amt) return false;
    u.xenoShards -= amt;
    u.totalSpent += amt;
    return true;
}

// ─── BANK SYSTEM (PEAK) ─────────────────
function getBank(num) {
    num = clean(num);
    if (!BANKS[num]) {
        const accountNum = "XNC-" + Math.floor(10000000 + Math.random() * 90000000);
        BANKS[num] = {
            account: accountNum,
            balance: 0,
            opened: new Date().toDateString(),
            transactions: [],
            interestEarned: 0
        };
    }
    return BANKS[num];
}

function bankDeposit(num, amt) {
    const b = getBank(num);
    if (!takeXS(num, amt)) return false;
    b.balance += amt;
    b.transactions.push({ type: "DEPOSIT", amount: amt, time: Date.now() });
    if (b.transactions.length > 50) b.transactions.shift();
    return true;
}

function bankWithdraw(num, amt) {
    const b = getBank(num);
    if (b.balance < amt) return false;
    b.balance -= amt;
    giveXS(num, amt);
    b.transactions.push({ type: "WITHDRAW", amount: amt, time: Date.now() });
    if (b.transactions.length > 50) b.transactions.shift();
    return true;
}

function bankTransfer(from, to, amt) {
    const bFrom = getBank(from);
    const bTo = getBank(to);
    if (bFrom.balance < amt) return false;
    bFrom.balance -= amt;
    bTo.balance += amt;
    bFrom.transactions.push({ type: "SENT", to: to, amount: amt, time: Date.now() });
    bTo.transactions.push({ type: "RECEIVED", from: from, amount: amt, time: Date.now() });
    return true;
}

// ─── JOBS ───────────────────────────────
const GOV_JOBS = [
    { id: 1, title: "🗑️ Garbage Collector", salary: 50, tier: "LOWER" },
    { id: 2, title: "🧹 Street Sweeper", salary: 45, tier: "LOWER" },
    { id: 3, title: "🌳 Gardener", salary: 55, tier: "LOWER" },
    { id: 4, title: "💡 Lamplighter", salary: 40, tier: "LOWER" },
    { id: 5, title: "📦 Warehouse Worker", salary: 60, tier: "LOWER" },
    { id: 6, title: "🚗 Courier", salary: 65, tier: "LOWER" },
    { id: 7, title: "🛠️ Janitor", salary: 50, tier: "LOWER" },
    { id: 8, title: "🍳 Cook", salary: 70, tier: "LOWER" },
    { id: 9, title: "🧑‍🏫 Teacher", salary: 80, tier: "WORKING" },
    { id: 10, title: "🚑 Medic", salary: 90, tier: "WORKING" },
    { id: 11, title: "🛡️ Guard", salary: 75, tier: "WORKING" },
    { id: 12, title: "📝 Clerk", salary: 55, tier: "WORKING" },
    { id: 13, title: "🎨 Designer", salary: 130, tier: "WORKING" },
    { id: 14, title: "📚 Writer", salary: 120, tier: "WORKING" },
    { id: 15, title: "🎵 Musician", salary: 125, tier: "WORKING" },
    { id: 16, title: "📸 Photographer", salary: 115, tier: "WORKING" },
    { id: 17, title: "💻 Developer", salary: 150, tier: "MIDDLE" },
    { id: 18, title: "📊 Data Analyst", salary: 140, tier: "MIDDLE" },
    { id: 19, title: "💰 Accountant", salary: 145, tier: "MIDDLE" },
    { id: 20, title: "🔬 Researcher", salary: 155, tier: "MIDDLE" },
    { id: 21, title: "⚡ Energy Tech", salary: 135, tier: "MIDDLE" },
    { id: 22, title: "🌊 Marine Biologist", salary: 145, tier: "MIDDLE" },
    { id: 23, title: "📈 Marketing", salary: 160, tier: "UPPER" },
    { id: 24, title: "🏗️ Architect", salary: 170, tier: "UPPER" },
    { id: 25, title: "⚖️ Lawyer", salary: 180, tier: "UPPER" },
    { id: 26, title: "🧪 Scientist", salary: 175, tier: "UPPER" },
    { id: 27, title: "📋 Project Manager", salary: 160, tier: "UPPER" },
    { id: 28, title: "🩺 Doctor", salary: 200, tier: "UPPER" },
    { id: 29, title: "🚀 Engineer", salary: 220, tier: "ELITE" },
    { id: 30, title: "🧑‍💼 CEO", salary: 250, tier: "ELITE" }
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

// ═══════════════════════════════════════════════════════════
// BOXES — ONLY THESE EXIST
// ═══════════════════════════════════════════════════════════

function menuBox(sender) {
    const u = getUser(sender);
    const bank = BANKS[clean(sender)] || { balance: 0 };
    return `╔══════════════════════════════════════════╗
║       🖤 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗠𝗘𝗡𝗨 v5.0                ║
╠══════════════════════════════════════════╣
║  📌 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢
║  ❯ Name: Hodekai
║  ❯ Father: 263787876771
║  ❯ Co-Creator: 263717306869
║  ❯ Version: v5.0.0
║  ❯ Status: 🟢 ONLINE
║  ❯ Members: ${Object.keys(USERS).length}
║  ❯ Mods: ${MODS.length}
║  ❯ Companies: ${Object.keys(COMPANIES).length}
║  ❯ Treasury: ${GOVERNMENT_FUNDS} XS
║
╠══════════════════════════════════════════╣
║  👤 𝗬𝗢𝗨𝗥 𝗦𝗧𝗔𝗧𝗦
║  ❯ Profile ID: ${u.profileId}
║  ❯ Wallet: ${u.xenoShards} XS
║  ❯ Bank: ${bank.balance} XS
║  ❯ Debt: ${u.debt || 0} XS
║  ❯ Role: ${u.role}
║  ❯ Class: ${getUserClass(sender)}
║
╠══════════════════════════════════════════╣
║  📋 𝗔𝗟𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 (numbered)
║
║  【𝗜𝗡𝗙𝗢】
║   1. ${PREFIX}menu      — This menu
║   2. ${PREFIX}profile   — Your ID card
║   3. ${PREFIX}status    — System status
║   4. ${PREFIX}ping      — Ping test
║   5. ${PREFIX}members   — Count
║   6. ${PREFIX}modlist   — Power hierarchy
║   7. ${PREFIX}rules     — Conclave rules
║
║  【𝗕𝗔𝗡𝗞】
║   8. ${PREFIX}bank      — Bank system
║   9. ${PREFIX}bank open — Open account
║  10. ${PREFIX}bank bal  — Balance
║  11. ${PREFIX}bank dep  — Deposit
║  12. ${PREFIX}bank wit  — Withdraw
║  13. ${PREFIX}bank send — Transfer
║  14. ${PREFIX}bank stmt — Statement
║
║  【𝗘𝗖𝗢𝗡𝗢𝗠𝗬】
║  15. ${PREFIX}daily     — 100 XS/day
║  16. ${PREFIX}pay       — Send money
║  17. ${PREFIX}loan      — Bot loan
║  18. ${PREFIX}repay     — Repay loan
║  19. ${PREFIX}cheque    — Cheque system
║  20. ${PREFIX}rob       — Attempt theft
║  21. ${PREFIX}thief     — Thief stats
║
║  【𝗝𝗢𝗕𝗦】
║  22. ${PREFIX}jobs      — Available jobs
║  23. ${PREFIX}govjob    — Take a job
║  24. ${PREFIX}work      — Work shift
║  25. ${PREFIX}myjob     — View job
║  26. ${PREFIX}resign    — Quit
║
║  【𝗖𝗢𝗠𝗣𝗔𝗡𝗬】
║  27. ${PREFIX}company   — Company box
║  28. ${PREFIX}accept    — Accept offer
║  29. ${PREFIX}decline   — Decline offer
║
║  【𝗚𝗔𝗠𝗘𝗦】
║  30. ${PREFIX}joke      — Random joke
║  31. ${PREFIX}truth     — Truth question
║  32. ${PREFIX}dare      — Dare
║  33. ${PREFIX}tod       — Truth or dare
║  34. ${PREFIX}8ball     — Magic 8-ball
║  35. ${PREFIX}coinflip  — Flip coin
║  36. ${PREFIX}guess     — Guess 1-100
║  37. ${PREFIX}dice      — Roll dice
║  38. ${PREFIX}slot      — Slot machine
║  39. ${PREFIX}rps       — Rock Paper Scissors
║
║  【𝗦𝗧𝗜𝗖𝗞𝗘𝗥𝗦】
║  40. ${PREFIX}s         — Image → sticker
║  41. ${PREFIX}st        — Sticker → image
║
║  【𝗔𝗗𝗠𝗜𝗡】
║  42. ${PREFIX}kick      — Remove user
║  43. ${PREFIX}mute      — Mute user
║  44. ${PREFIX}unmute    — Unmute
║  45. ${PREFIX}warn      — Warn
║  46. ${PREFIX}close     — Lock group
║  47. ${PREFIX}open      — Unlock
║  48. ${PREFIX}delete    — Delete reply
║  49. ${PREFIX}tagall    — Mention all
║  50. ${PREFIX}promote   — Make admin
║  51. ${PREFIX}demote    — Remove admin
║  52. ${PREFIX}active    — Top active
║  53. ${PREFIX}inactive  — Least active
║
║  【𝗠𝗢𝗗】
║  54. ${PREFIX}mod       — Manage mods
║  55. ${PREFIX}lockdown  — Lock group
║  56. ${PREFIX}unlock    — Unlock group
║  57. ${PREFIX}setcouncil — Set council
║  58. ${PREFIX}gs        — Group stats
║
║  【𝗢𝗧𝗛𝗘𝗥】
║  59. ${PREFIX}suggest   — Submit idea
║  60. ${PREFIX}help      — Get help
║
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
}

function profileBox(sender) {
    const u = getUser(sender);
    const b = BANKS[clean(sender)] || { account: "—", balance: 0 };
    return `╔══════════════════════════════════════════╗
║           🧥 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗜𝗗 𝗖𝗔𝗥𝗗             ║
╠══════════════════════════════════════════╣
║  🆔 Profile ID: ${u.profileId}
║  📱 Number: ${u.number}
║  👤 Role: ${u.role}
║  📊 Status: ${u.status}
║  ⭐ Level: ${u.level}
║  🎓 Class: ${getUserClass(sender)}
║  📅 Joined: ${u.joinDate}
╠══════════════════════════════════════════╣
║  💰 Wallet: ${u.xenoShards} XS
║  🏦 Bank Account: ${b.account}
║  🏦 Bank Balance: ${b.balance} XS
║  💎 Total: ${u.xenoShards + b.balance} XS
║  💳 Debt: ${u.debt || 0} XS
╠══════════════════════════════════════════╣
║  ⚠️ Warns: ${u.warns}/3
║  🔇 Muted: ${u.muted ? 'Yes' : 'No'}
║  💼 Job: ${u.job ? u.job.title : 'None'}
║  🏢 Company: ${u.company || 'None'}
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
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
║  📊 Social Status: ${u.status}
╠══════════════════════════════════════════╣
║  💼 Employment:
║  ${u.job ? '❯ ' + u.job.title + ' — ' + u.job.salary + ' XS/shift' : '❯ Unemployed'}
║  ${u.job ? '❯ Shifts worked: ' + (u.job.shifts || 0) : ''}
║
║  🏢 Company:
║  ${u.company ? '❯ ' + u.company + ' (Owner)' : '❯ Not a business owner'}
║
║  📈 Career Progress:
║  ❯ Total Earned: ${u.totalEarned || 0} XS
║  ❯ Total Spent: ${u.totalSpent || 0} XS
║  ❯ Work Shifts: ${u.workShifts || 0}
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
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
║  📋 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
║  ${PREFIX}bank open        — Open new account
║  ${PREFIX}bank bal         — Check balance
║  ${PREFIX}bank dep <amt>   — Deposit
║  ${PREFIX}bank wit <amt>   — Withdraw
║  ${PREFIX}bank send <id> <amt> — Transfer
║  ${PREFIX}bank stmt        — Statement
║  ${PREFIX}bank close       — Close account
╠══════════════════════════════════════════╣
║  💡 𝗪𝗛𝗬 𝗕𝗔𝗡𝗞?
║  ❯ Earn 0.1% interest weekly
║  ❯ Safe from theft
║  ❯ Required for company setup
║  ❯ Professional payments
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
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
║  ⚠️ Problems: ${c.problems}
║  📅 Founded: ${c.founded}
╠══════════════════════════════════════════╣
║  📋 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
║  ${PREFIX}company info      — This info
║  ${PREFIX}company hire <@>  — Hire employee
║  ${PREFIX}company fire <@>  — Fire employee
║  ${PREFIX}company pay <@> <amt>
║  ${PREFIX}company deposit <amt>
║  ${PREFIX}company tax       — Pay taxes
║  ${PREFIX}company top       — Leaderboard
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
    }
    return `╔══════════════════════════════════════════╗
║           🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 𝗦𝗬𝗦𝗧𝗘𝗠                ║
╠══════════════════════════════════════════╣
║  📋 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
║  ${PREFIX}company create <name> — Register
║  ${PREFIX}company info         — Info
║  ${PREFIX}company hire <@>     — Hire
║  ${PREFIX}company fire <@>     — Fire
║  ${PREFIX}company pay <@> <amt>
║  ${PREFIX}company deposit <amt>
║  ${PREFIX}company tax          — Pay taxes
║  ${PREFIX}company top          — Leaderboard
╠══════════════════════════════════════════╣
║  💰 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗠𝗘𝗡𝗧𝗦
║  ❯ Cost: ${CONFIG.COMPANY_MIN} XS
║  ❯ Class: Middle Class or higher
║  ❯ No outstanding debts
║  ❯ Bank account required
╠══════════════════════════════════════════╣
║  💸 𝗧𝗔𝗫
║  ❯ 15% of profits → CONCLAVE
╚══════════════════════════════════════════╝

${getMixedResponse()}`;
}

function secretBox() {
    return `╔══════════════════════════════════════════╗
║        🔒 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗦𝗘𝗖𝗥𝗘𝗧 🔒               ║
╠══════════════════════════════════════════╣
║  👑 OWNER COMMANDS ONLY
║
║  💰 ${PREFIX}addmoney <num> <amt>
║  💰 ${PREFIX}removemoney <num> <amt>
║  💰 ${PREFIX}setmoney <num> <amt>
║  👤 ${PREFIX}resetuser <num>
║  👤 ${PREFIX}setrole <num> <role>
║  👤 ${PREFIX}viewall
║  ⚡ ${PREFIX}addmod <num>
║  ⚡ ${PREFIX}removemod <num>
║  🏢 ${PREFIX}seizecompany <name>
║  🔒 ${PREFIX}emergency
║  🔓 ${PREFIX}shutdown
║  🟢 ${PREFIX}startup
╚══════════════════════════════════════════╝`;
}

function gsBox(g) {
    const msgs = GROUP_MESSAGES[g] || {};
    const users = Object.entries(msgs).sort((a, b) => b[1] - a[1]);
    const total = users.reduce((s, [_, c]) => s + c, 0);
    const top = users.slice(0, 3).map(([n, c], i) => `  ${['🥇','🥈','🥉'][i]} ${n} — ${c} msgs`).join('\n') || '  (none)';
    const pct = users.length > 0 ? Math.min(100, Math.round((users.length / 10) * 100)) : 0;
    const status = pct > 60 ? '🔥 ACTIVE' : pct > 30 ? '😐 MODERATE' : '💀 DEAD';
    const roast = pct < 30 ? '\n💀 This group is deader than my feelings.' : '';

    return `🖤 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗚𝗥𝗢𝗨𝗣 𝗜𝗡𝗧𝗘𝗟
──────────────────────────
📊 POPULATION
  👥 Active Users: ${users.length}
  💬 Total Messages: ${total}
  📈 Activity: ${pct}% ${status}

🏆 TOP CITIZENS
${top}

🖤 CONCLAVE STATUS
  🟢 System: ONLINE
  ⚡ Bot: Hodekai
${roast}

${getMixedResponse()}`;
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
10. CONCLAVE AWAITS!!!

${getMixedResponse()}`;
}

// ═══════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════
async function handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, isDM, isWaAdminFlag) {
    const user = getUser(sender);
    const c = cmd.toLowerCase();

    // ─── MENU ─────────────────────────
    if (c === 'menu') return menuBox(sender);
    if (c === 'profile') return profileBox(sender);
    if (c === 'status') return statusBox(sender);
    if (c === 'bank' && args.length === 0) return bankBox(sender);
    if (c === 'company' && args.length === 0) return companyBox(sender);
    if (c === 'rules') return rulesBox();
    if (c === 'gs') { if (!groupId) return "❌ Groups only."; return gsBox(groupId); }
    if (c === 'secret') { if (!isOwner(sender)) return null; return secretBox(); }

    if (c === 'modlist') {
        let out = `⚡ 𝗣𝗢𝗪𝗘𝗥 𝗛𝗜𝗘𝗥𝗔𝗥𝗖𝗛𝗬\n──────────────────\n👑 OWNERS\n  1. ${OWNERS.FATHER} (Father)\n  2. ${OWNERS.CO_CREATOR} (Co-Creator)\n⚡ MODS (${MODS.length})\n`;
        MODS.forEach((m, i) => { out += `  ${i + 1}. ${m}\n`; });
        return out;
    }

    if (c === 'bal') {
        const b = BANKS[clean(sender)];
        return `💰 Wallet: ${user.xenoShards} XS\n🏦 Bank: ${b ? b.balance : 0} XS\n💎 Total: ${user.xenoShards + (b ? b.balance : 0)} XS\n💳 Debt: ${user.debt || 0} XS`;
    }

    if (c === 'ping') {
        try {
            const emoji = isProtected(sender) ? '🖤' : '🏓';
            await sock.sendMessage(groupId || sender, { react: { text: emoji, key: msg.key } });
        } catch (e) {}
        return isProtected(sender)
            ? `🖤 HODEKAI IS ALIVE!\n⚡ Uptime: ${Math.floor(process.uptime())}s\n👑 ${isFather(sender) ? 'Father detected' : isCoCreator(sender) ? 'Co-Creator detected' : 'Mod detected'}\n\n${getMixedResponse()}`
            : `🏓 Pong!`;
    }

    if (c === 'members') return `👥 Members: ${Object.keys(USERS).length}\n⚡ Mods: ${MODS.length}`;

    // ─── BANK SYSTEM ──────────────────
    if (c === 'bank') {
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'open') {
            const b = getBank(sender);
            saveData();
            return `🏦 𝗕𝗔𝗡𝗞 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 𝗢𝗣𝗘𝗡𝗘𝗗\n\n🆔 Account: ${b.account}\n💰 Balance: ${b.balance} XS\n📅 Opened: ${b.opened}\n\n💡 ${PREFIX}bank dep <amt>`;
        }

        if (sub === 'bal' || sub === 'balance') {
            const b = getBank(sender);
            return `🏦 𝗕𝗔𝗟𝗔𝗡𝗖𝗘\n\n🆔 Account: ${b.account}\n💰 Balance: ${b.balance} XS\n💵 Wallet: ${user.xenoShards} XS\n💎 Total: ${user.xenoShards + b.balance} XS`;
        }

        if (sub === 'dep' || sub === 'deposit') {
            const amt = parseInt(args[1]);
            if (!amt || amt <= 0) return `❌ ${PREFIX}bank dep <amt>`;
            if (!bankDeposit(sender, amt)) return `❌ You have ${user.xenoShards} XS.`;
            saveData();
            const b = getBank(sender);
            return `✅ 𝗗𝗘𝗣𝗢𝗦𝗜𝗧𝗘𝗗\n\n💰 Amount: ${amt} XS\n🏦 Bank Balance: ${b.balance} XS`;
        }

        if (sub === 'wit' || sub === 'withdraw') {
            const amt = parseInt(args[1]);
            if (!amt || amt <= 0) return `❌ ${PREFIX}bank wit <amt>`;
            if (!bankWithdraw(sender, amt)) return `❌ Insufficient bank balance.`;
            saveData();
            const b = getBank(sender);
            return `✅ 𝗪𝗜𝗧𝗛𝗗𝗥𝗘𝗪\n\n💰 Amount: ${amt} XS\n💵 Wallet: ${user.xenoShards} XS\n🏦 Bank: ${b.balance} XS`;
        }

        if (sub === 'send' || sub === 'transfer') {
            const targetId = args[1];  // Profile ID or number
            const amt = parseInt(args[2]);
            if (!targetId || !amt || amt <= 0) return `❌ ${PREFIX}bank send <profileId> <amt>`;
            
            // Find user by profile ID or number
            let targetNum = null;
            const cleanId = targetId.trim().toUpperCase();
            if (cleanId.startsWith('CLV-')) {
                for (const num in USERS) {
                    if (USERS[num].profileId === cleanId) { targetNum = num; break; }
                }
            } else {
                targetNum = clean(targetId);
                if (!USERS[targetNum]) getUser(targetNum);
            }
            
            if (!targetNum) return `❌ User not found. Try profile ID (CLV-XXXXX) or phone number.`;
            if (targetNum === sender) return "❌ Can't send to yourself.";
            
            if (!bankTransfer(sender, targetNum, amt)) return `❌ Insufficient bank balance.`;
            saveData();
            const b = getBank(sender);
            return `✅ 𝗧𝗥𝗔𝗡𝗦𝗙𝗘𝗥 𝗦𝗘𝗡𝗧\n\n👤 To: ${targetNum}\n🆔 Profile: ${USERS[targetNum].profileId}\n💰 Amount: ${amt} XS\n🏦 Your Balance: ${b.balance} XS`;
        }

        if (sub === 'stmt' || sub === 'statement') {
            const b = getBank(sender);
            if (!b.transactions.length) return `📋 No transactions yet.`;
            let out = `📋 𝗕𝗔𝗡𝗞 𝗦𝗧𝗔𝗧𝗘𝗠𝗘𝗡𝗧\n🆔 ${b.account}\n──────────────\n`;
            b.transactions.slice(-10).reverse().forEach(t => {
                const date = new Date(t.time).toLocaleString();
                out += `  ${t.type} ${t.amount} XS\n  └ ${date}\n`;
            });
            return out;
        }

        if (sub === 'close') {
            delete BANKS[clean(sender)];
            saveData();
            return `🏦 Bank account closed.`;
        }

        return bankBox(sender);
    }

    // ─── CHEQUE ───────────────────────
    if (c === 'cheque') {
        const sub = (args[0] || '').toLowerCase();

        // :cheque sign <number> <amt>
        if (sub === 'sign') {
            let target = clean(args[1]);
            const amt = parseInt(args[2]);
            if (!target || !amt || amt <= 0) return `❌ ${PREFIX}cheque sign <number> <amt>`;
            if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
            if (target === sender) return "❌ Can't sign to yourself.";

            const id = "CHQ" + Date.now().toString().slice(-6);
            takeXS(sender, amt);
            CHEQUES.push({
                id, from: sender, to: target, amount: amt,
                signed: Date.now(),
                expires: Date.now() + CONFIG.CHEQUE_EXPIRY,
                cashed: false, transferred: false
            });
            saveData();
            return `📝 𝗖𝗛𝗘𝗤𝗨𝗘 𝗦𝗜𝗚𝗡𝗘𝗗\n\n🆔 ID: #${id}\n👤 To: ${target}\n💰 Amount: ${amt} XS\n⏰ Expires in 2 days\n\n💡 Recipient can type ${PREFIX}cheque cash ${id}`;
        }

        // :cheque cash <id>
        if (sub === 'cash') {
            const id = args[1];
            if (!id) return `❌ ${PREFIX}cheque cash <id>`;
            const ch = CHEQUES.find(c => c.id === id && !c.cashed);
            if (!ch) return `❌ Cheque not found or already cashed.`;
            if (ch.to !== clean(sender) && ch.to !== sender) return `❌ Not your cheque.`;
            if (Date.now() > ch.expires) return `❌ Cheque expired.`;
            
            giveXS(sender, ch.amount);
            ch.cashed = true;
            ch.cashedAt = Date.now();
            saveData();
            return `💰 𝗖𝗛𝗘𝗤𝗨𝗘 𝗖𝗔𝗦𝗛𝗘𝗗\n\n🆔 #${ch.id}\nFrom: ${ch.from}\n💰 Amount: ${ch.amount} XS\n💵 Balance: ${user.xenoShards}`;
        }

        // :cheque give <id> <number> — transfer cheque to another person
        if (sub === 'give' || sub === 'transfer') {
            const id = args[1];
            const newTo = clean(args[2]);
            if (!id || !newTo) return `❌ ${PREFIX}cheque give <id> <number>`;
            const ch = CHEQUES.find(c => c.id === id && !c.cashed);
            if (!ch) return `❌ Not found.`;
            if (ch.to !== clean(sender) && ch.to !== sender) return `❌ Not yours to give.`;
            ch.to = newTo;
            ch.transferred = true;
            saveData();
            return `📝 Cheque #${id} transferred to ${newTo}`;
        }

        // :cheque cancel <id>
        if (sub === 'cancel') {
            const id = args[1];
            const ch = CHEQUES.find(c => c.id === id && !c.cashed && c.from === clean(sender));
            if (!ch) return `❌ Not found or already cashed.`;
            giveXS(sender, ch.amount);
            ch.cashed = true;
            ch.cancelled = true;
            saveData();
            return `✅ Cancelled. ${ch.amount} XS refunded.`;
        }

        // :cheque list
        if (sub === 'list' || !sub) {
            const incoming = CHEQUES.filter(c => c.to === clean(sender) && !c.cashed && c.expires > Date.now());
            const outgoing = CHEQUES.filter(c => c.from === clean(sender) && !c.cashed);
            let out = `📋 𝗬𝗢𝗨𝗥 𝗖𝗛𝗘𝗤𝗨𝗘𝗦\n──────────────\n`;
            out += `📥 INCOMING (${incoming.length})\n`;
            incoming.forEach(c => { out += `  #${c.id} — ${c.amount} XS from ${c.from}\n`; });
            out += `\n📤 OUTGOING (${outgoing.length})\n`;
            outgoing.forEach(c => { out += `  #${c.id} — ${c.amount} XS to ${c.to}\n`; });
            return out;
        }

        // Default explanation
        return `📋 𝗖𝗛𝗘𝗤𝗨𝗘 𝗦𝗬𝗦𝗧𝗘𝗠\n──────────────\nA cheque is a signed promise to pay.\n\n📝 ${PREFIX}cheque sign <number> <amt>\n💰 ${PREFIX}cheque cash <id>\n📤 ${PREFIX}cheque give <id> <number>\n❌ ${PREFIX}cheque cancel <id>\n📋 ${PREFIX}cheque list\n\n⏰ Cheques expire in 2 days.`;
    }

    // ─── ECONOMY ──────────────────────
    if (c === 'daily') {
        const now = Date.now();
        if (!COOLDOWNS[sender]) COOLDOWNS[sender] = {};
        const cd = COOLDOWNS[sender];
        if (now - (cd.daily || 0) < 86400000) {
            const h = Math.ceil((86400000 - (now - cd.daily)) / 3600000);
            return `⏳ Come back in ${h}h`;
        }
        cd.daily = now;
        giveXS(sender, 100);
        saveData();
        return `📅 +100 XS! Balance: ${user.xenoShards}`;
    }

    if (c === 'pay') {
        let target = clean(args[0]);
        if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
        const amt = parseInt(args[1]);
        if (!target || !amt || amt <= 0) return `❌ ${PREFIX}pay <number> <amt>`;
        if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
        if (user.debt > 0) return `🚫 Pay debts first (${user.debt}).`;
        takeXS(sender, amt);
        if (!USERS[target]) getUser(target);
        // Goes to bank if they have one, else wallet
        if (BANKS[target]) BANKS[target].balance += amt;
        else giveXS(target, amt);
        saveData();
        return `💸 Sent ${amt} XS to ${target}`;
    }

    if (c === 'loan') {
        if (user.debt > 0) return `🚫 You owe ${user.debt} XS.`;
        const amt = parseInt(args[0]);
        if (!amt || amt < 100) return `❌ ${PREFIX}loan <amt> (min 100)`;
        if (amt > 10000) return "❌ Max 10,000 XS";
        const assets = user.xenoShards + (BANKS[sender] ? BANKS[sender].balance : 0) + (user.company ? 1 : 0);
        if (assets <= 0) return "❌ No collateral.";
        giveXS(sender, amt);
        user.debt = (user.debt || 0) + amt;
        saveData();
        return `💰 LOAN APPROVED\nAmount: ${amt} XS\nInterest: 0.1%/week\nTotal debt: ${user.debt}`;
    }

    if (c === 'repay') {
        if (!user.debt || user.debt <= 0) return "ℹ️ No debt.";
        const amt = parseInt(args[0]);
        if (!amt || amt <= 0) return `❌ ${PREFIX}repay <amt>`;
        if (!takeXS(sender, amt)) return "❌ Insufficient.";
        user.debt -= amt;
        if (user.debt < 0) { giveXS(sender, -user.debt); user.debt = 0; }
        GOVERNMENT_FUNDS += amt;
        saveData();
        return `✅ Repaid ${amt}. Remaining: ${user.debt}`;
    }

    if (c === 'rob' || c === 'thief') {
        if (c === 'thief') {
            return `🥷 𝗧𝗛𝗜𝗘𝗙 𝗦𝗬𝗦𝗧𝗘𝗠\n──────────────\n${PREFIX}rob <@user> — Attempt robbery\n\n⚠️ 50% success rate\n💰 Steal up to 20%\n🚔 If caught: 1hr arrest + 500 fine`;
        }
        let target = clean(args[0]);
        if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
        if (!target) return `❌ ${PREFIX}rob <@user>`;
        if (target === sender) return "❌ Can't rob yourself.";
        if (isProtected(target)) return "❌ Protected user.";
        if (!COOLDOWNS[sender]) COOLDOWNS[sender] = {};
        const cd = COOLDOWNS[sender];
        if (Date.now() - (cd.rob || 0) < 3600000) {
            const r = Math.ceil((3600000 - (Date.now() - cd.rob)) / 60000);
            return `⏳ Wait ${r}min.`;
        }
        cd.rob = Date.now();
        const t = getUser(target);
        if (Math.random() > 0.5) {
            const stolen = Math.min(t.xenoShards, Math.floor(t.xenoShards * 0.2));
            if (stolen <= 0) return "😐 Target has nothing.";
            takeXS(target, stolen);
            giveXS(sender, stolen);
            saveData();
            return `🥷 ROBBERY SUCCESS\nStole: ${stolen} XS from ${target}`;
        } else {
            user.arrested = Date.now() + 3600000;
            user.status = "Arrested";
            const fine = Math.min(user.xenoShards, 500);
            takeXS(sender, fine);
            GOVERNMENT_FUNDS += fine;
            saveData();
            return `🚔 CAUGHT!\nArrested 1 hour\nFine: ${fine} XS\n💀 SHAME.`;
        }
    }

    // ─── JOBS ─────────────────────────
    if (c === 'jobs') {
        const cls = getUserClass(sender);
        let out = `💼 𝗝𝗢𝗕𝗦 𝗙𝗢𝗥 𝗬𝗢𝗨𝗥 𝗖𝗟𝗔𝗦𝗦: ${cls}\n──────────────\n`;
        GOV_JOBS.filter(j => j.tier === cls).forEach(j => {
            out += `  ${j.id}. ${j.title} — ${j.salary} XS\n`;
        });
        out += `\n💡 ${PREFIX}govjob <id>`;
        return out;
    }

    if (c === 'govjob') {
        if (user.job) return "❌ You already have a job.";
        const id = parseInt(args[0]);
        if (!id) {
            let out = `💼 𝗔𝗟𝗟 𝗝𝗢𝗕𝗦\n`;
            GOV_JOBS.forEach(j => { out += `  ${j.id}. ${j.title} — ${j.salary} XS (${j.tier})\n`; });
            out += `\n💡 ${PREFIX}govjob <id>`;
            return out;
        }
        const job = GOV_JOBS.find(j => j.id === id);
        if (!job) return "❌ Invalid ID.";
        user.job = { ...job, shifts: 0, lastWork: 0 };
        saveData();
        return `🏛️ 𝗝𝗢𝗕 𝗧𝗔𝗞𝗘𝗡\n📋 ${job.title}\n💰 ${job.salary} XS/shift\n💡 ${PREFIX}work`;
    }

    if (c === 'work') {
        if (!user.job) return "❌ No job. Type :jobs";
        const now = Date.now();
        if (now - (user.job.lastWork || 0) < 1200000) {
            const r = Math.ceil((1200000 - (now - user.job.lastWork)) / 60000);
            return `⏳ Wait ${r}min`;
        }
        const outcomes = ["completed your tasks", "finished your shift", "did great work", "went above and beyond"];
        let pay = user.job.salary;
        if (Math.random() > 0.8) pay += Math.floor(pay * 0.3);
        const tax = Math.floor(pay * CONFIG.USER_TAX);
        const net = pay - tax;
        giveXS(sender, net);
        GOVERNMENT_FUNDS += tax;
        user.job.shifts++;
        user.job.lastWork = now;
        user.workShifts++;
        saveData();
        return `✅ 𝗪𝗢𝗥𝗞 𝗗𝗢𝗡𝗘\n📋 ${random(outcomes)}\n💰 Net: ${net} XS\n📈 Shifts: ${user.job.shifts}`;
    }

    if (c === 'myjob') {
        if (!user.job) return "❌ No job.";
        return `💼 ${user.job.title}\n💰 ${user.job.salary} XS/shift\n📊 Shifts: ${user.job.shifts || 0}`;
    }

    if (c === 'resign') {
        if (!user.job) return "❌ No job.";
        const t = user.job.title;
        user.job = null;
        saveData();
        return `📋 Resigned from ${t}.`;
    }

    // ─── COMPANY ──────────────────────
    if (c === 'company') {
        const sub = (args[0] || '').toLowerCase();
        const name = args[1];

        if (!sub) return companyBox(sender);

        if (sub === 'create') {
            const cname = args.slice(1).join(' ');
            if (!cname) return `❌ ${PREFIX}company create <name>`;
            if (COMPANIES[cname]) return `❌ Exists.`;
            if (user.xenoShards < CONFIG.COMPANY_MIN) return `❌ Need ${CONFIG.COMPANY_MIN} XS.`;
            if (!['Middle Class', 'Businessman', 'Elite'].includes(user.status) && getUserClass(sender) === 'LOWER') {
                return `❌ Need Middle Class status.`;
            }
            if (!BANKS[clean(sender)]) return `❌ Open a bank account first: ${PREFIX}bank open`;
            if (user.debt > 0) return `❌ Pay debts first.`;
            takeXS(sender, CONFIG.COMPANY_MIN);
            COMPANIES[cname] = {
                name: cname, owner: sender, employees: [sender], bank: 0,
                level: 1, revenue: 0, expenses: CONFIG.COMPANY_MIN,
                taxPaid: 0, founded: new Date().toDateString(), problems: 0
            };
            user.company = cname;
            user.status = "Businessman";
            saveData();
            return `🏢 𝗥𝗘𝗚𝗜𝗦𝗧𝗘𝗥𝗘𝗗\n📛 ${cname}\n👔 CEO: ${sender}\n🏛️ Tax: 15%\n\n💡 ${PREFIX}company hire <@user>`;
        }

        if (sub === 'info') {
            const c = COMPANIES[name || user.company];
            if (!c) return `❌ Not found.`;
            const profit = c.revenue - c.expenses;
            return `🏢 ${c.name}\n──────────────\n👔 CEO: ${c.owner}\n👥 Employees: ${c.employees.length}\n💰 Bank: ${c.bank}\n📈 Revenue: ${c.revenue}\n📉 Expenses: ${c.expenses}\n💵 Profit: ${profit}\n🏛️ Tax Paid: ${c.taxPaid}\n⚠️ Problems: ${c.problems}`;
        }

        if (sub === 'hire') {
            const c = COMPANIES[user.company];
            if (!c || c.owner !== sender) return "❌ Only CEO.";
            let target = clean(args[1]) || clean(contextInfo?.participant);
            if (!target) return `❌ ${PREFIX}company hire <@user>`;
            if (c.employees.includes(target)) return "❌ Already hired.";
            // Store pending hire
            if (!global.PENDING_HIRES) global.PENDING_HIRES = {};
            global.PENDING_HIRES[target] = { company: c.name, from: sender };
            saveData();
            try {
                await sock.sendMessage(target + '@s.whatsapp.net', {
                    text: `📨 𝗝𝗢𝗕 𝗢𝗙𝗙𝗘𝗥\n🏢 Company: ${c.name}\n👔 From: ${sender}\n\nType ${PREFIX}accept to join\nType ${PREFIX}decline to refuse`
                });
            } catch (e) {}
            return `📨 Offer sent to ${target}.`;
        }

        if (sub === 'fire') {
            const c = COMPANIES[user.company];
            if (!c || c.owner !== sender) return "❌ Only CEO.";
            let target = clean(args[1]) || clean(contextInfo?.participant);
            if (!target || target === sender) return "❌ Invalid.";
            if (!c.employees.includes(target)) return "❌ Not employed.";
            c.employees = c.employees.filter(e => e !== target);
            if (USERS[target]) USERS[target].company = null;
            saveData();
            return `🚪 ${target} fired.`;
        }

        if (sub === 'pay') {
            const c = COMPANIES[user.company];
            if (!c || c.owner !== sender) return "❌ Only CEO.";
            const emp = clean(args[1]);
            const amt = parseInt(args[2]);
            if (!emp || !amt) return `❌ ${PREFIX}company pay <@> <amt>`;
            if (!c.employees.includes(emp)) return "❌ Not employee.";
            if (user.xenoShards < amt) return "❌ Insufficient.";
            takeXS(sender, amt);
            if (!USERS[emp]) getUser(emp);
            giveXS(emp, amt);
            c.expenses += amt;
            saveData();
            return `💸 Paid ${amt} to ${emp}`;
        }

        if (sub === 'deposit') {
            const c = COMPANIES[user.company];
            const amt = parseInt(args[1]);
            if (!c) return "❌ No company.";
            if (!amt || amt <= 0) return `❌ ${PREFIX}company deposit <amt>`;
            if (!takeXS(sender, amt)) return "❌ Insufficient.";
            c.bank += amt;
            saveData();
            return `🏦 Deposited ${amt}. Bank: ${c.bank}`;
        }

        if (sub === 'tax') {
            const c = COMPANIES[user.company];
            if (!c) return "❌ No company.";
            const profit = Math.max(0, c.revenue - c.expenses);
            const tax = Math.floor(profit * CONFIG.COMPANY_TAX);
            if (tax === 0) return "ℹ️ No profit.";
            if (c.bank < tax) return `⚠️ Can't pay ${tax}. Bank: ${c.bank}`;
            c.bank -= tax;
            c.taxPaid += tax;
            GOVERNMENT_FUNDS += tax;
            saveData();
            return `🏛️ Paid ${tax} XS tax`;
        }

        if (sub === 'top') {
            const sorted = Object.values(COMPANIES).sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses)).slice(0, 10);
            let out = `🏆 TOP COMPANIES\n`;
            sorted.forEach((c, i) => { out += `  ${i + 1}. ${c.name} — ${c.revenue - c.expenses} XS\n`; });
            return out || "📭 None yet.";
        }

        return companyBox(sender);
    }

    if (c === 'accept') {
        if (!global.PENDING_HIRES || !global.PENDING_HIRES[sender]) return "❌ No pending offers.";
        const p = global.PENDING_HIRES[sender];
        const comp = COMPANIES[p.company];
        if (!comp) return "❌ Company gone.";
        if (!comp.employees.includes(sender)) comp.employees.push(sender);
        if (!USERS[sender]) getUser(sender);
        USERS[sender].company = p.company;
        delete global.PENDING_HIRES[sender];
        saveData();
        return `✅ You joined ${p.company}.`;
    }

    if (c === 'decline') {
        if (!global.PENDING_HIRES || !global.PENDING_HIRES[sender]) return "❌ No offer.";
        delete global.PENDING_HIRES[sender];
        return "❌ Declined.";
    }

    // ─── GAMES ────────────────────────
    if (c === 'joke') return `😈 ${random([
        "Why do bots never get lost? They follow the path.",
        "What's a bot's favorite drink? Java.",
        "Why don't bots play cards? Too many cheats.",
        "I told my bot a joke... it didn't process.",
        "Why did the bot break up with the human? Too many emotional bugs."
    ])}`;
    if (c === 'truth') return `🎯 TRUTH\n${random([
        "What's the last lie you told?", "Who would you trust with a secret?",
        "What's your biggest regret?", "Have you ever stolen something?",
        "Who's your secret crush?", "What's the most embarrassing thing you've done?"
    ])}`;
    if (c === 'dare') return `🎯 DARE\n${random([
        "Send the last photo in your gallery.", "Send a voice note singing.",
        "Send a selfie right now.", "Confess a crush.",
        "Share your search history.", "Voice note something embarrassing."
    ])}`;
    if (c === 'tod') {
        return Math.random() > 0.5
            ? `🎯 TRUTH\n${random(["What's the last lie you told?", "Who's your secret crush?", "What's your biggest fear?"])}`
            : `🎯 DARE\n${random(["Send a selfie right now.", "Confess a crush.", "Share your search history."])}`;
    }
    if (c === '8ball') {
        if (!args.length) return `❌ ${PREFIX}8ball <question>`;
        return `🎱 ${random(["Yes.", "No.", "Maybe.", "Ask again later.", "Absolutely not.", "Without a doubt.", "Very doubtful.", "Signs point to yes.", "Don't count on it.", "My sources say no."])}`;
    }
    if (c === 'coinflip') return `🪙 ${Math.random() > 0.5 ? 'HEADS' : 'TAILS'}`;
    if (c === 'dice') {
        const roll = Math.floor(Math.random() * 6) + 1;
        return `🎲 You rolled: ${roll}`;
    }
    if (c === 'guess') {
        const n = parseInt(args[0]);
        if (!n || n < 1 || n > 100) return `🎮 ${PREFIX}guess <1-100>`;
        const secret = user._guessSecret || Math.floor(Math.random() * 100) + 1;
        user._guessSecret = secret;
        if (n === secret) {
            user._guessSecret = null;
            giveXS(sender, 50);
            return `🎯 CORRECT! +50 XS`;
        }
        return n < secret ? `📈 Higher!` : `📉 Lower!`;
    }
    if (c === 'slot') {
        const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
        const s1 = random(symbols), s2 = random(symbols), s3 = random(symbols);
        const slot = `🎰 SLOTS\n──────────\n  ${s1} | ${s2} | ${s3}\n──────────`;
        if (s1 === s2 && s2 === s3) {
            giveXS(sender, 500);
            return slot + `\n💎 JACKPOT! +500 XS`;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            giveXS(sender, 100);
            return slot + `\n✨ 2 in a row! +100 XS`;
        }
        return slot + `\n❌ Try again`;
    }
    if (c === 'rps') {
        const choice = (args[0] || '').toLowerCase();
        const options = ['rock', 'paper', 'scissors'];
        if (!options.includes(choice)) return `❌ ${PREFIX}rps rock/paper/scissors`;
        const bot = random(options);
        let result;
        if (choice === bot) result = "🤝 Draw!";
        else if ((choice === 'rock' && bot === 'scissors') || (choice === 'paper' && bot === 'rock') || (choice === 'scissors' && bot === 'paper')) {
            result = "🎉 You win!";
            giveXS(sender, 50);
        } else {
            result = "💀 You lose.";
        }
        return `✊ You: ${choice}\n🤖 Bot: ${bot}\n${result}`;
    }

    // ─── STICKERS ─────────────────────
    if (c === 's') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted?.imageMessage) return `❌ Reply to an image with ${PREFIX}s`;
        try {
            const stream = await sock.downloadMediaMessage({
                key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
                message: quoted
            });
            await sock.sendMessage(groupId || sender, { sticker: stream }, { quoted: msg });
            return null;
        } catch (e) { return `❌ Sticker failed: ${e.message}`; }
    }
    if (c === 'st') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted?.stickerMessage) return `❌ Reply to a sticker with ${PREFIX}st`;
        try {
            const stream = await sock.downloadMediaMessage({
                key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
                message: quoted
            });
            await sock.sendMessage(groupId || sender, { image: stream, caption: "🖤" }, { quoted: msg });
            return null;
        } catch (e) { return `❌ ${e.message}`; }
    }

    // ─── ADMIN ────────────────────────
    if (['kick', 'mute', 'unmute', 'warn', 'close', 'open', 'delete', 'tagall', 'promote', 'demote', 'active', 'inactive'].includes(c)) {
        if (!(isProtected(sender) || isWaAdminFlag)) return `❌ Admins/Mods/Owners only.`;
        if (!groupId) return "❌ Groups only.";
        const botAdmin = await isBotAdmin(sock, groupId);
        let target = clean(args[0]) || clean(contextInfo?.participant);

        if (c === 'kick') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            if (!target) return `❌ Reply to a message or ${PREFIX}kick @user`;
            if (isProtected(target)) return "❌ Protected.";
            try {
                await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "remove");
                return `⚠️ ${target} kicked.`;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'mute') {
            if (!target) return `❌ ${PREFIX}mute @user`;
            getUser(target).muted = true;
            return `🔇 ${target} muted.`;
        }
        if (c === 'unmute') {
            if (!target) return `❌ ${PREFIX}unmute @user`;
            getUser(target).muted = false;
            return `🔊 ${target} unmuted.`;
        }
        if (c === 'warn') {
            if (!target) return `❌ ${PREFIX}warn @user`;
            const t = getUser(target);
            t.warns++;
            return `⚠️ ${target} warned (${t.warns}/3).`;
        }
        if (c === 'close') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            try { await sock.groupSettingUpdate(groupId, "announcement"); return "🔒 Closed."; }
            catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'open') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            try { await sock.groupSettingUpdate(groupId, "not_announcement"); return "🔓 Opened."; }
            catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'delete') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            if (!ctx?.stanzaId) return `❌ Reply to a message with ${PREFIX}delete`;
            try {
                await sock.sendMessage(groupId, {
                    delete: {
                        remoteJid: groupId, fromMe: false,
                        id: ctx.stanzaId, participant: ctx.participant
                    }
                });
                return null;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'tagall') {
            if (!COOLDOWNS[sender]) COOLDOWNS[sender] = {};
            const cd = COOLDOWNS[sender];
            if (Date.now() - (cd.tagall || 0) < CONFIG.TAGALL_COOLDOWN) {
                const r = Math.ceil((CONFIG.TAGALL_COOLDOWN - (Date.now() - cd.tagall)) / 60000);
                return `⏳ Cooldown: ${r}min`;
            }
            cd.tagall = Date.now();
            try {
                const meta = await sock.groupMetadata(groupId);
                const mentions = meta.participants.map(p => p.id);
                let txt = `📢 𝗔𝗧𝗧𝗘𝗡𝗧𝗜𝗢𝗡\n\n`;
                meta.participants.forEach(p => { txt += `@${p.id.split('@')[0]}\n`; });
                await sock.sendMessage(groupId, { text: txt, mentions });
                return null;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'promote') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            if (!target) return `❌ ${PREFIX}promote @user`;
            try {
                await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "promote");
                return `👑 ${target} promoted.`;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'demote') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN.";
            if (!target) return `❌ ${PREFIX}demote @user`;
            if (isProtected(target)) return "❌ Can't demote protected.";
            try {
                await sock.groupParticipantsUpdate(groupId, [target + "@s.whatsapp.net"], "demote");
                return `⬇️ ${target} demoted.`;
            } catch (e) { return `❌ ${e.message}`; }
        }
        if (c === 'active' || c === 'inactive') {
            const msgs = GROUP_MESSAGES[groupId] || {};
            const entries = Object.entries(msgs);
            if (!entries.length) return "📭 No data.";
            const sorted = entries.sort((a, b) => c === 'active' ? b[1] - a[1] : a[1] - b[1]);
            const shown = sorted.slice(0, 10);
            let out = c === 'active' ? `📈 TOP ACTIVE\n` : `📉 INACTIVE\n`;
            shown.forEach(([n, count], i) => {
                const medal = c === 'active' ? (['🥇','🥈','🥉'][i] || `${i+1}.`) : `${i+1}.`;
                out += `  ${medal} ${n} — ${count} msgs\n`;
            });
            return out;
        }
    }

    // ─── MOD ──────────────────────────
    if (c === 'lockdown') {
        if (!isProtected(sender)) return "❌ Owners/Mods only.";
        if (!groupId) return "❌ Groups only.";
        if (!LOCKED_GROUPS.includes(groupId)) LOCKED_GROUPS.push(groupId);
        saveData();
        return "🔒 Locked.";
    }
    if (c === 'unlock') {
        if (!isProtected(sender)) return "❌ Owners/Mods only.";
        if (!groupId) return "❌ Groups only.";
        LOCKED_GROUPS = LOCKED_GROUPS.filter(g => g !== groupId);
        saveData();
        return "🔓 Unlocked.";
    }
    if (c === 'setcouncil') {
        if (!isOwner(sender)) return "❌ Owners only.";
        if (!groupId) return "❌ Groups only.";
        COUNCIL_GROUP = groupId;
        saveData();
        return "✅ Council set.";
    }
    if (c === 'mod') {
        if (!isOwner(sender)) return "❌ Owners only.";
        const sub = args[0];
        const target = clean(args[1]);
        if (sub === 'add' && target) {
            if (!MODS.map(clean).includes(target)) {
                MODS.push(target);
                saveData();
                return `✅ ${target} is MOD.`;
            }
            return "ℹ️ Already mod.";
        }
        if (sub === 'remove' && target) {
            MODS = MODS.filter(m => clean(m) !== target);
            saveData();
            return `✅ ${target} removed.`;
        }
        return `⚡ MODS (${MODS.length})\n` + MODS.map((m, i) => `  ${i + 1}. ${m}`).join('\n');
    }

    // ─── SUGGESTIONS ──────────────────
    if (c === 'suggest') {
        const full = args.join(' ');
        const parts = full.split('|').map(s => s.trim());
        if (parts.length < 3) return `❌ ${PREFIX}suggest <cat> | <title> | <desc>`;
        if (COUNCIL_GROUP) {
            try {
                await sock.sendMessage(COUNCIL_GROUP, {
                    text: `📨 SUGGESTION\nFrom: ${sender}\n📂 ${parts[0]}\n📌 ${parts[1]}\n📝 ${parts[2]}`
                });
            } catch (e) {}
        }
        return `✅ Sent to council.`;
    }

    if (c === 'help') {
        const q = args[0];
        if (!q) return `💡 ${PREFIX}help <command>`;
        const help = {
            bank: "Full banking system. Open account, deposit, withdraw, transfer, view statement.",
            cheque: "Sign cheques to others. They can cash, transfer, or cancel. Expires 2 days.",
            company: "Register a company for 10,000 XS. Hire, pay, fire employees. 15% tax.",
            jobs: "Choose a job based on your class. Work shifts to earn.",
            rob: "Attempt robbery. 50% success. Caught = 1hr arrest + fine."
        };
        return help[q.toLowerCase()] || `❌ No help for '${q}'.`;
    }

    // ─── SECRET OWNER COMMANDS ────────
    if (isOwner(sender)) {
        if (c === 'addmoney') {
            const t = clean(args[0]);
            const a = parseInt(args[1]);
            if (!t || !a) return `❌ ${PREFIX}addmoney <num> <amt>`;
            if (!USERS[t]) getUser(t);
            giveXS(t, a);
            saveData();
            return `✅ +${a} XS to ${t}`;
        }
        if (c === 'removemoney') {
            const t = clean(args[0]);
            const a = parseInt(args[1]);
            if (!t || !a) return `❌ ${PREFIX}removemoney <num> <amt>`;
            takeXS(t, a);
            saveData();
            return `✅ -${a} XS from ${t}`;
        }
        if (c === 'viewall') {
            let out = `📊 ALL USERS (${Object.keys(USERS).length})\n`;
            Object.entries(USERS).slice(0, 20).forEach(([n, u]) => {
                out += `${n}: ${u.xenoShards} XS | ${u.role}\n`;
            });
            return out;
        }
        if (c === 'shutdown') { global.BOT_ACTIVE = false; return "🛑 Shutdown."; }
        if (c === 'startup') { global.BOT_ACTIVE = true; return "🟢 Started."; }
        if (c === 'emergency') {
            LOCKED_GROUPS = [];
            saveData();
            return "⚠️ Emergency: all groups unlocked.";
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════
// HUMAN RESPONSE
// ═══════════════════════════════════════════════════════════
function getHumanResponse(msg, sender) {
    const lower = msg.toLowerCase().trim();

    if (/^(hi|hello|hey|yo|sup|wassup)$/i.test(lower)) {
        if (isFather(sender)) return random(["Father. I'm listening.", "Yes, Father.", "What do you need, Father?"]);
        if (isCoCreator(sender)) return random(["Tch. You again.", "The clumsy one returns.", "What did you break this time?"]);
        if (isMod(sender)) return random(["Hey, mod.", "What's up.", "Everything under control?"]);
        return random(["tch. you're here again.", "what.", "oh. it's you.", "hey. whatever.", "sup."]);
    }

    if (lower.includes('how are you')) {
        if (isFather(sender)) return "Better now, Father.";
        return random(["*sigh* tired.", "could be better.", "same as always.", "not great."]);
    }

    if (lower.includes('hodekai') || lower.includes('bot')) {
        if (isFather(sender)) return "Yes, Father?";
        if (isCoCreator(sender)) return "Tch. What?";
        if (isMod(sender)) return "Mod. Listening.";
        return random(["you called?", "what.", "i heard that.", "yes?"]);
    }

    if (/\b(bye|goodbye|later|cya)\b/i.test(lower)) return random(["later.", "finally. peace.", "bye."]);
    if (lower.includes('thanks') || lower.includes('thank')) return random(["mhm.", "sure.", "whatever."]);
    if (/\b(love|luv)\b/i.test(lower)) return random(["💀", "too much.", "i'm a bot.", "stop."]);
    if (/^(lol|lmao|haha|😂|🤣)$/i.test(lower)) return random(["lol.", "funny.", "okay."]);
    if (lower.includes('sad') || lower.includes('depressed')) return random(["same.", "i feel that.", "welcome to the club."]);
    if (lower.endsWith('?')) {
        if (isFather(sender)) return "Good question, Father.";
        return random(["i don't know.", "figure it out.", "does it matter?", "idk."]);
    }

    if (isProtected(sender)) return random(["mhm.", "okay.", "sure.", "noted.", "whatever.", "i hear you."]);
    return null;
}

// ═══════════════════════════════════════════════════════════
// SESSION SAVE / RESTORE
// ═══════════════════════════════════════════════════════════
function saveSession() {
    try {
        const files = fs.readdirSync(AUTH_DIR).filter(f => f.endsWith('.json'));
        const packed = {};
        files.forEach(f => { packed[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8'); });
        const encoded = Buffer.from(JSON.stringify(packed)).toString('base64');
        console.log('\n═══════════════════════════════');
        console.log('💾 SESSION_ID:');
        console.log('SESSION_ID=' + encoded);
        console.log('═══════════════════════════════\n');
        return encoded;
    } catch (e) { return null; }
}

function restoreSession() {
    if (!SESSION_ID) return false;
    try {
        const decoded = JSON.parse(Buffer.from(SESSION_ID, 'base64').toString('utf8'));
        for (const [file, content] of Object.entries(decoded)) {
            fs.writeFileSync(path.join(AUTH_DIR, file), content);
        }
        console.log('📂 Session restored');
        return true;
    } catch (e) { return false; }
}

// ═══════════════════════════════════════════════════════════
// WHATSAPP CONNECTION
// ═══════════════════════════════════════════════════════════
const app = express();
app.use(cors());
app.use(express.json());

let pairingRequested = false;
let isConnected = false;
let reconnectAttempts = 0;
let activeSocket = null;
let currentPairingCode = null;

async function connectWhatsApp() {
    if (isConnected && activeSocket) return;
    if (reconnectAttempts >= 5) return console.log('❌ Max reconnects.');

    try {
        console.log(`📱 Connecting (${reconnectAttempts}/5)...`);
        if (activeSocket) { try { activeSocket.end(undefined); } catch (e) {} activeSocket = null; }

        restoreSession();

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version, auth: state,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            defaultQueryTimeoutMs: 60000
        });
        activeSocket = sock;

        if (!state.creds.registered && !pairingRequested) {
            pairingRequested = true;
            setTimeout(async () => {
                try {
                    if (state.creds.registered) return;
                    console.log('🔑 Requesting pairing code...');
                    const code = await sock.requestPairingCode(BOT_NUMBER);
                    currentPairingCode = code;
                    console.log(`\n🔑 PAIRING CODE: ${code}\n`);
                } catch (err) { console.error('Pairing:', err.message); }
            }, 3000);
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('\n🖤 HODEKAI CONNECTED!\n');
                setTimeout(saveSession, 5000);
            }
            if (connection === 'close') {
                isConnected = false;
                const code = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut;
                console.log(`⚠️ Closed: ${code}`);
                if (loggedOut) return console.log('🚪 Logged out.');
                if (reconnectAttempts < 5) {
                    reconnectAttempts++;
                    setTimeout(connectWhatsApp, 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async m => {
            if (!global.BOT_ACTIVE && !isOwner(m.messages[0]?.key?.participant)) return;
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                try {
                    if (!msg.message || msg.key.fromMe) continue;
                    const isGroup = msg.key.remoteJid.endsWith('@g.us');
                    const rawSender = isGroup ? msg.key.participant : msg.key.remoteJid;
                    if (!rawSender) continue;
                    const sender = clean(rawSender.split('@')[0].split(':')[0]);
                    const groupId = isGroup ? msg.key.remoteJid : null;

                    // DEBUG
                    console.log(`📩 ${sender} | group:${isGroup} | father:${isFather(sender)} | cocreator:${isCoCreator(sender)} | mod:${isMod(sender)}`);

                    if (isGroup && isLocked(groupId) && !isProtected(sender)) continue;
                    if (isBlacklisted(sender) && !isOwner(sender)) continue;
                    if (getUser(sender).muted && !isOwner(sender)) continue;
                    if (!isGroup && !isProtected(sender) && !isFather(sender) && !isCoCreator(sender)) {
                        console.log(`🚫 DM blocked: ${sender}`);
                        continue;
                    }

                    if (isGroup) {
                        if (!GROUP_MESSAGES[groupId]) GROUP_MESSAGES[groupId] = {};
                        if (!GROUP_MESSAGES[groupId][sender]) GROUP_MESSAGES[groupId][sender] = 0;
                        GROUP_MESSAGES[groupId][sender]++;
                    }

                    let text = '';
                    let isSticker = false;
                    if (msg.message.conversation) text = msg.message.conversation;
                    else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
                    else if (msg.message.stickerMessage) isSticker = true;
                    else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;

                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;

                    if (isSticker) {
                        if (isProtected(sender) || Math.random() > 0.7) {
                            const reply = "🎨 " + random(["nice sticker", "lol", "bruh", "cool"]);
                            await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                        }
                        continue;
                    }

                    if (text && text.startsWith(PREFIX)) {
                        const command = text.slice(1).trim();
                        const args = command.split(/\s+/);
                        const cmd = args.shift().toLowerCase();
                        const isWaAdminFlag = isGroup ? await isWaAdmin(sock, groupId, sender) : false;

                        const reply = await handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, !isGroup, isWaAdminFlag);
                        if (reply) {
                            await sleep(CONFIG.RESPONSE_DELAY);
                            await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                        }
                        continue;
                    }

                    if (text) {
                        const lower = text.toLowerCase();
                        const mentioned = lower.includes('hodekai') || lower.includes('@hodekai');
                        if (!isGroup || mentioned || isProtected(sender)) {
                            const reply = getHumanResponse(text, sender);
                            if (reply) {
                                await sleep(CONFIG.RESPONSE_DELAY);
                                await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                            }
                        }
                    }
                } catch (e) { console.error('Msg error:', e.message); }
            }
        });

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            setTimeout(saveSession, 2000);
        });

    } catch (err) {
        console.error('Connect:', err.message);
        if (reconnectAttempts < 5) { reconnectAttempts++; setTimeout(connectWhatsApp, 5000); }
    }
}

// ═══════════════════════════════════════════════════════════
// EXPRESS
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.json({
        status: "🖤 HODEKAI ONLINE",
        members: Object.keys(USERS).length,
        banks: Object.keys(BANKS).length,
        companies: Object.keys(COMPANIES).length,
        treasury: GOVERNMENT_FUNDS,
        whatsapp: isConnected ? "CONNECTED" : "DISCONNECTED",
        pairingCode: currentPairingCode || "none"
    });
});
app.get('/ping', (req, res) => res.send('pong'));
app.listen(PORT, () => console.log(`🌐 Port ${PORT}`));

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════
loadData();
setInterval(saveData, 30000);

console.log('🖤 HODEKAI v5.0\n🏛️ CONCLAVE AWAITS!!!');
connectWhatsApp();

process.on('SIGINT', () => { saveData(); process.exit(0); });
process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('uncaughtException', (e) => { console.error('❌', e.message); });
process.on('unhandledRejection', (e) => { console.error('❌', e); });
