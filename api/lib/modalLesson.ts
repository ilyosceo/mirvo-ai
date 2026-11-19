import type {
  EngineType,
  RenderParams,
  SubjectType,
  TutorLesson,
} from '../../types/tutor';

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
  'flowReverse',
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
  return null;
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

function mapRenderParams(data: Record<string, unknown>): RenderParams | null {
  const nested = data.render_params;
  const source = nested === undefined ? data : nested;
  if (!isRecord(source)) return null;

  const keys = Object.keys(source);
  if (keys.some((key) => !RENDER_PARAM_KEYS.has(key as keyof RenderParams))) return null;
  if (JSON.stringify(source).length > 100_000) return null;

  return source as RenderParams;
}

export function mapModalLesson(value: unknown, topic: string): {
  source: 'modal_cache' | 'qwen';
  lesson: TutorLesson;
} | null {
  if (!isRecord(value) || (value.source !== 'modal_cache' && value.source !== 'qwen')) return null;
  const rawLesson = value.lesson;
  if (!isRecord(rawLesson) || !boundedString(rawLesson.title, 1, 200)) return null;
  if (!Array.isArray(rawLesson.steps) || rawLesson.steps.length < 1 || rawLesson.steps.length > 20) {
    return null;
  }

  const steps: TutorLesson['steps'] = [];
  let engine: EngineType | null = null;
  for (const rawStep of rawLesson.steps) {
    if (
      !isRecord(rawStep) ||
      !Number.isSafeInteger(rawStep.step_number) ||
      Number(rawStep.step_number) < 1 ||
      !boundedString(rawStep.board_title, 1, 200) ||
      !boundedString(rawStep.visual_type, 1, 80) ||
      !isRecord(rawStep.visual_data) ||
      !boundedString(rawStep.speech_text, 1, 4000) ||
      (rawStep.latex !== undefined && !boundedString(rawStep.latex, 1, 4000))
    ) {
      return null;
    }

    const currentEngine = resolveEngine(rawStep.visual_type, rawStep.visual_data);
    const renderParams = mapRenderParams(rawStep.visual_data);
    if (!currentEngine || !renderParams || (engine && engine !== currentEngine)) return null;
    engine = currentEngine;

    steps.push({
      step_number: Number(rawStep.step_number),
      step_title: rawStep.board_title,
      speech_text: rawStep.speech_text,
      katex_formulas: rawStep.latex ? [rawStep.latex] : [],
      explanation_uz: rawStep.speech_text,
      emoji_emotion: 'explaining',
      render_params: renderParams,
    });
  }

  return {
    source: value.source,
    lesson: {
      topic_title: rawLesson.title,
      subject: mapSubject(topic),
      engine: engine || 'svg2d',
      source: value.source === 'qwen' ? 'qwen-director' : 'cache',
      sliders: [],
      steps,
    },
  };
}
