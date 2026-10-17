"use strict";
/*
 * Go-Chipta serveri (Node.js 22.13+ — tashqi kutubxonalarsiz).
 *
 *   node server.js            → http://localhost:3000
 *
 * Nima qiladi:
 *   /api/*          — backend (shared.js): katalog, kirish (SMS kod), joyni band qilish,
 *                     buyurtma, promokod, qaytarish, QR tekshiruvi, admin panel API
 *   /api/pay/...    — Click va Payme to'lov tizimlaridan keladigan so'rovlar (payments.js)
 *   /               — sayt (index.html)
 *   /e/<id>         — tadbir sahifasi ulashish uchun (Telegram/Facebook uchun meta teglar bilan)
 *   /img/<id>       — admin yuklagan poster rasmi
 *   /robots.txt, /sitemap.xml
 *
 * Ma'lumotlar SQLite bazasida (data/go-chipta.db). Node 22.13 dan eski bo'lsa —
 * data/db.json fayliga yoziladi (faqat sinov uchun).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ---------- .env ---------- */
(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (_) {}
})();
const env = process.env;
const PROD = env.NODE_ENV === "production";
const PORT = Number(env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, env.DATA_DIR || "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const S = require("./shared.js");
const payments = require("./payments.js");
const notify = require("./notify.js");

/* ---------- Maxfiy kalit (QR imzosi, kirish kodlari) ---------- */
let SECRET = env.SECRET;
if (!SECRET) {
  if (PROD) { console.error("XATO: production rejimida .env da SECRET berilishi shart."); process.exit(1); }
  const f = path.join(DATA_DIR, "secret.txt");
  try { SECRET = fs.readFileSync(f, "utf8").trim(); } catch (_) { SECRET = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(f, SECRET); }
}

/* ---------- Ma'lumotlar bazasi ---------- */
function sqliteStore(file) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (coll, id));");
  const qGet = db.prepare("SELECT data FROM docs WHERE coll = ? AND id = ?");
  const qPut = db.prepare("INSERT INTO docs (coll, id, data) VALUES (?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data");
  const qDel = db.prepare("DELETE FROM docs WHERE coll = ? AND id = ?");
  const qAll = db.prepare("SELECT data FROM docs WHERE coll = ?");
  let depth = 0;
  return {
    kind: "sqlite",
    get: (c, i) => { const r = qGet.get(c, String(i)); return r ? JSON.parse(r.data) : null; },
    put: (c, i, v) => { qPut.run(c, String(i), JSON.stringify(v)); },
    del: (c, i) => { qDel.run(c, String(i)); },
    all: c => qAll.all(c).map(r => JSON.parse(r.data)),
    tx: fn => {
      if (depth) return fn();
      depth++; db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
      finally { depth--; }
    }
  };
}
function jsonStore(file) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) {}
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(data)), 50); };
  return {
    kind: "json",
    get: (c, i) => (data[c] && data[c][i] ? JSON.parse(JSON.stringify(data[c][i])) : null),
    put: (c, i, v) => { (data[c] = data[c] || {})[i] = JSON.parse(JSON.stringify(v)); save(); },
    del: (c, i) => { if (data[c]) { delete data[c][i]; save(); } },
    all: c => Object.values(data[c] || {}).map(x => JSON.parse(JSON.stringify(x))),
    tx: fn => fn()
  };
}
let store;
try { store = sqliteStore(path.join(DATA_DIR, "go-chipta.db")); }
catch (e) { console.warn("SQLite ishlamadi (" + e.message + "). data/db.json ishlatiladi — Node.js 22.13+ o'rnating."); store = jsonStore(path.join(DATA_DIR, "db.json")); }

/* ---------- Toshkent vaqti (UTC+5) ---------- */
const tash = () => new Date(Date.now() + 5 * 3600e3);
const todayTash = () => tash().toISOString().slice(0, 10);
const nowMinTash = () => { const d = tash(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/* ---------- Amadeus (ixtiyoriy) ---------- */
const AMA = { id: env.AMADEUS_CLIENT_ID || "", secret: env.AMADEUS_CLIENT_SECRET || "", base: env.AMADEUS_BASE_URL || (env.AMADEUS_ENV === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com"), token: "", exp: 0 };
async function amadeusFlights(q) {
  const code = n => (S.CITIES[n] || {}).code;
  const from = Object.keys(S.CITIES).find(n => code(n) === q.from), to = Object.keys(S.CITIES).find(n => code(n) === q.to);
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(q.date || "")) throw new Error("bad query");
  if (!AMA.token || Date.now() > AMA.exp - 30000) {
    const r = await fetch(AMA.base + "/v1/security/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: AMA.id, client_secret: AMA.secret }) });
    const d = await r.json(); if (!r.ok) throw new Error("Amadeus token");
    AMA.token = d.access_token; AMA.exp = Date.now() + (d.expires_in || 1500) * 1000;
  }
  const adults = Math.min(9, Math.max(1, parseInt(q.adults, 10) || 1));
  const p = new URLSearchParams({ originLocationCode: q.from, destinationLocationCode: q.to, departureDate: q.date, adults: String(adults), travelClass: q.cls === "BUSINESS" ? "BUSINESS" : "ECONOMY", currencyCode: env.CURRENCY || "UZS", max: "30" });
  const r = await fetch(AMA.base + "/v2/shopping/flight-offers?" + p, { headers: { Authorization: "Bearer " + AMA.token } });
  const data = await r.json(); if (!r.ok) throw new Error("Amadeus offers");
  const carriers = (data.dictionaries && data.dictionaries.carriers) || {};
  const dur = s => { const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(s || ""); return m ? (+m[1] || 0) * 60 + (+m[2] || 0) : 0; };
  return (data.data || []).map((o, i) => {
    const it = o.itineraries[0], segs = it.segments, f = segs[0], l = segs[segs.length - 1];
    return { id: "api" + i, carrier: carriers[f.carrierCode] || f.carrierCode, code: f.carrierCode + f.number, depAt: f.departure.at.slice(0, 16), arrAt: l.arrival.at.slice(0, 16),
      dur: dur(it.duration), stops: segs.length - 1, hub: "", layover: 0, aircraft: "", seats: Number(o.numberOfBookableSeats) || 9,
      price: Math.round(Number(o.price.grandTotal) / adults), currency: o.price.currency, depMin: S.depMinOf(f.departure.at.slice(0, 16)) };
  }).filter(o => o.currency === "UZS");
}

/* ---------- Backend ---------- */
const PAYMENT = ["click", "payme"].includes(env.PAYMENT) ? env.PAYMENT : "demo";
const PUBLIC_URL = (env.PUBLIC_URL || "http://localhost:" + PORT).replace(/\/$/, "");
const adminPhones = (env.ADMIN_PHONES || (PROD ? "" : "998900000000")).split(",").map(S.normPhone).filter(Boolean);
const otpDev = env.OTP_DEV ? env.OTP_DEV === "1" : !PROD && !notify.smsConfigured();
const backend = new S.Backend(store, {
  secret: SECRET, holdMin: 10, payMin: 20, otpDev, adminPhones, payment: PAYMENT,
  today: todayTash, nowMin: nowMinTash, randomBytes: n => crypto.randomBytes(n),
  sms: notify.smsConfigured() ? notify.sendSms : null,
  payUrl: order => payments.payUrl(PAYMENT, order, PUBLIC_URL),
  flights: AMA.id && AMA.secret ? amadeusFlights : null,
  log: (...a) => console.log(...a)
});

/* ---------- HTTP yordamchilari ---------- */
const CORS = env.CORS_ORIGIN || "";
const sec = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" };
function send(res, status, body, type, extra) {
  res.writeHead(status, Object.assign({ "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" }, sec, CORS ? { "Access-Control-Allow-Origin": CORS } : {}, extra || {}));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, big = false; const chunks = [];
    req.on("data", c => { size += c.length; if (size > limit) big = true; else chunks.push(c); });
    req.on("end", () => big ? reject(Object.assign(new Error("too large"), { code: 413 })) : resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
const hits = new Map();
function limited(ip, n) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > n;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let INDEX = null;
const indexHtml = () => { if (!INDEX || !PROD) INDEX = fs.readFileSync(path.join(__dirname, "index.html"), "utf8"); return INDEX; };

/* Tadbir sahifasi uchun meta teglar (Telegram, Facebook, Google ko'rinishi) */
function eventPage(id) {
  const ev = store.get("events", id);
  if (!ev || !ev.active) return null;
  const title = S.evTitle(ev, "uz"), v = store.get("venues", ev.venue);
  const desc = `${title}${v ? " — " + v.n.uz : ""}. Chiptalar Go-Chipta'da: joyni tanlang va QR kodli chipta oling.`;
  const img = ev.img ? `<meta property="og:image" content="${esc(PUBLIC_URL + "/img/" + ev.id)}">` : "";
  const meta = `<title>${esc(title)} — Go-Chipta</title><meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Go-Chipta"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(PUBLIC_URL + "/e/" + ev.id)}">${img}<meta name="twitter:card" content="${ev.img ? "summary_large_image" : "summary"}"><link rel="canonical" href="${esc(PUBLIC_URL + "/e/" + ev.id)}"><script>if(!location.hash)history.replaceState(null,"","/#/e/${esc(ev.id)}")</script>`;
  return indexHtml().replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta name="description"[^>]*>/, "").replace("<head>", "<head>\n" + meta);
}

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || "";
  try {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.method === "OPTIONS") { res.writeHead(204, Object.assign({}, CORS ? { "Access-Control-Allow-Origin": CORS, "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Id", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" } : {})); return res.end(); }

    if (p.startsWith("/api/pay/")) {
      const raw = await readBody(req, 100 * 1024);
      const out = payments.handle(p.slice(9), req, raw, backend, store, env);
      return send(res, out.status || 200, out.body);
    }
    if (p.startsWith("/api/")) {
      if (limited(ip, p.startsWith("/api/auth/") ? 20 : 240)) return send(res, 429, { error: "rate" });
      let body = {};
      if (req.method === "POST" || req.method === "PUT") {
        const raw = await readBody(req, 1.5 * 1024 * 1024);
        try { body = raw ? JSON.parse(raw) : {}; } catch (_) { return send(res, 400, { error: "json" }); }
      } else body = Object.fromEntries(url.searchParams);
      const auth = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || "");
      const out = await backend.handle(req.method, p.slice(5), body, { token: auth ? auth[1] : "", cid: String(req.headers["x-client-id"] || "").slice(0, 40), ip });
      return send(res, out.status, out.body);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method" });
    if (p === "/" || p === "/index.html") return send(res, 200, indexHtml(), "text/html; charset=utf-8");
    let m;
    if ((m = /^\/e\/([a-z0-9]{1,20})$/.exec(p))) { const html = eventPage(m[1]); return html ? send(res, 200, html, "text/html; charset=utf-8") : send(res, 302, "", "text/plain", { Location: "/" }); }
    if ((m = /^\/img\/([a-z0-9]{1,20})$/.exec(p))) {
      const ev = store.get("events", m[1]), d = ev && ev.img && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(ev.img);
      return d ? send(res, 200, Buffer.from(d[2], "base64"), d[1], { "Cache-Control": "public, max-age=3600" }) : send(res, 404, { error: "not_found" });
    }
    if (p === "/robots.txt") return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${PUBLIC_URL}/sitemap.xml\n`, "text/plain; charset=utf-8");
    if (p === "/sitemap.xml") {
      const urls = [PUBLIC_URL + "/"].concat(store.all("events").filter(e => e.active).map(e => PUBLIC_URL + "/e/" + e.id));
      return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join("")}</urlset>`, "application/xml; charset=utf-8");
    }
    if (p === "/health") return send(res, 200, { ok: true, db: store.kind });
    return send(res, 404, { error: "not_found" });
  } catch (e) {
    if (e && e.code === 413) return send(res, 413, { error: "too_large" });
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "server" });
  }
});

server.listen(PORT, () => {
  console.log(`Go-Chipta: ${PUBLIC_URL}  (baza: ${store.kind}, to'lov: ${PAYMENT}, SMS: ${notify.smsConfigured() ? "Eskiz" : "yo'q"})`);
  if (otpDev) console.log("DIQQAT: SMS ulanmagan — kirish kodlari shu oynada va saytda ko'rsatiladi (faqat sinov uchun).");
  if (adminPhones.length) console.log("Admin telefon(lar): " + adminPhones.map(x => "+" + x).join(", "));
  else console.log("Admin yo'q: .env da ADMIN_PHONES=998901234567 kabi yozing.");
});
module.exports = { server, backend, store };
