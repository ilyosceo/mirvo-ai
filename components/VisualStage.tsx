import React, { Suspense, lazy } from 'react';
import type { EngineType, FlowType, RenderParams, StageAnchorsMap } from '../types/tutor';
import { ThreeDStage } from './engines/ThreeDStage';
import { PlotlyStage } from './engines/PlotlyStage';
import { AnimatedGraphBoard } from './engines/AnimatedGraphBoard';
import { MoleculeStage } from './engines/MoleculeStage';
import { MermaidStage } from './engines/MermaidStage';
import { SvgGeometryStage } from './engines/SvgGeometryStage';
import { MatterPhysicsStage } from './engines/MatterPhysicsStage';

const LazyZdogStage = lazy(() => import('./engines/ZdogStage'));
const LazyMafsGeometryStage = lazy(() => import('./engines/MafsGeometryStage'));
const LazyKonvaBoardStage = lazy(() => import('./engines/KonvaBoardStage'));
const LazyNetworkGraphStage = lazy(() => import('./engines/NetworkGraphStage'));
const LazyRapierPixiStage = lazy(() => import('./engines/RapierPixiStage'));

interface VisualStageProps {
  engine: EngineType;
  params: RenderParams;
  sliderValues: Record<string, number>;
  cameraPreset?: [number, number, number];
  force2DFallback?: boolean;
  autoRotate?: boolean;
  focusTarget?: string;
  focusPart?: string;
  dimInactiveParts?: boolean;
  cameraZoom?: number;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  stepIndex?: number;
  beatIndex?: number;
  beatProgress?: number;
  totalBeats?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

const StageLoadingFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-[#6E6E73]">
    Vizual sahna yuklanmoqda...
  </div>
);

export const VisualStage: React.FC<VisualStageProps> = ({
  engine,
  params,
  sliderValues,
  cameraPreset,
  force2DFallback,
  autoRotate,
  focusTarget,
  focusPart,
  dimInactiveParts = false,
  cameraZoom = 1,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  stepIndex = 0,
  beatIndex = 0,
  beatProgress = 1,
  totalBeats = 2,
  isPlaying = false,
  onAnchorsChange,
}) => {
  switch (engine) {
    case 'zdog':
      return (
        <Suspense fallback={<StageLoadingFallback />}>
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
      );
    case 'threejs':
      return (
        <ThreeDStage
          params={params}
          sliderValues={sliderValues}
          cameraPreset={cameraPreset}
          force2DFallback={force2DFallback}
          autoRotate={autoRotate}
          focusTarget={focusTarget}
          focusPart={focusPart}
          dimInactiveParts={dimInactiveParts}
          cameraZoom={cameraZoom}
          flowType={flowType}
          flowSpeed={flowSpeed}
          flowReverse={flowReverse}
          isPlaying={isPlaying}
          stepIndex={stepIndex}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'mafs':
    case 'jsxgraph':
      return (
        <Suspense fallback={<StageLoadingFallback />}>
          <LazyMafsGeometryStage
            mode={engine}
            params={params}
            sliderValues={sliderValues}
            stepIndex={stepIndex}
            onAnchorsChange={onAnchorsChange}
          />
        </Suspense>
      );
    case 'konva':
      return (
        <Suspense fallback={<StageLoadingFallback />}>
          <LazyKonvaBoardStage
            params={params}
            sliderValues={sliderValues}
            stepIndex={stepIndex}
            onAnchorsChange={onAnchorsChange}
          />
        </Suspense>
      );
    case 'xyflow':
    case 'cytoscape':
      return (
        <Suspense fallback={<StageLoadingFallback />}>
          <LazyNetworkGraphStage
            mode={engine}
            params={params}
            stepIndex={stepIndex}
            isPlaying={isPlaying}
            onAnchorsChange={onAnchorsChange}
          />
        </Suspense>
      );
    case 'rapier2d':
    case 'pixi':
      return (
        <Suspense fallback={<StageLoadingFallback />}>
          <LazyRapierPixiStage
            params={params}
            sliderValues={sliderValues}
            isPlaying={isPlaying}
            stepIndex={stepIndex}
            onAnchorsChange={onAnchorsChange}
          />
        </Suspense>
      );
    case 'matter':
      return (
        <MatterPhysicsStage
          params={params}
          sliderValues={sliderValues}
          focusPart={focusPart}
          focusTarget={focusTarget}
          dimInactiveParts={dimInactiveParts}
          isPlaying={isPlaying}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'plotly2d':
      return (
        <AnimatedGraphBoard
          params={params}
          sliderValues={sliderValues}
          stepIndex={stepIndex}
          beatIndex={beatIndex}
          beatProgress={beatProgress}
          totalBeats={totalBeats}
          isPlaying={isPlaying}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'plotly3d':
      return (
        <PlotlyStage
          engine={engine}
          params={params}
          sliderValues={sliderValues}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'pdb':
    case 'pubchem':
    case 'rdkit':
      return (
        <MoleculeStage
          engine={engine}
          params={params}
          cameraZoom={cameraZoom}
          focusTarget={focusTarget}
          stepIndex={stepIndex}
          beatIndex={beatIndex}
          beatProgress={beatProgress}
          totalBeats={totalBeats}
          isPlaying={isPlaying}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'mermaid':
      return (
        <MermaidStage
          params={params}
          cameraZoom={cameraZoom}
          focusTarget={focusTarget}
          stepIndex={stepIndex}
          beatIndex={beatIndex}
          beatProgress={beatProgress}
          totalBeats={totalBeats}
          isPlaying={isPlaying}
          onAnchorsChange={onAnchorsChange}
        />
      );
    case 'svg2d':
    default:
      return (
        <SvgGeometryStage
          params={params}
          sliderValues={sliderValues}
          cameraZoom={cameraZoom}
          focusPart={focusPart}
          focusTarget={focusTarget}
          dimInactiveParts={dimInactiveParts}
          flowType={flowType}
          flowSpeed={flowSpeed}
          flowReverse={flowReverse}
          stepIndex={stepIndex}
          beatIndex={beatIndex}
          beatProgress={beatProgress}
          totalBeats={totalBeats}
          isPlaying={isPlaying}
          onAnchorsChange={onAnchorsChange}
        />
      );
  }
};
