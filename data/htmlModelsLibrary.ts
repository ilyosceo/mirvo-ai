export interface MirvoPartMeta {
  id: string;
  nameUz: string;
}

export interface MirvoLessonStep {
  titleUz: string;
  textUz: string;
  focusPart: string; // 'full' | partId
  svgX?: number; // used when focusing an AI-added part on 1600x900 canvas
  svgY?: number;
  zoom?: number;
  explode?: number; // 0..1 optional exploded state
  durationMs?: number;
  isAddonPart?: boolean;
}

export interface SavedHtmlModelEntry {
  id: string;
  slug: string; // filename without .html inside public/models/
  kind: 'mirvo-scene' | 'self-contained';
  titleUz: string;
  subtitleUz: string;
  category: 'Fizika' | 'Energetika' | 'Texnika' | 'Kimyo' | 'Biologiya';
  publicPath: string;
  keywords: string[];
  parts?: MirvoPartMeta[];
  connectionHints?: string;
  defaultSteps?: MirvoLessonStep[];
}

export interface GeneratedHtmlCacheItem {
  key: string;
  topicTitle: string;
  html: string;
  kind?: 'mirvo-scene' | 'self-contained';
  steps?: MirvoLessonStep[];
  parts?: MirvoPartMeta[];
  baseModelId?: string;
  model: string;
  createdAt: string;
  tokens?: {
    prompt_tokens: number;
    cached_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
}

/**
 * Curated Gold-Standard Interactive HTML Models (14 total: 12 Modular MirvoScene + 2 Self-Contained).
 */
export const HTML_MODELS_LIBRARY: readonly SavedHtmlModelEntry[] = [
  {
    id: 'ges-francis',
    slug: 'ges-francis',
    kind: 'mirvo-scene',
    titleUz: 'Gidroelektr stansiya (GES — Frensis turbinasi)',
    subtitleUz: 'Spiral kamera, yo‘naltiruvchi kurakchalar, Frensis ishchi g‘ildiragi, so‘rish quvuri va generator',
    category: 'Energetika',
    publicPath: '/models/ges-francis.html',
    keywords: [
      'ges',
      'gidroelektr stansiya',
      'gidro elektr stansiya',
      'gidroelektr',
      'gidrostansiya',
      'frensis',
      'francis',
      'gidroturbina',
      'suv turbinasi',
      'suv elektr stansiyasi',
    ],
    parts: [
      { id: 'spiral_case', nameUz: 'Spiral kamera va bosimli kirish quvuri' },
      { id: 'wicket_gates', nameUz: 'Yo‘naltiruvchi apparat kurakchalari' },
      { id: 'runner', nameUz: 'Frensis ishchi g‘ildiragi va val' },
      { id: 'draft_tube', nameUz: 'So‘rish quvuri (diffuzor)' },
      { id: 'generator', nameUz: 'Vertikal gidrogenerator' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900" (pure #ffffff background). Main unit spans x=380..1170, y=96..850. Left pressurized penstock inlet flange is at (x=420, y=616) facing up-left — open white space on left is x=25..375, y=120..780 (ideal for attaching river, dam reservoir, intake gate, or upstream penstock). Right-bottom draft tube water discharge exits at (x=1140, y=790) — open white space on right is x=1180..1575, y=140..860 (ideal for tailrace river channel or step-up transformer/grid tower connected to generator top at x=950, y=220).',
    defaultSteps: [
      {
        titleUz: 'Umumiy tuzilish',
        focusPart: 'full',
        textUz:
          'Gidroelektr stansiyaning yuragi — vertikal Frensis gidroagregati bo‘lib, u suv oqimining potensial va kinetik energiyasini yuqori samaradorlik bilan elektr energiyasiga aylantiradi.',
      },
      {
        titleUz: 'Spiral kamera',
        focusPart: 'spiral_case',
        textUz:
          'Yuqori bosimli suv quvur orqali chig‘anoqsimon spiral kameraga kiradi; kesim torayib borishi hisobiga suv turbina atrofiga bir tekis bosim va aylanma tezlik bilan taqsimlanadi.',
      },
      {
        titleUz: 'Yo‘naltiruvchi kurakchalar',
        focusPart: 'wicket_gates',
        textUz:
          'Bronza yo‘naltiruvchi kurakchalar burchagini o‘zgartirib, ishchi g‘ildirakka tushayotgan suv sarfini va stansiya quvvatini tarmoq yuklamasiga mos ravishda boshqaradi.',
      },
      {
        titleUz: 'Frensis ishchi g‘ildiragi',
        focusPart: 'runner',
        textUz:
          'Egilgan 11 ta gidrodinamik kurakchaga urilgan suv oqimi radial yo‘nalishdan o‘q bo‘ylab pastga buriladi va markaziy po‘lat valni katta burovchi moment bilan aylantiradi.',
      },
      {
        titleUz: 'So‘rish quvuri',
        focusPart: 'draft_tube',
        textUz:
          'Kengayib boruvchi tirsakli so‘rish quvuri ishchi g‘ildirak ostida siyraklanish hosil qilib, chiqib ketayotgan suvning qoldiq kinetik energiyasini ham foydali bosimga qaytaradi.',
      },
      {
        titleUz: 'Vertikal gidrogenerator',
        focusPart: 'generator',
        textUz:
          'Valga bevosita ulangan qutbli rotor mis chulg‘amli stator ichida aylanib, elektromagnit induksiya qonuniga ko‘ra sanoat chastotasidagi o‘zgaruvchan elektr tokini ishlab chiqaradi.',
      },
    ],
  },
  {
    id: 'gaes-modular',
    slug: 'gaes-modular',
    kind: 'mirvo-scene',
    titleUz: 'Gidroakkumulyator elektr stansiyasi (GAES)',
    subtitleUz: 'Yuqori va quyi suv omborlari, bosimli quvur, reversiv turbina-nasos va transformator',
    category: 'Energetika',
    publicPath: '/models/gaes-modular.html',
    keywords: [
      'gaes',
      'gidroakkumulyator',
      'gidroakkumulyatsion',
      'pumped hydro',
      'suv akkumulyator stansiya',
    ],
    parts: [
      { id: 'upper_basin', nameUz: 'Yuqori suv ombori' },
      { id: 'penstock', nameUz: 'Bosimli suv quvuri' },
      { id: 'reversible_turbine', nameUz: 'Reversiv turbina-nasos agregati' },
      { id: 'transformer', nameUz: 'Kuch transformatori' },
      { id: 'lower_basin', nameUz: 'Quyi suv ombori' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Upper basin at (995, 195), penstock at (860, 380), reversible turbine at (715, 545), transformer at (935, 530), lower basin at (580, 660). Open white margins: left x=30..360, y=120..760; right x=1220..1570, y=140..760.',
    defaultSteps: [
      {
        titleUz: 'GAES ishlash prinsipi',
        focusPart: 'full',
        textUz:
          'Gidroakkumulyator stansiya energiya tizimida ulkan qayta zaryadlanuvchi suv batareyasi vazifasini bajaradi: tunda ortiqcha elektrni suvni tepaga haydashga sarflab, tig‘iz vaqtda qayta tok ishlab chiqaradi.',
      },
      {
        titleUz: 'Yuqori suv ombori',
        focusPart: 'upper_basin',
        textUz:
          'Balandlikda joylashgan yuqori havzada to‘plangan suv massasi potensial energiya zaxirasini saqlaydi va kerakli daqiqada stansiyani tez ishga tushirish imkonini beradi.',
      },
      {
        titleUz: 'Bosimli suv quvuri',
        focusPart: 'penstock',
        textUz:
          'Mustahkam po‘lat bosimli quvur ikkala rejimda ham ishlaydi: generatsiyada suvni yuqori bosim ostida turbinaga tushiradi, nasos rejimida esa suvni yuqori omborga qaytaradi.',
      },
      {
        titleUz: 'Reversiv turbina-nasos',
        focusPart: 'reversible_turbine',
        textUz:
          'Qaytarma gidromashina ikki yo‘nalishda aylanadi: suv tushganda generator sifatida tok beradi, tarmoqdan quvvat olganda esa markazdan qochma nasosga aylanadi.',
      },
      {
        titleUz: 'Kuch transformatori',
        focusPart: 'transformer',
        textUz:
          'Kuch transformatori generatsiya paytida kuchlanishni yuqori uzatish liniyasiga ko‘tarib beradi, tungi nasos rejimida esa tarmoqdan dvigatel uchun quvvat qabul qiladi.',
      },
      {
        titleUz: 'Quyi suv ombori',
        focusPart: 'lower_basin',
        textUz:
          'Turbinadan chiqqan suv quyi suv omboriga yig‘iladi va yopiq sikl bo‘yicha keyingi zaryadlash bosqichida yana yuqori havzaga qayta haydaladi.',
      },
    ],
  },
  {
    id: 'aes-vver',
    slug: 'aes-vver',
    kind: 'mirvo-scene',
    titleUz: 'Atom elektr stansiyasi (VVER reaktori)',
    subtitleUz: 'Bosimli reaktor korpusi, TVEL yoqilg‘i va boshqaruv sterjenlari, bug‘ generatori, nasos',
    category: 'Energetika',
    publicPath: '/models/aes-vver.html',
    keywords: [
      'aes',
      'atom elektr',
      'atom stansiya',
      'yadro reaktori',
      'vver',
      'reaktor',
      'tvel',
      'uran',
    ],
    parts: [
      { id: 'pressure_vessel', nameUz: 'Bosimli reaktor korpusi' },
      { id: 'fuel_rods', nameUz: 'Yoqilg‘i sterjenlari (TVEL)' },
      { id: 'control_rods', nameUz: 'Boshqaruv va himoya sterjenlari' },
      { id: 'steam_generator', nameUz: 'Bug‘ generatori' },
      { id: 'coolant_pump', nameUz: 'Asosiy sirkulyatsiya nasosi' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Reactor vessel at (605, 460), steam generator at (892, 368), coolant pump at (1018, 552). Open white margins: left x=30..360; right x=1220..1570 (ideal for secondary steam turbine, cooling tower/gradirnya, or containment shield).',
    defaultSteps: [
      {
        titleUz: 'Ikki konturli VVER tizimi',
        focusPart: 'full',
        textUz:
          'Suv-suvli energetik yadro reaktorida radioaktiv birinchi kontur suvi ikkinchi kontur bug‘idan to‘liq ajratilgan bo‘lib, yadro parchalanish issiqligini xavfsiz elektr energiyasiga aylantiradi.',
      },
      {
        titleUz: 'Bosimli reaktor korpusi',
        focusPart: 'pressure_vessel',
        textUz:
          'Qalin legirlangan po‘lat korpus 160 atmosfera bosimni ushlab turadi, shuning uchun 320 darajagacha qizigan suv birinchi kontur ichida qaynashga o‘tmasdan suyuq holda aylanadi.',
      },
      {
        titleUz: 'Yoqilg‘i sterjenlari (TVEL)',
        focusPart: 'fuel_rods',
        textUz:
          'Sirkoniy qobig‘idagi uran dioksid tabletkalarida boshqariluvchi zanjir reaksiyasi kechib, ulkan miqdordagi issiqlik energiyasini ajratib chiqaradi.',
      },
      {
        titleUz: 'Boshqaruv sterjenlari',
        focusPart: 'control_rods',
        textUz:
          'Bor karbidli yutuvchi sterjenlar aktiv zonaga tushirilsa neytronlarni yutib quvvatni pasaytiradi, ko‘tarilganda esa reaktor quvvatini oshiradi.',
      },
      {
        titleUz: 'Bug‘ generatori',
        focusPart: 'steam_generator',
        textUz:
          'Issiqlik almashinuvchi minglab naychalar orqali birinchi konturdagi qaynoq suv o‘z issiqligini toza ikkinchi kontur suviga berib, turbina uchun to‘yingan bug‘ hosil qiladi.',
      },
      {
        titleUz: 'Asosiy sirkulyatsiya nasosi',
        focusPart: 'coolant_pump',
        textUz:
          'Quvvatli markazdan qochma nasos sovigan birinchi kontur suvini uzluksiz ravishda qaytadan reaktor aktiv zonasiga haydab, issiqlik olib chiqilishini ta’minlaydi.',
      },
    ],
  },
  {
    id: 'power-transformer',
    slug: 'power-transformer',
    kind: 'mirvo-scene',
    titleUz: 'Moyli kuch transformatori',
    subtitleUz: 'Qatlamli po‘lat o‘zak, YK va PK chulg‘amlari, chinni vvodlar, radiator va konservator',
    category: 'Energetika',
    publicPath: '/models/power-transformer.html',
    keywords: [
      'kuch transformatori',
      'moyli transformator',
      'transformator',
      'nimstansiya transformator',
      'konservator',
      'chulgam',
    ],
    parts: [
      { id: 'laminated_core', nameUz: 'Qatlamli elektrotexnik po‘lat o‘zak' },
      { id: 'hv_winding', nameUz: 'Yuqori kuchlanish (YK) chulg‘ami' },
      { id: 'lv_winding', nameUz: 'Past kuchlanish (PK) chulg‘ami' },
      { id: 'bushings', nameUz: 'Chinni kirish izolyatorlari (vvodlar)' },
      { id: 'radiator_fins', nameUz: 'Sovutish radiator qanotlari va moy konturi' },
      { id: 'conservator', nameUz: 'Moy kengaytirish baki (konservator)' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Transformer centered around x=450..1150, y=140..780; porcelain bushings on top around (x=780, y=210). Open white margins: left x=30..390 (incoming power plant/generator line), right x=1190..1570 (outgoing high-voltage transmission tower/consumer load).',
    defaultSteps: [
      {
        titleUz: 'Moyli kuch transformatori',
        focusPart: 'full',
        textUz:
          'Moyli kuch transformatori o‘zgaruvchan tok chastotasini o‘zgartirmagan holda kuchlanishni uzoq masofaga uzatish uchun ko‘tarib yoki iste’molchilar uchun pasaytirib beradi.',
      },
      {
        titleUz: 'Qatlamli magnit o‘zak',
        focusPart: 'laminated_core',
        textUz:
          'Yupqa izolyatsiyalangan elektrotexnik po‘lat plastinalardan yig‘ilgan yopiq o‘zak o‘zgaruvchan magnit oqimini o‘tkazadi va uyurma tok isroflarini keskin kamaytiradi.',
      },
      {
        titleUz: 'Yuqori kuchlanish chulg‘ami',
        focusPart: 'hv_winding',
        textUz:
          'Ko‘p o‘ramli mis chulg‘am yuqori kuchlanish va kichikroq tokka mo‘ljallangan bo‘lib, o‘ramlar nisbati orqali chiqish kuchlanishini belgilaydi.',
      },
      {
        titleUz: 'Past kuchlanish chulg‘ami',
        focusPart: 'lv_winding',
        textUz:
          'O‘zakka yaqin joylashgan qalin kesimli past kuchlanish chulg‘ami katta tok yuklamasiga bardosh beradi va elektromagnit induksiya hisobiga energiya uzatadi.',
      },
      {
        titleUz: 'Chinni izolyatorlar (vvodlar)',
        focusPart: 'bushings',
        textUz:
          'Qovurg‘ali chinni izolyatorlar yuqori kuchlanishli simlarni tuproqlangan metall bak devoridan elektr teshilishsiz xavfsiz olib o‘tadi.',
      },
      {
        titleUz: 'Radiator va konservator',
        focusPart: 'radiator_fins',
        textUz:
          'Transformator moyi chulg‘amlarni ham izolyatsiya qiladi, ham qizigan moy tabiiy konveksiya bilan radiator qanotlarida soviydi; yuqoridagi konservator esa moyning issiqlik kengayishini qabul qiladi.',
      },
    ],
  },
  {
    id: 'autotransformer',
    slug: 'autotransformer',
    kind: 'mirvo-scene',
    titleUz: 'Avtotransformator (Yuqori kuchlanishli)',
    subtitleUz: 'Magnit o‘zak, umumiy va ketma-ket chulg‘amlar, RPN kuchlanish rostlagich, vvodlar',
    category: 'Energetika',
    publicPath: '/models/autotransformer.html',
    keywords: [
      'avtotransformator',
      'avto transformator',
      'autotransformer',
      'rpn',
      'ketma ket chulgam',
    ],
    parts: [
      { id: 'core', nameUz: 'Qatlamli po‘lat magnit o‘zak' },
      { id: 'common_winding', nameUz: 'Umumiy chulg‘am' },
      { id: 'series_winding', nameUz: 'Ketma-ket yuqori kuchlanish chulg‘ami' },
      { id: 'tap_selector', nameUz: 'Kuchlanishni rostlash ulagichi (RPN)' },
      { id: 'bushings', nameUz: 'Yuqori va o‘rta kuchlanish chinni vvodlari' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Centered around x=440..1160, y=140..790. Open white margins: left x=30..390 (500 kV grid), right x=1190..1570 (220 kV grid).',
    defaultSteps: [
      {
        titleUz: 'Avtotransformator afzalligi',
        focusPart: 'full',
        textUz:
          'Avtotransformatorda birlamchi va ikkilamchi chulg‘amlar o‘zaro elektr jihatdan bevosita ulangan bo‘lib, energiya bir vaqtda ham magnit maydon, ham elektr tok orqali uzatiladi.',
      },
      {
        titleUz: 'Po‘lat magnit o‘zak',
        focusPart: 'core',
        textUz:
          'Qatlamli po‘lat o‘zak oddiy transformatornikidan ixchamroq bo‘ladi, chunki u umumiy quvvatning faqat tipaviy qisminigina magnit oqim orqali o‘tkazadi.',
      },
      {
        titleUz: 'Umumiy chulg‘am',
        focusPart: 'common_winding',
        textUz:
          'Umumiy chulg‘am ham yuqori, ham o‘rta kuchlanish zanjiriga tegishli bo‘lib, undan ikkala tokning ayirmasi oqib o‘tgani sababli mis sarfi ancha kamayadi.',
      },
      {
        titleUz: 'Ketma-ket chulg‘am',
        focusPart: 'series_winding',
        textUz:
          'Umumiy qism ustiga ketma-ket ulangan chulg‘am qo‘shimcha elektr yurituvchi kuch qo‘shib, 220 va 500 kilovoltli magistral tarmoqlarni bog‘laydi.',
      },
      {
        titleUz: 'Kuchlanish rostlagich (RPN)',
        focusPart: 'tap_selector',
        textUz:
          'Yuklama ostida o‘ram shoxobchalarini qayta ulaydigan mexanizm tarmoqni uzmasdan chiqish kuchlanishini me’yorda ushlab turadi.',
      },
      {
        titleUz: 'Chinni vvodlar',
        focusPart: 'bushings',
        textUz:
          'Baland yuqori kuchlanish va o‘rta kuchlanish chinni izolyatorlari magistral havo liniyalarini transformator ichki chulg‘amlariga xavfsiz ulaydi.',
      },
    ],
  },
  {
    id: 'solar-fes',
    slug: 'solar-fes',
    kind: 'mirvo-scene',
    titleUz: 'Quyosh elektr stansiyasi (FES + IGBT Inverter)',
    subtitleUz: 'Fotovoltaik panellar, Junction Box, DC shina, IGBT inverter va sinusoida AC filtr',
    category: 'Energetika',
    publicPath: '/models/solar-fes.html',
    keywords: [
      'quyosh elektr',
      'quyosh paneli',
      'quyosh stansiya',
      'fes',
      'fotovoltaik',
      'solar',
      'quyosh batareyasi',
      'igbt inverter',
    ],
    parts: [
      { id: 'pv_cells', nameUz: 'Fotovoltaik quyosh elementlari' },
      { id: 'junction_box', nameUz: 'Ulanish qutisi (Junction box)' },
      { id: 'dc_bus', nameUz: 'O‘zgarmas tok shinalari (DC zveno)' },
      { id: 'igbt_inverter', nameUz: 'IGBT invertor moduli' },
      { id: 'ac_filter', nameUz: 'O‘zgaruvchan tok filtri (AC filtr)' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". PV array left-top at (610, 295), junction box (545, 542), DC bus (775, 585), IGBT inverter (938, 542), AC filter output right at (1108, 452). Open white margins: top-left x=40..360 (sunlight/clouds/battery), right x=1220..1570 (house/grid/net-metering).',
    defaultSteps: [
      {
        titleUz: 'Quyosh fotoelektr tizimi',
        focusPart: 'full',
        textUz:
          'Quyosh fotoelektr stansiyasi quyosh nuri fotonlarini yarimo‘tkazgich elementlarda o‘zgarmas tokka, invertor orqali esa 50 gersli sanoat o‘zgaruvchan tokiga aylantiradi.',
      },
      {
        titleUz: 'Fotovoltaik quyosh elementlari',
        focusPart: 'pv_cells',
        textUz:
          'Kremniyli p-n o‘tish qatlamiga tushgan yorug‘lik fotonlari elektronlarni urib chiqarib, harakatlanuvchi zaryadlar oqimi — o‘zgarmas foto-tokni vujudga keltiradi.',
      },
      {
        titleUz: 'Ulanish qutisi (Junction box)',
        focusPart: 'junction_box',
        textUz:
          'Panel ortidagi himoya diodli ulanish qutisi soyada qolgan yacheykalarning qizib ketishini oldini oladi va qatorlardan kelgan quvvatni jamlaydi.',
      },
      {
        titleUz: 'O‘zgarmas tok shinalari (DC)',
        focusPart: 'dc_bus',
        textUz:
          'Mis DC shinalar va sig‘imli kondensatorlar quyosh intensivligi o‘zgarganda ham kuchlanish tebranishlarini tekislab, invertorga barqaror manba uzatadi.',
      },
      {
        titleUz: 'IGBT invertor moduli',
        focusPart: 'igbt_inverter',
        textUz:
          'Yuqori tezlikli IGBT tranzistor kalitlari impuls kenglik modulyatsiyasi yordamida o‘zgarmas tokni sekundiga minglab marta uzib-ulab, o‘zgaruvchan kuchlanish shakllantiradi.',
      },
      {
        titleUz: 'AC sinusoida filtri',
        focusPart: 'ac_filter',
        textUz:
          'Chiqishdagi induktiv-sig‘imli AC filtr yuqori chastotali impulslarni silliqlab, elektr tarmog‘iga uzatish uchun toza 50 gersli sinusoida tok beradi.',
      },
    ],
  },
  {
    id: 'wind-shes',
    slug: 'wind-shes',
    kind: 'mirvo-scene',
    titleUz: 'Shamol elektr stansiyasi (SHES-5.0)',
    subtitleUz: 'Aerodinamik parraklar, asosiy val, planetar multiplikator, diskli tormoz, generator va Yaw mexanizmi',
    category: 'Energetika',
    publicPath: '/models/wind-shes.html',
    keywords: [
      'shamol elektr',
      'shamol turbinasi',
      'shamol stansiya',
      'shes',
      'shamol generatori',
      'wind turbine',
      'multiplikator',
    ],
    parts: [
      { id: 'rotor_blades', nameUz: 'Rotor parraklari va stupitsa' },
      { id: 'main_shaft', nameUz: 'Asosiy past tezlikli val' },
      { id: 'gearbox', nameUz: 'Planetar tishli multiplikator' },
      { id: 'disc_brake', nameUz: 'Diskli tormoz mexanizmi' },
      { id: 'generator', nameUz: 'Elektr generatori' },
      { id: 'yaw_drive', nameUz: 'Shamolga burish mexanizmi (Yaw drive)' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Rotor blades on left at (410, 492), nacelle shaft/gearbox/brake in middle (618..1004, 324..438), generator on right (1172, 274), yaw drive below nacelle (874, 540). Open margins: left x=20..220 (wind stream), right x=1290..1575 (substation/grid).',
    defaultSteps: [
      {
        titleUz: 'Shamol energetik qurilmasi',
        focusPart: 'full',
        textUz:
          'Zamonaviy shamol elektr qurilmasi havo oqimining kinetik energiyasini qanot ko‘tarish kuchi yordamida aylanma mexanik harakatga, so‘ng elektr tokiga aylantiradi.',
      },
      {
        titleUz: 'Aerodinamik parraklar',
        focusPart: 'rotor_blades',
        textUz:
          'Qanot profilidagi uchta uzun kompozit parrak shamol tezligiga qarab o‘z qadam burchagini o‘zgartiradi va maksimal aerodinamik ko‘tarish kuchini hosil qiladi.',
      },
      {
        titleUz: 'Asosiy past tezlikli val',
        focusPart: 'main_shaft',
        textUz:
          'Mustahkam tayanch podshipniklarga o‘rnatilgan yo‘g‘on po‘lat val parraklarning sekin, ammo ulkan burovchi momentli aylanishini gondolaga uzatadi.',
      },
      {
        titleUz: 'Planetar multiplikator',
        focusPart: 'gearbox',
        textUz:
          'Ko‘p bosqichli planetar tishli uzatma rotorning minutiga 12–18 aylanishini generator ishlashi uchun zarur bo‘lgan 1500 aylanishgacha tezlashtirib beradi.',
      },
      {
        titleUz: 'Diskli tormoz va Yaw burish',
        focusPart: 'disc_brake',
        textUz:
          'Gidravlik diskli tormoz bo‘ron yoki ta’mirlash vaqtida valni to‘xtatadi, pastdagi burish mexanizmi esa gondolani doimo shamol yo‘nalishiga tik qaratib turadi.',
      },
      {
        titleUz: 'Elektr generatori',
        focusPart: 'generator',
        textUz:
          'Yuqori tezlikli generator mexanik energiyani o‘zgaruvchan elektr tokiga aylantirib, minora ichidagi kabellar orqali transformator nimstansiyasiga uzatadi.',
      },
    ],
  },
  {
    id: 'ies-rankine',
    slug: 'ies-rankine',
    kind: 'mirvo-scene',
    titleUz: 'Issiqlik elektr stansiyasi (IES — Rankine sikli)',
    subtitleUz: 'Bug‘ qozoni, o‘ta qizdirgich, ko‘p bosqichli bug‘ turbinasi, kondensator va turbogenerator',
    category: 'Energetika',
    publicPath: '/models/ies-rankine.html',
    keywords: [
      'ies',
      'issiqlik elektr',
      'issiqlik stansiya',
      'rankine',
      'renkin',
      'bug turbinasi',
      'bug qozoni',
      'turbogenerator',
      'tes',
    ],
    parts: [
      { id: 'boiler', nameUz: 'Bug‘ qozoni (o‘txona va bug‘ barabani)' },
      { id: 'superheater', nameUz: 'Bug‘ o‘ta qizdirgichi' },
      { id: 'turbine', nameUz: 'Ko‘p bosqichli bug‘ turbinasi' },
      { id: 'condenser', nameUz: 'Sirtli bug‘ kondensatori' },
      { id: 'generator', nameUz: 'Sinxron turbogenerator' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Boiler on left (~x=440, y=420), superheater (~x=580, y=280), steam turbine center (~x=840, y=420), condenser below turbine (~x=820, y=620), generator on right (~x=1140, y=440). Open margins: left x=30..300 (fuel supply / chimney), right x=1280..1570 (cooling tower / gradirnya / grid).',
    defaultSteps: [
      {
        titleUz: 'IES va Renkin termodinamik sikli',
        focusPart: 'full',
        textUz:
          'Issiqlik elektr stansiyasi yoqilg‘i yonishidan ajralgan issiqlik hisobiga yuqori bosimli bug‘ hosil qilib, yopiq Renkin sikli bo‘yicha uzluksiz elektr energiyasi ishlab chiqaradi.',
      },
      {
        titleUz: 'Bug‘ qozoni va baraban',
        focusPart: 'boiler',
        textUz:
          'O‘txonada yoqilg‘i yonishidan ekran quvurlaridagi tozalangan suv qaynaydi va yuqori barabanda suv bilan to‘yingan bug‘ o‘zaro ajraladi.',
      },
      {
        titleUz: 'Bug‘ o‘ta qizdirgichi',
        focusPart: 'superheater',
        textUz:
          'Nam bug‘ tutun gazlari issiqligida 540 darajagacha o‘ta qizdiriladi; bu siklning foydali ish koeffitsientini oshiradi va turbina kuraklarini suv tomchilaridan asraydi.',
      },
      {
        titleUz: 'Ko‘p bosqichli bug‘ turbinasi',
        focusPart: 'turbine',
        textUz:
          'O‘ta qizigan bug‘ yuqori, o‘rta va past bosimli pog‘onalarda kengayib, o‘zining ichki issiqlik energiyasini rotor valining tez aylanma harakatiga aylantiradi.',
      },
      {
        titleUz: 'Sirtli bug‘ kondensatori',
        focusPart: 'condenser',
        textUz:
          'Turbinadan chiqqan ishlatilgan bug‘ sovuq suvli quvurlar sirtida kondensatsiyalanib chuqur vakuum hosil qiladi va toza kondensat sifatida yana qozonga qaytariladi.',
      },
      {
        titleUz: 'Sinxron turbogenerator',
        focusPart: 'generator',
        textUz:
          'Turbina bilan yagona valda minutiga 3000 marta aylanuvchi ikki qutbli rotor stator chulg‘amlarida uch fazali sanoat elektr tokini hosil qiladi.',
      },
    ],
  },
  {
    id: 'bgq-ccgt',
    slug: 'bgq-ccgt',
    kind: 'mirvo-scene',
    titleUz: 'Bug‘-gaz qurilmasi (BGQ / CCGT)',
    subtitleUz: 'O‘qli kompressor, yonish kamerasi, gaz turbinasi, utilizator-qozon (HRSG) va bug‘ turbinasi',
    category: 'Energetika',
    publicPath: '/models/bgq-ccgt.html',
    keywords: [
      'bgq',
      'ccgt',
      'bug gaz',
      'bug-gaz',
      'gaz turbinasi',
      'utilizator qozon',
      'hrsg',
      'kombinatsiyalangan sikl',
    ],
    parts: [
      { id: 'compressor', nameUz: 'O‘qli havo kompressori' },
      { id: 'combustor', nameUz: 'Yonish kamerasi' },
      { id: 'gas_turbine', nameUz: 'Gaz turbinasi' },
      { id: 'hrsg_boiler', nameUz: 'Utilizator-qozon (HRSG)' },
      { id: 'steam_turbine', nameUz: 'Bug‘ turbinasi' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Compressor left (~x=430, y=460), combustor (~x=640, y=450), gas turbine (~x=830, y=450), HRSG boiler right-back (~x=1100, y=380), steam turbine right-front (~x=1080, y=580). Open margins: left x=30..280, right x=1280..1570.',
    defaultSteps: [
      {
        titleUz: '60%+ samaradorlikdagi kombinatsiyalangan sikl',
        focusPart: 'full',
        textUz:
          'Bug‘-gaz qurilmasi yuqori haroratli Brayton gaz sikli bilan quyi haroratli Renkin bug‘ siklini birlashtirib, yoqilg‘i energiyasining 60 foizdan ortig‘ini elektrga aylantiradi.',
      },
      {
        titleUz: 'O‘qli havo kompressori',
        focusPart: 'compressor',
        textUz:
          'Ko‘p pog‘onali o‘qli kompressor atmosfera havosini so‘rib olib, yonish samaradorligini oshirish uchun uni 15–20 bar bosimgacha siqib beradi.',
      },
      {
        titleUz: 'Yonish kamerasi',
        focusPart: 'combustor',
        textUz:
          'Siqilgan havoga tabiiy gaz purkalib yoqiladi va harorati 1300–1400 darajaga yetadigan yuqori energiyali ishchi gaz oqimi hosil bo‘ladi.',
      },
      {
        titleUz: 'Gaz turbinasi',
        focusPart: 'gas_turbine',
        textUz:
          'Qaynoq gaz oqimi gaz turbinasi kuraklarini aylantirib, birinchi generatorni va kompressorni harakatga keltiradi, ammo chiqishda hali 550 daraja issiqlik saqlanib qoladi.',
      },
      {
        titleUz: 'Utilizator-qozon (HRSG)',
        focusPart: 'hrsg_boiler',
        textUz:
          'Gaz turbinasidan chiqqan qaynoq gazlar havoga behuda ketmasdan utilizator-qozonga kiradi va qo‘shimcha yoqilg‘isiz yuqori bosimli bug‘ qaynatib beradi.',
      },
      {
        titleUz: 'Bug‘ turbinasi',
        focusPart: 'steam_turbine',
        textUz:
          'Utilizator-qozonda olingan bug‘ ikkinchi — bug‘ turbinasini aylantirib, xuddi o‘sha gaz sarfidan yana 50 foizgacha qo‘shimcha elektr quvvati beradi.',
      },
    ],
  },
  {
    id: 'biogas-chp',
    slug: 'biogas-chp',
    kind: 'mirvo-scene',
    titleUz: 'Biogaz kogeneratsiya qurilmasi (CHP)',
    subtitleUz: 'Anaerob biogaz reaktori, skrubber filtr, porshenli gaz dvigateli, issiqlik utilizatori va alternator',
    category: 'Energetika',
    publicPath: '/models/biogas-chp.html',
    keywords: [
      'biogaz',
      'biogas',
      'kogeneratsiya',
      'chp',
      'fermentator',
      'biomassa',
    ],
    parts: [
      { id: 'digester_dome', nameUz: 'Anaerob biogaz fermentatori (reaktor)' },
      { id: 'gas_scrubber', nameUz: 'Gaz tozalash skrubberi va filtri' },
      { id: 'piston_engine', nameUz: 'Porshenli gaz-ichki yonuv dvigateli' },
      { id: 'heat_recovery', nameUz: 'Issiqlik utilizatsiya almashinuvchisi' },
      { id: 'alternator', nameUz: 'Sinxron elektr generatori (alternator)' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Digester dome on left, scrubber middle-left, piston engine + heat recovery center, alternator on right. Open margins: left x=30..320 (organic waste feed), right x=1240..1570 (district heating + electric grid).',
    defaultSteps: [
      {
        titleUz: 'Biogaz va kogeneratsiya (elektr + issiqlik)',
        focusPart: 'full',
        textUz:
          'Biogaz kogeneratsiya majmuasi organik chiqindilardan metan gazi olib, bir vaqtning o‘zida ham elektr energiyasi, ham isitish tizimi uchun issiq suv ishlab chiqaradi.',
      },
      {
        titleUz: 'Anaerob fermentator gumbazi',
        focusPart: 'digester_dome',
        textUz:
          'Kislorodsiz germetik reaktorda bakteriyalar biomassa qoldiqlarini parchalab, tarkibida 60–70 foiz metan bo‘lgan yonuvchan biogaz hosil qiladi.',
      },
      {
        titleUz: 'Skrubber tozalash filtri',
        focusPart: 'gas_scrubber',
        textUz:
          'Xom biogaz dvigatel qismlarini zanglatmasligi uchun skrubber kolonnasida namlik va oltingugurt vodorodidan tozalanadi.',
      },
      {
        titleUz: 'Porshenli gaz dvigateli',
        focusPart: 'piston_engine',
        textUz:
          'Tozalangan metan-havo aralashmasi silindrlarda yonib porshenlarni harakatlantiradi va tirsakli valda barqaror mexanik quvvat yaratadi.',
      },
      {
        titleUz: 'Issiqlik utilizatsiya bloki',
        focusPart: 'heat_recovery',
        textUz:
          'Dvigatel sovutish ko‘ylagi va chiqindi gazlarning issiqligi issiqlik almashinuvchida tutib qolinib, issiqxona yoki binolarni isitishga yo‘naltiriladi.',
      },
      {
        titleUz: 'Sinxron alternator',
        focusPart: 'alternator',
        textUz:
          'Dvigatel valiga ulangan sinxron generator mexanik aylanishni yuqori sifatli elektr tokiga aylantirib, umumiy foydali ish koeffitsientini 85 foizgacha yetkazadi.',
      },
    ],
  },
  {
    id: 'geothermal-es',
    slug: 'geothermal-es',
    kind: 'mirvo-scene',
    titleUz: 'Geotermal elektr stansiya (Binar sikl)',
    subtitleUz: 'Qazib olish qudug‘i, issiqlik almashinuvchi, organik turbina-generator, kondensator va injeksiya qudug‘i',
    category: 'Energetika',
    publicPath: '/models/geothermal-es.html',
    keywords: [
      'geotermal',
      'geothermal',
      'yer osti issiqligi',
      'binar sikl',
      'injeksiya qudugi',
    ],
    parts: [
      { id: 'production_well', nameUz: 'Issiq geotermal suv qazib olish qudug‘i' },
      { id: 'heat_exchanger', nameUz: 'Issiqlik almashinuvchisi (bug‘latkich)' },
      { id: 'organic_turbine', nameUz: 'Organik ishchi jism turbinasi va generatori' },
      { id: 'condenser', nameUz: 'Kondensator (sovutish bloki)' },
      { id: 'injection_well', nameUz: 'Sovigan suvni yerga qaytarish (injeksiya) qudug‘i' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Production & injection wells extend down into subterranean strata; heat exchanger, organic turbine & condenser sit on upper platform. Open margins: left x=30..340, right x=1240..1570.',
    defaultSteps: [
      {
        titleUz: 'Geotermal binar stansiya',
        focusPart: 'full',
        textUz:
          'Geotermal elektr stansiya ob-havoga bog‘liq bo‘lmagan holda sutkasiga 24 soat Yer qa’ridagi tabiiy issiqlikdan toza elektr energiyasi oladi.',
      },
      {
        titleUz: 'Qazib olish qudug‘i',
        focusPart: 'production_well',
        textUz:
          'Chuqur yer osti qatlamlaridan yuqori bosimli qaynoq geotermal suv maxsus quduq orqali yer yuzasidagi stansiyaga ko‘tariladi.',
      },
      {
        titleUz: 'Issiqlik almashinuvchisi',
        focusPart: 'heat_exchanger',
        textUz:
          'Geotermal suv ikkilamchi konturdagi past haroratda qaynaydigan organik suyuqlikni qizdirib, uni yuqori bosimli ishchi bug‘ga aylantiradi.',
      },
      {
        titleUz: 'Organik turbina va generator',
        focusPart: 'organic_turbine',
        textUz:
          'Hosil bo‘lgan yuqori bosimli bug‘ turbinani aylantiradi, unga biriktirilgan generator esa barqaror elektr tokini tarmoqqa uzatadi.',
      },
      {
        titleUz: 'Kondensator bloki',
        focusPart: 'condenser',
        textUz:
          'Turbinadan chiqqan ishchi bug‘ kondensatorda sovitilib yana suyuq holga qaytadi va yopiq kontur bo‘ylab bug‘latkichga uzatiladi.',
      },
      {
        titleUz: 'Injeksiya (qaytarish) qudug‘i',
        focusPart: 'injection_well',
        textUz:
          'O‘z issiqligini bergan geotermal suv havoga chiqarilmasdan injeksiya qudug‘i orqali qayta yer osti qatlamiga yuboriladi — bu yer osti bosimini va ekologiyani saqlaydi.',
      },
    ],
  },
  {
    id: 'bess-storage',
    slug: 'bess-storage',
    kind: 'mirvo-scene',
    titleUz: 'Sanoat energiya saqlash tizimi (BESS)',
    subtitleUz: 'LiFePO4 akkumulyator stellajlari, BMS kontroller, suyuq sovutish, PCS inverter va mis shinalar',
    category: 'Energetika',
    publicPath: '/models/bess-storage.html',
    keywords: [
      'bess',
      'energiya saqlash',
      'akkumulyator stansiya',
      'batareya stansiya',
      'lifepo4',
      'bms',
      'pcs inverter',
    ],
    parts: [
      { id: 'cell_racks', nameUz: 'LiFePO4 akkumulyator yacheyka stellajlari' },
      { id: 'bms_controller', nameUz: 'BMS boshqaruv va monitoring kontrolleri' },
      { id: 'liquid_cooling', nameUz: 'Suyuq sovutish konturi' },
      { id: 'pcs_inverter', nameUz: 'PCS ikki tomonlama quvvat inverteri' },
      { id: 'busbar', nameUz: 'Yuqori tokli mis shinalar tizimi' },
    ],
    connectionHints:
      'Canvas viewBox="0 0 1600 900". Containerized BESS centered around x=400..1200, y=180..760. Open margins: left x=30..360 (solar/wind farm input), right x=1230..1570 (grid frequency stabilization / transformer).',
    defaultSteps: [
      {
        titleUz: 'Sanoat BESS majmuasi',
        focusPart: 'full',
        textUz:
          'Konteyner tipidagi sanoat energiya saqlash tizimi quyosh va shamol stansiyalarining o‘zgaruvchan quvvatini tekislab, millisekundlar ichida tarmoq chastotasini barqarorlashtiradi.',
      },
      {
        titleUz: 'LiFePO4 yacheyka stellajlari',
        focusPart: 'cell_racks',
        textUz:
          'Yong‘inga chidamli litiy-temir-fosfat modullari ketma-ket ulangan holda yuqori kuchlanishli o‘zgarmas tok energiya zaxirasini hosil qiladi.',
      },
      {
        titleUz: 'BMS boshqaruv kontrolleri',
        focusPart: 'bms_controller',
        textUz:
          'Intellektual BMS tizimi har bir yacheykaning kuchlanishi, harorati va zaryad darajasini uzluksiz nazorat qilib, ularni muvozanatlashtiradi.',
      },
      {
        titleUz: 'Suyuq sovutish tizimi',
        focusPart: 'liquid_cooling',
        textUz:
          'Sovutuvchi suyuqlik kanallari katta quvvatda zaryadlash va razryadlash paytida yacheykalar haroratini ideal 25 daraja atrofida bir tekis saqlaydi.',
      },
      {
        titleUz: 'Ikki tomonlama PCS inverter',
        focusPart: 'pcs_inverter',
        textUz:
          'Ikki yo‘nalishli quvvat o‘zgartirgich zaryadlashda tarmoq o‘zgaruvchan tokini o‘zgarmas tokka, energiya berishda esa DC ni tarmoq AC tokiga aylantiradi.',
      },
      {
        titleUz: 'Mis shinalar (Busbar)',
        focusPart: 'busbar',
        textUz:
          'Katta ko‘ndalang kesimli mis shinalar minglab amper tokni minimal elektr isrof bilan stellajlar va PCS inverter o‘rtasida uzatadi.',
      },
    ],
  },
  {
    id: 'microwave-oven',
    slug: 'microwave',
    kind: 'self-contained',
    titleUz: 'Mikroto‘lqinli pech qanday ishlaydi?',
    subtitleUz: 'Magnetron, to‘lqin o‘tkazgich, 2.45 GGs to‘lqinlar va Faraday to‘ri',
    category: 'Texnika',
    publicPath: '/models/microwave.html',
    keywords: [
      'mikrotolqin',
      'microtolqin',
      'micro tolqin',
      'mikro tolqin',
      'mikrotolqinli pech',
      'micro tolqinli pech',
      'microwave',
      'mikrovolnovka',
      'magnetron',
      'svch',
    ],
  },
  {
    id: 'gaes-120',
    slug: 'gaes-120',
    kind: 'self-contained',
    titleUz: 'GAES-120 · Interaktiv laboratoriya stendi',
    subtitleUz: 'Generatsiya / Kutish / Nasos rejimlari va yuklama slayderi bilan jonli stend',
    category: 'Energetika',
    publicPath: '/models/gaes-120.html',
    keywords: ['gaes 120', 'gaes-120', 'gaes stend', 'gaes laboratoriya'],
  },
];

const GENERIC_OVERVIEW_WORDS = new Set([
  'nima',
  'qanday',
  'ishlaydi',
  'ishlashi',
  'haqida',
  'tuzilishi',
  'qismlari',
  'detallari',
  'bu',
  'degani',
  'tushuntir',
  'tushuntirib',
  'chizib',
  'korsat',
  'korsatib',
  'ber',
  'bering',
  'modeli',
  'sxemasi',
  'chizmasi',
  'dars',
  'stansiya',
  'stansiyasi',
  'elektr',
  'qurilmasi',
  'qurilma',
  'va',
  'uchun',
  'bilan',
]);

export function normalizeHtmlTopicQuery(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/o['’‘`ʻʼ]/g, 'o')
    .replace(/g['’‘`ʻʼ]/g, 'g')
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/[^a-z0-9а-яё\s-]/gi, ' ')
    .replace(/-/g, ' ')
    .replace(
      /\b(nima|qanday|ishlaydi|haqida|tuzilishi|qismlari|bu|degani|tushuntir|chizib|ber)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTopicTitleUz(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/\s+(nima|bu nima|degani nima)\??$/i, '')
    .replace(/\?+$/, '')
    .trim();
  if (!cleaned) return 'Interaktiv Izometrik Dars';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a curated HTML model using word-boundary + Uzbek suffix-aware scoring
 * so "gesga daryo nega kerak" matches "ges" cleanly, and "avtotransformator"
 * matches autotransformer rather than generic power-transformer.
 */
export function findCuratedHtmlModel(query: string): SavedHtmlModelEntry | null {
  const cleaned = (query || '')
    .toLowerCase()
    .replace(/o['’‘`ʻʼ]/g, 'o')
    .replace(/g['’‘`ʻʼ]/g, 'g')
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/[^a-z0-9а-яё\s-]/gi, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  let bestModel: SavedHtmlModelEntry | null = null;
  let bestScore = 0;

  for (const item of HTML_MODELS_LIBRARY) {
    for (const kw of item.keywords) {
      const kwNorm = kw.toLowerCase().replace(/-/g, ' ').trim();
      if (!kwNorm) continue;

      // Match whole word or Uzbek case suffixes (-ga, -da, -dan, -ni, -ning, -dagi, -lar, -si, -i)
      const pattern = new RegExp(
        `(?:^|\\s)${escapeRegExp(kwNorm)}(?:ga|qa|ka|da|dan|ni|ning|dagi|lar|lari|si|i|mi)?(?:\\s|$)`,
        'i'
      );
      if (pattern.test(cleaned)) {
        const score = kwNorm.length * 10 + (kwNorm.includes(' ') ? 15 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestModel = item;
        }
      } else if (kwNorm.length >= 6 && cleaned.includes(kwNorm)) {
        const score = kwNorm.length * 6;
        if (score > bestScore) {
          bestScore = score;
          bestModel = item;
        }
      }
    }
  }

  return bestModel;
}

/**
 * Determines whether a query that matched a curated MirvoScene template is:
 * - false: a standard overview lookup ("GES", "GES qanday ishlaydi?") -> open instant 0-token defaultSteps
 * - true: a custom/specific question ("GESga daryo nega kerak?", "Transformator moyi nega qiziydi?")
 *         -> run Qwen Scene Adapter (Tier 1 Focus-Only OR Tier 2 Non-Destructive SVG Addon!)
 */
export function isSpecificSceneQuestion(
  rawQuery: string,
  model: SavedHtmlModelEntry
): boolean {
  if (model.kind !== 'mirvo-scene') return false;

  const cleaned = (rawQuery || '')
    .toLowerCase()
    .replace(/o['’‘`ʻʼ]/g, 'o')
    .replace(/g['’‘`ʻʼ]/g, 'g')
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/[^a-z0-9а-яё\s-]/gi, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Explicit question / causal / relational triggers always activate Qwen Scene Adapter
  if (
    /\b(nega|nimaga|nima uchun|qachon|qayerda|farqi|ulansa|ochilsa|yopilsa|buzilsa|qizib|portla|kavitatsiya|daryo|togon|suv ombor|liniya|lep|gradirnya|sovutish minorasi|uy|shahar|tarmoq|avariya)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }

  // Strip matched model keywords + title words + generic overview words; see if meaningful extra words remain
  let remainder = ` ${cleaned} `;
  const modelWords = [
    ...model.keywords,
    model.titleUz
      .toLowerCase()
      .replace(/o['’‘`ʻʼ]/g, 'o')
      .replace(/g['’‘`ʻʼ]/g, 'g')
      .replace(/[^a-z0-9\s]/g, ' '),
  ];

  for (const phrase of modelWords) {
    for (const w of phrase.split(/\s+/)) {
      if (w.length >= 2) {
        const re = new RegExp(
          `\\b${escapeRegExp(w)}(?:ga|qa|ka|da|dan|ni|ning|dagi|lar|lari|si|i)?\\b`,
          'gi'
        );
        remainder = remainder.replace(re, ' ');
      }
    }
  }

  const leftoverTokens = remainder
    .trim()
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !GENERIC_OVERVIEW_WORDS.has(tok));

  return leftoverTokens.length >= 1;
}

const GENERATED_HTML_STORAGE_KEY = 'mirvo_generated_html_models_v1';

export function loadGeneratedHtmlCache(): GeneratedHtmlCacheItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GENERATED_HTML_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findGeneratedHtmlCache(query: string): GeneratedHtmlCacheItem | null {
  const key = normalizeHtmlTopicQuery(query);
  if (!key) return null;
  const list = loadGeneratedHtmlCache();
  return list.find((item) => item.key === key) || null;
}

export function saveGeneratedHtmlCache(entry: GeneratedHtmlCacheItem): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadGeneratedHtmlCache().filter((item) => item.key !== entry.key);
    const next = [entry, ...current].slice(0, 14);
    window.localStorage.setItem(GENERATED_HTML_STORAGE_KEY, JSON.stringify(next));
  } catch {
    try {
      const current = loadGeneratedHtmlCache().slice(0, 4);
      window.localStorage.setItem(
        GENERATED_HTML_STORAGE_KEY,
        JSON.stringify([entry, ...current])
      );
    } catch {
      // ignore
    }
  }
}
