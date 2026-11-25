import React, { Suspense, lazy } from 'react';
import type { FlowType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { Canvas3DFallback } from './Canvas3DFallback';

const LazyPbrMachine3DStage = lazy(() => import('./PbrMachine3DStage'));

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
  force2DFallback = false,
  autoRotate = false,
  focusPart,
  dimInactiveParts = false,
  isPlaying = true,
  onAnchorsChange,
}) => {
  if (force2DFallback) {
    return (
      <Canvas3DFallback
        params={params}
        sliderValues={sliderValues}
        cameraPos={cameraPreset}
      />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      <Suspense
        fallback={
          <Canvas3DFallback
            params={params}
            sliderValues={sliderValues}
            cameraPos={cameraPreset}
          />
        }
      >
        <LazyPbrMachine3DStage
          params={params}
          sliderValues={sliderValues}
          cameraPreset={cameraPreset}
          autoRotate={autoRotate}
          focusPart={focusPart}
          dimInactiveParts={dimInactiveParts}
          isPlaying={isPlaying}
          darkSurface={false}
          showHud={false}
          onAnchorsChange={onAnchorsChange}
        />
      </Suspense>
    </div>
  );
};
