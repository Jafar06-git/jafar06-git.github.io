"use strict";
/*
 * To'lov tizimlari: Click (SHOP API) va Payme (Merchant API).
 *
 * DIQQAT: bu kod rasmiy hujjatlar asosida tayyorlangan, lekin haqiqiy merchant
 * kalitlari bilan sinab ko'rilmagan. Ishga tushirishdan oldin Click va Payme
 * sandbox (test) muhitida to'liq tekshiring:
 *   Click: https://docs.click.uz      Payme: https://developer.help.paycom.uz
 *
 * .env:
 *   PAYMENT=click | payme | demo
 *   CLICK_SERVICE_ID=  CLICK_MERCHANT_ID=  CLICK_SECRET_KEY=
 *   PAYME_MERCHANT_ID=  PAYME_KEY=
 *   PUBLIC_URL=https://sizning-sayt.uz
 *
 * Kabinetda ko'rsatiladigan manzillar:
 *   Click prepare:  PUBLIC_URL/api/pay/click/prepare
 *   Click complete: PUBLIC_URL/api/pay/click/complete
 *   Payme endpoint: PUBLIC_URL/api/pay/payme
 */
const crypto = require("crypto");
const md5 = s => crypto.createHash("md5").update(s).digest("hex");

/* Mijozni to'lov sahifasiga yuborish havolasi */
function payUrl(provider, order, publicUrl) {
  const ret = publicUrl + "/#/account";
  if (provider === "click") {
    const q = new URLSearchParams({ service_id: process.env.CLICK_SERVICE_ID || "", merchant_id: process.env.CLICK_MERCHANT_ID || "", amount: String(order.total), transaction_param: order.id, return_url: ret });
    return "https://my.click.uz/services/pay?" + q;
  }
  if (provider === "payme") {
    const p = `m=${process.env.PAYME_MERCHANT_ID || ""};ac.order_id=${order.id};a=${order.total * 100};c=${ret}`;
    return "https://checkout.paycom.uz/" + Buffer.from(p).toString("base64");
  }
  return "";
}

function handle(sub, req, raw, backend, store, env) {
  if (sub === "click/prepare" || sub === "click/complete") return click(sub.endsWith("complete"), raw, backend, store, env);
  if (sub === "payme") return payme(req, raw, backend, store, env);
  return { status: 404, body: { error: "not_found" } };
}

/* ---------- Click ---------- */
function click(complete, raw, backend, store, env) {
  const b = Object.fromEntries(new URLSearchParams(raw));
  const reply = (error, note, extra) => ({ status: 200, body: Object.assign({ click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, error, error_note: note }, extra || {}) });
  const signSrc = b.click_trans_id + b.service_id + (env.CLICK_SECRET_KEY || "") + b.merchant_trans_id + (complete ? (b.merchant_prepare_id || "") : "") + b.amount + b.action + b.sign_time;
  if (!env.CLICK_SECRET_KEY || md5(signSrc) !== b.sign_string) return reply(-1, "SIGN CHECK FAILED!");
  if (String(b.action) !== (complete ? "1" : "0")) return reply(-3, "Action not found");
  const order = store.get("orders", b.merchant_trans_id);
  if (!order) return reply(-5, "Order not found");
  if (Math.round(+b.amount) !== order.total) return reply(-2, "Incorrect parameter amount");
  if (order.status === "paid") return reply(-4, "Already paid");
  if (order.status === "cancelled") return reply(-9, "Transaction cancelled");
  if (!complete) {
    order.click = { trans: b.click_trans_id, prepare: Date.now() % 1e9 };
    store.put("orders", order.id, order);
    return reply(0, "Success", { merchant_prepare_id: order.click.prepare });
  }
  if (!order.click || String(order.click.prepare) !== String(b.merchant_prepare_id)) return reply(-6, "Transaction does not exist");
  if (Number(b.error) < 0) { backend.cancelOrder(order, "click_error"); return reply(-9, "Transaction cancelled"); }
  const r = backend.markPaid(order.id, Math.round(+b.amount));
  if (r.err) return reply(-2, "Incorrect parameter amount");
  return reply(0, "Success", { merchant_confirm_id: order.click.prepare });
}

/* ---------- Payme (JSON-RPC 2.0) ---------- */
const TIMEOUT = 12 * 3600e3;
function payme(req, raw, backend, store, env) {
  let rpc = {};
  try { rpc = JSON.parse(raw); } catch (_) { return { status: 200, body: { error: { code: -32700, message: "Parse error" }, id: null } }; }
  const id = rpc.id, p = rpc.params || {};
  const ok = result => ({ status: 200, body: { result, id } });
  const er = (code, msg, data) => ({ status: 200, body: { error: { code, message: { uz: msg, ru: msg, en: msg }, data }, id } });
  const auth = req.headers.authorization || "";
  const expect = "Basic " + Buffer.from("Paycom:" + (env.PAYME_KEY || "")).toString("base64");
  if (!env.PAYME_KEY || auth !== expect) return er(-32504, "Insufficient privilege");
  const txs = () => store.all("payme");
  const findOrder = () => store.get("orders", p.account && p.account.order_id);
  const show = t => ({ create_time: t.create, perform_time: t.perform || 0, cancel_time: t.cancel || 0, transaction: t.order, state: t.state, reason: t.reason == null ? null : t.reason });
  switch (rpc.method) {
    case "CheckPerformTransaction": {
      const o = findOrder();
      if (!o || o.status === "cancelled") return er(-31050, "Order not found", "order_id");
      if (o.total * 100 !== p.amount) return er(-31001, "Wrong amount");
      if (o.status !== "pending") return er(-31008, "Order is not payable");
      return ok({ allow: true });
    }
    case "CreateTransaction": {
      let t = store.get("payme", p.id);
      if (t) {
        if (t.state !== 1) return er(-31008, "Cannot perform");
        if (Date.now() - t.create > TIMEOUT) { t.state = -1; t.reason = 4; t.cancel = Date.now(); store.put("payme", t.id, t); return er(-31008, "Timeout"); }
        return ok({ create_time: t.create, transaction: t.order, state: t.state });
      }
      const o = findOrder();
      if (!o || o.status === "cancelled") return er(-31050, "Order not found", "order_id");
      if (o.total * 100 !== p.amount) return er(-31001, "Wrong amount");
      if (o.status !== "pending") return er(-31008, "Order is not payable");
      if (txs().some(x => x.order === o.id && x.state === 1)) return er(-31050, "Order is busy", "order_id");
      t = { id: p.id, order: o.id, amount: p.amount, create: Date.now(), state: 1 };
      store.put("payme", t.id, t);
      return ok({ create_time: t.create, transaction: t.order, state: 1 });
    }
    case "PerformTransaction": {
      const t = store.get("payme", p.id);
      if (!t) return er(-31003, "Transaction not found");
      if (t.state === 2) return ok({ transaction: t.order, perform_time: t.perform, state: 2 });
      if (t.state !== 1) return er(-31008, "Cannot perform");
      if (Date.now() - t.create > TIMEOUT) { t.state = -1; t.reason = 4; t.cancel = Date.now(); store.put("payme", t.id, t); return er(-31008, "Timeout"); }
      const r = backend.markPaid(t.order, t.amount / 100);
      if (r.err) return er(-31008, "Cannot perform");
      t.state = 2; t.perform = Date.now(); store.put("payme", t.id, t);
      return ok({ transaction: t.order, perform_time: t.perform, state: 2 });
    }
    case "CancelTransaction": {
      const t = store.get("payme", p.id);
      if (!t) return er(-31003, "Transaction not found");
      if (t.state === 1) { t.state = -1; const o = store.get("orders", t.order); if (o && o.status === "pending") backend.cancelOrder(o, "payme_cancel"); }
      else if (t.state === 2) { t.state = -2; /* to'langan buyurtmani bekor qilish: chiptalarni qo'lda ko'rib chiqing */ }
      if (!t.cancel) { t.cancel = Date.now(); t.reason = p.reason; store.put("payme", t.id, t); }
      return ok({ transaction: t.order, cancel_time: t.cancel, state: t.state });
    }
    case "CheckTransaction": {
      const t = store.get("payme", p.id);
      return t ? ok(show(t)) : er(-31003, "Transaction not found");
    }
    case "GetStatement":
      return ok({ transactions: txs().filter(t => t.create >= p.from && t.create <= p.to).map(t => Object.assign({ id: t.id, time: t.create, amount: t.amount, account: { order_id: t.order } }, show(t))) });
    default:
      return er(-32601, "Method not found");
  }
}

module.exports = { payUrl, handle };
