import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { UstozExpression } from './MirvoMentor';

let activeUstozContexts = 0;
const MAX_USTOZ_WEBGL_CONTEXTS = 2;

export interface EmojiUstoz3DProps {
  size?: number;
  expression?: UstozExpression;
  isSpeaking?: boolean;
  isListening?: boolean;
  isNodding?: boolean;
  voiceActivity?: number;
  lookVector?: { x: number; y: number };
  pointingSide?: 'left' | 'right' | null;
  onWebglFallback?: () => void;
}

export const EmojiUstoz3D: React.FC<EmojiUstoz3DProps> = ({
  size = 82,
  expression = 'happy',
  isSpeaking = false,
  isListening = false,
  isNodding = false,
  voiceActivity = 0,
  lookVector,
  pointingSide = null,
  onWebglFallback,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  const liveRef = useRef({
    expression,
    isSpeaking,
    isListening,
    isNodding,
    voiceActivity,
    lookVector,
    pointingSide,
    cursorActive: false,
    targetYaw: 0,
    targetPitch: 0,
  });

  liveRef.current.expression = expression;
  liveRef.current.isSpeaking = isSpeaking;
  liveRef.current.isListening = isListening;
  liveRef.current.isNodding = isNodding;
  liveRef.current.voiceActivity = voiceActivity;
  liveRef.current.lookVector = lookVector;
  liveRef.current.pointingSide = pointingSide;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (activeUstozContexts >= MAX_USTOZ_WEBGL_CONTEXTS) {
      setFailed(true);
      onWebglFallback?.();
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      setFailed(true);
      onWebglFallback?.();
      return;
    }

    activeUstozContexts += 1;

    const px = Math.max(64, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(px, px);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.85;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 25);
    camera.position.set(0, 0.08, 4.35);
    camera.lookAt(0, 0.04, 0);

    // Warm Pixar-grade 3-point character lighting
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1e293b, 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(2.8, 3.6, 4.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-3.2, 1.8, -2.5);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [];

    // Root Character Group (tilts & nods in 3D space!)
    const root = new THREE.Group();
    scene.add(root);

    // 1. Glossy Golden 3D PBR Head Sphere
    const headGeo = new THREE.SphereGeometry(0.96, 44, 36);
    const headMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FBBF24'),
      emissive: new THREE.Color('#D97706'),
      emissiveIntensity: 0.08,
      roughness: 0.24,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
    });
    disposables.push(headGeo, headMat);
    const headMesh = new THREE.Mesh(headGeo, headMat);
    root.add(headMesh);

    // Subtle 3D Rosy Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.17, 20, 16);
    cheekGeo.scale(1.25, 0.72, 0.45);
    const cheekMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.22,
      roughness: 0.5,
      transparent: true,
      opacity: 0.62,
    });
    disposables.push(cheekGeo, cheekMat);
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.56, -0.18, 0.78);
    leftCheek.rotation.y = -0.45;
    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.56, -0.18, 0.78);
    rightCheek.rotation.y = 0.45;
    root.add(leftCheek, rightCheek);

    // 2. Academic 3D Mortarboard Cap (Ustoz Toji) + Swinging Golden Tassel!
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.88, -0.02);
    capGroup.rotation.x = 0.14;

    const skullCapGeo = new THREE.CylinderGeometry(0.56, 0.64, 0.26, 32);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.42,
      metalness: 0.25,
    });
    const boardGeo = new RoundedBoxGeometry(1.52, 0.075, 1.52, 3, 0.02);
    disposables.push(skullCapGeo, capMat, boardGeo);

    const skullCap = new THREE.Mesh(skullCapGeo, capMat);
    const board = new THREE.Mesh(boardGeo, capMat);
    board.position.y = 0.15;
    board.rotation.y = Math.PI / 4;
    capGroup.add(skullCap, board);

    // Golden Button + Swinging 3D Tassel
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.15,
      metalness: 0.88,
      roughness: 0.18,
    });
    const btnGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
    const cordGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10);
    const dropGeo = new THREE.ConeGeometry(0.065, 0.2, 14);
    disposables.push(goldMat, btnGeo, cordGeo, dropGeo);

    const topBtn = new THREE.Mesh(btnGeo, goldMat);
    topBtn.position.y = 0.2;
    capGroup.add(topBtn);

    const tasselPivot = new THREE.Group();
    tasselPivot.position.set(0.68, 0.16, 0.35);
    const tasselCord = new THREE.Mesh(cordGeo, goldMat);
    tasselCord.position.y = -0.28;
    const tasselDrop = new THREE.Mesh(dropGeo, goldMat);
    tasselDrop.position.y = -0.62;
    tasselPivot.add(tasselCord, tasselDrop);
    capGroup.add(tasselPivot);
    root.add(capGroup);

    // 3. True 3D Eyeball Spheres (Physically Rotating in 3D Socket!)
    const scleraGeo = new THREE.SphereGeometry(0.24, 28, 24);
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 0.9,
    });
    const irisGeo = new THREE.SphereGeometry(0.125, 24, 20);
    irisGeo.scale(1, 1, 0.45);
    const irisMat = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.2,
      roughness: 0.15,
      clearcoat: 1,
    });
    const pupilGeo = new THREE.SphereGeometry(0.068, 18, 16);
    pupilGeo.scale(1, 1, 0.45);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const glintGeo = new THREE.SphereGeometry(0.032, 12, 12);
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    disposables.push(
      scleraGeo,
      scleraMat,
      irisGeo,
      irisMat,
      pupilGeo,
      pupilMat,
      glintGeo,
      glintMat
    );

    const buildEyeGroup = (xPos: number) => {
      const socket = new THREE.Group();
      socket.position.set(xPos, 0.13, 0.8);
      const eyeball = new THREE.Group();
      eyeball.add(new THREE.Mesh(scleraGeo, scleraMat));

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.z = 0.2;
      eyeball.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.235;
      eyeball.add(pupil);

      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(0.045, 0.048, 0.26);
      eyeball.add(glint);

      socket.add(eyeball);
      root.add(socket);
      return { socket, eyeball };
    };

    const leftEye = buildEyeGroup(-0.33);
    const rightEye = buildEyeGroup(0.33);

    // 4. Smart 3D Metallic Glasses Frames + Bridge
    const rimGeo = new THREE.TorusGeometry(0.285, 0.032, 14, 36);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.22,
    });
    const bridgeGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.18, 12);
    bridgeGeo.rotateZ(Math.PI / 2);
    disposables.push(rimGeo, frameMat, bridgeGeo);

    const leftRim = new THREE.Mesh(rimGeo, frameMat);
    leftRim.position.set(-0.33, 0.13, 0.96);
    const rightRim = new THREE.Mesh(rimGeo, frameMat);
    rightRim.position.set(0.33, 0.13, 0.96);
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    bridge.position.set(0, 0.15, 0.97);
    root.add(leftRim, rightRim, bridge);

    // 5. 3D Expressive Eyebrows
    const browGeo = new THREE.CapsuleGeometry(0.038, 0.26, 8, 12);
    browGeo.rotateZ(Math.PI / 2);
    const browMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.45,
    });
    disposables.push(browGeo, browMat);
    const leftBrow = new THREE.Mesh(browGeo, browMat);
    leftBrow.position.set(-0.34, 0.48, 0.88);
    const rightBrow = new THREE.Mesh(browGeo, browMat);
    rightBrow.position.set(0.34, 0.48, 0.88);
    root.add(leftBrow, rightBrow);

    // 6. 3D Articulated Mouth (Smile Torus Arc + Speaking Open Cavity)
    const smileArcGeo = new THREE.TorusGeometry(0.24, 0.042, 12, 28, Math.PI);
    smileArcGeo.rotateZ(Math.PI);
    const mouthDarkMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.5,
    });
    const openMouthGeo = new THREE.SphereGeometry(0.18, 24, 18);
    const tongueGeo = new THREE.SphereGeometry(0.1, 16, 12);
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4,
    });
    disposables.push(smileArcGeo, mouthDarkMat, openMouthGeo, tongueGeo, tongueMat);

    const smileArc = new THREE.Mesh(smileArcGeo, mouthDarkMat);
    smileArc.position.set(0, -0.22, 0.9);
    root.add(smileArc);

    const openMouthGroup = new THREE.Group();
    openMouthGroup.position.set(0, -0.32, 0.88);
    const cavity = new THREE.Mesh(openMouthGeo, mouthDarkMat);
    cavity.scale.set(1.15, 0.65, 0.42);
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, -0.045, 0.04);
    tongue.scale.set(1.1, 0.55, 0.5);
    openMouthGroup.add(cavity, tongue);
    root.add(openMouthGroup);

    // 7. 3D Floating Pointer Hand Sphere (shows when Ustoz points left/right at a 3D machine part!)
    const handGroup = new THREE.Group();
    const gloveGeo = new THREE.SphereGeometry(0.16, 20, 16);
    const gloveMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      clearcoat: 0.8,
    });
    const wandGeo = new THREE.ConeGeometry(0.055, 0.24, 14);
    disposables.push(gloveGeo, gloveMat, wandGeo);
    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    const wand = new THREE.Mesh(wandGeo, goldMat);
    wand.position.x = 0.2;
    wand.rotation.z = -Math.PI / 2;
    handGroup.add(glove, wand);
    handGroup.visible = false;
    scene.add(handGroup);

    // Global Mouse / Touch 3D Gaze Tracker!
    const handlePointerMove = (ev: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0) return;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      liveRef.current.cursorActive = true;
      liveRef.current.targetYaw = THREE.MathUtils.clamp(dx / 240, -0.62, 0.62);
      liveRef.current.targetPitch = THREE.MathUtils.clamp(dy / 240, -0.46, 0.46);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const clock = new THREE.Clock();
    let curYaw = 0;
    let curPitch = 0;
    let nextBlinkAt = 2.8;
    let blinkTimer = 0;
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const st = liveRef.current;

      // Smooth 3D Gaze interpolation (cursor or programmatic lookVector)
      const desiredYaw = st.cursorActive
        ? st.targetYaw
        : THREE.MathUtils.clamp((st.lookVector?.x ?? 0) * 0.25, -0.55, 0.55);
      const desiredPitch = st.cursorActive
        ? st.targetPitch
        : THREE.MathUtils.clamp((st.lookVector?.y ?? 0) * 0.22, -0.42, 0.42);

      curYaw += (desiredYaw - curYaw) * Math.min(1, dt * 10);
      curPitch += (desiredPitch - curPitch) * Math.min(1, dt * 10);

      // Rotate real 3D eyeballs toward target!
      leftEye.eyeball.rotation.y = curYaw;
      leftEye.eyeball.rotation.x = curPitch;
      rightEye.eyeball.rotation.y = curYaw;
      rightEye.eyeball.rotation.x = curPitch;

      // Subtle 3D head turn + breathing + nodding
      const nodOffset = st.isNodding ? Math.sin(t * 9) * 0.12 : 0;
      const speakBob = st.isSpeaking ? Math.sin(t * 11) * 0.04 : 0;
      root.rotation.y = curYaw * 0.42;
      root.rotation.x = curPitch * 0.32 + nodOffset + speakBob;
      root.rotation.z =
        st.expression === 'thinking'
          ? -0.1 + curYaw * -0.08
          : curYaw * -0.08 + Math.sin(t * 2.1) * 0.025;
      root.position.y = Math.sin(t * 2.4) * 0.04;

      // Swinging 3D Mortarboard Tassel physics
      tasselPivot.rotation.z = 0.12 + Math.sin(t * 3.4) * 0.12 - root.rotation.z * 0.8;
      tasselPivot.rotation.x = Math.cos(t * 2.7) * 0.08;

      // Natural blinking
      if (t > nextBlinkAt) {
        blinkTimer = 0.13;
        nextBlinkAt = t + 3.2 + Math.random() * 2.2;
      }
      let eyeScaleY = 1;
      if (blinkTimer > 0) {
        blinkTimer -= dt;
        eyeScaleY = 0.08;
      } else if (st.expression === 'proud') {
        eyeScaleY = 0.72;
      } else if (st.expression === 'amazed') {
        eyeScaleY = 1.14;
      }
      leftEye.socket.scale.y += (eyeScaleY - leftEye.socket.scale.y) * Math.min(1, dt * 22);
      rightEye.socket.scale.y += (eyeScaleY - rightEye.socket.scale.y) * Math.min(1, dt * 22);

      // 6 Emotional Eyebrow Poses
      if (st.expression === 'alert') {
        leftBrow.rotation.z = -0.32;
        rightBrow.rotation.z = 0.32;
        leftBrow.position.y = 0.45;
        rightBrow.position.y = 0.45;
      } else if (st.expression === 'thinking') {
        leftBrow.rotation.z = 0.05;
        rightBrow.rotation.z = 0.28;
        leftBrow.position.y = 0.46;
        rightBrow.position.y = 0.54;
      } else if (st.expression === 'amazed') {
        leftBrow.rotation.z = 0.14;
        rightBrow.rotation.z = -0.14;
        leftBrow.position.y = 0.55;
        rightBrow.position.y = 0.55;
      } else if (st.expression === 'proud') {
        leftBrow.rotation.z = 0.1;
        rightBrow.rotation.z = -0.1;
        leftBrow.position.y = 0.51;
        rightBrow.position.y = 0.51;
      } else {
        const lift = st.isSpeaking ? 0.03 : 0;
        leftBrow.rotation.z = 0.06;
        rightBrow.rotation.z = -0.06;
        leftBrow.position.y = 0.48 + lift - curPitch * 0.08;
        rightBrow.position.y = 0.48 + lift - curPitch * 0.08;
      }

      // 3D Lip-Sync & Emotional Mouth Morphing
      const vAct = THREE.MathUtils.clamp(st.voiceActivity, 0, 1);
      if (st.isSpeaking || st.expression === 'amazed') {
        smileArc.visible = false;
        openMouthGroup.visible = true;
        const openAmt = st.isSpeaking
          ? 0.45 + vAct * 0.95 + Math.abs(Math.sin(t * 14)) * 0.25
          : 1.05;
        openMouthGroup.scale.set(
          st.expression === 'amazed' ? 0.85 : 1.08,
          openAmt,
          1
        );
      } else if (st.expression === 'thinking' || st.expression === 'alert') {
        smileArc.visible = false;
        openMouthGroup.visible = true;
        openMouthGroup.scale.set(0.65, 0.32, 0.8);
      } else {
        smileArc.visible = true;
        openMouthGroup.visible = false;
        smileArc.scale.set(st.expression === 'proud' ? 1.15 : 1, 1, 1);
      }

      // 3D Pointing Hand Indicator
      if (st.pointingSide) {
        handGroup.visible = true;
        const dir = st.pointingSide === 'left' ? -1 : 1;
        handGroup.position.set(
          dir * (1.18 + Math.sin(t * 6.5) * 0.08),
          -0.12 + Math.cos(t * 5) * 0.04,
          0.55
        );
        handGroup.scale.x = dir;
      } else {
        handGroup.visible = false;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      activeUstozContexts = Math.max(0, activeUstozContexts - 1);
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      envRT.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  if (failed) return null;

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center pointer-events-none select-none"
    />
  );
};

export default EmojiUstoz3D;
