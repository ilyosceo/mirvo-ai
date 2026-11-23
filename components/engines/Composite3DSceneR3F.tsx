import React, { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges, useGLTF } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type {
  Custom3DObject,
  FlowType,
  PartAnimationType,
  Primitive3DItem,
  RenderParams,
} from '../../types/tutor';
import { FlowLineR3F } from './FlowLineR3F';
import { SafeLabel3D } from './SafeLabel3D';

interface Composite3DSceneR3FProps {
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

interface ExtrudedSvgMesh {
  geometry: THREE.ExtrudeGeometry;
  color: string;
  zOffset: number;
  partKey: string;
  center: THREE.Vector3;
  box: THREE.Box3;
}

const StageLabel3D: React.FC<{ position: [number, number, number]; text: string }> = ({
  position,
  text,
}) => <SafeLabel3D position={position} text={text} className="ziyo-3d-label" />;

function matchesPartKey(candidate: string, activeFocus?: string): boolean {
  if (!activeFocus) return true;
  const c = candidate.toLowerCase().trim();
  const f = activeFocus.toLowerCase().trim();
  if (!c || !f) return false;
  return c === f || c.includes(f) || f.includes(c);
}

class GlbErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const GltfModelR3F: React.FC<{
  url: string;
  userScale: number;
  activeFocus?: string;
  shouldDim?: boolean;
  onModelAnchorsReady?: (
    anchors: Record<string, THREE.Vector3>,
    overview: THREE.Vector3,
    boxes: Record<string, THREE.Box3>
  ) => void;
}> = ({ url, userScale, activeFocus, shouldDim = false, onModelAnchorsReady }) => {
  const gltf = useGLTF(url);
  const { clonedScene, modelAnchors, modelOverview, modelBoxes, meshParts } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const normScale = (3.4 / maxDim) * userScale;
    clone.scale.setScalar(normScale);
    clone.position.set(
      -center.x * normScale,
      -box.min.y * normScale + 0.1,
      -center.z * normScale
    );
    clone.updateMatrixWorld(true);

    const outAnchors: Record<string, THREE.Vector3> = {};
    const outBoxes: Record<string, THREE.Box3> = {};
    const globalWorldBox = new THREE.Box3();
    const collectedMeshes: Array<{ mesh: THREE.Mesh; partKey: string; matOrigOpacity: number }> = [];
    let meshIdx = 0;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const rawKey = (mesh.name || mesh.parent?.name || `part_${meshIdx}`).trim();
        const partKey = rawKey.toLowerCase().replace(/\s+/g, '_');
        const mBox = new THREE.Box3().setFromObject(mesh);
        if (!mBox.isEmpty()) {
          globalWorldBox.union(mBox);
          if (!outBoxes[partKey]) outBoxes[partKey] = mBox.clone();
          else outBoxes[partKey].union(mBox);
          const idxKey = `part_${Math.min(2, meshIdx)}`;
          if (!outBoxes[idxKey]) outBoxes[idxKey] = mBox.clone();
        }
        // Clone materials per mesh so opacity/emissive focusing never mutates cached assets
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
        const firstMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        collectedMeshes.push({
          mesh,
          partKey,
          matOrigOpacity: firstMat?.opacity ?? 1,
        });
        meshIdx += 1;
      }
    });

    for (const [k, b] of Object.entries(outBoxes)) {
      outAnchors[k] = b.getCenter(new THREE.Vector3());
    }
    const overviewPt = globalWorldBox.isEmpty()
      ? new THREE.Vector3(0, 1.7, 0)
      : globalWorldBox.getCenter(new THREE.Vector3());
    outAnchors.overview = overviewPt;
    outBoxes.overview = globalWorldBox.isEmpty()
      ? new THREE.Box3(new THREE.Vector3(-1.4, 0, -1.4), new THREE.Vector3(1.4, 3.0, 1.4))
      : globalWorldBox;

    return {
      clonedScene: clone,
      modelAnchors: outAnchors,
      modelOverview: overviewPt,
      modelBoxes: outBoxes,
      meshParts: collectedMeshes,
    };
  }, [gltf.scene, userScale]);

  useLayoutEffect(() => {
    if (onModelAnchorsReady) {
      onModelAnchorsReady(modelAnchors, modelOverview, modelBoxes);
    }
  }, [modelAnchors, modelOverview, modelBoxes, onModelAnchorsReady]);

  useEffect(() => {
    if (meshParts.length === 0) return;
    const anyMatched = Boolean(
      activeFocus && meshParts.some((m, idx) => matchesPartKey(m.partKey, activeFocus) || `part_${Math.min(2, idx)}` === activeFocus)
    );
    meshParts.forEach((entry, idx) => {
      const isFocused =
        !shouldDim ||
        !anyMatched ||
        !activeFocus ||
        matchesPartKey(entry.partKey, activeFocus) ||
        `part_${Math.min(2, idx)}` === activeFocus;
      const mats = Array.isArray(entry.mesh.material)
        ? entry.mesh.material
        : entry.mesh.material
        ? [entry.mesh.material]
        : [];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        const targetOp = isFocused ? entry.matOrigOpacity : Math.min(entry.matOrigOpacity, 0.14);
        std.transparent = targetOp < 0.99;
        std.depthWrite = targetOp >= 0.99;
        std.opacity = targetOp;
        if ('emissive' in std && std.emissive) {
          std.emissive.set(anyMatched && shouldDim && isFocused ? '#F59E0B' : '#000000');
          std.emissiveIntensity = anyMatched && shouldDim && isFocused ? 0.25 : 0;
        }
        std.needsUpdate = true;
      }
    });
  }, [meshParts, activeFocus, shouldDim]);

  return <primitive object={clonedScene} />;
};

function buildProceduralGeometry(
  type: string,
  args: number[],
  points?: [number, number, number][],
  profile?: [number, number][]
): THREE.BufferGeometry | null {
  if (type === 'rounded_box') {
    const w = args[0] ?? 1.2;
    const h = args[1] ?? 1.2;
    const d = args[2] ?? 1.2;
    const r = Math.min(args[3] ?? 0.14, Math.min(w, h, d) * 0.42);
    return new RoundedBoxGeometry(w, h, d, 4, r);
  }
  if (type === 'tube') {
    const rawPts =
      points && points.length >= 2
        ? points
        : [
            [-0.8, 0, 0],
            [-0.25, 0.65, 0.25],
            [0.35, 0.25, -0.25],
            [0.9, 0.85, 0],
          ];
    const vecPts = rawPts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vecPts);
    const radius = args[0] ?? 0.12;
    const tubularSegs = Math.max(12, Math.round(args[1] ?? 32));
    const radialSegs = Math.max(8, Math.round(args[2] ?? 12));
    return new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
  }
  if (type === 'lathe') {
    const rawProfile =
      profile && profile.length >= 2
        ? profile
        : [
            [0.01, 0],
            [0.65, 0.15],
            [0.42, 0.75],
            [0.75, 1.3],
            [0.2, 1.6],
          ];
    const vec2Pts = rawProfile.map((p) => new THREE.Vector2(Math.max(0.005, p[0]), p[1]));
    const segments = Math.max(12, Math.round(args[0] ?? 28));
    return new THREE.LatheGeometry(vec2Pts, segments);
  }
  return null;
}

function estimatePrimitiveBox(item: Primitive3DItem, userScale: number): THREE.Box3 {
  const [px, py, pz] = item.position;
  const a = item.args || [];
  let hx = 0.6;
  let hy = 0.6;
  let hz = 0.6;
  if (item.type === 'box' || item.type === 'rounded_box') {
    hx = (a[0] ?? 1) / 2;
    hy = (a[1] ?? 1) / 2;
    hz = (a[2] ?? 1) / 2;
  } else if (item.type === 'cylinder') {
    const r = Math.max(a[0] ?? 0.4, a[1] ?? 0.5);
    hx = r;
    hz = r;
    hy = (a[2] ?? 1.5) / 2;
  } else if (item.type === 'capsule') {
    const r = a[0] ?? 0.35;
    const len = a[1] ?? 0.9;
    hx = r;
    hz = r;
    hy = len / 2 + r;
  } else if (item.type === 'sphere' || item.type === 'octahedron' || item.type === 'dodecahedron') {
    const r = a[0] ?? 1;
    hx = r;
    hy = r;
    hz = r;
  } else if (item.type === 'cone') {
    const r = a[0] ?? 1;
    hx = r;
    hz = r;
    hy = (a[1] ?? 1.6) / 2;
  } else if (item.type === 'torus' || item.type === 'ring') {
    const r = (a[0] ?? 0.8) + (a[1] ?? 0.22);
    hx = r;
    hy = r;
    hz = a[1] ?? 0.22;
  } else if (item.type === 'tube' && item.points && item.points.length > 0) {
    const b = new THREE.Box3();
    const pad = (a[0] ?? 0.14) + 0.1;
    item.points.forEach((pt) => {
      b.expandByPoint(
        new THREE.Vector3(
          (px + pt[0]) * userScale,
          (py + pt[1]) * userScale,
          (pz + pt[2]) * userScale
        )
      );
    });
    b.expandByScalar(pad * userScale);
    return b;
  } else if (item.type === 'lathe' && item.profile && item.profile.length > 0) {
    let maxR = 0.4;
    let minY = 0;
    let maxY = 1;
    item.profile.forEach((pr) => {
      maxR = Math.max(maxR, pr[0]);
      minY = Math.min(minY, pr[1]);
      maxY = Math.max(maxY, pr[1]);
    });
    hx = maxR;
    hz = maxR;
    hy = Math.max(0.4, (maxY - minY) / 2);
  }

  // Approximate rotated half-extents conservatively so Box3 contains rotated parts
  const maxSpan = Math.max(hx, hy, hz);
  const [rx, ry, rz] = item.rotation || [0, 0, 0];
  const hasRot = Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05 || Math.abs(rz) > 0.05;
  const ex = (hasRot ? maxSpan * 0.92 : hx) * userScale;
  const ey = (hasRot ? maxSpan * 0.92 : hy) * userScale;
  const ez = (hasRot ? maxSpan * 0.92 : hz) * userScale;

  const center = new THREE.Vector3(px * userScale, py * userScale, pz * userScale);
  return new THREE.Box3(
    new THREE.Vector3(center.x - ex, center.y - ey, center.z - ez),
    new THREE.Vector3(center.x + ex, center.y + ey, center.z + ez)
  );
}

function applyKinematicAnimation(
  group: THREE.Group,
  phase: number,
  animation: PartAnimationType | undefined,
  axis: 'x' | 'y' | 'z' | undefined,
  amp: number | undefined
): void {
  if (!animation || animation === 'none') return;
  if (animation === 'spin' || animation === 'spin_reverse') {
    const dir = animation === 'spin_reverse' ? -1 : 1;
    const ax = axis || 'z';
    if (ax === 'x') group.rotation.x = phase * dir;
    else if (ax === 'y') group.rotation.y = phase * dir;
    else group.rotation.z = phase * dir;
  } else if (animation === 'oscillate_y') {
    group.position.y = Math.sin(phase * 2.2) * (amp ?? 0.22);
  } else if (animation === 'oscillate_x') {
    group.position.x = Math.sin(phase * 2.2) * (amp ?? 0.22);
  } else if (animation === 'pulse_scale') {
    const s = 1 + Math.sin(phase * 3.0) * (amp ?? 0.14);
    group.scale.setScalar(s);
  } else if (animation === 'orbit') {
    const r = amp ?? 0.35;
    group.position.x = Math.cos(phase) * r;
    group.position.z = Math.sin(phase) * r;
  }
}

const PrimitiveMesh: React.FC<{
  item: Primitive3DItem;
  isDimmed: boolean;
  isFocused: boolean;
  isPlaying: boolean;
}> = ({ item, isDimmed, isFocused, isPlaying }) => {
  const {
    type,
    position,
    rotation = [0, 0, 0],
    args,
    points,
    profile,
    color,
    opacity = 1,
    roughness = 0.42,
    metalness = 0.1,
    label,
    animation,
    animationAxis,
    animationSpeed = 1.4,
    animationAmp,
    animationPivot,
  } = item;
  const finalOpacity = isDimmed ? Math.min(opacity, 0.13) : opacity;
  const isTransparent = finalOpacity < 0.99;

  const animGroupRef = useRef<THREE.Group | null>(null);
  const phaseRef = useRef(0);

  const customGeom = useMemo(
    () => buildProceduralGeometry(type, args, points, profile),
    [type, args, points, profile]
  );

  useEffect(() => {
    return () => {
      customGeom?.dispose();
    };
  }, [customGeom]);

  useFrame((_, delta) => {
    if (!isPlaying || !animation || animation === 'none' || !animGroupRef.current) return;
    const dt = Math.min(delta, 0.05);
    phaseRef.current += dt * (animationSpeed || 1.4);
    applyKinematicAnimation(
      animGroupRef.current,
      phaseRef.current,
      animation,
      animationAxis,
      animationAmp
    );
  });

  const pivotPos: [number, number, number] = animationPivot || position;
  const localPos: [number, number, number] = animationPivot
    ? [
        position[0] - animationPivot[0],
        position[1] - animationPivot[1],
        position[2] - animationPivot[2],
      ]
    : [0, 0, 0];

  return (
    <group position={pivotPos}>
      <group ref={animGroupRef}>
        <group position={localPos} rotation={rotation}>
          <mesh
            geometry={customGeom || undefined}
            castShadow={!isDimmed}
            receiveShadow
          >
            {!customGeom && type === 'cylinder' && (
              <cylinderGeometry
                args={[args[0] ?? 0.4, args[1] ?? 0.5, args[2] ?? 1.5, args[3] ?? 24]}
              />
            )}
            {!customGeom && type === 'capsule' && (
              <capsuleGeometry args={[args[0] ?? 0.35, args[1] ?? 0.9, 8, 18]} />
            )}
            {!customGeom && type === 'sphere' && (
              <sphereGeometry args={[args[0] ?? 1, args[1] ?? 24, args[2] ?? 24]} />
            )}
            {!customGeom && type === 'cone' && (
              <coneGeometry args={[args[0] ?? 1, args[1] ?? 1.6, args[2] ?? 24]} />
            )}
            {!customGeom && type === 'box' && (
              <boxGeometry args={[args[0] ?? 1, args[1] ?? 1, args[2] ?? 1]} />
            )}
            {!customGeom && (type === 'torus' || type === 'ring') && (
              <torusGeometry
                args={[
                  args[0] ?? 0.8,
                  type === 'ring' ? args[1] ?? 0.08 : args[1] ?? 0.22,
                  args[2] ?? 14,
                  args[3] ?? 32,
                ]}
              />
            )}
            {!customGeom && type === 'octahedron' && (
              <octahedronGeometry args={[args[0] ?? 0.8, args[1] ?? 0]} />
            )}
            {!customGeom && type === 'dodecahedron' && (
              <dodecahedronGeometry args={[args[0] ?? 0.8, args[1] ?? 0]} />
            )}
            <meshPhysicalMaterial
              color={color}
              roughness={roughness}
              metalness={metalness}
              clearcoat={opacity < 0.9 ? 0.6 : 0.24}
              clearcoatRoughness={0.28}
              emissive={isFocused ? color : '#000000'}
              emissiveIntensity={isFocused ? 0.26 : 0}
              transparent={isTransparent}
              depthWrite={!isTransparent}
              opacity={finalOpacity}
            />
            {isFocused && !isTransparent && (
              <Edges threshold={20} color="#F59E0B" />
            )}
          </mesh>
          {label && !isDimmed && <StageLabel3D position={[0.75, 0.35, 0]} text={label} />}
        </group>
      </group>
    </group>
  );
};

const UP_AXIS = new THREE.Vector3(0, 1, 0);

const CustomVectorArrow3D: React.FC<{
  obj: Custom3DObject;
  isDimmed: boolean;
}> = ({ obj, isDimmed }) => {
  const fromArr = obj.from || [0, 0, 0];
  const toArr = obj.to || obj.position || [1.8, 1.8, 0];
  const { midpoint, quaternion, shaftLen, headLen, tipPos, headPos } = useMemo(() => {
    const start = new THREE.Vector3(fromArr[0], fromArr[1], fromArr[2]);
    const end = new THREE.Vector3(toArr[0], toArr[1], toArr[2]);
    const dir = end.clone().sub(start);
    const totalLen = Math.max(0.25, dir.length());
    const hLen = Math.min(0.45, totalLen * 0.28);
    const sLen = Math.max(0.08, totalLen - hLen);
    const normDir = totalLen > 0.001 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, normDir);
    const mid = start.clone().addScaledVector(normDir, sLen * 0.5);
    const hPos = start.clone().addScaledVector(normDir, sLen + hLen * 0.5);
    return {
      midpoint: [mid.x, mid.y, mid.z] as [number, number, number],
      headPos: [hPos.x, hPos.y, hPos.z] as [number, number, number],
      tipPos: [end.x, end.y + 0.28, end.z] as [number, number, number],
      quaternion: quat,
      shaftLen: sLen,
      headLen: hLen,
    };
  }, [fromArr[0], fromArr[1], fromArr[2], toArr[0], toArr[1], toArr[2]]);

  const color = obj.color || '#F59E0B';
  const finalOpacity = isDimmed ? 0.25 : obj.opacity ?? 1;
  const isTransparent = finalOpacity < 0.99;

  return (
    <group>
      <mesh position={midpoint} quaternion={quaternion} castShadow={!isDimmed}>
        <cylinderGeometry args={[0.055, 0.055, shaftLen, 14]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.12}
          transparent={isTransparent}
          depthWrite={!isTransparent}
          opacity={finalOpacity}
        />
      </mesh>
      <mesh position={headPos} quaternion={quaternion} castShadow={!isDimmed}>
        <coneGeometry args={[0.16, headLen, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.32}
          metalness={0.15}
          transparent={isTransparent}
          depthWrite={!isTransparent}
          opacity={finalOpacity}
        />
      </mesh>
      {obj.label && !isDimmed && <StageLabel3D position={tipPos} text={obj.label} />}
    </group>
  );
};

const CustomSceneObjectMesh: React.FC<{
  obj: Custom3DObject;
  isDimmed: boolean;
  isFocused: boolean;
  isPlaying: boolean;
}> = ({ obj, isDimmed, isFocused, isPlaying }) => {
  const args = obj.args || [];
  const animGroupRef = useRef<THREE.Group | null>(null);
  const phaseRef = useRef(0);

  const customGeom = useMemo(
    () => buildProceduralGeometry(obj.type, args, obj.points, obj.profile),
    [obj.type, args, obj.points, obj.profile]
  );

  useEffect(() => {
    return () => {
      customGeom?.dispose();
    };
  }, [customGeom]);

  useFrame((_, delta) => {
    if (!isPlaying || !obj.animation || obj.animation === 'none' || !animGroupRef.current) return;
    const dt = Math.min(delta, 0.05);
    phaseRef.current += dt * (obj.animationSpeed || 1.4);
    applyKinematicAnimation(
      animGroupRef.current,
      phaseRef.current,
      obj.animation,
      obj.animationAxis,
      obj.animationAmp
    );
  });

  if (obj.type === 'vector' || obj.type === 'arrow') {
    return <CustomVectorArrow3D obj={obj} isDimmed={isDimmed} />;
  }
  if (obj.type === 'axis') {
    const len = (obj.args && obj.args[0]) || 4;
    return <axesHelper args={[len]} position={obj.position || [0, 0, 0]} />;
  }

  const pos = obj.position || [0, 0.8, 0];
  const rot = obj.rotation || [0, 0, 0];
  const scaleArr: [number, number, number] = Array.isArray(obj.scale)
    ? obj.scale
    : typeof obj.scale === 'number'
    ? [obj.scale, obj.scale, obj.scale]
    : [1, 1, 1];
  const color = obj.color || '#2563EB';
  const finalOpacity = isDimmed ? Math.min(obj.opacity ?? 1, 0.13) : obj.opacity ?? 1;
  const isTransparent = finalOpacity < 0.99;

  const pivotPos: [number, number, number] = obj.animationPivot || pos;
  const localPos: [number, number, number] = obj.animationPivot
    ? [
        pos[0] - obj.animationPivot[0],
        pos[1] - obj.animationPivot[1],
        pos[2] - obj.animationPivot[2],
      ]
    : [0, 0, 0];

  return (
    <group position={pivotPos}>
      <group ref={animGroupRef}>
        <group position={localPos} rotation={rot} scale={scaleArr}>
          <mesh geometry={customGeom || undefined} castShadow={!isDimmed} receiveShadow>
            {!customGeom && obj.type === 'box' && (
              <boxGeometry args={[args[0] ?? 1.2, args[1] ?? 1.2, args[2] ?? 1.2]} />
            )}
            {!customGeom && obj.type === 'cylinder' && (
              <cylinderGeometry
                args={[args[0] ?? 0.5, args[1] ?? args[0] ?? 0.5, args[2] ?? 1.6, args[3] ?? 24]}
              />
            )}
            {!customGeom && obj.type === 'capsule' && (
              <capsuleGeometry args={[args[0] ?? 0.35, args[1] ?? 0.9, 8, 18]} />
            )}
            {!customGeom && obj.type === 'sphere' && (
              <sphereGeometry args={[args[0] ?? 0.85, args[1] ?? 24, args[2] ?? 24]} />
            )}
            {!customGeom && obj.type === 'cone' && (
              <coneGeometry args={[args[0] ?? 0.85, args[1] ?? 1.6, args[2] ?? 24]} />
            )}
            {!customGeom && (obj.type === 'torus' || obj.type === 'ring') && (
              <torusGeometry
                args={[
                  args[0] ?? 0.9,
                  obj.type === 'ring' ? args[1] ?? 0.08 : args[1] ?? 0.24,
                  args[2] ?? 16,
                  args[3] ?? 32,
                ]}
              />
            )}
            {!customGeom && obj.type === 'octahedron' && (
              <octahedronGeometry args={[args[0] ?? 0.85, args[1] ?? 0]} />
            )}
            {!customGeom && obj.type === 'dodecahedron' && (
              <dodecahedronGeometry args={[args[0] ?? 0.85, args[1] ?? 0]} />
            )}
            {!customGeom && obj.type === 'plane' && (
              <boxGeometry args={[args[0] ?? 3.2, 0.08, args[1] ?? 3.2]} />
            )}
            <meshPhysicalMaterial
              color={color}
              roughness={obj.roughness ?? 0.36}
              metalness={obj.metalness ?? 0.1}
              clearcoat={(obj.opacity ?? 1) < 0.9 ? 0.55 : 0.24}
              clearcoatRoughness={0.28}
              emissive={isFocused ? color : '#000000'}
              emissiveIntensity={isFocused ? 0.24 : 0}
              transparent={isTransparent}
              depthWrite={!isTransparent}
              opacity={finalOpacity}
            />
            {isFocused && !isTransparent && <Edges threshold={20} color="#F59E0B" />}
          </mesh>
          {obj.label && !isDimmed && <StageLabel3D position={[0, 0.9, 0]} text={obj.label} />}
        </group>
      </group>
    </group>
  );
};

function estimateCustomObjectBox(obj: Custom3DObject, userScale: number): THREE.Box3 {
  if (obj.type === 'vector' || obj.type === 'arrow') {
    const f = obj.from || [0, 0, 0];
    const t = obj.to || obj.position || [1.8, 1.8, 0];
    const b = new THREE.Box3();
    b.expandByPoint(new THREE.Vector3(f[0] * userScale, f[1] * userScale, f[2] * userScale));
    b.expandByPoint(new THREE.Vector3(t[0] * userScale, t[1] * userScale, t[2] * userScale));
    b.expandByScalar(0.25);
    return b;
  }
  const pos = obj.position || [0, 0.8, 0];
  if (obj.type === 'tube' && obj.points && obj.points.length > 0) {
    const b = new THREE.Box3();
    obj.points.forEach((pt) => {
      b.expandByPoint(
        new THREE.Vector3(
          (pos[0] + pt[0]) * userScale,
          (pos[1] + pt[1]) * userScale,
          (pos[2] + pt[2]) * userScale
        )
      );
    });
    b.expandByScalar(0.25 * userScale);
    return b;
  }
  const args = obj.args || [];
  const r = Math.max(args[0] ?? 0.8, args[1] ?? 0.8, args[2] ?? 0.8) * 0.65 * userScale;
  const center = new THREE.Vector3(pos[0] * userScale, pos[1] * userScale, pos[2] * userScale);
  return new THREE.Box3(
    new THREE.Vector3(center.x - r, center.y - r, center.z - r),
    new THREE.Vector3(center.x + r, center.y + r, center.z + r)
  );
}

const FlowParticlesR3F: React.FC<{
  points: Array<[number, number, number]>;
  color: string;
  count?: number;
  radius?: number;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying?: boolean;
  opacity?: number;
}> = ({
  points,
  color,
  count = 5,
  radius = 0.065,
  flowType = 'dc',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
  opacity = 1,
}) => {
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const phaseRef = useRef(0);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  const curve = useMemo(() => {
    if (points.length < 2) return null;
    const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vecs, false, 'centripetal', 0.25);
  }, [points]);

  useFrame((_, delta) => {
    if (!curve || flowType === 'none') return;
    const safeDt = Math.min(delta, 0.06);
    const speed = Math.max(0.5, Math.min(2.5, flowSpeed || 1));
    if (isPlaying) {
      phaseRef.current += safeDt * speed * 0.42;
    }

    const dir = flowReverse ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      let t = i / count;
      if (flowType === 'ac') {
        t = (t + Math.sin(phaseRef.current * 4.2) * 0.22 * dir + 1) % 1;
      } else {
        t = (t + phaseRef.current * dir + 10) % 1;
      }
      curve.getPointAt(t, tmpVec);
      mesh.position.copy(tmpVec);
      if (flowType === 'pulse' && isPlaying) {
        const s = 0.8 + 0.35 * Math.sin(phaseRef.current * 6 + i * 1.1);
        mesh.scale.setScalar(s);
      } else {
        mesh.scale.setScalar(1);
      }
    }
  });

  if (!curve || flowType === 'none' || opacity < 0.08) return null;

  return (
    <group>
      {Array.from({ length: count }).map((_, idx) => (
        <mesh
          key={`fp-${idx}`}
          ref={(el) => {
            meshRefs.current[idx] = el;
          }}
          position={points[0]}
          renderOrder={5}
        >
          <sphereGeometry args={[radius, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.85}
            transparent={opacity < 0.99}
            opacity={opacity}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
};

const FocusBeacon3D: React.FC<{
  center: THREE.Vector3;
  box?: THREE.Box3;
  isPlaying: boolean;
}> = ({ center, box, isPlaying }) => {
  const ringRef = useRef<THREE.Mesh | null>(null);
  const phaseRef = useRef(0);
  const baseR = useMemo(() => {
    if (!box || box.isEmpty()) return 0.72;
    const sz = box.getSize(new THREE.Vector3());
    return Math.max(0.45, Math.min(1.5, Math.max(sz.x, sz.z) * 0.62));
  }, [box]);

  useFrame((_, delta) => {
    if (!ringRef.current) return;
    phaseRef.current += Math.min(delta, 0.06) * (isPlaying ? 3.2 : 1.5);
    const pulse = 1 + Math.sin(phaseRef.current) * 0.08;
    ringRef.current.scale.set(pulse, pulse, 1);
    ringRef.current.rotation.z = phaseRef.current * 0.35;
  });

  return (
    <mesh
      ref={ringRef}
      position={[center.x, center.y, center.z]}
      rotation={[Math.PI / 2, 0, 0]}
      renderOrder={5}
    >
      <ringGeometry args={[baseR * 0.9, baseR * 1.06, 36]} />
      <meshBasicMaterial
        color="#F59E0B"
        side={THREE.DoubleSide}
        transparent
        opacity={0.78}
        depthWrite={false}
      />
    </mesh>
  );
};

export const Composite3DSceneR3F: React.FC<Composite3DSceneR3FProps> = ({
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
  const userScale = sliderValues.scale ?? 1;
  const customObjects = params.custom_3d_objects || [];
  const hasCustom3DScene = params.shape === 'custom_3d_scene' && customObjects.length > 0;
  const primitives = params.primitives_3d || [];
  const hasPrimitives = !hasCustom3DScene && params.shape === 'composite3d' && primitives.length > 0;
  const activeFocus =
    focusPart && focusPart !== 'overview' && focusPart !== 'drawing_tip'
      ? focusPart.trim().toLowerCase()
      : undefined;

  // Extrude any 2D Iconify/procedural SVG into a 3D relief model when no explicit 3D primitives exist
  const extrudedMeshes = useMemo((): {
    meshes: ExtrudedSvgMesh[];
    centerScale: number;
    cx: number;
    cy: number;
  } | null => {
    if (hasCustom3DScene || hasPrimitives || !params.svg_data) return null;
    try {
      const loader = new SVGLoader();
      const svgDoc = loader.parse(params.svg_data);
      const rawItems: Array<{
        geometry: THREE.ExtrudeGeometry;
        color: string;
        zOffset: number;
        bbox: THREE.Box3;
        partId?: string;
      }> = [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      svgDoc.paths.forEach((svgPath, idx) => {
        const fill = svgPath.color ? `#${svgPath.color.getHexString()}` : '#22c55e';
        const userData = svgPath.userData as
          | { style?: { fill?: string }; node?: Element }
          | undefined;
        const styleFill = userData?.style?.fill;
        if (styleFill === 'none' || styleFill === 'transparent') return;

        const domNode = userData?.node;
        const explicitPartId =
          domNode?.closest?.('[data-part-id]')?.getAttribute('data-part-id') ||
          domNode?.getAttribute?.('id') ||
          undefined;

        const shapes = SVGLoader.createShapes(svgPath);
        shapes.forEach((shape) => {
          const geom = new THREE.ExtrudeGeometry(shape, {
            depth: 10,
            bevelEnabled: true,
            bevelThickness: 1.4,
            bevelSize: 1.0,
            bevelSegments: 2,
          });
          geom.computeBoundingBox();
          if (geom.boundingBox) {
            minX = Math.min(minX, geom.boundingBox.min.x);
            minY = Math.min(minY, geom.boundingBox.min.y);
            maxX = Math.max(maxX, geom.boundingBox.max.x);
            maxY = Math.max(maxY, geom.boundingBox.max.y);
            rawItems.push({
              geometry: geom,
              color: fill,
              zOffset: idx * 0.15,
              bbox: geom.boundingBox.clone(),
              partId: explicitPartId,
            });
          }
        });
      });

      if (rawItems.length === 0 || !Number.isFinite(minX)) return null;
      const span = Math.max(maxX - minX, maxY - minY, 1);
      const centerScale = 4.6 / span;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const meshes: ExtrudedSvgMesh[] = rawItems.map((item, idx) => {
        const bMin = new THREE.Vector3(
          (item.bbox.min.x - cx) * centerScale,
          2.4 - (item.bbox.max.y - cy) * centerScale,
          item.zOffset * centerScale
        );
        const bMax = new THREE.Vector3(
          (item.bbox.max.x - cx) * centerScale,
          2.4 - (item.bbox.min.y - cy) * centerScale,
          (item.zOffset + 10) * centerScale
        );
        const worldBox = new THREE.Box3(bMin, bMax);
        const cVec = new THREE.Vector3();
        worldBox.getCenter(cVec);
        const bucket = Math.min(2, Math.floor((idx / rawItems.length) * 3));
        return {
          geometry: item.geometry,
          color: item.color,
          zOffset: item.zOffset,
          partKey: (item.partId || `part_${bucket}`).toLowerCase(),
          center: cVec,
          box: worldBox,
        };
      });

      return { meshes, centerScale, cx, cy };
    } catch {
      return null;
    }
  }, [hasCustom3DScene, hasPrimitives, params.svg_data]);

  useEffect(() => {
    return () => {
      extrudedMeshes?.meshes.forEach((m) => m.geometry.dispose());
    };
  }, [extrudedMeshes]);

  // Compute exact world-space anchors and THREE.Box3 bounds per partId
  const { anchors, overview, boxes, hasMatchedFocus } = useMemo(() => {
    const outAnchors: Record<string, THREE.Vector3> = {};
    const outBoxes: Record<string, THREE.Box3> = {};
    const globalBox = new THREE.Box3();
    let matchedAny = false;

    if (hasCustom3DScene) {
      const partBoxes: Record<string, THREE.Box3> = {};
      customObjects.forEach((obj, idx) => {
        const b = estimateCustomObjectBox(obj, userScale);
        globalBox.union(b);
        const pKey = (obj.partId || `part_${idx}`).toLowerCase();
        if (!partBoxes[pKey]) partBoxes[pKey] = b.clone();
        else partBoxes[pKey].union(b);
        if (activeFocus && matchesPartKey(pKey, activeFocus)) {
          matchedAny = true;
        }
      });
      for (const [k, b] of Object.entries(partBoxes)) {
        outBoxes[k] = b;
        outAnchors[k] = b.getCenter(new THREE.Vector3());
      }
    } else if (hasPrimitives) {
      const partBoxes: Record<string, THREE.Box3> = {};
      const leftBox = new THREE.Box3();
      const rightBox = new THREE.Box3();
      const centerBox = new THREE.Box3();

      primitives.forEach((item, idx) => {
        const b = estimatePrimitiveBox(item, userScale);
        globalBox.union(b);

        const pKey = (item.partId || `part_${Math.min(2, Math.floor((idx / primitives.length) * 3))}`).toLowerCase();
        if (!partBoxes[pKey]) partBoxes[pKey] = b.clone();
        else partBoxes[pKey].union(b);

        const idxKey = `part_${idx}`;
        if (!partBoxes[idxKey]) partBoxes[idxKey] = b.clone();

        const cx = item.position[0];
        if (cx < -0.45) leftBox.union(b);
        else if (cx > 0.45) rightBox.union(b);
        else centerBox.union(b);

        if (activeFocus && (matchesPartKey(pKey, activeFocus) || idxKey === activeFocus)) {
          matchedAny = true;
        }
      });

      for (const [k, b] of Object.entries(partBoxes)) {
        outBoxes[k] = b;
        const c = new THREE.Vector3();
        b.getCenter(c);
        outAnchors[k] = c;
      }

      if (!leftBox.isEmpty()) {
        outBoxes.detail_left = leftBox;
        outAnchors.detail_left = leftBox.getCenter(new THREE.Vector3());
        if (!outBoxes.coil_1) {
          outBoxes.coil_1 = leftBox;
          outAnchors.coil_1 = outAnchors.detail_left.clone();
        }
      }
      if (!rightBox.isEmpty()) {
        outBoxes.detail_right = rightBox;
        outAnchors.detail_right = rightBox.getCenter(new THREE.Vector3());
        if (!outBoxes.coil_2) {
          outBoxes.coil_2 = rightBox;
          outAnchors.coil_2 = outAnchors.detail_right.clone();
        }
      }
      if (!centerBox.isEmpty()) {
        outBoxes.detail_center = centerBox;
        outAnchors.detail_center = centerBox.getCenter(new THREE.Vector3());
        if (!outBoxes.core) {
          outBoxes.core = centerBox;
          outAnchors.core = outAnchors.detail_center.clone();
        }
      }
    } else if (extrudedMeshes && extrudedMeshes.meshes.length > 0) {
      const partBoxes: Record<string, THREE.Box3> = {};
      extrudedMeshes.meshes.forEach((m) => {
        const scaled = m.box.clone();
        scaled.min.multiplyScalar(userScale);
        scaled.max.multiplyScalar(userScale);
        globalBox.union(scaled);
        if (!partBoxes[m.partKey]) partBoxes[m.partKey] = scaled;
        else partBoxes[m.partKey].union(scaled);
        if (activeFocus && matchesPartKey(m.partKey, activeFocus)) {
          matchedAny = true;
        }
      });
      for (const [k, b] of Object.entries(partBoxes)) {
        outBoxes[k] = b;
        outAnchors[k] = b.getCenter(new THREE.Vector3());
      }
    }

    const overviewCenter = globalBox.isEmpty()
      ? new THREE.Vector3(0, 2.2 * userScale, 0)
      : globalBox.getCenter(new THREE.Vector3());

    if (globalBox.isEmpty()) {
      globalBox.setFromCenterAndSize(overviewCenter, new THREE.Vector3(3.2, 3.2, 3.2));
    }

    outAnchors.overview = overviewCenter;
    outBoxes.overview = globalBox;
    if (!outAnchors.base_plane) {
      outAnchors.base_plane = new THREE.Vector3(0, 0.25, 0);
      outBoxes.base_plane = new THREE.Box3(
        new THREE.Vector3(-1.4, 0, -1.4),
        new THREE.Vector3(1.4, 0.5, 1.4)
      );
    }
    if (!outAnchors.vertex_S) {
      outAnchors.vertex_S = new THREE.Vector3(overviewCenter.x, globalBox.max.y, overviewCenter.z);
    }

    // Bind any custom object_parts[*].partId aliases cleanly
    params.object_parts?.forEach((part, idx) => {
      const customId = part.partId?.toLowerCase();
      if (customId && !outAnchors[customId]) {
        const fallback = outAnchors[`part_${idx}`] || overviewCenter;
        outAnchors[customId] = fallback;
        outBoxes[customId] = outBoxes[`part_${idx}`] || globalBox;
      }
    });

    if (activeFocus && outAnchors[activeFocus]) {
      matchedAny = true;
    }

    return { anchors: outAnchors, overview: overviewCenter, boxes: outBoxes, hasMatchedFocus: matchedAny };
  }, [
    hasCustom3DScene,
    customObjects,
    hasPrimitives,
    primitives,
    extrudedMeshes,
    userScale,
    activeFocus,
    params.object_parts,
  ]);

  const hasExternalModel = !hasCustom3DScene && !hasPrimitives && Boolean(params.model_url);

  useLayoutEffect(() => {
    if (hasExternalModel) return;
    onAnchorsReady(anchors, overview, boxes);
  }, [hasExternalModel, anchors, overview, boxes, onAnchorsReady]);

  const shouldDim = Boolean(dimInactiveParts && activeFocus && (hasMatchedFocus || hasExternalModel));

  const fallbackExtrudeOrPedestal = extrudedMeshes ? (
    <group
      position={[0, 2.4, 0]}
      scale={[
        extrudedMeshes.centerScale,
        -extrudedMeshes.centerScale,
        extrudedMeshes.centerScale,
      ]}
    >
      <group position={[-extrudedMeshes.cx, -extrudedMeshes.cy, 0]}>
        {extrudedMeshes.meshes.map((m, idx) => {
          const isFocused = !shouldDim || matchesPartKey(m.partKey, activeFocus);
          return (
            <mesh
              key={`ext-${idx}`}
              geometry={m.geometry}
              position={[0, 0, m.zOffset]}
              castShadow={isFocused}
              receiveShadow
            >
              <meshStandardMaterial
                color={m.color}
                roughness={0.38}
                metalness={0.08}
                emissive={shouldDim && isFocused ? m.color : '#000000'}
                emissiveIntensity={shouldDim && isFocused ? 0.18 : 0}
                transparent={!isFocused}
                depthWrite={isFocused}
                opacity={isFocused ? 1 : 0.14}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  ) : (
    <group position={[0, 1.4, 0]}>
      <mesh castShadow>
        <octahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#0EA5E9" roughness={0.35} metalness={0.12} />
        <Edges threshold={18} color="#38BDF8" />
      </mesh>
    </group>
  );

  return (
    <group>
      <gridHelper args={[14, 14, 0x94a3b8, 0xe2e8f0]} position={[0, 0.002, 0]} />

      <group scale={[userScale, userScale, userScale]}>
        {hasCustom3DScene ? (
          <group>
            {params.show_axes !== false && (
              <axesHelper args={[4.5]} position={[0, 0.01, 0]} />
            )}
            {customObjects.map((obj, idx) => {
              const pKey = (obj.partId || `part_${idx}`).toLowerCase();
              const isItemFocused = !shouldDim || matchesPartKey(pKey, activeFocus);
              return (
                <CustomSceneObjectMesh
                  key={`custom3d-${idx}`}
                  obj={obj}
                  isDimmed={!isItemFocused}
                  isFocused={Boolean(shouldDim && isItemFocused)}
                  isPlaying={isPlaying}
                />
              );
            })}
          </group>
        ) : hasPrimitives ? (
          <group>
            {primitives.map((item, idx) => {
              const pKey = (
                item.partId || `part_${Math.min(2, Math.floor((idx / primitives.length) * 3))}`
              ).toLowerCase();
              const isItemFocused =
                !shouldDim ||
                matchesPartKey(pKey, activeFocus) ||
                `part_${idx}` === activeFocus ||
                (activeFocus === 'detail_left' && item.position[0] < -0.45) ||
                (activeFocus === 'detail_right' && item.position[0] > 0.45) ||
                (activeFocus === 'detail_center' && Math.abs(item.position[0]) <= 0.45);
              return (
                <PrimitiveMesh
                  key={`prim-${idx}`}
                  item={item}
                  isDimmed={!isItemFocused}
                  isFocused={Boolean(shouldDim && isItemFocused)}
                  isPlaying={isPlaying}
                />
              );
            })}

            {/* 3D Line2 Flow Animation overlays for Physics & Energy Engineering assemblies */}
            {flowType !== 'none' &&
              (() => {
                const nameKey = `${params.object_name_en || ''} ${params.object_name_uz || ''}`.toLowerCase();
                if (
                  nameKey.includes('transformer') ||
                  primitives.some((it) => it.partId === 'coil_1' || it.partId === 'coil_2')
                ) {
                  const corePts: [number, number, number][] = [
                    [-1.15, 0.5, 0.48],
                    [-1.15, 2.7, 0.48],
                    [1.15, 2.7, 0.48],
                    [1.15, 0.5, 0.48],
                    [-1.15, 0.5, 0.48],
                  ];
                  const coil1Pts: [number, number, number][] = [
                    [-1.15, 2.05, 0.62],
                    [-0.53, 1.65, 0.62],
                    [-1.15, 1.25, 0.62],
                    [-1.77, 1.65, 0.62],
                    [-1.15, 2.05, 0.62],
                  ];
                  const coil2Pts: [number, number, number][] = [
                    [1.15, 1.9, 0.62],
                    [1.77, 1.65, 0.62],
                    [1.15, 1.4, 0.62],
                    [0.53, 1.65, 0.62],
                    [1.15, 1.9, 0.62],
                  ];
                  return (
                    <group>
                      <FlowLineR3F
                        points={corePts}
                        color="#8b5cf6"
                        lineWidth={3.0}
                        dashed
                        dashSize={0.28}
                        gapSize={0.18}
                        transparent
                        opacity={!shouldDim || activeFocus === 'core' ? 0.94 : 0.28}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={false}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={corePts}
                        color="#a78bfa"
                        count={6}
                        radius={0.07}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'core' ? 0.95 : 0.25}
                      />
                      <FlowLineR3F
                        points={coil1Pts}
                        color="#f59e0b"
                        lineWidth={2.8}
                        dashed
                        dashSize={0.22}
                        gapSize={0.14}
                        transparent
                        opacity={!shouldDim || activeFocus === 'coil_1' ? 0.96 : 0.22}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={coil1Pts}
                        color="#fbbf24"
                        count={5}
                        radius={0.065}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'coil_1' ? 0.96 : 0.2}
                      />
                      <FlowLineR3F
                        points={coil2Pts}
                        color="#3b82f6"
                        lineWidth={2.8}
                        dashed
                        dashSize={0.22}
                        gapSize={0.14}
                        transparent
                        opacity={!shouldDim || activeFocus === 'coil_2' ? 0.96 : 0.22}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={!flowReverse}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={coil2Pts}
                        color="#60a5fa"
                        count={5}
                        radius={0.065}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={!flowReverse}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'coil_2' ? 0.96 : 0.2}
                      />
                    </group>
                  );
                }

                if (
                  nameKey.includes('generator') ||
                  nameKey.includes('motor') ||
                  nameKey.includes('alternator') ||
                  nameKey.includes('dynamo')
                ) {
                  const bTopPts: [number, number, number][] = [
                    [-1.08, 2.15, 0.15],
                    [0, 2.25, 0.15],
                    [1.08, 2.15, 0.15],
                  ];
                  const bBotPts: [number, number, number][] = [
                    [-1.08, 1.45, -0.15],
                    [0, 1.35, -0.15],
                    [1.08, 1.45, -0.15],
                  ];
                  const brushPts: [number, number, number][] = [
                    [-0.55, 1.8, 1.15],
                    [-0.55, 0.4, 1.45],
                    [0.55, 0.4, 1.45],
                    [0.55, 1.8, 1.38],
                  ];
                  return (
                    <group>
                      {/* Magnetic B-field lines across N -> S poles */}
                      <FlowLineR3F
                        points={bTopPts}
                        color="#8b5cf6"
                        lineWidth={2.5}
                        dashed
                        dashSize={0.24}
                        gapSize={0.16}
                        transparent
                        opacity={!shouldDim || activeFocus === 'stator' || activeFocus === 'rotor' ? 0.92 : 0.25}
                        depthWrite={false}
                        renderOrder={4}
                        flowType="dc"
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={bTopPts}
                        color="#a78bfa"
                        count={4}
                        radius={0.06}
                        flowType="dc"
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'stator' || activeFocus === 'rotor' ? 0.95 : 0.22}
                      />
                      <FlowLineR3F
                        points={bBotPts}
                        color="#8b5cf6"
                        lineWidth={2.5}
                        dashed
                        dashSize={0.24}
                        gapSize={0.16}
                        transparent
                        opacity={!shouldDim || activeFocus === 'stator' || activeFocus === 'rotor' ? 0.92 : 0.25}
                        depthWrite={false}
                        renderOrder={4}
                        flowType="dc"
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      {/* Induced / Input Current along slip rings / commutator */}
                      <FlowLineR3F
                        points={brushPts}
                        color="#f59e0b"
                        lineWidth={3.0}
                        dashed
                        dashSize={0.24}
                        gapSize={0.14}
                        transparent
                        opacity={!shouldDim || activeFocus === 'brushes' || activeFocus === 'commutator' || activeFocus === 'rotor' ? 0.96 : 0.25}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={brushPts}
                        color="#fbbf24"
                        count={5}
                        radius={0.068}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'brushes' || activeFocus === 'commutator' || activeFocus === 'rotor' ? 0.96 : 0.25}
                      />
                    </group>
                  );
                }

                if (nameKey.includes('turbine') || nameKey.includes('hydro') || nameKey.includes('steam')) {
                  const streamPts: [number, number, number][] = nameKey.includes('hydro')
                    ? [
                        [-2.1, 2.9, 0],
                        [-1.25, 2.1, 0],
                        [-0.55, 1.15, 0],
                        [0, 1.05, 0],
                      ]
                    : [
                        [-1.5, 3.05, 1.75],
                        [-0.45, 3.05, 0.95],
                        [0.15, 3.05, 0.25],
                      ];
                  const cablePts: [number, number, number][] = nameKey.includes('hydro')
                    ? [
                        [0, 1.1, 0],
                        [0, 2.1, 0],
                        [0, 3.0, 0],
                        [1.2, 3.0, 0],
                      ]
                    : [
                        [0, 2.95, -0.15],
                        [0, 1.5, -0.18],
                        [0, 0.22, -0.25],
                        [1.45, 0.22, -0.25],
                      ];
                  return (
                    <group>
                      {/* Fluid / Airflow kinetic stream into rotor */}
                      <FlowLineR3F
                        points={streamPts}
                        color="#0ea5e9"
                        lineWidth={3.0}
                        dashed
                        dashSize={0.26}
                        gapSize={0.14}
                        transparent
                        opacity={!shouldDim || activeFocus === 'rotor_blades' || activeFocus === 'penstock' || activeFocus === 'runner_blades' ? 0.94 : 0.28}
                        depthWrite={false}
                        renderOrder={4}
                        flowType="dc"
                        flowSpeed={flowSpeed * 1.15}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={streamPts}
                        color="#38bdf8"
                        count={5}
                        radius={0.075}
                        flowType="dc"
                        flowSpeed={flowSpeed * 1.2}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'rotor_blades' || activeFocus === 'penstock' || activeFocus === 'runner_blades' ? 0.96 : 0.25}
                      />
                      {/* Generated electrical power cable down tower */}
                      <FlowLineR3F
                        points={cablePts}
                        color="#f59e0b"
                        lineWidth={2.8}
                        dashed
                        dashSize={0.24}
                        gapSize={0.14}
                        transparent
                        opacity={!shouldDim || activeFocus === 'nacelle_generator' || activeFocus === 'generator_unit' || activeFocus === 'tower' ? 0.96 : 0.28}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={cablePts}
                        color="#fbbf24"
                        count={4}
                        radius={0.068}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                        opacity={!shouldDim || activeFocus === 'nacelle_generator' || activeFocus === 'generator_unit' || activeFocus === 'tower' ? 0.96 : 0.25}
                      />
                    </group>
                  );
                }

                if (nameKey.includes('solar') || nameKey.includes('quyosh panel')) {
                  const sunPts: [number, number, number][] = [
                    [-1.55, 3.2, -0.6],
                    [-0.85, 2.5, -0.2],
                    [-0.35, 1.9, 0.05],
                  ];
                  const gridPts: [number, number, number][] = [
                    [0, 1.55, 0.15],
                    [0.65, 1.0, 0.25],
                    [1.35, 1.05, 0.25],
                    [2.25, 1.15, 0.25],
                  ];
                  return (
                    <group>
                      <FlowLineR3F
                        points={sunPts}
                        color="#facc15"
                        lineWidth={2.8}
                        dashed
                        dashSize={0.22}
                        gapSize={0.14}
                        transparent
                        opacity={0.94}
                        depthWrite={false}
                        renderOrder={4}
                        flowType="dc"
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={sunPts}
                        color="#fde047"
                        count={4}
                        radius={0.068}
                        flowType="dc"
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      <FlowLineR3F
                        points={gridPts}
                        color="#2563eb"
                        lineWidth={3.0}
                        dashed
                        dashSize={0.24}
                        gapSize={0.14}
                        transparent
                        opacity={0.96}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={gridPts}
                        color="#60a5fa"
                        count={5}
                        radius={0.07}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        isPlaying={isPlaying}
                      />
                    </group>
                  );
                }

                if (
                  nameKey.includes('circuit') ||
                  nameKey.includes('battery') ||
                  nameKey.includes('capacitor') ||
                  nameKey.includes('solenoid')
                ) {
                  const loopPts: [number, number, number][] = [
                    [-1.4, 2.05, 0.1],
                    [-1.4, 2.5, 0.1],
                    [1.4, 2.5, 0.1],
                    [1.4, 0.35, 0.1],
                    [-1.4, 0.35, 0.1],
                    [-1.4, 1.9, 0.1],
                  ];
                  return (
                    <group>
                      <FlowLineR3F
                        points={loopPts}
                        color="#f59e0b"
                        lineWidth={3.0}
                        dashed
                        dashSize={0.26}
                        gapSize={0.15}
                        transparent
                        opacity={0.95}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={loopPts}
                        color="#fbbf24"
                        count={6}
                        radius={0.068}
                        flowType={flowType}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                    </group>
                  );
                }

                if (nameKey.includes('hydraulic') || nameKey.includes('press') || nameKey.includes('pump')) {
                  const fluidPts: [number, number, number][] = [
                    [-1.25, 1.65, 0.22],
                    [-1.25, 0.35, 0.22],
                    [0, 0.35, 0.22],
                    [1.15, 0.35, 0.22],
                    [1.15, 1.5, 0.22],
                  ];
                  return (
                    <group>
                      <FlowLineR3F
                        points={fluidPts}
                        color="#0ea5e9"
                        lineWidth={3.2}
                        dashed
                        dashSize={0.26}
                        gapSize={0.14}
                        transparent
                        opacity={0.96}
                        depthWrite={false}
                        renderOrder={4}
                        flowType={flowType === 'pulse' ? 'pulse' : 'dc'}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                      <FlowParticlesR3F
                        points={fluidPts}
                        color="#38bdf8"
                        count={6}
                        radius={0.078}
                        flowType={flowType === 'pulse' ? 'pulse' : 'dc'}
                        flowSpeed={flowSpeed}
                        flowReverse={flowReverse}
                        isPlaying={isPlaying}
                      />
                    </group>
                  );
                }

                return null;
              })()}
            {shouldDim && activeFocus && anchors[activeFocus] && (
              <FocusBeacon3D
                center={anchors[activeFocus]}
                box={boxes[activeFocus]}
                isPlaying={isPlaying}
              />
            )}
          </group>
        ) : params.model_url ? (
          <GlbErrorBoundary fallback={fallbackExtrudeOrPedestal}>
            <Suspense fallback={fallbackExtrudeOrPedestal}>
              <GltfModelR3F
                url={params.model_url}
                userScale={1}
                activeFocus={activeFocus}
                shouldDim={shouldDim}
                onModelAnchorsReady={onAnchorsReady}
              />
            </Suspense>
          </GlbErrorBoundary>
        ) : (
          fallbackExtrudeOrPedestal
        )}
      </group>
    </group>
  );
};
