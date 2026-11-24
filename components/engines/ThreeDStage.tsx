import React from 'react';
import type { FlowType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { Canvas3DFallback } from './Canvas3DFallback';

export interface ThreeDStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  cameraPreset?: [number, number, number];
  force2DFallback?: boolean;
  autoRotate?: boolean;
  focusTarget?: string;
  focusPart?: string;
  dimInactiveParts?: boolean;
  cameraZoom?: number;
  stepIndex?: number;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

export const ThreeDStage: React.FC<ThreeDStageProps> = ({
  params,
  sliderValues,
  cameraPreset,
}) => {
  return (
    <Canvas3DFallback
      params={params}
      sliderValues={sliderValues}
      cameraPos={cameraPreset}
    />
  );
};
