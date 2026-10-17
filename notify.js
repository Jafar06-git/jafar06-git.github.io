"use strict";
/*
 * SMS yuborish (Eskiz.uz orqali) va email (ixtiyoriy webhook orqali).
 *
 * DIQQAT: Eskiz bo'yicha kod ularning ochiq hujjatlariga asoslangan, haqiqiy hisob bilan
 * sinab ko'rilmagan. Eskiz yuboriladigan matn shablonlarini oldindan tasdiqlatishni talab qiladi.
 *
 * .env:
 *   ESKIZ_EMAIL=   ESKIZ_PASSWORD=   ESKIZ_FROM=4546
 *   EMAIL_WEBHOOK_URL=   (ixtiyoriy: {to, subject, text} JSON yuboriladi — masalan o'z pochta xizmatingizga)
 */
const env = process.env;
let token = "", tokenExp = 0;

const smsConfigured = () => !!(env.ESKIZ_EMAIL && env.ESKIZ_PASSWORD);

async function eskizToken(force) {
  if (!force && token && Date.now() < tokenExp) return token;
  const r = await fetch("https://notify.eskiz.uz/api/auth/login", { method: "POST", body: new URLSearchParams({ email: env.ESKIZ_EMAIL, password: env.ESKIZ_PASSWORD }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.data || !d.data.token) throw new Error("Eskiz login");
  token = d.data.token; tokenExp = Date.now() + 25 * 864e5;
  return token;
}
async function sendSms(phone, text) {
  const go = async force => fetch("https://notify.eskiz.uz/api/message/sms/send", {
    method: "POST", headers: { Authorization: "Bearer " + await eskizToken(force) },
    body: new URLSearchParams({ mobile_phone: phone, message: text, from: env.ESKIZ_FROM || "4546" })
  });
  let r = await go(false);
  if (r.status === 401) r = await go(true);
  if (!r.ok) throw new Error("Eskiz SMS " + r.status);
}
async function sendEmail(to, subject, text) {
  if (!env.EMAIL_WEBHOOK_URL || !to) return;
  await fetch(env.EMAIL_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text }) });
}
module.exports = { smsConfigured, sendSms, sendEmail };
