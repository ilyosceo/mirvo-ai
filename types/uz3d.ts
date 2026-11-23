import type React from 'react';
import type { Custom2DSvgData, Primitive3DItem } from './tutor';

export type EmojiMimicState =
  | 'explaining'
  | 'amazed'
  | 'thinking'
  | 'happy'
  | 'warning';

export interface Uz3DSegment {
  start_sec: number;
  end_sec: number;
  uzbek_title: string;
  uzbek_explanation: string;
  camera_hotspot: string;
  emoji_mimic: EmojiMimicState;
  key_formula_or_term: string | null;
}

export interface Uz3DLessonResponse {
  lesson_id: string;
  video_id?: string;
  source_channel?: 'youtube_extension' | 'local_audio' | 'image_topic' | 'mock_demo';
  selected_model_id: string;
  model_glb_url: string | null;
  lesson_title_uz: string;
  cached?: boolean;
  provider?: string;
  custom_primitives_3d?: Primitive3DItem[];
  custom_hotspots?: ModelHotspotSpec[];
  segments: Uz3DSegment[];
}

export interface ModelHotspotSpec {
  id: string;
  label_uz: string;
  description_uz: string;
  camera_orbit: string;
  camera_target: string;
  position_3d: [number, number, number];
}

export interface ModelCatalogEntry {
  id: string;
  title_uz: string;
  subject_uz: string;
  keywords: string[];
  model_glb_url: string | null;
  hotspots: ModelHotspotSpec[];
  primitives_3d?: Primitive3DItem[];
  fallback_2d_svg?: Custom2DSvgData;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          'camera-controls'?: boolean | string;
          'auto-rotate'?: boolean | string;
          'camera-orbit'?: string;
          'camera-target'?: string;
          'shadow-intensity'?: string | number;
          'interaction-prompt'?: string;
          exposure?: string | number;
          ar?: boolean | string;
          loading?: 'auto' | 'lazy' | 'eager';
        },
        HTMLElement
      >;
    }
  }
}
