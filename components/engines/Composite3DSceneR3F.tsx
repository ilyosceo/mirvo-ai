import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { FlowType, Primitive3DItem, RenderParams } from '../../types/tutor';
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

function estimatePrimitiveBox(item: Primitive3DItem, userScale: number): THREE.Box3 {
  const [px, py, pz] = item.position;
  const a = item.args || [];
  let hx = 0.6;
  let hy = 0.6;
  let hz = 0.6;
  if (item.type === 'box') {
    hx = (a[0] ?? 1) / 2;
    hy = (a[1] ?? 1) / 2;
    hz = (a[2] ?? 1) / 2;
  } else if (item.type === 'cylinder') {
    const r = Math.max(a[0] ?? 0.4, a[1] ?? 0.5);
    hx = r;
    hz = r;
    hy = (a[2] ?? 1.5) / 2;
  } else if (item.type === 'sphere') {
    const r = a[0] ?? 1;
    hx = r;
    hy = r;
    hz = r;
  } else if (item.type === 'cone') {
    const r = a[0] ?? 1;
    hx = r;
    hz = r;
    hy = (a[1] ?? 1.6) / 2;
  } else if (item.type === 'torus') {
    const r = (a[0] ?? 0.8) + (a[1] ?? 0.22);
    hx = r;
    hy = r;
    hz = a[1] ?? 0.22;
  }

  // Approximate rotated half-extents conservatively so Box3 contains rotated cylinders/boxes
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

const PrimitiveMesh: React.FC<{
  item: Primitive3DItem;
  isDimmed: boolean;
}> = ({ item, isDimmed }) => {
  const { type, position, rotation = [0, 0, 0], args, color, opacity = 1, roughness = 0.45, label } =
    item;
  const finalOpacity = isDimmed ? Math.min(opacity, 0.22) : opacity;
  const isTransparent = finalOpacity < 0.99;

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow={!isDimmed} receiveShadow>
        {type === 'cylinder' && (
          <cylinderGeometry
            args={[args[0] ?? 0.4, args[1] ?? 0.5, args[2] ?? 1.5, args[3] ?? 20]}
          />
        )}
        {type === 'sphere' && (
          <sphereGeometry args={[args[0] ?? 1, args[1] ?? 20, args[2] ?? 20]} />
        )}
        {type === 'cone' && (
          <coneGeometry args={[args[0] ?? 1, args[1] ?? 1.6, args[2] ?? 20]} />
        )}
        {type === 'box' && (
          <boxGeometry args={[args[0] ?? 1, args[1] ?? 1, args[2] ?? 1]} />
        )}
        {type === 'torus' && (
          <torusGeometry
            args={[args[0] ?? 0.8, args[1] ?? 0.22, args[2] ?? 12, args[3] ?? 24]}
          />
        )}
        <meshStandardMaterial
          color={color}
          roughness={roughness}
          metalness={0.08}
          transparent={isTransparent}
          depthWrite={!isTransparent}
          opacity={finalOpacity}
        />
      </mesh>
      {label && !isDimmed && <StageLabel3D position={[0.9, 0.35, 0]} text={label} />}
    </group>
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
  const primitives = params.primitives_3d || [];
  const hasPrimitives = params.shape === 'composite3d' && primitives.length > 0;
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
    if (hasPrimitives || !params.svg_data) return null;
    try {
      const loader = new SVGLoader();
      const svgDoc = loader.parse(params.svg_data);
      const rawItems: Array<{
        geometry: THREE.ExtrudeGeometry;
        color: string;
        zOffset: number;
        bbox: THREE.Box3;
      }> = [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      svgDoc.paths.forEach((svgPath, idx) => {
        const fill = svgPath.color ? `#${svgPath.color.getHexString()}` : '#22c55e';
        const styleFill = (svgPath.userData as { style?: { fill?: string } } | undefined)?.style
          ?.fill;
        if (styleFill === 'none' || styleFill === 'transparent') return;

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
          partKey: `part_${bucket}`,
          center: cVec,
          box: worldBox,
        };
      });

      return { meshes, centerScale, cx, cy };
    } catch {
      return null;
    }
  }, [hasPrimitives, params.svg_data]);

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

    if (hasPrimitives) {
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

        if (activeFocus && (pKey === activeFocus || idxKey === activeFocus)) {
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
        if (activeFocus && m.partKey === activeFocus) {
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
  }, [hasPrimitives, primitives, extrudedMeshes, userScale, activeFocus, params.object_parts]);

  useLayoutEffect(() => {
    onAnchorsReady(anchors, overview, boxes);
  }, [anchors, overview, boxes, onAnchorsReady]);

  const shouldDim = Boolean(dimInactiveParts && activeFocus && hasMatchedFocus);

  return (
    <group>
      <gridHelper args={[14, 14, 0x94a3b8, 0xe2e8f0]} position={[0, 0.002, 0]} />

      <group scale={[userScale, userScale, userScale]}>
        {hasPrimitives ? (
          <group>
            {primitives.map((item, idx) => {
              const pKey = (
                item.partId || `part_${Math.min(2, Math.floor((idx / primitives.length) * 3))}`
              ).toLowerCase();
              const isItemFocused =
                !shouldDim ||
                pKey === activeFocus ||
                `part_${idx}` === activeFocus ||
                (activeFocus === 'detail_left' && item.position[0] < -0.45) ||
                (activeFocus === 'detail_right' && item.position[0] > 0.45) ||
                (activeFocus === 'detail_center' && Math.abs(item.position[0]) <= 0.45);
              return (
                <PrimitiveMesh
                  key={`prim-${idx}`}
                  item={item}
                  isDimmed={!isItemFocused}
                />
              );
            })}

            {/* 3D Line2 Flow Animation overlays for transformer/circuit composite objects */}
            {flowType !== 'none' &&
              (params.object_name_en?.toLowerCase().includes('transformer') ||
                primitives.some((it) => it.partId === 'coil_1' || it.partId === 'coil_2')) && (
                <group>
                  {/* Closed Magnetic Flux Loop inside the Iron Core */}
                  <FlowLineR3F
                    points={[
                      [-1.15, 0.5, 0.48],
                      [-1.15, 2.7, 0.48],
                      [1.15, 2.7, 0.48],
                      [1.15, 0.5, 0.48],
                      [-1.15, 0.5, 0.48],
                    ]}
                    color="#8b5cf6"
                    lineWidth={3.0}
                    dashed
                    dashSize={0.28}
                    gapSize={0.18}
                    transparent
                    opacity={!shouldDim || activeFocus === 'core' ? 0.94 : 0.35}
                    depthWrite={false}
                    renderOrder={4}
                    flowType={flowType}
                    flowSpeed={flowSpeed}
                    flowReverse={false}
                    isPlaying={isPlaying}
                  />
                  {/* Primary Coil N1 Current Ring */}
                  <FlowLineR3F
                    points={[
                      [-1.15, 2.05, 0.62],
                      [-0.53, 1.65, 0.62],
                      [-1.15, 1.25, 0.62],
                      [-1.77, 1.65, 0.62],
                      [-1.15, 2.05, 0.62],
                    ]}
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
                  {/* Secondary Coil N2 Induced Current Ring */}
                  <FlowLineR3F
                    points={[
                      [1.15, 1.9, 0.62],
                      [1.77, 1.65, 0.62],
                      [1.15, 1.4, 0.62],
                      [0.53, 1.65, 0.62],
                      [1.15, 1.9, 0.62],
                    ]}
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
                </group>
              )}
          </group>
        ) : extrudedMeshes ? (
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
                const isFocused = !shouldDim || m.partKey === activeFocus;
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
                      transparent={!isFocused}
                      depthWrite={isFocused}
                      opacity={isFocused ? 1 : 0.22}
                    />
                  </mesh>
                );
              })}
            </group>
          </group>
        ) : (
          // Ultimate graceful 3D fallback pedestal
          <mesh position={[0, 1.5, 0]}>
            <icosahedronGeometry args={[1.4, 1]} />
            <meshStandardMaterial color="#10b981" roughness={0.35} />
          </mesh>
        )}
      </group>
    </group>
  );
};
