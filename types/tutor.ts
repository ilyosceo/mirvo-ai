export type SubjectType =
  | 'math'
  | 'geometry'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'language';

export type EngineType =
  | 'plotly3d'
  | 'plotly2d'
  | 'threejs'
  | 'pdb'
  | 'pubchem'
  | 'mermaid'
  | 'svg2d';

export type EmojiEmotion =
  | 'explaining'
  | 'thinking'
  | 'happy'
  | 'surprised'
  | 'pointing'
  | 'encouraging';

export interface SliderDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface VectorSpec {
  label: string;
  components: [number, number, number];
  color?: string;
}

export type QuadricTemplate =
  | 'sphere'
  | 'ellipsoid'
  | 'hyperboloid_one_sheet'
  | 'hyperboloid_two_sheets'
  | 'elliptic_cone'
  | 'elliptic_paraboloid'
  | 'hyperbolic_paraboloid'
  | 'elliptic_cylinder'
  | 'hyperbolic_cylinder'
  | 'parabolic_cylinder';

export type QuadricDrawLayer =
  | 'axes'
  | 'wireframe'
  | 'surface'
  | 'equator_ring'
  | 'meridians'
  | 'traces'
  | 'labels';

export type FlowType = 'none' | 'dc' | 'ac' | 'pulse';

export interface Primitive3DItem {
  type: 'cylinder' | 'sphere' | 'cone' | 'box' | 'torus';
  position: [number, number, number];
  rotation?: [number, number, number];
  args: number[];
  color: string;
  opacity?: number;
  roughness?: number;
  label?: string;
  partId?: string;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
}

export interface RenderParams {
  // Three.js stereometry, physics, quadrics, parametric & 3D objects
  shape?:
    | 'pyramid'
    | 'cone'
    | 'prism'
    | 'cylinder'
    | 'sphere'
    | 'cube'
    | 'vectors'
    | 'projectile'
    | 'quadric'
    | 'parametric'
    | 'composite3d'
    | 'svg_extrude';
  template?: QuadricTemplate;
  axis?: 'x' | 'y' | 'z';
  p?: number;
  draw?: QuadricDrawLayer[];
  surface_color?: string;
  parametric_x?: string;
  parametric_y?: string;
  parametric_z?: string;
  u_range?: [number, number];
  v_range?: [number, number];
  base?: number;
  height?: number;
  radius?: number;
  sides?: number;
  cut_ratio?: number;
  highlight?: string[];
  vectors?: VectorSpec[];
  angle_deg?: number;
  velocity?: number;
  show_cross_section?: boolean;
  show_height?: boolean;
  show_apothem?: boolean;
  model_url?: string;
  primitives_3d?: Primitive3DItem[];

  // Plotly 2D / 3D
  expression?: string;
  secondary_expression?: string;
  expression_z?: string;
  x_range?: [number, number];
  y_range?: [number, number];
  show_contours?: boolean;
  derivative?: boolean;
  integral_range?: [number, number];
  equation_roots?: number[];
  highlight_points?: Array<{ x: number; y: number; label: string }>;
  highlights?: Array<{ x: number; y: number; label: string }>;

  // Chemistry PDB / PubChem
  pdb_id?: string;
  compound?: string;
  formula?: string;
  style?: 'cartoon' | 'stick' | 'sphere' | 'surface' | 'ballstick';
  highlight_chain?: string;

  // Mermaid
  diagram?: string;
  highlight_nodes?: string[];

  // SVG 2D Geometry & Smart Object Illustrations
  kind?:
    | 'pythagoras'
    | 'triangle'
    | 'circle'
    | 'unit_circle'
    | 'polygon'
    | 'photosynthesis'
    | 'sky_scattering'
    | 'illustration';
  a?: number;
  b?: number;
  c?: number;
  object_name_uz?: string;
  object_name_en?: string;
  svg_data?: string;
  svg_viewbox?: string;
  object_source?: string;
  object_parts?: Array<{
    label: string;
    partId?: string;
    x?: number;
    y?: number;
    flowType?: FlowType;
    flowSpeed?: number;
    flowReverse?: boolean;
  }>;

  // Dynamic Flow Animation defaults
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
}

export interface LessonQuiz {
  question: string;
  options: string[];
  correct_index: number;
  explanation_uz: string;
}

export type TeacherZone =
  | 'center'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom-right'
  | 'orbit';

export type TeacherDepth = 'near' | 'mid' | 'far';

export type TeacherMotion =
  | 'approach'
  | 'retreat'
  | 'circle'
  | 'point'
  | 'celebrate';

export interface TeacherWaypoint {
  zone: TeacherZone;
  depth: TeacherDepth;
  pause_pct: number;
  note?: string;
}

export interface TeacherCue {
  zone: TeacherZone;
  depth: TeacherDepth;
  motion: TeacherMotion;
  target_label?: string;
  waypoints?: TeacherWaypoint[];
}

export type TutorPose = 'approach' | 'step_back' | 'formula_check';

export interface LessonBeat {
  sentence: string;
  focus_target: string;
  focusPart?: string;
  tutor_pose: TutorPose;
  camera_zoom: number;
  cameraZoom?: number;
  dimInactiveParts?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  note?: string;
}

export interface StageAnchorPoint {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
}

export type StageAnchorsMap = Record<string, StageAnchorPoint>;

export interface LessonStep {
  step_number: number;
  step_title: string;
  speech_text: string;
  katex_formulas: string[];
  live_formula_expressions?: Array<{
    label: string;
    latex_lhs: string;
    expr: string;
    unit?: string;
  }>;
  explanation_uz: string;
  emoji_emotion: EmojiEmotion;
  camera?: [number, number, number];
  focusPart?: string;
  cameraZoom?: number;
  dimInactiveParts?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  teacher_cue?: TeacherCue;
  beats?: LessonBeat[];
  render_params: RenderParams;
  quiz?: LessonQuiz;
}

export interface TokenUsageInfo {
  prompt_tokens: number;
  cached_tokens?: number;
  output_tokens: number;
  thoughts_tokens?: number;
  total_tokens: number;
  cost_usd: number;
  llm_calls?: number;
}

export type LessonDepthMode = 'overview' | 'standard' | 'deep';

export const LESSON_DEPTH_OPTIONS: Array<{
  id: LessonDepthMode;
  label: string;
  rangeLabel: string;
  shortDesc: string;
}> = [
  {
    id: 'overview',
    label: 'Umumiy',
    rangeLabel: '4 dars',
    shortDesc: 'Mavzuni tezkor va umumiy tushuntirish (4 ta qadam)',
  },
  {
    id: 'standard',
    label: 'Standart',
    rangeLabel: '6–8 dars',
    shortDesc: 'Savolga qarab 6 tadan 8 tagacha muvozanatli dars',
  },
  {
    id: 'deep',
    label: 'Chuqur',
    rangeLabel: '10–12+ dars',
    shortDesc: '10–12+ qadamli o‘ta chuqur va 99% to‘liq akademik tahlil',
  },
];

export interface TutorLesson {
  id?: string;
  topic_title: string;
  subject: SubjectType;
  engine: EngineType;
  depth_mode?: LessonDepthMode;
  source?: 'local-parser' | 'cache' | 'gemini-director';
  latency_ms?: number;
  token_usage?: TokenUsageInfo;
  keywords?: string[];
  sliders: SliderDef[];
  steps: LessonStep[];
}

export interface ResolveResponse {
  lesson: TutorLesson;
  stage: 'local-parser' | 'cache' | 'gemini-director';
  latency_ms: number;
  token_usage?: TokenUsageInfo;
}

export const SUBJECT_LABELS_UZ: Record<SubjectType, string> = {
  math: 'Matematika',
  geometry: 'Geometriya',
  physics: 'Fizika',
  chemistry: 'Kimyo',
  biology: 'Biologiya',
  history: 'Tarix',
  language: 'Ona tili',
};

export const ENGINE_LABELS_UZ: Record<EngineType, string> = {
  threejs: 'Three.js 3D Sahna',
  plotly2d: 'Plotly 2D Grafik',
  plotly3d: 'Plotly 3D Sirt',
  pdb: '3Dmol PDB Oqsil',
  pubchem: '3Dmol PubChem',
  mermaid: 'Mermaid Blok-Sxema',
  svg2d: 'Aniq 2D Geometriya',
};

export interface ResolvedObjectPayload {
  name_uz: string;
  name_en: string;
  svg_data: string;
  viewBox: string;
  source: 'cache' | 'iconify' | 'wikimedia' | 'procedural' | 'gemini-svg' | 'poly-pizza';
  original_source?: string;
  mode: '2d' | '3d';
  model_url?: string;
  primitives_3d?: Primitive3DItem[];
  parts_uz?: Array<{ label: string; partId?: string; desc?: string }>;
  from_cache: boolean;
  latency_ms: number;
  token_usage?: TokenUsageInfo;
}
