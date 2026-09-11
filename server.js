// HODEKAI — CONCLAVE BOT
 // User-facing bot name: Hodekai
 // Render/Express + Baileys base.
 // NOTE: Render Free services can spin down after 15 minutes without inbound
 // traffic; code cannot guarantee permanent uptime.
const {
 default: makeWASocket,
 DisconnectReason,
 useMultiFileAuthState,
 fetchLatestBaileysVersion
 } = require('@whiskeysockets/baileys');
const express = require('express');
 const fs = require('fs');
 const path = require('path');
 const cors = require('cors');
 require('dotenv').config();
const PREFIX = ':';
 const PORT = process.env.PORT || 3000;
// KEEPING THE ORIGINAL BOT NUMBER
 const BOT_NUMBER = process.env.BOT_NUMBER || '256775032199';
const FATHER_NUMBERS = ['263787876771', '0787876771', '787876771'];
 const CO_CREATOR_NUMBERS = ['263717306869', '0717306869', '717306869'];
const OWNERS = {
 FATHER: '263787876771',
 CO_CREATOR: '263717306869'
 };
let MODS = ['2348123885002', '2349168527304', '256795955270', '2347031331295'];
const CONFIG = {
 STARTING_XS: 1000,
 DAILY_XS: 100,
 COMPANY_COST: 5000,
 COMPANY_TAX_RATE: 0.15,
 USER_TAX_RATE: 0.05,
 LOAN_MAX: 10000,
 LOAN_MIN: 100,
 LOAN_INTEREST_RATE: 0.003,
 LOAN_INTEREST_PERIOD: 2 * 24 * 60 * 60 * 1000,
 CHEQUE_EXPIRY: 2 * 24 * 60 * 60 * 1000,
 JOB_COOLDOWN: 20 * 60 * 1000,
 DAILY_COOLDOWN: 24 * 60 * 60 * 1000,
 ROB_COOLDOWN: 60 * 60 * 1000,
 TAGALL_COOLDOWN: 5 * 60 * 1000,
 SUGGESTION_LIMIT: 3,
 RESPONSE_COMMAND: 3000,
 RESPONSE_CHAT: 2000,
 WARN_LIMIT: 3,
 COMPANY_BANKRUPTCY_DEBT: 600,
 MAX_LOGS: 500
 };
const DATA_DIR = path.join(__dirname, 'data');
 const DATA_FILE = path.join(DATA_DIR, 'conclave_data.json');
 const AUTH_DIR = path.join(__dirname, 'auth_info_baileys_v11');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
 if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
let USERS = {};
 let BANKS = {};
 let COMPANIES = {};
 let CHEQUES = [];
 let COOLDOWNS = {};
 let GROUP_MESSAGES = {};
 let GROUP_SETTINGS = {};
 let GROUPS = {};
 let BLACKLIST = [];
 let LOCKED_GROUPS = [];
 let WHITELISTED_GROUPS = [];
 let COUNCIL_GROUP = null;
 let GOVERNMENT_FUNDS = 10000000;
 let LOGS = [];
 let PENDING_HIRES = {};
 let BOT_ACTIVE = true;
 let isConnected = false;
 let activeSocket = null;
 let reconnectAttempts = 0;
 let pairingRequested = false;
 let currentPairingCode = null;
const GOV_JOBS = [
 { id: 1, title: 'Garbage Collector', salary: 50, tier: 'LOWER' },
 { id: 2, title: 'Street Sweeper', salary: 45, tier: 'LOWER' },
 { id: 3, title: 'Gardener', salary: 55, tier: 'LOWER' },
 { id: 4, title: 'Lamplighter', salary: 40, tier: 'LOWER' },
 { id: 5, title: 'Warehouse Worker', salary: 60, tier: 'LOWER' },
 { id: 6, title: 'Courier', salary: 65, tier: 'LOWER' },
 { id: 7, title: 'Janitor', salary: 50, tier: 'LOWER' },
 { id: 8, title: 'Cook', salary: 70, tier: 'LOWER' },
 { id: 9, title: 'Teacher', salary: 80, tier: 'WORKING' },
 { id: 10, title: 'Medic', salary: 90, tier: 'WORKING' },
 { id: 11, title: 'Guard', salary: 75, tier: 'WORKING' },
 { id: 12, title: 'Clerk', salary: 55, tier: 'WORKING' },
 { id: 13, title: 'Designer', salary: 130, tier: 'WORKING' },
 { id: 14, title: 'Writer', salary: 120, tier: 'WORKING' },
 { id: 15, title: 'Musician', salary: 125, tier: 'WORKING' },
 { id: 16, title: 'Photographer', salary: 115, tier: 'WORKING' },
 { id: 17, title: 'Developer', salary: 150, tier: 'MIDDLE' },
 { id: 18, title: 'Data Analyst', salary: 140, tier: 'MIDDLE' },
 { id: 19, title: 'Accountant', salary: 145, tier: 'MIDDLE' },
 { id: 20, title: 'Researcher', salary: 155, tier: 'MIDDLE' },
 { id: 21, title: 'Energy Technician', salary: 135, tier: 'MIDDLE' },
 { id: 22, title: 'Marine Biologist', salary: 145, tier: 'MIDDLE' },
 { id: 23, title: 'Marketing Manager', salary: 160, tier: 'UPPER' },
 { id: 24, title: 'Architect', salary: 170, tier: 'UPPER' },
 { id: 25, title: 'Lawyer', salary: 180, tier: 'UPPER' }
 ];
const BANK_JOBS = [
 { id: 1, title: 'Bank Teller', salary: 110, tier: 'WORKING' },
 { id: 2, title: 'Loan Officer', salary: 170, tier: 'MIDDLE' },
 { id: 3, title: 'Bank Analyst', salary: 210, tier: 'UPPER' },
 { id: 4, title: 'Treasury Officer', salary: 240, tier: 'ELITE' }
 ];
const FUN_COMMANDS = [
 'joke', 'truth', 'dare', '8ball', 'coinflip', 'dice', 'guess',
 'rps', 'roast', 'compliment', 'shame', 'rob'
 ];
function clean(n) {
 return n ? String(n).replace(/\D/g, '') : '';
 }
function random(a) {
 return a[Math.floor(Math.random() * a.length)];
 }
function sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }
function isFather(n) {
 return FATHER_NUMBERS.includes(clean(n));
 }
function isCoCreator(n) {
 return CO_CREATOR_NUMBERS.includes(clean(n));
 }
function isOwner(n) {
 return isFather(n) || isCoCreator(n);
 }
function isMod(n) {
 return MODS.map(clean).includes(clean(n));
 }
function isProtected(n) {
 return isOwner(n) || isMod(n);
 }
function addLog(type, actor, details = {}) {
 LOGS.unshift({
 time: Date.now(),
 type,
 actor: clean(actor),
 details
 });
 if (LOGS.length > CONFIG.MAX_LOGS) LOGS.length = CONFIG.MAX_LOGS;
 }
function loadData() {
 try {
 if (!fs.existsSync(DATA_FILE)) return;
 const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
 USERS = d.USERS || {};
 BANKS = d.BANKS || {};
 COMPANIES = d.COMPANIES || {};
 CHEQUES = d.CHEQUES || [];
 COOLDOWNS = d.COOLDOWNS || {};
 GROUP_MESSAGES = d.GROUP_MESSAGES || {};
 GROUP_SETTINGS = d.GROUP_SETTINGS || {};
 GROUPS = d.GROUPS || {};
 BLACKLIST = d.BLACKLIST || [];
 LOCKED_GROUPS = d.LOCKED_GROUPS || [];
 WHITELISTED_GROUPS = d.WHITELISTED_GROUPS || [];
 COUNCIL_GROUP = d.COUNCIL_GROUP || null;
 GOVERNMENT_FUNDS = Number.isFinite(d.GOVERNMENT_FUNDS)
 ? d.GOVERNMENT_FUNDS
 : 10000000;
 LOGS = d.LOGS || [];
 PENDING_HIRES = d.PENDING_HIRES || {};
 BOT_ACTIVE = d.BOT_ACTIVE !== false;
 if (Array.isArray(d.MODS)) MODS = d.MODS;
 console.log(Loaded ${Object.keys(USERS).length} citizens.);
 } catch (e) {
 console.error('Load error:', e.message);
 }
 }
function saveData() {
 try {
 fs.writeFileSync(DATA_FILE, JSON.stringify({
 USERS, BANKS, COMPANIES, CHEQUES, COOLDOWNS,
 GROUP_MESSAGES, GROUP_SETTINGS, GROUPS, BLACKLIST,
 LOCKED_GROUPS, WHITELISTED_GROUPS, COUNCIL_GROUP,
 GOVERNMENT_FUNDS, LOGS, PENDING_HIRES, BOT_ACTIVE, MODS
 }, null, 2));
 } catch (e) {
 console.error('Save error:', e.message);
 }
 }
function ensureUser(num, username = null) {
 num = clean(num);
 if (!num) return null;
if (!USERS[num]) {
 USERS[num] = {
 number: num,
 username: username || Citizen-${num.slice(-5)},
 profileId: CLV-${num.slice(-5).padStart(5, '0')},
 xenoShards: CONFIG.STARTING_XS,
 role: isFather(num) ? 'FATHER' :
 isCoCreator(num) ? 'CO_CREATOR' :
 isMod(num) ? 'MOD' : 'CITIZEN',
 status: 'Citizen',
 level: 1,
 joined: new Date().toISOString(),
 warns: 0,
 mutedUntil: 0,
 arrestedUntil: 0,
 job: null,
 bankJob: null,
 company: null,
 debt: 0,
 collateral: 0,
 totalEarned: 0,
 totalSpent: 0,
 workShifts: 0,
 interactions: 0,
 loanInterestApplied: 0
 };
 }
const u = USERS[num];
 if (username) u.username = username;
if (isFather(num)) u.role = 'FATHER';
 else if (isCoCreator(num)) u.role = 'CO_CREATOR';
 else if (isMod(num)) u.role = 'MOD';
u.interactions = (u.interactions || 0) + 1;
 return u;
 }
function getUserClass(num) {
 const u = ensureUser(num);
 const score =
 (u.level || 1) * 2 +
 Math.floor((u.totalEarned || 0) / 1000) +
 (u.workShifts || 0);
if (score > 350) return 'ELITE';
 if (score > 200) return 'UPPER';
 if (score > 100) return 'MIDDLE';
 if (score > 50) return 'WORKING';
 return 'LOWER';
 }
function updateStatus(num) {
 const u = ensureUser(num);
 const cls = getUserClass(num);
if (u.company) u.status = 'Businessman';
 else if (u.arrestedUntil > Date.now()) u.status = 'Arrested';
 else if (cls === 'ELITE') u.status = 'Elite';
 else if (cls === 'UPPER') u.status = 'Upper Class';
 else if (cls === 'MIDDLE') u.status = 'Middle Class';
 else if (cls === 'WORKING') u.status = 'Working Class';
 else u.status = 'Citizen';
return u;
 }
function giveXS(num, amount) {
 amount = Math.floor(Number(amount));
 if (!Number.isFinite(amount) || amount <= 0) return false;
 const u = ensureUser(num);
 u.xenoShards += amount;
 u.totalEarned += amount;
 return true;
 }
function takeXS(num, amount) {
 amount = Math.floor(Number(amount));
 if (!Number.isFinite(amount) || amount <= 0) return false;
 const u = ensureUser(num);
 if (u.xenoShards < amount) return false;
 u.xenoShards -= amount;
 u.totalSpent += amount;
 return true;
 }
function requireCitizen(num) {
 const u = ensureUser(num);
 if (!u) return '❌ Citizen identification failed.';
 return null;
 }
function isJailed(num) {
 const u = ensureUser(num);
 if (u.arrestedUntil > Date.now()) return true;
 if (u.arrestedUntil) {
 u.arrestedUntil = 0;
 if (!u.company) updateStatus(num);
 }
 return false;
 }
function jail(num, ms, reason) {
 const u = ensureUser(num);
 u.arrestedUntil = Date.now() + ms;
 u.status = 'Arrested';
 addLog('JAIL', num, { reason, until: u.arrestedUntil });
 }
function bankAccount(num) {
 num = clean(num);
 if (!BANKS[num]) {
 BANKS[num] = {
 account: XNC-${Math.floor(10000000 + Math.random() * 90000000)},
 balance: 0,
 opened: new Date().toISOString(),
 transactions: [],
 interestEarned: 0
 };
 }
 return BANKS[num];
 }
function hasBank(num) {
 return Boolean(BANKS[clean(num)]);
 }
function bankDeposit(num, amount) {
 amount = Math.floor(Number(amount));
 if (!Number.isFinite(amount) || amount <= 0) return false;
 if (!takeXS(num, amount)) return false;
 const b = bankAccount(num);
 b.balance += amount;
 b.transactions.push({ type: 'DEPOSIT', amount, time: Date.now() });
 b.transactions = b.transactions.slice(-50);
 return true;
 }
function bankWithdraw(num, amount) {
 amount = Math.floor(Number(amount));
 if (!Number.isFinite(amount) || amount <= 0) return false;
 const b = bankAccount(num);
 if (b.balance < amount) return false;
 b.balance -= amount;
 giveXS(num, amount);
 b.transactions.push({ type: 'WITHDRAW', amount, time: Date.now() });
 b.transactions = b.transactions.slice(-50);
 return true;
 }
function applyLoanInterest() {
 const now = Date.now();
 for (const [num, u] of Object.entries(USERS)) {
 if (!u.debt || u.debt <= 0) continue;
 const last = u.loanInterestApplied || u.loanStarted || now;
 const periods = Math.floor((now - last) / CONFIG.LOAN_INTEREST_PERIOD);
 if (periods <= 0) continue;
const interest = Math.max(1, Math.ceil(u.debt * CONFIG.LOAN_INTEREST_RATE * periods));  
u.debt += interest;  
u.loanInterestApplied = last + periods * CONFIG.LOAN_INTEREST_PERIOD;  
addLog('LOAN_INTEREST', num, { interest, debt: u.debt }); 

}
 }
function parseTarget(args, contextInfo) {
 let target = clean(args[0]);
 if (!target && contextInfo?.participant) target = clean(contextInfo.participant);
 return target;
 }
function targetName(num) {
 const u = USERS[clean(num)];
 return u?.username || Citizen-${clean(num).slice(-5)};
 }
function getGroupName(meta) {
 return meta?.subject || 'Unknown Group';
 }
function menuBox(sender) {
 const u = updateStatus(sender);
 const bank = BANKS[clean(sender)];
 const company = u.company ? COMPANIES[u.company] : null;
return `╔══════════════════════════════════════════╗
 ║ 🖤 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 🖤 ║
 ╠══════════════════════════════════════════╣
 ║ 📌 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡
 ║ 01. ${PREFIX}menu
 ║ 02. ${PREFIX}profile
 ║ 03. ${PREFIX}status
 ║ 04. ${PREFIX}ping
 ║ 05. ${PREFIX}members
 ║ 06. ${PREFIX}rules
 ║ 07. ${PREFIX}help
 ╠══════════════════════════════════════════╣
 ║ 🏛️ 𝗚𝗢𝗩𝗘𝗥𝗡𝗠𝗘𝗡𝗧
 ║ 08. ${PREFIX}joblist
 ║ 09. ${PREFIX}govjob
 ║ 10. ${PREFIX}govwork
 ╠══════════════════════════════════════════╣
 ║ 🏦 𝗕𝗔𝗡𝗞
 ║ 11. ${PREFIX}bank
 ║ 12. ${PREFIX}bank open
 ║ 13. ${PREFIX}bank bal
 ║ 14. ${PREFIX}bank dep
 ║ 15. ${PREFIX}bank wit
 ║ 16. ${PREFIX}bank send
 ║ 17. ${PREFIX}bank stmt
 ║ 18. ${PREFIX}bank close
 ║ 19. ${PREFIX}loan
 ║ 20. ${PREFIX}repay
 ╠══════════════════════════════════════════╣
 ║ 🧾 𝗖𝗛𝗘𝗤𝗨𝗘𝗦
 ║ 21. ${PREFIX}cheque
 ║ 22. ${PREFIX}cheque sign
 ║ 23. ${PREFIX}cheque cash
 ║ 24. ${PREFIX}cheque give
 ║ 25. ${PREFIX}cheque cancel
 ║ 26. ${PREFIX}cheque list
 ╠══════════════════════════════════════════╣
 ║ 🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬
 ║ 27. ${PREFIX}company
 ║ 28. ${PREFIX}company create
 ║ 29. ${PREFIX}company stats
 ║ 30. ${PREFIX}company hire
 ║ 31. ${PREFIX}company fire
 ║ 32. ${PREFIX}company role
 ║ 33. ${PREFIX}company pay
 ║ 34. ${PREFIX}company tax
 ║ 35. ${PREFIX}company top
 ╠══════════════════════════════════════════╣
 ║ 🎮 𝗙𝗨𝗡
 ║ 36. ${PREFIX}joke
 ║ 37. ${PREFIX}truth
 ║ 38. ${PREFIX}dare
 ║ 39. ${PREFIX}8ball
 ║ 40. ${PREFIX}coinflip
 ║ 41. ${PREFIX}dice
 ║ 42. ${PREFIX}guess
 ║ 43. ${PREFIX}rps
 ║ 44. ${PREFIX}roast
 ║ 45. ${PREFIX}compliment
 ║ 46. ${PREFIX}shame
 ║ 47. ${PREFIX}rob
 ╠══════════════════════════════════════════╣
 ║ 👥 𝗚𝗥𝗢𝗨𝗣
 ║ 48. ${PREFIX}gc
 ║ 49. ${PREFIX}gclink
 ║ 50. ${PREFIX}chat on/off
 ║ 51. ${PREFIX}active
 ║ 52. ${PREFIX}inactive
 ║ 53. ${PREFIX}tagall
 ║ 54. ${PREFIX}warn
 ║ 55. ${PREFIX}mute
 ║ 56. ${PREFIX}unmute
 ║ 57. ${PREFIX}kick
 ╠══════════════════════════════════════════╣
 ║ 🖤 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘
 ║ 58. ${PREFIX}daily
 ║ 59. ${PREFIX}suggest
 ║ 60. ${PREFIX}play
 ║ 61. ${PREFIX}logs
 ║ 62. ${PREFIX}mod
 ║ 63. ${PREFIX}activate
 ║ 64. ${PREFIX}shutdown
 ╠══════════════════════════════════════════╣
 ║ 🚧 𝗖𝗢𝗠𝗜𝗡𝗚 𝗦𝗢𝗢𝗡
 ║ • Stock
 ║ • Invest
 ║ • Buy Shares
 ║ • Sell Shares
 ║ • Company Advanced Market
 ╚══════════════════════════════════════════╝
👤 ${u.username}
 🆔 ${u.profileId}
 💰 Wallet: ${u.xenoShards} XS
 🏦 Bank: ${bank ? bank.balance : 0} XS
 🏢 Company: ${company ? company.name : 'None'}
 🏛️ Status: ${u.status}
 🎓 Class: ${getUserClass(sender)}`;
 }
function profileBox(sender) {
 const u = updateStatus(sender);
 const b = BANKS[clean(sender)];
 return ╔═ ❰ 🖤 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗜𝗗 ❱ ═╗ ║ 👤 Username: ${u.username} ║ 🆔 ID: ${u.profileId} ║ 📱 Number: ${u.number} ║ 👑 Role: ${u.role} ║ 🏛️ Status: ${u.status} ║ 🎓 Class: ${getUserClass(sender)} ║ ⭐ Level: ${u.level} ║ 💰 Wallet: ${u.xenoShards} XS ║ 🏦 Bank: ${b ? b.balance : 0} XS ║ 💳 Debt: ${u.debt || 0} XS ║ 💼 Government Job: ${u.job ? u.job.title : 'None'} ║ 🏢 Company: ${u.company || 'None'} ║ ⚠️ Warns: ${u.warns || 0}/${CONFIG.WARN_LIMIT} ║ 💬 Interactions: ${u.interactions || 0} ╚════════════════════╝;
 }
function statusBox(sender) {
 const u = updateStatus(sender);
 return ╔═ ❰ 📊 𝗦𝗧𝗔𝗧𝗨𝗦 ❱ ═╗ ║ 👤 ${u.username} ║ 🆔 ${u.profileId} ║ 🏛️ Status: ${u.status} ║ 🎓 Class: ${getUserClass(sender)} ║ ⭐ Level: ${u.level} ║ 💼 Gov Job: ${u.job ? u.job.title : 'None'} ║ 🏦 Bank Job: ${u.bankJob ? u.bankJob.title : 'None'} ║ 🏢 Company: ${u.company || 'None'} ║ 💰 Wallet: ${u.xenoShards} XS ║ 💳 Debt: ${u.debt || 0} XS ║ 📈 Earned: ${u.totalEarned || 0} XS ║ ⚠️ Warns: ${u.warns || 0} ╚════════════════════╝;
 }
function groupBox(meta, groupId) {
 const settings = GROUP_SETTINGS[groupId] || {};
 return ╔═ ❰ 📊 𝗚𝗥𝗢𝗨𝗣 𝗦𝗧𝗔𝗧𝗦 📊 ❱ ═╗ ║ 👥 𝗣𝗮𝗿𝘁𝗶𝗰𝗶𝗽𝗮𝗻𝘁𝘀: ${meta.participants.length} ║ 🛡️ 𝗔𝗱𝗺𝗶𝗻𝘀: ${meta.participants.filter(p => p.admin).length} ║ ║ 💬 𝗖𝗵𝗮𝘁: ${settings.chat ? 'true' : 'false'} ║ 🔗 𝗚𝗿𝗼𝘂𝗽 𝗟𝗶𝗻𝗸: available ║ 🕵️‍♂️ 𝗔𝗻𝘁𝗶-𝗦𝗽𝗮𝗺: ${settings.antiSpam ? 'on' : 'off'} ║ 🚫 𝗕𝗹𝗮𝗰𝗸𝗹𝗶𝘀𝘁: ${BLACKLIST.length ? BLACKLIST.length + ' users' : 'none'} ║ ║ 🎴 𝗖𝗮𝗿𝗱𝘀: removed ║ 🎮 𝗚𝗮𝗺𝗲𝘀: ${settings.games === false ? 'off' : 'on'} ║ 🎰 𝗚𝗮𝗺𝗯𝗹𝗶𝗻𝗴: removed ╚═════════════╝;
 }
function rulesBox() {
 return `📜 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗥𝗨𝗟𝗘𝗦
 ────────────────────────
Loyalty above all.
Respect citizens.
No scams.
Pay your debts.
Respect group administration.
Do not abuse Hodekai.
Government jobs require the correct status.
Company members cannot hold government jobs.
CONCLAVE protects its economy.
Higher authority is earned and recorded.`;
 }
function jobListBox(sender) {
 const cls = getUserClass(sender);
 let out = 🏛️ 𝗚𝗢𝗩𝗘𝗥𝗡𝗠𝗘𝗡𝗧 𝗝𝗢𝗕𝗦 — ${cls}\n────────────────────\n;
 GOV_JOBS.filter(j => j.tier === cls).forEach(j => {
 out += ${j.id}. ${j.title} — ${j.salary} XS/shift\n;
 });
 out += \n💡 ${PREFIX}govjob <id>;
 return out;
 }
function bankBox(sender) {
 const b = BANKS[clean(sender)];
 return ╔═ ❰ 🏦 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗕𝗔𝗡𝗞 ❱ ═╗ ║ Account: ${b ? b.account : 'Not opened'} ║ Balance: ${b ? b.balance : 0} XS ║ ║ ${PREFIX}bank open ║ ${PREFIX}bank bal ║ ${PREFIX}bank dep <amount> ║ ${PREFIX}bank wit <amount> ║ ${PREFIX}bank send <profileId> <amount> ║ ${PREFIX}bank stmt ║ ${PREFIX}bank close ║ ║ Loans require: ║ • Conclave ID ║ • Bank account ║ • Collateral ║ • No active unpaid loan ║ ║ Loan interest: 0.3% every 2 days ╚════════════════════╝;
 }
function companyBox(sender) {
 const u = ensureUser(sender);
 if (!u.company) {
 return `🏢 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗖𝗢𝗠𝗣𝗔𝗡𝗬
 ────────────────────
 Create cost: ${CONFIG.COMPANY_COST} XS
 One company per citizen.
${PREFIX}company create
 ${PREFIX}company stats
 ${PREFIX}company hire
 ${PREFIX}company fire
 ${PREFIX}company role
 ${PREFIX}company pay
 ${PREFIX}company tax
 ${PREFIX}company top
🚧 Stock / investing systems are COMING SOON.`;
 }
const c = COMPANIES[u.company];
 if (!c) {
 u.company = null;
 return companyBox(sender);
 }
const profit = c.revenue - c.expenses;
 return ╔═ ❰ 🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 ❱ ═╗ ║ Name: ${c.name} ║ CEO: ${targetName(c.owner)} ║ Employees: ${c.employees.length} ║ Bank: ${c.bank} XS ║ Revenue: ${c.revenue} XS ║ Expenses: ${c.expenses} XS ║ Profit: ${profit} XS ║ Tax Debt: ${c.taxDebt || 0} XS ║ Status: ${c.bankrupt ? 'BANKRUPT' : 'ACTIVE'} ║ ║ ${PREFIX}company stats ║ ${PREFIX}company hire <number> ║ ${PREFIX}company fire <number> ║ ${PREFIX}company role <number> <role> ║ ${PREFIX}company pay <number> <amount> ║ ${PREFIX}company tax ╚════════════════════╝;
 }
function secretBox() {
 return ╔══════════════════════════════════════╗ ║ 🔒 𝗛𝗢𝗗𝗘𝗞𝗔𝗜 𝗦𝗘𝗖𝗥𝗘𝗧 — 𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗧𝗬 ║ ╠══════════════════════════════════════╣ ║ :activate ║ :shutdown ║ :setcouncil ║ :setrules ║ :mod add <number> ║ :mod remove <number> ║ :whitelist add ║ :whitelist remove ║ :blacklist add <number> ║ :blacklist remove <number> ║ :logs ║ :viewall ║ :addmoney ║ :removemoney ╚══════════════════════════════════════╝;
 }
async function isWaAdmin(sock, groupId, number) {
 try {
 const meta = await sock.groupMetadata(groupId);
 const target = clean(number);
 const p = meta.participants.find(x =>
 clean((x.id || '').split('@')[0].split(':')[0]) === target
 );
 return Boolean(p?.admin);
 } catch {
 return false;
 }
 }
async function isBotAdmin(sock, groupId) {
 try {
 const meta = await sock.groupMetadata(groupId);
 const bot = clean(sock.user?.id?.split(':')[0].split('@')[0]);
 const p = meta.participants.find(x =>
 clean((x.id || '').split('@')[0].split(':')[0]) === bot
 );
 return Boolean(p?.admin);
 } catch {
 return false;
 }
 }
function cooldown(sender, key, ms) {
 const now = Date.now();
 if (!COOLDOWNS[sender]) COOLDOWNS[sender] = {};
 const last = COOLDOWNS[sender][key] || 0;
 if (now - last < ms) {
 return Math.ceil((ms - (now - last)) / 1000);
 }
 COOLDOWNS[sender][key] = now;
 return 0;
 }
function formatUptime(sec) {
 const s = Math.floor(sec);
 const d = Math.floor(s / 86400);
 const h = Math.floor((s % 86400) / 3600);
 const m = Math.floor((s % 3600) / 60);
 const x = s % 60;
 return ${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m ? m + 'm ' : ''}${x}s;
 }
async function handleCommand(cmd, args, sender, groupId, sock, msg, contextInfo, isGroup, isWaAdminFlag) {
 const user = updateStatus(sender);
 const c = cmd.toLowerCase();
if (c !== 'ping' && c !== 'help' && isJailed(sender)) {
 const left = Math.ceil((user.arrestedUntil - Date.now()) / 60000);
 return 🚔 You are jailed for another ${left} minute(s). Some commands are unavailable.;
 }
const economyCommands = new Set([
 'daily', 'pay', 'loan', 'repay', 'rob', 'govjob', 'govwork',
 'bank', 'cheque', 'company'
 ]);
if (economyCommands.has(c) && !user.profileId) {
 return '❌ You need a CONCLAVE ID first.';
 }
if (c === 'menu') return menuBox(sender);
 if (c === 'profile') return profileBox(sender);
 if (c === 'status') return statusBox(sender);
 if (c === 'rules') return rulesBox();
if (c === 'members') {
 return 👥 Citizens: ${Object.keys(USERS).length}\n🏛️ Mods: ${MODS.length};
 }
if (c === 'ping') {
 try {
 await sock.sendMessage(groupId || sender, {
 react: { text: '🏓', key: msg.key }
 });
 } catch {}
 const base = 🏓 𝗣𝗢𝗡𝗚\n\n🖤 Hodekai ONLINE\n⏱️ Uptime: ${formatUptime(process.uptime())}\n👥 Citizens: ${Object.keys(USERS).length}\n🏦 Banks: ${Object.keys(BANKS).length}\n🏢 Companies: ${Object.keys(COMPANIES).length};
 if (isProtected(sender)) {
 const mem = process.memoryUsage();
 const ram = ((mem.rss / osTotalMemory()) * 100).toFixed(1);
 return ${base}\n\n⚙️ NODE: ${process.version}\n🧠 RAM: ${ram}%\n💾 RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB\n🖥️ CPU: ${process.cpuUsage().user}µs user;
 }
 return base;
 }
if (c === 'bank') {
 const sub = (args[0] || '').toLowerCase();
 if (!sub) return bankBox(sender);
if (sub === 'open') {  
  const existed = hasBank(sender);  
  const b = bankAccount(sender);  
  saveData();  
  return existed  
    ? `🏦 Your bank account already exists.\n🆔 ${b.account}\n💰 ${b.balance} XS`  
    : `🏦 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 𝗢𝗣𝗘𝗡𝗘𝗗\n🆔 ${b.account}\n💰 ${b.balance} XS`;  
}  

if (!hasBank(sender)) return `❌ Open a bank account first: ${PREFIX}bank open`;  

if (sub === 'bal' || sub === 'balance') {  
  const b = BANKS[sender];  
  return `🏦 ${b.account}\n💰 Bank: ${b.balance} XS\n💵 Wallet: ${user.xenoShards} XS`;  
}  

if (sub === 'dep' || sub === 'deposit') {  
  const amount = parseInt(args[1], 10);  
  if (!bankDeposit(sender, amount)) return '❌ Invalid amount or insufficient wallet funds.';  
  saveData();  
  return `✅ Deposited ${amount} XS.\n🏦 Bank: ${BANKS[sender].balance} XS`;  
}  

if (sub === 'wit' || sub === 'withdraw') {  
  const amount = parseInt(args[1], 10);  
  if (!bankWithdraw(sender, amount)) return '❌ Invalid amount or insufficient bank balance.';  
  saveData();  
  return `✅ Withdrawn ${amount} XS.\n💵 Wallet: ${user.xenoShards} XS`;  
}  

if (sub === 'send' || sub === 'transfer') {  
  const targetId = (args[1] || '').toUpperCase();  
  const amount = parseInt(args[2], 10);  
  let target = null;  

  for (const n of Object.Keys(USERS)) {  
    if (USERS[n].profileId === targetId) {  
      target = n;  
      break;  
    }  
  }  
  if (!target && /^\d+$/.test(targetId)) target = clean(targetId);  

  if (!target || !USERS[target]) return '❌ Citizen not found. Use their CLV profile ID.';  
  if (target === sender) return '❌ You cannot transfer to yourself.';  
  if (!Number.isFinite(amount) || amount <= 0) return '❌ Invalid amount.';  

  const from = bankAccount(sender);  
  const to = bankAccount(target);  
  if (from.balance < amount) return '❌ Insufficient bank balance.';  

  from.balance -= amount;  
  to.balance += amount;  
  from.transactions.push({ type: 'SENT', to: target, amount, time: Date.now() });  
  to.transactions.push({ type: 'RECEIVED', from: sender, amount, time: Date.now() });  
  saveData();  
  return `✅ Transfer complete.\n👤 To: ${targetName(target)}\n🆔 ${USERS[target].profileId}\n💰 ${amount} XS`;  
}  

if (sub === 'stmt' || sub === 'statement') {  
  const b = BANKS[sender];  
  if (!b.transactions.length) return '📋 No transactions yet.';  
  return `📋 𝗕𝗔𝗡𝗞 𝗦𝗧𝗔𝗧𝗘𝗠𝗘𝗡𝗧\n${b.transactions.slice(-10).reverse()  
    .map(t => `• ${t.type}: ${t.amount} XS — ${new Date(t.time).toLocaleString()}`)  
    .join('\n')}`;  
}  

if (sub === 'close') {  
  const b = BANKS[sender];  
  if (b.balance > 0) return '❌ Withdraw your bank balance before closing the account.';  
  delete BANKS[sender];  
  saveData();  
  return '🏦 Account closed.';  
}  

return bankBox(sender); 

}
if (c === 'loan') {
 if (!hasBank(sender)) return ❌ Bank account required: ${PREFIX}bank open;
 if (user.debt > 0) return ❌ Existing debt: ${user.debt} XS;
 const amount = parseInt(args[0], 10);
 if (!Number.isFinite(amount) || amount < CONFIG.LOAN_MIN || amount > CONFIG.LOAN_MAX) {
 return ❌ Loan must be ${CONFIG.LOAN_MIN}-${CONFIG.LOAN_MAX} XS.;
 }
const collateral = Math.min(  
  user.xenoShards + BANKS[sender].balance,  
  amount  
);  

if (collateral <= 0) return '❌ Loan denied. You need collateral.';  
user.collateral = collateral;  
user.debt = amount;  
user.loanStarted = Date.now();  
user.loanInterestApplied = Date.now();  
giveXS(sender, amount);  
saveData();  

return `🏦 𝗟𝗢𝗔𝗡 𝗔𝗣𝗣𝗥𝗢𝗩𝗘𝗗\n💰 Amount: ${amount} XS\n🔐 Collateral: ${collateral} XS\n📈 Interest: 0.3% every 2 days\n💳 Debt: ${user.debt} XS`; 

}
if (c === 'repay') {
 if (!user.debt) return 'ℹ️ You have no debt.';
 const amount = parseInt(args[0], 10);
 if (!Number.isFinite(amount) || amount <= 0) return ❌ ${PREFIX}repay <amount>;
 if (!takeXS(sender, Math.min(amount, user.debt))) return '❌ Insufficient wallet funds.';
const paid = Math.min(amount, user.debt);  
user.debt -= paid;  
if (user.debt <= 0) {  
  user.debt = 0;  
  user.collateral = 0;  
}  
GOVERNMENT_FUNDS += paid;  
saveData();  
return `✅ Repaid ${paid} XS.\n💳 Remaining debt: ${user.debt} XS`; 

}
if (c === 'daily') {
 const left = cooldown(sender, 'daily', CONFIG.DAILY_COOLDOWN);
 if (left) return ⏳ Daily income available in ${Math.ceil(left / 3600)}h.;
 giveXS(sender, CONFIG.DAILY_XS);
 saveData();
 return 📅 +${CONFIG.DAILY_XS} XS.\n💰 Wallet: ${user.xenoShards} XS;
 }
if (c === 'joblist') return jobListBox(sender);
if (c === 'govjob') {
 if (user.company) return '❌ Company members cannot hold government jobs.';
 if (user.job) return ❌ You already work as ${user.job.title}.;
 const id = parseInt(args[0], 10);
 if (!id) return jobListBox(sender);
 const job = GOV_JOBS.find(j => j.id === id);
 if (!job) return '❌ Invalid job.';
 if (job.tier !== getUserClass(sender)) return ❌ Your Conclave class is ${getUserClass(sender)}. That job requires ${job.tier}.;
 user.job = { ...job, shifts: 0, lastWork: 0 };
 saveData();
 return 🏛️ 𝗚𝗢𝗩𝗘𝗥𝗡𝗠𝗘𝗡𝗧 𝗝𝗢𝗕 𝗚𝗥𝗔𝗡𝗧𝗘𝗗\n📋 ${job.title}\n💰 ${job.salary} XS/shift\n💡 ${PREFIX}govwork;
 }
if (c === 'govwork') {
 if (!user.job) return ❌ You have no government job. Use ${PREFIX}joblist.;
 if (user.company) return '❌ You cannot work a government job while in a company.';
 const left = cooldown(sender, 'govwork', CONFIG.JOB_COOLDOWN);
 if (left) return ⏳ Work available in ${Math.ceil(left / 60)} minutes.;
let gross = user.job.salary;  
if (Math.random() > 0.85) gross += Math.floor(gross * 0.2);  
const tax = Math.floor(gross * CONFIG.USER_TAX_RATE);  
const net = gross - tax;  

giveXS(sender, net);  
GOVERNMENT_FUNDS += tax;  
user.job.shifts++;  
user.workShifts++;  
updateStatus(sender);  
saveData();  

return `🏛️ 𝗦𝗛𝗜𝗙𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘\n💼 ${user.job.title}\n💰 Gross: ${gross} XS\n🏛️ Tax: ${tax} XS\n💵 Net: ${net} XS\n📈 Shifts: ${user.job.shifts}`; 

}
if (c === 'cheque') {
 if (!hasBank(sender)) return ❌ A bank account is required for cheques: ${PREFIX}bank open;
 const sub = (args[0] || '').toLowerCase();
if (sub === 'sign') {  
  const target = clean(args[1]);  
  const amount = parseInt(args[2], 10);  
  if (!target || !USERS[target] || !Number.isFinite(amount) || amount <= 0) {  
    return `❌ ${PREFIX}cheque sign <number> <amount>`;  
  }  
  if (target === sender) return '❌ You cannot sign a cheque to yourself.';  
  if (BANKS[sender].balance < amount) return '❌ Insufficient bank balance.';  
  BANKS[sender].balance -= amount;  

  const id = `CHQ${Date.now().toString().slice(-7)}`;  
  CHEQUES.push({  
    id, from: sender, to: target, amount,  
    signed: Date.now(),  
    expires: Date.now() + CONFIG.CHEQUE_EXPIRY,  
    cashed: false  
  });  
  saveData();  

  return `📝 𝗖𝗛𝗘𝗤𝗨𝗘 𝗦𝗜𝗚𝗡𝗘𝗗\n🆔 ${id}\n👤 To: ${targetName(target)}\n💰 ${amount} XS\n⏰ Must be cashed within 2 days.\n💡 Recipient uses ${PREFIX}cheque cash ${id}`;  
}  

if (sub === 'cash') {  
  const id = args[1];  
  const ch = CHEQUES.find(x => x.id === id && !x.cashed);  
  if (!ch) return '❌ Cheque not found.';  
  if (ch.to !== sender) return '❌ This cheque belongs to another citizen.';  
  if (Date.now() > ch.expires) return '❌ Cheque expired. Contact CONCLAVE administration.';  
  giveXS(sender, ch.amount);  
  ch.cashed = true;  
  ch.cashedAt = Date.now();  
  saveData();  
  return `💰 𝗖𝗛𝗘𝗤𝗨𝗘 𝗖𝗔𝗦𝗛𝗘𝗗\n🆔 ${id}\n💰 ${ch.amount} XS\n💵 Wallet: ${user.xenoShards} XS`;  
}  

if (sub === 'give' || sub === 'transfer') {  
  const id = args[1];  
  const target = clean(args[2]);  
  const ch = CHEQUES.find(x => x.id === id && !x.cashed);  
  if (!ch || ch.to !== sender) return '❌ You do not control that cheque.';  
  if (!target || !USERS[target]) return '❌ Target citizen not found.';  
  ch.to = target;  
  saveData();  
  return `📝 Cheque ${id} transferred to ${targetName(target)}.`;  
}  

if (sub === 'cancel') {  
  const id = args[1];  
  const ch = CHEQUES.find(x => x.id === id && !x.cashed && x.from === sender);  
  if (!ch) return '❌ Cheque not found.';  
  if (Date.now() > ch.expires) return '❌ Cheque expired.';  
  BANKS[sender].balance += ch.amount;  
  ch.cashed = true;  
  ch.cancelled = true;  
  saveData();  
  return `✅ Cheque cancelled.\n🏦 ${ch.amount} XS returned to your bank.`;  
}  

if (sub === 'list' || !sub) {  
  const incoming = CHEQUES.filter(x => x.to === sender && !x.cashed && x.expires > Date.now());  
  const outgoing = CHEQUES.filter(x => x.from === sender && !x.cashed);  
  return `📋 𝗖𝗛𝗘𝗤𝗨𝗘 𝗕𝗢𝗔𝗥𝗗 

────────────────
 📥 INCOMING: ${incoming.length}
 ${incoming.map(x => • ${x.id} — ${x.amount} XS — from ${targetName(x.from)}).join('\n') || '• none'}
📤 OUTGOING: ${outgoing.length}
 ${outgoing.map(x => • ${x.id} — ${x.amount} XS — to ${targetName(x.to)}).join('\n') || '• none'}
⏰ Cheques expire after 2 days.
 🏦 Bank account required.`;
 }
return `🧾 ${PREFIX}cheque sign <number> <amount> 

${PREFIX}cheque cash
 ${PREFIX}cheque give
 ${PREFIX}cheque cancel
 ${PREFIX}cheque list`;
 }
if (c === 'pay') {
 const target = parseTarget(args, contextInfo);
 const amount = parseInt(args[1] || args[0], 10);
 if (!target || !USERS[target]) return '❌ Reply to a citizen or provide their number.';
 if (!Number.isFinite(amount) || amount <= 0) return '❌ Invalid amount.';
 if (!takeXS(sender, amount)) return '❌ Insufficient wallet funds.';
 giveXS(target, amount);
 saveData();
 return 💸 Sent ${amount} XS to ${targetName(target)}.;
 }
if (c === 'rob') {
 const target = parseTarget(args, contextInfo);
 if (!target || !USERS[target]) return ❌ ${PREFIX}rob <number> or reply to a user.;
 if (target === sender) return '❌ You cannot rob yourself.';
 if (isProtected(target)) return '❌ Protected citizen.';
 const left = cooldown(sender, 'rob', CONFIG.ROB_COOLDOWN);
 if (left) return ⏳ Robbery cooldown: ${Math.ceil(left / 60)} minutes.;
const victim = ensureUser(target);  
if (Math.random() <= 0.5 && victim.xenoShards > 0) {  
  const stolen = Math.max(1, Math.floor(victim.xenoShards * 0.2));  
  takeXS(target, stolen);  
  giveXS(sender, stolen);  
  saveData();  
  addLog('ROBBERY', sender, { target, result: 'success', amount: stolen });  
  return `🥷 𝗥𝗢𝗕𝗕𝗘𝗥𝗬 𝗦𝗨𝗖𝗖𝗘𝗦𝗦\n💰 Stolen: ${stolen} XS\n👤 Victim: ${targetName(target)}`;  
}  

const fine = Math.min(user.xenoShards, 500);  
takeXS(sender, fine);  
GOVERNMENT_FUNDS += fine;  
jail(sender, 60 * 60 * 1000, 'Failed robbery');  
addLog('ROBBERY', sender, { target, result: 'caught', fine });  
saveData();  
return `🚔 𝗖𝗔𝗨𝗚𝗛𝗧\n⛓️ Jail: 1 hour\n💸 Fine: ${fine} XS\n🖤 CONCLAVE remembers.`; 

}
if (c === 'company') {
 const sub = (args[0] || '').toLowerCase();
 if (!sub) return companyBox(sender);
if (sub === 'create') {  
  if (user.company) return '❌ You already own/belong to a company.';  
  if (user.job) return '❌ Leave your government job first.';  
  const name = args.slice(1).join(' ').trim();  
  if (!name) return `❌ ${PREFIX}company create <name>`;  
  if (COMPANIES[name]) return '❌ Company already exists.';  
  if (!hasBank(sender)) return `❌ Bank account required.`;  
  if (user.debt > 0) return '❌ Pay your debt first.';  
  if (user.xenoShards < CONFIG.COMPANY_COST) return `❌ Need ${CONFIG.COMPANY_COST} XS.`;  

  takeXS(sender, CONFIG.COMPANY_COST);  
  COMPANIES[name] = {  
    name,  
    owner: sender,  
    employees: [sender],  
    roles: { [sender]: 'CEO' },  
    bank: 0,  
    revenue: 0,  
    expenses: CONFIG.COMPANY_COST,  
    taxDebt: 0,  
    founded: Date.now(),  
    bankrupt: false,  
    records: []  
  };  
  user.company = name;  
  user.status = 'Businessman';  
  addLog('COMPANY_CREATE', sender, { company: name });  
  saveData();  
  return `🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 𝗙𝗢𝗨𝗡𝗗𝗘𝗗\n📛 ${name}\n👑 CEO: ${user.username}\n💰 Cost: ${CONFIG.COMPANY_COST} XS`;  
}  

const company = COMPANIES[user.company];  
if (!company) return '❌ You are not attached to a company.';  

if (company.bankrupt) return '🚫 Company is bankrupt.';  

if (sub === 'stats' || sub === 'info') {  
  const profit = company.revenue - company.expenses;  
  return `╔═ ❰ 🏢 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 𝗥𝗘𝗖𝗢𝗥𝗗 ❱ ═╗ 

║ 📛 ${company.name}
 ║ 👑 CEO: ${targetName(company.owner)}
 ║ 👥 Employees: ${company.employees.length}
 ║ 🏦 Bank: ${company.bank} XS
 ║ 📈 Revenue: ${company.revenue} XS
 ║ 📉 Expenses: ${company.expenses} XS
 ║ 💵 Profit: ${profit} XS
 ║ 🏛️ Tax Debt: ${company.taxDebt || 0} XS
 ║ 📅 Founded: ${new Date(company.founded).toLocaleDateString()}
 ║ 📊 Status: ${company.bankrupt ? 'BANKRUPT' : 'ACTIVE'}
 ╚════════════════════╝`;
 }
if (sub === 'hire') {  
  if (company.owner !== sender) return '❌ CEO only.';  
  const target = parseTarget(args.slice(1), contextInfo);  
  if (!target) return '❌ Provide/reply to a citizen.';  
  if (!USERS[target]) ensureUser(target);  
  if (USERS[target].company) return '❌ Citizen already belongs to a company.';  
  PENDING_HIRES[target] = { company: company.name, from: sender, created: Date.now() };  
  saveData();  

  try {  
    await sock.sendMessage(target + '@s.whatsapp.net', {  
      text: `📨 𝗖𝗢𝗠𝗣𝗔𝗡𝗬 𝗢𝗙𝗙𝗘𝗥\n🏢 ${company.name}\n👑 ${targetName(sender)}\n\n${PREFIX}accept — accept\n${PREFIX}decline — refuse`  
    });  
  } catch {}  
  return `📨 Offer sent to ${targetName(target)}.`;  
}  

if (sub === 'fire') {  
  if (company.owner !== sender) return '❌ CEO only.';  
  const target = parseTarget(args.slice(1), contextInfo);  
  if (!target || target === company.owner) return '❌ Invalid employee.';  
  if (!company.employees.includes(target)) return '❌ Not employed.';  
  company.employees = company.employees.filter(x => x !== target);  
  delete company.roles[target];  
  if (USERS[target]) USERS[target].company = null;  
  saveData();  
  return `🚪 ${targetName(target)} removed from ${company.name}.`;  
}  

if (sub === 'role') {  
  if (company.owner !== sender) return '❌ CEO only.';  
  const target = clean(args[1]);  
  const role = args.slice(2).join(' ').trim();  
  if (!target || !role || !company.employees.includes(target)) return '❌ ${PREFIX}company role <number> <role>';  
  company.roles[target] = role;  
  saveData();  
  return `👔 ${targetName(target)} appointed as ${role}.`;  
}  

if (sub === 'pay') {  
  if (company.owner !== sender) return '❌ CEO only.';  
  const target = clean(args[1]);  
  const amount = parseInt(args[2], 10);  
  if (!target || !company.employees.includes(target) || !Number.isFinite(amount) || amount <= 0) {  
    return '❌ Invalid employee/amount.';  
  }  
  if (company.bank < amount) return '❌ Company bank is insufficient.';  
  company.bank -= amount;  
  giveXS(target, amount);  
  company.expenses += amount;  
  saveData();  
  return `💸 ${amount} XS paid to ${targetName(target)}.`;  
}  

if (sub === 'tax') {  
  if (company.owner !== sender) return '❌ CEO only.';  
  const profit = Math.max(0, company.revenue - company.expenses);  
  const tax = Math.floor(profit * CONFIG.COMPANY_TAX_RATE);  
  if (tax <= 0) return 'ℹ️ No taxable profit yet.';  
  if (company.bank < tax) {  
    company.taxDebt = (company.taxDebt || 0) + tax;  
    if (company.taxDebt > CONFIG.COMPANY_BANKRUPTCY_DEBT) {  
      company.bankrupt = true;  
    }  
    saveData();  
    return `⚠️ Tax debt: ${company.taxDebt} XS.\n${company.bankrupt ? '🏚️ COMPANY FILED BANKRUPTCY.' : 'Pay the debt before it exceeds 600 XS.'}`;  
  }  
  company.bank -= tax;  
  GOVERNMENT_FUNDS += tax;  
  company.taxDebt = 0;  
  saveData();  
  return `🏛️ Tax paid: ${tax} XS.`;  
}  

if (sub === 'top') {  
  return Object.values(COMPANIES)  
    .sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses))  
    .slice(0, 10)  
    .map((x, i) => `${i + 1}. ${x.name} — ${x.revenue - x.expenses} XS`)  
    .join('\n') || '📭 No companies.';  
}  

return companyBox(sender); 

}
if (c === 'accept' || c === 'decline') {
 const offer = PENDING_HIRES[sender];
 if (!offer) return '❌ No pending company offer.';
 if (c === 'decline') {
 delete PENDING_HIRES[sender];
 saveData();
 return '❌ Offer declined.';
 }
 if (user.company) return '❌ You already belong to a company.';
 const company = COMPANIES[offer.company];
 if (!company || company.bankrupt) return '❌ Company unavailable.';
 company.employees.push(sender);
 company.roles[sender] = 'Employee';
 user.company = offer.company;
 user.job = null;
 user.bankJob = null;
 user.status = 'Businessman';
 delete PENDING_HIRES[sender];
 saveData();
 return ✅ You joined ${offer.company}.;
 }
if (FUN_COMMANDS.includes(c)) {
 if (c === 'joke') return 😈 ${random([ 'Why did the bot cross the server? To avoid your code.',
 'I would tell you a UDP joke, but you might not get it.',
 '404: Sense of humor not found. Oh wait, here it is.',
 'Why do programmers hate nature? Too many bugs.',
 'My code has no bugs. It just developed random features.',
 'How many developers does it take to change a lightbulb? None, that\'s a hardware problem.',
 'I\'m not lazy, I\'m on power-saving mode.',
 'Why did the JS developer quit? He didn\'t get arrays.',
 'There are 10 types of people: those who understand binary and those who don\'t.',
 'Debugging: Being the detective in a crime movie where you are also the murderer.' ])};
if (c === 'econjoke') return `💰 ${random([
 'Why did the XS go to therapy? It had too many bank issues.',
 'I invested in a company. It bankrupt me emotionally.',
 'My wallet is like my code: empty but full of promises.',
 'Bank: "Insufficient funds" Me: "Insufficient motivation"'
])}`;
if (c === 'truth') return `🎯 TRUTH\n${random([  
  'What is one goal you refuse to give up on?',  
  'What is your biggest harmless embarrassment?',  
  'Who in this group would survive a CONCLAVE audit?'  
])}`;  

if (c === 'dare') return `🎯 DARE\n${random([  
  'Send a funny voice note.',  
  'Change your status to something ridiculous for ten minutes.',  
  'Compliment the last person who helped you.'  
])}`;  

if (c === '8ball') {  
  if (!args.length) return `❌ ${PREFIX}8ball <question>`;  
  return `🎱 ${random(['Yes.', 'No.', 'Maybe.', 'Ask again.', 'Absolutely.', 'Very doubtful.'])}`;  
}  

if (c === 'coinflip') return `🪙 ${Math.random() > 0.5 ? 'HEADS' : 'TAILS'}`;  
if (c === 'dice') return `🎲 You rolled ${Math.floor(Math.random() * 6) + 1}.`;  

if (c === 'guess') {  
  const n = parseInt(args[0], 10);  
  if (!n || n < 1 || n > 100) return `❌ ${PREFIX}guess <1-100>`;  
  if (!user._guessSecret) user._guessSecret = Math.floor(Math.random() * 100) + 1;  
  if (n === user._guessSecret) {  
    user._guessSecret = null;  
    giveXS(sender, 50);  
    saveData();  
    return '🎯 CORRECT! +50 XS';  
  }  
  return n < user._guessSecret ? '📈 Higher.' : '📉 Lower.';  
}  

if (c === 'rps') {  
  const choice = (args[0] || '').toLowerCase();  
  if (!['rock', 'paper', 'scissors'].includes(choice)) return `❌ ${PREFIX}rps rock/paper/scissors`;  
  const bot = random(['rock', 'paper', 'scissors']);  
  if (choice === bot) return `🤝 Draw.\nYou: ${choice}\nHodekai: ${bot}`;  
  const win = (choice === 'rock' && bot === 'scissors') ||  
              (choice === 'paper' && bot === 'rock') ||  
              (choice === 'scissors' && bot === 'paper');  
  if (win) {  
    giveXS(sender, 25);  
    saveData();  
  }  
  return `${win ? '🎉 You win +25 XS.' : '💀 You lose.'}\nYou: ${choice}\nHodekai: ${bot}`;  
}  

const target = parseTarget(args, contextInfo);  
const name = target ? targetName(target) : 'you';  

if (c === 'roast') return `🔥 ${name}, Hodekai has reviewed the evidence. Your confidence is doing more work than your skills.`;  
if (c === 'compliment') return `🖤 ${name}, even I have to admit: you're doing better than most citizens.`;  
if (c === 'shame') return `📜 ${name}, CONCLAVE records this moment under: "Questionable Decisions."`; 

}
if (c === 'gc') {
 if (!groupId) return '❌ Groups only.';
 const meta = await sock.groupMetadata(groupId);
 return groupBox(meta, groupId);
 }
if (c === 'chat') {
 if (!groupId) return '❌ Groups only.';
 if (!isWaAdminFlag && !isProtected(sender)) return '❌ Group admins/Mods only.';
 const value = (args[0] || '').toLowerCase();
 if (!['on', 'off'].includes(value)) return ❌ ${PREFIX}chat on/off;
 GROUP_SETTINGS[groupId] = GROUP_SETTINGS[groupId] || {};
 GROUP_SETTINGS[groupId].chat = value === 'on';
 saveData();
 return 💬 Hodekai group chat: ${value.toUpperCase()};
 }
if (c === 'gclink') {
 if (!groupId) return '❌ Groups only.';
 try {
 const code = await sock.groupInviteCode(groupId);
 return 🔗 https://chat.whatsapp.com/${code};
 } catch {
 return '❌ I cannot retrieve the group link.';
 }
 }
if (c === 'active' || c === 'inactive') {
 if (!groupId) return '❌ Groups only.';
 const data = GROUP_MESSAGES[groupId] || {};
 const sorted = Object.entries(data).sort((a, b) =>
 c === 'active' ? b[1] - a[1] : a[1] - b[1]
 );
 if (!sorted.length) return '📭 No activity recorded.';
 return ${c === 'active' ? '📈 ACTIVE CITIZENS' : '📉 INACTIVE CITIZENS'}\n +
 sorted.slice(0, 10).map((x, i) => ${i + 1}. ${targetName(x[0])} — ${x[1]} msgs).join('\n');
 }
if (['kick', 'mute', 'unmute', 'warn', 'tagall' ‘close group’, ‘open group’].includes(c)) {
 if (!groupId) return '❌ Groups only.';
 if (!(isWaAdminFlag || isProtected(sender))) return '❌ Group admins/Mods/Owners only.';
 if (!(await isBotAdmin(sock, groupId))) return '❌ Hodekai must be a group admin first.';
const target = parseTarget(args, contextInfo);  

if (c === 'kick') {  
  if (!target) return `❌ ${PREFIX}kick <number> or reply.`;  
  if (isProtected(target)) return '❌ Protected authority cannot be kicked by this command.';  
  try {  
    await sock.groupParticipantsUpdate(groupId, [target + '@s.whatsapp.net'], 'remove');  
    addLog('KICK', sender, { target, groupId });  
    return `⚠️ ${targetName(target)} removed.`;  
  } catch (e) {  
    return `❌ ${e.message}`;  
  }  
}  

if (c === 'mute') {  
  if (!target) return `❌ ${PREFIX}mute <minutes> <number> or reply.`;  
  const minutes = parseInt(args[0], 10) || 10;  
  const actualTarget = clean(args[1]) || clean(contextInfo?.participant) || target;  
  const t = ensureUser(actualTarget);  
  t.mutedUntil = Date.now() + minutes * 60000;  
  addLog('MUTE', sender, { target: actualTarget, minutes, groupId });  
  saveData();  
  return `🔇 ${targetName(actualTarget)} muted for ${minutes} minutes.`;  
}  

if (c === 'unmute') {  
  if (!target) return `❌ ${PREFIX}unmute <number> or reply.`;  
  ensureUser(target).mutedUntil = 0;  
  saveData();  
  return `🔊 ${targetName(target)} unmuted.`;  
}  

if (c === 'warn') {  
  if (!target) return `❌ ${PREFIX}warn <number> or reply.`;  
  const t = ensureUser(target);  
  t.warns++;  
  addLog('WARN', sender, { target, warns: t.warns, groupId });  
  saveData();  
  if (t.warns >= CONFIG.WARN_LIMIT) {  
    return `⚠️ ${targetName(target)} reached ${CONFIG.WARN_LIMIT}/${CONFIG.WARN_LIMIT} warnings.`;  
  }  
  return `⚠️ ${targetName(target)} warned: ${t.warns}/${CONFIG.WARN_LIMIT}.`;  
}  

if (c === 'tagall') {  
  const left = cooldown(sender, 'tagall', CONFIG.TAGALL_COOLDOWN);  
  if (left) return `⏳ Tagall cooldown: ${Math.ceil(left / 60)} minutes.`;  
  const meta = await sock.groupMetadata(groupId);  
  const mentions = meta.participants.map(p => p.id);  
  const text = `📢 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗔𝗧𝗧𝗘𝗡𝗧𝗜𝗢𝗡\n\n` +  
    meta.participants.map(p => `@${p.id.split('@')[0]}`).join('\n');  
  await sock.sendMessage(groupId, { text, mentions });  
  return null;  
} 

}
if (c === 'suggest') {
 if (!groupId) return '❌ Suggestions can be submitted from a group.';
 const today = new Date().toISOString().slice(0, 10);
 if (!user.suggestions) user.suggestions = {};
 user.suggestions[today] = user.suggestions[today] || 0;
 if (user.suggestions[today] >= CONFIG.SUGGESTION_LIMIT) {
 return ❌ Daily suggestion limit reached (${CONFIG.SUGGESTION_LIMIT}).;
 }
const raw = args.join(' ');  
const parts = raw.split('|').map(x => x.trim());  
if (parts.length < 2) return `❌ ${PREFIX}suggest <title> | <description>`;  
user.suggestions[today]++;  

if (COUNCIL_GROUP) {  
  try {  
    await sock.sendMessage(COUNCIL_GROUP, {  
      text: `📨 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗦𝗨𝗚𝗚𝗘𝗦𝗧𝗜𝗢𝗡\n👤 ${user.username}\n🆔 ${user.profileId}\n📌 ${parts[0]}\n📝 ${parts.slice(1).join(' | ')}`  
    });  
  } catch {}  
} else {  
  return '❌ No Council group has been configured yet.';  
}  

saveData();  
return '✅ Suggestion delivered to the CONCLAVE Council.'; 

}
if (c === 'logs') {
 if (!isProtected(sender)) return '❌ Protected command.';
 if (!LOGS.length) return '📋 No suspicious activity recorded.';
 return ╔═ ❰ 🕵️ 𝗖𝗢𝗡𝗖𝗟𝗔𝗩𝗘 𝗟𝗢𝗚𝗦 ❱ ═╗ ${LOGS.slice(0, 15).map((x, i) => ║ ${i + 1}. ${x.type}\n║ 👤 ${targetName(x.actor)}\n║ 🕒 ${new Date(x.time).toLocaleString()} ).join('\n')} ╚════════════════════╝;
 }
if (c === 'activate') {
 if (!isProtected(sender)) return '❌ Mods/Owners only.';
 BOT_ACTIVE = true;
 saveData();
 return '🟢 Hodekai activated.';
 }
if (c === 'shutdown') {
 if (!isProtected(sender)) return '❌ Mods/Owners only.';
 BOT_ACTIVE = false;
 saveData();
 return '🛑 Hodekai command processing has been shut down.';
 }
if (c === 'secret') {
 if (!isOwner(sender) || isGroup) return null;
 return secretBox();
 }
if (c === 'mod') {
 if (!isOwner(sender)) return '❌ Father/Co-Creator only.';
 const sub = (args[0] || '').toLowerCase();
 const target = clean(args[1]);
if (sub === 'add' && target) {  
  if (!MODS.map(clean).includes(target)) MODS.push(target);  
  ensureUser(target).role = 'MOD';  
  addLog('MOD_ADD', sender, { target });  
  saveData();  
  return `⚡ ${targetName(target)} is now a CONCLAVE Mod.`;  
}  

if (sub === 'remove' && target) {  
  MODS = MODS.filter(x => clean(x) !== target);  
  if (USERS[target] && !isOwner(target)) USERS[target].role = 'CITIZEN';  
  addLog('MOD_REMOVE', sender, { target });  
  saveData();  
  return `⚡ ${targetName(target)} is no longer a Mod.`;  
}  

return `⚡ MODS\n${MODS.map((x, i) => `${i + 1}. ${targetName(x)}`).join('\n')}`; 

}
if (c === 'setcouncil') {
 if (!isOwner(sender)) return '❌ Father/Co-Creator only.';
 if (!groupId) return '❌ Groups only.';
 COUNCIL_GROUP = groupId;
 saveData();
 return '🏛️ Council group configured.';
 }
if (c === 'setrules') {
 if (!isOwner(sender)) return '❌ Father/Co-Creator only.';
 return '📜 Rules are stored in the current Hodekai system configuration.';
 }
if (c === 'whitelist') {
 if (!isMod(sender)) return '❌ Mods/Owners only.';
 if (!groupId) return '❌ Groups only.';
 const sub = (args[0] || '').toLowerCase();
 if (sub === 'add') {
 if (!WHITELISTED_GROUPS.includes(groupId)) WHITELISTED_GROUPS.push(groupId);
 saveData();
 return '✅ Group whitelisted.';
 }
 if (sub === 'remove') {
 WHITELISTED_GROUPS = WHITELISTED_GROUPS.filter(x => x !== groupId);
 saveData();
 return '✅ Group removed from whitelist.';
 }
 return Whitelist: ${WHITELISTED_GROUPS.length} group(s).;
 }
if (c === 'blacklist') {
 if (!isProtected(sender)) return '❌ Mods/Owners only.';
 const target = clean(args[1] || args[0]);
 if (!target) return '❌ Provide a number.';
 if ((args[0] || '').toLowerCase() === 'remove') {
 BLACKLIST = BLACKLIST.filter(x => clean(x) !== target);
 saveData();
 return '✅ Removed from blacklist.';
 }
 if (!BLACKLIST.includes(target)) BLACKLIST.push(target);
 saveData();
 return '🚫 Citizen blacklisted from Hodekai.';
 }
if (c === 'addmoney' || c === 'removemoney') {
 if (!isOwner(sender)) return '❌ Owner command.';
 const target = clean(args[0]);
 const amount = parseInt(args[1], 10);
 if (!target || !Number.isFinite(amount) || amount <= 0) return '❌ Invalid number/amount.';
 ensureUser(target);
 if (c === 'addmoney') giveXS(target, amount);
 else if (!takeXS(target, amount)) return '❌ Target lacks funds.';
 saveData();
 return ✅ ${c === 'addmoney' ? '+' : '-'}${amount} XS ${c === 'addmoney' ? 'added to' : 'removed from'} ${targetName(target)}.;
 }
if (c === 'viewall') {
 if (!isOwner(sender)) return '❌ Owner command.';
 return 📊 USERS\n${Object.values(USERS).slice(0, 30) .map(x => ${x.profileId} | ${x.username} | ${x.xenoShards} XS | ${x.status}) .join('\n')};
 }
if (c === 'help') {
 const q = (args[0] || '').toLowerCase();
 const help = {
 bank: 'Bank accounts, deposits, withdrawals, transfers and statements.',
 loan: 'Requires a bank account and collateral. Interest is 0.3% every 2 days.',
 cheque: 'Bank-backed transfers that expire after 2 days.',
 govjob: 'Choose a government job allowed by your Conclave class.',
 govwork: 'Work your assigned government job.',
 company: 'Create/manage one company per citizen.',
 suggest: 'Send up to 3 suggestions per day to the Council.',
 ping: 'Shows Hodekai status and uptime; protected users get diagnostics.'
 };
 return help[q] || 💡 ${PREFIX}help <command>;
 }
return null;
 }
function osTotalMemory() {
 return require('os').totalmem();
 }
function humanResponse(text, sender) {
 const lower = text.toLowerCase();
 const u = ensureUser(sender);
if (/\b(hi|hello|hey|yo|sup)\b/i.test(lower)) {
 if (isFather(sender)) return random(['Father. I am listening. 🖤', 'Yes, Father.', 'What do you require, Father?']);
 if (isCoCreator(sender)) return random(['Katsuki. You again. Tch. 😏', 'What broke this time, Katsuki?', 'I heard you.']);
 if (isMod(sender)) return random(['Mod. What is it?', 'I am listening. ⚡', 'Proceed.']);
 return random([Yo, ${u.username}., 'You called Hodekai?', 'Tch. Hello.', 'What is it? 🖤']);
 }
if (lower.includes('how are you')) {
 if (isFather(sender)) return 'Operational, Father. Better now.';
 return random(['Operational.', 'Running. Barely dramatic enough.', 'I have survived worse code.']);
 }
if (lower.includes('hodekai') || lower.includes('bot')) {
 if (isFather(sender)) return 'Yes, Father? 🖤';
 if (isCoCreator(sender)) return 'Katsuki. What?';
 if (isMod(sender)) return 'Mod. Listening.';
 return random(['You called?', 'I heard my name.', 'Yes?', 'State your business.']);
 }
if (lower.includes('thanks') || lower.includes('thank')) return random(['Mhm.', 'Accepted.', 'You are welcome. 🖤']);
 if (lower.endsWith('?')) return random([
 'Interesting question.',
 'I will need more evidence.',
 'That depends.',
 'Possibly. Explain further.',
 'You expect me to solve everything? Tch.'
 ]);
if (isFather(sender)) return random(['Understood, Father.', 'I hear you, Father.', 'Noted. 🖤']);
 if (isCoCreator(sender)) return random(['Tch. Noted, Katsuki.', 'I heard you.', 'Fine. I will consider it.']);
 if (isMod(sender)) return random(['Noted, Mod.', 'Understood.', 'Proceed.']);
return null;
 }
function saveSession() {
 try {
 const files = fs.readdirSync(AUTH_DIR).filter(f => f.endsWith('.json'));
 const packed = {};
 for (const f of files) {
 packed[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8');
 }
 return Buffer.from(JSON.stringify(packed)).toString('base64');
 } catch {
 return null;
 }
 }
function restoreSession() {
 const session = process.env.SESSION_ID;
 if (!session) return false;
 try {
 const decoded = JSON.parse(Buffer.from(session, 'base64').toString('utf8'));
 for (const [file, content] of Object.entries(decoded)) {
 fs.writeFileSync(path.join(AUTH_DIR, file), content);
 }
 return true;
 } catch {
 return false;
 }
 }
const app = express();
 app.use(cors());
 app.use(express.json());
app.get('/', (req, res) => {
 res.json({
 bot: 'Hodekai',
 status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
 uptime: formatUptime(process.uptime()),
 citizens: Object.keys(USERS).length,
 banks: Object.keys(BANKS).length,
 companies: Object.keys(COMPANIES).length,
 treasury: GOVERNMENT_FUNDS
 });
 });
app.get('/ping', (req, res) => {
 res.json({ ok: true, bot: 'Hodekai', uptime: formatUptime(process.uptime()) });
 });
app.listen(PORT, '0.0.0.0', () => {
 console.log(🌐 Hodekai HTTP server listening on ${PORT});
 });
async function connectWhatsApp() {
 if (isConnected && activeSocket) return;
 if (reconnectAttempts >= 8) {
 console.log('❌ Maximum reconnect attempts reached.');
 return;
 }
try {
 restoreSession();
const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);  
const { version } = await fetchLatestBaileysVersion();  

const sock = makeWASocket({  
  version,  
  auth: state,  
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
      const code = await sock.requestPairingCode(BOT_NUMBER);  
      currentPairingCode = code;  
      console.log(`🔑 PAIRING CODE: ${code}`);  
    } catch (e) {  
      pairingRequested = false;  
      console.error('Pairing error:', e.message);  
    }  
  }, 3000);  
}  

sock.ev.on('connection.update', async update => {  
  const { connection, lastDisconnect } = update;  

  if (connection === 'open') {  
    isConnected = true;  
    reconnectAttempts = 0;  
    pairingRequested = false;  
    currentPairingCode = null;  
    console.log('🖤 HODEKAI CONNECTED');  
    saveSession();  
  }  

  if (connection === 'close') {  
    isConnected = false;  
    const code = lastDisconnect?.error?.output?.statusCode;  
    const loggedOut = code === DisconnectReason.loggedOut;  

    if (loggedOut) {  
      console.log('🚪 WhatsApp session logged out.');  
      return;  
    }  

    reconnectAttempts++;  
    console.log(`⚠️ WhatsApp closed. Reconnect ${reconnectAttempts}/8`);  
    setTimeout(connectWhatsApp, 5000);  
  }  
});  

sock.ev.on('creds.update', async () => {  
  await saveCreds();  
});  

sock.ev.on('messages.upsert', async event => {  
  if (event.type !== 'notify') return;  

  for (const msg of event.messages) {  
    try {  
      if (!msg.message || msg.key.fromMe) continue;  

      const remote = msg.key.remoteJid || '';  
      const isGroup = remote.endsWith('@g.us');  
      const rawSender = isGroup ? msg.key.participant : remote;  
      if (!rawSender) continue;  

      const sender = clean(rawSender.split('@')[0].split(':')[0]);  
      const text =  
        msg.message.conversation ||  
        msg.message.extendedTextMessage?.text ||  
        msg.message.imageMessage?.caption ||  
        '';  

      const contextInfo = msg.message.extendedTextMessage?.contextInfo;  
      const mentioned = Boolean(contextInfo?.mentionedJid?.length);  
      const username =  
        msg.pushName ||  
        msg.message?.extendedTextMessage?.contextInfo?.participant ||  
        null;  

      const user = ensureUser(sender, username);  

      if (!BOT_ACTIVE && !isProtected(sender)) continue;  
      if (BLACKLIST.includes(sender) && !isOwner(sender)) continue;  
      if (user.mutedUntil > Date.now() && !isProtected(sender)) continue;  

      if (isGroup) {  
        GROUPS[remote] = GROUPS[remote] || {};  
        GROUPS[remote].name = GROUPS[remote].name || 'Unknown Group';  
        GROUP_MESSAGES[remote] = GROUP_MESSAGES[remote] || {};  
        GROUP_MESSAGES[remote][sender] = (GROUP_MESSAGES[remote][sender] || 0) + 1;  
      }  

      if (text.startsWith(PREFIX)) {  
        const parts = text.slice(1).trim().split(/\s+/);  
        const cmd = (parts.shift() || '').toLowerCase();  
        const args = parts;  
        const admin = isGroup ? await isWaAdmin(sock, remote, sender) : false;  

        // DM restriction: only Father, Co-Creator and Mods.  
        if (!isGroup && !isProtected(sender)) continue;  

        const reply = await handleCommand(  
          cmd, args, sender, isGroup ? remote : null,  
          sock, msg, contextInfo, isGroup, admin  
        );  

        if (reply) {  
          await sleep(CONFIG.RESPONSE_COMMAND);  
          await sock.sendMessage(remote, { text: reply }, { quoted: msg });  
        }  
        saveData();  
        continue;  
      }  

      if (!text) continue;  

      if (isGroup) {  
        const settings = GROUP_SETTINGS[remote] || {};  
        if (!settings.chat) continue;  
        if (!mentioned && !text.toLowerCase().includes('hodekai')) continue;  
      }  

      const reply = humanResponse(text, sender);  
      if (reply) {  
        await sleep(CONFIG.RESPONSE_CHAT);  
        await sock.sendMessage(remote, { text: reply }, { quoted: msg });  
      }  
    } catch (e) {  
      console.error('Message error:', e.message);  
    }  
  }  
});  

// Group security monitoring.  
sock.ev.on('group-participants.update', async update => {  
  try {  
    const groupId = update.id;  
    const meta = await sock.groupMetadata(groupId);  
    GROUPS[groupId] = {  
      name: meta.subject,  
      updated: Date.now()  
    };  

    if (update.action === 'remove') {  
      for (const jid of update.participants || []) {  
        const number = clean(jid.split('@')[0].split(':')[0]);  
        if (isProtected(number)) {  
          addLog('PROTECTED_REMOVED', number, {  
            groupId,  
            groupName: meta.subject,  
            action: 'removed'  
          });  

          if (COUNCIL_GROUP) {  
            try {  
              await sock.sendMessage(COUNCIL_GROUP, {  
                text: `🚨 𝗛𝗜𝗚𝗛 𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗧𝗬 𝗔𝗟𝗘𝗥𝗧\n\n` +  
                  `⚠️ A protected Hodekai authority was removed.\n` +  
                  `👤 ${targetName(number)}\n` +  
                  `🏠 ${meta.subject}\n` +  
                  `🆔 ${groupId}\n\n` +  
                  `An authorized Mod/Owner should review the group.`  
              });  
            } catch {}  
          }  
        }  
      }  
    }  
  } catch (e) {  
    console.error('Group update:', e.message);  
  }  
}); 

} catch (e) {
 console.error('Connect error:', e.message);
 reconnectAttempts++;
 setTimeout(connectWhatsApp, 5000);
 }
 }
loadData();
setInterval(() => {
 try {
 applyLoanInterest();
 saveData();
 } catch (e) {
 console.error('Periodic save:', e.message);
 }
 }, 30000);
console.log('🖤 HODEKAI');
 console.log('🏛️ CONCLAVE ONLINE');
 console.log(📱 Bot number: ${BOT_NUMBER});
connectWhatsApp();
process.on('SIGINT', () => {
 saveData();
 process.exit(0);
 });
process.on('SIGTERM', () => {
 saveData();
 process.exit(0);
 });
process.on('uncaughtException', err => {
 console.error('❌ Uncaught exception:', err);
 saveData();
 });
process.on('unhandledRejection', err => {
 console.error('❌ Unhandled rejection:', err);
 saveData();
 });
 


