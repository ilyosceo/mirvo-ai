import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { FlowType, RenderParams } from '../../types/tutor';
import { FlowLineR3F } from './FlowLineR3F';
import { SafeLabel3D } from './SafeLabel3D';

interface StereometrySceneR3FProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  focusPart?: string;
  dimInactiveParts?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
  onAnchorsReady: (
    anchors: Record<string, THREE.Vector3>,
    overview: THREE.Vector3,
    boxes?: Record<string, THREE.Box3>
  ) => void;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.06)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const StageLabel: React.FC<{
  position: THREE.Vector3 | [number, number, number];
  text: string;
  accent?: boolean;
  visible?: boolean;
}> = ({ position, text, accent = false, visible = true }) =>
  visible ? (
    <SafeLabel3D
      position={position}
      text={text}
      className={accent ? 'ziyo-3d-label ziyo-3d-label--accent' : 'ziyo-3d-label'}
    />
  ) : null;

const VectorArrowR3F: React.FC<{
  origin: THREE.Vector3;
  vec: THREE.Vector3;
  color: string;
  label: string;
  accent?: boolean;
  opacity?: number;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
}> = ({
  origin,
  vec,
  color,
  label,
  accent = false,
  opacity = 1,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
}) => {
  const { tip, headPos, quaternion, shaftMid, shaftLen, headLen, labelPos } = useMemo(() => {
    const len = Math.max(0.25, vec.length());
    const dir = vec.clone().normalize();
    const hLen = Math.min(0.65, len * 0.28);
    const sLen = Math.max(0.05, len - hLen);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const t = origin.clone().add(vec);
    return {
      tip: t,
      headPos: origin.clone().addScaledVector(dir, sLen + hLen / 2),
      shaftMid: origin.clone().addScaledVector(dir, sLen / 2),
      shaftLen: sLen,
      headLen: hLen,
      quaternion: q,
      labelPos: t.clone().addScaledVector(dir, 0.35),
    };
  }, [origin, vec]);

  const isDimmed = opacity < 0.99;

  return (
    <group>
      <FlowLineR3F
        points={[origin, tip]}
        color={flowType !== 'none' ? '#ffffff' : color}
        lineWidth={flowType !== 'none' ? 3.2 : 4}
        dashed={flowType !== 'none'}
        dashSize={0.28}
        gapSize={0.22}
        transparent={isDimmed || flowType !== 'none'}
        opacity={opacity}
        renderOrder={3}
        flowType={flowType}
        flowSpeed={flowSpeed}
        flowReverse={flowReverse}
        isPlaying={isPlaying}
      />
      <mesh position={shaftMid} quaternion={quaternion}>
        <cylinderGeometry args={[0.055, 0.055, shaftLen, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.32}
          metalness={0.42}
          transparent={isDimmed}
          depthWrite={!isDimmed}
          opacity={opacity}
        />
      </mesh>
      <mesh position={headPos} quaternion={quaternion}>
        <coneGeometry args={[0.21, headLen, 18]} />
        <meshStandardMaterial
          color={color}
          roughness={0.28}
          metalness={0.45}
          transparent={isDimmed}
          depthWrite={!isDimmed}
          opacity={opacity}
        />
      </mesh>
      <StageLabel position={labelPos} text={label} accent={accent} visible={!isDimmed} />
    </group>
  );
};

export const StereometrySceneR3F: React.FC<StereometrySceneR3FProps> = ({
  params,
  sliderValues,
  focusPart,
  dimInactiveParts = false,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
  onAnchorsReady,
}) => {
  const shape = params.shape || 'pyramid';
  const base = sliderValues.base ?? params.base ?? 6;
  const height = sliderValues.height ?? params.height ?? 8;
  const radius = sliderValues.radius ?? params.radius ?? 3.5;
  const cutRatio = sliderValues.cut_ratio ?? params.cut_ratio ?? 0.5;
  const showCut = Boolean(params.show_cross_section);
  const showHeight = params.show_height !== false;
  const showApothem = Boolean(params.show_apothem);
  const scale = 0.65;

  const activeFocus =
    focusPart && focusPart !== 'overview' && focusPart !== 'drawing_tip'
      ? focusPart.trim()
      : undefined;

  const shadowTex = useMemo(() => createContactShadowTexture(), []);
  useEffect(() => () => shadowTex.dispose(), [shadowTex]);

  // Pyramid shell geometry
  const pyramidData = useMemo(() => {
    if (shape !== 'pyramid') return null;
    const a = base * scale;
    const h = height * scale;
    const half = a / 2;

    const A = new THREE.Vector3(-half, 0.08, half);
    const B = new THREE.Vector3(half, 0.08, half);
    const C = new THREE.Vector3(half, 0.08, -half);
    const D = new THREE.Vector3(-half, 0.08, -half);
    const O = new THREE.Vector3(0, 0.08, 0);
    const S = new THREE.Vector3(0, h + 0.08, 0);
    const M = new THREE.Vector3(0, 0.08, half);

    const shellGeom = new THREE.BufferGeometry();
    const verts = new Float32Array([
      A.x, A.y, A.z, B.x, B.y, B.z, S.x, S.y, S.z,
      B.x, B.y, B.z, C.x, C.y, C.z, S.x, S.y, S.z,
      C.x, C.y, C.z, D.x, D.y, D.z, S.x, S.y, S.z,
      D.x, D.y, D.z, A.x, A.y, A.z, S.x, S.y, S.z,
    ]);
    shellGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    shellGeom.computeVertexNormals();

    const cutY = 0.08 + h * (1 - cutRatio);
    const cutA = a * cutRatio;
    const ch = cutA / 2;
    const cutSquare: THREE.Vector3[] = [
      new THREE.Vector3(-ch, cutY, ch),
      new THREE.Vector3(ch, cutY, ch),
      new THREE.Vector3(ch, cutY, -ch),
      new THREE.Vector3(-ch, cutY, -ch),
      new THREE.Vector3(-ch, cutY, ch),
    ];

    return { a, h, half, A, B, C, D, O, S, M, shellGeom, cutY, cutA, ch, cutSquare };
  }, [shape, base, height, cutRatio]);

  useEffect(() => {
    return () => {
      pyramidData?.shellGeom.dispose();
    };
  }, [pyramidData]);

  // Projectile tube geometry
  const projectileData = useMemo(() => {
    if (shape !== 'projectile') return null;
    const v0 = sliderValues.velocity ?? params.velocity ?? 12;
    const deg = sliderValues.angle_deg ?? params.angle_deg ?? 45;
    const rad = (deg * Math.PI) / 180;
    const g = 9.81;
    const tFlight = (2 * v0 * Math.sin(rad)) / g;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * tFlight;
      const x = v0 * Math.cos(rad) * t * 0.35 - 3;
      const y = Math.max(0.05, (v0 * Math.sin(rad) * t - 0.5 * g * t * t) * 0.35 + 0.08);
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return { v0, deg, pts, peak: pts[Math.floor(pts.length * 0.5)] };
  }, [shape, sliderValues.velocity, sliderValues.angle_deg, params.velocity, params.angle_deg]);

  const vectorsData = useMemo(() => {
    if (shape !== 'vectors') return null;
    const ax = sliderValues.ax ?? 4;
    const ay = sliderValues.ay ?? 2;
    const bx = sliderValues.bx ?? 1.5;
    const bz = sliderValues.bz ?? 3.5;
    const O = new THREE.Vector3(0, 0.05, 0);
    const A = new THREE.Vector3(ax, ay, 0);
    const B = new THREE.Vector3(bx, 2, bz);
    const R = new THREE.Vector3().addVectors(A, B);
    return { ax, ay, bx, bz, O, A, B, R };
  }, [shape, sliderValues.ax, sliderValues.ay, sliderValues.bx, sliderValues.bz]);

  // Compute anchors, overview center, and THREE.Box3 bounds
  const { anchors, overview, boxes } = useMemo((): {
    anchors: Record<string, THREE.Vector3>;
    overview: THREE.Vector3;
    boxes: Record<string, THREE.Box3>;
  } => {
    if (shape === 'pyramid' && pyramidData) {
      const { a, h, half, O, S, M, cutY, ch } = pyramidData;
      const ov = new THREE.Vector3(0, h * 0.45, 0);
      return {
        anchors: {
          vertex_S: S.clone(),
          base_plane: O.clone().add(new THREE.Vector3(0, 0, half * 0.45)),
          height_axis: new THREE.Vector3(0, 0.08 + h * 0.52, 0),
          apothem: S.clone().lerp(M, 0.5),
          cut_section: new THREE.Vector3(a * cutRatio * 0.35, cutY, 0),
          overview: ov,
        },
        overview: ov,
        boxes: {
          vertex_S: new THREE.Box3().setFromCenterAndSize(S, new THREE.Vector3(0.8, 0.8, 0.8)),
          base_plane: new THREE.Box3(
            new THREE.Vector3(-half, 0, -half),
            new THREE.Vector3(half, 0.35, half)
          ),
          height_axis: new THREE.Box3(
            new THREE.Vector3(-0.35, 0.08, -0.35),
            new THREE.Vector3(0.35, h + 0.08, 0.35)
          ),
          apothem: new THREE.Box3().setFromPoints([S, M, O]),
          cut_section: new THREE.Box3(
            new THREE.Vector3(-ch, cutY - 0.12, -ch),
            new THREE.Vector3(ch, cutY + 0.12, ch)
          ),
          overview: new THREE.Box3(
            new THREE.Vector3(-half, 0, -half),
            new THREE.Vector3(half, h + 0.2, half)
          ),
        },
      };
    }
    if (shape === 'cone' || shape === 'cylinder') {
      const r = radius * scale;
      const h = height * scale;
      const ov = new THREE.Vector3(0, h * 0.45, 0);
      return {
        anchors: {
          vertex_S: new THREE.Vector3(0, 0.08 + h, 0),
          base_plane: new THREE.Vector3(r * 0.45, 0.1, 0),
          height_axis: new THREE.Vector3(0, 0.08 + h * 0.5, 0),
          cut_section: new THREE.Vector3(r * cutRatio * 0.5, 0.08 + h * (1 - cutRatio), 0),
          radius_r: new THREE.Vector3(r * 0.55, 0.2, 0.1),
          overview: ov,
        },
        overview: ov,
        boxes: {
          vertex_S: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(0, 0.08 + h, 0),
            new THREE.Vector3(0.8, 0.8, 0.8)
          ),
          base_plane: new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 0.3, r)),
          height_axis: new THREE.Box3(
            new THREE.Vector3(-0.35, 0.08, -0.35),
            new THREE.Vector3(0.35, h + 0.08, 0.35)
          ),
          cut_section: new THREE.Box3(
            new THREE.Vector3(-r * cutRatio, 0.08 + h * (1 - cutRatio) - 0.12, -r * cutRatio),
            new THREE.Vector3(r * cutRatio, 0.08 + h * (1 - cutRatio) + 0.12, r * cutRatio)
          ),
          radius_r: new THREE.Box3(new THREE.Vector3(0, 0, -0.3), new THREE.Vector3(r, 0.4, 0.3)),
          overview: new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, h + 0.2, r)),
        },
      };
    }
    if (shape === 'vectors' && vectorsData) {
      const { O, A, B, R } = vectorsData;
      const ov = new THREE.Vector3(R.x * 0.4, R.y * 0.4, R.z * 0.4);
      return {
        anchors: {
          vector_A: A.clone().multiplyScalar(0.65),
          vector_B: B.clone().multiplyScalar(0.65),
          resultant_R: R.clone().multiplyScalar(0.75),
          base_plane: O.clone(),
          overview: ov,
        },
        overview: ov,
        boxes: {
          vector_A: new THREE.Box3().setFromPoints([O, A]),
          vector_B: new THREE.Box3().setFromPoints([O, B]),
          resultant_R: new THREE.Box3().setFromPoints([O, R]),
          base_plane: new THREE.Box3().setFromCenterAndSize(O, new THREE.Vector3(0.8, 0.4, 0.8)),
          overview: new THREE.Box3().setFromPoints([O, A, B, R]),
        },
      };
    }
    if (shape === 'projectile' && projectileData) {
      const { pts, peak } = projectileData;
      const ov = new THREE.Vector3(0, 1.5, 0);
      return {
        anchors: {
          launch_point: pts[0].clone(),
          peak_height: peak.clone(),
          landing_point: pts[pts.length - 1].clone(),
          overview: ov,
        },
        overview: ov,
        boxes: {
          launch_point: new THREE.Box3().setFromCenterAndSize(pts[0], new THREE.Vector3(0.9, 0.9, 0.6)),
          peak_height: new THREE.Box3().setFromCenterAndSize(peak, new THREE.Vector3(1.1, 1.0, 0.6)),
          landing_point: new THREE.Box3().setFromCenterAndSize(
            pts[pts.length - 1],
            new THREE.Vector3(0.9, 0.9, 0.6)
          ),
          overview: new THREE.Box3().setFromPoints(pts),
        },
      };
    }
    if (shape === 'sphere') {
      const r = radius * scale;
      const ov = new THREE.Vector3(0, r + 0.2, 0);
      return {
        anchors: {
          radius_r: new THREE.Vector3(r * 0.65, r + 0.2, 0),
          base_plane: new THREE.Vector3(0, 0.2, 0),
          overview: ov,
        },
        overview: ov,
        boxes: {
          radius_r: new THREE.Box3(
            new THREE.Vector3(0, r, -0.3),
            new THREE.Vector3(r, r + 0.4, 0.3)
          ),
          base_plane: new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 0.4, r)),
          overview: new THREE.Box3(
            new THREE.Vector3(-r, 0.2, -r),
            new THREE.Vector3(r, r * 2 + 0.2, r)
          ),
        },
      };
    }
    const s = base * scale;
    const ov = new THREE.Vector3(0, s / 2, 0);
    return {
      anchors: {
        base_plane: new THREE.Vector3(s * 0.45, 0.2, s * 0.45),
        vertex_S: new THREE.Vector3(s * 0.45, s, s * 0.45),
        overview: ov,
      },
      overview: ov,
      boxes: {
        base_plane: new THREE.Box3(
          new THREE.Vector3(-s / 2, 0, -s / 2),
          new THREE.Vector3(s / 2, 0.35, s / 2)
        ),
        vertex_S: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(s * 0.45, s, s * 0.45),
          new THREE.Vector3(0.8, 0.8, 0.8)
        ),
        overview: new THREE.Box3(
          new THREE.Vector3(-s / 2, 0, -s / 2),
          new THREE.Vector3(s / 2, s + 0.1, s / 2)
        ),
      },
    };
  }, [shape, pyramidData, vectorsData, projectileData, radius, height, base, cutRatio]);

  useLayoutEffect(() => {
    onAnchorsReady(anchors, overview, boxes);
  }, [anchors, overview, boxes, onAnchorsReady]);

  const shouldDim = Boolean(dimInactiveParts && activeFocus && anchors[activeFocus]);
  const isPartFocused = (keys: string[]) => !shouldDim || (activeFocus ? keys.includes(activeFocus) : true);
  const partAlpha = (keys: string[], activeOpacity = 1) =>
    isPartFocused(keys) ? activeOpacity : Math.min(activeOpacity, 0.22);

  const r = radius * scale;
  const h = height * scale;
  const s = base * scale;

  return (
    <group>
      <gridHelper args={[14, 14, 0x94a3b8, 0xe2e8f0]} position={[0, 0.002, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.55} />
      </mesh>

      {shape === 'pyramid' && pyramidData && (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[pyramidData.a + 0.24, 0.08, pyramidData.a + 0.24]} />
            <meshStandardMaterial
              color="#e2e8f0"
              roughness={0.55}
              metalness={0.15}
              transparent={!isPartFocused(['base_plane'])}
              opacity={partAlpha(['base_plane'])}
            />
          </mesh>
          <mesh geometry={pyramidData.shellGeom} renderOrder={2}>
            <meshPhysicalMaterial
              color="#2563eb"
              roughness={0.18}
              metalness={0.05}
              transparent
              opacity={shouldDim ? 0.08 : 0.2}
              depthWrite={false}
              side={THREE.DoubleSide}
              clearcoat={0.9}
            />
          </mesh>
          <Line
            points={[pyramidData.A, pyramidData.B, pyramidData.C, pyramidData.D, pyramidData.A]}
            color="#2563eb"
            lineWidth={2.5}
            transparent={!isPartFocused(['base_plane'])}
            opacity={partAlpha(['base_plane'])}
          />
          {[pyramidData.A, pyramidData.B, pyramidData.C, pyramidData.D].map((pt, i) => (
            <React.Fragment key={`pyr-edge-${i}`}>
              <Line
                points={[pt, pyramidData.S]}
                color="#2563eb"
                lineWidth={2.4}
                transparent={!isPartFocused(['vertex_S'])}
                opacity={partAlpha(['vertex_S'])}
              />
              <mesh position={pt}>
                <sphereGeometry args={[0.085, 16, 16]} />
                <meshStandardMaterial
                  color="#1e293b"
                  roughness={0.25}
                  metalness={0.5}
                  transparent={!isPartFocused(['base_plane'])}
                  opacity={partAlpha(['base_plane'])}
                />
              </mesh>
            </React.Fragment>
          ))}
          <mesh position={pyramidData.S}>
            <sphereGeometry args={[0.095, 16, 16]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.25}
              metalness={0.5}
              transparent={!isPartFocused(['vertex_S', 'height_axis', 'apothem'])}
              opacity={partAlpha(['vertex_S', 'height_axis', 'apothem'])}
            />
          </mesh>

          {showHeight && (
            <>
              <FlowLineR3F
                points={[pyramidData.O, pyramidData.S]}
                color="#f59e0b"
                lineWidth={2.6}
                dashed
                dashSize={0.24}
                gapSize={0.14}
                transparent={!isPartFocused(['height_axis'])}
                opacity={partAlpha(['height_axis'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              <mesh position={pyramidData.O}>
                <cylinderGeometry args={[0.14, 0.14, 0.04, 18]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  roughness={0.22}
                  metalness={0.6}
                  transparent={!isPartFocused(['height_axis', 'base_plane'])}
                  opacity={partAlpha(['height_axis', 'base_plane'])}
                />
              </mesh>
              <StageLabel
                position={[0.35, pyramidData.h * 0.5, 0]}
                text={`h = ${height}`}
                accent
                visible={isPartFocused(['height_axis', 'apothem'])}
              />
            </>
          )}

          {showApothem && (
            <>
              <FlowLineR3F
                points={[pyramidData.S, pyramidData.M]}
                color="#10b981"
                lineWidth={2.8}
                transparent={!isPartFocused(['apothem'])}
                opacity={partAlpha(['apothem'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              <FlowLineR3F
                points={[pyramidData.O, pyramidData.M]}
                color="#10b981"
                lineWidth={2.2}
                transparent={!isPartFocused(['apothem'])}
                opacity={partAlpha(['apothem'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              <StageLabel
                position={pyramidData.M.clone().add(new THREE.Vector3(0, 0, 0.35))}
                text="M"
                visible={isPartFocused(['apothem'])}
              />
              <StageLabel
                position={pyramidData.S.clone().lerp(pyramidData.M, 0.5).add(new THREE.Vector3(0.25, 0, 0.25))}
                text="l"
                accent
                visible={isPartFocused(['apothem'])}
              />
            </>
          )}

          {showCut && (
            <>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, pyramidData.cutY, 0]}
                renderOrder={3}
              >
                <planeGeometry args={[pyramidData.cutA, pyramidData.cutA]} />
                <meshPhysicalMaterial
                  color="#f43f5e"
                  roughness={0.22}
                  metalness={0.08}
                  transparent
                  opacity={partAlpha(['cut_section'], 0.38)}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <FlowLineR3F
                points={pyramidData.cutSquare}
                color="#f43f5e"
                lineWidth={2.8}
                transparent={!isPartFocused(['cut_section'])}
                opacity={partAlpha(['cut_section'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              <StageLabel
                position={[pyramidData.ch + 0.45, pyramidData.cutY, 0]}
                text={`a' = ${(base * cutRatio).toFixed(1)}`}
                accent
                visible={isPartFocused(['cut_section'])}
              />
            </>
          )}

          <StageLabel
            position={pyramidData.A.clone().add(new THREE.Vector3(-0.3, 0.1, 0.3))}
            text="A"
            visible={!shouldDim || isPartFocused(['base_plane'])}
          />
          <StageLabel
            position={pyramidData.B.clone().add(new THREE.Vector3(0.3, 0.1, 0.3))}
            text="B"
            visible={!shouldDim || isPartFocused(['base_plane'])}
          />
          <StageLabel
            position={pyramidData.C.clone().add(new THREE.Vector3(0.3, 0.1, -0.3))}
            text="C"
            visible={!shouldDim || isPartFocused(['base_plane'])}
          />
          <StageLabel
            position={pyramidData.D.clone().add(new THREE.Vector3(-0.3, 0.1, -0.3))}
            text="D"
            visible={!shouldDim || isPartFocused(['base_plane'])}
          />
          <StageLabel
            position={pyramidData.S.clone().add(new THREE.Vector3(0, 0.45, 0))}
            text="S"
            accent
            visible={!shouldDim || isPartFocused(['vertex_S', 'height_axis'])}
          />
          <StageLabel
            position={pyramidData.O.clone().add(new THREE.Vector3(-0.3, 0.15, -0.25))}
            text="O"
            visible={!shouldDim || isPartFocused(['base_plane', 'height_axis'])}
          />
        </group>
      )}

      {(shape === 'cone' || shape === 'cylinder') && (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[r + 0.16, r + 0.22, 0.08, 40]} />
            <meshStandardMaterial
              color="#e2e8f0"
              roughness={0.55}
              metalness={0.15}
              transparent={!isPartFocused(['base_plane'])}
              opacity={partAlpha(['base_plane'])}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <torusGeometry args={[r, 0.035, 12, 48]} />
            <meshStandardMaterial
              color="#2563eb"
              roughness={0.28}
              metalness={0.55}
              transparent={!isPartFocused(['base_plane', 'radius_r'])}
              opacity={partAlpha(['base_plane', 'radius_r'])}
            />
          </mesh>

          {shape === 'cone' ? (
            <>
              <mesh position={[0, 0.08 + h / 2, 0]} renderOrder={2}>
                <coneGeometry args={[r, h, 40, 1, true]} />
                <meshPhysicalMaterial
                  color="#2563eb"
                  roughness={0.18}
                  metalness={0.05}
                  transparent
                  opacity={shouldDim ? 0.08 : 0.2}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                  clearcoat={0.9}
                />
              </mesh>
              <FlowLineR3F
                points={[new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, 0.08 + h, 0)]}
                color="#f59e0b"
                lineWidth={2.5}
                dashed
                dashSize={0.22}
                gapSize={0.12}
                transparent={!isPartFocused(['height_axis'])}
                opacity={partAlpha(['height_axis'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              <Line
                points={[
                  new THREE.Vector3(0, 0.08, 0),
                  new THREE.Vector3(r, 0.08, 0),
                  new THREE.Vector3(0, 0.08 + h, 0),
                ]}
                color="#2563eb"
                lineWidth={2.4}
                transparent={!isPartFocused(['radius_r', 'base_plane'])}
                opacity={partAlpha(['radius_r', 'base_plane'])}
              />
              <mesh position={[0, 0.08 + h, 0]}>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshStandardMaterial
                  color="#1e293b"
                  roughness={0.25}
                  metalness={0.5}
                  transparent={!isPartFocused(['vertex_S'])}
                  opacity={partAlpha(['vertex_S'])}
                />
              </mesh>
              {showCut && (
                <>
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.08 + h * (1 - cutRatio), 0]}
                    renderOrder={3}
                  >
                    <circleGeometry args={[r * cutRatio, 40]} />
                    <meshPhysicalMaterial
                      color="#f43f5e"
                      roughness={0.22}
                      transparent
                      opacity={partAlpha(['cut_section'], 0.38)}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                  <mesh
                    rotation={[Math.PI / 2, 0, 0]}
                    position={[0, 0.08 + h * (1 - cutRatio), 0]}
                  >
                    <torusGeometry args={[r * cutRatio, 0.036, 12, 48]} />
                    <meshStandardMaterial
                      color="#f43f5e"
                      roughness={0.28}
                      metalness={0.45}
                      transparent={!isPartFocused(['cut_section'])}
                      opacity={partAlpha(['cut_section'])}
                    />
                  </mesh>
                </>
              )}
              <StageLabel
                position={[0, 0.08 + h + 0.4, 0]}
                text="S"
                accent
                visible={!shouldDim || isPartFocused(['vertex_S'])}
              />
              <StageLabel
                position={[0.35, h * 0.5, 0]}
                text={`h=${height}`}
                accent
                visible={!shouldDim || isPartFocused(['height_axis'])}
              />
              <StageLabel
                position={[r * 0.5, 0.3, 0.2]}
                text={`r=${radius}`}
                visible={!shouldDim || isPartFocused(['radius_r', 'base_plane'])}
              />
            </>
          ) : (
            <>
              <mesh position={[0, 0.08 + h / 2, 0]} renderOrder={2}>
                <cylinderGeometry args={[r, r, h, 40, 1, true]} />
                <meshPhysicalMaterial
                  color="#2563eb"
                  roughness={0.18}
                  metalness={0.05}
                  transparent
                  opacity={shouldDim ? 0.08 : 0.2}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                  clearcoat={0.9}
                />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08 + h, 0]}>
                <torusGeometry args={[r, 0.035, 12, 48]} />
                <meshStandardMaterial
                  color="#2563eb"
                  roughness={0.28}
                  metalness={0.55}
                  transparent={!isPartFocused(['vertex_S'])}
                  opacity={partAlpha(['vertex_S'])}
                />
              </mesh>
              <FlowLineR3F
                points={[new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, 0.08 + h, 0)]}
                color="#f59e0b"
                lineWidth={2.4}
                dashed
                dashSize={0.22}
                gapSize={0.12}
                transparent={!isPartFocused(['height_axis'])}
                opacity={partAlpha(['height_axis'])}
                flowType={flowType}
                flowSpeed={flowSpeed}
                flowReverse={flowReverse}
                isPlaying={isPlaying}
              />
              {showCut && (
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, 0.08 + h * cutRatio, 0]}
                  renderOrder={3}
                >
                  <circleGeometry args={[r, 40]} />
                  <meshPhysicalMaterial
                    color="#f43f5e"
                    roughness={0.22}
                    transparent
                    opacity={partAlpha(['cut_section'], 0.38)}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}
              <StageLabel
                position={[0.35, h * 0.5, 0]}
                text={`h=${height}`}
                accent
                visible={!shouldDim || isPartFocused(['height_axis'])}
              />
              <StageLabel
                position={[r * 0.55, 0.3, 0.2]}
                text={`r=${radius}`}
                visible={!shouldDim || isPartFocused(['radius_r', 'base_plane'])}
              />
            </>
          )}
        </group>
      )}

      {shape === 'vectors' && vectorsData && (
        <group>
          <mesh position={vectorsData.O}>
            <cylinderGeometry args={[0.32, 0.4, 0.14, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.55} metalness={0.15} />
          </mesh>
          <Line points={[vectorsData.O, new THREE.Vector3(6, 0.05, 0)]} color="#94a3b8" lineWidth={1.6} />
          <Line points={[vectorsData.O, new THREE.Vector3(0, 6, 0)]} color="#94a3b8" lineWidth={1.6} />
          <Line points={[vectorsData.O, new THREE.Vector3(0, 0.05, 6)]} color="#94a3b8" lineWidth={1.6} />

          <VectorArrowR3F
            origin={vectorsData.O}
            vec={vectorsData.A}
            color="#2563eb"
            label={`A(${vectorsData.ax}, ${vectorsData.ay}, 0)`}
            opacity={partAlpha(['vector_A'])}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
          <VectorArrowR3F
            origin={vectorsData.O}
            vec={vectorsData.B}
            color="#10b981"
            label={`B(${vectorsData.bx}, 2, ${vectorsData.bz})`}
            opacity={partAlpha(['vector_B'])}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
          <VectorArrowR3F
            origin={vectorsData.O}
            vec={vectorsData.R}
            color="#f43f5e"
            label="R = A + B"
            accent
            opacity={partAlpha(['resultant_R'])}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />

          <FlowLineR3F
            points={[vectorsData.O.clone().add(vectorsData.A), vectorsData.O.clone().add(vectorsData.R)]}
            color="#f59e0b"
            lineWidth={1.8}
            dashed
            dashSize={0.22}
            gapSize={0.12}
            transparent
            opacity={partAlpha(['resultant_R'], 0.65)}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
          <FlowLineR3F
            points={[vectorsData.O.clone().add(vectorsData.B), vectorsData.O.clone().add(vectorsData.R)]}
            color="#f59e0b"
            lineWidth={1.8}
            dashed
            dashSize={0.22}
            gapSize={0.12}
            transparent
            opacity={partAlpha(['resultant_R'], 0.65)}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
        </group>
      )}

      {shape === 'projectile' && projectileData && (
        <group>
          <FlowLineR3F
            points={projectileData.pts}
            color="#f43f5e"
            lineWidth={3.2}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
          />
          <mesh position={projectileData.peak}>
            <sphereGeometry args={[0.24, 24, 24]} />
            <meshStandardMaterial
              color="#2563eb"
              roughness={0.28}
              metalness={0.55}
              transparent={!isPartFocused(['peak_height'])}
              opacity={partAlpha(['peak_height'])}
            />
          </mesh>
          <StageLabel
            position={projectileData.peak.clone().add(new THREE.Vector3(0, 0.6, 0))}
            text={`α=${projectileData.deg}°, v₀=${projectileData.v0} m/s`}
            accent
            visible={!shouldDim || isPartFocused(['peak_height'])}
          />
        </group>
      )}

      {shape === 'sphere' && (
        <group>
          <mesh position={[0, r + 0.2, 0]}>
            <sphereGeometry args={[r, 36, 36]} />
            <meshPhysicalMaterial
              color="#2563eb"
              roughness={0.18}
              metalness={0.05}
              transparent
              opacity={shouldDim ? 0.1 : 0.2}
              depthWrite={false}
              side={THREE.DoubleSide}
              clearcoat={0.9}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, r + 0.2, 0]}>
            <torusGeometry args={[r, 0.03, 12, 48]} />
            <meshStandardMaterial
              color="#f43f5e"
              roughness={0.28}
              metalness={0.45}
              transparent={!isPartFocused(['radius_r'])}
              opacity={partAlpha(['radius_r'])}
            />
          </mesh>
          <StageLabel
            position={[r * 0.6, r + 0.4, 0]}
            text={`r = ${radius}`}
            accent
            visible={!shouldDim || isPartFocused(['radius_r'])}
          />
        </group>
      )}

      {shape !== 'pyramid' &&
        shape !== 'cone' &&
        shape !== 'cylinder' &&
        shape !== 'vectors' &&
        shape !== 'projectile' &&
        shape !== 'sphere' && (
          <group>
            <mesh position={[0, s / 2 + 0.08, 0]}>
              <boxGeometry args={[s, s, s]} />
              <meshPhysicalMaterial
                color="#2563eb"
                roughness={0.18}
                metalness={0.05}
                transparent
                opacity={0.2}
                depthWrite={false}
                side={THREE.DoubleSide}
                clearcoat={0.9}
              />
            </mesh>
            <Line
              points={[
                [-s / 2, 0.08, s / 2],
                [s / 2, 0.08, s / 2],
                [s / 2, 0.08, -s / 2],
                [-s / 2, 0.08, -s / 2],
                [-s / 2, 0.08, s / 2],
                [-s / 2, s + 0.08, s / 2],
                [s / 2, s + 0.08, s / 2],
                [s / 2, 0.08, s / 2],
                [s / 2, s + 0.08, s / 2],
                [s / 2, s + 0.08, -s / 2],
                [s / 2, 0.08, -s / 2],
                [s / 2, s + 0.08, -s / 2],
                [-s / 2, s + 0.08, -s / 2],
                [-s / 2, 0.08, -s / 2],
                [-s / 2, s + 0.08, -s / 2],
                [-s / 2, s + 0.08, s / 2],
              ]}
              color="#2563eb"
              lineWidth={2.2}
            />
            <StageLabel position={[s * 0.55, 0.3, s * 0.55]} text={`a = ${base}`} />
          </group>
        )}
    </group>
  );
};
