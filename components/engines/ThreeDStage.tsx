import React, { Suspense, lazy, useState } from 'react';
import type { FlowType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { Canvas3DFallback } from './Canvas3DFallback';

const LazyZdogStage = lazy(() => import('./ZdogStage'));

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
  cameraZoom = 1,
  stepIndex = 0,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const [mode, setMode] = useState<'zdog' | 'wireframe'>(
    force2DFallback ? 'wireframe' : 'zdog'
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute top-3 right-3 z-20 inline-flex items-center rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] p-0.5 shadow-xs">
        <button
          type="button"
          onClick={() => setMode('zdog')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
            mode === 'zdog'
              ? 'bg-[#0071E3] text-white'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          2.5D Hajmli
        </button>
        <button
          type="button"
          onClick={() => setMode('wireframe')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
            mode === 'wireframe'
              ? 'bg-[#0071E3] text-white'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Chizma
        </button>
      </div>

      {mode === 'wireframe' ? (
        <Canvas3DFallback
          params={params}
          sliderValues={sliderValues}
          cameraPos={cameraPreset}
        />
      ) : (
        <Suspense
          fallback={
            <Canvas3DFallback
              params={params}
              sliderValues={sliderValues}
              cameraPos={cameraPreset}
            />
          }
        >
          <LazyZdogStage
            params={params}
            sliderValues={sliderValues}
            autoRotate={autoRotate}
            cameraZoom={cameraZoom}
            stepIndex={stepIndex}
            isPlaying={isPlaying}
            onAnchorsChange={onAnchorsChange}
          />
        </Suspense>
      )}
    </div>
  );
};
