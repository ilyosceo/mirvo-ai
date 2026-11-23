import {
  extractObjectIntent,
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
  generateZeroTokenFallbackSvg,
  sanitizeSvgString,
} from '../lib/objectCatalog.js';
import type {
  Custom2DSvgHighlight,
  Custom2DSvgLabel,
  Custom3DObject,
  EmojiEmotion,
  EngineType,
  LessonBeat,
  LessonQuiz,
  LessonStep,
  Primitive3DItem,
  RenderParams,
  SliderDef,
  SubjectType,
  TokenUsageInfo,
  TutorLesson,
  TutorPose,
} from '../types/tutor.js';

const VALID_SUBJECTS: readonly SubjectType[] = [
  'math',
  'geometry',
  'physics',
  'chemistry',
  'biology',
  'history',
  'language',
];

const VALID_ENGINES: readonly EngineType[] = [
  'threejs',
  'plotly2d',
  'plotly3d',
  'pdb',
  'pubchem',
  'mermaid',
  'svg2d',
];

const VALID_EMOTIONS: readonly EmojiEmotion[] = [
  'explaining',
  'thinking',
  'happy',
  'surprised',
  'pointing',
  'encouraging',
];

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.trim() : fallback;
}

function asNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asVec3(val: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(val) && val.length >= 3) {
    const x = asNumber(val[0], fallback[0]);
    const y = asNumber(val[1], fallback[1]);
    const z = asNumber(val[2], fallback[2]);
    return [x, y, z];
  }
  return fallback;
}

function asNumArray(val: unknown): number[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const nums = val.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  return nums.length > 0 ? nums : undefined;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Ensures TTS speech_text contains natural spoken Uzbek words without raw LaTeX/math symbols.
 */
export function sanitizeSpeechTextUz(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\$([^$]+)\$/g, ' $1 ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 bo‘lingan $2')
    .replace(/\\sqrt\{([^}]+)\}/g, '$1 ning kvadrat ildizi')
    .replace(/\\times/g, ' ko‘paytirilgan ')
    .replace(/\\cdot/g, ' ko‘paytirilgan ')
    .replace(/\\div/g, ' bo‘lingan ')
    .replace(/\\pi/g, ' pi ')
    .replace(/\\alpha/g, ' alfa ')
    .replace(/\\beta/g, ' beta ')
    .replace(/\\gamma/g, ' gamma ')
    .replace(/\\theta/g, ' teta ')
    .replace(/\\Delta/g, ' delta ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/²/g, ' kvadrat')
    .replace(/³/g, ' kub')
    .replace(/\^2\b/g, ' kvadrat')
    .replace(/\^3\b/g, ' kub')
    .replace(/≥/g, ' katta yoki teng ')
    .replace(/≤/g, ' kichik yoki teng ')
    .replace(/≠/g, ' teng emas ')
    .replace(/≈/g, ' taxminan teng ')
    .replace(/×/g, ' ko‘paytirilgan ')
    .replace(/÷/g, ' bo‘lingan ')
    .replace(/√/g, ' ildiz ')
    .replace(/π/g, ' pi ')
    .replace(/\s*=\s*/g, ' teng ')
    .replace(/\s*\+\s*/g, ' qo‘shilgan ')
    .replace(/\s*\/\s*/g, ' bo‘lingan ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text && !/[.!?]$/.test(text)) {
    text += '.';
  }
  return text;
}

function normalizeSubject(raw: unknown, topicHint = ''): SubjectType {
  const s = asString(raw).toLowerCase() as SubjectType;
  if (VALID_SUBJECTS.includes(s)) return s;
  const hint = `${s} ${topicHint}`.toLowerCase();
  if (/fizik|kuch|tok|transformator|bosim|gidravlik|tebranish|optik|mexanik|energiya/.test(hint)) {
    return 'physics';
  }
  if (/kimyo|molekul|reaksiya|atom|kislota|oksid/.test(hint)) return 'chemistry';
  if (/biolog|hujayra|dnk|fotosintez|yurak|o‘simlik|organizm/.test(hint)) return 'biology';
  if (/geometr|uchburchak|aylana|piramida|konus|silindr|kub|pifagor|vektor/.test(hint)) {
    return 'geometry';
  }
  if (/tarix|asar|imperiya|davlat/.test(hint)) return 'history';
  if (/til|grammatika|so‘z|adabiyot/.test(hint)) return 'language';
  return 'math';
}

function normalizeEmotion(raw: unknown): EmojiEmotion {
  const e = asString(raw).toLowerCase() as EmojiEmotion;
  return VALID_EMOTIONS.includes(e) ? e : 'explaining';
}

function normalizeCustomLabels(raw: unknown): Custom2DSvgLabel[] {
  if (!Array.isArray(raw)) return [];
  const out: Custom2DSvgLabel[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    const text = asString(rec.text || rec.label);
    if (!text) continue;
    out.push({
      text,
      x: asNumber(rec.x, 300),
      y: asNumber(rec.y, 180),
      color: asString(rec.color) || undefined,
      partId: asString(rec.partId) || undefined,
    });
  }
  return out;
}

function normalizeCustomHighlights(raw: unknown): Custom2DSvgHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: Custom2DSvgHighlight[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    out.push({
      x: asNumber(rec.x, 300),
      y: asNumber(rec.y, 180),
      r: rec.r !== undefined ? asNumber(rec.r, 24) : undefined,
      width: rec.width !== undefined ? asNumber(rec.width, 60) : undefined,
      height: rec.height !== undefined ? asNumber(rec.height, 40) : undefined,
      color: asString(rec.color) || '#F59E0B',
      label: asString(rec.label) || undefined,
      partId: asString(rec.partId) || undefined,
    });
  }
  return out;
}

function synthesizeCustom2DFallbackSvg(
  title: string,
  labels: Custom2DSvgLabel[],
  highlights: Custom2DSvgHighlight[]
): { svg_data: string; viewBox: string } {
  const safeTitle = escapeXml(title || 'Diagramma').slice(0, 48);
  const labelNodes = labels
    .slice(0, 8)
    .map(
      (lbl, idx) =>
        `<g data-part="${idx}" data-part-id="${escapeXml(lbl.partId || `part_${idx}`)}">
          <circle cx="${Math.max(40, Math.min(560, lbl.x))}" cy="${Math.max(40, Math.min(320, lbl.y))}" r="18" fill="#EFF6FF" stroke="${escapeXml(lbl.color || '#2563EB')}" stroke-width="2.5"/>
          <text x="${Math.max(40, Math.min(560, lbl.x))}" y="${Math.max(40, Math.min(320, lbl.y)) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#0F172A">${escapeXml(lbl.text.slice(0, 24))}</text>
        </g>`
    )
    .join('\n');

  const hlNodes = highlights
    .slice(0, 6)
    .map(
      (hl) =>
        `<circle cx="${Math.max(40, Math.min(560, hl.x))}" cy="${Math.max(40, Math.min(320, hl.y))}" r="${Math.max(12, Math.min(80, hl.r ?? 26))}" fill="none" stroke="${escapeXml(hl.color || '#F59E0B')}" stroke-width="2.5" stroke-dasharray="6 4"/>`
    )
    .join('\n');

  const fallbackCenter =
    labelNodes ||
    `<rect x="130" y="95" width="340" height="170" rx="16" fill="#EFF6FF" stroke="#2563EB" stroke-width="3"/>
     <path d="M 170 215 L 265 140 L 345 185 L 430 125" fill="none" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
     <text x="300" y="298" text-anchor="middle" font-size="14" font-weight="700" fill="#1E293B">${safeTitle}</text>`;

  return {
    viewBox: '0 0 600 360',
    svg_data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">
  <rect x="20" y="20" width="560" height="320" rx="18" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <text x="300" y="54" text-anchor="middle" font-size="16" font-weight="700" fill="#0F172A">${safeTitle}</text>
  ${fallbackCenter}
  ${hlNodes}
</svg>`,
  };
}

function ensureSvgHasPartIds(
  svgData: string,
  labels: Custom2DSvgLabel[]
): string {
  if (!svgData || /data-part-id=/i.test(svgData)) return svgData;
  let idx = 0;
  return svgData.replace(/<g(\s|>)/gi, (match, sep) => {
    const partId = labels[idx]?.partId || `part_${idx}`;
    idx += 1;
    return `<g data-part-id="${escapeXml(partId)}"${sep}`;
  });
}

function buildObjectPartsFromLabelsAndObjects(
  labels: Custom2DSvgLabel[],
  objects?: Custom3DObject[]
): RenderParams['object_parts'] {
  const parts: NonNullable<RenderParams['object_parts']> = [];
  const seen = new Set<string>();

  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    const pid = lbl.partId || `part_${i}`;
    if (seen.has(pid)) continue;
    seen.add(pid);
    parts.push({ label: lbl.text, partId: pid });
  }

  if (objects) {
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const pid = obj.partId || `part_${i}`;
      if (seen.has(pid) || !obj.label) continue;
      seen.add(pid);
      parts.push({ label: obj.label, partId: pid });
    }
  }

  return parts.length > 0 ? parts : undefined;
}

function normalizeCustom3DObjects(raw: unknown): Custom3DObject[] {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set([
    'box',
    'cylinder',
    'sphere',
    'cone',
    'torus',
    'vector',
    'arrow',
    'axis',
    'plane',
  ]);
  const out: Custom3DObject[] = [];
  for (let i = 0; i < raw.length; i++) {
    const rec = asRecord(raw[i]);
    const rawType = asString(rec.type, 'box').toLowerCase();
    const objType = (validTypes.has(rawType) ? rawType : 'box') as Custom3DObject['type'];
    const pos = asVec3(rec.position, [0, 1, 0]);
    const rot = rec.rotation ? asVec3(rec.rotation, [0, 0, 0]) : undefined;
    const args = asNumArray(rec.args);
    const from = rec.from ? asVec3(rec.from, [0, 0, 0]) : undefined;
    const to = rec.to ? asVec3(rec.to, [1, 1, 0]) : undefined;
    let scale: Custom3DObject['scale'];
    if (Array.isArray(rec.scale) && rec.scale.length >= 3) {
      scale = asVec3(rec.scale, [1, 1, 1]);
    } else if (typeof rec.scale === 'number' && Number.isFinite(rec.scale)) {
      scale = rec.scale;
    }

    out.push({
      type: objType,
      position: pos,
      rotation: rot,
      scale,
      args,
      from,
      to,
      color: asString(rec.color) || '#2563EB',
      opacity: rec.opacity !== undefined ? Math.max(0.1, Math.min(1, asNumber(rec.opacity, 1))) : 1,
      roughness:
        rec.roughness !== undefined
          ? Math.max(0.05, Math.min(1, asNumber(rec.roughness, 0.4)))
          : 0.4,
      label: asString(rec.label) || undefined,
      partId: asString(rec.partId) || `part_${i}`,
    });
  }
  return out;
}

function custom3DObjectsToPrimitives(objects: Custom3DObject[]): Primitive3DItem[] {
  const prims: Primitive3DItem[] = [];
  for (const obj of objects) {
    if (
      obj.type === 'box' ||
      obj.type === 'cylinder' ||
      obj.type === 'sphere' ||
      obj.type === 'cone' ||
      obj.type === 'torus'
    ) {
      prims.push({
        type: obj.type,
        position: obj.position || [0, 1, 0],
        rotation: obj.rotation,
        args:
          obj.args ||
          (obj.type === 'box'
            ? [1, 1, 1]
            : obj.type === 'cylinder'
            ? [0.45, 0.45, 1.5, 20]
            : obj.type === 'sphere'
            ? [0.7, 20, 20]
            : obj.type === 'cone'
            ? [0.8, 1.6, 20]
            : [0.8, 0.2, 12, 24]),
        color: obj.color || '#2563EB',
        opacity: obj.opacity ?? 1,
        roughness: obj.roughness ?? 0.4,
        label: obj.label,
        partId: obj.partId,
      });
    }
  }
  return prims;
}

function normalizeQuiz(raw: unknown): LessonQuiz | undefined {
  const rec = asRecord(raw);
  const question = asString(rec.question);
  const options = Array.isArray(rec.options)
    ? rec.options.map((o) => asString(o)).filter(Boolean)
    : [];
  if (!question || options.length < 2) return undefined;
  const idx = Math.max(0, Math.min(options.length - 1, Math.round(asNumber(rec.correct_index, 0))));
  return {
    question,
    options,
    correct_index: idx,
    explanation_uz:
      asString(rec.explanation_uz) || "To'g'ri javob yuqoridagi asosiy qoidaga tayanadi.",
  };
}

function normalizeStepVisual(
  rawStep: Record<string, unknown>,
  topicTitle: string,
  defaultEngine: EngineType,
  stepTitle: string
): { engineHint: EngineType; renderParams: RenderParams } {
  const existingRp = asRecord(rawStep.render_params) as Partial<RenderParams>;
  const visualType = asString(
    rawStep.visual_type || existingRp.kind || existingRp.shape || ''
  ).toLowerCase();
  const visualData = asRecord(rawStep.visual_data);

  // 0. Interactive 2D physics simulation (matter-js)
  if (visualType === 'physics_sim' || existingRp.kind === 'physics_sim') {
    const rawPreset = asString(
      visualData.physics_preset || existingRp.physics_preset || 'pendulum'
    ).toLowerCase();
    const validPresets = new Set([
      'pendulum',
      'incline',
      'collision',
      'lever',
      'hydraulic',
      'spring',
    ]);
    const preset = (
      validPresets.has(rawPreset) ? rawPreset : 'pendulum'
    ) as RenderParams['physics_preset'];
    return {
      engineHint: 'svg2d',
      renderParams: {
        ...existingRp,
        kind: 'physics_sim',
        physics_preset: preset,
        object_name_uz: asString(visualData.title || existingRp.object_name_uz || stepTitle),
      },
    };
  }

  // 1. Custom 2D SVG (Video-to-2D or explicit SVG payload)
  const rawSvgStr = asString(
    visualData.svg || visualData.svg_data || existingRp.svg_data || existingRp.custom_svg?.svg
  );
  if (visualType === 'custom_2d_svg' || (!visualType && rawSvgStr)) {
    const labels = normalizeCustomLabels(visualData.labels ?? existingRp.custom_svg?.labels).map(
      (lbl, idx) => ({
        ...lbl,
        partId: lbl.partId || `part_${idx}`,
      })
    );
    const highlights = normalizeCustomHighlights(
      visualData.highlights ?? existingRp.custom_svg?.highlights
    );
    const sanitized = rawSvgStr ? sanitizeSvgString(rawSvgStr) : null;
    const svgResult =
      sanitized || synthesizeCustom2DFallbackSvg(stepTitle || topicTitle, labels, highlights);
    const taggedSvg = ensureSvgHasPartIds(svgResult.svg_data, labels);
    const viewBox = asString(visualData.viewBox) || svgResult.viewBox || '0 0 600 360';
    const objectParts =
      existingRp.object_parts || buildObjectPartsFromLabelsAndObjects(labels);

    return {
      engineHint: 'svg2d',
      renderParams: {
        ...existingRp,
        kind: 'custom_2d_svg',
        svg_data: taggedSvg,
        svg_viewbox: viewBox,
        object_name_uz: asString(visualData.title || existingRp.object_name_uz || stepTitle),
        object_parts: objectParts,
        custom_svg: {
          svg: taggedSvg,
          viewBox,
          labels,
          highlights,
        },
      },
    };
  }

  // 2. Custom 3D Scene (Video-to-3D or explicit 3D objects array)
  const rawObjects = visualData.objects ?? existingRp.custom_3d_objects;
  if (visualType === 'custom_3d_scene' || (Array.isArray(rawObjects) && rawObjects.length > 0)) {
    let customObjs = normalizeCustom3DObjects(rawObjects);
    if (customObjs.length === 0) {
      const proc3d =
        generateProceduralPrimitives3D(topicTitle) ||
        generateProceduralPrimitives3D(stepTitle) || [
          {
            type: 'box' as const,
            position: [0, 1, 0] as [number, number, number],
            args: [1.8, 1.2, 1.4],
            color: '#2563EB',
            label: stepTitle || 'Model',
            partId: 'part_0',
          },
        ];
      customObjs = proc3d.map((p) => ({
        type: p.type,
        position: p.position,
        rotation: p.rotation,
        args: p.args,
        color: p.color,
        opacity: p.opacity,
        roughness: p.roughness,
        label: p.label,
        partId: p.partId,
      }));
    }
    const objectParts =
      existingRp.object_parts || buildObjectPartsFromLabelsAndObjects([], customObjs);
    return {
      engineHint: 'threejs',
      renderParams: {
        ...existingRp,
        shape: 'custom_3d_scene',
        custom_3d_objects: customObjs,
        primitives_3d: custom3DObjectsToPrimitives(customObjs),
        object_parts: objectParts,
        show_axes: visualData.showAxes !== undefined ? Boolean(visualData.showAxes) : true,
        object_name_uz: asString(visualData.title || existingRp.object_name_uz || stepTitle),
      },
    };
  }

  // 3. Built-in 2D SVG geometry / science templates
  if (
    visualType === 'pythagoras' ||
    visualType === 'triangle' ||
    visualType === 'circle' ||
    visualType === 'unit_circle' ||
    visualType === 'polygon' ||
    visualType === 'photosynthesis' ||
    visualType === 'sky_scattering'
  ) {
    return {
      engineHint: 'svg2d',
      renderParams: {
        ...existingRp,
        kind: visualType,
        a: visualData.a !== undefined ? asNumber(visualData.a, 3) : existingRp.a,
        b: visualData.b !== undefined ? asNumber(visualData.b, 4) : existingRp.b,
        c: visualData.c !== undefined ? asNumber(visualData.c, 5) : existingRp.c,
        radius:
          visualData.radius !== undefined ? asNumber(visualData.radius, 5) : existingRp.radius,
        sides: visualData.sides !== undefined ? asNumber(visualData.sides, 6) : existingRp.sides,
        angle_deg:
          visualData.angle_deg !== undefined
            ? asNumber(visualData.angle_deg, 60)
            : existingRp.angle_deg,
      },
    };
  }

  // 4. Built-in 3D stereometry / physics / quadric shapes
  if (
    visualType === 'threejs' ||
    visualType === 'pyramid' ||
    visualType === 'cone' ||
    visualType === 'prism' ||
    visualType === 'cylinder' ||
    visualType === 'sphere' ||
    visualType === 'cube' ||
    visualType === 'vectors' ||
    visualType === 'quadric' ||
    visualType === 'composite3d' ||
    visualType === 'object_3d'
  ) {
    const primitives = Array.isArray(visualData.primitives_3d)
      ? (visualData.primitives_3d as Primitive3DItem[])
      : existingRp.primitives_3d;

    const candidateName =
      asString(visualData.object_name_en || visualData.object || existingRp.object_name_en) ||
      topicTitle;

    if (
      visualType === 'composite3d' ||
      visualType === 'object_3d' ||
      (primitives && primitives.length > 0)
    ) {
      const resolvedPrims =
        primitives && primitives.length > 0
          ? primitives
          : generateProceduralPrimitives3D(candidateName) ||
            generateProceduralPrimitives3D(extractObjectIntent(candidateName).name_en);

      if (resolvedPrims && resolvedPrims.length > 0) {
        return {
          engineHint: 'threejs',
          renderParams: {
            ...existingRp,
            shape: 'composite3d',
            primitives_3d: resolvedPrims,
            object_name_en: candidateName,
            object_name_uz: asString(
              visualData.object_name_uz || existingRp.object_name_uz || topicTitle
            ),
          },
        };
      }
    }

    const shapeName =
      visualType === 'threejs' || visualType === 'object_3d'
        ? (asString(visualData.shape || existingRp.shape, 'pyramid') as RenderParams['shape'])
        : (visualType as RenderParams['shape']);

    return {
      engineHint: 'threejs',
      renderParams: {
        ...existingRp,
        shape: shapeName,
        base: visualData.base !== undefined ? asNumber(visualData.base, 6) : existingRp.base,
        height:
          visualData.height !== undefined ? asNumber(visualData.height, 8) : existingRp.height,
        radius:
          visualData.radius !== undefined ? asNumber(visualData.radius, 3.5) : existingRp.radius,
        show_height: existingRp.show_height ?? true,
      },
    };
  }

  // 5. Plotly 2D / 3D
  if (visualType === 'plotly2d' || existingRp.expression || visualData.expression) {
    const expr = asString(visualData.expression || existingRp.expression, 'x^2');
    return {
      engineHint: 'plotly2d',
      renderParams: {
        ...existingRp,
        expression: expr,
        secondary_expression:
          asString(visualData.secondary_expression || existingRp.secondary_expression) ||
          undefined,
        x_range: existingRp.x_range || [-6, 6],
        y_range: existingRp.y_range || [-6, 10],
      },
    };
  }

  if (visualType === 'plotly3d' || existingRp.expression_z || visualData.expression_z) {
    const exprZ = asString(visualData.expression_z || existingRp.expression_z, 'x^2 + y^2');
    return {
      engineHint: 'plotly3d',
      renderParams: {
        ...existingRp,
        expression_z: exprZ,
        x_range: existingRp.x_range || [-4, 4],
        y_range: existingRp.y_range || [-4, 4],
      },
    };
  }

  // 6. Mermaid flowchart
  if (visualType === 'mermaid' || existingRp.diagram || visualData.diagram) {
    const diagram = asString(
      visualData.diagram || existingRp.diagram,
      `flowchart TD\n  A["${escapeXml(topicTitle || 'Mavzu')}"] --> B["${escapeXml(stepTitle || 'Asosiy bosqich')}"]`
    );
    return {
      engineHint: 'mermaid',
      renderParams: {
        ...existingRp,
        diagram,
      },
    };
  }

  // 7. Existing valid RenderParams on defaultEngine
  if (Object.keys(existingRp).length > 0 && (existingRp.kind || existingRp.shape || existingRp.svg_data)) {
    return {
      engineHint: defaultEngine,
      renderParams: existingRp as RenderParams,
    };
  }

  // 8. Safe ObjectCatalog / Zero-Token fallback (never throw 502)
  const lookupText =
    asString(visualData.object || visualData.object_name_en || visualData.object_name_uz) ||
    `${topicTitle} ${stepTitle}`;
  const intent = extractObjectIntent(lookupText);
  const procSvg =
    generateProceduralObjectSvg(intent.name_en, intent.name_uz) ||
    generateProceduralObjectSvg(lookupText, topicTitle) ||
    generateZeroTokenFallbackSvg(stepTitle || topicTitle, intent.name_en || 'diagram');

  return {
    engineHint: 'svg2d',
    renderParams: {
      ...existingRp,
      kind: 'illustration',
      object_name_uz: intent.name_uz || topicTitle,
      object_name_en: intent.name_en || 'diagram',
      svg_data: procSvg.svg_data,
      svg_viewbox: procSvg.viewBox,
      object_parts: procSvg.parts_uz,
    },
  };
}

/**
 * Normalizes any Modal / Qwen-VL / Gemini lesson payload into a guaranteed valid TutorLesson
 * matching types/tutor.ts without throwing 502 schema incompatibility errors.
 */
export function normalizeModalLesson(
  rawInput: unknown,
  fallbackTopic = 'Interaktiv dars',
  source: TutorLesson['source'] = 'modal-backend'
): TutorLesson {
  const root = asRecord(rawInput);
  const candidate =
    root.lesson && typeof root.lesson === 'object' ? asRecord(root.lesson) : root;

  const topicTitle =
    asString(candidate.topic_title || candidate.title || candidate.topic) ||
    fallbackTopic ||
    'Interaktiv dars';

  const rawSteps = Array.isArray(candidate.steps) ? candidate.steps : [];
  const requestedEngine = asString(candidate.engine).toLowerCase() as EngineType;
  let resolvedEngine: EngineType = VALID_ENGINES.includes(requestedEngine)
    ? requestedEngine
    : 'svg2d';

  const stepsInput =
    rawSteps.length > 0
      ? rawSteps
      : [
          {
            step_number: 1,
            step_title: topicTitle,
            speech_text: asString(candidate.explanation_uz || candidate.summary || topicTitle),
            katex_formulas: [],
            explanation_uz: asString(
              candidate.explanation_uz || candidate.summary || `${topicTitle} bo‘yicha asosiy tushuntirish.`
            ),
            visual_type: 'custom_2d_svg',
            visual_data: {},
          },
        ];

  const engineCounts: Partial<Record<EngineType, number>> = {};

  const normalizedSteps: LessonStep[] = stepsInput.map((item, idx) => {
    const rec = asRecord(item);
    const stepNum = Math.round(asNumber(rec.step_number, idx + 1));
    const stepTitle =
      asString(rec.step_title || rec.board_title || rec.title) || `${stepNum}-qadam`;

    const rawLatex = asString(rec.latex);
    const formulasRaw = Array.isArray(rec.katex_formulas)
      ? rec.katex_formulas.map((f) => asString(f)).filter(Boolean)
      : [];
    const katexFormulas =
      formulasRaw.length > 0 ? formulasRaw : rawLatex ? [rawLatex] : [];

    const explanationUz =
      asString(rec.explanation_uz || rec.explanation || rec.summary) || stepTitle;
    const rawSpeech = asString(rec.speech_text || rec.narration) || explanationUz;
    const speechText = sanitizeSpeechTextUz(rawSpeech) || sanitizeSpeechTextUz(stepTitle);

    const { engineHint, renderParams } = normalizeStepVisual(
      rec,
      topicTitle,
      resolvedEngine,
      stepTitle
    );
    engineCounts[engineHint] = (engineCounts[engineHint] || 0) + 1;

    const cameraArr = Array.isArray(rec.camera) && rec.camera.length >= 3
      ? ([
          asNumber(rec.camera[0], 9),
          asNumber(rec.camera[1], 7),
          asNumber(rec.camera[2], 10),
        ] as [number, number, number])
      : undefined;

    const stepFocusPart = asString(rec.focusPart) || undefined;
    const rawBeats = Array.isArray(rec.beats) ? rec.beats : [];
    const normalizedBeats: LessonBeat[] = [];
    for (const b of rawBeats) {
      const brec = asRecord(b);
      const sentence = sanitizeSpeechTextUz(asString(brec.sentence));
      if (!sentence) continue;
      const rawPose = asString(brec.tutor_pose);
      const pose: TutorPose =
        rawPose === 'approach' || rawPose === 'step_back' || rawPose === 'formula_check'
          ? rawPose
          : 'approach';
      const focusTarget = asString(
        brec.focus_target || brec.focusPart || stepFocusPart || 'overview'
      );
      const explicitPart =
        asString(brec.focusPart) ||
        (focusTarget &&
        focusTarget !== 'overview' &&
        focusTarget !== 'formula' &&
        focusTarget !== 'none'
          ? focusTarget
          : stepFocusPart);
      normalizedBeats.push({
        sentence,
        focus_target: focusTarget,
        focusPart: explicitPart || undefined,
        tutor_pose: explicitPart ? 'approach' : pose,
        camera_zoom:
          brec.camera_zoom !== undefined
            ? asNumber(brec.camera_zoom, explicitPart ? 1.35 : 1.0)
            : explicitPart
            ? 1.35
            : 1.0,
        dimInactiveParts:
          typeof brec.dimInactiveParts === 'boolean'
            ? brec.dimInactiveParts
            : Boolean(explicitPart),
        note: asString(brec.note) || undefined,
      });
    }

    // Synthesize part-targeted beats when missing so the mentor always points at parts while speaking
    const partsList = renderParams.object_parts || [];
    const finalBeats: LessonBeat[] | undefined =
      normalizedBeats.length > 0
        ? normalizedBeats
        : (() => {
            const sentences = speechText
              .split(/(?<=[.!?])\s+/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (sentences.length === 0) return undefined;
            return sentences.map((sent, sIdx) => {
              const matchedPart =
                partsList[sIdx % Math.max(1, partsList.length)]?.partId || stepFocusPart;
              return {
                sentence: sent,
                focus_target: matchedPart || 'overview',
                focusPart: matchedPart,
                tutor_pose: matchedPart ? 'approach' : 'step_back',
                camera_zoom: matchedPart ? 1.35 : 1.0,
                dimInactiveParts: Boolean(matchedPart),
              };
            });
          })();

    return {
      step_number: stepNum,
      step_title: stepTitle,
      board_title: asString(rec.board_title) || stepTitle,
      speech_text: speechText,
      katex_formulas: katexFormulas,
      latex: rawLatex || katexFormulas[0] || undefined,
      explanation_uz: explanationUz,
      emoji_emotion: normalizeEmotion(rec.emoji_emotion),
      camera: cameraArr,
      focusPart: stepFocusPart || partsList[0]?.partId || undefined,
      cameraZoom:
        rec.cameraZoom !== undefined ? asNumber(rec.cameraZoom, 1.15) : undefined,
      dimInactiveParts:
        typeof rec.dimInactiveParts === 'boolean' ? rec.dimInactiveParts : undefined,
      visual_type: asString(rec.visual_type) || undefined,
      visual_data:
        rec.visual_data && typeof rec.visual_data === 'object'
          ? (rec.visual_data as Record<string, unknown>)
          : undefined,
      render_params: renderParams,
      beats: finalBeats,
      quiz: normalizeQuiz(rec.quiz),
    };
  });

  // Choose dominant engine across normalized steps if top-level engine wasn't explicitly set
  // or if steps clearly rely on threejs / svg2d
  const dominantEngine = (Object.entries(engineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    resolvedEngine) as EngineType;
  if (!VALID_ENGINES.includes(requestedEngine) || engineCounts[dominantEngine]) {
    resolvedEngine = dominantEngine;
  }

  const rawSliders = Array.isArray(candidate.sliders) ? candidate.sliders : [];
  const sliders: SliderDef[] = [];
  for (const s of rawSliders) {
    const rec = asRecord(s);
    const id = asString(rec.id);
    const label = asString(rec.label);
    if (!id || !label) continue;
    const unitVal = asString(rec.unit);
    sliders.push({
      id,
      label,
      min: asNumber(rec.min, 0),
      max: asNumber(rec.max, 10),
      step: asNumber(rec.step, 1),
      default: asNumber(rec.default, 5),
      ...(unitVal ? { unit: unitVal } : {}),
    });
  }

  const rawUsage = asRecord(candidate.token_usage);
  const tokenUsage: TokenUsageInfo | undefined =
    typeof rawUsage.total_tokens === 'number'
      ? {
          prompt_tokens: asNumber(rawUsage.prompt_tokens, 0),
          output_tokens: asNumber(rawUsage.output_tokens, 0),
          total_tokens: asNumber(rawUsage.total_tokens, 0),
          cost_usd: asNumber(rawUsage.cost_usd, 0),
          llm_calls: asNumber(rawUsage.llm_calls, 1),
        }
      : undefined;

  return {
    id: asString(candidate.id) || `mirvo-${Date.now().toString(36)}`,
    topic_title: topicTitle,
    subject: normalizeSubject(candidate.subject, topicTitle),
    engine: resolvedEngine,
    source,
    token_usage: tokenUsage,
    keywords: Array.isArray(candidate.keywords)
      ? candidate.keywords.map((k) => asString(k)).filter(Boolean)
      : undefined,
    sliders,
    steps: normalizedSteps,
  };
}
