"use strict";
/* Go-Chipta: umumiy mantiq va backend (build.py avtomatik yig'adi — qo'lda o'zgartirmang, manba: b2/*.js) */
/* ---------- SHA-256 (brauzer va server uchun bir xil; QR imzosi uchun) ---------- */
const sha256 = (() => {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const enc = s => { const out = []; for (const ch of String(s)){ let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xC0 | c >> 6, 0x80 | c & 63);
    else if (c < 0x10000) out.push(0xE0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    else out.push(0xF0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63); } return out; };
  return function(str){
    const b = enc(str), l = b.length * 8;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (let i = 7; i >= 0; i--) b.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < b.length; o += 64){
      for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++){ const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, bb, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++){
        const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a, h[1] + bb, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(x => x | 0);
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  };
})();

/* =====================================================================
   NAMUNAVIY MA'LUMOTLAR (server va brauzer uchun umumiy).
   Ijrochilar, jamoalar, maskanlar, seanslar va narxlar o'ylab topilgan.
   Server birinchi ishga tushganda shulardan bazani to'ldiradi; keyin
   tadbirlar admin panel orqali boshqariladi.
   ===================================================================== */
const CATS = ["konsert","teatr","kino","sport","bolalar","muzey","show","avia","poyezd"];
const EVENT_CATS = CATS.slice(0, 7);

/* Shaharlar (sayohat uchun koordinatalar bilan) */
const CITIES = {
  "Toshkent":  {code:"TAS", ru:"Ташкент",   en:"Tashkent",  la:41.30, lo:69.24, uz:1, air:1, train:1, ev:1},
  "Samarqand": {code:"SKD", ru:"Самарканд", en:"Samarkand", la:39.65, lo:66.96, uz:1, air:1, train:1, ev:1},
  "Buxoro":    {code:"BHK", ru:"Бухара",    en:"Bukhara",   la:39.77, lo:64.42, uz:1, air:1, train:1, ev:1},
  "Navoiy":    {code:"NVI", ru:"Навои",     en:"Navoi",     la:40.10, lo:65.37, uz:1, air:1, train:1},
  "Qarshi":    {code:"KSQ", ru:"Карши",     en:"Karshi",    la:38.86, lo:65.79, uz:1, air:1, train:1},
  "Termiz":    {code:"TMJ", ru:"Термез",    en:"Termez",    la:37.22, lo:67.28, uz:1, air:1, train:1},
  "Andijon":   {code:"AZN", ru:"Андижан",   en:"Andijan",   la:40.78, lo:72.34, uz:1, air:1, train:1},
  "Namangan":  {code:"NMA", ru:"Наманган",  en:"Namangan",  la:41.00, lo:71.67, uz:1, air:1, train:1},
  "Farg'ona":  {code:"FEG", ru:"Фергана",   en:"Fergana",   la:40.38, lo:71.78, uz:1, air:1, train:0},
  "Urganch":   {code:"UGC", ru:"Ургенч",    en:"Urgench",   la:41.58, lo:60.64, uz:1, air:1, train:1},
  "Nukus":     {code:"NCS", ru:"Нукус",     en:"Nukus",     la:42.46, lo:59.60, uz:1, air:1, train:1},
  "Moskva":    {code:"SVO", ru:"Москва",    en:"Moscow",    la:55.97, lo:37.41, uz:0, air:1, train:0},
  "Istanbul":  {code:"IST", ru:"Стамбул",   en:"Istanbul",  la:41.26, lo:28.74, uz:0, air:1, train:0},
  "Dubay":     {code:"DXB", ru:"Дубай",     en:"Dubai",     la:25.25, lo:55.36, uz:0, air:1, train:0},
  "Seul":      {code:"ICN", ru:"Сеул",      en:"Seoul",     la:37.46, lo:126.44,uz:0, air:1, train:0},
  "Olmaota":   {code:"ALA", ru:"Алматы",    en:"Almaty",    la:43.35, lo:77.04, uz:0, air:1, train:0}
};

/* Maskanlar (o'ylab topilgan) */
const V = (city, type, uz, ru, en, hue) => ({city, type, n:{uz, ru, en}, hue});
const SEED_VENUES = {
  hall1: V("Toshkent","hall","Shahar konsert zali","Городской концертный зал","City Concert Hall",330),
  arena1:V("Toshkent","arena","Markaziy arena","Центральная арена","Central Arena",265),
  stad1: V("Toshkent","stadium","Yoshlar stadioni","Молодёжный стадион","Youth Stadium",140),
  drama1:V("Toshkent","theatre","Shahar drama teatri","Городской драмтеатр","City Drama Theatre",350),
  opera1:V("Toshkent","theatre","Opera va balet teatri","Театр оперы и балета","Opera and Ballet Theatre",280),
  kukla1:V("Toshkent","theatre","Qo'g'irchoq teatri","Театр кукол","Puppet Theatre",40),
  cin1:  V("Toshkent","cinema","Oydin kinoteatri","Кинотеатр «Ойдин»","Oydin Cinema",0),
  cin2:  V("Toshkent","cinema","Yulduz Sinema","Юлдуз Синема","Yulduz Cinema",215),
  cin3:  V("Samarqand","cinema","Kino Markaz","Кино Марказ","Kino Markaz",20),
  park1: V("Toshkent","open","Bog' sahnasi","Сцена в парке","Park Stage",110),
  mus1:  V("Toshkent","museum","Tarix muzeyi","Музей истории","History Museum",30),
  gal1:  V("Toshkent","museum","Zamonaviy san'at galereyasi","Галерея современного искусства","Modern Art Gallery",190),
  club1: V("Toshkent","club","«Kulgi» klubi","Клуб «Кулги»","Kulgi Club",20),
  quest1:V("Toshkent","club","«Labirint» kvest xonasi","Квест-комната «Лабиринт»","Labyrinth Escape Room",250),
  tour1: V("Toshkent","tour","Shahar ekskursiyalari","Городские экскурсии","City Tours",170),
  hall2: V("Samarqand","hall","Samarqand konsert zali","Самаркандский концертный зал","Samarkand Concert Hall",200),
  drama2:V("Samarqand","theatre","Samarqand drama teatri","Самаркандский драмтеатр","Samarkand Drama Theatre",300),
  stad2: V("Samarqand","stadium","Samarqand sport majmuasi","Спорткомплекс Самарканда","Samarkand Sports Complex",150),
  open2: V("Buxoro","open","Buxoro yozgi sahnasi","Летняя сцена Бухары","Bukhara Summer Stage",35),
  tour2: V("Buxoro","tour","Buxoro ekskursiyalari","Экскурсии по Бухаре","Bukhara Tours",45)
};


/* Jamoalar (o'ylab topilgan) */
const TEAMS = {
  tb:{n:{uz:"Toshkent Burgutlari", ru:"Ташкентские Беркуты", en:"Tashkent Eagles"}, c:["#1D4ED8","#FACC15"], m:"TB"},
  sl:{n:{uz:"Samarqand Lochinlari", ru:"Самаркандские Соколы", en:"Samarkand Falcons"}, c:["#0F766E","#F8FAFC"], m:"SL"},
  ba:{n:{uz:"Buxoro Arslonlari", ru:"Бухарские Львы", en:"Bukhara Lions"}, c:["#B91C1C","#FDE68A"], m:"BA"},
  fy:{n:{uz:"Farg'ona Yulduzlari", ru:"Ферганские Звёзды", en:"Fergana Stars"}, c:["#7C3AED","#F0ABFC"], m:"FY"},
  tt:{n:{uz:"Toshkent Titanlari", ru:"Ташкентские Титаны", en:"Tashkent Titans"}, c:["#EA580C","#111827"], m:"TT"},
  ns:{n:{uz:"Namangan Shunqorlari", ru:"Наманганские Кречеты", en:"Namangan Gyrfalcons"}, c:["#0369A1","#BAE6FD"], m:"NS"}
};

/* Chipta turlari (ko'paytuvchi asosiy narxga nisbatan) */
const TYPE_SETS = {
  museum:[{k:"adult", m:1},{k:"student", m:.5, d:"student"},{k:"child", m:.3, d:"child"}],
  tour:[{k:"adult", m:1},{k:"student", m:.7, d:"student"},{k:"child", m:.5, d:"child"}],
  open:[{k:"std", m:1},{k:"vip", m:2.5, d:"vip"}],
  club:[{k:"hall", m:1},{k:"front", m:1.6}],
  run:[{k:"10k", m:1},{k:"5k", m:.7},{k:"1k", m:.4}],
  food:[{k:"entry", m:1},{k:"taste", m:2.2, d:"taste"}],
  quest:[{k:"team", m:1, d:"team"}],
  workshop:[{k:"part", m:1}]
};

/* Tadbirlar.
   s: "kun@soat" — kun bugundan necha kun keyin (0 = bugun).
   d: "0-13@10:00,14:00" — har kuni (0 dan 13 gacha) shu soatlarda. */
const E = (id, cat, venue, uz, ru, en, genre, age, dur, price, s, o) => Object.assign({id, cat, venue, t:{uz, ru, en}, genre, age, dur, price, s}, o || {});
const SEED_EVENTS = [
  E("c1","konsert","hall1","Navo Band: Kuz kechasi","Navo Band: Осенний вечер","Navo Band: An Autumn Evening","pop","12+",120,150000,"2@19:00,9@19:00",{hue:[330,270],feat:1,pop:1}),
  E("c2","konsert","hall1","Sado orkestri: Kino musiqasi","Оркестр «Садо»: музыка из кино","Sado Orchestra: Music from Film","classic","6+",110,120000,"5@19:30,12@19:30",{hue:[215,45],pop:1}),
  E("c3","konsert","park1","Tun ritmlari","Ночные ритмы","Night Rhythms","electronic","18+",300,180000,"4@21:00",{hue:[285,190],types:"open"}),
  E("c4","konsert","club1","Kamalak jaz kvarteti","Джазовый квартет «Камалак»","Kamalak Jazz Quartet","jazz","12+",100,90000,"1@20:00,8@20:00",{hue:[35,350]}),
  E("c5","konsert","hall2","Maqom kechasi: Doston ansambli","Вечер макома: ансамбль «Достон»","An Evening of Maqom: Doston Ensemble","folk","6+",120,80000,"6@18:30",{hue:[25,160]}),
  E("c6","konsert","arena1","Rok kuzi festivali","Фестиваль «Рок-осень»","Rock Autumn Festival","rock","12+",240,200000,"15@18:00",{hue:[0,30],feat:1,pop:1,fan:1}),
  E("c7","konsert","club1","Akustika kechasi","Акустический вечер","Acoustic Night","acoustic","12+",90,70000,"3@20:00,10@20:00",{hue:[150,40]}),
  E("c8","konsert","open2","Yulduzlar ostida: Buxoro konserti","Под звёздами: концерт в Бухаре","Under the Stars: Bukhara Concert","classic","6+",120,100000,"7@20:00",{hue:[230,40],types:"open"}),

  E("t1","teatr","drama1","Hamlet","Гамлет","Hamlet","drama","12+",180,60000,"1@18:30,6@18:30,13@18:30",{hue:[350,260],pop:1}),
  E("t2","teatr","drama1","Revizor","Ревизор","The Government Inspector","comedy","12+",150,50000,"3@18:30,10@18:30",{hue:[45,20]}),
  E("t3","teatr","opera1","Traviata","Травиата","La Traviata","opera","12+",170,90000,"5@18:00,19@18:00",{hue:[320,350],feat:1}),
  E("t4","teatr","opera1","Oqqush ko'li","Лебединое озеро","Swan Lake","ballet","6+",140,100000,"2@18:00,9@18:00,16@18:00",{hue:[200,250],pop:1}),
  E("t5","teatr","drama2","Romeo va Julyetta","Ромео и Джульетта","Romeo and Juliet","drama","12+",160,50000,"4@18:00,11@18:00",{hue:[0,300]}),
  E("t6","teatr","drama1","To'y oldidan","Перед свадьбой","Before the Wedding","comedy","12+",110,45000,"7@19:00,14@19:00",{hue:[100,45]}),
  E("t7","teatr","opera1","Alpomish","Алпомыш","Alpamysh","musical","6+",150,80000,"11@18:30",{hue:[30,200]}),
  E("t8","teatr","drama2","Bahor kuyi","Весенняя мелодия","Spring Melody","musical","6+",125,40000,"8@18:00",{hue:[275,120]}),

  E("s1","sport","stad1","","","","football","0+",110,30000,"3@19:00",{teams:["tb","sl"],hue:[140,210],feat:1,pop:1,league:{uz:"Superliga, 24-tur",ru:"Суперлига, 24-й тур",en:"Super League, round 24"}}),
  E("s2","sport","stad2","","","","football","0+",110,25000,"10@18:00",{teams:["sl","ba"],hue:[160,0],league:{uz:"Superliga, 25-tur",ru:"Суперлига, 25-й тур",en:"Super League, round 25"}}),
  E("s3","sport","arena1","","","","basketball","0+",120,40000,"5@19:00",{teams:["tt","ns"],hue:[25,210],pop:1,league:{uz:"Basketbol ligasi",ru:"Баскетбольная лига",en:"Basketball League"}}),
  E("s4","sport","arena1","Sharq kubogi: boks kechasi","Кубок Востока: вечер бокса","East Cup: Boxing Night","boxing","12+",180,80000,"12@19:00",{hue:[0,45]}),
  E("s5","sport","park1","Shahar marafoni","Городской марафон","City Marathon","running","6+",240,50000,"14@08:00",{hue:[90,190],types:"run"}),
  E("s6","sport","stad1","","","","football","0+",110,30000,"17@19:00",{teams:["tb","fy"],hue:[220,280],league:{uz:"O'zbekiston kubogi, chorak final",ru:"Кубок Узбекистана, четвертьфинал",en:"Uzbekistan Cup, quarter-final"}}),

  E("b1","bolalar","kukla1","Sehrli o'rmon","Волшебный лес","The Magic Forest","puppet","3+",60,35000,"0@15:00,1@11:00,1@15:00,2@11:00,8@11:00",{hue:[120,50],pop:1}),
  E("b2","bolalar","arena1","Yulduzlar sirki","Цирк звёзд","Circus of Stars","circus","0+",120,60000,"6@12:00,6@16:00,13@12:00",{hue:[0,50],feat:1}),
  E("b3","bolalar","hall1","Ilm-fan shousi: Portlovchi tajribalar","Научное шоу: взрывные опыты","Science Show: Explosive Experiments","science","6+",75,40000,"7@12:00",{hue:[190,90]}),
  E("b4","bolalar","hall2","Kichik musiqachilar","Маленькие музыканты","Little Musicians","kidsmusic","3+",60,30000,"9@11:00",{hue:[50,320]}),
  E("b5","bolalar","kukla1","Qor malikasi","Снежная королева","The Snow Queen","fairy","3+",70,35000,"4@11:00,11@11:00",{hue:[200,260]}),

  E("m1","muzey","mus1","Tarix muzeyi: doimiy ko'rgazma","Музей истории: постоянная экспозиция","History Museum: Permanent Exhibition","exhibition","0+",90,40000,"",{d:"0-13@10:00,12:00,14:00,16:00",hue:[30,200],pop:1}),
  E("m2","muzey","gal1","«Rang va yorug'lik» ko'rgazmasi","Выставка «Цвет и свет»","Colour and Light: an Exhibition","exhibition","0+",60,60000,"",{d:"0-20@11:00,15:00,18:00",hue:[300,180],feat:1}),
  E("m3","muzey","tour1","Eski shahar bo'ylab piyoda ekskursiya","Пешая экскурсия по старому городу","Old Town Walking Tour","tour","6+",150,90000,"1@10:00,3@10:00,5@10:00,8@10:00,10@10:00,12@10:00",{hue:[35,15]}),
  E("m4","muzey","tour2","Buxoro: hunarmandlar ko'chalari","Бухара: улицы ремесленников","Bukhara: Streets of Craftsmen","tour","6+",180,120000,"2@09:30,6@09:30,9@09:30",{hue:[25,180]}),
  E("m5","muzey","tour1","Kechki Toshkent: avtobus sayohati","Вечерний Ташкент: автобусная экскурсия","Tashkent by Night: Bus Tour","tour","0+",120,110000,"4@19:00,11@19:00",{hue:[240,40]}),

  E("h1","show","club1","Stand-up kechasi","Стендап-вечер","Stand-up Night","standup","18+",100,80000,"2@20:00,9@20:00,16@20:00",{hue:[20,330],pop:1}),
  E("h2","show","club1","Improv shou: Kutilmagan sahna","Импров-шоу: Неожиданная сцена","Improv Show: The Unexpected Stage","improv","16+",90,70000,"5@20:30,12@20:30",{hue:[270,50]}),
  E("h3","show","gal1","Kulolchilik master-klassi","Мастер-класс по гончарному делу","Pottery Workshop","workshop","12+",120,150000,"3@14:00,10@14:00",{hue:[25,90],types:"workshop"}),
  E("h4","show","quest1","Kvest: Yo'qolgan kalit","Квест: Потерянный ключ","Escape Room: The Lost Key","quest","12+",60,200000,"0@18:00,0@20:00,1@18:00,1@20:00,2@18:00,3@18:00,4@20:00",{hue:[200,280],types:"quest"}),
  E("h5","show","park1","Shahar ovqat festivali","Городской фестиваль еды","City Food Festival","festival","0+",480,50000,"13@12:00",{hue:[40,350],feat:1,types:"food"}),
  E("h6","show","hall1","Sehrgarlar shousi","Шоу иллюзионистов","The Magicians Show","magic","6+",100,90000,"8@18:00,15@18:00",{hue:[260,320]}),

  E("k1","kino","","Tog'lar ortidagi shahar","Город за горами","The City Beyond the Mountains","drama","12+",118,0,"",{hue:[24,200],film:1,pop:1}),
  E("k2","kino","","So'nggi karvon","Последний караван","The Last Caravan","adventure","12+",131,0,"",{hue:[38,10],film:1,feat:1}),
  E("k3","kino","","Yulduzlar bog'i","Сад звёзд","Garden of Stars","animation","6+",94,0,"",{hue:[190,280],film:1}),
  E("k4","kino","","Qorong'u yo'lak","Тёмный коридор","The Dark Corridor","thriller","16+",107,0,"",{hue:[250,0],film:1}),
  E("k5","kino","","Kulgili qo'shnilar","Смешные соседи","Funny Neighbours","comedy","12+",99,0,"",{hue:[140,50],film:1}),
  E("k6","kino","","Orbita-7","Орбита-7","Orbit-7","scifi","12+",126,0,"",{hue:[210,170],film:1,pop:1}),
  E("k7","kino","","Shamol qo'shig'i","Песня ветра","Song of the Wind","family","6+",102,0,"",{hue:[170,60],film:1}),
  E("k8","kino","","Kosmik choyxona","Космическая чайхана","The Space Teahouse","comedy","12+",96,0,"",{hue:[290,30],film:1})
];
const DOM_AIR = [["Uzbekistan Airways","HY"],["Qanot Sharq","HH"],["Centrum Air","C6"]];
const INTL_AIR = {
  "Moskva":  [["Uzbekistan Airways","HY"],["Aeroflot","SU"],["Centrum Air","C6"],["Ural Airlines","U6"]],
  "Istanbul":[["Turkish Airlines","TK"],["Uzbekistan Airways","HY"],["Pegasus","PC"]],
  "Dubay":   [["Emirates","EK"],["flydubai","FZ"],["Uzbekistan Airways","HY"]],
  "Seul":    [["Korean Air","KE"],["Asiana","OZ"],["Uzbekistan Airways","HY"]],
  "Olmaota": [["Air Astana","KC"],["Uzbekistan Airways","HY"],["Qanot Sharq","HH"]]
};
const FAST_TRAIN = new Set(["Toshkent","Samarqand","Buxoro","Navoiy","Qarshi"]);
const TR_CLASSES = {
  avia:  {mult:[1,2.6], uz:["Ekonom","Biznes"], ru:["Эконом","Бизнес"], en:["Economy","Business"]},
  poyezd:{mult:[1,1.8,3], uz:["O'tirgan joy","Kupe","Lyuks"], ru:["Сидячее место","Купе","Люкс"], en:["Seat","Compartment","Luxury"]}
};

/* =====================================================================
   UMUMIY MANTIQ — server (server.js) va brauzer uchun bitta kod.
   Narxlar, seanslar, zal/stadion sxemalari, sayohat takliflari va
   qaytarish qoidalari shu yerda; shuning uchun sayt ko'rsatgan narx va
   server hisoblagan narx doim bir xil bo'ladi.
   ===================================================================== */
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const isoShift = (base, n) => { const d = parse(base); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const dayDiff = (a, b) => Math.round((Date.UTC(...b.split("-").map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split("-").map((x, i) => i === 1 ? x - 1 : +x))) / 864e5);
const hhmm = m => pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
function seed(str){ let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Narxlar ---------- */
const P = (base, m) => Math.round(base * m / 1000) * 1000;
const SEAT_ZONES = {
  hall:[{k:"parter", m:2, c:"#6D3BF5"},{k:"amfi", m:1.3, c:"#0E9F8E"},{k:"balkon", m:1, c:"#64748B"}],
  theatre:[{k:"parter", m:2, c:"#6D3BF5"},{k:"amfi", m:1.3, c:"#0E9F8E"},{k:"balkon", m:1, c:"#64748B"}],
  cinema:[{k:"std", m:1, c:"#6D3BF5"},{k:"vip", m:1.8, c:"#E8A317"}]
};
const SEC_CLASS = {vip:{m:3, c:"#E8A317"}, center:{m:1.8, c:"#6D3BF5"}, side:{m:1.3, c:"#0E9F8E"}, end:{m:1, c:"#64748B"}, fan:{m:1.6, c:"#9B7BFF"}};
const SECTORS = [
  {id:"A", cls:"side", x:110, y:20, w:64, h:50}, {id:"B", cls:"vip", x:178, y:20, w:64, h:50}, {id:"C", cls:"side", x:246, y:20, w:64, h:50},
  {id:"D", cls:"side", x:110, y:230, w:64, h:50}, {id:"E", cls:"center", x:178, y:230, w:64, h:50}, {id:"F", cls:"side", x:246, y:230, w:64, h:50},
  {id:"G", cls:"end", x:40, y:80, w:60, h:140}, {id:"H", cls:"end", x:320, y:80, w:60, h:140}
];
const TYPE_COLORS = ["#6D3BF5","#E8A317","#0E9F8E","#64748B"];
const SECTOR_CAP = 400, TYPE_CAP = 2000;
/* vt — maskan turi (hall, theatre, cinema, arena, stadium, open, museum, club, tour) */
function modeOf(ev, vt){
  if (ev.types) return "types";
  if (vt === "hall" || vt === "theatre" || vt === "cinema") return "seats";
  if (vt === "arena" || vt === "stadium") return "zones";
  return "types";
}
function typeSet(ev, vt){ return ev.types ? TYPE_SETS[ev.types] : (TYPE_SETS[vt] || TYPE_SETS.open); }
function sectorsOf(ev){ return ev.fan ? SECTORS.concat([{id:"FAN", cls:"fan", x:150, y:80, w:160, h:140}]) : SECTORS; }
/* Narxlar ro'yxati (yorliqsiz): [{k, kind, price, color, d}] */
function tierList(ev, s, vt){
  const base = s.base, mode = modeOf(ev, vt);
  if (mode === "seats") return SEAT_ZONES[vt].map(z => ({k:z.k, kind:"zone", price:P(base, z.m), color:z.c}));
  if (mode === "zones") return (ev.fan ? ["vip","center","fan","side","end"] : ["vip","center","side","end"]).map(c => ({k:c, kind:"sector", price:P(base, SEC_CLASS[c].m), color:SEC_CLASS[c].c}));
  return typeSet(ev, vt).map((x, i) => ({k:x.k, kind:"type", d:x.d, price:P(base, x.m), color:TYPE_COLORS[i % 4]}));
}
function hallLayout(type, base){
  const rows = [];
  if (type === "cinema"){
    for (let r = 1; r <= 10; r++){ const z = r >= 9 ? SEAT_ZONES.cinema[1] : SEAT_ZONES.cinema[0]; rows.push({row:r, n:14, zone:z.k, price:P(base, z.m), color:z.c}); }
  } else {
    for (let r = 1; r <= 15; r++){
      const z = SEAT_ZONES.theatre[r <= 8 ? 0 : r <= 12 ? 1 : 2];
      rows.push({row:r, n:z.k === "parter" ? 12 : z.k === "amfi" ? 14 : 16, zone:z.k, price:P(base, z.m), color:z.c});
    }
  }
  return rows;
}
/* Namunaviy "allaqachon sotilgan" joylar (har seans uchun doim bir xil) */
function mockOccupied(sid, rows){
  const r = rng(seed("occ" + sid)), p = 0.12 + r() * 0.3, occ = new Set();
  rows.forEach(row => { for (let k = 1; k <= row.n; k++) if (r() < p) occ.add(row.row + "-" + k); });
  return occ;
}
function soldOutSectors(sid){ const r = rng(seed("so" + sid)), set = new Set(); SECTORS.forEach(x => { if (x.cls !== "vip" && r() < 0.14) set.add(x.id); }); return set; }

/* ---------- Seanslar ----------
   Tadbirda uch xil jadval bo'lishi mumkin:
   - sessions: [{date:"YYYY-MM-DD", time:"HH:MM", venue, hall?, base?}] — admin kiritgan aniq sanalar;
   - s: "2@19:00,9@19:00" — bugundan necha kun keyin (namunaviy ma'lumot);
   - d: "0-13@10:00,12:00" — har kuni;
   - film: kinoteatrlar bo'yicha avtomatik jadval. */
const SESS_CACHE = {};
function genSessions(ev, today){
  const key = ev.id + "|" + today + "|" + (ev.rev || 0);
  if (SESS_CACHE[key]) return SESS_CACHE[key];
  const out = [];
  const add = (date, min, venue, hall, base) => out.push({id:[ev.id, date, min, venue].join("|"), ev:ev.id, date, min, venue, hall:hall || 0, base});
  if (Array.isArray(ev.sessions) && ev.sessions.length){
    ev.sessions.forEach(x => add(x.date, toMin(x.time), x.venue || ev.venue, +x.hall || 0, +x.base || ev.price));
  } else if (ev.film){
    for (let d = 0; d < 7; d++) ["cin1","cin2","cin3"].forEach(v => {
      const date = isoShift(today, d), r = rng(seed(ev.id + v + date));
      if (r() < 0.35) return;
      const times = new Set(), n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) times.add(600 + Math.floor(r() * 26) * 30);
      const hall = 1 + Math.floor(r() * 5);
      [...times].forEach(m => add(date, m, v, hall, m >= 1080 ? 55000 : m < 720 ? 35000 : 45000));
    });
  } else {
    if (ev.s) ev.s.split(",").forEach(x => { const [d, tm] = x.split("@"); add(isoShift(today, +d), toMin(tm), ev.venue, 0, ev.price); });
    if (ev.d){
      const [range, times] = ev.d.split("@"), [a, b] = range.split("-").map(Number);
      for (let d = a; d <= b; d++) times.split(",").forEach(tm => add(isoShift(today, d), toMin(tm), ev.venue, 0, ev.price));
    }
  }
  out.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.min - y.min);
  return (SESS_CACHE[key] = out);
}
const isUpcoming = (date, min, today, nowMin) => date > today || (date === today && min > nowMin + 10);
const minutesUntil = (date, min, today, nowMin) => dayDiff(today, date) * 1440 + min - nowMin;

/* ---------- Sayohat ---------- */
function dist(a, b){
  const R = 6371, rad = x => x * Math.PI / 180;
  const dl = rad(b.la - a.la), dn = rad(b.lo - a.lo);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.la)) * Math.cos(rad(b.la)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function localAt(date, min){ const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 0, min)).toISOString().slice(0, 16); }
const depMinOf = s => +s.slice(11, 13) * 60 + +s.slice(14, 16);
const AIRCRAFT = ["Airbus A320neo","Airbus A321neo","Boeing 737-800","Boeing 787-8","Airbus A320"];
const HUBS_INTL = ["Istanbul","Moskva","Olmaota","Dubay"];
const HUBS_DOM = ["Toshkent","Samarqand","Navoiy"];
const TARIFFS = [{k:"lite", m:1, hand:8, bag:0}, {k:"std", m:1.18, hand:8, bag:20}, {k:"flex", m:1.42, hand:10, bag:23}];
const TR_WAGONS = {0:[1,2,3,4], 1:[5,6,7,8], 2:[9,10]};
const legPrice = (price, m) => Math.round(price * (m || 1) / 1000) * 1000;
function mockGen(mode, from, to, date, cls){
  const a = CITIES[from], b = CITIES[to], km = dist(a, b);
  const r = rng(seed(mode + from + to + date));
  const mult = TR_CLASSES[mode].mult[cls] || 1;
  const dow = parse(date).getDay(), wk = (dow === 0 || dow === 5 || dow === 6) ? 1.07 : 1;
  const out = [];
  if (mode === "avia"){
    const intl = !(a.uz && b.uz), cars = intl ? INTL_AIR[a.uz ? to : from] : DOM_AIR;
    const n = 6 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++){
      const car = cars[Math.floor(r() * cars.length)], stops = r() < 0.25 ? 1 : 0;
      const lay = stops ? 60 + Math.floor(r() * 30) * 5 : 0;
      const d = Math.round((45 + km / 13 + (stops ? lay + 40 : 0)) / 5) * 5;
      const dep = Math.floor((300 + r() * 1000) / 5) * 5;
      const hubs = (intl ? HUBS_INTL : HUBS_DOM).filter(h => h !== from && h !== to);
      const base = (intl ? 1200000 + km * 280 : 180000 + km * 380) * (0.8 + r() * 0.5) * (stops ? 0.85 : 1) * wk;
      out.push({id:mode + i, carrier:car[0], code:car[1] + (100 + Math.floor(r() * 900)), depAt:localAt(date, dep), arrAt:localAt(date, dep + d), dur:d, stops,
        hub:stops ? hubs[Math.floor(r() * hubs.length)] : "", layover:lay, aircraft:AIRCRAFT[Math.floor(r() * AIRCRAFT.length)],
        seats:cls === 1 ? 1 + Math.floor(r() * 16) : 1 + Math.floor(r() * 40), price:Math.round(base * mult / 1000) * 1000, currency:"UZS", depMin:dep % 1440});
    }
  } else {
    const fastRoute = FAST_TRAIN.has(from) && FAST_TRAIN.has(to), road = km * 1.25;
    const names = fastRoute ? ["Afrosiyob","Sharq"] : ["Nasaf","Registon","Turon","Surxon","Xorazm"];
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++){
      const name = names[Math.floor(r() * names.length)], fast = name === "Afrosiyob";
      const speed = fast ? 150 : (name === "Sharq" ? 100 : 70);
      const d = Math.round((road / speed * 60 + 15 + r() * 20) / 5) * 5;
      const dep = Math.floor((330 + r() * 1050) / 5) * 5;
      const base = (25000 + road * (fast ? 260 : 150)) * (0.9 + r() * 0.3) * wk;
      const classes = [0, 1, 2].map(c => ({c, free:(fast && c === 1) ? 0 : Math.floor(r() * [150, 90, 30][c]), price:Math.round(base * TR_CLASSES.poyezd.mult[c] / 1000) * 1000}))
        .filter(x => !(fast && x.c === 1));
      const mine = classes.find(x => x.c === cls);
      if (!mine || !mine.free) continue;          // tezyurar poyezdda kupe yo'q yoki sinfda joy qolmagan
      out.push({id:mode + i, carrier:name, code:"No " + (700 + Math.floor(r() * 250)), depAt:localAt(date, dep), arrAt:localAt(date, dep + d), dur:d, stops:0,
        classes, amen:fast ? ["wifi","ac","cafe","socket"] : ["ac","tea"], seats:mine.free, price:mine.price, currency:"UZS", depMin:dep % 1440});
    }
  }
  return out;
}
const legKey = l => `tr|${l.code}|${l.depAt}`;
function planeLayout(cls){
  const rows = [];
  if (cls === 1) for (let r = 1; r <= 4; r++) rows.push({r, cols:["A","C","|","D","F"]});
  else for (let r = 6; r <= 29; r++) rows.push({r, cols:["A","B","C","|","D","E","F"], exit:r === 14 || r === 15});
  return rows;
}
function trainLayout(cls){
  if (cls === 0){ const rows = []; for (let r = 0; r < 15; r++) rows.push([r * 4 + 1, r * 4 + 2, "|", r * 4 + 3, r * 4 + 4]); return {kind:"seat", rows}; }
  const per = cls === 1 ? 4 : 2, comps = [];
  for (let c = 0; c < 9; c++){ const b = []; for (let k = 1; k <= per; k++) b.push(c * per + k); comps.push(b); }
  return {kind:"comp", comps, per};
}
function allSeatKeys(mode, cls){
  if (mode === "avia") return planeLayout(cls).flatMap(row => row.cols.filter(c => c !== "|").map(c => row.r + c));
  const cap = cls === 0 ? 60 : cls === 1 ? 36 : 18;
  return TR_WAGONS[cls].flatMap(w => Array.from({length:cap}, (_, i) => w + "-" + (i + 1)));
}
/* Sxemadagi bo'sh joylar soni taklifdagi "bo'sh joylar" soniga teng (sotilganlar hali ayrilmagan) */
function freeSeatsBase(leg, mode, cls){
  const all = allSeatKeys(mode, cls), r = rng(seed("trfree" + legKey(leg) + cls));
  for (let i = all.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const n = Math.min(all.length, typeof leg.seats === "number" && leg.seats > 0 ? leg.seats : Math.round(all.length * .5));
  return new Set(all.slice(0, n));
}

/* ---------- Qaytarish qoidalari ----------
   mins — boshlanishiga (jo'nashiga) qolgan daqiqalar. Natija: foiz (0 — qaytarib bo'lmaydi). */
function refundPct(t, mins){
  const h = mins / 60;
  if (h <= 0) return 0;
  if (t.kind === "event") return h >= 72 ? 100 : h >= 24 ? 50 : 0;
  if (t.mode === "avia") return t.tariff === "flex" ? (h >= 3 ? 100 : 0) : t.tariff === "std" ? (h >= 24 ? 50 : 0) : 0;
  return h >= 24 ? 100 : h >= 2 ? 50 : 0;
}

/* ---------- Telefon raqami ---------- */
function normPhone(p){
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return /^\d{11,15}$/.test(d) ? d : "";
}
const maskPhone = d => d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 5)} ***-**-${d.slice(10)}` : "+" + d.slice(0, 4) + "***" + d.slice(-2);

/* =====================================================================
   BACKEND — server.js (SQLite) va brauzerdagi demo rejim (localStorage)
   uchun bitta kod. Barcha narxlar, joy band qilish, buyurtma, promokod,
   qaytarish, QR tekshiruvi va admin amallari shu yerda.
   Store interfeysi: get(coll,id) · put(coll,id,doc) · del(coll,id) · all(coll) · tx(fn)
   ===================================================================== */
const ROLES = ["user", "staff", "admin"];
const AGES = ["0+","3+","6+","12+","16+","18+"];
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bOk = (status, body) => ({status, body});
const bErr = (status, error, extra) => ({status, body:Object.assign({error}, extra || {})});
const clone = o => JSON.parse(JSON.stringify(o));
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = s => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const evTitle = (ev, lg) => ev.teams && TEAMS[ev.teams[0]] && TEAMS[ev.teams[1]] ? `${TEAMS[ev.teams[0]].n[lg]} — ${TEAMS[ev.teams[1]].n[lg]}` : ((ev.t && (ev.t[lg] || ev.t.uz)) || ev.id);

class Backend {
  constructor(store, opt){
    this.db = store;
    this.o = Object.assign({
      secret:"dev-secret", holdMin:10, payMin:20, otpDev:true, adminPhones:[], payment:"demo",
      sms:null, payUrl:null, flights:null, log:() => {},
      today:() => iso(new Date()), nowMin:() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
      randomBytes:n => { const a = []; for (let i = 0; i < n; i++) a.push(Math.floor(Math.random() * 256)); return a; }
    }, opt || {});
    this.offerCache = new Map();
    this.lastClean = 0;
    this.seed();
  }
  rand(n, abc){ abc = abc || ALNUM; return Array.from(this.o.randomBytes(n), b => abc[b % abc.length]).join(""); }
  sig(id){ return sha256(this.o.secret + "|ticket|" + id).slice(0, 12); }
  seed(){
    const m = this.db.get("meta", "seed");
    if (m && m.v >= 1) return;
    this.db.tx(() => {
      SEED_EVENTS.forEach(e => this.db.put("events", e.id, Object.assign(clone(e), {active:true, rev:1})));
      Object.keys(SEED_VENUES).forEach(k => this.db.put("venues", k, Object.assign({id:k}, clone(SEED_VENUES[k]))));
      [{code:"GOCHIPTA10", type:"pct", value:10, minTotal:100000, until:"", maxUses:0, cats:[], perUser:false},
       {code:"BIRINCHI", type:"fix", value:20000, minTotal:50000, until:"", maxUses:0, cats:[], perUser:true},
       {code:"TALABA", type:"pct", value:15, minTotal:0, until:"", maxUses:0, cats:["muzey","teatr","kino"], perUser:false}]
        .forEach(p => this.db.put("promos", p.code, Object.assign(p, {uses:0, active:true})));
      this.db.put("meta", "seed", {v:1, at:new Date().toISOString()});
    });
  }

  /* ---------- yordamchilar ---------- */
  today(){ return this.o.today(); }
  now(){ return this.o.nowMin(); }
  venue(id){ return this.db.get("venues", id); }
  vt(ev, s){ const v = this.venue((s && s.venue) || ev.venue); return v ? v.type : ""; }
  session(sid){
    if (typeof sid !== "string" || sid.length > 120) return null;
    const ev = this.db.get("events", sid.split("|")[0]);
    if (!ev || !ev.active) return null;
    const s = genSessions(ev, this.today()).find(x => x.id === sid);
    return s ? {ev, s} : null;
  }
  user(ctx){
    if (!ctx || !ctx.token) return null;
    const ses = this.db.get("sessions", String(ctx.token).slice(0, 80));
    if (!ses || ses.exp < Date.now()) return null;
    return this.db.get("users", ses.user);
  }
  holder(ctx){ const u = this.user(ctx); return u ? "u:" + u.id : (ctx && ctx.cid ? "c:" + String(ctx.cid).slice(0, 40) : "anon"); }
  pubUser(u){ return u ? {id:u.id, phone:u.phone, name:u.name || "", role:u.role} : null; }
  booked(key){ return this.db.get("booked", key) || {seats:{}, counts:{}}; }
  takenSet(key, holder){
    const set = new Set(Object.keys(this.booked(key).seats));
    const now = Date.now();
    this.db.all("holds").forEach(h => { if (h.key === key && h.exp > now && h.holder !== holder) h.seats.forEach(k => set.add(k)); });
    return set;
  }
  cleanup(){
    const now = Date.now();
    if (now - this.lastClean < 15000) return;
    this.lastClean = now;
    this.db.tx(() => {
      this.db.all("holds").forEach(h => { if (h.exp < now - 60000) this.db.del("holds", h.id); });
      this.db.all("orders").forEach(o => { if (o.status === "pending" && o.payExp < now) this.cancelOrder(o, "timeout"); });
      this.db.all("sessions").forEach(s => { if (s.exp < now) this.db.del("sessions", s.id); });
    });
  }
  freeSeat(t){
    if (!t.key) return;
    const b = this.booked(t.key);
    if (t.seatKey && b.seats[t.seatKey] === t.id) delete b.seats[t.seatKey];
    if (t.unitKey) b.counts[t.unitKey] = Math.max(0, (b.counts[t.unitKey] || 0) - 1);
    this.db.put("booked", t.key, b);
  }
  cancelOrder(o, why){
    this.db.all("tickets").filter(t => t.order === o.id && t.status === "pending").forEach(t => { t.status = "cancelled"; this.db.put("tickets", t.id, t); this.freeSeat(t); });
    o.status = "cancelled"; o.cancelReason = why; this.db.put("orders", o.id, o);
  }

  /* ---------- marshrutlash ---------- */
  async handle(method, path, body, ctx){
    try {
      this.cleanup();
      body = body && typeof body === "object" ? body : {};
      const p = String(path || "").replace(/^\/+|\/+$/g, "").split("/").map(decodeURIComponent);
      const m = method.toUpperCase(), r = p[0], a = p[1], b = p[2];
      if (r === "config" && m === "GET") return bOk(200, {server:true, payment:this.o.payment, sms:!!this.o.sms, otpDev:!!this.o.otpDev, holdMin:this.o.holdMin, flights:!!this.o.flights});
      if (r === "catalog" && m === "GET") return this.catalog();
      if (r === "auth" && a === "otp" && m === "POST") return await this.otp(body);
      if (r === "auth" && a === "verify" && m === "POST") return this.verify(body, ctx);
      if (r === "auth" && a === "logout" && m === "POST"){ if (ctx && ctx.token) this.db.del("sessions", String(ctx.token).slice(0, 80)); return bOk(200, {ok:true}); }
      if (r === "me" && !a && m === "GET"){ const u = this.user(ctx); return u ? bOk(200, {user:this.pubUser(u)}) : bErr(401, "auth"); }
      if (r === "me" && !a && m === "PUT"){ const u = this.user(ctx); if (!u) return bErr(401, "auth"); u.name = str(body.name, 60); this.db.put("users", u.id, u); return bOk(200, {user:this.pubUser(u)}); }
      if (r === "me" && a === "orders" && m === "GET") return this.myOrders(ctx);
      if (r === "seats" && m === "GET"){ const key = str(body.show, 160); return bOk(200, {taken:key ? [...this.takenSet(key, this.holder(ctx))] : []}); }
      if (r === "holds" && !a && m === "POST") return this.hold(body, ctx);
      if (r === "holds" && a && !b && m === "DELETE"){ const h = this.db.get("holds", a); if (h && h.holder === this.holder(ctx)) this.db.del("holds", a); return bOk(200, {ok:true}); }
      if (r === "holds" && a && b === "renew" && m === "POST") return this.renew(a, ctx);
      if (r === "quote" && m === "POST") return this.quote(body, ctx);
      if (r === "orders" && !a && m === "POST") return this.order(body, ctx);
      if (r === "tickets" && a && b === "refund" && m === "POST") return this.refund(a, ctx);
      if (r === "scan" && m === "POST") return this.scan(body, ctx);
      if (r === "flights" && m === "GET") return await this.flights(body);
      if (r === "admin") return this.admin(m, a, b, body, ctx);
      return bErr(404, "not_found");
    } catch (e) {
      this.o.log("backend xatosi:", e && e.stack || e);
      return bErr(500, "server");
    }
  }

  catalog(){
    const venues = {};
    this.db.all("venues").forEach(v => { venues[v.id] = v; });
    return bOk(200, {events:this.db.all("events").filter(e => e.active), venues, today:this.today()});
  }

  /* ---------- kirish: SMS kod ---------- */
  async otp(body){
    const phone = normPhone(body.phone);
    if (!phone) return bErr(400, "phone");
    const now = Date.now(), rec = this.db.get("otp", phone) || {sent:[]};
    rec.sent = (rec.sent || []).filter(x => x > now - 3600e3);
    if (rec.sent.length >= 5) return bErr(429, "otp_limit");
    if (rec.sent.length && now - rec.sent[rec.sent.length - 1] < 30e3) return bErr(429, "otp_wait");
    const code = Array.from(this.o.randomBytes(6), b => b % 10).join("");
    rec.hash = sha256(this.o.secret + "|otp|" + phone + "|" + code); rec.exp = now + 5 * 60e3; rec.tries = 0; rec.sent.push(now);
    this.db.put("otp", phone, rec);
    if (this.o.sms){ try { await this.o.sms(phone, `Go-Chipta: kirish kodi ${code}. Hech kimga aytmang.`); } catch (e) { this.o.log("SMS yuborilmadi:", e.message); if (!this.o.otpDev) return bErr(502, "sms_failed"); } }
    else this.o.log(`[OTP] +${phone}: ${code}`);
    return bOk(200, Object.assign({sent:true}, this.o.otpDev ? {dev:code} : {}));
  }
  verify(body, ctx){
    const phone = normPhone(body.phone), code = String(body.code || "").replace(/\D/g, "");
    const rec = phone && this.db.get("otp", phone);
    if (!rec || !rec.hash || rec.exp < Date.now()) return bErr(400, "otp_expired");
    if (rec.tries >= 5) return bErr(429, "otp_tries");
    if (sha256(this.o.secret + "|otp|" + phone + "|" + code) !== rec.hash){ rec.tries++; this.db.put("otp", phone, rec); return bErr(400, "otp_wrong"); }
    rec.hash = ""; this.db.put("otp", phone, rec);
    let u = this.db.get("users", phone);
    if (!u) u = {id:phone, phone, name:"", role:"user", createdAt:new Date().toISOString()};
    if (this.o.adminPhones.includes(phone)) u.role = "admin";
    this.db.put("users", phone, u);
    /* kirishdan oldin band qilingan joylar endi shu foydalanuvchiniki */
    if (ctx && ctx.cid){ const was = "c:" + String(ctx.cid).slice(0, 40); this.db.all("holds").forEach(h => { if (h.holder === was){ h.holder = "u:" + phone; this.db.put("holds", h.id, h); } }); }
    const token = this.rand(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    this.db.put("sessions", token, {id:token, user:phone, exp:Date.now() + 30 * 864e5});
    return bOk(200, {token, user:this.pubUser(u)});
  }

  /* ---------- joyni vaqtincha band qilish ---------- */
  seatCheck(key, seats, holder, leg){
    if (!Array.isArray(seats) || !seats.length || seats.length > 9 || new Set(seats).size !== seats.length) return "seats";
    if (key.startsWith("tr|")){
      const f = leg && this.findOffer(leg.mode, leg.cls, leg);
      if (!f || legKey(f) !== key) return "offer_gone";
      const free = freeSeatsBase(f, leg.mode, leg.cls);
      if (seats.some(k => typeof k !== "string" || !free.has(k))) return "seat_taken";
    } else {
      const x = this.session(key);
      if (!x || !isUpcoming(x.s.date, x.s.min, this.today(), this.now())) return "show_gone";
      const vt = this.vt(x.ev, x.s);
      if (modeOf(x.ev, vt) !== "seats") return "seats";
      const rows = hallLayout(vt, x.s.base), occ = mockOccupied(x.s.id, rows);
      for (const k of seats){
        const mm = /^(\d{1,2})-(\d{1,2})$/.exec(k || ""); if (!mm) return "seats";
        const row = rows.find(rr => rr.row === +mm[1]);
        if (!row || +mm[2] < 1 || +mm[2] > row.n || occ.has(k)) return "seat_taken";
      }
    }
    const taken = this.takenSet(key, holder);
    if (seats.some(k => taken.has(k))) return "seat_taken";
    return "";
  }
  hold(body, ctx){
    const key = str(body.key, 160), seats = body.seats, holder = this.holder(ctx);
    const leg = body.leg ? {mode:body.leg.mode, cls:+body.leg.cls, from:body.leg.from, to:body.leg.to, date:body.leg.date, code:body.leg.code, depAt:body.leg.depAt} : null;
    let out;
    this.db.tx(() => {
      const err = this.seatCheck(key, seats, holder, leg);
      if (err){ out = bErr(409, err); return; }
      const h = {id:this.rand(14), key, seats:seats.slice(), holder, leg, exp:Date.now() + this.o.holdMin * 60e3};
      this.db.put("holds", h.id, h);
      out = bOk(200, {id:h.id, exp:h.exp});
    });
    return out;
  }
  renew(id, ctx){
    const h = this.db.get("holds", id), holder = this.holder(ctx);
    if (!h || h.holder !== holder) return bErr(404, "hold_gone");
    let out;
    this.db.tx(() => {
      const err = this.seatCheck(h.key, h.seats, holder, h.leg);
      if (err){ this.db.del("holds", id); out = bErr(409, err); return; }
      h.exp = Date.now() + this.o.holdMin * 60e3; this.db.put("holds", id, h);
      out = bOk(200, {id, exp:h.exp});
    });
    return out;
  }

  /* ---------- narxni server hisoblaydi ---------- */
  findOffer(mode, cls, leg){
    if (!leg || (mode !== "avia" && mode !== "poyezd") || !CITIES[leg.from] || !CITIES[leg.to] || leg.from === leg.to || !isDate(leg.date)) return null;
    if (!CITIES[leg.from][mode === "avia" ? "air" : "train"] || !CITIES[leg.to][mode === "avia" ? "air" : "train"]) return null;
    if (!Number.isInteger(cls) || cls < 0 || cls > (mode === "avia" ? 1 : 2)) return null;
    const ck = mode + "|" + cls + "|" + leg.code + "|" + leg.depAt, c = this.offerCache.get(ck);
    if (c && c.exp > Date.now()) return c.offer;
    if (mode === "avia" && this.o.flights) return null;      // haqiqiy rejimda faqat server qaytargan takliflar
    return mockGen(mode, leg.from, leg.to, leg.date, cls).find(o => o.code === leg.code && o.depAt === leg.depAt) || null;
  }
  priceItems(items, holder, user){
    if (!Array.isArray(items) || !items.length || items.length > 10) return {err:"items"};
    const today = this.today(), now = this.now(), out = [];
    for (const it of items){
      if (!it || typeof it !== "object") return {err:"items"};
      if (it.type === "event"){
        const x = this.session(it.show);
        if (!x || !isUpcoming(x.s.date, x.s.min, today, now)) return {err:"show_gone"};
        const {ev, s} = x, vt = this.vt(ev, s), mode = modeOf(ev, vt), key = s.id, lines = [];
        const seats = Array.isArray(it.seats) ? it.seats : [], units = Array.isArray(it.items) ? it.items : [];
        if (mode === "seats"){
          if (!seats.length || seats.length > 6 || units.length) return {err:"seats"};
          const keys = seats.map(z => z && Number.isInteger(z.row) && Number.isInteger(z.seat) ? z.row + "-" + z.seat : "");
          const e = this.seatCheck(key, keys, holder, null); if (e) return {err:e};
          const rows = hallLayout(vt, s.base);
          keys.forEach(k => { const [rr, ss] = k.split("-").map(Number), row = rows.find(q => q.row === rr); lines.push({seatKey:k, seat:{row:rr, seat:ss, zone:row.zone}, price:row.price}); });
        } else {
          if (seats.length || !units.length) return {err:"items"};
          const tl = tierList(ev, s, vt), qty = units.reduce((q, u) => q + (Number.isInteger(u && u.qty) ? u.qty : 0), 0);
          if (qty < 1 || qty > 10 || new Set(units.map(u => u.k)).size !== units.length) return {err:"qty"};
          const b = this.booked(key), so = soldOutSectors(s.id);
          for (const u of units){
            if (!Number.isInteger(u.qty) || u.qty < 1) return {err:"qty"};
            let price;
            if (mode === "zones"){ const sec = sectorsOf(ev).find(z => z.id === u.k); if (!sec) return {err:"items"}; if (so.has(sec.id)) return {err:"sold_out"}; price = P(s.base, SEC_CLASS[sec.cls].m); if ((b.counts[u.k] || 0) + u.qty > SECTOR_CAP) return {err:"sold_out"}; }
            else { const tt = tl.find(z => z.k === u.k); if (!tt) return {err:"items"}; price = tt.price; if ((b.counts[u.k] || 0) + u.qty > TYPE_CAP) return {err:"sold_out"}; }
            for (let i = 0; i < u.qty; i++) lines.push({unitKey:u.k, unit:{k:u.k, kind:mode === "zones" ? "sector" : "type"}, price});
          }
        }
        out.push({type:"event", cat:ev.cat, ev, s, key, lines, total:lines.reduce((q, l) => q + l.price, 0)});
      } else if (it.type === "travel"){
        const mode = it.mode, cls = it.cls, legs = it.legs, pax = it.pax;
        if (mode !== "avia" && mode !== "poyezd") return {err:"items"};
        const tf = mode === "avia" ? TARIFFS.find(f => f.k === it.tariff) : null;
        if (mode === "avia" ? !tf : it.tariff != null) return {err:"items"};
        if (!Array.isArray(pax) || pax.length < 1 || pax.length > 9) return {err:"pax"};
        for (const p of pax) if (!p || !str(p.n, 60) || !str(p.s, 60) || !/^[A-Z]{2}\d{7}$/.test(p.p || "")) return {err:"pax"};
        if (!Array.isArray(legs) || legs.length < 1 || legs.length > 2) return {err:"items"};
        const lines = [], offers = [];
        for (let li = 0; li < legs.length; li++){
          const l = legs[li], f = this.findOffer(mode, cls, l);
          if (!f) return {err:"offer_gone"};
          if (l.date < today || (l.date === today && f.depMin <= now + 60)) return {err:"offer_gone"};
          if (f.seats < pax.length) return {err:"no_seats"};
          const st = Array.isArray(l.seats) ? l.seats : [];
          if (mode === "poyezd" ? st.length !== pax.length : (st.length && st.length !== pax.length)) return {err:"seats"};
          if (st.length){ const e = this.seatCheck(legKey(f), st, holder, {mode, cls, from:l.from, to:l.to, date:l.date, code:l.code, depAt:l.depAt}); if (e) return {err:e}; }
          offers.push(f);
          pax.forEach((p, pi) => lines.push({li, pi, seatKey:st[pi] || "", key:legKey(f), price:legPrice(f.price, tf ? tf.m : 1), offer:f, leg:l}));
        }
        if (legs.length === 2){
          const [a, b] = legs, after = new Date(Date.parse(offers[0].arrAt + ":00Z") + 2 * 3600e3).toISOString().slice(0, 16);
          if (b.from !== a.to || b.to !== a.from || offers[1].depAt < after) return {err:"items"};
        }
        out.push({type:"travel", cat:mode, mode, cls, tariff:tf ? tf.k : null, pax, lines, total:lines.reduce((q, l) => q + l.price, 0)});
      } else return {err:"items"};
    }
    return {items:out, subtotal:out.reduce((q, x) => q + x.total, 0)};
  }
  applyPromo(code, priced, user){
    code = str(code, 30).toUpperCase();
    if (!code) return {discount:0};
    const p = this.db.get("promos", code);
    if (!p || !p.active) return {err:"promo_invalid"};
    if (p.until && p.until < this.today()) return {err:"promo_expired"};
    if (p.maxUses && p.uses >= p.maxUses) return {err:"promo_limit"};
    if (p.perUser && user && this.db.all("orders").some(o => o.user === user.id && o.promo === code && o.status !== "cancelled")) return {err:"promo_used"};
    const elig = priced.items.filter(x => !p.cats || !p.cats.length || p.cats.includes(x.cat)).reduce((q, x) => q + x.total, 0);
    if (!elig) return {err:"promo_cats"};
    if (priced.subtotal < (p.minTotal || 0)) return {err:"promo_min", min:p.minTotal};
    const d = p.type === "pct" ? Math.round(elig * p.value / 100 / 1000) * 1000 : Math.min(p.value, elig);
    return {discount:d, code, promo:p};
  }
  quote(body, ctx){
    const user = this.user(ctx), priced = this.priceItems(body.items, this.holder(ctx), user);
    if (priced.err) return bErr(409, priced.err);
    const pr = this.applyPromo(body.promo, priced, user);
    const discount = pr.err ? 0 : pr.discount;
    return bOk(200, {items:priced.items.map(x => ({type:x.type, total:x.total, count:x.lines.length})), subtotal:priced.subtotal, discount, total:priced.subtotal - discount, promo:pr.err ? {error:pr.err, min:pr.min} : (pr.code ? {code:pr.code} : null)});
  }

  /* ---------- buyurtma ---------- */
  order(body, ctx){
    const user = this.user(ctx);
    if (!user) return bErr(401, "auth");
    if (body.agree !== true) return bErr(400, "agree");
    const buyer = str(body.buyer, 80), email = str(body.email, 120);
    if (buyer.length < 2) return bErr(400, "buyer");
    if (email && !/^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,20}$/.test(email)) return bErr(400, "email");
    const payment = ["Payme","Click","Uzcard / Humo","Visa / Mastercard"].includes(body.payment) ? body.payment : "Payme";
    const holder = "u:" + user.id;
    let out;
    this.db.tx(() => {
      const priced = this.priceItems(body.items, holder, user);
      if (priced.err){ out = bErr(409, priced.err); return; }
      const pr = this.applyPromo(body.promo, priced, user);
      if (pr.err){ out = bErr(409, pr.err, {min:pr.min}); return; }
      const total = priced.subtotal - pr.discount, ratio = priced.subtotal ? total / priced.subtotal : 1;
      const pending = this.o.payment !== "demo";
      const order = {id:this.rand(12), code:this.rand(6), user:user.id, phone:user.phone, buyer, email, payment,
        subtotal:priced.subtotal, discount:pr.discount, promo:pr.code || "", total, refunded:0,
        status:pending ? "pending" : "paid", createdAt:new Date().toISOString(), day:this.today(), payExp:Date.now() + this.o.payMin * 60e3};
      const tickets = [];
      priced.items.forEach(x => x.lines.forEach(l => {
        const t = {id:this.rand(10), order:order.id, code:order.code, user:user.id, status:pending ? "pending" : "valid", price:l.price, paid:Math.round(l.price * ratio), cat:x.cat, createdAt:order.createdAt};
        if (x.type === "event"){
          Object.assign(t, {kind:"event", ev:x.ev.id, show:x.s.id, key:x.key, date:x.s.date, min:x.s.min, venue:x.s.venue, hall:x.s.hall, dur:x.ev.dur,
            title:{uz:evTitle(x.ev, "uz"), ru:evTitle(x.ev, "ru"), en:evTitle(x.ev, "en")}});
          if (l.seat){ t.seat = l.seat; t.seatKey = l.seatKey; } else { t.unit = l.unit; t.unitKey = l.unit.k; }
        } else {
          const f = l.offer, p = x.pax[l.pi];
          Object.assign(t, {kind:"travel", mode:x.mode, cls:x.cls, tariff:x.tariff, key:l.key, li:l.li, legs:x.lines.filter(q => q.pi === 0).length, pi:l.pi,
            from:l.leg.from, to:l.leg.to, date:l.leg.date, depAt:f.depAt, arrAt:f.arrAt, dur:f.dur, carrier:f.carrier, flight:f.code,
            pax:{n:str(p.n, 60), s:str(p.s, 60), p:p.p.slice(0, 2) + "*****" + p.p.slice(-2)}, seatKey:l.seatKey || ""});
          if (!t.seatKey) delete t.seatKey;
        }
        t.qr = `GC1|${t.id}|${this.sig(t.id)}`;
        tickets.push(t);
      }));
      order.items = priced.items.map(x => x.type === "event" ? {type:"event", ev:x.ev.id, show:x.s.id, count:x.lines.length, total:x.total}
        : {type:"travel", mode:x.mode, cls:x.cls, tariff:x.tariff, pax:x.pax.map(p => ({n:str(p.n, 60), s:str(p.s, 60), p:p.p})), legs:x.lines.filter(q => q.pi === 0).map(q => ({from:q.leg.from, to:q.leg.to, date:q.leg.date, flight:q.offer.code, depAt:q.offer.depAt})), count:x.lines.length, total:x.total});
      tickets.forEach(t => {
        const b = this.booked(t.key);
        if (t.seatKey) b.seats[t.seatKey] = t.id;
        if (t.unitKey) b.counts[t.unitKey] = (b.counts[t.unitKey] || 0) + 1;
        this.db.put("booked", t.key, b);
        this.db.put("tickets", t.id, t);
      });
      const used = new Set(tickets.map(t => t.key));
      this.db.all("holds").forEach(h => { if (h.holder === holder && used.has(h.key)) this.db.del("holds", h.id); });
      if (pr.promo){ pr.promo.uses = (pr.promo.uses || 0) + 1; this.db.put("promos", pr.promo.code, pr.promo); }
      this.db.put("orders", order.id, order);
      if (pending && this.o.payUrl) order.payUrl = this.o.payUrl(order);
      out = bOk(200, {order, tickets});
    });
    if (out.status === 200 && this.o.sms && out.body.order.status === "paid"){
      const o = out.body.order;
      Promise.resolve(this.o.sms(o.phone, `Go-Chipta: buyurtma ${o.code} tasdiqlandi. Chiptalar soni: ${out.body.tickets.length}.`)).catch(() => {});
    }
    return out;
  }
  /* To'lov tizimi tasdiqlaganda (server.js / payments.js chaqiradi) */
  markPaid(orderId, amount){
    const o = this.db.get("orders", orderId);
    if (!o) return {err:"not_found"};
    if (o.status === "paid") return {ok:true, already:true};
    if (o.status !== "pending") return {err:"state"};
    if (Math.round(amount) !== o.total) return {err:"amount"};
    this.db.tx(() => {
      o.status = "paid"; o.paidAt = new Date().toISOString(); this.db.put("orders", o.id, o);
      this.db.all("tickets").filter(t => t.order === o.id && t.status === "pending").forEach(t => { t.status = "valid"; this.db.put("tickets", t.id, t); });
    });
    return {ok:true};
  }
  myOrders(ctx){
    const u = this.user(ctx);
    if (!u) return bErr(401, "auth");
    const tix = this.db.all("tickets").filter(t => t.user === u.id);
    const orders = this.db.all("orders").filter(o => o.user === u.id && o.status !== "cancelled").sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(o => Object.assign({}, o, {tickets:tix.filter(t => t.order === o.id)}));
    return bOk(200, {orders});
  }

  /* ---------- qaytarish ---------- */
  refund(id, ctx){
    const u = this.user(ctx);
    if (!u) return bErr(401, "auth");
    const t = this.db.get("tickets", id);
    if (!t || t.user !== u.id) return bErr(404, "not_found");
    if (t.status !== "valid") return bErr(409, "refund_state");
    const mins = t.kind === "event" ? minutesUntil(t.date, t.min, this.today(), this.now()) : minutesUntil(t.date, depMinOf(t.depAt), this.today(), this.now());
    const pct = refundPct(t, mins);
    if (!pct) return bErr(409, "refund_denied");
    const amount = Math.round(t.paid * pct / 100 / 1000) * 1000;
    this.db.tx(() => {
      t.status = "refunded"; t.refundPct = pct; t.refundAmount = amount; t.refundedAt = new Date().toISOString();
      this.db.put("tickets", t.id, t); this.freeSeat(t);
      const o = this.db.get("orders", t.order); if (o){ o.refunded = (o.refunded || 0) + amount; this.db.put("orders", o.id, o); }
    });
    return bOk(200, {ticket:t, amount, pct});
  }

  /* ---------- kirishda QR tekshiruvi ---------- */
  scan(body, ctx){
    const u = this.user(ctx);
    if (!u) return bErr(401, "auth");
    if (u.role !== "staff" && u.role !== "admin") return bErr(403, "forbidden");
    const raw = str(body.qr, 200);
    let id = "", m = /^GC1\|([A-Z0-9]{10})\|([0-9a-f]{12})$/.exec(raw);
    if (m){ if (this.sig(m[1]) !== m[2]) return bOk(200, {result:"invalid"}); id = m[1]; }
    else if (/^[A-Za-z0-9]{10}$/.test(raw)) id = raw.toUpperCase();
    else return bOk(200, {result:"invalid"});
    const t = this.db.get("tickets", id);
    if (!t) return bOk(200, {result:"invalid"});
    const info = this.ticketInfo(t);
    if (t.status === "used") return bOk(200, {result:"used", usedAt:t.usedAt, ticket:info});
    if (t.status !== "valid") return bOk(200, {result:t.status, ticket:info});
    if (t.date !== this.today() && !body.force) return bOk(200, {result:"wrong_day", ticket:info});
    t.status = "used"; t.usedAt = new Date().toISOString(); t.usedBy = u.id; t.usedDay = this.today();
    this.db.put("tickets", t.id, t);
    return bOk(200, {result:"ok", ticket:this.ticketInfo(t)});
  }
  ticketInfo(t){
    const o = this.db.get("orders", t.order) || {};
    const keep = ["id","code","kind","status","title","date","min","venue","hall","seat","unit","mode","cls","tariff","from","to","depAt","carrier","flight","pax","seatKey","usedAt","ev","cat"];
    const x = {}; keep.forEach(k => { if (t[k] !== undefined) x[k] = t[k]; });
    x.buyer = o.buyer || ""; x.phone = o.phone ? maskPhone(o.phone) : "";
    return x;
  }

  /* ---------- reyslar (haqiqiy API ulangan bo'lsa) ---------- */
  async flights(q){
    if (!this.o.flights) return bErr(404, "no_flights");
    const offers = await this.o.flights(q);
    const cls = q.cls === "BUSINESS" ? 1 : 0;
    offers.forEach(o => this.offerCache.set("avia|" + cls + "|" + o.code + "|" + o.depAt, {offer:o, exp:Date.now() + 40 * 60e3}));
    return bOk(200, {offers});
  }

  /* ---------- admin ---------- */
  admin(m, a, b, body, ctx){
    const u = this.user(ctx);
    if (!u) return bErr(401, "auth");
    if (u.role !== "admin") return bErr(403, "forbidden");
    if (a === "stats" && m === "GET") return this.stats();
    if (a === "orders" && m === "GET"){
      const q = str(body.q, 40).toUpperCase().replace(/\s/g, "");
      const tix = this.db.all("tickets");
      const list = this.db.all("orders").filter(o => !q || o.code.includes(q) || o.phone.includes(q.replace(/\D/g, "") || "#") || (o.buyer || "").toUpperCase().includes(q))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 200)
        .map(o => Object.assign({}, o, {tickets:tix.filter(t => t.order === o.id).map(t => ({id:t.id, status:t.status, kind:t.kind, title:t.title, from:t.from, to:t.to, date:t.date, price:t.price}))}));
      return bOk(200, {orders:list});
    }
    if (a === "venues" && m === "GET") return bOk(200, {venues:this.db.all("venues")});
    if (a === "events" && !b && m === "GET"){
      const tix = this.db.all("tickets").filter(t => t.kind === "event" && (t.status === "valid" || t.status === "used"));
      return bOk(200, {events:this.db.all("events").map(e => Object.assign({}, e, {sold:tix.filter(t => t.ev === e.id).length, revenue:tix.filter(t => t.ev === e.id).reduce((q, t) => q + t.paid, 0), sessionsList:genSessions(e, this.today()).filter(s => s.date >= this.today()).map(s => ({date:s.date, time:hhmm(s.min), venue:s.venue, hall:s.hall}))}))});
    }
    if (a === "events" && b && m === "PUT") return this.saveEvent(b, body);
    if (a === "events" && b && m === "DELETE"){ const e = this.db.get("events", b); if (!e) return bErr(404, "not_found"); e.active = false; e.rev = (e.rev || 0) + 1; this.db.put("events", b, e); return bOk(200, {ok:true}); }
    if (a === "events" && b && m === "POST" && body.restore){ const e = this.db.get("events", b); if (!e) return bErr(404, "not_found"); e.active = true; e.rev = (e.rev || 0) + 1; this.db.put("events", b, e); return bOk(200, {ok:true}); }
    if (a === "promos" && !b && m === "GET") return bOk(200, {promos:this.db.all("promos")});
    if (a === "promos" && b && m === "PUT") return this.savePromo(b, body);
    if (a === "promos" && b && m === "DELETE"){ this.db.del("promos", b.toUpperCase()); return bOk(200, {ok:true}); }
    if (a === "users" && !b && m === "GET"){
      const os = this.db.all("orders");
      return bOk(200, {users:this.db.all("users").map(x => Object.assign(this.pubUser(x), {createdAt:x.createdAt, orders:os.filter(o => o.user === x.id && o.status === "paid").length}))});
    }
    if (a === "users" && b && m === "PUT"){
      const x = this.db.get("users", b);
      if (!x) return bErr(404, "not_found");
      if (!ROLES.includes(body.role)) return bErr(400, "role");
      if (x.id === u.id && body.role !== "admin") return bErr(400, "self_role");
      x.role = body.role; this.db.put("users", x.id, x); return bOk(200, {user:this.pubUser(x)});
    }
    return bErr(404, "not_found");
  }
  stats(){
    const orders = this.db.all("orders").filter(o => o.status === "paid"), tix = this.db.all("tickets");
    const today = this.today(), days = [];
    for (let i = 13; i >= 0; i--){ const d = isoShift(today, -i); days.push({day:d, revenue:orders.filter(o => o.day === d).reduce((q, o) => q + o.total, 0)}); }
    const sold = tix.filter(t => t.status === "valid" || t.status === "used");
    const byCat = {}; sold.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.paid; });
    const byEv = {}; sold.filter(t => t.kind === "event").forEach(t => { byEv[t.ev] = byEv[t.ev] || {ev:t.ev, title:t.title, count:0, revenue:0}; byEv[t.ev].count++; byEv[t.ev].revenue += t.paid; });
    return bOk(200, {
      revenue:orders.reduce((q, o) => q + o.total - (o.refunded || 0), 0), orders:orders.length, tickets:sold.length,
      todayRevenue:orders.filter(o => o.day === today).reduce((q, o) => q + o.total, 0), todayOrders:orders.filter(o => o.day === today).length,
      refunds:tix.filter(t => t.status === "refunded").reduce((q, t) => q + (t.refundAmount || 0), 0),
      scansToday:tix.filter(t => t.status === "used" && t.usedDay === today).length, users:this.db.all("users").length,
      days, byCat, top:Object.values(byEv).sort((x, y) => y.revenue - x.revenue).slice(0, 5)
    });
  }
  saveEvent(id, body){
    const isNew = id === "new", old = isNew ? null : this.db.get("events", id);
    if (!isNew && !old) return bErr(404, "not_found");
    const e = body.event || {};
    const cat = old && old.film ? "kino" : e.cat;
    if (!EVENT_CATS.includes(cat)) return bErr(400, "cat");
    const venues = this.db.all("venues"), vids = venues.map(v => v.id);
    const t = {uz:str(e.t && e.t.uz, 120)}; t.ru = str(e.t && e.t.ru, 120) || t.uz; t.en = str(e.t && e.t.en, 120) || t.uz;
    if (!t.uz && !(old && old.teams)) return bErr(400, "title");
    const price = Math.round(+e.price), dur = Math.round(+e.dur);
    if (!(price >= 1000 && price <= 1e8)) return bErr(400, "price");
    if (!(dur >= 10 && dur <= 720)) return bErr(400, "dur");
    if (!AGES.includes(e.age)) return bErr(400, "age");
    const venue = vids.includes(e.venue) ? e.venue : (old && old.film ? "" : null);
    if (venue === null) return bErr(400, "venue");
    if (!Array.isArray(e.sessions) || e.sessions.length > 200) return bErr(400, "sessions");
    const sessions = [];
    for (const x of e.sessions){
      if (!x || !isDate(x.date) || !isTime(x.time)) return bErr(400, "sessions");
      const v = x.venue && vids.includes(x.venue) ? x.venue : venue;
      if (!v) return bErr(400, "sessions");
      sessions.push({date:x.date, time:x.time, venue:v, hall:Math.max(0, Math.min(20, Math.round(+x.hall || 0)))});
    }
    if (!sessions.length && !(old && old.film)) return bErr(400, "sessions");
    let img = "";
    if (typeof e.img === "string" && e.img){
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(e.img) || e.img.length > 700000) return bErr(400, "img");
      img = e.img;
    }
    const hue = Array.isArray(e.hue) && e.hue.length === 2 ? e.hue.map(h => Math.max(0, Math.min(360, Math.round(+h || 0)))) : (old && old.hue) || [260, 200];
    const nid = isNew ? "x" + this.rand(6).toLowerCase() : id;
    const ev = Object.assign({}, old || {}, {id:nid, cat, venue:venue || (old && old.venue) || "", t, genre:str(e.genre, 30) || (old && old.genre) || "drama", age:e.age, dur, price,
      hue, img, feat:!!e.feat, pop:!!e.pop, active:true, rev:((old && old.rev) || 0) + 1, updatedAt:new Date().toISOString()});
    if (sessions.length){ ev.sessions = sessions; delete ev.s; delete ev.d; }
    if (old && old.film && !sessions.length){ delete ev.sessions; }
    if (e.types === null || e.types === "") delete ev.types; else if (e.types !== undefined){ if (!TYPE_SETS[e.types]) return bErr(400, "types"); ev.types = e.types; }
    this.db.put("events", nid, ev);
    return bOk(200, {event:ev});
  }
  savePromo(code, body){
    code = String(code).toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return bErr(400, "promo_code");
    const p = body.promo || {}, old = this.db.get("promos", code);
    const type = p.type === "fix" ? "fix" : "pct", value = Math.round(+p.value);
    if (type === "pct" ? !(value >= 1 && value <= 90) : !(value >= 1000 && value <= 1e7)) return bErr(400, "promo_value");
    const cats = Array.isArray(p.cats) ? p.cats.filter(c => CATS.includes(c)) : [];
    const doc = {code, type, value, minTotal:Math.max(0, Math.round(+p.minTotal || 0)), until:isDate(p.until) ? p.until : "", maxUses:Math.max(0, Math.round(+p.maxUses || 0)),
      cats, perUser:!!p.perUser, active:p.active !== false, uses:old ? old.uses || 0 : 0};
    this.db.put("promos", code, doc);
    return bOk(200, {promo:doc});
  }
}

module.exports = {sha256, CATS, EVENT_CATS, CITIES, SEED_VENUES, TEAMS, TYPE_SETS, SEED_EVENTS, DOM_AIR, INTL_AIR, FAST_TRAIN, TR_CLASSES, pad, iso, parse, isoShift, dayDiff, hhmm, toMin, seed, rng, P, SEAT_ZONES, SEC_CLASS, SECTORS, modeOf, typeSet, sectorsOf, tierList, hallLayout, mockOccupied, soldOutSectors, genSessions, isUpcoming, minutesUntil, dist, localAt, depMinOf, TARIFFS, TR_WAGONS, legPrice, mockGen, legKey, planeLayout, trainLayout, allSeatKeys, freeSeatsBase, refundPct, normPhone, maskPhone, Backend, evTitle};
