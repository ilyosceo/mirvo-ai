import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CameraControls,
  CameraControlsImpl,
  ContactShadows,
  Environment,
  Lightformer,
} from '@react-three/drei';
import type { FlowType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { Canvas3DFallback } from './Canvas3DFallback';
import { QuadricSceneR3F } from './QuadricSceneR3F';
import { StereometrySceneR3F } from './StereometrySceneR3F';
import { Composite3DSceneR3F } from './Composite3DSceneR3F';

interface ThreeDStageProps {
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

function probeWebGLSupport(): { unavailable: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') {
    return { unavailable: false, isSoftwareGl: false };
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) {
      return { unavailable: true, isSoftwareGl: true };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { unavailable: false, isSoftwareGl };
  } catch {
    return { unavailable: true, isSoftwareGl: true };
  }
}

interface CameraRigControllerProps {
  isQuadricMode: boolean;
  sceneKey: string;
  stepIndex: number;
  cameraPreset?: [number, number, number];
  autoRotate: boolean;
  activeFocusKey?: string;
  cameraZoom: number;
  anchors3DRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  boxes3DRef: React.MutableRefObject<Record<string, THREE.Box3>>;
  overviewLookRef: React.MutableRefObject<THREE.Vector3>;
  lastAnchorsSnapshotRef: React.MutableRefObject<StageAnchorsMap>;
  onAnchorsChangeRef: React.MutableRefObject<((anchors: StageAnchorsMap) => void) | undefined>;
  onWebGLContextLost: () => void;
  resetSignal: number;
  anchorsVersion: number;
  onUserManipulateChange: (manipulated: boolean) => void;
}

interface CameraRigControllerProps {
  isQuadricMode: boolean;
  sceneKey: string;
  stepIndex: number;
  cameraPreset?: [number, number, number];
  autoRotate: boolean;
  activeFocusKey?: string;
  cameraZoom: number;
  anchors3DRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  boxes3DRef: React.MutableRefObject<Record<string, THREE.Box3>>;
  overviewLookRef: React.MutableRefObject<THREE.Vector3>;
  lastAnchorsSnapshotRef: React.MutableRefObject<StageAnchorsMap>;
  onAnchorsChangeRef: React.MutableRefObject<((anchors: StageAnchorsMap) => void) | undefined>;
  onWebGLContextLost: () => void;
  resetSignal: number;
  anchorsVersion: number;
  onUserManipulateChange: (manipulated: boolean) => void;
  onZoomInRef: React.MutableRefObject<(() => void) | null>;
  onZoomOutRef: React.MutableRefObject<(() => void) | null>;
}

const CameraRigController: React.FC<CameraRigControllerProps> = ({
  isQuadricMode,
  sceneKey,
  stepIndex,
  cameraPreset,
  autoRotate,
  activeFocusKey,
  cameraZoom,
  anchors3DRef,
  boxes3DRef,
  overviewLookRef,
  lastAnchorsSnapshotRef,
  onAnchorsChangeRef,
  onWebGLContextLost,
  resetSignal,
  anchorsVersion,
  onUserManipulateChange,
  onZoomInRef,
  onZoomOutRef,
}) => {
  const controlsRef = useRef<CameraControls | null>(null);
  const { camera, size, gl } = useThree();
  const isUserDraggingRef = useRef(false);
  const userManipulatedStepRef = useRef<number | null>(null);
  const baseCamPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(
      cameraPreset?.[0] ?? (isQuadricMode ? 5.8 : 9.5),
      cameraPreset?.[1] ?? (isQuadricMode ? 3.6 : 7.2),
      cameraPreset?.[2] ?? (isQuadricMode ? 5.2 : 10.5)
    )
  );
  const tmpVecRef = useRef(new THREE.Vector3());
  const offsetVecRef = useRef(new THREE.Vector3());
  const lookAtVecRef = useRef(new THREE.Vector3());
  const camPosVecRef = useRef(new THREE.Vector3());
  const lastSceneKeyRef = useRef<string>('');
  const lastStepIndexRef = useRef<number>(stepIndex);

  // Expose zoom refs
  useEffect(() => {
    onZoomInRef.current = () => {
      const controls = controlsRef.current;
      if (controls) {
        void controls.dolly(1.4, true);
        userManipulatedStepRef.current = stepIndex;
        onUserManipulateChange(true);
      }
    };
    onZoomOutRef.current = () => {
      const controls = controlsRef.current;
      if (controls) {
        void controls.dolly(-1.4, true);
        userManipulatedStepRef.current = stepIndex;
        onUserManipulateChange(true);
      }
    };
  }, [stepIndex, onZoomInRef, onZoomOutRef, onUserManipulateChange]);

  // Handle WebGL context loss & canvas cursor/touch UX
  useEffect(() => {
    const dom = gl.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';

    const handleLost = (e: Event) => {
      e.preventDefault();
      onWebGLContextLost();
    };
    dom.addEventListener('webglcontextlost', handleLost);
    return () => {
      dom.removeEventListener('webglcontextlost', handleLost);
    };
  }, [gl, onWebGLContextLost]);

  // Configure pointer/touch gestures (smooth orbit & pinch dolly)
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE;
    controls.mouseButtons.middle = CameraControlsImpl.ACTION.DOLLY;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    controls.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    controls.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = CameraControlsImpl.ACTION.NONE;
  }, []);

  // Responsive FOV for portrait phones vs landscape/desktop
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const nextFov = size.width < size.height ? 50 : 42;
    if (camera.fov !== nextFov) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  // Helper to smoothly animate camera + target via CameraControls.setLookAt
  const transitionToLookAt = useCallback(
    (animate: boolean) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const overviewPt = overviewLookRef.current;
      const focusKey = activeFocusKey?.toLowerCase();
      let anchorPt: THREE.Vector3 | undefined;
      let targetBox: THREE.Box3 | undefined;
      if (focusKey && focusKey !== 'overview' && focusKey !== 'drawing_tip') {
        anchorPt =
          anchors3DRef.current[focusKey] ||
          anchors3DRef.current[activeFocusKey || ''];
        targetBox =
          boxes3DRef.current[focusKey] ||
          boxes3DRef.current[activeFocusKey || ''];
        if (!anchorPt) {
          const partial = Object.entries(anchors3DRef.current).find(([k]) => {
            const kl = k.toLowerCase();
            return kl !== 'overview' && (kl.includes(focusKey) || focusKey.includes(kl));
          });
          if (partial) {
            anchorPt = partial[1];
            targetBox = boxes3DRef.current[partial[0]];
          }
        }
      }

      const lookAt = lookAtVecRef.current;
      const isMicroZoom = Boolean(anchorPt) && (cameraZoom >= 1.2 || stepIndex >= 1);

      if (anchorPt) {
        lookAt.copy(overviewPt).lerp(anchorPt, isMicroZoom ? 0.96 : 0.6);
      } else {
        lookAt.copy(overviewPt);
      }

      const rawZoom = cameraZoom || 1;
      const safeZoom = Math.max(0.8, Math.min(2.2, isMicroZoom && rawZoom < 1.55 ? 1.75 : rawZoom));
      const offset = offsetVecRef.current.copy(baseCamPosRef.current).sub(overviewPt);
      if (anchorPt && isMicroZoom) {
        const boxSizeVec = new THREE.Vector3();
        const hasValidBox = Boolean(targetBox && !targetBox.isEmpty());
        if (hasValidBox && targetBox) {
          targetBox.getSize(boxSizeVec);
        }
        const bsRadius = hasValidBox
          ? Math.max(0.55, Math.min(2.6, boxSizeVec.length() * 0.5))
          : 1.35;
        const desiredDist = Math.max(3.2, Math.min(6.4, (bsRadius * 3.4) / Math.max(1.0, safeZoom * 0.68)));
        const curLen = offset.length();
        if (curLen > 0.01) {
          offset.normalize().multiplyScalar(desiredDist);
        }
      } else {
        offset.multiplyScalar(1 / safeZoom);
      }
      const camPos = camPosVecRef.current.copy(lookAt).add(offset);

      void controls.setLookAt(
        camPos.x,
        camPos.y,
        camPos.z,
        lookAt.x,
        lookAt.y,
        lookAt.z,
        animate
      );
    },
    [anchors3DRef, boxes3DRef, overviewLookRef, activeFocusKey, cameraZoom, stepIndex]
  );

  // Clear user manual lock when changing scene, changing step, or explicitly clicking reset
  useEffect(() => {
    if (lastStepIndexRef.current !== stepIndex || lastSceneKeyRef.current !== sceneKey) {
      userManipulatedStepRef.current = null;
      onUserManipulateChange(false);
    }
    lastStepIndexRef.current = stepIndex;
  }, [stepIndex, sceneKey, onUserManipulateChange]);

  useEffect(() => {
    if (resetSignal > 0) {
      userManipulatedStepRef.current = null;
      onUserManipulateChange(false);
      transitionToLookAt(true);
    }
  }, [resetSignal, onUserManipulateChange, transitionToLookAt]);

  // Reset base camera angle when changing scene/template/shape
  useEffect(() => {
    const isNewScene = lastSceneKeyRef.current !== sceneKey;
    lastSceneKeyRef.current = sceneKey;
    if (isNewScene && !cameraPreset) {
      if (isQuadricMode) {
        baseCamPosRef.current.set(5.8, 3.6, 5.2);
      } else {
        baseCamPosRef.current.set(9.5, 7.2, 10.5);
      }
      transitionToLookAt(true);
    }
  }, [sceneKey, isQuadricMode, cameraPreset, transitionToLookAt]);

  // Smoothly apply teacher/button cameraPreset
  useEffect(() => {
    if (!cameraPreset) return;
    userManipulatedStepRef.current = null;
    onUserManipulateChange(false);
    baseCamPosRef.current.set(cameraPreset[0], cameraPreset[1], cameraPreset[2]);
    transitionToLookAt(true);
  }, [cameraPreset, transitionToLookAt, onUserManipulateChange]);

  // Smoothly apply Macro-to-Micro beat focusTarget / cameraZoom ONLY if user hasn't manually taken over this step
  useEffect(() => {
    if (userManipulatedStepRef.current === stepIndex || isUserDraggingRef.current) {
      return;
    }
    transitionToLookAt(true);
  }, [activeFocusKey, cameraZoom, stepIndex, anchorsVersion, transitionToLookAt]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (autoRotate && controls && !isUserDraggingRef.current) {
      controls.azimuthAngle += 0.62 * Math.min(delta, 0.08);
    }

    // Project named 3D anchors & Box3 corners for mentor placement with 24px clearance
    const cb = onAnchorsChangeRef.current;
    if (!cb || size.width <= 0 || size.height <= 0) return;

    const nextMap: StageAnchorsMap = {};
    const tmp = tmpVecRef.current;
    let changed = false;
    const prevMap = lastAnchorsSnapshotRef.current;

    for (const [key, pt3] of Object.entries(anchors3DRef.current)) {
      tmp.copy(pt3).project(camera);
      const px = (tmp.x * 0.5 + 0.5) * size.width;
      const py = (-tmp.y * 0.5 + 0.5) * size.height;

      let boxW: number | undefined;
      let boxH: number | undefined;
      const box = boxes3DRef.current[key];
      if (box && !box.isEmpty()) {
        let minSx = Infinity;
        let minSy = Infinity;
        let maxSx = -Infinity;
        let maxSy = -Infinity;
        const { min, max } = box;
        const xs = [min.x, max.x];
        const ys = [min.y, max.y];
        const zs = [min.z, max.z];
        for (let ix = 0; ix < 2; ix++) {
          for (let iy = 0; iy < 2; iy++) {
            for (let iz = 0; iz < 2; iz++) {
              tmp.set(xs[ix], ys[iy], zs[iz]).project(camera);
              const sx = (tmp.x * 0.5 + 0.5) * size.width;
              const sy = (-tmp.y * 0.5 + 0.5) * size.height;
              minSx = Math.min(minSx, sx);
              minSy = Math.min(minSy, sy);
              maxSx = Math.max(maxSx, sx);
              maxSy = Math.max(maxSy, sy);
            }
          }
        }
        if (Number.isFinite(minSx) && Number.isFinite(maxSx)) {
          boxW = Math.max(20, Math.min(size.width * 0.72, maxSx - minSx));
          boxH = Math.max(20, Math.min(size.height * 0.72, maxSy - minSy));
        }
      }

      nextMap[key] = { x: px, y: py, width: boxW, height: boxH };

      const prev = prevMap[key];
      if (
        !prev ||
        Math.abs(prev.x - px) > 1.5 ||
        Math.abs(prev.y - py) > 1.5 ||
        Math.abs((prev.width ?? 0) - (boxW ?? 0)) > 4
      ) {
        changed = true;
      }
    }

    if (changed || Object.keys(prevMap).length !== Object.keys(nextMap).length) {
      lastAnchorsSnapshotRef.current = nextMap;
      cb(nextMap);
    }
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.48}
      draggingSmoothTime={0.12}
      minDistance={0.8}
      maxDistance={50}
      dollySpeed={1.5}
      maxPolarAngle={isQuadricMode ? Math.PI * 0.95 : Math.PI * 0.78}
      onControlStart={() => {
        isUserDraggingRef.current = true;
        userManipulatedStepRef.current = stepIndex;
        onUserManipulateChange(true);
        gl.domElement.style.cursor = 'grabbing';
      }}
      onControlEnd={() => {
        isUserDraggingRef.current = false;
        gl.domElement.style.cursor = 'grab';
      }}
    />
  );
};

export const ThreeDStage: React.FC<ThreeDStageProps> = ({
  params,
  sliderValues,
  cameraPreset,
  force2DFallback = false,
  autoRotate = false,
  focusTarget,
  focusPart,
  dimInactiveParts = false,
  cameraZoom = 1,
  stepIndex = 0,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const glProbe = useMemo(() => probeWebGLSupport(), []);
  const [contextLost, setContextLost] = useState(false);
  const [userManipulated, setUserManipulated] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [anchorsVersion, setAnchorsVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const anchors3DRef = useRef<Record<string, THREE.Vector3>>({});
  const boxes3DRef = useRef<Record<string, THREE.Box3>>({});
  const overviewLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const lastAnchorsSnapshotRef = useRef<StageAnchorsMap>({});
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;

  const shape = params.shape || 'pyramid';
  const isQuadricMode = shape === 'quadric' || shape === 'parametric';
  const isComposite3D =
    shape === 'composite3d' || shape === 'svg_extrude' || shape === 'custom_3d_scene';
  const sceneKey = `${shape}:${params.object_name_en || ''}:${params.template || ''}:${params.axis || ''}:${params.parametric_x || ''}:${params.parametric_y || ''}:${params.parametric_z || ''}`;

  const activeFocusKey = useMemo(() => {
    const cleanPart =
      focusPart && focusPart !== 'overview' && focusPart !== 'drawing_tip'
        ? focusPart.trim()
        : undefined;
    const cleanTarget =
      focusTarget && focusTarget !== 'overview' && focusTarget !== 'drawing_tip'
        ? focusTarget.trim()
        : undefined;
    return cleanPart || cleanTarget || undefined;
  }, [focusPart, focusTarget]);

  const shouldDimOthers = Boolean(
    activeFocusKey && dimInactiveParts
  );

  const handleAnchorsReady = useCallback(
    (
      anchors: Record<string, THREE.Vector3>,
      overview: THREE.Vector3,
      boxes?: Record<string, THREE.Box3>
    ) => {
      anchors3DRef.current = anchors;
      boxes3DRef.current = boxes || {};
      overviewLookRef.current.copy(overview);
      lastAnchorsSnapshotRef.current = {};
      setAnchorsVersion((v) => v + 1);
    },
    []
  );

  const handleContextLost = useCallback(() => {
    setContextLost(true);
  }, []);

  if (glProbe.unavailable || contextLost || force2DFallback) {
    return (
      <Canvas3DFallback
        params={params}
        sliderValues={sliderValues}
        cameraPos={cameraPreset}
      />
    );
  }

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D1017] text-slate-300 text-sm font-medium">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        3D sahna yuklanmoqda...
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-transparent touch-none"
      aria-label="Interaktiv 3D stereometriya sahnasi"
    >
      {userManipulated && (
        <button
          type="button"
          onClick={() => setResetSignal((n) => n + 1)}
          className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          1.0x tiklash
        </button>
      )}

      <Canvas
        dpr={glProbe.isSoftwareGl ? 1 : [1, 1.25]}
        camera={{
          position: isQuadricMode ? [5.8, 3.6, 5.2] : [9.5, 7.2, 10.5],
          fov: 42,
          near: 0.1,
          far: 200,
        }}
        gl={{
          alpha: true,
          antialias: !glProbe.isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      >
        <ambientLight intensity={0.38} />
        <hemisphereLight intensity={0.95} color="#ffffff" groundColor="#e2e8f0" />
        <directionalLight position={[10, 16, 10]} intensity={1.5} color="#fffbeb" />
        <directionalLight position={[-9, 8, -9]} intensity={0.8} color="#93c5fd" />

        {/* Offline procedural studio HDR reflections (zero network fetch) */}
        <Environment resolution={128} frames={1}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#ffffff"
            position={[0, 8, 4]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[10, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.3}
            color="#dbeafe"
            position={[-8, 3, -4]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[8, 4, 1]}
          />
          <Lightformer
            form="ring"
            intensity={1.1}
            color="#fef3c7"
            position={[8, 4, 6]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[5, 5, 1]}
          />
        </Environment>

        {!glProbe.isSoftwareGl && (
          <ContactShadows
            position={[0, 0.004, 0]}
            opacity={0.26}
            scale={12}
            blur={2.3}
            far={5.5}
          />
        )}

        <CameraRigController
          isQuadricMode={isQuadricMode}
          sceneKey={sceneKey}
          stepIndex={stepIndex}
          cameraPreset={cameraPreset}
          autoRotate={autoRotate}
          activeFocusKey={activeFocusKey}
          cameraZoom={cameraZoom}
          anchors3DRef={anchors3DRef}
          boxes3DRef={boxes3DRef}
          overviewLookRef={overviewLookRef}
          lastAnchorsSnapshotRef={lastAnchorsSnapshotRef}
          onAnchorsChangeRef={onAnchorsChangeRef}
          onWebGLContextLost={handleContextLost}
          resetSignal={resetSignal}
          anchorsVersion={anchorsVersion}
          onUserManipulateChange={setUserManipulated}
        />

        {isQuadricMode ? (
          <QuadricSceneR3F
            params={params}
            sliderValues={sliderValues}
            isSoftwareGl={glProbe.isSoftwareGl}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
            onAnchorsReady={handleAnchorsReady}
          />
        ) : isComposite3D ? (
          <Composite3DSceneR3F
            params={params}
            sliderValues={sliderValues}
            focusPart={activeFocusKey}
            dimInactiveParts={shouldDimOthers}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
            onAnchorsReady={handleAnchorsReady}
          />
        ) : (
          <StereometrySceneR3F
            params={params}
            sliderValues={sliderValues}
            focusPart={activeFocusKey}
            dimInactiveParts={shouldDimOthers}
            flowType={flowType}
            flowSpeed={flowSpeed}
            flowReverse={flowReverse}
            isPlaying={isPlaying}
            onAnchorsReady={handleAnchorsReady}
          />
        )}
      </Canvas>
    </div>
  );
};
