import type { TutorLesson } from '../types/tutor';
import {
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
} from '../lib/objectCatalog';

const CELL_SVG = generateProceduralObjectSvg('biological cell', 'hujayra');
const CELL_PRIMS_3D = generateProceduralPrimitives3D('biological cell');
const TRANSFORMER_SVG = generateProceduralObjectSvg('transformer', 'transformator');
const TRANSFORMER_PRIMS_3D = generateProceduralPrimitives3D('transformer');

export const CACHED_LESSONS: TutorLesson[] = [
  {
    id: 'pythagoras-visual',
    topic_title: 'Pifagor teoremasi',
    subject: 'geometry',
    engine: 'svg2d',
    source: 'cache',
    keywords: ['pifagor', 'teorema', 'katet', 'gipotenuza', 'uchburchak'],
    sliders: [
      { id: 'a', label: 'Birinchi katet (a)', min: 2, max: 8, step: 0.5, default: 3, unit: 'sm' },
      { id: 'b', label: 'Ikkinchi katet (b)', min: 2, max: 8, step: 0.5, default: 4, unit: 'sm' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: "1. To'g'ri burchakli uchburchak",
        speech_text:
          "To'g'ri burchakli uchburchakning to'g'ri burchak hosil qiluvchi tomonlari katetlar a va b, qarshisidagi eng uzun tomoni esa gipotenuza s deyiladi.",
        katex_formulas: ['a^2 + b^2 = c^2'],
        live_formula_expressions: [
          { label: 'Gipotenuza', latex_lhs: 'c', expr: 'sqrt(a^2 + b^2)', unit: 'sm' },
        ],
        explanation_uz:
          "Katak daftarda tomonlari 3, 4 va 5 bo'lgan to'g'ri burchakli uchburchakni ko'ryapsiz.",
        emoji_emotion: 'explaining',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "To'g'ri burchakli uchburchakning to'g'ri burchak hosil qiluvchi tomonlari katetlar a va b deyiladi.",
            focus_target: 'triangle_center',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Katetlar a va b',
          },
          {
            sentence: "To'g'ri burchak qarshisidagi eng uzun tomoni esa gipotenuza s deyiladi.",
            focus_target: 'hypotenuse_c',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Gipotenuza c',
          },
          {
            sentence: "Keling, uchburchak atrofidagi umumiy ko'rinishga nazar solamiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy ko‘rinish',
          },
        ],
        render_params: {
          kind: 'pythagoras',
          a: 3,
          b: 4,
          highlight: ['triangle'],
        },
      },
      {
        step_number: 2,
        step_title: '2. Katetlar ustiga qurilgan kvadratlar',
        speech_text:
          "Har bir katetga tashqi tomondan kvadratlar quramiz. Ularning yuzalari mos ravishda a kvadrat va b kvadratga teng.",
        katex_formulas: ['S_a = a^2, \\quad S_b = b^2'],
        live_formula_expressions: [
          { label: 'Ko‘k kvadrat', latex_lhs: 'S_a', expr: 'a^2', unit: 'sm²' },
          { label: 'Pushti kvadrat', latex_lhs: 'S_b', expr: 'b^2', unit: 'sm²' },
        ],
        explanation_uz:
          "Ko'k kvadrat yuzasi a² = 9 sm², pushti kvadrat yuzasi b² = 16 sm² ga teng.",
        emoji_emotion: 'pointing',
        focusPart: 'square_a',
        cameraZoom: 1.68,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Har bir katetga tashqi tomondan kvadratlar quramiz.",
            focus_target: 'square_a',
            focusPart: 'square_a',
            tutor_pose: 'approach',
            camera_zoom: 1.68,
            dimInactiveParts: true,
            note: 'Ko‘k kvadrat a²',
          },
          {
            sentence: "Ularning yuzalari mos ravishda a kvadrat va b kvadratga teng.",
            focus_target: 'square_b',
            focusPart: 'square_b',
            tutor_pose: 'approach',
            camera_zoom: 1.68,
            dimInactiveParts: true,
            note: 'Pushti kvadrat b²',
          },
          {
            sentence: "Formulalar bo'limida a va b kvadratlar qiymati darhol hisoblanadi.",
            focus_target: 'overview',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Formula tekshiruvi',
          },
        ],
        render_params: {
          kind: 'pythagoras',
          a: 3,
          b: 4,
          highlight: ['squares_ab'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Gipotenuza kvadrati bilan tenglik',
        speech_text:
          "Ko'k va pushti kvadratlar yuzalarining yig'indisi har doim gipotenuza ustidagi oltin kvadrat yuzasiga teng bo'ladi.",
        katex_formulas: ['a^2 + b^2 = c^2 \\implies c = \\sqrt{a^2 + b^2}'],
        live_formula_expressions: [
          { label: 'Yuzalar yig‘indisi', latex_lhs: 'a^2 + b^2', expr: 'a^2 + b^2', unit: 'sm²' },
          { label: 'Gipotenuza', latex_lhs: 'c', expr: 'sqrt(a^2 + b^2)', unit: 'sm' },
        ],
        explanation_uz:
          "3² + 4² = 9 + 16 = 25 = 5². Bu geometriya va fizikaning asosiy qonunidir.",
        emoji_emotion: 'happy',
        focusPart: 'square_c',
        cameraZoom: 1.72,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Ko'k va pushti kvadratlar yuzalarining yig'indisi har doim gipotenuza ustidagi oltin kvadrat yuzasiga teng bo'ladi.",
            focus_target: 'square_c',
            focusPart: 'square_c',
            tutor_pose: 'approach',
            camera_zoom: 1.72,
            dimInactiveParts: true,
            note: 'Oltin kvadrat c²',
          },
          {
            sentence: "Mana bu asosiy Pifagor formulasi: a kvadrat qo'shuv b kvadrat teng s kvadrat!",
            focus_target: 'overview',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'a² + b² = c²',
          },
        ],
        render_params: {
          kind: 'pythagoras',
          a: 3,
          b: 4,
          highlight: ['square_c'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Amaliy misol va sinov',
        speech_text:
          "Endi bilimingizni tekshirib ko'ramiz. Katetlari 6 va 8 santimetr bo'lsa, gipotenuzani toping.",
        katex_formulas: ['c = \\sqrt{6^2 + 8^2}'],
        explanation_uz:
          "Pifagor formulasini qo'llab quyidagi kichik sinov savoliga javob bering.",
        emoji_emotion: 'encouraging',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Endi bilimingizni tekshirib ko'ramiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy takrorlash',
          },
          {
            sentence: "Katetlari 6 va 8 santimetr bo'lsa, gipotenuzani toping.",
            focus_target: 'hypotenuse_c',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Sinov savoli',
          },
        ],
        render_params: {
          kind: 'pythagoras',
          a: 3,
          b: 4,
          highlight: ['squares_ab', 'square_c'],
        },
        quiz: {
          question: "Katetlari a = 6 sm va b = 8 sm bo'lgan to'g'ri burchakli uchburchakning gipotenuzasi nechaga teng?",
          options: ['10 sm', '12 sm', '14 sm'],
          correct_index: 0,
          explanation_uz: "6² + 8² = 36 + 64 = 100, demak c = √100 = 10 sm.",
        },
      },
    ],
  },
  {
    id: 'pyramid-section',
    topic_title: 'Muntazam Piramida Kesimi',
    subject: 'geometry',
    engine: 'threejs',
    source: 'cache',
    keywords: [
      'piramida',
      'kesim',
      'stereometriya',
      'muntazam piramida',
      'hajm',
      'apofema',
    ],
    sliders: [
      { id: 'base', label: 'Asos tomoni (a)', min: 3, max: 10, step: 0.5, default: 6, unit: 'sm' },
      { id: 'height', label: 'Balandlik (h)', min: 3, max: 12, step: 0.5, default: 8, unit: 'sm' },
      { id: 'cut_ratio', label: 'Kesim nisbati (k)', min: 0.2, max: 0.85, step: 0.05, default: 0.5, unit: '' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Piramida asosini aniqlash',
        speech_text:
          "Keling, asos tomoni a va balandligi h bo'lgan muntazam to'rtburchakli piramidani ko'rib chiqamiz. Uning asosi kvadratdan iborat.",
        katex_formulas: ['S_{\\text{asos}} = a^2, \\quad d = a\\sqrt{2}'],
        live_formula_expressions: [
          { label: 'Asos yuzi', latex_lhs: 'S_{\\text{asos}}', expr: 'base^2', unit: 'sm²' },
          { label: 'Asos diagonali', latex_lhs: 'd', expr: 'base * sqrt(2)', unit: 'sm' },
        ],
        explanation_uz:
          "Piramidani barmoq yoki sichqoncha bilan 360 daraja aylantirib ko'ring.",
        emoji_emotion: 'explaining',
        camera: [9.5, 7.2, 10.5],
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Keling, asos tomoni a va balandligi h bo'lgan muntazam to'rtburchakli piramidani ko'rib chiqamiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy ko‘rinish',
          },
          {
            sentence: "Uning asosi kvadratdan iborat bo'lib, yuzi a kvadratga teng.",
            focus_target: 'base_plane',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Kvadrat asos',
          },
          {
            sentence: "Diagonal formulasi esa a ildiz ostida ikkiga teng.",
            focus_target: 'overview',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Asos formulasi',
          },
        ],
        render_params: {
          shape: 'pyramid',
          base: 6,
          height: 8,
          cut_ratio: 0.5,
          show_cross_section: false,
          show_height: false,
          highlight: ['base'],
        },
      },
      {
        step_number: 2,
        step_title: '2. Piramida balandligi (SO)',
        speech_text:
          "Piramida uchidan asos markaziga tushirilgan perpendikulyar uning balandligi h deyiladi. U asos diagonallari kesishgan O nuqtaga tushadi.",
        katex_formulas: ['SO = h \\perp (ABCD), \\quad OM = \\frac{a}{2}'],
        live_formula_expressions: [
          { label: 'Balandlik', latex_lhs: 'h', expr: 'height', unit: 'sm' },
          { label: 'Yarim asos', latex_lhs: 'OM', expr: 'base / 2', unit: 'sm' },
        ],
        explanation_uz:
          "S uchidan O markazga tushirilgan sariq o'q piramidaning balandligidir.",
        emoji_emotion: 'pointing',
        camera: [7.8, 5.5, 9.2],
        focusPart: 'height_axis',
        cameraZoom: 1.7,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Piramida uchidan asos markaziga tushirilgan perpendikulyar uning balandligi h deyiladi.",
            focus_target: 'vertex_S',
            focusPart: 'vertex_S',
            tutor_pose: 'approach',
            camera_zoom: 1.72,
            dimInactiveParts: true,
            note: 'Uchi S',
          },
          {
            sentence: "Bu sariq o'q asos diagonallari kesishgan O nuqtaga tik tushadi.",
            focus_target: 'height_axis',
            focusPart: 'height_axis',
            tutor_pose: 'approach',
            camera_zoom: 1.7,
            dimInactiveParts: true,
            note: 'Balandlik h',
          },
          {
            sentence: "Mana bu yerda SO perpendikulyarligi formulada ko'rsatilgan.",
            focus_target: 'overview',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'SO ⊥ (ABCD)',
          },
        ],
        render_params: {
          shape: 'pyramid',
          base: 6,
          height: 8,
          cut_ratio: 0.5,
          show_cross_section: false,
          show_height: true,
          highlight: ['height', 'base'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Yon yoq apofemasi',
        speech_text:
          "Yon yoq balandligi, ya'ni apofema l ni topish uchun SOM to'g'ri burchakli uchburchakda Pifagor teoremasini qo'llaymiz.",
        katex_formulas: ['l = \\sqrt{h^2 + \\left(\\frac{a}{2}\\right)^2}, \\quad S_{\\text{yon}} = 2al'],
        live_formula_expressions: [
          { label: 'Apofema', latex_lhs: 'l', expr: 'sqrt(height^2 + (base/2)^2)', unit: 'sm' },
          { label: 'Yon sirt', latex_lhs: 'S_{\\text{yon}}', expr: '2 * base * sqrt(height^2 + (base/2)^2)', unit: 'sm²' },
        ],
        explanation_uz:
          "Yashil chiziq SM — yon uchburchak balandligi (apofema).",
        emoji_emotion: 'thinking',
        camera: [6.2, 6.0, 9.8],
        focusPart: 'apothem',
        cameraZoom: 1.78,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Yon yoq balandligi, ya'ni yashil chiziq apofema l deyiladi.",
            focus_target: 'apothem',
            focusPart: 'apothem',
            tutor_pose: 'approach',
            camera_zoom: 1.78,
            dimInactiveParts: true,
            note: 'Apofema l',
          },
          {
            sentence: "Uni topish uchun SOM to'g'ri burchakli uchburchakda Pifagor teoremasini qo'llaymiz.",
            focus_target: 'height_axis',
            focusPart: 'height_axis',
            tutor_pose: 'formula_check',
            camera_zoom: 1.65,
            dimInactiveParts: true,
            note: 'l = √(h² + (a/2)²)',
          },
        ],
        render_params: {
          shape: 'pyramid',
          base: 6,
          height: 8,
          cut_ratio: 0.5,
          show_cross_section: false,
          show_height: true,
          show_apothem: true,
          highlight: ['height', 'apothem'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Asosga parallel tekislik kesimi',
        speech_text:
          "Endi piramidani asosga parallel tekislik bilan kesamiz. Kesim ham kvadrat bo'lib, uning yuzi k kvadrat marta kichrayadi.",
        katex_formulas: ['a_{\\text{kesim}} = k \\cdot a, \\quad \\frac{S_{\\text{kesim}}}{S_{\\text{asos}}} = k^2'],
        live_formula_expressions: [
          { label: 'Kesim tomoni', latex_lhs: 'a_{\\text{kesim}}', expr: 'cut_ratio * base', unit: 'sm' },
          { label: 'Kesim yuzi', latex_lhs: 'S_{\\text{kesim}}', expr: '(cut_ratio * base)^2', unit: 'sm²' },
        ],
        explanation_uz:
          "Qizil kesim tekisligi asosga parallel bo'lib, o'xshash kvadrat hosil qiladi.",
        emoji_emotion: 'surprised',
        camera: [9.0, 8.2, 8.8],
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Endi piramidani asosga parallel tekislik bilan kesamiz.",
            focus_target: 'cut_section',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: "Kesim tekisligi a'",
          },
          {
            sentence: "Kesim ham kvadrat bo'lib, uning yuzi k kvadrat marta kichrayadi.",
            focus_target: 'overview',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Kesim nisbati k²',
          },
          {
            sentence: "Keling, kesimning butun piramidaga nisbatini uzoqroqdan ko'ramiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'To‘liq kesim',
          },
        ],
        render_params: {
          shape: 'pyramid',
          base: 6,
          height: 8,
          cut_ratio: 0.5,
          show_cross_section: true,
          show_height: true,
          highlight: ['cut', 'height'],
        },
      },
      {
        step_number: 5,
        step_title: "5. Piramida hajmi",
        speech_text:
          "Piramidaning to'liq hajmi asos yuzi bilan balandlik ko'paytmasining uchdan bir qismiga teng.",
        katex_formulas: ['V = \\frac{1}{3} S_{\\text{asos}} \\cdot h = \\frac{1}{3} a^2 h'],
        live_formula_expressions: [
          { label: 'Umumiy hajm', latex_lhs: 'V', expr: '(1/3) * base^2 * height', unit: 'sm³' },
          { label: 'Yuqori qism hajmi', latex_lhs: 'V_{\\text{yuqori}}', expr: '(cut_ratio^3) * (1/3) * base^2 * height', unit: 'sm³' },
        ],
        explanation_uz:
          "O'xshash fazoviy jismlar hajmi nisbatning kubiga proporsional bo'ladi.",
        emoji_emotion: 'happy',
        camera: [10.2, 6.8, 9.6],
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Piramidaning to'liq hajmi asos yuzi bilan balandlik ko'paytmasining uchdan bir qismiga teng.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy hajm',
          },
          {
            sentence: "Mana bu asosiy formula orqali istalgan kesilgan yoki to'liq piramida hajmini topasiz.",
            focus_target: 'vertex_S',
            tutor_pose: 'formula_check',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'V = 1/3 · a² · h',
          },
        ],
        render_params: {
          shape: 'pyramid',
          base: 6,
          height: 8,
          cut_ratio: 0.5,
          show_cross_section: true,
          show_height: true,
          show_apothem: true,
          highlight: ['base', 'cut', 'height'],
        },
        quiz: {
          question: "Piramida balandligining yarmidan (k = 0.5) asosga parallel kesim o'tkazilsa, kesim yuzi asos yuzidan necha marta kichik bo'ladi?",
          options: ['2 marta', '4 marta', '8 marta'],
          correct_index: 1,
          explanation_uz: "Yuzalar nisbati o'xshashlik koeffitsiyentining kvadratiga teng: 1 / (0.5)² = 4 marta kichik.",
        },
      },
    ],
  },
  {
    id: 'saddle-surface-3d',
    topic_title: 'Giperbolik paraboloid (Egar sirt)',
    subject: 'math',
    engine: 'threejs',
    source: 'cache',
    keywords: [
      'oliy matematika',
      'paraboloid',
      'egar',
      '3d grafik',
      'sirt',
      'x^2 - y^2',
      'giperbolik paraboloid',
    ],
    sliders: [
      { id: 'a', label: 'X qanoti (a)', min: 0.8, max: 2.4, step: 0.1, default: 1.4, unit: '' },
      { id: 'b', label: 'Y qanoti (b)', min: 0.8, max: 2.4, step: 0.1, default: 1.4, unit: '' },
      { id: 'c', label: 'Egrilik (c)', min: 0.5, max: 2.2, step: 0.1, default: 1.2, unit: '' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Koordinata o‘qlari va parametrik to‘r',
        speech_text:
          "z taqsim c teng iks kvadrat taqsim a kvadrat ayiruv igrek kvadrat taqsim b kvadrat tenglamasi ot egari ko'rinishidagi sirt hosil qiladi. Avval o'qlar va to'rni ko'ramiz.",
        katex_formulas: ['\\frac{z}{c} = \\frac{x^2}{a^2} - \\frac{y^2}{b^2}'],
        explanation_uz:
          "Avval x, y, z koordinata o'qlari va sirtning parametrik panjarasi chiziladi.",
        emoji_emotion: 'explaining',
        camera: [5.8, 3.6, 5.2],
        render_params: {
          shape: 'quadric',
          template: 'hyperbolic_paraboloid',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.2,
          draw: ['axes', 'wireframe', 'labels'],
        },
      },
      {
        step_number: 2,
        step_title: '2. Shaffof egar sirti va to‘g‘ri chiziqlar',
        speech_text:
          "Endi shaffof sirtni qo'shamiz. z teng nol tekisligi bilan kesilganda o'zaro kesishuvchi ikkita to'g'ri chiziq hosil bo'ladi.",
        katex_formulas: ['z = 0 \\implies \\frac{x}{a} = \\pm \\frac{y}{b}'],
        explanation_uz:
          "Shaffof sirt orqasida qolgan chiziqlar avtomatik punktir ko'rinishida chiziladi.",
        emoji_emotion: 'pointing',
        camera: [5.4, 3.9, 4.9],
        render_params: {
          shape: 'quadric',
          template: 'hyperbolic_paraboloid',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.2,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'labels'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Qarshilik parabolalari (meridianlar)',
        speech_text:
          "Yashil parabola x o'qi bo'ylab yuqoriga, ko'k parabola esa y o'qi bo'ylab pastga qarab egiladi.",
        katex_formulas: [
          '\\frac{\\partial z}{\\partial x} = \\frac{2cx}{a^2} = 0, \\quad \\frac{\\partial z}{\\partial y} = -\\frac{2cy}{b^2} = 0',
        ],
        explanation_uz:
          "Slayderlar orqali a, b va c koeffitsiyentlarini o'zgartirib, sirtni 360° aylantiring.",
        emoji_emotion: 'thinking',
        camera: [5.8, 3.4, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'hyperbolic_paraboloid',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.2,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Egar nuqta sinovi',
        speech_text:
          "Koordinata boshida bir o'q bo'ylab minimum, ikkinchi o'q bo'ylab maksimum bo'lgan nuqta qanday ataladi?",
        katex_formulas: ['(0, 0, 0) \\rightarrow \\text{Egar nuqta}'],
        explanation_uz:
          "Sirt markaziga qarab to'g'ri javobni tanlang.",
        emoji_emotion: 'happy',
        camera: [6.0, 3.7, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'hyperbolic_paraboloid',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.2,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
        quiz: {
          question: "z = x² - y² sirti koordinata boshida (0, 0, 0) qanday nuqtani hosil qiladi?",
          options: ['Absolyut maksimum', 'Absolyut minimum', 'Egar (saddle) nuqta'],
          correct_index: 2,
          explanation_uz: "X o'qi bo'ylab sirt yuqoriga, Y o'qi bo'ylab esa pastga egilgani uchun bu egar nuqta deyiladi.",
        },
      },
    ],
  },
  {
    id: 'two-sheet-hyperboloid-3d',
    topic_title: 'Ikki pallali giperboloid (3D)',
    subject: 'math',
    engine: 'threejs',
    source: 'cache',
    keywords: [
      'ikki pallali giperboloid',
      'giperboloid',
      'kvadrik sirt',
      'z^2/c^2 - x^2/a^2 - y^2/b^2 = 1',
    ],
    sliders: [
      { id: 'a', label: 'Parametr (a)', min: 0.7, max: 2.4, step: 0.1, default: 1.4, unit: '' },
      { id: 'b', label: 'Parametr (b)', min: 0.7, max: 2.4, step: 0.1, default: 1.4, unit: '' },
      { id: 'c', label: 'Masofa (c)', min: 0.6, max: 2.2, step: 0.1, default: 1.3, unit: '' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Koordinata o‘qlari va kosacha to‘ri',
        speech_text:
          "Ikki pallali giperboloid z o'qi bo'ylab bir-biridan ajralgan ikkita alohida kosachadan iborat. Avval koordinata o'qlari va to'rni ko'ramiz.",
        katex_formulas: ['\\frac{z^2}{c^2} - \\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1'],
        explanation_uz:
          "|z| < c oraliqda haqiqiy nuqtalar mavjud emas, shuning uchun markazda bo'shliq qoladi.",
        emoji_emotion: 'explaining',
        camera: [5.8, 3.6, 5.2],
        render_params: {
          shape: 'quadric',
          template: 'hyperboloid_two_sheets',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.3,
          draw: ['axes', 'wireframe', 'labels'],
        },
      },
      {
        step_number: 2,
        step_title: '2. Ko‘ndalang ellips halqalari',
        speech_text:
          "z tekisligi bilan kesilganda aylana yoki ellips hosil bo'ladi. Shaffof sirt ichidagi yashirin o'q chiziqlari punktirda ko'rinadi.",
        katex_formulas: ['z = z_0 \\; (|z_0| > c) \\implies \\text{Ellips}'],
        explanation_uz:
          "Qizil-sariq halqalar gorizontal tekislik bilan kesimlarni ko'rsatadi.",
        emoji_emotion: 'pointing',
        camera: [5.2, 4.1, 4.8],
        render_params: {
          shape: 'quadric',
          template: 'hyperboloid_two_sheets',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'labels'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Meridian giperbolalari va c masofasi',
        speech_text:
          "Vertikal tekisliklar bilan kesilganda esa yashil va ko'k rangdagi giperbola shoxlari hosil bo'ladi. c slayderini surib ko'ring.",
        katex_formulas: ['z = \\pm c \\text{ nuqtalar — kosacha uchlari}'],
        explanation_uz:
          "Kosacha uchlari koordinata boshidan c masofada joylashgan.",
        emoji_emotion: 'thinking',
        camera: [5.8, 3.4, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'hyperboloid_two_sheets',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Qisqa tekshiruv savoli',
        speech_text:
          "z kvadrat taqsim c kvadrat minus iks kvadrat taqsim a kvadrat minus igrek kvadrat taqsim b kvadrat teng bir sirti qaysi o'q bo'ylab ochiladi?",
        katex_formulas: ['\\frac{z^2}{c^2} - \\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1'],
        explanation_uz:
          "3D chizmaga qarab to'g'ri javobni belgilang.",
        emoji_emotion: 'encouraging',
        camera: [6.0, 3.7, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'hyperboloid_two_sheets',
          axis: 'z',
          a: 1.4,
          b: 1.4,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
        quiz: {
          question: "z²/c² - x²/a² - y²/b² = 1 giperboloidining ikki pallasi qaysi o'q bo'ylab joylashadi?",
          options: ["z o'qi bo'ylab", "x o'qi bo'ylab", "y o'qi bo'ylab"],
          correct_index: 0,
          explanation_uz: "Tenglamada faqat z² hadining ishorasi musbat bo'lgani uchun pallalar z o'qi bo'ylab joylashadi.",
        },
      },
    ],
  },
  {
    id: 'ellipsoid-3d',
    topic_title: 'Ellipsoid (3D Sirt)',
    subject: 'math',
    engine: 'threejs',
    source: 'cache',
    keywords: ['ellipsoid', 'kvadrik', '3d sirt', 'x^2/a^2 + y^2/b^2 + z^2/c^2 = 1'],
    sliders: [
      { id: 'a', label: "Yarim o'q (a)", min: 0.8, max: 3.0, step: 0.1, default: 2.1, unit: '' },
      { id: 'b', label: "Yarim o'q (b)", min: 0.8, max: 3.0, step: 0.1, default: 1.6, unit: '' },
      { id: 'c', label: "Yarim o'q (c)", min: 0.8, max: 3.0, step: 0.1, default: 1.3, unit: '' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Uch o‘lchamli koordinata karkasi',
        speech_text:
          "Ellipsoid uchala koordinata o'qi bo'ylab har xil cho'zilgan yopiq sirtdir. Avval o'qlar va fazoviy to'rni ko'ramiz.",
        katex_formulas: ['\\frac{x^2}{a^2} + \\frac{y^2}{b^2} + \\frac{z^2}{c^2} = 1'],
        explanation_uz:
          "a, b va c qiymatlari ellipsoidning uch o'q bo'ylab yarim o'lchamlarini bildiradi.",
        emoji_emotion: 'explaining',
        camera: [5.8, 3.6, 5.2],
        render_params: {
          shape: 'quadric',
          template: 'ellipsoid',
          axis: 'z',
          a: 2.1,
          b: 1.6,
          c: 1.3,
          draw: ['axes', 'wireframe', 'labels'],
        },
      },
      {
        step_number: 2,
        step_title: '2. Ekvator ellipsi va shaffof qobiq',
        speech_text:
          "z teng nol tekisligi bilan kesilganda hosil bo'ladigan markaziy ellips to'q sariq chiziqda ko'rsatilgan.",
        katex_formulas: ['\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1'],
        explanation_uz:
          "Shaffof qobiq ortidagi chiziqlar avtomatik punktir bilan ajratiladi.",
        emoji_emotion: 'pointing',
        camera: [5.4, 3.8, 5.0],
        render_params: {
          shape: 'quadric',
          template: 'ellipsoid',
          axis: 'z',
          a: 2.1,
          b: 1.6,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'labels'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Uchala bosh meridian kesimlar',
        speech_text:
          "Yashil va ko'k chiziqlar boshqa ikki koordinata tekisligi bilan kesimlarni beradi. Slayderlar bilan yarim o'qlarni o'zgartiring.",
        katex_formulas: ['V = \\frac{4}{3} \\pi a b c'],
        explanation_uz:
          "Ellipsoid hajmi 4/3 πabc formula bilan topiladi.",
        emoji_emotion: 'happy',
        camera: [5.8, 3.4, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'ellipsoid',
          axis: 'z',
          a: 2.1,
          b: 1.6,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Qisqa tekshiruv savoli',
        speech_text:
          "Ellipsoidning barcha yarim o'qlari tenglashsa, ya'ni a teng b teng c teng r bo'lsa, qanday jism hosil bo'ladi?",
        katex_formulas: ['a = b = c = r'],
        explanation_uz:
          "To'g'ri variantni tanlang.",
        emoji_emotion: 'encouraging',
        camera: [6.0, 3.7, 5.4],
        render_params: {
          shape: 'quadric',
          template: 'ellipsoid',
          axis: 'z',
          a: 2.1,
          b: 1.6,
          c: 1.3,
          draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'],
        },
        quiz: {
          question: "Ellipsoid tenglamasida a = b = c = r bo'lsa, u qanday sirtga aylanadi?",
          options: ['Konusga', 'Sferaga', 'Paraboloidga'],
          correct_index: 1,
          explanation_uz: "Barcha yarim o'qlar tenglashganda ellipsoid oddiy sferaga aylanadi.",
        },
      },
    ],
  },
  {
    id: 'insulin-1zni-pdb',
    topic_title: 'Insulin Oqsili (1ZNI)',
    subject: 'chemistry',
    engine: 'pdb',
    source: 'cache',
    keywords: ['insulin', '1zni', 'oqsil', 'protein', 'pdb', 'biokimyo', 'molekula'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. RCSB PDB bazasidan 1ZNI oqsili',
        speech_text:
          "Insulin — qondagi qand miqdorini boshqaruvchi oqsil gormoni. Hozir uning haqiqiy uch o'lchamli tuzilishini ko'ryapsiz.",
        katex_formulas: ['\\text{PDB ID: } \\mathbf{1ZNI} \\quad (\\text{A + B zanjirlar})'],
        explanation_uz:
          "3Dmol yordamida oqsil spiralini barmoq bilan 360 daraja aylantirib o'rganing.",
        emoji_emotion: 'explaining',
        render_params: {
          pdb_id: '1ZNI',
          style: 'cartoon',
        },
      },
      {
        step_number: 2,
        step_title: '2. Atomlararo kimyoviy bog‘lar',
        speech_text:
          "Oqsil zanjiridagi har bir atom va aminokislotalar orasidagi disulfid bog'larni ko'ramiz.",
        katex_formulas: ['-\\text{S}-\\text{S}- \\text{ disulfid ko‘priklar}'],
        explanation_uz:
          "Yuqoridagi uslub tugmalari orqali lenta, bog'lar yoki sferik ko'rinishga o'ting.",
        emoji_emotion: 'happy',
        render_params: {
          pdb_id: '1ZNI',
          style: 'stick',
        },
        quiz: {
          question: "Insulin oqsilining A va B zanjirlarini fazoda qaysi kimyoviy bog'lar mustahkam bog'lab turadi?",
          options: ['Disulfid (-S-S-) ko‘priklar', 'Faqat ion bog‘lar', 'Metall bog‘lar'],
          correct_index: 0,
          explanation_uz: "Sistein aminokislotalari orasidagi disulfid (-S-S-) bog'lar insulin tuzilishini barqaror saqlaydi.",
        },
      },
    ],
  },
  {
    id: 'caffeine-pubchem-3d',
    topic_title: 'Kofein 3D Molekulasi',
    subject: 'chemistry',
    engine: 'pubchem',
    source: 'cache',
    keywords: ['kofein', 'caffeine', 'kimyo', 'molekula', 'pubchem', 'c8h10n4o2'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. Kofein kimyoviy tarkibi',
        speech_text:
          "Kofein — sakkizta uglerod, o'nta vodorod, to'rtta azot va ikkita kislorod atomidan tashkil topgan tabiiy alkaloid.",
        katex_formulas: ['\\text{C}_8\\text{H}_{10}\\text{N}_4\\text{O}_2, \\quad M = 194.19\\text{ g/mol}'],
        explanation_uz:
          "PubChem 3D bazasidan haqiqiy atom koordinatalari olinadi.",
        emoji_emotion: 'explaining',
        render_params: {
          compound: 'Caffeine',
          formula: 'C8H10N4O2',
          style: 'ballstick',
        },
      },
      {
        step_number: 2,
        step_title: '2. Purin halqalari tuzilishi',
        speech_text:
          "Kofein molekulasi tutashgan ikkita halqali purin skeletidan iborat.",
        katex_formulas: ['\\text{1,3,7-trimetilksantin}'],
        explanation_uz:
          "Ko'k sharlar azot, qizil sharlar kislorod, kulranglari esa uglerod atomlaridir.",
        emoji_emotion: 'happy',
        render_params: {
          compound: 'Caffeine',
          formula: 'C8H10N4O2',
          style: 'sphere',
        },
        quiz: {
          question: "Kofein (C₈H₁₀N₄O₂) molekulasida jami nechta azot (N) atomi mavjud?",
          options: ['2 ta', '4 ta', '8 ta'],
          correct_index: 1,
          explanation_uz: "Formula ko'rsatkichiga ko'ra kofein tarkibida 4 ta azot (N₄) atomi bor.",
        },
      },
    ],
  },
  {
    id: 'quadratic-parabola',
    topic_title: 'Kvadrat funksiya parabolasi va ildizlari',
    subject: 'math',
    engine: 'plotly2d',
    source: 'cache',
    keywords: [
      'kvadrat funksiya',
      'parabola',
      'diskriminant',
      'ildiz',
      'tenglama',
      'ekstremum',
    ],
    sliders: [
      { id: 'a', label: 'Koeffitsiyent (a)', min: -3, max: 3, step: 0.5, default: 1, unit: '' },
      { id: 'b', label: 'Koeffitsiyent (b)', min: -6, max: 6, step: 0.5, default: -2, unit: '' },
      { id: 'c', label: 'Ozod had (c)', min: -8, max: 8, step: 0.5, default: -3, unit: '' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Parabola shaklini tahlil qilish',
        speech_text:
          "Kvadrat funksiya y teng ax kvadrat plus bx plus c ko'rinishida yoziladi. a koeffitsiyent parabolaning shoxlari qayerga yo'nalishini belgilaydi.",
        katex_formulas: ['y = ax^2 + bx + c', 'a > 0 \\Rightarrow \\text{shoxlari yuqoriga}'],
        live_formula_expressions: [
          { label: 'Diskriminant', latex_lhs: 'D', expr: 'b^2 - 4*a*c' },
        ],
        explanation_uz:
          "a > 0 bo'lganda parabola shoxlari yuqoriga, a < 0 bo'lganda esa pastga qarab yo'naladi.",
        emoji_emotion: 'explaining',
        render_params: {
          expression: 'a * x^2 + b * x + c',
          x_range: [-6, 6],
        },
      },
      {
        step_number: 2,
        step_title: '2. Parabola uchi (ekstremum nuqtasi)',
        speech_text:
          "Parabolaning eng quyi yoki eng yuqori nuqtasi uning uchi deyiladi. Uning x koordinatasi minus b taqsim ikki a formula bilan topiladi.",
        katex_formulas: [
          'x_0 = -\\frac{b}{2a}',
          'y_0 = ax_0^2 + bx_0 + c',
        ],
        live_formula_expressions: [
          { label: 'Uch absissasi', latex_lhs: 'x_0', expr: '-b / (2 * (a == 0 ? 0.01 : a))' },
          { label: 'Uch ordinatasi', latex_lhs: 'y_0', expr: 'a * (-b / (2 * (a == 0 ? 0.01 : a)))^2 + b * (-b / (2 * (a == 0 ? 0.01 : a))) + c' },
        ],
        explanation_uz:
          "x₀ nuqtasidan o'tadigan vertikal chiziq parabolaning simmetriya o'qidir.",
        emoji_emotion: 'pointing',
        render_params: {
          expression: 'a * x^2 + b * x + c',
          x_range: [-6, 6],
          derivative: true,
        },
      },
      {
        step_number: 3,
        step_title: '3. Diskriminant va funksiya nollari',
        speech_text:
          "Parabola OX o'qini qayerda kesib o'tishini diskriminant D aniqlaydi. D musbat bo'lsa ikkita haqiqiy ildiz mavjud bo'ladi.",
        katex_formulas: [
          'D = b^2 - 4ac',
          'x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a}',
        ],
        live_formula_expressions: [
          { label: 'Diskriminant D', latex_lhs: 'D', expr: 'b^2 - 4*a*c' },
        ],
        explanation_uz:
          "Grafikda X o'qi bilan kesishish nuqtalari kvadrat tenglamaning ildizlarini ko'rsatadi.",
        emoji_emotion: 'thinking',
        render_params: {
          expression: 'a * x^2 + b * x + c',
          secondary_expression: '0',
          x_range: [-6, 6],
        },
      },
      {
        step_number: 4,
        step_title: "4. Hosila va o'sish-kamayish oraliqlari",
        speech_text:
          "Funksiyaning birinchi hosilasi to'g'ri chiziq bo'lib, u nolga teng bo'lgan nuqta parabolaning ekstremumiga mos keladi.",
        katex_formulas: ["y' = 2ax + b", "y'(x_0) = 0"],
        explanation_uz:
          "Hosilasi musbat bo'lgan oraliqda parabola o'sadi, manfiy oraliqda esa kamayadi.",
        emoji_emotion: 'happy',
        render_params: {
          expression: 'a * x^2 + b * x + c',
          x_range: [-6, 6],
          derivative: true,
        },
      },
    ],
  },
  {
    id: 'vectors-3d-physics',
    topic_title: "3D Vektorlarni qo'shish va skalyar ko'paytma",
    subject: 'physics',
    engine: 'threejs',
    source: 'cache',
    keywords: ['vektor', 'fizika', 'kuch', 'skalyar', 'parallelogramm', '3d vektor'],
    sliders: [
      { id: 'ax', label: 'Vector A (x)', min: 1, max: 6, step: 0.5, default: 4, unit: 'N' },
      { id: 'ay', label: 'Vector A (y)', min: 0, max: 6, step: 0.5, default: 2, unit: 'N' },
      { id: 'bx', label: 'Vector B (x)', min: -4, max: 4, step: 0.5, default: 1.5, unit: 'N' },
      { id: 'bz', label: 'Vector B (z)', min: -5, max: 5, step: 0.5, default: 3.5, unit: 'N' },
    ],
    steps: [
      {
        step_number: 1,
        step_title: '1. Fazoviy kuch vektorlari',
        speech_text:
          "Fizikada kuch va tezlik nafaqat qiymatga, balki fazoviy yo'nalishga ham ega. Keling, A va B kuch vektorlarini ko'ramiz.",
        katex_formulas: [
          '\\vec{A} = (A_x, A_y, 0)',
          '\\vec{B} = (B_x, 2, B_z)',
        ],
        live_formula_expressions: [
          { label: '|A| moduli', latex_lhs: '|\\vec{A}|', expr: 'sqrt(ax^2 + ay^2)', unit: 'N' },
          { label: '|B| moduli', latex_lhs: '|\\vec{B}|', expr: 'sqrt(bx^2 + 4 + bz^2)', unit: 'N' },
        ],
        explanation_uz:
          "Moviy va yashil strelkalar fazodagi ikkita kuchni ifodalaydi.",
        emoji_emotion: 'explaining',
        camera: [9, 6.5, 9],
        flowType: 'dc',
        flowSpeed: 1.1,
        flowReverse: false,
        render_params: {
          shape: 'vectors',
          flowType: 'dc',
          flowSpeed: 1.1,
        },
      },
      {
        step_number: 2,
        step_title: "2. Natijaviy vektor (Parallelogramm qoidasi)",
        speech_text:
          "Ikki kuch bir jismga ta'sir qilganda, ularning natijaviy kuchi mos koordinatalarni qo'shish orqali topiladi.",
        katex_formulas: [
          '\\vec{R} = \\vec{A} + \\vec{B}',
          '|\\vec{R}| = \\sqrt{(A_x+B_x)^2 + (A_y+B_y)^2 + (A_z+B_z)^2}',
        ],
        live_formula_expressions: [
          { label: 'Natijaviy |R|', latex_lhs: '|\\vec{R}|', expr: 'sqrt((ax+bx)^2 + (ay+2)^2 + bz^2)', unit: 'N' },
        ],
        explanation_uz:
          "Oltin rangli vektor R — A va B kuchlarining teng ta'sir etuvchisidir.",
        emoji_emotion: 'happy',
        camera: [10, 7.5, 8],
        flowType: 'dc',
        flowSpeed: 1.25,
        flowReverse: false,
        render_params: {
          shape: 'vectors',
          highlight: ['resultant'],
          flowType: 'dc',
          flowSpeed: 1.25,
        },
      },
    ],
  },
  {
    id: 'parabola-y-x2',
    topic_title: 'y = x² grafiki: Parabola',
    subject: 'math',
    engine: 'plotly2d',
    source: 'cache',
    keywords: ['parabola', 'y=x^2', 'kvadrat funksiya'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: "1. Koordinata o'qlari va nuqtalar",
        speech_text:
          "Salom! Bugun y teng x kvadrat funksiyasining grafikini birgalikda chizamiz. Avval x va y o'qlarini chizib, (0, 0), (1, 1), (-1, 1), (-2, 4) va (2, 4) nuqtalarni joylashtiramiz.",
        katex_formulas: ['y = x^2'],
        explanation_uz:
          "Har bir x qiymatini kvadratga oshirib koordinata tekisligida asosiy nuqtalarni belgilaymiz.",
        emoji_emotion: 'happy',
        beats: [
          {
            sentence: "Salom! Bugun y teng x kvadrat funksiyasining grafikini birgalikda chizamiz.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            note: "Koordinata o'qlari",
          },
          {
            sentence: "Avval nol-nol, bir-bir va minus bir-bir nuqtalarni tekislikda belgilaymiz.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Asosiy nuqtalar',
          },
          {
            sentence: "So'ng ikki-to'rt hamda minus ikki-to'rt nuqtalarni ham chizamiz.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Simmetrik nuqtalar',
          },
        ],
        render_params: {
          expression: 'x^2',
          x_range: [-3.5, 3.5],
          y_range: [-1, 10],
          highlight_points: [
            { x: 0, y: 0, label: '(0,0)' },
            { x: 1, y: 1, label: '(1,1)' },
            { x: -1, y: 1, label: '(-1,1)' },
            { x: -2, y: 4, label: '(-2,4)' },
            { x: 2, y: 4, label: '(2,4)' },
          ],
        },
      },
      {
        step_number: 2,
        step_title: '2. Silliq egri chiziq — Parabola',
        speech_text:
          "Bu nuqtalarni silliq egri chiziq bilan tutashtirsak, grafik hosil bo'ladi. U parabola deb ataladi.",
        katex_formulas: ['y = x^2 \\ge 0'],
        explanation_uz:
          "Nuqtalarni silliq birlashtirganda yuqoriga qaragan simmetrik parabola hosil bo'ladi.",
        emoji_emotion: 'explaining',
        beats: [
          {
            sentence: "Bu nuqtalarni silliq egri chiziq bilan tutashtirsak, grafik hosil bo'ladi.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.05,
            note: 'Egri chiziq chizish',
          },
          {
            sentence: "U parabola deb ataladi va y o'qiga nisbatan simmetrik joylashadi.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            note: 'Parabola shakli',
          },
        ],
        render_params: {
          expression: 'x^2',
          x_range: [-3.5, 3.5],
          y_range: [-1, 10],
          highlight_points: [
            { x: 0, y: 0, label: '(0,0)' },
            { x: 1, y: 1, label: '(1,1)' },
            { x: -1, y: 1, label: '(-1,1)' },
            { x: -2, y: 4, label: '(-2,4)' },
            { x: 2, y: 4, label: '(2,4)' },
          ],
        },
      },
      {
        step_number: 3,
        step_title: '3. Parabola uchi va simmetriyasi',
        speech_text:
          "Parabolaning eng quyi nuqtasi uning uchi nol-nol nuqtasidir. Manfiy va musbat x larda y qiymati doim musbat va teng bo'ladi.",
        katex_formulas: ['(-x)^2 = x^2'],
        explanation_uz:
          "Juft funksiya bo'lgani uchun (-2, 4) va (2, 4) nuqtalar y o'qidan bir xil masofada turadi.",
        emoji_emotion: 'pointing',
        beats: [
          {
            sentence: "Parabolaning eng quyi nuqtasi uning uchi nol-nol nuqtasidir.",
            focus_target: 'vertex_min',
            tutor_pose: 'approach',
            camera_zoom: 1.12,
            note: 'Uch (0,0)',
          },
          {
            sentence: "Manfiy va musbat x larda y qiymati doim musbat va teng bo'ladi.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 0.96,
            note: 'Simmetriya',
          },
        ],
        render_params: {
          expression: 'x^2',
          x_range: [-3.5, 3.5],
          y_range: [-1, 10],
          highlight_points: [
            { x: 0, y: 0, label: 'Uch (0,0)' },
            { x: 2, y: 4, label: '(2,4)' },
            { x: -2, y: 4, label: '(-2,4)' },
          ],
        },
      },
      {
        step_number: 4,
        step_title: '4. Qisqa tekshiruv savoli',
        speech_text:
          "Keling tekshirib ko'ramiz! Agar x teng uch bo'lsa, y teng x kvadrat funksiyasining qiymati nechaga teng bo'ladi?",
        katex_formulas: ['x = 3 \\implies y = ?'],
        explanation_uz:
          "Grafik ustida x = 3 nuqtasini o'ylab ko'rib to'g'ri javobni tanlang.",
        emoji_emotion: 'encouraging',
        beats: [
          {
            sentence: "Keling tekshirib ko'ramiz!",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 0.96,
            note: 'Sinov savoli',
          },
          {
            sentence: "Agar x teng uch bo'lsa, y teng x kvadrat qiymati nechaga teng bo'ladi?",
            focus_target: 'x_intercept',
            tutor_pose: 'approach',
            camera_zoom: 1.05,
            note: 'x = 3 nuqtasi',
          },
        ],
        render_params: {
          expression: 'x^2',
          x_range: [-3.5, 3.5],
          y_range: [-1, 10],
          highlight_points: [
            { x: 0, y: 0, label: '(0,0)' },
            { x: 3, y: 9, label: '(3, ?)' },
          ],
        },
        quiz: {
          question: "y = x² funksiyasida x = 3 bo'lganda y nechaga teng bo'ladi?",
          options: ['6', '9', '12'],
          correct_index: 1,
          explanation_uz: "3² = 3 × 3 = 9, demak grafik (3, 9) nuqtasidan o'tadi.",
        },
      },
    ],
  },
  {
    id: 'photosynthesis-visual',
    topic_title: "O'simliklar qanday oziqlanadi? (Fotosintez)",
    subject: 'biology',
    engine: 'svg2d',
    source: 'cache',
    keywords: ['fotosintez', 'osimliklar', 'xloroplast', 'glyukoza'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. Quyosh nuri — asosiy energiya',
        speech_text:
          "O'simliklar tayyor ovqat yemaydi, ular o'z ozuqasini quyosh nuri yordamida barglarida tayyorlaydi. Bu jarayon fotosintez deyiladi.",
        katex_formulas: ['\\text{Quyosh nuri} \\rightarrow \\text{Xloroplast}'],
        explanation_uz:
          "Barglardagi yashil xlorofill quyosh energiyasini yutib, kimyoviy reaksiyani boshlaydi.",
        emoji_emotion: 'explaining',
        flowType: 'pulse',
        flowSpeed: 1.0,
        beats: [
          {
            sentence: "O'simliklar tayyor ovqat yemaydi, ular o'z ozuqasini quyosh nuri yordamida barglarida tayyorlaydi.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.05,
            note: 'Quyosh nuri',
          },
          {
            sentence: "Bu jarayon fotosintez deb ataladi va yashil xloroplastlarda kechadi.",
            focus_target: 'leaf_chloroplast',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Xloroplast',
          },
        ],
        render_params: {
          kind: 'photosynthesis',
          flowType: 'pulse',
          flowSpeed: 1.0,
        },
      },
      {
        step_number: 2,
        step_title: '2. Suv va karbonat angidrid kirishi',
        speech_text:
          "Ildizlar tuproqdan suvni yuqoriga tortadi, barg teshikchalari esa havodan karbonat angidrid gazini yutadi.",
        katex_formulas: ['6\\text{CO}_2 + 6\\text{H}_2\\text{O}'],
        explanation_uz:
          "Suv va karbonat angidrid ozuqa tayyorlash uchun ikkita asosiy xomashyodir.",
        emoji_emotion: 'pointing',
        flowType: 'dc',
        flowSpeed: 1.05,
        beats: [
          {
            sentence: "Ildizlar tuproqdan suvni yuqoriga barglarga yetkazadi.",
            focus_target: 'water_roots',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Suv ko‘tarilishi',
          },
          {
            sentence: "Barglar esa havodan karbonat angidrid gazini qabul qiladi.",
            focus_target: 'leaf_chloroplast',
            tutor_pose: 'approach',
            camera_zoom: 1.04,
            note: 'CO₂ yutilishi',
          },
        ],
        render_params: {
          kind: 'photosynthesis',
          flowType: 'dc',
          flowSpeed: 1.05,
        },
      },
      {
        step_number: 3,
        step_title: '3. Glyukoza va kislorod hosil bo‘lishi',
        speech_text:
          "Quyosh energiyasi yordamida suv va gazdan o'simlik uchun shirin ozuqa — glyukoza hamda biz nafas oladigan toza kislorod ajralib chiqadi.",
        katex_formulas: ['6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{h\\nu} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2'],
        explanation_uz:
          "Glyukoza o'simlik o'sishiga sarflanadi, kislorod esa atmosferaga chiqariladi.",
        emoji_emotion: 'happy',
        flowType: 'dc',
        flowSpeed: 1.25,
        beats: [
          {
            sentence: "Quyosh energiyasi ta'sirida o'simlik o'zi uchun glyukoza ozuqasini sintezlaydi.",
            focus_target: 'leaf_chloroplast',
            tutor_pose: 'approach',
            camera_zoom: 1.05,
            note: 'Glyukoza sintezi',
          },
          {
            sentence: "Shu bilan birga havoga biz nafas oladigan toza kislorod gazi ajralib chiqariladi.",
            focus_target: 'oxygen_out',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Kislorod O₂',
          },
        ],
        render_params: {
          kind: 'photosynthesis',
          flowType: 'dc',
          flowSpeed: 1.25,
        },
      },
      {
        step_number: 4,
        step_title: '4. Qisqa tekshiruv savoli',
        speech_text:
          "Bilimingizni sinab ko'ramiz! Fotosintez natijasida o'simlik havoga qaysi gazni chiqaradi?",
        katex_formulas: ['\\text{CO}_2 + \\text{H}_2\\text{O} \\rightarrow \\text{Ozuqa} + ?'],
        explanation_uz:
          "Doskadagi chizmaga qarab to'g'ri javobni tanlang.",
        emoji_emotion: 'encouraging',
        flowType: 'pulse',
        flowSpeed: 1.0,
        beats: [
          {
            sentence: "Bilimingizni sinab ko'ramiz!",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 0.96,
            note: 'Takrorlash',
          },
          {
            sentence: "Fotosintez natijasida o'simlik havoga qaysi gazni chiqaradi?",
            focus_target: 'oxygen_out',
            tutor_pose: 'approach',
            camera_zoom: 1.04,
            note: 'Sinov savoli',
          },
        ],
        render_params: {
          kind: 'photosynthesis',
          flowType: 'pulse',
          flowSpeed: 1.0,
        },
        quiz: {
          question: "Fotosintez jarayonida o'simliklar atmosferaga qaysi gazni ajratib chiqaradi?",
          options: ['Kislorod (O₂)', 'Azot (N₂)', 'Metan (CH₄)'],
          correct_index: 0,
          explanation_uz: "Suv va karbonat angidriddan glyukoza hosil bo'lganda qo'shimcha mahsulot sifatida kislorod (O₂) ajraladi.",
        },
      },
    ],
  },
  {
    id: 'sky-blue-physics',
    topic_title: 'Nega osmon moviy? (Yorug‘lik sochilishi)',
    subject: 'physics',
    engine: 'svg2d',
    source: 'cache',
    keywords: ['osmon moviy', 'reley sochilishi', 'yoruglik', 'fizika'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. Oq quyosh nuri barcha ranglardan iborat',
        speech_text:
          "Quyoshdan kelayotgan oq yorug'lik aslida kamalakdagi barcha ranglarning aralashmasidir. Har bir rangning to'lqin uzunligi turlicha bo'ladi.",
        katex_formulas: ['\\lambda_{\\text{ko‘k}} < \\lambda_{\\text{qizil}}'],
        explanation_uz:
          "Qizil yorug'lik uzun to'lqinli, ko'k va binafsha yorug'lik esa qisqa to'lqinli bo'ladi.",
        emoji_emotion: 'explaining',
        flowType: 'pulse',
        flowSpeed: 1.25,
        beats: [
          {
            sentence: "Quyoshdan kelayotgan oq yorug'lik aslida barcha ranglarning aralashmasidir.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.04,
            note: 'Quyosh nuri',
          },
          {
            sentence: "Har bir rang to'lqinining uzunligi turlicha bo'lib, atmosferamizga kirib keladi.",
            focus_target: 'atmosphere_molecules',
            tutor_pose: 'approach',
            camera_zoom: 1.05,
            note: 'Atmosfera chegarasi',
          },
        ],
        render_params: {
          kind: 'sky_scattering',
          flowType: 'pulse',
          flowSpeed: 1.25,
        },
      },
      {
        step_number: 2,
        step_title: '2. Qisqa ko‘k to‘lqinlar sochiladi',
        speech_text:
          "Yorug'lik havodagi azot va kislorod molekulalariga urilganda, qisqa ko'k to'lqinlar har tomonga kuchli sochilib ketadi.",
        katex_formulas: ['I_{\\text{sochilish}} \\propto \\frac{1}{\\lambda^4}'],
        explanation_uz:
          "Reley qonuniga ko'ra, to'lqin qanchalik qisqa bo'lsa, u shunchalik kuchli sochiladi.",
        emoji_emotion: 'surprised',
        flowType: 'pulse',
        flowSpeed: 1.4,
        beats: [
          {
            sentence: "Yorug'lik havodagi azot va kislorod molekulalariga uriladi.",
            focus_target: 'atmosphere_molecules',
            tutor_pose: 'approach',
            camera_zoom: 1.06,
            note: 'Havodagi molekulalar',
          },
          {
            sentence: "Natijada qisqa ko'k to'lqinlar butun osmon bo'ylab har tomonga kuchli sochiladi!",
            focus_target: 'blue_scatter',
            tutor_pose: 'approach',
            camera_zoom: 1.08,
            note: 'Ko‘k rang sochilishi',
          },
        ],
        render_params: {
          kind: 'sky_scattering',
          flowType: 'pulse',
          flowSpeed: 1.4,
        },
      },
      {
        step_number: 3,
        step_title: '3. Uzun qizil to‘lqinlar to‘g‘ri o‘tadi',
        speech_text:
          "Uzun qizil va sariq to'lqinlar esa mayda gaz molekulalaridan deyarli to'qnashmasdan to'g'ri o'tib ketadi. Shuning uchun kunduzi osmon moviy ko'rinadi.",
        katex_formulas: ['\\text{Ko‘k sochiladi} \\implies \\text{Moviy osmon}'],
        explanation_uz:
          "Kechqurun quyosh botayotganda nur uzoqroq yo'l bosgani uchun ko'k rang sochilib tugaydi va qizil rang ko'zimizga yetib keladi.",
        emoji_emotion: 'happy',
        flowType: 'pulse',
        flowSpeed: 1.2,
        beats: [
          {
            sentence: "Uzun qizil to'lqinlar esa molekulalardan deyarli to'g'ri o'tib ketadi.",
            focus_target: 'red_pass',
            tutor_pose: 'approach',
            camera_zoom: 1.04,
            note: 'Qizil to‘lqinlar',
          },
          {
            sentence: "Shuning uchun tepaga qaraganimizda ko'zimizga sochilgan moviy nurlar tushadi.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 0.96,
            note: 'Moviy osmon',
          },
        ],
        render_params: {
          kind: 'sky_scattering',
          flowType: 'pulse',
          flowSpeed: 1.2,
        },
      },
      {
        step_number: 4,
        step_title: '4. Qisqa tekshiruv savoli',
        speech_text:
          "Tekshirib ko'ramiz! Atmosferadagi havo molekulalari qaysi rangdagi yorug'lik to'lqinini eng kuchli sochadi?",
        katex_formulas: ['I \\propto \\lambda^{-4}'],
        explanation_uz:
          "Reley sochilishi qonuniga asoslanib to'g'ri javobni tanlang.",
        emoji_emotion: 'encouraging',
        flowType: 'pulse',
        flowSpeed: 1.15,
        beats: [
          {
            sentence: "Tekshirib ko'ramiz!",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 0.96,
            note: 'Sinov',
          },
          {
            sentence: "Havo molekulalari qaysi to'lqinni eng kuchli sochadi?",
            focus_target: 'blue_scatter',
            tutor_pose: 'approach',
            camera_zoom: 1.04,
            note: 'To‘lqin uzunligi',
          },
        ],
        render_params: {
          kind: 'sky_scattering',
          flowType: 'pulse',
          flowSpeed: 1.15,
        },
        quiz: {
          question: "Kunduzi osmon nima sababdan moviy bo'lib ko'rinadi?",
          options: [
            "Qisqa ko'k to'lqinlar havoda kuchliroq sochilgani uchun",
            "Okean suvlari osmonni ko'kka bo'yagani uchun",
            "Quyosh faqat ko'k rang chiqargani uchun",
          ],
          correct_index: 0,
          explanation_uz: "Qisqa to'lqinli ko'k nurlar azot va kislorod molekulalarida qizil nurlarga qaraganda bir necha barobar kuchli sochiladi.",
        },
      },
    ],
  },
  {
    id: 'uzbek-grammar-syntax',
    topic_title: "O'zbek tili: Gap bo'laklari tahlili",
    subject: 'language',
    engine: 'mermaid',
    source: 'cache',
    keywords: ['ona tili', 'grammatika', 'gap bolaklari', 'ega', 'kesim', 'aniqlovchi'],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: "1. Gapning bosh bo'laklari: Ega va Kesim",
        speech_text:
          "O'zbek tilida gapning asosini bosh bo'laklar — Ega va Kesim tashkil etadi. Kesim harakat yoki holatni bildirsa, Ega uni bajaruvchini ko'rsatadi.",
        katex_formulas: ['\\text{Gap} = \\text{Ega (Kim?)} + \\text{Kesim (Nima qildi?)}'],
        explanation_uz:
          "Namuna gap: 'Iqtidorli talaba kecha murakkab masalani tez yechdi.'",
        emoji_emotion: 'explaining',
        render_params: {
          diagram: `flowchart TD
  G["Gap: Iqtidorli talaba kecha murakkab masalani tez yechdi"]
  G --> B1["Bosh bo'laklar"]
  G --> B2["Ikkinchi darajali bo'laklar"]
  B1 --> E["Ega: talaba (Kim?)"]
  B1 --> K["Kesim: yechdi (Nima qildi?)"]
  B2 --> A["Aniqlovchi: Iqtidorli, murakkab"]
  B2 --> T["To'ldiruvchi: masalani (Nimani?)"]
  B2 --> H["Hol: kecha (Qachon?), tez (Qanday?)"]`,
          highlight_nodes: ['B1', 'E', 'K'],
        },
      },
      {
        step_number: 2,
        step_title: "2. Ikkinchi darajali bo'laklar",
        speech_text:
          "Aniqlovchi belgini, to'ldiruvchi obyektini, hol esa harakatning payti va tarzini izohlab keladi.",
        katex_formulas: ["\\text{Aniqlovchi} \\rightarrow \\text{Qanday?}", "\\text{Hol} \\rightarrow \\text{Qachon? Qanday?}"],
        explanation_uz:
          "Bosh bo'laklarga bog'langan ikkinchi darajali bo'laklar gap ma'nosini aniq va boy qiladi.",
        emoji_emotion: 'happy',
        render_params: {
          diagram: `flowchart TD
  G["Gap: Iqtidorli talaba kecha murakkab masalani tez yechdi"]
  G --> B1["Bosh bo'laklar"]
  G --> B2["Ikkinchi darajali bo'laklar"]
  B1 --> E["Ega: talaba (Kim?)"]
  B1 --> K["Kesim: yechdi (Nima qildi?)"]
  B2 --> A["Aniqlovchi: Iqtidorli, murakkab"]
  B2 --> T["To'ldiruvchi: masalani (Nimani?)"]
  B2 --> H["Hol: kecha (Qachon?), tez (Qanday?)"]`,
          highlight_nodes: ['B2', 'A', 'T', 'H'],
        },
      },
    ],
  },
  {
    id: 'biology-cell-structure',
    topic_title: 'Hujayra tuzilishi (Biologiya)',
    subject: 'biology',
    engine: 'svg2d',
    source: 'cache',
    keywords: [
      'hujayra',
      'hujayra tuzilishi',
      'tirik hujayra',
      'mitoxondriya',
      'sitoplazma',
      'hujayra membranasi',
    ],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. Hujayra — tiriklikning asosiy birligi',
        speech_text:
          "Barcha tirik organizmlar — o'simliklar, hayvonlar va inson tanasi mikroskopik g'ishtchalardan, ya'ni hujayralardan tuzilgan. Avval hujayraning umumiy shakli va tashqi membranasini chizamiz.",
        katex_formulas: ['\\text{Tirik organizm} = \\sum \\text{Hujayralar}'],
        explanation_uz:
          "1.0x umumiy ko'rinish: Hujayra membranasi ichki muhitni tashqi dunyodan ajratib turadi.",
        emoji_emotion: 'explaining',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Barcha tirik organizmlar mikroskopik g'ishtchalardan — hujayralardan tuzilgan.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Hujayra membranasi',
          },
          {
            sentence: "Avval hujayraning tashqi qobig'i va ichki sitoplazmasini to'liq chizamiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy shakl',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'hujayra',
          object_name_en: 'biological cell',
          svg_data: CELL_SVG?.svg_data,
          svg_viewbox: CELL_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: CELL_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: CELL_PRIMS_3D,
        },
      },
      {
        step_number: 2,
        step_title: '2. Yadro va irsiy axborot (DNK)',
        speech_text:
          "Hujayraning markazida yadro joylashgan bo'lib, u barcha hayotiy jarayonlarni boshqaradi va DNK irsiy axborotini saqlaydi.",
        katex_formulas: [
          '\\text{Yadro} \\rightarrow \\text{DNK boshqaruvi}',
        ],
        explanation_uz:
          "Yadro (DNK) qismiga yaqinlashuv — qolgan qismlar xiralashtirilib faol markaz ajratib ko'rsatiladi.",
        emoji_emotion: 'pointing',
        focusPart: 'nucleus',
        cameraZoom: 1.78,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Hujayraning markazida yadro joylashgan bo'lib, u barcha hayotiy jarayonlarni boshqaradi.",
            focus_target: 'nucleus',
            focusPart: 'nucleus',
            tutor_pose: 'approach',
            camera_zoom: 1.78,
            dimInactiveParts: true,
            note: 'Yadro va DNK',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'hujayra',
          object_name_en: 'biological cell',
          svg_data: CELL_SVG?.svg_data,
          svg_viewbox: CELL_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: CELL_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: CELL_PRIMS_3D,
          highlight: ['parts'],
        },
      },
      {
        step_number: 3,
        step_title: '3. Mitoxondriya va energiya ishlab chiqarish',
        speech_text:
          "Apelsin rangli mitoxondriyalar esa hujayraning energiya stansiyasi bo'lib, oziqa moddalardan ATF energiyasini ishlab chiqaradi.",
        katex_formulas: ['\\text{Oziqa} + \\text{O}_2 \\xrightarrow{\\text{Mitoxondriya}} \\text{Energiya (ATF)}'],
        explanation_uz:
          "Mitoxondriyaga yaqinlashuv — energiya almashinuvi markazi.",
        emoji_emotion: 'happy',
        focusPart: 'mitochondria',
        cameraZoom: 1.84,
        dimInactiveParts: true,
        beats: [
          {
            sentence: "Apelsin rangli mitoxondriyalar hujayra uchun ATF energiyasini ishlab chiqaradigan stansiyalardir.",
            focus_target: 'mitochondria',
            focusPart: 'mitochondria',
            tutor_pose: 'approach',
            camera_zoom: 1.84,
            dimInactiveParts: true,
            note: 'Mitoxondriya',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'hujayra',
          object_name_en: 'biological cell',
          svg_data: CELL_SVG?.svg_data,
          svg_viewbox: CELL_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: CELL_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: CELL_PRIMS_3D,
          highlight: ['parts'],
        },
      },
      {
        step_number: 4,
        step_title: '4. Umumiy ko‘rinish va sinov',
        speech_text:
          "Endi hujayraning barcha organoidlarini yana to'liq ko'rinishda ko'ramiz! Hujayraning qaysi organoidi energiya stansiyasi deb ataladi?",
        katex_formulas: ['\\text{Mini-test: } \\mathbf{Hujayra}'],
        explanation_uz: "1.0x umumiy ko'rinish · To'g'ri javobni tanlang.",
        emoji_emotion: 'encouraging',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        beats: [
          {
            sentence: "Endi hujayraning barcha qismlarini yana umumiy ko'rinishda ko'ramiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy ko‘rinish (1.0x)',
          },
          {
            sentence: "Hujayraning qaysi organoidi energiya stansiyasi deb ataladi?",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            note: 'Sinov savoli',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'hujayra',
          object_name_en: 'biological cell',
          svg_data: CELL_SVG?.svg_data,
          svg_viewbox: CELL_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: CELL_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: CELL_PRIMS_3D,
        },
        quiz: {
          question: "Hujayrada energiya (ATF) ishlab chiqaradigan asosiy organoid qaysi?",
          options: ['Mitoxondriya', 'Hujayra membranasi', 'Vakuola'],
          correct_index: 0,
          explanation_uz: "Mitoxondriya oziq moddalarni parchalab, hujayra faoliyati uchun zarur ATF energiyasini ishlab chiqaradi.",
        },
      },
    ],
  },
  {
    id: 'physics-transformer',
    topic_title: 'Transformator tuzilishi va ishlashi',
    subject: 'physics',
    engine: 'svg2d',
    source: 'cache',
    keywords: [
      'transformator',
      'birlamchi chulgam',
      'ikkilamchi chulgam',
      'temir ozak',
      'kuchlanish',
      'induksiya',
    ],
    sliders: [],
    steps: [
      {
        step_number: 1,
        step_title: '1. Transformatorning umumiy tuzilishi',
        speech_text:
          "Transformator — o'zgaruvchan tok kuchlanishini oshirib yoki pasaytirib beruvchi qurilma. Avval uning umumiy tuzilishini — temir o'zak va ikkita chulg'amini to'liq chizib olamiz.",
        katex_formulas: ['\\frac{U_1}{U_2} = \\frac{N_1}{N_2}'],
        explanation_uz:
          "1.0x umumiy ko'rinish: Yopiq temir o'zak hamda birlamchi va ikkilamchi chulg'amlar.",
        emoji_emotion: 'explaining',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        flowType: 'ac',
        flowSpeed: 1.0,
        flowReverse: false,
        beats: [
          {
            sentence: "Transformator — o'zgaruvchan tok kuchlanishini o'zgartirib beruvchi elektr qurilmasidir.",
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            flowType: 'ac',
            flowSpeed: 1.0,
            note: 'Umumiy kontur',
          },
          {
            sentence: "Avval uning umumiy tuzilishini — po'lat o'zak va ikkala chulg'amni doskaga chizamiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            flowType: 'ac',
            flowSpeed: 1.0,
            note: 'Umumiy ko‘rinish',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'transformator',
          object_name_en: 'transformer',
          svg_data: TRANSFORMER_SVG?.svg_data,
          svg_viewbox: TRANSFORMER_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: TRANSFORMER_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: TRANSFORMER_PRIMS_3D,
          flowType: 'ac',
          flowSpeed: 1.0,
        },
      },
      {
        step_number: 2,
        step_title: '2. Temir o‘zak va birlamchi chulg‘am (N₁)',
        speech_text:
          "Endi ichki qismlarga yaqinlashamiz. Chapdagi birlamchi chulg'amga o'zgaruvchan tok berilganda, o'rtadagi temir o'zakda yopiq magnit oqimi hosil bo'ladi.",
        katex_formulas: ['\\Phi(t) = B \\cdot S \\cdot \\cos(\\omega t)'],
        explanation_uz:
          "Birlamchi chulg'am va magnit o'zakka yaqinlashuv — o'zgaruvchan tok va magnit oqimi tebranishi.",
        emoji_emotion: 'pointing',
        focusPart: 'coil_1',
        cameraZoom: 1.78,
        dimInactiveParts: true,
        flowType: 'ac',
        flowSpeed: 1.25,
        flowReverse: false,
        beats: [
          {
            sentence: "Chap tomondagi sariq birlamchi chulg'am N₁ kirish kuchlanishini qabul qilib o'zgaruvchan magnit maydon hosil qiladi.",
            focus_target: 'coil_1',
            focusPart: 'coil_1',
            tutor_pose: 'approach',
            camera_zoom: 1.8,
            dimInactiveParts: true,
            flowType: 'ac',
            flowSpeed: 1.25,
            flowReverse: false,
            note: 'Birlamchi chulg‘am (N₁)',
          },
          {
            sentence: "O'rtadagi qatlamli temir o'zak bu magnit oqimini yo'qotishlarsiz narigi tomonga o'tkazib beradi.",
            focus_target: 'core',
            focusPart: 'core',
            tutor_pose: 'approach',
            camera_zoom: 1.68,
            dimInactiveParts: true,
            flowType: 'ac',
            flowSpeed: 1.25,
            flowReverse: false,
            note: 'Temir o‘zak',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'transformator',
          object_name_en: 'transformer',
          svg_data: TRANSFORMER_SVG?.svg_data,
          svg_viewbox: TRANSFORMER_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: TRANSFORMER_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: TRANSFORMER_PRIMS_3D,
          highlight: ['parts'],
          flowType: 'ac',
          flowSpeed: 1.25,
        },
      },
      {
        step_number: 3,
        step_title: '3. Ikkilamchi chulg‘am (N₂) va induksiya',
        speech_text:
          "O'zgaruvchan magnit oqimi o'ng tomondagi ko'k ikkilamchi chulg'am o'ramlarini kesib o'tib, elektromagnit induksiya orqali yangi chiqish kuchlanishini hosil qiladi.",
        katex_formulas: ['U_2 = U_1 \\cdot \\frac{N_2}{N_1}'],
        explanation_uz:
          "Ikkilamchi chulg'am (N₂) ga fokus — induksion tok qarama-qarshi fazada oqadi.",
        emoji_emotion: 'happy',
        focusPart: 'coil_2',
        cameraZoom: 1.82,
        dimInactiveParts: true,
        flowType: 'ac',
        flowSpeed: 1.45,
        flowReverse: true,
        beats: [
          {
            sentence: "O'ng tomondagi ko'k ikkilamchi chulg'am o'ramlari soni N₂ ga qarab chiqish kuchlanishi oshadi yoki pasayadi.",
            focus_target: 'coil_2',
            focusPart: 'coil_2',
            tutor_pose: 'approach',
            camera_zoom: 1.82,
            dimInactiveParts: true,
            flowType: 'ac',
            flowSpeed: 1.45,
            flowReverse: true,
            note: 'Ikkilamchi chulg‘am (N₂)',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'transformator',
          object_name_en: 'transformer',
          svg_data: TRANSFORMER_SVG?.svg_data,
          svg_viewbox: TRANSFORMER_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: TRANSFORMER_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: TRANSFORMER_PRIMS_3D,
          highlight: ['parts'],
          flowType: 'ac',
          flowSpeed: 1.45,
          flowReverse: true,
        },
      },
      {
        step_number: 4,
        step_title: '4. Umumiy ko‘rinish va tekshiruv',
        speech_text:
          "Endi transformatorning barcha qismlarini yana umumiy ko'rinishda ko'ramiz. Agar ikkilamchi chulg'am o'ramlari birlamchisidan 2 barobar ko'p bo'lsa, kuchlanish qanday o'zgaradi?",
        katex_formulas: ['k = \\frac{N_1}{N_2}'],
        explanation_uz: "1.0x umumiy ko'rinish · To'g'ri javobni tanlang.",
        emoji_emotion: 'encouraging',
        cameraZoom: 1.0,
        dimInactiveParts: false,
        flowType: 'ac',
        flowSpeed: 1.15,
        flowReverse: false,
        beats: [
          {
            sentence: "Endi transformatorning barcha qismlarini birgalikda umumiy ko'rinishda ko'ramiz.",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            flowType: 'ac',
            flowSpeed: 1.15,
            note: 'Umumiy ko‘rinish (1.0x)',
          },
          {
            sentence: "Agar ikkilamchi chulg'am o'ramlari soni 2 barobar ko'p bo'lsa, kuchlanish qanday o'zgaradi?",
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            dimInactiveParts: false,
            flowType: 'ac',
            flowSpeed: 1.15,
            note: 'Sinov savoli',
          },
        ],
        render_params: {
          kind: 'illustration',
          object_name_uz: 'transformator',
          object_name_en: 'transformer',
          svg_data: TRANSFORMER_SVG?.svg_data,
          svg_viewbox: TRANSFORMER_SVG?.viewBox || '0 0 200 200',
          object_source: 'cache',
          object_parts: TRANSFORMER_SVG?.parts_uz.map((p) => ({ label: p.label, partId: p.partId })),
          primitives_3d: TRANSFORMER_PRIMS_3D,
          flowType: 'ac',
          flowSpeed: 1.15,
        },
        quiz: {
          question: "Agar ikkilamchi chulg'am o'ramlari soni (N₂) birlamchidan (N₁) 2 marta ko'p bo'lsa, chiqish kuchlanishi U₂ qanday o'zgaradi?",
          options: ['2 marta oshadi', '2 marta kamayadi', 'O‘zgarmaydi'],
          correct_index: 0,
          explanation_uz: "U₂ / U₁ = N₂ / N₁ nisbatiga ko'ra o'ramlar soni 2 marta ko'p bo'lsa, kuchlanish ham 2 marta oshadi.",
        },
      },
    ],
  },
];
