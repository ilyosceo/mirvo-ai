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

`modal_service/app.py` CPU’da ishlaydigan FastAPI xizmatini taqdim etadi. Deploy qilishdan oldin Modal va Vercel’da quyidagi sozlamalarni kiriting; maxfiy qiymatlarni repository, `.env` fayli yoki brauzer kodiga qo‘shmang.

- Modal Secret `mirvo-qwen-secrets`: `DASHSCOPE_API_KEY`, kamida 32 belgili tasodifiy `MODAL_GATEWAY_SECRET`; optional `QWEN_MODEL` (default `qwen-plus`) and `DASHSCOPE_ENDPOINT` (default DashScope international endpoint). Secret’ni Modal dashboard’da yarating.
- Modal CLI (Python 3.11+): `python -m pip install -r modal_service/requirements.txt`, then `modal deploy modal_service/app.py`. Deploy creates the `mirvo-qwen-lesson-cache` Volume.
- The Volume stores a shared cache (30-day expiry, up to 1,000 entries) only for short generic educational prompts that pass a conservative heuristic. Image-based, personal-looking, and other unmatched prompts are not cached. Filtering is heuristic, not a guarantee of detecting sensitive data; do not use this as private chat or user history. Cache file operations are serialized; Modal is limited to one container and 8 concurrent requests.
- Vercel Environment Variables: `MODAL_QWEN_URL` (`/v1/lesson/generate` bilan tugaydigan Modal deploy URL) va Modal Secret’dagi aynan o‘sha `MODAL_GATEWAY_SECRET`.

DashScope endpointi xizmat kodida ruxsat etilgan hostlar bilan cheklangan; model tanlovi server konfiguratsiyasida ruxsat etilgan ro‘yxatdan olinadi. Modal’da har bir ilova process’i uchun daqiqasiga 30 ta so‘rov limiti ham bor; u process qayta ishga tushganda yangilanadi va account/global limit o‘rnini bosmaydi. Vercel endpointi ommaga ochiq: ichki shared-secret foydalanuvchilarni aniqlamaydi yoki abuse’dan o‘zi himoya qilmaydi. Production’da Vercel uchun edge/WAF rate limit va billing limitlarini ham sozlang. Modal Volume umumiy ilova keshi, shaxsiy history emas; shaxsiy dars tarixi hozircha faqat qurilmada qoladi.


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
