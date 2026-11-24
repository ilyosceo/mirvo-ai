import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Arrow, Text, Group } from 'react-konva';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export interface KonvaBoardStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  stepIndex?: number;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

interface DraggableNodeItem {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  shape: 'rect' | 'circle';
}

export const KonvaBoardStage: React.FC<KonvaBoardStageProps> = ({
  params,
  stepIndex = 0,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 680, height: 420 });

  const initialNodes = (): DraggableNodeItem[] => {
    if (params.object_parts && params.object_parts.length > 0) {
      const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];
      return params.object_parts.slice(0, 6).map((p, idx) => ({
        id: p.partId || `part_${idx}`,
        label: p.label,
        x: 130 + (idx % 3) * 190,
        y: 130 + Math.floor(idx / 3) * 150,
        color: colors[idx % colors.length],
        shape: idx % 2 === 0 ? 'rect' : 'circle',
      }));
    }
    return [
      { id: 'in', label: params.object_name_uz || 'Manba (Kirish)', x: 150, y: 200, color: '#2563EB', shape: 'rect' },
      { id: 'core', label: 'Jarayon / Tizim', x: 340, y: 200, color: '#F59E0B', shape: 'circle' },
      { id: 'out', label: 'Natija (Chiqish)', x: 530, y: 200, color: '#10B981', shape: 'rect' },
    ];
  };

  const [nodes, setNodes] = useState<DraggableNodeItem[]>(initialNodes);

  useEffect(() => {
    setNodes(initialNodes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, params.object_name_uz]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(320, el.clientWidth || 680);
      const h = Math.max(240, el.clientHeight || 420);
      setSize({ width: w, height: h });
      onAnchorsChange?.({
        overview: { x: w * 0.5, y: h * 0.5 },
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAnchorsChange]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <Stage width={size.width} height={size.height}>
        <Layer>
          {nodes.slice(0, -1).map((n, idx) => {
            const next = nodes[idx + 1];
            return (
              <Arrow
                key={`${n.id}-${next.id}`}
                points={[n.x + 54, n.y, next.x - 54, next.y]}
                pointerLength={10}
                pointerWidth={10}
                fill="#64748B"
                stroke="#64748B"
                strokeWidth={2.5}
              />
            );
          })}

          {nodes.map((node) => (
            <Group
              key={node.id}
              x={node.x}
              y={node.y}
              draggable
              onDragMove={(e) => {
                const nx = e.target.x();
                const ny = e.target.y();
                setNodes((prev) =>
                  prev.map((item) => (item.id === node.id ? { ...item, x: nx, y: ny } : item))
                );
              }}
            >
              {node.shape === 'circle' ? (
                <Circle
                  radius={48}
                  fill="#FFFFFF"
                  stroke={node.color}
                  strokeWidth={3}
                  shadowColor="rgba(15,23,42,0.12)"
                  shadowBlur={14}
                />
              ) : (
                <Rect
                  x={-62}
                  y={-36}
                  width={124}
                  height={72}
                  cornerRadius={16}
                  fill="#FFFFFF"
                  stroke={node.color}
                  strokeWidth={3}
                  shadowColor="rgba(15,23,42,0.12)"
                  shadowBlur={14}
                />
              )}
              <Text
                x={-56}
                y={-14}
                width={112}
                align="center"
                text={node.label}
                fontSize={12}
                fontStyle="bold"
                fill="#1D1D1F"
              />
            </Group>
          ))}
        </Layer>
      </Stage>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 border border-black/[0.06] px-2.5 py-1 text-[11px] font-medium text-[#6E6E73] shadow-xs">
        Konva Interaktiv Doska · Elementlarni surib ko‘ring
      </div>
    </div>
  );
};

export default KonvaBoardStage;
