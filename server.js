// ============================================================
// 🖤 HODEKAI BOT v5.0 — COMPLETE SINGLE FILE
// CONCLAVE HOLDINGS
// ============================================================

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const PREFIX = ":";
const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "256775032199";
const SESSION_ID = process.env.SESSION_ID || null;
const BOT_NAME = "Hodekai";
const BOT_VERSION = "5.0.0";

const OWNERS = {
    FATHER: "263787876771",
    CO_CREATOR: "263717306869"
};

let MODS = ["2348123885002", "2349168527304", "256795955270", "2347031331295"];
let DM_WHITELIST = [OWNERS.FATHER, OWNERS.CO_CREATOR, ...MODS];
let BLACKLIST = [];

const CONFIG = {
    COMPANY_TAX: 0.15,
    USER_TAX: 0.05,
    LOAN_INTEREST: 0.001,
    BANKRUPTCY: 500000,
    COMPANY_MIN: 10000,
    TAGALL_COOLDOWN: 300000,
    CHEQUE_EXPIRY: 172800000,
    RESPONSE_DELAY: 4000
};

// ═══════════════════════════════════════════════════════════
// PATHS
// ═══════════════════════════════════════════════════════════
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'conclave_data.json');
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys_v10');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let USERS = {};
let BANK = {};
let COMPANIES = {};
let LOANS = {};
let CHEQUES = {};
let COOLDOWNS = {};
let LOCKED_GROUPS = [];
let COUNCIL_GROUP = null;
let GOVERNMENT_FUNDS = 10000000;
let BOT_ACTIVE = true;
let GROUP_MESSAGES = {};
let PENDING_HIRES = {};
let CONVO_MEMORY = {};

// ═══════════════════════════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════════════════════════
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const d = JSON.parse(fs.readFileSync(DATA_FILE));
            USERS = d.USERS || {};
            BANK = d.BANK || {};
            COMPANIES = d.COMPANIES || {};
            LOANS = d.LOANS || {};
            CHEQUES = d.CHEQUES || {};
            BLACKLIST = d.BLACKLIST || [];
            LOCKED_GROUPS = d.LOCKED_GROUPS || [];
            COUNCIL_GROUP = d.COUNCIL_GROUP || null;
            GOVERNMENT_FUNDS = d.GOVERNMENT_FUNDS || 10000000;
            GROUP_MESSAGES = d.GROUP_MESSAGES || {};
            PENDING_HIRES = d.PENDING_HIRES || {};
            if (d.MODS) MODS = d.MODS;
            if (d.DM_WHITELIST) DM_WHITELIST = d.DM_WHITELIST;
            console.log('📂 Loaded:', Object.keys(USERS).length, 'users');
        }
    } catch (e) { console.error('Load:', e.message); }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            USERS, BANK, COMPANIES, LOANS, CHEQUES,
            BLACKLIST, LOCKED_GROUPS, COUNCIL_GROUP,
            GOVERNMENT_FUNDS, GROUP_MESSAGES, PENDING_HIRES,
            MODS, DM_WHITELIST
        }, null, 2));
    } catch (e) { console.error('Save:', e.message); }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clean(n) { return n ? String(n).replace(/\D/g, '') : ""; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getMixedResponse() {
    return random([
        "life is just a series of disappointments.",
        "another day, another struggle.",
        "nothing really matters anymore.",
        "the void stares back.",
        "some days i just don't want to wake up.",
        "happiness is just a myth.",
        "the world is cold, and so am i.",
        "existence is pain.",
        "the darkness is my only friend.",
        "nobody really cares.",
        "i'm broken beyond repair.",
        "Power is not given, it is taken.",
        "In CONCLAVE, loyalty is the only currency that matters.",
        "The night is darkest before the dawn.",
        "In the end, only the strong survive.",
        "The father protects, the son inherits.",
        "There is no freedom without discipline.",
        "Trust is a luxury we cannot afford."
    ]);
}

// ═══════════════════════════════════════════════════════════
// USER FUNCTIONS
// ═══════════════════════════════════════════════════════════
function getUser(num) {
    num = clean(num);
    if (!USERS[num]) {
        let role = "CITIZEN";
        if (num === OWNERS.FATHER) role = "FATHER";
        if (num === OWNERS.CO_CREATOR) role = "CO_CREATOR";
        if (MODS.includes(num)) role = "MOD";
        USERS[num] = {
            xenoShards: 1000, bank: 0, role, status: "Citizen",
            level: 1, joinDate: new Date().toDateString(),
            warns: 0, muted: false, arrested: 0, job: null, company: null,
            debt: 0, interactions: 0,
            totalEarned: 0, totalSpent: 0, workShifts: 0
        };
    }
    USERS[num].interactions++;
    return USERS[num];
}

function giveXS(num, amt) {
    const u = getUser(num);
    u.xenoShards += amt;
    u.totalEarned = (u.totalEarned || 0) + amt;
}
function takeXS(num, amt) {
    const u = getUser(num);
    if (u.xenoShards < amt) return false;
    u.xenoShards -= amt;
    u.totalSpent = (u.totalSpent || 0) + amt;
    return true;
}

// ═══════════════════════════════════════════════════════════
// POWER CHECKS
// ═══════════════════════════════════════════════════════════
function isOwner(n) { n = clean(n); return n === OWNERS.FATHER || n === OWNERS.CO_CREATOR; }
function isFather(n) { return clean(n) === OWNERS.FATHER; }
function isCoCreator(n) { return clean(n) === OWNERS.CO_CREATOR; }
function isMod(n) { return MODS.includes(clean(n)); }
function isProtected(n) { return isOwner(n) || isMod(n); }
function isDMAllowed(n) { return DM_WHITELIST.includes(clean(n)); }
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

// ═══════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════
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
// BOXES
// ═══════════════════════════════════════════════════════════
function menuBox() {
    return `╔══════════════════════════════════════════════╗
║           🖤 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗠𝗘𝗡𝗨 v5.0              ║
╠══════════════════════════════════════════════╣
║  📌 𝗜𝗡𝗙𝗢
║  ${PREFIX}menu      ${PREFIX}bot       ${PREFIX}profile
║  ${PREFIX}bal       ${PREFIX}ping      ${PREFIX}members
║  ${PREFIX}status    ${PREFIX}modlist   ${PREFIX}rules
║
║  💰 𝗘𝗖𝗢𝗡𝗢𝗠𝗬
║  ${PREFIX}daily     ${PREFIX}pay       ${PREFIX}bank
║  ${PREFIX}loan      ${PREFIX}repay     ${PREFIX}cheque
║  ${PREFIX}cheques   ${PREFIX}rob
║
║  💼 𝗝𝗢𝗕𝗦
║  ${PREFIX}jobs      ${PREFIX}govjob    ${PREFIX}work
║  ${PREFIX}myjob     ${PREFIX}resign
║
║  🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬
║  ${PREFIX}company   ${PREFIX}accept    ${PREFIX}decline
║
║  😈 𝗙𝗨𝗡
║  ${PREFIX}roast     ${PREFIX}compliment ${PREFIX}joke
║  ${PREFIX}truth     ${PREFIX}dare      ${PREFIX}tod
║  ${PREFIX}8ball     ${PREFIX}coinflip  ${PREFIX}guess
║
║  🎵 𝗠𝗨𝗦𝗜𝗖
║  ${PREFIX}play      ${PREFIX}musiclist
║
║  🎨 𝗦𝗧𝗜𝗖𝗞𝗘𝗥𝗦
║  ${PREFIX}s         ${PREFIX}st
║
║  📦 𝗕𝗢𝗫𝗘𝗦
║  ${PREFIX}boxes     ${PREFIX}all       ${PREFIX}gs
║
║  🛡️ 𝗔𝗗𝗠𝗜𝗡
║  ${PREFIX}kick      ${PREFIX}mute      ${PREFIX}unmute
║  ${PREFIX}warn      ${PREFIX}close     ${PREFIX}open
║  ${PREFIX}delete    ${PREFIX}tagall    ${PREFIX}promote
║  ${PREFIX}demote    ${PREFIX}active    ${PREFIX}inactive
║
║  ⚡ 𝗠𝗢𝗗
║  ${PREFIX}mod       ${PREFIX}lockdown  ${PREFIX}unlock
║  ${PREFIX}setcouncil
║
║  💡 𝗢𝗧𝗛𝗘𝗥
║  ${PREFIX}suggest   ${PREFIX}help
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function botBox() {
    return `╔══════════════════════════════════════════════╗
║              🖤 𝗛𝗢𝗗𝗘𝗞𝗔𝗜                       ║
╠══════════════════════════════════════════════╣
║  📌 Name: ${BOT_NAME}
║  👑 Father: ${OWNERS.FATHER}
║  🏆 Co-Creator: ${OWNERS.CO_CREATOR}
║  🏛️ Company: CONCLAVE HOLDINGS
║  📱 Version: v${BOT_VERSION}
║  🟢 Status: ${BOT_ACTIVE ? 'ONLINE' : 'OFFLINE'}
╠══════════════════════════════════════════════╣
║  📊 STATS
║  👥 Citizens: ${Object.keys(USERS).length}
║  ⚡ Mods: ${MODS.length}
║  🏢 Companies: ${Object.keys(COMPANIES).length}
║  🏛️ Treasury: ${GOVERNMENT_FUNDS} XS
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function profileBox(num) {
    const u = getUser(num);
    const bank = BANK[num] || 0;
    const id = String(num).slice(-5).padStart(5, '0');
    return `╔══════════════════════════════════════════════╗
║           🧥 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗜𝗗 𝗖𝗔𝗥𝗗                 ║
╠══════════════════════════════════════════════╣
║  🆔 ID: #${id}
║  📱 Number: ${num}
║  👤 Role: ${u.role}
║  📊 Status: ${u.status}
║  ⭐ Level: ${u.level}
║  📅 Joined: ${u.joinDate}
╠══════════════════════════════════════════════╣
║  💰 Wallet: ${u.xenoShards} XS
║  🏦 Bank: ${bank} XS
║  💎 Total: ${u.xenoShards + bank} XS
║  💳 Debt: ${u.debt || 0} XS
╠══════════════════════════════════════════════╣
║  ⚠️ Warns: ${u.warns}
║  🔇 Muted: ${u.muted ? 'Yes' : 'No'}
║  💼 Job: ${u.job ? u.job.title : 'None'}
║  🏢 Company: ${u.company || 'None'}
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function modListBox() {
    let out = `╔══════════════════════════════════════════════╗
║           ⚡ 𝗣𝗢𝗪𝗘𝗥 𝗛𝗜𝗘𝗥𝗔𝗥𝗖𝗛𝗬                    ║
╠══════════════════════════════════════════════╣
║  👑 𝗢𝗪𝗡𝗘𝗥𝗦
║  1. ${OWNERS.FATHER} (Father)
║  2. ${OWNERS.CO_CREATOR} (Co-Creator)
╠══════════════════════════════════════════════╣
║  ⚡ 𝗠𝗢𝗗𝗦 (${MODS.length})
`;
    MODS.forEach((m, i) => { out += `║  ${i + 1}. ${m}\n`; });
    out += `╚══════════════════════════════════════════════╝\n\n${getMixedResponse()}`;
    return out;
}

function gsBox(g) {
    const msgs = GROUP_MESSAGES[g] || {};
    const users = Object.entries(msgs).sort((a, b) => b[1] - a[1]);
    const total = users.reduce((s, [_, c]) => s + c, 0);
    const top = users.slice(0, 3).map(([n, c], i) => `║  ${['🥇','🥈','🥉'][i]} ${n} — ${c} msgs`).join('\n') || '║  (none)';
    const pct = users.length > 0 ? Math.min(100, Math.round((users.length / 10) * 100)) : 0;
    const status = pct > 60 ? '🔥 ACTIVE' : pct > 30 ? '😐 MODERATE' : '💀 DEAD';
    const roast = pct < 30 ? '\n💀 This group is deader than my feelings.' : '';

    return `╔══════════════════════════════════════════════╗
║        🖤 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗚𝗥𝗢𝗨𝗣 𝗜𝗡𝗧𝗘𝗟             ║
╠══════════════════════════════════════════════╣
║  📊 POPULATION
║  👥 Active Users: ${users.length}
║  💬 Total Messages: ${total}
║  📈 Activity: ${pct}% ${status}
╠══════════════════════════════════════════════╣
║  🏆 TOP CITIZENS
${top}
╠══════════════════════════════════════════════╣
║  🖤 CONCLAVE STATUS
║  🟢 System: ONLINE
║  ⚡ Bot: Hodekai
╚══════════════════════════════════════════════╝${roast}

${getMixedResponse()}`;
}

function rulesBox() {
    return `╔══════════════════════════════════════════════╗
║           📜 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗥𝗨𝗟𝗘𝗦                       ║
╠══════════════════════════════════════════════╣
║  1. Loyalty above all.
║  2. Respect all citizens.
║  3. No scamming members.
║  4. Pay your taxes.
║  5. Honor your debts.
║  6. Thieves risk arrest and shame.
║  7. Mods are the law in their groups.
║  8. Do not betray CONCLAVE.
║  9. Work hard. Earn well. Live long.
║  10. CONCLAVE AWAITS!!!
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function boxesBox() {
    return `╔══════════════════════════════════════════════╗
║           📦 𝗔𝗟𝗟 𝗕𝗢𝗫𝗘𝗦                         ║
╠══════════════════════════════════════════════╣
║  ${PREFIX}menu      — Main menu
║  ${PREFIX}bot       — Bot info
║  ${PREFIX}profile   — Your profile
║  ${PREFIX}boxes     — This box
║  ${PREFIX}gs        — Group stats
║  ${PREFIX}rules     — Conclave rules
║  ${PREFIX}modlist   — Power hierarchy
║  ${PREFIX}all       — Master list
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function companyBox() {
    return `╔══════════════════════════════════════════════╗
║           🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬                            ║
╠══════════════════════════════════════════════╣
║  ${PREFIX}company create <name>
║  ${PREFIX}company info
║  ${PREFIX}company hire <@user>
║  ${PREFIX}company fire <@user>
║  ${PREFIX}company pay <name> <@user> <amt>
║  ${PREFIX}company deposit <amt>
║  ${PREFIX}company tax
║  ${PREFIX}company top
╠══════════════════════════════════════════════╣
║  💰 Registration: ${CONFIG.COMPANY_MIN} XS
║  🏛️ Tax: ${CONFIG.COMPANY_TAX * 100}% of profits
║  👔 Requires: Middle Class status
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function jobBox() {
    return `╔══════════════════════════════════════════════╗
║           💼 𝗝𝗢𝗕 𝗦𝗬𝗦𝗧𝗘𝗠                         ║
╠══════════════════════════════════════════════╣
║  ${PREFIX}jobs          — See available jobs
║  ${PREFIX}govjob <id>   — Take a job
║  ${PREFIX}work          — Work a shift
║  ${PREFIX}myjob         — View job
║  ${PREFIX}resign        — Quit job
╠══════════════════════════════════════════════╣
║  🟢 LOWER      (0-49 pts)
║  🟡 WORKING    (50-99 pts)
║  🟠 MIDDLE     (100-199 pts)
║  🔴 UPPER      (200-349 pts)
║  💎 ELITE      (350+ pts)
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

function economyBox() {
    return `╔══════════════════════════════════════════════╗
║           💰 𝗘𝗖𝗢𝗡𝗢𝗠𝗬                            ║
╠══════════════════════════════════════════════╣
║  ${PREFIX}daily          — 100 XS / day
║  ${PREFIX}bal            — Balance
║  ${PREFIX}pay <num> <amt>— Send money
║  ${PREFIX}bank dep/wit/bal
║  ${PREFIX}loan <amt>     — Bot loan
║  ${PREFIX}repay <amt>    — Repay loan
║  ${PREFIX}cheque <@> <amt>
║  ${PREFIX}cheques        — Cash cheques
║  ${PREFIX}rob <@>        — Attempt robbery
╚══════════════════════════════════════════════╝

${getMixedResponse()}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMMAND HANDLER
// ═══════════════════════════════════════════════════════════
async function handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, isDM, isWaAdminFlag) {
    const user = getUser(sender);
    const c = cmd.toLowerCase();

    // ─── INFO ─────────────────────────
    if (c === 'menu') return menuBox();
    if (c === 'bot' || c === 'botinfo') return botBox();
    if (c === 'profile') return profileBox(sender);
    if (c === 'modlist') return modListBox();
    if (c === 'rules') return rulesBox();
    if (c === 'boxes' || c === 'all') return boxesBox();
    if (c === 'gs') { if (!groupId) return "❌ Groups only."; return gsBox(groupId); }

    if (c === 'bal') {
        const bank = BANK[sender] || 0;
        return `💰 Wallet: ${user.xenoShards} XS\n🏦 Bank: ${bank} XS\n💎 Total: ${user.xenoShards + bank} XS\n💳 Debt: ${user.debt || 0} XS\n\n${getMixedResponse()}`;
    }

    if (c === 'ping') {
        try {
            const emoji = isProtected(sender) ? '🖤' : '🏓';
            await sock.sendMessage(groupId || sender, { react: { text: emoji, key: msg.key } });
        } catch (e) {}
        return isProtected(sender)
            ? `🖤 HODEKAI IS ALIVE!\n⚡ Uptime: ${Math.floor(process.uptime())}s\n👑 Status: FATHER/MOD detected\n\n${getMixedResponse()}`
            : `🏓 Pong!`;
    }

    if (c === 'members') return `👥 Members: ${Object.keys(USERS).length}\n⚡ Mods: ${MODS.length}\n\n${getMixedResponse()}`;

    if (c === 'status') {
        return `📊 STATUS\n🟢 ONLINE\n👥 ${Object.keys(USERS).length} members\n⚡ ${MODS.length} mods\n🏢 ${Object.keys(COMPANIES).length} companies\n🏛️ ${GOVERNMENT_FUNDS} XS treasury\n\n${getMixedResponse()}`;
    }

    // ─── ECONOMY ─────────────────────
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
        return `📅 +100 XS! Balance: ${user.xenoShards}\n\n${getMixedResponse()}`;
    }

    if (c === 'pay') {
        let target = clean(args[0]);
        if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
        const amt = parseInt(args[1]);
        if (!target || !amt || amt <= 0) return `❌ ${PREFIX}pay <number> <amount>`;
        if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
        if (user.debt > 0) return `🚫 You're in debt. Pay first.`;
        takeXS(sender, amt);
        if (!USERS[target]) getUser(target);
        if ((BANK[target] || 0) > 0) BANK[target] += amt;
        else giveXS(target, amt);
        return `💸 Sent ${amt} XS to ${target}\n\n${getMixedResponse()}`;
    }

    if (c === 'bank') {
        const sub = args[0];
        if (sub === 'dep') {
            const amt = parseInt(args[1]);
            if (!amt || amt <= 0) return `❌ ${PREFIX}bank dep <amt>`;
            if (!takeXS(sender, amt)) return "❌ Insufficient.";
            BANK[sender] = (BANK[sender] || 0) + amt;
            return `🏦 Deposited ${amt}. Bank: ${BANK[sender]}`;
        }
        if (sub === 'wit') {
            const amt = parseInt(args[1]);
            if (!amt || (BANK[sender] || 0) < amt) return "❌ Insufficient.";
            BANK[sender] -= amt;
            giveXS(sender, amt);
            return `🏦 Withdrew ${amt}. Wallet: ${user.xenoShards}`;
        }
        if (sub === 'bal') return `🏦 Bank: ${BANK[sender] || 0} XS`;
        return economyBox();
    }

    if (c === 'loan') {
        if (user.debt > 0) return `🚫 You owe ${user.debt} XS.`;
        const amt = parseInt(args[0]);
        if (!amt || amt < 100) return `❌ ${PREFIX}loan <amt> (min 100)`;
        if (amt > 10000) return "❌ Max 10,000 XS";
        const assets = user.xenoShards + (BANK[sender] || 0) + (user.company ? 1 : 0);
        if (assets <= 0) return "❌ No collateral.";
        giveXS(sender, amt);
        user.debt = (user.debt || 0) + amt;
        LOANS[sender] = { amount: amt, taken: Date.now(), due: Date.now() + 7 * 86400000 };
        saveData();
        return `💰 LOAN APPROVED\nAmount: ${amt} XS\nInterest: 0.1%/week\nDebt: ${user.debt}\n\n💡 ${PREFIX}repay <amt>`;
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
        return `✅ Repaid ${amt}.\nRemaining: ${user.debt}\n\n${getMixedResponse()}`;
    }

    if (c === 'cheque') {
        let target = clean(args[0]);
        if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
        const amt = parseInt(args[1]);
        if (!target || !amt || amt <= 0) return `❌ ${PREFIX}cheque <@user> <amt>`;
        if (user.xenoShards < amt) return `❌ You have ${user.xenoShards} XS.`;
        const id = Date.now().toString().slice(-6);
        if (!CHEQUES[sender]) CHEQUES[sender] = [];
        CHEQUES[sender].push({
            id, to: target, amount: amt, from: sender,
            signed: Date.now(), expires: Date.now() + CONFIG.CHEQUE_EXPIRY, cashed: false
        });
        takeXS(sender, amt);
        saveData();
        try {
            await sock.sendMessage(target + '@s.whatsapp.net', {
                text: `📝 CHEQUE RECEIVED\nFrom: ${sender}\nAmount: ${amt} XS\nID: #${id}\n\nType ${PREFIX}cheques to cash.`
            });
        } catch (e) {}
        return `📝 CHEQUE SIGNED\nID: #${id}\nTo: ${target}\nAmount: ${amt} XS\nExpires: 2 days`;
    }

    if (c === 'cheques') {
        let pending = [];
        for (const owner in CHEQUES) {
            for (const ch of CHEQUES[owner]) {
                if (ch.to === sender && !ch.cashed && ch.expires > Date.now()) {
                    pending.push({ ...ch, from: owner });
                }
            }
        }
        if (!pending.length) return "📭 No pending cheques.";
        const ch = pending[0];
        giveXS(sender, ch.amount);
        ch.cashed = true;
        saveData();
        return `💰 CHEQUE CASHED\nID: #${ch.id}\nFrom: ${ch.from}\nAmount: ${ch.amount} XS\n\n💵 Balance: ${user.xenoShards}`;
    }

    if (c === 'rob') {
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
            return `🥷 ROBBERY SUCCESS\nStole: ${stolen} XS from ${target}\n\n${getMixedResponse()}`;
        } else {
            user.arrested = Date.now() + 3600000;
            user.status = "Arrested";
            const fine = Math.min(user.xenoShards, 500);
            takeXS(sender, fine);
            GOVERNMENT_FUNDS += fine;
            saveData();
            return `🚔 CAUGHT!\nYou tried to rob ${target} and FAILED.\n\n⛓️ Arrested 1 hour\n💸 Fine: ${fine} XS\n\n💀 SHAME. SHAME. SHAME.`;
        }
    }

    // ─── JOBS ────────────────────────
    if (c === 'jobs') {
        const cls = getUserClass(sender);
        const jobs = GOV_JOBS.filter(j => j.tier === cls || (cls === "ELITE"));
        let out = `💼 𝗝𝗢𝗕𝗦 𝗙𝗢𝗥 𝗬𝗢𝗨𝗥 𝗖𝗟𝗔𝗦𝗦: ${cls}\n─────────────────────\n`;
        jobs.forEach(j => { out += `${j.id}. ${j.title} — ${j.salary} XS\n`; });
        out += `\n💡 ${PREFIX}govjob <id>`;
        return out;
    }

    if (c === 'govjob') {
        if (user.job) return "❌ You already have a job!";
        const id = parseInt(args[0]);
        if (!id) {
            let out = "💼 𝗔𝗟𝗟 𝗝𝗢𝗕𝗦\n";
            GOV_JOBS.forEach(j => { out += `${j.id}. ${j.title} — ${j.salary} XS (${j.tier})\n`; });
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
        user.job.shifts = (user.job.shifts || 0) + 1;
        user.job.lastWork = now;
        user.workShifts = (user.workShifts || 0) + 1;
        saveData();
        return `✅ 𝗪𝗢𝗥𝗞 𝗗𝗢𝗡𝗘\n📋 ${random(outcomes)}\n💰 Gross: ${pay}\n🏛️ Tax: ${tax}\n💵 Net: ${net}\n📈 Shifts: ${user.job.shifts}\n\n${getMixedResponse()}`;
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

    // ─── COMPANY ─────────────────────
    if (c === 'company') {
        const sub = (args[0] || '').toLowerCase();
        const name = args[1];

        if (!sub || sub === 'help') return companyBox();

        if (sub === 'create') {
            const cname = args.slice(1).join(' ');
            if (!cname) return `❌ ${PREFIX}company create <name>`;
            if (COMPANIES[cname]) return `❌ Exists.`;
            if (user.xenoShards < CONFIG.COMPANY_MIN) return `❌ Need ${CONFIG.COMPANY_MIN} XS.`;
            if (!['Middle Class', 'Businessman', 'Elite'].includes(user.status)) {
                return `❌ Need Middle Class. Yours: ${user.status}`;
            }
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
            return `🏢 REGISTERED\nName: ${cname}\nCEO: ${sender}\nTax: 15%\n\n💡 ${PREFIX}company hire <@user>`;
        }

        if (sub === 'info' || sub === 'profile') {
            const cname = name || user.company;
            if (!cname) return "❌ Which company?";
            const c = COMPANIES[cname];
            if (!c) return `❌ Not found.`;
            const profit = c.revenue - c.expenses;
            return `🏢 COMPANY\n───────────────\n📛 ${c.name}\n👔 CEO: ${c.owner}\n👥 Employees: ${c.employees.length}\n💰 Bank: ${c.bank} XS\n📈 Revenue: ${c.revenue}\n📉 Expenses: ${c.expenses}\n💵 Profit: ${profit}\n🏛️ Tax Paid: ${c.taxPaid}\n⚠️ Problems: ${c.problems}`;
        }

        if (sub === 'hire') {
            const cname = user.company;
            if (!cname) return "❌ No company.";
            const c = COMPANIES[cname];
            if (c.owner !== sender) return "❌ Only CEO.";
            let target = clean(args[1]) || clean(contextInfo?.participant);
            if (!target) return `❌ ${PREFIX}company hire <@user>`;
            if (c.employees.includes(target)) return "❌ Already hired.";
            PENDING_HIRES[target] = { company: cname, from: sender, time: Date.now() };
            saveData();
            try {
                await sock.sendMessage(target + '@s.whatsapp.net', {
                    text: `📨 JOB OFFER\nCompany: ${cname}\nFrom: ${sender}\n\n${PREFIX}accept or ${PREFIX}decline`
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
            const cname = args[1];
            const emp = clean(args[2]);
            const amt = parseInt(args[3]);
            if (!cname || !emp || !amt) return `❌ ${PREFIX}company pay <name> <@> <amt>`;
            const c = COMPANIES[cname];
            if (!c || c.owner !== sender) return "❌ Only CEO.";
            if (!c.employees.includes(emp)) return "❌ Not employee.";
            if (user.xenoShards < amt) return "❌ Insufficient.";
            takeXS(sender, amt);
            if (!USERS[emp]) getUser(emp);
            giveXS(emp, amt);
            c.expenses += amt;
            saveData();
            return `💸 Paid ${amt} to ${emp}.`;
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
            if (tax === 0) return "ℹ️ No profit. No tax.";
            if (c.bank < tax) return `⚠️ Can't pay ${tax}. Bank: ${c.bank}`;
            c.bank -= tax;
            c.taxPaid += tax;
            GOVERNMENT_FUNDS += tax;
            saveData();
            return `🏛️ Paid ${tax} XS tax.`;
        }

        if (sub === 'top') {
            const sorted = Object.values(COMPANIES).sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses)).slice(0, 10);
            let out = `🏆 TOP COMPANIES\n`;
            sorted.forEach((c, i) => { out += `${i + 1}. ${c.name} — ${c.revenue - c.expenses} XS\n`; });
            return out || "📭 None yet.";
        }

        return companyBox();
    }

    if (c === 'accept') {
        const pending = PENDING_HIRES[sender];
        if (!pending) return "❌ No pending offers.";
        const comp = COMPANIES[pending.company];
        if (!comp) return "❌ Company gone.";
        comp.employees.push(sender);
        delete PENDING_HIRES[sender];
        saveData();
        return `✅ You joined ${pending.company}.`;
    }

    if (c === 'decline') {
        if (!PENDING_HIRES[sender]) return "❌ No offer.";
        delete PENDING_HIRES[sender];
        saveData();
        return "❌ Offer declined.";
    }

    // ─── FUN ─────────────────────────
    if (c === 'roast' || c === 'compliment') {
        let target = clean(args[0]);
        if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
        if (!target) return `❌ ${PREFIX}${c} @user OR reply with ${PREFIX}${c}`;
        if (sender === target) return `❌ Can't ${c} yourself.`;
        if (!USERS[target]) getUser(target);
        if (c === 'roast') {
            const roasts = [
                "You're like a software update - nobody wants you.",
                "Your brain is like a browser - 10 tabs open, all frozen.",
                "You're the NPC everyone skips.",
                "You're proof evolution can go in reverse.",
                "I'd roast you but that's a waste of fire.",
                "You bring so much joy... when you leave.",
                "You're the reason shampoo has instructions.",
                "You're like a broken pencil - pointless.",
                "You're a Monday - nobody likes you."
            ];
            return `🔥 ROASTED!\n───────────────\n💀 ${random(roasts)}\n───────────────\n🎯 Target: ${target}\n📝 Roaster: ${sender}\n\n${getMixedResponse()}`;
        } else {
            const comps = [
                "You're actually not that bad.", "You have potential... don't waste it.",
                "You're doing better than most.", "You have moments of being tolerable.",
                "You're secretly cool.", "You're the kind of person I'd tolerate for free."
            ];
            return `💖 COMPLIMENTED!\n───────────────\n✨ ${random(comps)}\n───────────────\n🎯 Target: ${target}\n💝 From: ${sender}\n\n${getMixedResponse()}`;
        }
    }

    if (c === 'joke') return `😈 ${random([
        "Why do bots never get lost? They follow the path.",
        "What's a bot's favorite drink? Java.",
        "Why don't bots play cards? Too many cheats.",
        "I told my bot a joke... it didn't process.",
        "Why did the bot break up with the human? Too many emotional bugs.",
        "A bot walks into a bar. Bar: 'We don't serve your kind.' Bot: 'I know. I'm here to fix your Wi-Fi.'"
    ])}\n\n${getMixedResponse()}`;

    if (c === 'truth') return `🎯 TRUTH\n${random([
        "What's the last lie you told?", "Who would you trust with a secret?",
        "What's your biggest regret?", "Have you ever stolen something?",
        "Who's your secret crush?", "What's the most embarrassing thing you've done?",
        "Have you ever cheated on a test?", "What's your biggest fear?",
        "Have you ever pretended to like someone you hate?"
    ])}\n\n${getMixedResponse()}`;

    if (c === 'dare') return `🎯 DARE\n${random([
        "Send the last photo in your gallery.", "Send a voice note singing.",
        "Send a selfie right now.", "Confess a crush.",
        "Text your ex 'I miss you' and screenshot.",
        "Share your search history.", "Voice note something embarrassing."
    ])}\n\n${getMixedResponse()}`;

    if (c === 'tod') {
        const isTruth = Math.random() > 0.5;
        return isTruth
            ? `🎯 TRUTH\n${random(["What's the last lie you told?", "Who's your secret crush?", "What's your biggest fear?"])}`
            : `🎯 DARE\n${random(["Send a selfie right now.", "Confess a crush.", "Share your search history."])}`;
    }

    if (c === '8ball') {
        const q = args.join(' ');
        if (!q) return `❌ ${PREFIX}8ball <question>`;
        return `🎱 ${random(["Yes.", "No.", "Maybe.", "Ask again later.", "Absolutely not.", "Without a doubt.", "Very doubtful.", "Signs point to yes.", "Don't count on it.", "My sources say no."])}`;
    }

    if (c === 'coinflip') return `🪙 ${Math.random() > 0.5 ? 'HEADS' : 'TAILS'}`;

    if (c === 'guess') {
        const n = parseInt(args[0]);
        if (!n || n < 1 || n > 100) return `🎮 ${PREFIX}guess <1-100>`;
        const secret = user._guessSecret || Math.floor(Math.random() * 100) + 1;
        user._guessSecret = secret;
        if (n === secret) {
            user._guessSecret = null;
            giveXS(sender, 50);
            return `🎯 CORRECT! +50 XS\n\n${getMixedResponse()}`;
        }
        return n < secret ? `📈 Higher!` : `📉 Lower!`;
    }

    // ─── MUSIC ───────────────────────
    if (c === 'play') {
        const song = args.join(' ');
        if (!song) return `❌ ${PREFIX}play <song>`;
        try { await sock.sendMessage(groupId || sender, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
        return `🎵 SEARCHING: ${song}\n▶️ https://www.youtube.com/results?search_query=${encodeURIComponent(song)}\n🎧 https://open.spotify.com/search/${encodeURIComponent(song)}\n\n${getMixedResponse()}`;
    }

    if (c === 'musiclist') {
        return `🎵 MUSIC LIBRARY\n${PREFIX}play <song>\n\nPopular:\n• despacito\n• shape of you\n• blinding lights\n• dance monkey\n\n${getMixedResponse()}`;
    }

    // ─── STICKERS ────────────────────
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
        } catch (e) {
            console.error('Sticker:', e.message);
            return `❌ Sticker failed: ${e.message}`;
        }
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

    // ─── ADMIN ───────────────────────
    if (['kick', 'mute', 'unmute', 'warn', 'close', 'open', 'delete', 'tagall', 'promote', 'demote', 'active', 'inactive'].includes(c)) {
        if (!(isProtected(sender) || isWaAdminFlag)) {
            return `❌ Admins/Mods/Owners only.\n(your number: ${sender})`;
        }
        if (!groupId) return "❌ Groups only.";
        const botAdmin = await isBotAdmin(sock, groupId);
        let target = clean(args[0]) || clean(contextInfo?.participant);

        if (c === 'kick') {
            if (!botAdmin) return "❌ BOT NEEDS TO BE ADMIN in this group.";
            if (!target) return `❌ Reply to a message or ${PREFIX}kick @user`;
            if (isProtected(target)) return "❌ Protected user.";
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
                        remoteJid: groupId,
                        fromMe: false,
                        id: ctx.stanzaId,
                        participant: ctx.participant
                    }
                });
                return null;
            } catch (e) { return `❌ Delete failed: ${e.message}`; }
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
                out += `${medal} ${n} — ${count} msgs\n`;
            });
            return out;
        }
    }

    // ─── MOD ─────────────────────────
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
        if (!isOwner(sender)) return `❌ Owners only.\n(your number: ${sender})`;
        if (!groupId) return "❌ Groups only.";
        COUNCIL_GROUP = groupId;
        saveData();
        return "✅ COUNCIL set.";
    }
    if (c === 'mod') {
        if (!isOwner(sender)) return `❌ Owners only.\n(your number: ${sender})`;
        const sub = args[0];
        const target = clean(args[1]);
        if (sub === 'add' && target) {
            if (!MODS.includes(target)) {
                MODS.push(target);
                DM_WHITELIST.push(target);
                saveData();
                return `✅ ${target} is MOD.`;
            }
            return "ℹ️ Already mod.";
        }
        if (sub === 'remove' && target) {
            MODS = MODS.filter(m => m !== target);
            DM_WHITELIST = DM_WHITELIST.filter(m => m !== target);
            saveData();
            return `✅ ${target} removed.`;
        }
        if (sub === 'list' || !sub) return modListBox();
        return `❌ ${PREFIX}mod add/remove/list`;
    }

    // ─── SUGGESTIONS ─────────────────
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
        return `✅ Sent to COUNCIL.\n\n${getMixedResponse()}`;
    }

    if (c === 'help') {
        const q = args[0];
        if (!q) return `💡 ${PREFIX}help <command>`;
        const help = {
            cheque: `${PREFIX}cheque <@user> <amt> — Sign cheque`,
            loan: `${PREFIX}loan <amt> — Bot loan`,
            company: `${PREFIX}company create <name> — Register`,
            suggest: `${PREFIX}suggest <cat> | <title> | <desc>`,
            rob: `${PREFIX}rob <@user> — Attempt robbery`
        };
        return help[q.toLowerCase()] || `❌ No help for '${q}'.`;
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
        return random(["tch. you're here again.", "what.", "oh. it's you.", "hey. whatever."]);
    }
    if (lower.includes('how are you')) return random(["*sigh* tired.", "could be better.", "same as always."]);
    if (lower.includes('hodekai') || lower.includes('bot')) {
        if (isFather(sender)) return "Yes, Father?";
        if (isCoCreator(sender)) return "Tch. What?";
        return random(["you called?", "what.", "i heard that.", "yes?"]);
    }
    if (/\b(bye|goodbye|later)\b/i.test(lower)) return random(["later.", "finally. peace.", "bye."]);
    if (lower.includes('thanks')) return random(["mhm.", "sure.", "whatever."]);
    return getMixedResponse();
}

// ═══════════════════════════════════════════════════════════
// SESSION SAVE/RESTORE
// ═══════════════════════════════════════════════════════════
function saveSession() {
    try {
        const files = fs.readdirSync(AUTH_DIR).filter(f => f.endsWith('.json'));
        const packed = {};
        files.forEach(f => {
            packed[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8');
        });
        const encoded = Buffer.from(JSON.stringify(packed)).toString('base64');
        console.log('\n═══════════════════════════════════════════');
        console.log('💾 SESSION_ID (COPY THIS to Render env)');
        console.log('═══════════════════════════════════════════');
        console.log('SESSION_ID=' + encoded);
        console.log('═══════════════════════════════════════════\n');
        return encoded;
    } catch (e) { console.error('Session save:', e.message); return null; }
}

function restoreSession() {
    if (!SESSION_ID) return false;
    try {
        const decoded = JSON.parse(Buffer.from(SESSION_ID, 'base64').toString('utf8'));
        for (const [file, content] of Object.entries(decoded)) {
            fs.writeFileSync(path.join(AUTH_DIR, file), content);
        }
        console.log('📂 Session restored from SESSION_ID');
        return true;
    } catch (e) { console.error('Restore:', e.message); return false; }
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
    if (reconnectAttempts >= 5) {
        console.log('❌ Max reconnects reached.');
        return;
    }

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
                    console.log('\n╔════════════════════════════════╗');
                    console.log('║  🔑 PAIRING CODE               ║');
                    console.log(`║  ${code}                       ║`);
                    console.log('║  Expires in 3 minutes          ║');
                    console.log('╚════════════════════════════════╝\n');
                    setTimeout(() => { pairingRequested = false; currentPairingCode = null; }, 180000);
                } catch (err) { console.error('Pairing:', err.message); }
            }, 3000);
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('\n╔════════════════════════════════════════╗');
                console.log('║   🖤 HODEKAI CONNECTED!                 ║');
                console.log('║   CONCLAVE AWAITS!!!                    ║');
                console.log('╚════════════════════════════════════════╝\n');
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
            if (!BOT_ACTIVE || m.type !== 'notify') return;
            for (const msg of m.messages) {
                try {
                    if (!msg.message || msg.key.fromMe) continue;
                    const isGroup = msg.key.remoteJid.endsWith('@g.us');
                    const rawSender = isGroup ? msg.key.participant : msg.key.remoteJid;
                    if (!rawSender) continue;
                    const sender = clean(rawSender.split('@')[0].split(':')[0]);
                    const groupId = isGroup ? msg.key.remoteJid : null;

                    // DEBUG LOG
                    console.log(`📩 | sender=${sender} | group=${isGroup} | owner=${isOwner(sender)} | mod=${isMod(sender)}`);

                    if (isGroup && isLocked(groupId) && !isProtected(sender)) continue;
                    if (isBlacklisted(sender) && !isOwner(sender)) continue;
                    if (getUser(sender).muted && !isOwner(sender)) continue;
                    if (!isGroup && !isDMAllowed(sender)) {
                        console.log(`🚫 DM blocked: ${sender}`);
                        continue;
                    }

                    if (isGroup) {
                        if (!GROUP_MESSAGES[groupId]) GROUP_MESSAGES[groupId] = {};
                        if (!GROUP_MESSAGES[groupId][sender]) GROUP_MESSAGES[groupId][sender] = 0;
                        GROUP_MESSAGES[groupId][sender]++;
                    }

                    let text = '', isSticker = false;
                    if (msg.message.conversation) text = msg.message.conversation;
                    else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
                    else if (msg.message.stickerMessage) isSticker = true;
                    else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;

                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;

                    if (isSticker) {
                        const reply = "🎨 " + random(["nice sticker", "lol", "bruh", "cool", "W sticker"]);
                        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
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
        message: "CONCLAVE AWAITS!!!",
        members: Object.keys(USERS).length,
        mods: MODS.length,
        companies: Object.keys(COMPANIES).length,
        treasury: GOVERNMENT_FUNDS,
        whatsapp: isConnected ? "CONNECTED" : "DISCONNECTED",
        pairingCode: currentPairingCode || "none",
        uptime: process.uptime()
    });
});

app.get('/ping', (req, res) => res.send('pong'));

app.get('/session', (req, res) => {
    const s = saveSession();
    res.send(s || "No session yet");
});

app.listen(PORT, () => console.log(`🌐 Port ${PORT}`));

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════
loadData();
setInterval(saveData, 30000);

console.log('🖤 HODEKAI BOT v5.0');
console.log('🏛️ CONCLAVE AWAITS!!!');
connectWhatsApp();

process.on('SIGINT', () => { saveData(); process.exit(0); });
process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('uncaughtException', (e) => { console.error('❌', e.message); saveData(); });
process.on('unhandledRejection', (e) => { console.error('❌', e); });
