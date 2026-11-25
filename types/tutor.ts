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
  | 'zdog'
  | 'pixi'
  | 'konva'
  | 'mafs'
  | 'jsxgraph'
  | 'rapier2d'
  | 'matter'
  | 'pdb'
  | 'pubchem'
  | 'rdkit'
  | 'cytoscape'
  | 'xyflow'
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

export type PartAnimationType =
  | 'none'
  | 'spin'
  | 'spin_reverse'
  | 'oscillate_y'
  | 'oscillate_x'
  | 'pulse_scale'
  | 'orbit';

export type VisualType =
  | 'custom_2d_svg'
  | 'custom_3d_scene'
  | 'object_2d'
  | 'object_3d'
  | 'pythagoras'
  | 'triangle'
  | 'circle'
  | 'unit_circle'
  | 'polygon'
  | 'photosynthesis'
  | 'sky_scattering'
  | 'illustration'
  | 'plotly2d'
  | 'plotly3d'
  | 'mermaid'
  | 'threejs';

export interface Custom2DSvgLabel {
  text: string;
  x: number;
  y: number;
  color?: string;
  partId?: string;
}

export interface Custom2DSvgHighlight {
  x: number;
  y: number;
  r?: number;
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  partId?: string;
}

export interface Custom2DSvgData {
  svg?: string;
  viewBox?: string;
  labels?: Custom2DSvgLabel[];
  highlights?: Custom2DSvgHighlight[];
}

export type Extended3DPrimitiveType =
  | 'box'
  | 'rounded_box'
  | 'cylinder'
  | 'capsule'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'ring'
  | 'octahedron'
  | 'dodecahedron'
  | 'tube'
  | 'lathe'
  | 'gear'
  | 'coil'
  | 'helical_coil'
  | 'turbine_runner'
  | 'impeller'
  | 'dial_gauge';

export interface Custom3DObject {
  type: Extended3DPrimitiveType | 'vector' | 'arrow' | 'axis' | 'plane';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  args?: number[];
  points?: [number, number, number][];
  profile?: [number, number][];
  from?: [number, number, number];
  to?: [number, number, number];
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  clearcoat?: number;
  explodeOffset?: [number, number, number];
  label?: string;
  partId?: string;
  animation?: PartAnimationType;
  animationAxis?: 'x' | 'y' | 'z';
  animationSpeed?: number;
  animationAmp?: number;
  animationPivot?: [number, number, number];
}

export interface Custom3DSceneData {
  objects?: Custom3DObject[];
  showAxes?: boolean;
  title?: string;
}

export interface Primitive3DItem {
  id?: string;
  type: Extended3DPrimitiveType;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  args: number[];
  points?: [number, number, number][];
  profile?: [number, number][];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  clearcoat?: number;
  explodeOffset?: [number, number, number];
  label?: string;
  partId?: string;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  animation?: PartAnimationType;
  animationAxis?: 'x' | 'y' | 'z';
  animationSpeed?: number;
  animationAmp?: number;
  animationPivot?: [number, number, number];
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
    | 'svg_extrude'
    | 'custom_3d_scene';
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
  custom_3d_objects?: Custom3DObject[];
  show_axes?: boolean;

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

  // SVG 2D Geometry & Smart Object Illustrations & Custom Video 2D SVG
  kind?:
    | 'pythagoras'
    | 'triangle'
    | 'circle'
    | 'unit_circle'
    | 'polygon'
    | 'photosynthesis'
    | 'sky_scattering'
    | 'illustration'
    | 'custom_2d_svg'
    | 'physics_sim';
  physics_preset?: 'pendulum' | 'incline' | 'collision' | 'lever' | 'hydraulic' | 'spring';
  smiles?: string;
  a?: number;
  b?: number;
  c?: number;
  object_name_uz?: string;
  object_name_en?: string;
  svg_data?: string;
  svg_viewbox?: string;
  object_source?: string;
  custom_svg?: Custom2DSvgData;
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

export interface OpenQuestionDef {
  question: string;
  expected_points?: string;
  hint_uz?: string;
}

export interface CheckAnswerRequest {
  lessonTitle: string;
  stepTitle: string;
  stepExplanation: string;
  formulas?: string[];
  question: string;
  expectedPoints?: string;
  userAnswer: string;
}

export interface CheckAnswerResponse {
  passed: boolean;
  score: number;
  feedback_uz: string;
  hint_uz?: string;
  token_usage?: TokenUsageInfo;
}

export interface StepEvaluationInput {
  stepIndex: number;
  stepTitle: string;
  question: string;
  expectedPoints?: string;
  stepExplanation?: string;
  formulas?: string[];
  userAnswer: string;
}

export interface StepEvaluationResult {
  stepIndex: number;
  stepTitle: string;
  question: string;
  userAnswer: string;
  score: number;
  passed: boolean;
  correct_answer_uz: string;
  feedback_uz: string;
}

export interface EvaluateLessonResponse {
  overall_percent: number;
  steps: StepEvaluationResult[];
  summary_speech_uz: string;
  token_usage?: TokenUsageInfo;
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
  visual_type?: VisualType | string;
  visual_data?: Record<string, unknown>;
  board_title?: string;
  latex?: string;
  quiz?: LessonQuiz;
  open_question?: OpenQuestionDef;
}

export interface TokenUsageInfo {
  prompt_tokens: number;
  cached_tokens?: number;
  output_tokens: number;
  thoughts_tokens?: number;
  total_tokens: number;
  cost_usd: number;
  llm_calls?: number;
  model?: string;
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

export interface SceneArchitecturePlan {
  version: string;
  render_mode: '3d_webgl' | '2d_svg';
  query_normalized: string;
  subjects: Array<{ id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }>;
  shared_parameter: string | null;
  layout: 'linked' | 'parallel';
  device_tier: 'low' | 'mid' | 'high';
  libs: Array<{ id: string; load: 'core' | 'lazy' | 'native'; kb: number; reason: string }>;
  estimated_lazy_kb: number;
  primitives: Array<{ id: string; subject: string; count: number; instancing: boolean; lod: 'none' | 'decimate' | 'cluster' | 'sample' | 'slice_only' }>;
  budget: { draw_calls: number; triangles: number; dpr: number; shadows: boolean; antialias: boolean; postfx: boolean | string; frameloop: 'demand' | 'always' };
  merged_lines: boolean;
  workers: Array<{ task: string; est_ms: number }>;
  engineering_constraints: { equations: string[]; grid_freq_hz: number; units: string[] };
  mode: 'schematic' | 'accurate';
  controls: Array<{ param: string; label_uz: string; unit: string; min: number; max: number; step: number; default: number; affects: string[] }>;
  camera: { type: 'orbit' | 'path' | 'top' | '2d_flat'; distance: number };
  labels_locale: 'uz';
  downgrades: Array<{ from: string; to: string; reason: string }>;
  license_rejections: Array<{ requested: string; replacement: string }>;
  unsupported_requests: string[];
  fallback: { tier: string; svg_fallback: boolean; strategy: string };
  needs_clarification: boolean;
  clarifying_question: string | null;
  confirm_chips: string[];
  builder_rules: string[];
  self_check: { ids_valid: boolean; within_budget: boolean; libs_minimal: boolean; license_clean: boolean };
}

export interface TutorLesson {
  id?: string;
  topic_title: string;
  subject: SubjectType;
  engine: EngineType;
  depth_mode?: LessonDepthMode;
  requested_steps?: number;
  source?: 'local-parser' | 'cache' | 'gemini-director' | 'qwen-omni' | 'modal-backend' | 'video-lesson';
  latency_ms?: number;
  token_usage?: TokenUsageInfo;
  keywords?: string[];
  sliders: SliderDef[];
  steps: LessonStep[];
  scenePlan?: SceneArchitecturePlan;
}

export interface ResolveResponse {
  lesson: TutorLesson;
  stage: 'local-parser' | 'cache' | 'gemini-director' | 'qwen-omni' | 'modal-backend' | 'video-lesson';
  latency_ms: number;
  token_usage?: TokenUsageInfo;
  scenePlan?: SceneArchitecturePlan;
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
  threejs: 'Three.js WebGL 3D (PBR)',
  zdog: 'Zdog 2.5D Hajmli',
  pixi: 'PixiJS v8 2D/2.5D',
  konva: 'Konva Interaktiv Doska',
  mafs: 'Mafs 2D Matematika',
  jsxgraph: 'JSXGraph Geometriya',
  rapier2d: 'Rapier2D Fizika',
  matter: 'Matter.js Mexanika',
  plotly2d: 'Plotly 2D Grafik',
  plotly3d: 'Plotly 2.5D Sirt',
  pdb: '2D Biomolekula',
  pubchem: 'SmilesDrawer 2D Kimyo',
  rdkit: 'RDKit 2D Xeminformatika',
  cytoscape: 'Cytoscape Biograf',
  xyflow: 'React Flow Sxema',
  mermaid: 'Mermaid Blok-Sxema',
  svg2d: 'Aniq 2D Chizma',
};

export interface ResolvedObjectPayload {
  name_uz: string;
  name_en: string;
  svg_data: string;
  viewBox: string;
  source: 'cache' | 'iconify' | 'wikimedia' | 'procedural' | 'gemini-svg' | 'poly-pizza' | 'poly-haven' | 'open-gltf';
  original_source?: string;
  mode: '2d' | '3d';
  model_url?: string;
  primitives_3d?: Primitive3DItem[];
  parts_uz?: Array<{ label: string; partId?: string; desc?: string }>;
  from_cache: boolean;
  latency_ms: number;
  token_usage?: TokenUsageInfo;
}
