import gsap from 'gsap';
import type { LessonBeat } from '../types/tutor';

export interface MotionStepKeyframe {
  beatIndex: number;
  progress: number;
  focusTarget?: string;
  zoom: number;
}

/**
 * Synchronizes GSAP timelines with voice-driven lesson beats and Motion Canvas style
 * declarative step transitions.
 */
export function createSyncedStepTimeline(
  beats: LessonBeat[],
  onKeyframe: (frame: MotionStepKeyframe) => void
): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const state = { progress: 0, zoom: 1 };

  beats.forEach((beat, index) => {
    const targetZoom = beat.cameraZoom ?? beat.camera_zoom ?? 1;
    tl.to(state, {
      progress: (index + 1) / Math.max(1, beats.length),
      zoom: targetZoom,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        onKeyframe({
          beatIndex: index,
          progress: state.progress,
          focusTarget: beat.focus_target || beat.focusPart,
          zoom: state.zoom,
        });
      },
    });
  });

  return tl;
}

export async function loadMotionCanvasRuntime() {
  const [core, twoD] = await Promise.all([
    import('@motion-canvas/core'),
    import('@motion-canvas/2d'),
  ]);
  return { core, twoD };
}
