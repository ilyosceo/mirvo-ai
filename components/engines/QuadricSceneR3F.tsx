import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import type { FlowType, RenderParams } from '../../types/tutor';
import { FlowLineR3F } from './FlowLineR3F';
import { SafeLabel3D } from './SafeLabel3D';
import { computeQuadricOrParametricData } from './quadricSurfaces';

interface TwoPassLine2Props {
  points: THREE.Vector3[];
  color: string | number;
  lineWidth?: number;
  dashedLineWidth?: number;
  solidOpacity?: number;
  dashedOpacity?: number;
  hasSurface: boolean;
  segments?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
}

const TwoPassLine2: React.FC<TwoPassLine2Props> = ({
  points,
  color,
  lineWidth = 2.2,
  dashedLineWidth,
  solidOpacity = 0.94,
  dashedOpacity = 0.46,
  hasSurface,
  segments = false,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
}) => {
  if (points.length < 2) return null;

  return (
    <group>
      <FlowLineR3F
        points={points}
        segments={segments}
        color={color}
        lineWidth={lineWidth}
        dashed={flowType !== 'none'}
        dashSize={0.2}
        gapSize={0.12}
        dashScale={1}
        transparent={solidOpacity < 1 || flowType !== 'none'}
        opacity={solidOpacity}
        depthTest
        depthFunc={THREE.LessEqualDepth}
        depthWrite={false}
        renderOrder={2}
        flowType={flowType}
        flowSpeed={flowSpeed}
        flowReverse={flowReverse}
        isPlaying={isPlaying}
      />
      {hasSurface && (
        <FlowLineR3F
          points={points}
          segments={segments}
          color={color}
          lineWidth={dashedLineWidth ?? Math.max(1.3, lineWidth * 0.84)}
          dashed
          dashSize={0.14}
          gapSize={0.09}
          dashScale={1}
          transparent
          opacity={dashedOpacity}
          depthTest
          depthFunc={THREE.GreaterDepth}
          depthWrite={false}
          renderOrder={3}
          flowType={flowType}
          flowSpeed={flowSpeed}
          flowReverse={flowReverse}
          isPlaying={isPlaying}
        />
      )}
    </group>
  );
};

interface QuadricSceneR3FProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  isSoftwareGl: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
  onAnchorsReady: (anchors: Record<string, THREE.Vector3>, overview: THREE.Vector3) => void;
}

export const QuadricSceneR3F: React.FC<QuadricSceneR3FProps> = ({
  params,
  sliderValues,
  isSoftwareGl,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
  onAnchorsReady,
}) => {
  const data = useMemo(
    () =>
      computeQuadricOrParametricData({
        params,
        sliderValues,
        isSoftwareGl,
      }),
    [params, sliderValues, isSoftwareGl]
  );

  const surfaceGeometries = useMemo(() => {
    if (!data.layers.showSurface) return [];
    return data.sheets.map((sheetFn) => {
      const geom = new ParametricGeometry(
        (u, v, target) => {
          const pt = sheetFn(u, v);
          target.copy(pt);
        },
        data.slices,
        data.stacks
      );
      geom.computeVertexNormals();
      return geom;
    });
  }, [data]);

  useEffect(() => {
    return () => {
      surfaceGeometries.forEach((g) => g.dispose());
    };
  }, [surfaceGeometries]);

  useLayoutEffect(() => {
    onAnchorsReady(data.anchors, data.overview);
  }, [data, onAnchorsReady]);

  const { showAxes, showWireframe, showSurface, showEquator, showMeridians, showLabels } =
    data.layers;

  return (
    <group>
      {/* 1. Pastel translucent matte surface + depth prepass for crisp 2-pass Line2 dashed occlusion */}
      {showSurface &&
        surfaceGeometries.map((geom, idx) => (
          <React.Fragment key={`sheet-${idx}`}>
            <mesh geometry={geom} renderOrder={0}>
              <meshStandardMaterial
                color={data.surfaceHex}
                roughness={0.78}
                metalness={0.0}
                transparent
                opacity={0.52}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <mesh geometry={geom} renderOrder={1}>
              <meshBasicMaterial
                colorWrite={false}
                depthWrite
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={2}
                polygonOffsetUnits={2}
              />
            </mesh>
          </React.Fragment>
        ))}

      {/* 2. Subtle u / v parametric wireframe grid via Line2 segments */}
      {showWireframe && data.wireframePairs.length >= 2 && (
        <TwoPassLine2
          points={data.wireframePairs}
          segments
          color={0x475569}
          lineWidth={showSurface ? 1.05 : 1.35}
          dashedLineWidth={1.0}
          solidOpacity={showSurface ? 0.24 : 0.48}
          dashedOpacity={0.12}
          hasSurface={showSurface}
        />
      )}

      {/* 3. Principal cross-section rings & meridians with constant-pixel Line2 */}
      {showEquator &&
        data.equators.map((pts, idx) => (
          <TwoPassLine2
            key={`eq-${idx}`}
            points={pts}
            color="#c26d4f"
            lineWidth={2.5}
            dashedLineWidth={2.0}
            solidOpacity={0.96}
            dashedOpacity={0.48}
            hasSurface={showSurface}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
        ))}

      {showMeridians && (
        <>
          {data.meridiansA.map((pts, idx) => (
            <TwoPassLine2
              key={`mA-${idx}`}
              points={pts}
              color="#4f7b64"
              lineWidth={2.2}
              dashedLineWidth={1.75}
              solidOpacity={0.93}
              dashedOpacity={0.44}
              hasSurface={showSurface}
              flowType={flowType}
              flowSpeed={flowSpeed}
              flowReverse={flowReverse}
              isPlaying={isPlaying}
            />
          ))}
          {data.meridiansB.map((pts, idx) => (
            <TwoPassLine2
              key={`mB-${idx}`}
              points={pts}
              color="#4e7696"
              lineWidth={2.2}
              dashedLineWidth={1.75}
              solidOpacity={0.93}
              dashedOpacity={0.44}
              hasSurface={showSurface}
              flowType={flowType}
              flowSpeed={flowSpeed}
              flowReverse={flowReverse}
              isPlaying={isPlaying}
            />
          ))}
        </>
      )}

      {/* 4. Clean textbook x, y, z axes with Line2 + arrowheads + origin dot */}
      {showAxes && (
        <group>
          {data.axes.map((ax) => (
            <React.Fragment key={ax.name}>
              <TwoPassLine2
                points={ax.line}
                color="#334155"
                lineWidth={1.85}
                dashedLineWidth={1.55}
                solidOpacity={0.92}
                dashedOpacity={0.5}
                hasSurface={showSurface}
              />
              <mesh position={ax.tipPosition} quaternion={ax.quaternion} renderOrder={4}>
                <coneGeometry args={[0.055, 0.19, 12]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
              {showLabels && (
                <SafeLabel3D
                  position={ax.labelPosition}
                  text={ax.name}
                  className="ziyo-3d-label ziyo-3d-label--math"
                />
              )}
            </React.Fragment>
          ))}

          <mesh position={[0, 0, 0]} renderOrder={4}>
            <sphereGeometry args={[0.042, 12, 12]} />
            <meshBasicMaterial color="#334155" />
          </mesh>

          {showLabels && (
            <SafeLabel3D
              position={data.originLabelPos}
              text="o"
              className="ziyo-3d-label ziyo-3d-label--math"
            />
          )}
        </group>
      )}

      {/* 5. Semi-axis annotations (r, a, b, c, p) */}
      {showLabels &&
        data.annotations.map((ann, idx) => (
          <React.Fragment key={`ann-${idx}`}>
            {ann.guide && (
              <TwoPassLine2
                points={ann.guide}
                color="#335e7a"
                lineWidth={1.85}
                dashedLineWidth={1.5}
                solidOpacity={0.86}
                dashedOpacity={0.44}
                hasSurface={showSurface}
              />
            )}
            <SafeLabel3D
              position={ann.pos}
              text={ann.text}
              className="ziyo-3d-label ziyo-3d-label--math"
              color={ann.color}
            />
          </React.Fragment>
        ))}
    </group>
  );
};
