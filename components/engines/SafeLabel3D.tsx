import React, { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const _worldPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _projected = new THREE.Vector3();

interface SafeLabel3DProps {
  position: THREE.Vector3 | [number, number, number];
  text: string;
  className?: string;
  color?: string;
  zIndexRange?: [number, number];
}

/**
 * React-19-safe 3D projected DOM label overlay.
 * Avoids @react-three/drei <Html>'s internal ReactDOM.createRoot/unmount(),
 * which can synchronously unmount during React's commit/render phase.
 */
export const SafeLabel3D: React.FC<SafeLabel3DProps> = ({
  position,
  text,
  className = 'ziyo-3d-label',
  color,
  zIndexRange = [10, 0],
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastCoordsRef = useRef<{ x: number; y: number; visible: boolean; z: number }>({
    x: NaN,
    y: NaN,
    visible: false,
    z: 0,
  });

  const { gl, camera, scene, size, events } = useThree();

  const updateOverlayPosition = useRef<() => void>(() => {});
  updateOverlayPosition.current = () => {
    const group = groupRef.current;
    const wrapper = wrapperRef.current;
    if (!group || !wrapper || size.width <= 0 || size.height <= 0) return;

    group.updateWorldMatrix(true, false);
    _worldPos.setFromMatrixPosition(group.matrixWorld);
    _camPos.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(_camDir);
    _delta.copy(_worldPos).sub(_camPos);

    const isBehind = _delta.dot(_camDir) <= 0;
    if (isBehind) {
      if (lastCoordsRef.current.visible) {
        wrapper.style.display = 'none';
        lastCoordsRef.current.visible = false;
      }
      return;
    }

    _projected.copy(_worldPos).project(camera);
    const x = (_projected.x * 0.5 + 0.5) * size.width;
    const y = (-_projected.y * 0.5 + 0.5) * size.height;

    const camWithBounds = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const dist = _worldPos.distanceTo(_camPos);
    const near = camWithBounds.near ?? 0.1;
    const far = camWithBounds.far ?? 200;
    const a = (zIndexRange[1] - zIndexRange[0]) / Math.max(0.001, far - near);
    const b = zIndexRange[1] - a * far;
    const zIndex = Math.round(a * dist + b);

    const prev = lastCoordsRef.current;
    if (!prev.visible) {
      wrapper.style.display = 'block';
      prev.visible = true;
    }
    if (
      Number.isNaN(prev.x) ||
      Math.abs(prev.x - x) >= 0.25 ||
      Math.abs(prev.y - y) >= 0.25
    ) {
      wrapper.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      prev.x = x;
      prev.y = y;
    }
    if (prev.z !== zIndex) {
      wrapper.style.zIndex = String(zIndex);
      prev.z = zIndex;
    }
  };

  useLayoutEffect(() => {
    const target =
      (events.connected as HTMLElement | null) ||
      (gl.domElement.parentNode as HTMLElement | null);
    if (!target) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;transform-origin:0 0;display:none;';

    const inner = document.createElement('div');
    inner.className = className;
    inner.style.cssText =
      'position:absolute;transform:translate3d(-50%,-50%,0);pointer-events:none;';
    if (color) {
      inner.style.color = color;
    }
    inner.textContent = text;

    wrapper.appendChild(inner);
    target.appendChild(wrapper);

    wrapperRef.current = wrapper;
    innerRef.current = inner;
    lastCoordsRef.current = { x: NaN, y: NaN, visible: false, z: 0 };

    scene.updateMatrixWorld();
    updateOverlayPosition.current();

    return () => {
      wrapperRef.current = null;
      innerRef.current = null;
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    };
  }, [gl, events.connected, scene]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.className = className;
    inner.textContent = text;
    inner.style.color = color || '';
  }, [className, text, color]);

  useFrame(() => {
    updateOverlayPosition.current();
  });

  return <group ref={groupRef} position={position} />;
};
