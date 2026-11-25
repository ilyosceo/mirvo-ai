import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {
  Custom3DObject,
  FlowType,
  Primitive3DItem,
  RenderParams,
  StageAnchorsMap,
} from '../../types/tutor';
import { resolveMachine3DAssembly, type BuiltInMachineKey } from '../../lib/machine3DCatalog';
import { Canvas3DFallback } from './Canvas3DFallback';

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  radius: number;
  height: number;
  turns: number;

  constructor(radius = 0.5, height = 1.0, turns = 8) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * Math.PI * 2 * this.turns;
    const x = Math.cos(angle) * this.radius;
    const z = Math.sin(angle) * this.radius;
    const y = (t - 0.5) * this.height;
    return optionalTarget.set(x, y, z);
  }
}

function buildGearGeometry(
  outerR = 0.35,
  thickness = 0.12,
  teeth = 14,
  holeR = 0.08
): THREE.BufferGeometry {
  const safeTeeth = Math.max(6, Math.round(teeth));
  const innerR = outerR * 0.78;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / safeTeeth;

  for (let i = 0; i < safeTeeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.32;
    const a3 = a0 + step * 0.68;
    const a4 = a0 + step * 0.78;

    const p0x = Math.cos(a0) * innerR;
    const p0y = Math.sin(a0) * innerR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
  }
  shape.closePath();

  if (holeR > 0.01 && holeR < innerR * 0.85) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: Math.min(0.012, thickness * 0.12),
    bevelThickness: Math.min(0.012, thickness * 0.12),
  });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

function createPbrMaterial(item: Primitive3DItem, disposables: Array<{ dispose: () => void }>) {
  const opacity = item.opacity ?? 1;
  const isTransparent = opacity < 0.99 || (item.transmission ?? 0) > 0.05;
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(item.color || '#3B82F6'),
    metalness: item.metalness ?? 0.55,
    roughness: item.roughness ?? 0.28,
    transparent: isTransparent,
    opacity,
    transmission: item.transmission ? Math.min(0.85, item.transmission) : 0,
    clearcoat: item.clearcoat ?? (isTransparent ? 0.8 : 0.25),
    clearcoatRoughness: 0.16,
    side: isTransparent ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: opacity > 0.42,
  });

  if (item.emissive) {
    mat.emissive = new THREE.Color(item.emissive);
    mat.emissiveIntensity = item.emissiveIntensity ?? 0.22;
  }

  disposables.push(mat);
  return mat;
}

interface AnimatedEntry {
  object: THREE.Object3D;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: THREE.Vector3;
  explodeVec: THREE.Vector3;
  partId?: string;
  label?: string;
  animation?: Primitive3DItem['animation'];
  axis: 'x' | 'y' | 'z';
  speed: number;
  amp: number;
  materials: THREE.MeshStandardMaterial[];
  baseEmissive: THREE.Color[];
  baseEmissiveInt: number[];
  baseOpacity: number[];
  leaderLine?: THREE.Line;
}

interface FlowStreamEntry {
  curve: THREE.CatmullRomCurve3;
  particles: THREE.Mesh[];
  flowType: FlowType;
  speed: number;
  reverse: boolean;
}

function normalizeCustomObjectsToPrimitives(objects?: Custom3DObject[]): Primitive3DItem[] {
  if (!objects?.length) return [];
  const list: Primitive3DItem[] = [];
  objects.forEach((obj, idx) => {
    if (obj.type === 'axis' || obj.type === 'plane' || obj.type === 'vector' || obj.type === 'arrow') {
      if ((obj.type === 'vector' || obj.type === 'arrow') && obj.from && obj.to) {
        list.push({
          id: `vec-${idx}`,
          type: 'tube',
          position: [0, 0, 0],
          args: [0.035],
          points: [obj.from, obj.to],
          color: obj.color || '#38BDF8',
          partId: obj.partId,
          label: obj.label,
          flowType: 'dc',
          flowSpeed: 1,
        });
      }
      return;
    }
    list.push({
      id: `custom-${idx}`,
      type: obj.type,
      position: obj.position || [0, 0, 0],
      rotation: obj.rotation,
      scale: obj.scale,
      args: obj.args || [0.6, 0.6, 0.6],
      points: obj.points,
      profile: obj.profile,
      color: obj.color || '#3B82F6',
      emissive: obj.emissive,
      emissiveIntensity: obj.emissiveIntensity,
      opacity: obj.opacity,
      roughness: obj.roughness,
      metalness: obj.metalness,
      transmission: obj.transmission,
      clearcoat: obj.clearcoat,
      explodeOffset: obj.explodeOffset,
      label: obj.label,
      partId: obj.partId,
      animation: obj.animation,
      animationAxis: obj.animationAxis,
      animationSpeed: obj.animationSpeed,
      animationAmp: obj.animationAmp,
    });
  });
  return list;
}

function buildStereometryFallbackPrimitives(params: RenderParams): Primitive3DItem[] | null {
  const shape = params.shape;
  if (!shape || shape === 'composite3d' || shape === 'custom_3d_scene') return null;
  const r = params.radius ?? 1;
  const h = params.height ?? 1.8;
  const b = params.base ?? 1.5;

  if (shape === 'cone') {
    return [
      {
        id: 'stereo-cone',
        type: 'cone',
        position: [0, 0, 0],
        args: [r, h, 36],
        color: params.surface_color || '#3B82F6',
        opacity: 0.86,
        metalness: 0.35,
        roughness: 0.25,
        partId: 'cone_body',
        label: 'Konus sirti',
      },
    ];
  }
  if (shape === 'cylinder') {
    return [
      {
        id: 'stereo-cyl',
        type: 'cylinder',
        position: [0, 0, 0],
        args: [r, r, h, 36],
        color: params.surface_color || '#0EA5E9',
        opacity: 0.86,
        metalness: 0.4,
        roughness: 0.22,
        partId: 'cyl_body',
        label: 'Silindr',
      },
    ];
  }
  if (shape === 'sphere' || shape === 'quadric') {
    return [
      {
        id: 'stereo-sphere',
        type: 'sphere',
        position: [0, 0, 0],
        args: [r * 1.1],
        color: params.surface_color || '#6366F1',
        opacity: 0.88,
        metalness: 0.4,
        roughness: 0.2,
        partId: 'sphere_body',
        label: '3D Sfera',
      },
    ];
  }
  if (shape === 'pyramid' || shape === 'prism') {
    const sides = params.sides ?? (shape === 'pyramid' ? 4 : 6);
    return [
      {
        id: 'stereo-poly',
        type: shape === 'pyramid' ? 'cone' : 'cylinder',
        position: [0, 0, 0],
        args: shape === 'pyramid' ? [b * 0.8, h, sides] : [b * 0.7, b * 0.7, h, sides],
        color: params.surface_color || '#10B981',
        opacity: 0.88,
        metalness: 0.35,
        roughness: 0.28,
        partId: 'poly_body',
        label: shape === 'pyramid' ? 'Piramida' : 'Prizma',
      },
    ];
  }
  if (shape === 'cube') {
    return [
      {
        id: 'stereo-cube',
        type: 'rounded_box',
        position: [0, 0, 0],
        args: [b, b, b, 3, 0.04],
        color: params.surface_color || '#F59E0B',
        opacity: 0.9,
        metalness: 0.45,
        roughness: 0.24,
        partId: 'cube_body',
        label: 'Kub',
      },
    ];
  }
  return null;
}

export interface PbrMachine3DStageProps {
  params?: RenderParams;
  machineKey?: BuiltInMachineKey | string;
  sliderValues?: Record<string, number>;
  cameraPreset?: [number, number, number];
  autoRotate?: boolean;
  focusPart?: string;
  dimInactiveParts?: boolean;
  exploded?: boolean;
  onExplodedChange?: (exploded: boolean) => void;
  isPlaying?: boolean;
  darkSurface?: boolean;
  compactHud?: boolean;
  onPartSelect?: (partId: string, label?: string, screenPos?: { x: number; y: number }) => void;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

export const PbrMachine3DStage: React.FC<PbrMachine3DStageProps> = ({
  params,
  machineKey,
  sliderValues = {},
  cameraPreset,
  autoRotate = false,
  focusPart,
  dimInactiveParts = false,
  exploded: controlledExploded,
  onExplodedChange,
  isPlaying = true,
  darkSurface = true,
  compactHud = false,
  onPartSelect,
  onAnchorsChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [internalExploded, setInternalExploded] = useState(false);
  const [orbitAuto, setOrbitAuto] = useState(autoRotate);
  const [selectedPart, setSelectedPart] = useState<{ partId: string; label?: string } | null>(null);
  const [calloutPins, setCalloutPins] = useState<
    Array<{ partId: string; label: string; x: number; y: number; active: boolean }>
  >([]);

  const isExploded = controlledExploded !== undefined ? controlledExploded : internalExploded;
  const toggleExploded = () => {
    const next = !isExploded;
    setInternalExploded(next);
    onExplodedChange?.(next);
  };

  useEffect(() => {
    setOrbitAuto(autoRotate);
  }, [autoRotate]);

  // Resolve the 3D PBR assembly:
  // Priority 1: Explicit machineKey (e.g. Lab switcher: 'transformer' | 'turbine' | 'hydraulics' | 'gaes')
  // Priority 2: AI-generated params.primitives_3d or params.custom_3d_objects
  // Priority 3: Math stereometry fallback
  // Priority 4: Procedural catalog match from object_name_uz / object_name_en
  const resolvedAssembly = useMemo(() => {
    if (machineKey) {
      return resolveMachine3DAssembly(machineKey, sliderValues);
    }
    if (params?.primitives_3d && params.primitives_3d.length > 0) {
      const seen = new Set<string>();
      const partOrder: Array<{ partId: string; label: string }> = [];
      for (const p of params.primitives_3d) {
        if (p.partId && p.label && !seen.has(p.partId)) {
          seen.add(p.partId);
          partOrder.push({ partId: p.partId, label: p.label });
        }
      }
      return {
        key: 'custom' as const,
        titleUz: params.object_name_uz || 'Three.js 3D Model',
        subtitleUz: 'Haqiqiy WebGL PBR 3D sahna',
        primitives: params.primitives_3d,
        partOrder,
        defaultCamera: (cameraPreset || [3.8, 2.5, 4.8]) as [number, number, number],
      };
    }
    const fromCustom = normalizeCustomObjectsToPrimitives(params?.custom_3d_objects);
    if (fromCustom.length > 0) {
      const seen = new Set<string>();
      const partOrder: Array<{ partId: string; label: string }> = [];
      for (const p of fromCustom) {
        if (p.partId && p.label && !seen.has(p.partId)) {
          seen.add(p.partId);
          partOrder.push({ partId: p.partId, label: p.label });
        }
      }
      return {
        key: 'custom' as const,
        titleUz: params?.object_name_uz || 'Three.js 3D Model',
        subtitleUz: 'Haqiqiy WebGL PBR 3D sahna',
        primitives: fromCustom,
        partOrder,
        defaultCamera: (cameraPreset || [3.8, 2.5, 4.8]) as [number, number, number],
      };
    }
    if (params) {
      const stereo = buildStereometryFallbackPrimitives(params);
      if (stereo) {
        return {
          key: 'custom' as const,
          titleUz: params.object_name_uz || '3D Geometriya',
          subtitleUz: 'Perspektiv WebGL 3D jism',
          primitives: stereo,
          partOrder: stereo
            .filter((s) => s.partId && s.label)
            .map((s) => ({ partId: s.partId!, label: s.label! })),
          defaultCamera: (cameraPreset || [3.4, 2.4, 4.2]) as [number, number, number],
        };
      }
    }
    const hint = params?.object_name_uz || params?.object_name_en || 'transformer';
    return resolveMachine3DAssembly(hint, sliderValues);
  }, [machineKey, params, sliderValues, cameraPreset]);

  // Refs shared with the animation loop so React prop updates don't recreate the WebGL context!
  const stateRef = useRef({
    exploded: isExploded,
    explodeProgress: isExploded ? 1 : 0,
    focusPart: focusPart || '',
    selectedPartId: '',
    dimInactive: dimInactiveParts,
    isPlaying,
    orbitAuto,
    resetCameraFlag: false,
  });

  stateRef.current.exploded = isExploded;
  stateRef.current.focusPart = focusPart || stateRef.current.selectedPartId || '';
  stateRef.current.dimInactive = dimInactiveParts;
  stateRef.current.isPlaying = isPlaying;
  stateRef.current.orbitAuto = orbitAuto;

  const sceneBundleRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    assemblyGroup: THREE.Group;
    leaderGroup: THREE.Group;
    entries: AnimatedEntry[];
    flows: FlowStreamEntry[];
    partCentroids: Map<string, { pos: THREE.Vector3; label: string }>;
    defaultCamPos: THREE.Vector3;
    disposables: Array<{ dispose: () => void }>;
  } | null>(null);

  // 1. Initialize WebGLRenderer, PerspectiveCamera, OrbitControls, RoomEnvironment & Studio Lights ONCE per mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = Math.max(240, container.clientWidth || 640);
    const height = Math.max(220, container.clientHeight || 420);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = darkSurface ? 1.12 : 1.04;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // True PBR Studio Environment Reflections (PMREM)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = darkSurface ? 0.85 : 0.72;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 160);
    const initCam = cameraPreset || resolvedAssembly.defaultCamera;
    camera.position.set(initCam[0], initCam[1], initCam[2]);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.0;
    controls.maxDistance = 14.0;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.target.set(0, -0.1, 0);

    // Studio 3-Point + Hemisphere Lighting + Real-time Shadows
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
    keyLight.position.set(5.5, 8.5, 6.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.camera.left = -5.5;
    keyLight.shadow.camera.right = 5.5;
    keyLight.shadow.camera.top = 5.5;
    keyLight.shadow.camera.bottom = -5.5;
    keyLight.shadow.bias = -0.0006;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-6, 3.8, -5);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xf59e0b, 0.75, 18);
    warmFill.position.set(4.2, 1.5, 4.0);
    scene.add(warmFill);

    // Subtle Shadow-Receiving Floor & Technical Reference Ring
    const floorGeo = new THREE.CircleGeometry(5.8, 64);
    const floorMat = new THREE.ShadowMaterial({ opacity: darkSurface ? 0.38 : 0.18 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.36;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ringGeo = new THREE.RingGeometry(2.85, 2.88, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: darkSurface ? 0x38bdf8 : 0x64748b,
      transparent: true,
      opacity: darkSurface ? 0.16 : 0.14,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -1.355;
    scene.add(ringMesh);

    const assemblyGroup = new THREE.Group();
    const leaderGroup = new THREE.Group();
    scene.add(assemblyGroup);
    scene.add(leaderGroup);

    sceneBundleRef.current = {
      scene,
      camera,
      renderer,
      controls,
      assemblyGroup,
      leaderGroup,
      entries: [],
      flows: [],
      partCentroids: new Map(),
      defaultCamPos: new THREE.Vector3(initCam[0], initCam[1], initCam[2]),
      disposables: [],
    };

    // Raycaster for interactive 3D part clicking
    const raycaster = new THREE.Raycaster();
    const pointerDown = { x: 0, y: 0, t: 0 };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDown.x = ev.clientX;
      pointerDown.y = ev.clientY;
      pointerDown.t = performance.now();
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDown.x;
      const dy = ev.clientY - pointerDown.y;
      if (Math.hypot(dx, dy) > 7 || performance.now() - pointerDown.t > 380) return;

      const bundle = sceneBundleRef.current;
      if (!bundle) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, bundle.camera);
      const hits = raycaster.intersectObjects(bundle.assemblyGroup.children, true);
      const hit = hits.find((h) => h.object.userData?.partId);
      if (hit) {
        const partId = String(hit.object.userData.partId);
        const label = hit.object.userData.label as string | undefined;
        const nextId = stateRef.current.selectedPartId === partId ? '' : partId;
        stateRef.current.selectedPartId = nextId;
        setSelectedPart(nextId ? { partId: nextId, label } : null);
        if (nextId && onPartSelect) {
          onPartSelect(nextId, label, {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
          });
        }
      } else if (stateRef.current.selectedPartId) {
        stateRef.current.selectedPartId = '';
        setSelectedPart(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 40 || cr.height < 40) return;
      camera.aspect = cr.width / cr.height;
      camera.updateProjectionMatrix();
      renderer.setSize(cr.width, cr.height);
    });
    ro.observe(container);

    // 60 FPS Render & Physics Loop
    const clock = new THREE.Clock();
    const desiredTarget = new THREE.Vector3(0, -0.1, 0);
    const projVec = new THREE.Vector3();
    let frameCount = 0;
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const bundle = sceneBundleRef.current;
      if (!bundle) return;

      const st = stateRef.current;

      // Camera reset
      if (st.resetCameraFlag) {
        st.resetCameraFlag = false;
        bundle.camera.position.copy(bundle.defaultCamPos);
        bundle.controls.target.set(0, -0.1, 0);
      }

      // Smooth Exploded View interpolation
      const targetExplode = st.exploded ? 1 : 0;
      st.explodeProgress += (targetExplode - st.explodeProgress) * Math.min(1, dt * 6.5);
      const exp = st.explodeProgress;

      const activeFocus = st.focusPart;

      // Focus camera target smoothly toward active part centroid (if any)
      if (activeFocus && bundle.partCentroids.has(activeFocus)) {
        const info = bundle.partCentroids.get(activeFocus)!;
        desiredTarget.copy(info.pos).multiplyScalar(0.55);
      } else {
        desiredTarget.set(0, -0.08, 0);
      }
      bundle.controls.target.lerp(desiredTarget, Math.min(1, dt * 4.2));
      bundle.controls.autoRotate = st.orbitAuto;
      bundle.controls.autoRotateSpeed = 1.4;
      bundle.controls.update();

      // Animate parts + explode offsets + emissive focus highlight
      for (const entry of bundle.entries) {
        entry.object.position
          .copy(entry.basePos)
          .addScaledVector(entry.explodeVec, exp);

        if (st.isPlaying && entry.animation && entry.animation !== 'none') {
          if (entry.animation === 'spin' || entry.animation === 'spin_reverse') {
            const dir = entry.animation === 'spin_reverse' ? -1 : 1;
            entry.object.rotation[entry.axis] =
              entry.baseRot[entry.axis] + elapsed * entry.speed * dir;
          } else if (entry.animation === 'oscillate_y') {
            entry.object.position.y += Math.sin(elapsed * entry.speed * 2.2) * entry.amp;
          } else if (entry.animation === 'oscillate_x') {
            entry.object.position.x += Math.sin(elapsed * entry.speed * 2.2) * entry.amp;
          } else if (entry.animation === 'pulse_scale') {
            const s = 1 + Math.sin(elapsed * entry.speed * 2.5) * entry.amp;
            entry.object.scale.set(
              entry.baseScale.x * s,
              entry.baseScale.y * s,
              entry.baseScale.z * s
            );
          } else if (entry.animation === 'orbit') {
            const r = Math.max(0.25, entry.amp || 0.5);
            entry.object.position.x = entry.basePos.x + Math.cos(elapsed * entry.speed) * r;
            entry.object.position.z = entry.basePos.z + Math.sin(elapsed * entry.speed) * r;
          }
        }

        // Leader line visibility during exploded view
        if (entry.leaderLine) {
          entry.leaderLine.visible = exp > 0.04;
          if (exp > 0.04) {
            const posAttr = entry.leaderLine.geometry.getAttribute(
              'position'
            ) as THREE.BufferAttribute;
            posAttr.setXYZ(0, entry.basePos.x, entry.basePos.y, entry.basePos.z);
            posAttr.setXYZ(
              1,
              entry.object.position.x,
              entry.object.position.y,
              entry.object.position.z
            );
            posAttr.needsUpdate = true;
          }
        }

        // Focus glow & optional dimming
        const isFocused = Boolean(activeFocus && entry.partId === activeFocus);
        for (let mIdx = 0; mIdx < entry.materials.length; mIdx++) {
          const mat = entry.materials[mIdx];
          if (isFocused) {
            const pulse = 0.35 + Math.sin(elapsed * 4.5) * 0.14;
            mat.emissive.setHex(0x38bdf8);
            mat.emissiveIntensity = Math.max(entry.baseEmissiveInt[mIdx], pulse);
          } else {
            mat.emissive.copy(entry.baseEmissive[mIdx]);
            mat.emissiveIntensity = entry.baseEmissiveInt[mIdx];
          }
          if (activeFocus && st.dimInactive && !isFocused) {
            mat.transparent = true;
            mat.opacity = Math.min(entry.baseOpacity[mIdx], 0.32);
          } else {
            mat.opacity = entry.baseOpacity[mIdx];
          }
        }
      }

      // Animate 3D fluid / electron flow spheres along CatmullRom curves
      if (st.isPlaying) {
        for (const stream of bundle.flows) {
          const count = stream.particles.length;
          for (let i = 0; i < count; i++) {
            const phase = i / count;
            let u = 0;
            if (stream.flowType === 'ac') {
              u = clamp01(
                phase * 0.82 + 0.09 + Math.sin(elapsed * stream.speed * 3.2 + i) * 0.08
              );
            } else {
              const raw = (phase + elapsed * stream.speed * 0.32) % 1;
              u = stream.reverse ? 1 - raw : raw;
            }
            stream.curve.getPointAt(clamp01(u), stream.particles[i].position);
          }
        }
      }

      renderer.render(scene, camera);

      // Project 3D part anchors every ~6 frames for floating callouts & Emoji Ustoz targeting!
      frameCount++;
      if (frameCount % 6 === 0 && bundle.partCentroids.size > 0) {
        const w = renderer.domElement.clientWidth || width;
        const h = renderer.domElement.clientHeight || height;
        const nextPins: Array<{
          partId: string;
          label: string;
          x: number;
          y: number;
          active: boolean;
        }> = [];
        const anchors: StageAnchorsMap = {};

        bundle.partCentroids.forEach((info, pid) => {
          projVec.copy(info.pos);
          // Account for explode offset on centroids
          const matching = bundle.entries.find((e) => e.partId === pid);
          if (matching && exp > 0.02) {
            projVec.addScaledVector(matching.explodeVec, exp);
          }
          projVec.project(camera);
          if (projVec.z < 1) {
            const sx = (projVec.x * 0.5 + 0.5) * w;
            const sy = (-projVec.y * 0.5 + 0.5) * h;
            anchors[pid] = { x: sx, y: sy, label: info.label };
            if (st.exploded || pid === activeFocus) {
              nextPins.push({
                partId: pid,
                label: info.label,
                x: sx,
                y: sy,
                active: pid === activeFocus,
              });
            }
          }
        });

        setCalloutPins(nextPins);
        onAnchorsChange?.(anchors);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envRT.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      if (sceneBundleRef.current) {
        sceneBundleRef.current.disposables.forEach((d) => d.dispose());
      }
      renderer.dispose();
      sceneBundleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkSurface]);

  // 2. Rebuild 3D meshes inside assemblyGroup whenever resolvedAssembly changes (e.g., slider drag or new lesson!)
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle) return;

    // Dispose previous meshes/materials cleanly
    bundle.disposables.forEach((d) => d.dispose());
    bundle.disposables = [];
    bundle.assemblyGroup.clear();
    bundle.leaderGroup.clear();
    bundle.entries = [];
    bundle.flows = [];
    bundle.partCentroids.clear();

    const camDef = cameraPreset || resolvedAssembly.defaultCamera;
    bundle.defaultCamPos.set(camDef[0], camDef[1], camDef[2]);

    const partAccum = new Map<string, { sum: THREE.Vector3; count: number; label: string }>();

    resolvedAssembly.primitives.forEach((item, idx) => {
      const disposables = bundle.disposables;
      const mat = createPbrMaterial(item, disposables);
      const args = item.args || [0.5, 0.5, 0.5];
      let obj: THREE.Object3D;

      if (item.type === 'gear') {
        const geo = buildGearGeometry(
          args[0] ?? 0.35,
          args[1] ?? 0.12,
          args[2] ?? 14,
          args[3] ?? 0.08
        );
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        obj = mesh;
      } else if (item.type === 'coil' || item.type === 'helical_coil') {
        const curve = new HelixCurve(args[0] ?? 0.45, args[1] ?? 1.0, args[2] ?? 8);
        const turns = Math.max(3, args[2] ?? 8);
        const geo = new THREE.TubeGeometry(
          curve,
          Math.min(180, Math.round(turns * 14)),
          args[3] ?? 0.04,
          12,
          false
        );
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        obj = mesh;
      } else if (item.type === 'turbine_runner' || item.type === 'impeller') {
        const group = new THREE.Group();
        const radius = args[0] ?? 0.5;
        const hubH = args[1] ?? 0.24;
        const bladeCount = Math.max(3, Math.round(args[2] ?? 6));
        const pitch = args[3] ?? 0.38;

        const hubGeo =
          item.type === 'impeller'
            ? new THREE.CylinderGeometry(radius * 0.14, radius * 0.18, hubH, 24)
            : new THREE.CylinderGeometry(radius * 0.32, radius * 0.42, hubH, 24);
        disposables.push(hubGeo);
        const hubMesh = new THREE.Mesh(hubGeo, mat);
        hubMesh.castShadow = true;
        group.add(hubMesh);

        // Swept 3D blades
        const bladeLen = item.type === 'impeller' ? radius * 0.92 : radius * 0.68;
        const bladeW = item.type === 'impeller' ? radius * 0.13 : hubH * 0.82;
        const bladeGeo = new THREE.BoxGeometry(bladeLen, bladeW, 0.032, 4, 1, 1);
        disposables.push(bladeGeo);

        for (let b = 0; b < bladeCount; b++) {
          const angle = (b / bladeCount) * Math.PI * 2;
          const pivot = new THREE.Group();
          if (item.type === 'impeller') {
            // Radial blades in XY/XZ plane around Y (since cylinder axis is Y)
            pivot.rotation.y = angle;
            const blade = new THREE.Mesh(bladeGeo, mat);
            blade.position.set(radius * 0.5, 0, 0);
            blade.rotation.x = pitch;
            blade.castShadow = true;
            pivot.add(blade);
          } else {
            pivot.rotation.y = angle;
            const blade = new THREE.Mesh(bladeGeo, mat);
            blade.position.set(radius * 0.58, 0, 0);
            blade.rotation.x = pitch;
            blade.rotation.z = 0.18;
            blade.castShadow = true;
            pivot.add(blade);
          }
          group.add(pivot);
        }

        if (item.type === 'turbine_runner') {
          const ringGeo = new THREE.TorusGeometry(radius * 0.88, 0.035, 12, 32);
          disposables.push(ringGeo);
          const band = new THREE.Mesh(ringGeo, mat);
          band.rotation.x = Math.PI / 2;
          band.position.y = -hubH * 0.38;
          group.add(band);
        }

        obj = group;
      } else if (item.type === 'dial_gauge') {
        const group = new THREE.Group();
        const r = args[0] ?? 0.4;
        const depth = args[1] ?? 0.12;
        const norm = THREE.MathUtils.clamp(args[2] ?? 0.5, 0, 1);

        // Metallic Bezel
        const bezelGeo = new THREE.CylinderGeometry(r, r, depth, 36);
        bezelGeo.rotateX(Math.PI / 2);
        disposables.push(bezelGeo);
        const bezelMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.88,
          roughness: 0.2,
        });
        disposables.push(bezelMat);
        const bezel = new THREE.Mesh(bezelGeo, bezelMat);
        bezel.castShadow = true;
        group.add(bezel);

        // Dark Dial Face
        const faceGeo = new THREE.CircleGeometry(r * 0.86, 36);
        disposables.push(faceGeo);
        const faceMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.5,
          metalness: 0.1,
        });
        disposables.push(faceMat);
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.z = depth * 0.51;
        group.add(face);

        // Colored Scale Arc
        const arcGeo = new THREE.RingGeometry(
          r * 0.64,
          r * 0.78,
          32,
          1,
          -Math.PI * 0.25,
          Math.PI * 1.5
        );
        disposables.push(arcGeo);
        const arc = new THREE.Mesh(arcGeo, mat);
        arc.position.z = depth * 0.52;
        group.add(arc);

        // Live 3D Rotating Needle!
        const needlePivot = new THREE.Group();
        needlePivot.position.z = depth * 0.55;
        // 0 -> +135 deg (left), 1 -> -135 deg (right)
        needlePivot.rotation.z = THREE.MathUtils.lerp(
          Math.PI * 0.75,
          -Math.PI * 0.75,
          norm
        );
        const needleGeo = new THREE.BoxGeometry(r * 0.07, r * 0.68, 0.02);
        needleGeo.translate(0, r * 0.26, 0);
        disposables.push(needleGeo);
        const needleMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xdc2626,
          emissiveIntensity: 0.45,
          roughness: 0.25,
        });
        disposables.push(needleMat);
        const needle = new THREE.Mesh(needleGeo, needleMat);
        needlePivot.add(needle);

        const capGeo = new THREE.SphereGeometry(r * 0.09, 16, 16);
        disposables.push(capGeo);
        needlePivot.add(new THREE.Mesh(capGeo, bezelMat));
        group.add(needlePivot);

        obj = group;
      } else if (item.type === 'tube' && item.points && item.points.length >= 2) {
        const pts = item.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeR = args[0] ?? 0.08;
        const geo = new THREE.TubeGeometry(curve, 44, tubeR, 16, false);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = (item.opacity ?? 1) > 0.6;
        mesh.receiveShadow = true;

        if (item.flowType && item.flowType !== 'none') {
          const container = new THREE.Group();
          container.add(mesh);
          const pGeo = new THREE.SphereGeometry(Math.max(0.036, tubeR * 0.62), 12, 12);
          disposables.push(pGeo);
          const pMat = new THREE.MeshStandardMaterial({
            color: item.flowReverse ? 0xc084fc : 0x7dd3fc,
            emissive: item.flowReverse ? 0xa855f7 : 0x38bdf8,
            emissiveIntensity: 0.95,
            roughness: 0.15,
          });
          disposables.push(pMat);
          const particles: THREE.Mesh[] = [];
          for (let k = 0; k < 6; k++) {
            const pm = new THREE.Mesh(pGeo, pMat);
            container.add(pm);
            particles.push(pm);
          }
          bundle.flows.push({
            curve,
            particles,
            flowType: item.flowType,
            speed: item.flowSpeed ?? 1,
            reverse: Boolean(item.flowReverse),
          });
          obj = container;
        } else {
          obj = mesh;
        }
      } else if (item.type === 'lathe' && item.profile && item.profile.length >= 2) {
        const pts2 = item.profile.map((p) => new THREE.Vector2(p[0], p[1]));
        const geo = new THREE.LatheGeometry(pts2, 32);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        obj = mesh;
      } else {
        let geo: THREE.BufferGeometry;
        switch (item.type) {
          case 'rounded_box':
            geo = new RoundedBoxGeometry(
              args[0] ?? 1,
              args[1] ?? 1,
              args[2] ?? 1,
              Math.round(args[3] ?? 3),
              args[4] ?? 0.05
            );
            break;
          case 'cylinder':
            geo = new THREE.CylinderGeometry(
              args[0] ?? 0.5,
              args[1] ?? args[0] ?? 0.5,
              args[2] ?? 1,
              Math.round(args[3] ?? 32),
              1,
              Boolean(args[4]),
              args[5] ?? 0,
              args[6] ?? Math.PI * 2
            );
            if (args[6] && args[6] < Math.PI * 1.99) {
              mat.side = THREE.DoubleSide;
            }
            break;
          case 'capsule':
            geo = new THREE.CapsuleGeometry(args[0] ?? 0.35, args[1] ?? 0.8, 12, 24);
            break;
          case 'sphere':
            geo = new THREE.SphereGeometry(
              args[0] ?? 0.5,
              32,
              24,
              0,
              args[1] ?? Math.PI * 2,
              0,
              args[2] ?? Math.PI
            );
            break;
          case 'cone':
            geo = new THREE.ConeGeometry(args[0] ?? 0.5, args[1] ?? 1, Math.round(args[2] ?? 32));
            break;
          case 'torus':
            geo = new THREE.TorusGeometry(
              args[0] ?? 0.5,
              args[1] ?? 0.12,
              18,
              40,
              args[2] ?? Math.PI * 2
            );
            break;
          case 'ring':
            geo = new THREE.RingGeometry(args[0] ?? 0.3, args[1] ?? 0.5, 36);
            mat.side = THREE.DoubleSide;
            break;
          case 'octahedron':
            geo = new THREE.OctahedronGeometry(args[0] ?? 0.5);
            break;
          case 'dodecahedron':
            geo = new THREE.DodecahedronGeometry(args[0] ?? 0.5);
            break;
          case 'box':
          default:
            geo = new THREE.BoxGeometry(args[0] ?? 1, args[1] ?? 1, args[2] ?? 1);
            break;
        }
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = (item.opacity ?? 1) > 0.45;
        mesh.receiveShadow = true;
        obj = mesh;
      }

      const basePos = new THREE.Vector3(
        item.position?.[0] ?? 0,
        item.position?.[1] ?? 0,
        item.position?.[2] ?? 0
      );
      obj.position.copy(basePos);

      if (item.rotation) {
        obj.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
      }
      if (item.scale !== undefined) {
        if (typeof item.scale === 'number') {
          obj.scale.setScalar(item.scale);
        } else {
          obj.scale.set(item.scale[0], item.scale[1], item.scale[2]);
        }
      }

      // Attach partId metadata to all child meshes for raycast picking
      const mats: THREE.MeshStandardMaterial[] = [];
      obj.traverse((child) => {
        child.userData.partId = item.partId || `part-${idx}`;
        child.userData.label = item.label;
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).material;
          if (m instanceof THREE.MeshStandardMaterial && !mats.includes(m)) {
            mats.push(m);
          }
        }
      });

      // Compute explode vector (explicit or automatic radial outward from origin)
      let explodeVec: THREE.Vector3;
      if (item.explodeOffset) {
        explodeVec = new THREE.Vector3(
          item.explodeOffset[0],
          item.explodeOffset[1],
          item.explodeOffset[2]
        );
      } else {
        const radial = basePos.clone();
        if (radial.lengthSq() < 0.04) radial.set(0, 0.55, 0.35);
        explodeVec = radial.normalize().multiplyScalar(0.68);
      }

      // Create subtle 3D leader line for labeled parts during Exploded View
      let leaderLine: THREE.Line | undefined;
      if (item.label && explodeVec.lengthSq() > 0.02) {
        const lGeo = new THREE.BufferGeometry().setFromPoints([
          basePos.clone(),
          basePos.clone().add(explodeVec),
        ]);
        const lMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.55,
        });
        disposables.push(lGeo, lMat);
        leaderLine = new THREE.Line(lGeo, lMat);
        leaderLine.visible = false;
        bundle.leaderGroup.add(leaderLine);
      }

      bundle.assemblyGroup.add(obj);

      // Centroid tracking for part callouts & camera focus
      if (item.partId) {
        let samplePos = basePos.clone();
        if (item.points && item.points.length > 0) {
          const mid = item.points[Math.floor(item.points.length / 2)];
          samplePos = new THREE.Vector3(mid[0], mid[1], mid[2]).add(basePos);
        }
        const existing = partAccum.get(item.partId);
        if (existing) {
          existing.sum.add(samplePos);
          existing.count += 1;
          if (!existing.label && item.label) existing.label = item.label;
        } else {
          partAccum.set(item.partId, {
            sum: samplePos.clone(),
            count: 1,
            label: item.label || item.partId,
          });
        }
      }

      bundle.entries.push({
        object: obj,
        basePos: basePos.clone(),
        baseRot: obj.rotation.clone(),
        baseScale: obj.scale.clone(),
        explodeVec,
        partId: item.partId,
        label: item.label,
        animation: item.animation,
        axis: item.animationAxis || 'y',
        speed: item.animationSpeed ?? 1.8,
        amp: item.animationAmp ?? 0.25,
        materials: mats,
        baseEmissive: mats.map((m) => m.emissive.clone()),
        baseEmissiveInt: mats.map((m) => m.emissiveIntensity),
        baseOpacity: mats.map((m) => m.opacity),
        leaderLine,
      });
    });

    partAccum.forEach((val, pid) => {
      bundle.partCentroids.set(pid, {
        pos: val.sum.divideScalar(val.count),
        label: val.label,
      });
    });
  }, [resolvedAssembly, cameraPreset]);

  if (webglFailed) {
    return (
      <Canvas3DFallback
        params={params || {}}
        sliderValues={sliderValues}
        cameraPos={cameraPreset}
      />
    );
  }

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden"
      style={{
        background: darkSurface
          ? 'radial-gradient(circle at 50% 38%, #162238 0%, #0B1120 68%, #060913 100%)'
          : 'radial-gradient(circle at 50% 38%, #FFFFFF 0%, #EEF2F7 72%, #E2E8F0 100%)',
      }}
    >
      {/* True WebGL Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Projected 3D Callout Badges (Visible in Exploded View or Active Step Focus) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {calloutPins.map((pin) => (
          <div
            key={pin.partId}
            style={{
              transform: `translate3d(${Math.round(pin.x)}px, ${Math.round(pin.y)}px, 0) translate(-50%, -125%)`,
            }}
            className={`absolute left-0 top-0 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight whitespace-nowrap backdrop-blur-md border shadow-md transition-opacity duration-200 ${
              pin.active
                ? 'bg-sky-500/90 text-white border-sky-300/60'
                : darkSurface
                  ? 'bg-slate-900/80 text-slate-100 border-white/15'
                  : 'bg-white/90 text-slate-800 border-slate-300/80'
            }`}
          >
            {pin.label}
          </div>
        ))}
      </div>

      {/* Top-Left True 3D Engine Badge */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold backdrop-blur-md border ${
            darkSurface
              ? 'bg-slate-900/72 text-sky-300 border-sky-400/25'
              : 'bg-white/88 text-sky-700 border-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          WebGL 3D · PBR
        </span>
        {selectedPart?.label && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-amber-500/90 text-slate-950 shadow-sm">
            {selectedPart.label}
          </span>
        )}
      </div>

      {/* Top-Right Interactive 3D Controls (Exploded View + 360° Auto-Orbit + Reset) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleExploded}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border transition-all cursor-pointer ${
            isExploded
              ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
              : darkSurface
                ? 'bg-slate-900/75 text-slate-200 border-white/15 hover:bg-slate-800'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
          }`}
          title="3D detallarni fazoda qismlarga ajratib ko‘rish"
        >
          {isExploded ? 'Yig‘ish' : compactHud ? 'Qismlar' : 'Qismlarga ajratish'}
        </button>

        <button
          type="button"
          onClick={() => setOrbitAuto((v) => !v)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border transition-all cursor-pointer ${
            orbitAuto
              ? 'bg-indigo-500 text-white border-indigo-400'
              : darkSurface
                ? 'bg-slate-900/75 text-slate-200 border-white/15 hover:bg-slate-800'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
          }`}
          title="360° avtomatik aylantirish"
        >
          360°
        </button>

        {!compactHud && (
          <button
            type="button"
            onClick={() => {
              stateRef.current.resetCameraFlag = true;
              stateRef.current.selectedPartId = '';
              setSelectedPart(null);
            }}
            className={`px-2 py-1 rounded-full text-[11px] font-medium backdrop-blur-md border transition-all cursor-pointer ${
              darkSurface
                ? 'bg-slate-900/75 text-slate-300 border-white/15 hover:text-white'
                : 'bg-white/90 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
            title="Kamerani dastlabki holatga qaytarish"
          >
            ↺
          </button>
        )}
      </div>

      {/* Subtle Bottom Hint */}
      {!compactHud && (
        <div className="pointer-events-none absolute bottom-2.5 left-3 z-10">
          <span
            className={`text-[10.5px] font-medium px-2 py-0.5 rounded-md ${
              darkSurface ? 'text-slate-400 bg-slate-950/45' : 'text-slate-500 bg-white/65'
            }`}
          >
            Sichqoncha / barmoq bilan 360° aylantiring · Detal ustiga bosing
          </span>
        </div>
      )}
    </div>
  );
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export default PbrMachine3DStage;
