import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { FlowType } from '../../types/tutor';

interface FlowLineR3FProps {
  points: Array<THREE.Vector3 | [number, number, number]>;
  color: string | number;
  lineWidth?: number;
  dashed?: boolean;
  dashSize?: number;
  gapSize?: number;
  dashScale?: number;
  transparent?: boolean;
  opacity?: number;
  depthTest?: boolean;
  depthFunc?: THREE.DepthModes;
  depthWrite?: boolean;
  renderOrder?: number;
  segments?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
}

/**
 * R3F Line2 wrapper that smoothly animates `LineMaterial.dashOffset` inside `useFrame`
 * whenever `flowType !== 'none'` and `isPlaying === true`, with zero per-frame allocations.
 */
export const FlowLineR3F: React.FC<FlowLineR3FProps> = ({
  points,
  color,
  lineWidth = 2.4,
  dashed = false,
  dashSize = 0.24,
  gapSize = 0.14,
  dashScale = 1,
  transparent = false,
  opacity = 1,
  depthTest = true,
  depthFunc = THREE.LessEqualDepth,
  depthWrite = true,
  renderOrder = 0,
  segments = false,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
}) => {
  const lineRef = useRef<any>(null);
  const phaseRef = useRef(0);
  const isFlowActive = Boolean(flowType && flowType !== 'none');
  const clampedSpeed = Math.max(0.5, Math.min(2.5, Number.isFinite(flowSpeed) ? flowSpeed : 1.0));

  useFrame((_, delta) => {
    const lineObj = lineRef.current;
    if (!lineObj || !lineObj.material || !isFlowActive) return;

    const mat = lineObj.material as {
      dashOffset?: number;
      opacity?: number;
    };
    if (!isPlaying) return;

    const safeDelta = Math.min(delta, 0.08);
    const dir = flowReverse ? 1 : -1;

    if (flowType === 'ac') {
      phaseRef.current += safeDelta * clampedSpeed * 3.4;
      const acShift = Math.sin(phaseRef.current) * 0.42 * (flowReverse ? -1 : 1);
      if (typeof mat.dashOffset === 'number') {
        mat.dashOffset = acShift;
      }
      mat.opacity = opacity * (0.72 + 0.28 * Math.abs(Math.cos(phaseRef.current)));
    } else if (flowType === 'pulse') {
      phaseRef.current += safeDelta * clampedSpeed * 3.2;
      if (typeof mat.dashOffset === 'number') {
        mat.dashOffset += dir * safeDelta * clampedSpeed * 0.9;
      }
      mat.opacity = opacity * (0.64 + 0.36 * (0.5 + 0.5 * Math.sin(phaseRef.current)));
    } else {
      // 'dc': steady directional dash flow
      if (typeof mat.dashOffset === 'number') {
        mat.dashOffset += dir * safeDelta * clampedSpeed * 0.95;
      }
      mat.opacity = opacity;
    }
  });

  if (points.length < 2) return null;

  const useDashed = dashed || isFlowActive;
  const effectiveTransparent = transparent || isFlowActive || opacity < 0.99;

  return (
    <Line
      ref={lineRef}
      points={points}
      segments={segments}
      color={color}
      lineWidth={lineWidth}
      dashed={useDashed}
      dashSize={dashSize}
      gapSize={gapSize}
      dashScale={dashScale}
      transparent={effectiveTransparent}
      opacity={opacity}
      depthTest={depthTest}
      depthFunc={depthFunc}
      depthWrite={depthWrite}
      renderOrder={renderOrder}
    />
  );
};
