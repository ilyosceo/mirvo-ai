import type {
  EngineType,
  RenderParams,
  SubjectType,
  TutorLesson,
} from '../types/tutor.js';
import { extractObjectIntent, generateProceduralObjectSvg } from '../lib/objectCatalog.js';

const ENGINE_ALIASES: Record<string, EngineType> = {
  '3d': 'threejs',
  '2d': 'svg2d',
  chart: 'plotly2d',
  diagram: 'mermaid',
  graph: 'plotly2d',
  illustration: 'svg2d',
  model: 'threejs',
  molecule: 'pdb',
  plot: 'plotly2d',
  plotly: 'plotly2d',
  svg: 'svg2d',
  board: 'svg2d',
  whiteboard: 'svg2d',
  concept: 'svg2d',
  latex: 'svg2d',
  text: 'svg2d',
  list: 'svg2d',
  definition: 'svg2d',
  comparison: 'svg2d',
  notes: 'svg2d',
  table: 'svg2d',
  card: 'svg2d',
  bullet: 'svg2d',
  summary: 'svg2d',
  fact: 'svg2d',
  step: 'svg2d',
  intro: 'svg2d',
  overview: 'svg2d',
  formula: 'svg2d',
  math: 'plotly2d',
  geometry: 'threejs',
  stereometry: 'threejs',
  physics: 'threejs',
  chemistry: 'pdb',
  biology: 'svg2d',
  triangle: 'svg2d',
  labeled_triangle: 'svg2d',
  circle: 'svg2d',
  pythagoras: 'svg2d',
};

const RENDER_PARAM_KEYS = new Set<keyof RenderParams>([
  'shape', 'template', 'axis', 'p', 'draw', 'surface_color', 'parametric_x',
  'parametric_y', 'parametric_z', 'u_range', 'v_range', 'base', 'height',
  'radius', 'sides', 'cut_ratio', 'highlight', 'vectors', 'angle_deg',
  'velocity', 'show_cross_section', 'show_height', 'show_apothem', 'model_url',
  'primitives_3d', 'expression', 'secondary_expression', 'expression_z',
  'x_range', 'y_range', 'show_contours', 'derivative', 'integral_range',
  'equation_roots', 'highlight_points', 'highlights', 'pdb_id', 'compound',
  'formula', 'style', 'highlight_chain', 'diagram', 'highlight_nodes', 'kind',
  'a', 'b', 'c', 'object_name_uz', 'object_name_en', 'svg_data',
  'svg_viewbox', 'object_source', 'object_parts', 'flowType', 'flowSpeed',
  'flowReverse', 'notes',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function resolveEngine(
  visualType: string,
  visualData: Record<string, unknown>
): EngineType | null {
  const type = visualType.trim().toLowerCase();
  if (type === 'unrecognized-renderer') return null;

  const direct: EngineType[] = [
    'plotly3d', 'plotly2d', 'threejs', 'pdb', 'pubchem', 'mermaid', 'svg2d',
  ];
  if (direct.includes(type as EngineType)) return type as EngineType;
  if (ENGINE_ALIASES[type]) return ENGINE_ALIASES[type];

  if (typeof visualData.diagram === 'string') return 'mermaid';
  if (typeof visualData.pdb_id === 'string') return 'pdb';
  if (typeof visualData.compound === 'string') return 'pubchem';
  if (typeof visualData.expression_z === 'string' || typeof visualData.parametric_x === 'string') {
    return 'plotly3d';
  }
  if (typeof visualData.expression === 'string') return 'plotly2d';
  if (
    typeof visualData.shape === 'string' ||
    Array.isArray(visualData.primitives_3d) ||
    Array.isArray(visualData.vectors)
  ) {
    return 'threejs';
  }
  if (
    typeof visualData.svg_data === 'string' ||
    typeof visualData.kind === 'string' ||
    typeof visualData.object_name_en === 'string'
  ) {
    return 'svg2d';
  }

  if (type.includes('3d')) return 'threejs';
  if (type.includes('plot') || type.includes('graph')) return 'plotly2d';
  if (type.includes('chem') || type.includes('mol')) return 'pdb';
  return 'svg2d';
}

function mapSubject(topic: string): SubjectType {
  const normalized = topic.toLowerCase();
  if (/kimyo|molekul|atom|reaksi/.test(normalized)) return 'chemistry';
  if (/biolog|hujayra|organizm|o'simlik/.test(normalized)) return 'biology';
  if (/fizik|kuch|tezlik|harakat|energiya/.test(normalized)) return 'physics';
  if (/tarix|urush|davlat|sivilizats/.test(normalized)) return 'history';
  if (/til|grammatika|imlo|so'z|gap/.test(normalized)) return 'language';
  if (/geometriya|uchburchak|aylana|piramida|shar|kub/.test(normalized)) return 'geometry';
  return 'math';
}

function mapRenderParams(
  data: Record<string, unknown>,
  engine?: EngineType | null,
  visualType?: string,
  topic?: string
): RenderParams | null {
  const nested = data.render_params;
  const source = nested === undefined ? data : nested;
  if (!isRecord(source)) return null;

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (RENDER_PARAM_KEYS.has(key as keyof RenderParams)) {
      filtered[key] = value;
    }
  }

  if (Array.isArray(source.highlights) && source.highlights.length > 0 && !filtered.highlight) {
    filtered.highlight = source.highlights.map(String);
  }

  if (typeof source.notes === 'string' && source.notes.trim() && !filtered.notes) {
    filtered.notes = source.notes.trim();
  }

  const vt = (visualType || '').trim().toLowerCase();
  if (engine === 'svg2d' && !filtered.kind) {
    if (vt.includes('pythagor')) filtered.kind = 'pythagoras';
    else if (vt.includes('triangle') || vt.includes('uchburchak')) filtered.kind = 'triangle';
    else if (vt.includes('circle') || vt.includes('aylana')) filtered.kind = 'circle';
    else filtered.kind = 'illustration';
  } else if (engine === 'threejs' && !filtered.shape) {
    if (vt.includes('sphere') || vt.includes('shar')) filtered.shape = 'sphere';
    else if (vt.includes('cylinder')) filtered.shape = 'cylinder';
    else if (vt.includes('cone')) filtered.shape = 'cone';
    else if (vt.includes('pyramid')) filtered.shape = 'pyramid';
    else filtered.shape = 'cube';
  } else if (engine === 'plotly2d' && !filtered.expression) {
    filtered.expression = 'x';
  } else if (engine === 'plotly3d' && !filtered.expression_z) {
    filtered.expression_z = 'x + y';
  } else if (engine === 'mermaid' && !filtered.diagram) {
    filtered.diagram = 'graph TD\nA-->B';
  }

  if (engine === 'svg2d' && filtered.kind === 'illustration' && !filtered.svg_data) {
    const textToScan = `${topic || ''} ${visualType || ''}`;
    const intent = extractObjectIntent(textToScan);
    if (intent && (intent.name_uz || intent.name_en)) {
      if (!filtered.object_name_uz) filtered.object_name_uz = intent.name_uz;
      if (!filtered.object_name_en) filtered.object_name_en = intent.name_en;
      const proc = generateProceduralObjectSvg(intent.name_en, intent.name_uz);
      if (proc) {
        filtered.svg_data = proc.svg_data;
        filtered.svg_viewbox = proc.viewBox;
        filtered.object_parts = proc.parts_uz;
      }
    }
  }

  if (JSON.stringify(filtered).length > 100_000) return null;

  return filtered as RenderParams;
}

export function mapModalLesson(value: unknown, topic: string): {
  source: 'modal_cache' | 'qwen';
  lesson: TutorLesson;
} | null {
  if (!isRecord(value)) return null;
  const rawSource = typeof value.source === 'string' ? value.source.toLowerCase() : '';
  const source: 'modal_cache' | 'qwen' =
    rawSource === 'modal_cache' || rawSource === 'cache'
      ? 'modal_cache'
      : 'qwen';

  const rawLesson = value.lesson;
  if (!isRecord(rawLesson)) return null;
  const lessonTitle = typeof rawLesson.title === 'string'
    ? rawLesson.title
    : rawLesson.topic_title;
  if (!boundedString(lessonTitle, 1, 200)) return null;
  if (!Array.isArray(rawLesson.steps) || rawLesson.steps.length < 1 || rawLesson.steps.length > 20) {
    return null;
  }

  const steps: TutorLesson['steps'] = [];
  let engine: EngineType | null = null;
  for (const rawStep of rawLesson.steps) {
    if (!isRecord(rawStep)) return null;
    const stepNum = Number(rawStep.step_number);
    const stepTitle =
      typeof rawStep.board_title === 'string' && rawStep.board_title.trim().length > 0
        ? rawStep.board_title.trim()
        : typeof rawStep.step_title === 'string' && rawStep.step_title.trim().length > 0
          ? rawStep.step_title.trim()
          : typeof rawStep.title === 'string' && rawStep.title.trim().length > 0
            ? rawStep.title.trim()
            : `Qadam ${stepNum || 1}`;

    const visualData = isRecord(rawStep.visual_data)
      ? rawStep.visual_data
      : isRecord(rawStep.render_params)
        ? rawStep.render_params
        : {};

    const speechText =
      typeof rawStep.speech_text === 'string' && rawStep.speech_text.trim().length > 0
        ? rawStep.speech_text.trim()
        : typeof rawStep.explanation_uz === 'string' && rawStep.explanation_uz.trim().length > 0
          ? rawStep.explanation_uz.trim()
          : stepTitle;

    const rawLatex = typeof rawStep.latex === 'string'
      ? rawStep.latex.trim()
      : Array.isArray(rawStep.katex_formulas) &&
          typeof rawStep.katex_formulas[0] === 'string'
        ? rawStep.katex_formulas[0].trim()
        : '';
    const latexText = rawLatex.length > 0 ? rawLatex : undefined;

    const visualType =
      typeof rawStep.visual_type === 'string' && rawStep.visual_type.trim().length > 0
        ? rawStep.visual_type.trim()
        : 'illustration';

    if (
      !Number.isSafeInteger(stepNum) ||
      stepNum < 1 ||
      !boundedString(stepTitle, 1, 200) ||
      !boundedString(visualType, 1, 80) ||
      !boundedString(speechText, 1, 4000) ||
      (latexText !== undefined && !boundedString(latexText, 1, 4000))
    ) {
      return null;
    }

    const currentEngine = resolveEngine(visualType, visualData);
    if (!currentEngine) return null;
    if (!engine) engine = currentEngine;

    const renderParams = mapRenderParams(visualData, currentEngine, visualType, topic);
    if (!renderParams) return null;

    steps.push({
      step_number: stepNum,
      step_title: stepTitle,
      speech_text: speechText,
      katex_formulas: latexText ? [latexText] : [],
      explanation_uz: speechText,
      emoji_emotion: 'explaining',
      render_params: renderParams,
    });
  }

  return {
    source,
    lesson: {
      topic_title: lessonTitle,
      subject: mapSubject(topic),
      engine: engine || 'svg2d',
      source: source === 'qwen' ? 'qwen-director' : 'cache',
      sliders: [],
      steps,
    },
  };
}
