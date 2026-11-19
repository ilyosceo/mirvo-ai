### Mirvo AI — ko‘rinadigan va eshitiladigan bilim muhiti


Mirvo AI — o‘zbek tilidagi tabiiy savollarni tushunib, bir mavzuni bosqichma-bosqich tushuntiradigan sun’iy intellektli ta’lim platformasi. Loyihaning asosiy maqsadi bilimni faqat matn ko‘rinishida bermasdan, murakkab tushunchani 3D modellar, animatsiyalar, grafiklar, diagrammalar, formulalar va ovozli izohlar orqali tushunarli qilish.


Oddiy chatbotlardan farqli ravishda, Mirvo AI o‘quvchi mavzuni mavhum holatda qabul qilmasligi uchun bir nechta taqdimot usullaridan foydalanadi. Masalan, geometriya mavzusi faqat formulalar bilan emas, ob’yektni aylantirish va hajmni ko‘rish imkoniyati orqali tushuntiriladi. Kimyo mavzusi molekulyar tuzilma sifatida, fizika jarayonlari esa animatsiyali sahna yoki kuch vektorlari orqali ko‘rsatiladi.


Mirvo AI o‘quvchini passiv tinglovchi sifatida emas, balki interaktiv ishtirokchi sifatida ko‘radi. Tizim tezda responsive yordamchi, savol va tushuncha bo‘yicha sinov va izoh beruvchi, oldingi natijalarni eslab qoladigan shaxsiy dars muhiti vazifasini bajaradi.



## Asosiy imkoniyatlar


### O‘zbek tilida tabiiy muloqot



- O‘zbek tilida tabiiy so‘zlar bilan savol berish

- Umumiy maʼlum motivlashgan va oson maslahati berish

- Talabning darajasiga mos ravishda tushuntirish

- Qisqa, batafsil yoki qadamma-qadam rejimda javob berish

- Talaffuz, termin va ma’noga mos o‘zbekcha izohlar



### 3D taʼlim vizualizatsiyasi



- Geometrik jism va stereometrik shakllarni 3D ko‘rinishda namoyish etish

- Ob’yektni aylantirish, yaqinlashtirish va nuqtalarga qarab ko‘rish

- Pyramida, prizma, kub, shar, konus, silindr, ellipsoid va kvadrik yuzalar

- Harakat, o‘q, tekislik va koordinata ko‘rsatkichlarini vizualizatsiya qilish

- Murakkab shakllarni elementlarga ajratish va izohlash



### Matematika va fan instrumentlari



- LaTeX asosidagi formulalar va matematik yozuvlar

- Funksiya grafiklari

- Animatsiyali geometrik konstruktsiyalar

- Kimyoviy molekula va kristall tuzilmalar

- Fizik jarayonlar, kuchlar, yo‘l va tezlik vizualizatsiyalari

- Diagrammalar, jadval va mantiqiy oqim sxemalari



### Ovozli muloqot



- Nutqni o‘qib olish

- Darsni ovoz orqali o‘qib tushuntirish

- Xafa bo‘lmagan, tabiiy talaffuz

- Talaffuzdan keyin AI javobi

- Chalg‘ituvchi shovqinlar bilan ishlash uchun optimizatsiya



### Aqlli dars berish



- Bir mavzu ichida darslik ketma-ketligini saqlash

- Oldingi tushuntirishga qarab yangi izoh berish

- Oson — asosiy — chuqur tushuntirishga o‘tish

- Keshdan allaqachon tayyor darsni qayta foydalanish

- Takroriy savollar uchun keraksiz AI xarajatini kamaytirish



### Foydalanuvchi va bilim sinxronizatsiyasi



- Saqlangan darslar va faoliyatingizni ushbu qurilmada saqlash

- AI va bepul so‘rovlar statistikasi

- Token sarfi va taxminiy xarajatlar ko‘rsatkichi


## Texnik ustunliklar



- **React va TypeScript** — komponentlar va UI holatini boshqarish

- **Modal + DashScope Qwen** — server-side dars yaratish; Gemini optional AI object-illustration fallback’i uchun

- **Three.js / React Three Fiber** — kuchli 3D sahnalar

- **3DMol.js** — kimyoviy va molekulyar modellar

- **Plotly** — interaktiv grafiklar

- **Mermaid** — mantiqiy sxema va diagrammalar

- **KaTeX** — matematik formulalarni render qilish

- **TTS voice engine** — nutqni sintez qilish

- **Deterministik kesh va lesson matcher** — takroriy so‘rovlarni tezroq qaytarish




## Foydalanish


### Lokal ishga tushirish

```bash
npm install
npm run dev
```

Production build va lokal preview:

```bash
npm run build
npm run preview
```

Vercel’da repository’ni import qiling. Yangi darslar server orqali Modal’dagi Qwen xizmatiga yuboriladi; brauzer Modal manzili yoki maxfiy kalitni olmaydi. Deploy bo‘yicha talablar quyidagi **Qwen backend deploy** bo‘limida keltirilgan. `GEMINI_API_KEY` faqat ixtiyoriy AI obyekt-rasmlari uchun kerak; dars yaratish uchun u endi ishlatilmaydi.

### Qwen backend deploy

`modal_service/app.py` CPU’da ishlaydigan FastAPI xizmatini taqdim etadi. Deploy qilishdan oldin DashScope, Modal va Vercel’da quyidagi sozlamalarni kiriting; maxfiy qiymatlarni repository, `.env` fayli yoki brauzer kodiga qo‘shmang.

- DashScope Model Studio’dan API key oling.
- Modal Dashboard → **Secrets** bo‘limida `mirvo-qwen-secrets` Secret yarating. `DASHSCOPE_API_KEY` qiymatiga DashScope key’ni, `MODAL_GATEWAY_SECRET` qiymatiga kriptografik tasodifiy, kamida 32 belgili sirni kiriting. Ixtiyoriy sozlamalar ham shu Secret’da beriladi: `QWEN_MODEL` (default `qwen-plus`) va `DASHSCOPE_ENDPOINT` (default xalqaro endpoint; faqat koddagi ruxsat etilgan DashScope hostlari ishlaydi). API key yoki shared secret’ni chat, kod, `.env` yoki browser bundle’ga qo‘ymang.
- Modal’da login qiling (`modal setup`, agar hali ulanmagan bo‘lsa), so‘ng Python 3.11+ muhitida `python -m pip install -r modal_service/requirements.txt` va `modal deploy modal_service/app.py` buyrug‘ini bajaring. Deploy `mirvo-qwen-lesson-cache` Volume’ni yaratadi va Modal endpoint’ni chiqaradi; URL’ga `/v1/lesson/generate` suffix’ini qo‘shib to‘liq endpoint qiling.
- Vercel Project → **Settings → Environment Variables** bo‘limida `MODAL_QWEN_URL` (to‘liq Modal endpoint) va Modal Secret’dagi aynan bir xil `MODAL_GATEWAY_SECRET` qiymatlarini qo‘shing. Kerakli Production/Preview/Development muhitlarini belgilang va keyin Vercel deployment’ni qayta deploy qiling.
- Volume faqat qisqa, umumiy ta’limiy so‘rovlar uchun umumiy lesson JSON cache saqlaydi (30 kunlik TTL, ko‘pi bilan 1,000 yozuv). Rasmli, shaxsiyga o‘xshash yoki mos kelmagan so‘rovlar cache qilinmaydi. Filtrlash evristik, maxfiy ma’lumotni aniqlash kafolati emas; bu xususiy chat yoki foydalanuvchi tarixi emas. Volume saqlash va Modal compute xarajatlari provider/plan bo‘yicha farq qiladi; bepul yoki ma’lum sig‘im kafolati berilmaydi. Cache operatsiyalari serializatsiya qilingan; bir container va ko‘pi bilan 8 concurrent request.
- Uzbek TTS route (`/api/speech/tts`) Vercel’da `msedge-tts` orqali qoladi; u Modal Volume’ga MP3 saqlamaydi. Foydalanuvchi tarixi ham qurilmada qoladi.

DashScope model tanlovi server konfiguratsiyasidagi ruxsat etilgan ro‘yxatdan olinadi. Modal’da har bir ilova process’i uchun daqiqasiga 30 ta so‘rov limiti bor; u process qayta ishga tushganda yangilanadi va account/global limit o‘rnini bosmaydi. Vercel endpointi ommaga ochiq: ichki shared-secret foydalanuvchilarni aniqlamaydi yoki abuse’dan o‘zi himoya qilmaydi. Production’da Vercel uchun edge/WAF rate limit va provider billing limitlarini ham sozlang. Modal Volume umumiy ilova keshi, shaxsiy history emas; shaxsiy dars tarixi hozircha faqat qurilmada qoladi.


1. O‘zbek tilida mavzu yoki savol kiriting.

2. Mirvo AI savolning darajasi va qo‘llanilish maqsadini aniqlaydi.

3. Kerak bo‘lsa mavjud kesh yoki deterministik parserdan foydalanadi.

4. Jismoniy model, diagramma, 3D sahna yoki formula hosil qilinadi.

5. Tizim mavzuni talaffuz yoki ovoz bilan tushuntiradi.

6. Foydalanuvchi yana savol berib darsni davom ettiradi.



**Misol savollar:**



- `Piramida hajmi qanday topiladi?`

- `Parabola nima va uning grafigi qanday?`

- `Nyutonning ikkinchi qonuni nimani anglatadi?`

- `Vodorod molekulasi qanday tuzilishga ega?`

- `Integralni sodda misolda tushuntirib ber`

- `To‘g‘ri burchakli uchburchakning tashqi markazi qayerda?`




## Xavfsizlik siyosati

API kalitlari faqat server yoki deployment muhitida environment variable sifatida saqlanishi kerak; secretlarni GitHub’ga yubormang.



## Loyiha holati


Mirvo AI faol ravishda ishlab chiqilmoqda. Kelgusi yo‘nalishlar:



- AI o‘qituvchining shaxsiylashtirilgan metodikasi

- Mavzu bo‘yicha test va viktorinalar

- Foydalanuvchi bilim darajasini kuzatish

- Mock va real test natijalarini qayd qilish

- Maktab darsliklari bilan moslashuv

- Mobile va offline rejimni qo‘llab-quvvatlash

- O‘qituvchi paneli

- Sinf, guruh va kollektiv dars muhiti
