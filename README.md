# Go-Chipta

Konsert, teatr, kino, sport, bolalar tadbirlari, muzeylar, aviachipta va poyezd chiptalari sayti.
Bitta `index.html` (frontend) + Node.js server (SQLite bazasi, to'lov, SMS).

## Nimalar bor

- **Hisob**: telefon raqami + SMS kod orqali kirish (parolsiz). Chiptalar hisobda saqlanadi — istalgan qurilmadan ko'rinadi.
- **Savat**: bir buyurtmada bir nechta tadbir va reys. Promokod maydoni.
- **Joyni band qilish**: zal, samolyot va vagondan tanlangan joylar **10 daqiqaga** band qilinadi (taymer ko'rinadi, "Yangilash" mumkin). Ikki kishi bir joyni ololmaydi.
- **Narxni server hisoblaydi**: brauzer yuborgan narxga ishonilmaydi.
- **Chiptalar**: QR kodli, imzolangan (soxtalashtirib bo'lmaydi). PDF — o'zbek, rus, ingliz (kirill harflari bilan) tillarida.
- **Qaytarish**: qoidalar bo'yicha avtomatik hisoblanadi (tadbir: 72 soat — 100%, 24 soat — 50%; poyezd va avia tariflari bo'yicha).
- **Promokodlar**: foiz yoki summa, minimal buyurtma, muddat, limit, bo'limlar, "bir kishiga bir marta". Namuna: `GOCHIPTA10`, `BIRINCHI`, `TALABA`.
- **Admin panel** (`#/admin`): statistika va grafik, tadbir qo'shish/tahrirlash (narx, seanslar, poster rasmi), promokodlar, buyurtmalarni qidirish, foydalanuvchi rollari.
- **Kirish nazorati** (`#/scan`): xodim telefon kamerasi bilan QR kodni skanerlaydi (Chrome/Edge/Android), yoki raqamni qo'lda kiritadi. Ishlatilgan, soxta, qaytarilgan chiptalar darhol aniqlanadi.
- **Huquqiy hujjatlar** (`#/legal/oferta`, `privacy`, `refund`) — 3 tilda **namuna**.
- Ijtimoiy tarmoqlarda ulashish uchun sarlavha va rasm (`/e/<id>` sahifalari), `sitemap.xml`, `robots.txt`.
- Ranglar soddalashtirildi: binafsha brend rangi + amber (tugmalar) + neytral ranglar.

## 1. Faqat ko'rish (serversiz)

`index.html` ni brauzerda oching. Hamma narsa ishlaydi, lekin ma'lumotlar faqat shu brauzerda saqlanadi (demo).
Admin panelni ko'rish uchun **+998 90 000 00 00** raqami bilan kiring — kod ekranda ko'rsatiladi.

## 2. Server bilan ishga tushirish

Kerak: **Node.js 22.13 yoki yangiroq** (ichki SQLite uchun). Qo'shimcha paket o'rnatish shart emas.

```
cp .env.example .env      # qiymatlarni to'ldiring
node server.js
```

Brauzerda: http://localhost:3000 . Ma'lumotlar `data/` papkasidagi `go-chipta.db` faylida saqlanadi — undan muntazam zaxira nusxa oling.

Haqiqiy ishga tushirishda (`NODE_ENV=production`):
- `SECRET` — uzun tasodifiy satr (o'zgartirsangiz, eski chiptalarning QR kodlari yaroqsiz bo'ladi);
- `ADMIN_PHONES` — o'z raqamingiz;
- HTTPS orqali ishlating (masalan, nginx + Let's Encrypt).

## 3. To'lov (Click / Payme)

`.env` da `PAYMENT=click` yoki `PAYMENT=payme` va kalitlarni yozing. Kabinetda ko'rsatiladigan manzillar:
- Click: `PUBLIC_URL/api/pay/click/prepare` va `PUBLIC_URL/api/pay/click/complete`
- Payme: `PUBLIC_URL/api/pay/payme`

To'lanmagan buyurtma 20 daqiqadan keyin avtomatik bekor qilinadi va joylar bo'shaydi.
**Muhim:** to'lov kodi rasmiy hujjatlar asosida yozilgan va sinov so'rovlari bilan tekshirilgan, lekin haqiqiy merchant kalitlari bilan sinalmagan. Pul qabul qilishdan oldin Click va Payme **sandbox** muhitida to'liq tekshiring.

## 4. SMS (Eskiz.uz)

`ESKIZ_EMAIL`, `ESKIZ_PASSWORD` ni yozing. Eskiz SMS matn shablonini oldindan tasdiqlatishni talab qiladi.
SMS ulanmagan bo'lsa, kodlar server oynasida va (faqat development rejimida) saytda ko'rsatiladi.

## 5. Ishga tushirishdan oldin qilinadigan ishlar

- Kompaniya ro'yxatdan o'tgan bo'lishi, Click/Payme bilan shartnoma.
- **Huquqiy hujjatlar** — namuna! Kvadrat qavsdagi ma'lumotlarni to'ldiring va yuristga tekshirtiring.
- O'zbekiston fuqarolarining shaxsiy ma'lumotlari **O'zbekiston hududidagi serverda** saqlanishi kerak (qonun talabi) — hosting tanlashda e'tibor bering.
- Namunaviy tadbirlarni admin paneldan haqiqiy tadbirlarga almashtiring (yoki yashiring).
- Aviachipta va poyezd chiptalari hozircha **namunaviy** ma'lumot. Haqiqiy sotish uchun aviakompaniya / agregator (masalan, Amadeus, Sabre) va "O'zbekiston temir yo'llari" bilan shartnoma va API kerak. Amadeus kalitlari bilan faqat haqiqiy reys **narxlari** ko'rinadi, chipta yozib berilmaydi.

## Fayllar

- `index.html` — butun sayt
- `server.js` — server (API, baza, sahifalar)
- `shared.js` — sayt va server uchun umumiy mantiq (narxlar, joylar, qoidalar)
- `payments.js` — Click va Payme
- `notify.js` — SMS va email
