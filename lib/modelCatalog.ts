import type { ModelCatalogEntry, Uz3DLessonResponse } from '../types/uz3d';

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'electric_motor',
    title_uz: 'Elektr dvigatel va magnit maydon',
    subject_uz: 'Fizika · Elektromagnetizm',
    keywords: [
      'motor',
      'dvigatel',
      'faraday',
      'faradey',
      'induksiya',
      'magnit',
      'transformator',
      'tok',
      'amperm',
      'elektromagnit',
      'rotor',
      'stator',
    ],
    model_glb_url: null,
    hotspots: [
      {
        id: 'overview',
        label_uz: 'Umumiy ko‘rinish',
        description_uz: 'Stator, rotor va cho‘tkali kollektorning umumiy joylashuvi',
        camera_orbit: '35deg 70deg 5.4m',
        camera_target: '0m 0.5m 0m',
        position_3d: [0, 0.8, 0],
      },
      {
        id: 'stator_coil',
        label_uz: 'Stator va magnit qutblari',
        description_uz: 'Shimoliy (N) va Janubiy (S) doimiy magnit maydoni',
        camera_orbit: '-42deg 64deg 4.2m',
        camera_target: '-0.8m 0.6m 0m',
        position_3d: [-1.2, 0.7, 0],
      },
      {
        id: 'rotor_armature',
        label_uz: 'Rotor chulg‘ami',
        description_uz: 'Tok o‘tuvchi sim ramka Amper kuchi ta’sirida aylanadi',
        camera_orbit: '14deg 52deg 3.8m',
        camera_target: '0m 0.7m 0m',
        position_3d: [0, 0.75, 0],
      },
      {
        id: 'commutator_brushes',
        label_uz: 'Kollektor va cho‘tkalar',
        description_uz: 'Har yarim aylanishda tok yo‘nalishini almashtiruvchi tugun',
        camera_orbit: '115deg 74deg 3.9m',
        camera_target: '1.1m 0.4m 0m',
        position_3d: [1.35, 0.45, 0],
      },
    ],
    primitives_3d: [
      {
        id: 'stator_north',
        type: 'box',
        position: [-1.45, 0.75, 0],
        args: [0.55, 1.35, 1.3],
        color: '#2563EB',
        label: 'Magnit N',
        partId: 'stator_coil',
      },
      {
        id: 'stator_south',
        type: 'box',
        position: [1.45, 0.75, 0],
        args: [0.55, 1.35, 1.3],
        color: '#EF4444',
        label: 'Magnit S',
        partId: 'stator_coil',
      },
      {
        id: 'rotor_core',
        type: 'cylinder',
        position: [0, 0.75, 0],
        rotation: [0, 0, Math.PI / 2],
        args: [0.55, 0.55, 1.5, 24],
        color: '#F59E0B',
        label: 'Rotor ramkasi',
        partId: 'rotor_armature',
      },
      {
        id: 'commutator_ring',
        type: 'torus',
        position: [1.0, 0.75, 0],
        rotation: [0, Math.PI / 2, 0],
        args: [0.34, 0.14, 16, 28],
        color: '#10B981',
        label: 'Kollektor',
        partId: 'commutator_brushes',
      },
      {
        id: 'axle_shaft',
        type: 'cylinder',
        position: [0.25, 0.75, 0],
        rotation: [0, 0, Math.PI / 2],
        args: [0.12, 0.12, 2.7, 18],
        color: '#475569',
        label: 'Val o‘qi',
        partId: 'overview',
      },
    ],
  },
  {
    id: 'human_heart',
    title_uz: 'Inson yuragi va qon aylanish tizimi',
    subject_uz: 'Biologiya · Anatomiya',
    keywords: [
      'heart',
      'yurak',
      'aorta',
      'qon',
      'bo‘lmacha',
      'qorincha',
      'klapan',
      'cardiac',
      'ventricle',
      'atrium',
    ],
    model_glb_url: null,
    hotspots: [
      {
        id: 'overview',
        label_uz: 'Yurakning 4 kamerasi',
        description_uz: 'O‘ng va chap bo‘lmachalar hamda qorinchalarning umumiy tuzilishi',
        camera_orbit: '24deg 72deg 5.2m',
        camera_target: '0m 0.6m 0m',
        position_3d: [0, 0.7, 0],
      },
      {
        id: 'right_atrium',
        label_uz: 'O‘ng bo‘lmacha va qorincha',
        description_uz: 'Venoz qonni qabul qilib o‘pkaga yo‘naltiruvchi qism',
        camera_orbit: '-48deg 68deg 4.1m',
        camera_target: '-0.7m 0.7m 0m',
        position_3d: [-0.85, 0.85, 0.1],
      },
      {
        id: 'left_ventricle',
        label_uz: 'Chap qorincha',
        description_uz: 'Kislorodga boy qonni katta qon aylanish doirasiga haydaydi',
        camera_orbit: '46deg 76deg 3.9m',
        camera_target: '0.65m 0.45m 0m',
        position_3d: [0.75, 0.45, 0.1],
      },
      {
        id: 'aorta_arch',
        label_uz: 'Aorta ravog‘i',
        description_uz: 'Organizmdagi eng yirik arterial qon tomiri',
        camera_orbit: '12deg 46deg 4.0m',
        camera_target: '0.1m 1.35m 0m',
        position_3d: [0.15, 1.5, 0],
      },
    ],
    primitives_3d: [
      {
        id: 'right_chamber',
        type: 'sphere',
        position: [-0.65, 0.75, 0],
        args: [0.75, 24, 24],
        color: '#2563EB',
        label: 'O‘ng kamera (venoz)',
        partId: 'right_atrium',
      },
      {
        id: 'left_chamber',
        type: 'sphere',
        position: [0.62, 0.65, 0],
        args: [0.92, 24, 24],
        color: '#DC2626',
        label: 'Chap qorincha (arterial)',
        partId: 'left_ventricle',
      },
      {
        id: 'aorta_tube',
        type: 'torus',
        position: [0.1, 1.55, 0],
        rotation: [0, 0, 0],
        args: [0.46, 0.16, 16, 28],
        color: '#EF4444',
        label: 'Aorta ravog‘i',
        partId: 'aorta_arch',
      },
      {
        id: 'pulmonary_trunk',
        type: 'cylinder',
        position: [-0.35, 1.48, 0.2],
        rotation: [0.25, 0, 0.3],
        args: [0.18, 0.18, 0.95, 20],
        color: '#3B82F6',
        label: 'O‘pka arteriyasi',
        partId: 'overview',
      },
    ],
  },
  {
    id: 'atom_bohr',
    title_uz: 'Bor atom modeli va elektron qobiqlar',
    subject_uz: 'Kimyo · Kvant fizikasi',
    keywords: [
      'atom',
      'bohr',
      'elektron',
      'proton',
      'neytron',
      'yadro',
      'orbita',
      'kvant',
      'foton',
      'spektr',
    ],
    model_glb_url: null,
    hotspots: [
      {
        id: 'overview',
        label_uz: 'Atomning umumiy tuzilishi',
        description_uz: 'Musbat yadro va konsentrik elektron qobiqlar',
        camera_orbit: '30deg 58deg 5.5m',
        camera_target: '0m 0.8m 0m',
        position_3d: [0, 0.8, 0],
      },
      {
        id: 'nucleus_protons',
        label_uz: 'Atom yadrosi (Z)',
        description_uz: 'Proton va neytronlardan tashkil topgan zich markaz',
        camera_orbit: '0deg 72deg 3.1m',
        camera_target: '0m 0.8m 0m',
        position_3d: [0, 0.8, 0],
      },
      {
        id: 'electron_orbit_1',
        label_uz: 'Ichki energetik sath (n=1)',
        description_uz: 'Eng past energiyali barqaror K-qobiq',
        camera_orbit: '52deg 45deg 4.2m',
        camera_target: '0.8m 0.8m 0m',
        position_3d: [0.95, 0.8, 0],
      },
      {
        id: 'valence_shell',
        label_uz: 'Valent elektron (n=2)',
        description_uz: 'Foton yutilganda yuqori sathga sakraydigan tashqi elektron',
        camera_orbit: '-56deg 54deg 4.8m',
        camera_target: '-1.3m 0.8m 0m',
        position_3d: [-1.55, 0.8, 0],
      },
    ],
    primitives_3d: [
      {
        id: 'nucleus_core',
        type: 'sphere',
        position: [0, 0.8, 0],
        args: [0.42, 24, 24],
        color: '#EF4444',
        label: 'Yadro (+)',
        partId: 'nucleus_protons',
      },
      {
        id: 'orbit_k',
        type: 'torus',
        position: [0, 0.8, 0],
        rotation: [Math.PI / 2, 0.15, 0],
        args: [1.05, 0.04, 14, 48],
        color: '#2563EB',
        label: 'n = 1 orbita',
        partId: 'electron_orbit_1',
      },
      {
        id: 'orbit_l',
        type: 'torus',
        position: [0, 0.8, 0],
        rotation: [Math.PI / 2.2, -0.35, 0.2],
        args: [1.72, 0.04, 14, 56],
        color: '#0EA5E9',
        label: 'n = 2 orbita',
        partId: 'valence_shell',
      },
      {
        id: 'electron_1',
        type: 'sphere',
        position: [1.05, 0.85, 0],
        args: [0.16, 18, 18],
        color: '#F59E0B',
        label: 'e⁻',
        partId: 'electron_orbit_1',
      },
      {
        id: 'electron_2',
        type: 'sphere',
        position: [-1.62, 1.05, 0.25],
        args: [0.18, 18, 18],
        color: '#10B981',
        label: 'Valent e⁻',
        partId: 'valence_shell',
      },
    ],
  },
  {
    id: 'plant_cell',
    title_uz: 'O‘simlik hujayrasi va xloroplast',
    subject_uz: 'Biologiya · Sitologiya',
    keywords: [
      'cell',
      'hujayra',
      'xloroplast',
      'chloroplast',
      'fotosintez',
      'photosynthesis',
      'mitoxondriya',
      'yadro',
      'vakuol',
    ],
    model_glb_url: null,
    hotspots: [
      {
        id: 'overview',
        label_uz: 'Hujayra tuzilishi',
        description_uz: 'Qattiq sellyuloza devori va organoidlar joylashuvi',
        camera_orbit: '32deg 58deg 5.5m',
        camera_target: '0m 0.6m 0m',
        position_3d: [0, 0.6, 0],
      },
      {
        id: 'nucleus',
        label_uz: 'Hujayra yadrosi',
        description_uz: 'Genetik axborot (DNK) saqlanadigan boshqaruv markazi',
        camera_orbit: '-25deg 60deg 3.8m',
        camera_target: '-0.5m 0.75m 0m',
        position_3d: [-0.5, 0.75, 0],
      },
      {
        id: 'chloroplast',
        label_uz: 'Xloroplastlar',
        description_uz: 'Quyosh nuri yordamida glyukoza sintez qiluvchi organoid',
        camera_orbit: '48deg 65deg 3.8m',
        camera_target: '0.95m 0.65m 0m',
        position_3d: [1.0, 0.65, 0.3],
      },
      {
        id: 'mitochondria',
        label_uz: 'Mitoxondriya',
        description_uz: 'Hujayrani ATF energiyasi bilan ta’minlovchi stansiya',
        camera_orbit: '115deg 62deg 3.9m',
        camera_target: '0.5m 0.6m -0.7m',
        position_3d: [0.55, 0.6, -0.75],
      },
    ],
    primitives_3d: [
      {
        id: 'cell_wall',
        type: 'box',
        position: [0, 0.55, 0],
        args: [2.8, 0.75, 2.0],
        color: '#16A34A',
        opacity: 0.38,
        label: 'Hujayra devori',
        partId: 'overview',
      },
      {
        id: 'cell_nucleus',
        type: 'sphere',
        position: [-0.55, 0.78, 0],
        args: [0.46, 24, 24],
        color: '#6366F1',
        label: 'Yadro',
        partId: 'nucleus',
      },
      {
        id: 'chloroplast_a',
        type: 'sphere',
        position: [0.95, 0.7, 0.38],
        args: [0.34, 20, 20],
        color: '#10B981',
        label: 'Xloroplast',
        partId: 'chloroplast',
      },
      {
        id: 'mitochondria_a',
        type: 'cylinder',
        position: [0.55, 0.65, -0.62],
        rotation: [0, 0.4, Math.PI / 2],
        args: [0.18, 0.18, 0.55, 20],
        color: '#F59E0B',
        label: 'Mitoxondriya',
        partId: 'mitochondria',
      },
    ],
  },
  {
    id: 'none_2d_board',
    title_uz: '2D Interaktiv Matematika va Formulalar Doskasi',
    subject_uz: 'Matematika · Umumiy fanlar',
    keywords: ['algebra', 'tenglama', 'integral', 'hosila', 'tarix', 'til', 'matematika', '2d'],
    model_glb_url: null,
    hotspots: [
      {
        id: 'overview',
        label_uz: 'Asosiy doska',
        description_uz: 'Formula va bosqichma-bosqich 2D tushuntirish',
        camera_orbit: '0deg 75deg 5m',
        camera_target: '0m 0m 0m',
        position_3d: [0, 0, 0],
      },
    ],
  },
];

export function findCatalogModel(modelId?: string | null): ModelCatalogEntry {
  if (modelId) {
    const exact = MODEL_CATALOG.find((m) => m.id === modelId);
    if (exact) return exact;
  }
  return MODEL_CATALOG[0];
}

export function matchCatalogModelByQuery(text: string): ModelCatalogEntry {
  const lower = text.toLowerCase();
  for (const entry of MODEL_CATALOG) {
    if (
      entry.keywords.some((kw) => {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?:^|[^a-z0-9\\u0400-\\u04ff])${esc}`, 'i');
        return re.test(lower);
      })
    ) {
      return entry;
    }
  }
  return MODEL_CATALOG[MODEL_CATALOG.length - 1];
}

export function buildCatalogPromptSummary(): string {
  return MODEL_CATALOG.map(
    (m) =>
      `- id: "${m.id}" (${m.title_uz}), hotspots: [${m.hotspots.map((h) => `"${h.id}"`).join(', ')}]`
  ).join('\n');
}

export const MOCK_UZ3D_LESSONS: Uz3DLessonResponse[] = [
  {
    lesson_id: 'uz3d-electric-motor',
    video_id: 'LAtMWODF0Tg',
    source_channel: 'mock_demo',
    selected_model_id: 'electric_motor',
    model_glb_url: null,
    lesson_title_uz: 'Elektromagnit induksiya va doimiy tok dvigateli',
    cached: true,
    provider: 'uz3d-catalog',
    segments: [
      {
        start_sec: 0,
        end_sec: 15,
        uzbek_title: 'Stator va doimiy magnit maydoni',
        uzbek_explanation:
          'Elektr dvigatelning qo‘zg‘almas qismi stator deb ataladi. Shimoliy (N) va Janubiy (S) qutblar orasida bir jinsli magnit maydoni hosil bo‘ladi.',
        camera_hotspot: 'stator_coil',
        emoji_mimic: 'explaining',
        key_formula_or_term: '\\vec{B} \\text{ — magnit induksiya vektori}',
      },
      {
        start_sec: 15,
        end_sec: 32,
        uzbek_title: 'Rotorga ta’sir etuvchi Amper kuchi',
        uzbek_explanation:
          'Magnit maydoniga joylashtirilgan rotor simidan elektr toki o‘tganda, ramkaning ikki tomoniga qarama-qarshi yo‘nalgan Amper kuchi ta’sir qiladi va aylanish momenti yuzaga keladi.',
        camera_hotspot: 'rotor_armature',
        emoji_mimic: 'amazed',
        key_formula_or_term: 'F = B \\cdot I \\cdot L \\cdot \\sin(\\alpha)',
      },
      {
        start_sec: 32,
        end_sec: 48,
        uzbek_title: 'Kollektor va cho‘tkalar vazifasi',
        uzbek_explanation:
          'Rotor har yarim burilishda to‘xtab qolmasligi uchun yarim halqali kollektor tok yo‘nalishini avtomatik ravishda teskari tomonga almashtirib turadi.',
        camera_hotspot: 'commutator_brushes',
        emoji_mimic: 'thinking',
        key_formula_or_term: 'M = B \\cdot I \\cdot S \\cdot \\cos(\\varphi)',
      },
      {
        start_sec: 48,
        end_sec: 65,
        uzbek_title: 'Amaliy xulosa va FIK',
        uzbek_explanation:
          'Natijada elektr energiyasi uzluksiz mexanik aylanish energiyasiga aylanadi. Zamonaviy elektrotransport va sanoat dastgohlari aynan shu tamoyil asosida ishlaydi.',
        camera_hotspot: 'overview',
        emoji_mimic: 'happy',
        key_formula_or_term: '\\eta = \\frac{P_{\\text{mex}}}{U \\cdot I} \\cdot 100\\%',
      },
    ],
  },
  {
    lesson_id: 'uz3d-human-heart',
    video_id: 'oHMMTqKgs50',
    source_channel: 'mock_demo',
    selected_model_id: 'human_heart',
    model_glb_url: null,
    lesson_title_uz: 'Inson yuragining 4 kamerali tuzilishi va qon aylanishi',
    cached: true,
    provider: 'uz3d-catalog',
    segments: [
      {
        start_sec: 0,
        end_sec: 18,
        uzbek_title: 'Yurakning umumiy anatomiyasi',
        uzbek_explanation:
          'Inson yuragi to‘rt kameradan iborat: ikkita yuqori bo‘lmacha va ikkita pastki qorincha. O‘ng va chap qismlar to‘siq bilan ajratilgan.',
        camera_hotspot: 'overview',
        emoji_mimic: 'explaining',
        key_formula_or_term: 'CO = HR \\times SV',
      },
      {
        start_sec: 18,
        end_sec: 36,
        uzbek_title: 'O‘ng bo‘lmacha va kichik doira',
        uzbek_explanation:
          'Tanadan qaytgan karbonat angidridga boy venoz qon o‘ng bo‘lmachaga tushadi va o‘ng qorincha orqali kislorod bilan boyish uchun o‘pkaga haydaladi.',
        camera_hotspot: 'right_atrium',
        emoji_mimic: 'thinking',
        key_formula_or_term: '\\text{O‘ng qorincha} \\rightarrow \\text{O‘pka arteriyasi}',
      },
      {
        start_sec: 36,
        end_sec: 54,
        uzbek_title: 'Chap qorincha — asosiy nasos',
        uzbek_explanation:
          'O‘pkadan kelgan kislorodli qon chap qorinchaga tushadi. Uning mushak devori eng qalin bo‘lib, qonni butun tana bo‘ylab haydash uchun yuqori bosim yaratadi.',
        camera_hotspot: 'left_ventricle',
        emoji_mimic: 'amazed',
        key_formula_or_term: 'P_{\\text{sistolik}} \\approx 120\\text{ mmHg}',
      },
      {
        start_sec: 54,
        end_sec: 72,
        uzbek_title: 'Aorta va katta qon aylanish doirasi',
        uzbek_explanation:
          'Chap qorinchadan chiqqan arterial qon aorta ravog‘i orqali miya, yurak mushagi va barcha ichki a’zolarga kislorod yetkazib beradi.',
        camera_hotspot: 'aorta_arch',
        emoji_mimic: 'happy',
        key_formula_or_term: 'P_{\\text{diastolik}} \\approx 80\\text{ mmHg}',
      },
    ],
  },
  {
    lesson_id: 'uz3d-bohr-atom',
    video_id: '1OSo694jL7w',
    source_channel: 'mock_demo',
    selected_model_id: 'atom_bohr',
    model_glb_url: null,
    lesson_title_uz: 'Bor atom modeli va kvant sakrashlari',
    cached: true,
    provider: 'uz3d-catalog',
    segments: [
      {
        start_sec: 0,
        end_sec: 16,
        uzbek_title: 'Musbat yadro va elektron qobiqlar',
        uzbek_explanation:
          'Niels Bor modeliga ko‘ra elektronlar musbat zaryadlangan yadro atrofida faqat ruxsat etilgan barqaror orbitalar bo‘ylab harakatlanadi.',
        camera_hotspot: 'nucleus_protons',
        emoji_mimic: 'explaining',
        key_formula_or_term: 'E_n = -\\frac{13.6}{n^2}\\text{ eV}',
      },
      {
        start_sec: 16,
        end_sec: 34,
        uzbek_title: 'Birinchi energetik sath (n = 1)',
        uzbek_explanation:
          'Yadroga eng yaqin orbita asosiy holat hisoblanadi. Bu orbitada elektron nurlanish chiqarmasdan barqaror aylanadi.',
        camera_hotspot: 'electron_orbit_1',
        emoji_mimic: 'thinking',
        key_formula_or_term: 'mvr = n \\cdot \\frac{h}{2\\pi}',
      },
      {
        start_sec: 34,
        end_sec: 55,
        uzbek_title: 'Foton yutilishi va chiqarilishi',
        uzbek_explanation:
          'Elektron tashqi energiya (foton) yutganda yuqori orbitaga sakraydi, pastki sathga qaytganda esa aniq chastotali yorug‘lik kvanti chiqaradi.',
        camera_hotspot: 'valence_shell',
        emoji_mimic: 'amazed',
        key_formula_or_term: '\\Delta E = h \\cdot \\nu = E_2 - E_1',
      },
    ],
  },
];
