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

- **Modal backend** — server-side dars yaratish va TTS; credentials faqat Vercel server environment’da

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

Vercel’da repository’ni import qiling. Dars va TTS so‘rovlari server tomonidagi Vercel proxy orqali alohida deploy qilingan Modal backend’ga yuboriladi. Brauzer Modal manzili yoki maxfiy kalitni olmaydi.

### Modal backend ulanishi

Modal FastAPI backend alohida deploy qilingan; ushbu repository backend’ni yaratmaydi yoki deploy qilmaydi. Vercel Project → **Settings → Environment Variables** bo‘limida server-only `MODAL_BACKEND_URL` (masalan, `https://<workspace>--mirvo-ai-backend-fastapi-app.us-east.modal.run`) va `MIRVO_INTERNAL_SECRET` (Modal backend’dagi qiymat bilan bir xil maxfiy kalit) ni sozlang. `VITE_` prefix ishlatmang; `.env` fayllari `.gitignore` tomonidan e’tiborsiz qoldiriladi. Sozlagandan keyin Vercel deployment’ni qayta deploy qiling.

- Vercel uchun faqat `MODAL_BACKEND_URL` va `MIRVO_INTERNAL_SECRET` kerak. Ikkala qiymatni ham server-side environment sifatida kiriting; maxfiy kalitni repozitoriyga yoki frontend fayllariga qo‘shmang.
- Frontend darsni Vercel `/api/tutor` endpointiga, ovozli ijroni `/api/tts` endpointiga yuboradi. Vercel Modal’ga faqat serverdan POST va `Authorization: Bearer ...` bilan murojaат qiladi. TTS `audio/mpeg` oqimi browser’ga bevosita uzatiladi; u Modal Volume’ga MP3 saqlamaydi. Avvalgi `/api/speech/tts` route moslik uchun saqlangan, ammo frontend oqimida ishlatilmaydi. Foydalanuvchi tarixi qurilmada qoladi.

`/api/tutor` Modal `/tutor` endpoint’iga `{ topic, depth, thinking, image_base64 }` yuboradi va lesson’ni Mirvo `TutorLesson` formatiga moslaydi. `/api/tts` Modal `/tts` endpoint’iga `{ text, voice }` yuboradi va xom `audio/mpeg` bytes qaytaradi. `visual_type` yoki `visual_data` joriy renderer’ga mos kelmasa, route schema mismatch xatosini qaytaradi. Ommaviy endpointlar uchun abuse/rate himoyasini deployment darajasida sozlang; shared secret foydalanuvchini autentifikatsiya qilmaydi. Kerakli Vercel sozlamalari bo‘lmasa, proxy 500 xatosini qaytaradi.

Tutor route JSON so‘rovlarni 6 MiB gacha qabul qiladi. Modal lesson javobida `title` va 1–20 ta `steps` bo‘lishi kerak; har bir step uchun `visual_type` `plotly3d`, `plotly2d`, `threejs`, `pdb`, `pubchem`, `mermaid`, `svg2d` yoki tanilgan alias bo‘lishi, `visual_data` esa `RenderParams` kalitlaridan foydalanadigan obyekt bo‘lishi kerak. Proxy ularni UI kutadigan `topic_title`, `step_title`, `katex_formulas`, `render_params` va boshqa `TutorLesson` maydonlariga o‘giradi.


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
