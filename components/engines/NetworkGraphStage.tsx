import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import cytoscape from 'cytoscape';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export interface NetworkGraphStageProps {
  mode?: 'xyflow' | 'cytoscape';
  params: RenderParams;
  stepIndex?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

function parseMermaidOrDefault(diagram?: string): {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
} {
  if (diagram && diagram.trim().length > 0) {
    const nodeMap = new Map<string, string>();
    const edgeList: Array<{ source: string; target: string; label?: string }> = [];
    const lines = diagram.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^graph\b|^flowchart\b|^sequenceDiagram\b/i.test(line)) continue;
      const match = line.match(
        /^([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\))?\s*-->?(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\))?/
      );
      if (match) {
        const [, id1, lb1a, lb1b, edgeLabel, id2, lb2a, lb2b] = match;
        if (!nodeMap.has(id1)) nodeMap.set(id1, (lb1a || lb1b || id1).trim());
        else if (lb1a || lb1b) nodeMap.set(id1, (lb1a || lb1b)!.trim());
        if (!nodeMap.has(id2)) nodeMap.set(id2, (lb2a || lb2b || id2).trim());
        else if (lb2a || lb2b) nodeMap.set(id2, (lb2a || lb2b)!.trim());
        edgeList.push({ source: id1, target: id2, label: edgeLabel?.trim() });
      }
    }
    if (nodeMap.size >= 2) {
      return {
        nodes: Array.from(nodeMap.entries()).map(([id, label]) => ({ id, label })),
        edges: edgeList,
      };
    }
  }

  return {
    nodes: [
      { id: 'A', label: 'Manba / Hujayra signali' },
      { id: 'B', label: 'Asosiy tugun (Transformatsiya)' },
      { id: 'C', label: 'Tarmoq 1' },
      { id: 'D', label: 'Tarmoq 2' },
      { id: 'E', label: 'Yakuniy natija' },
    ],
    edges: [
      { source: 'A', target: 'B', label: 'Kirish' },
      { source: 'B', target: 'C', label: 'Oqim 1' },
      { source: 'B', target: 'D', label: 'Oqim 2' },
      { source: 'C', target: 'E' },
      { source: 'D', target: 'E' },
    ],
  };
}

export const NetworkGraphStage: React.FC<NetworkGraphStageProps> = ({
  mode: initialMode = 'xyflow',
  params,
  stepIndex = 0,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const [activeMode, setActiveMode] = useState<'xyflow' | 'cytoscape'>(initialMode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<HTMLDivElement | null>(null);

  const parsed = useMemo(() => parseMermaidOrDefault(params.diagram), [params.diagram]);

  const flowNodes = useMemo<Node[]>(
    () =>
      parsed.nodes.map((n, idx) => ({
        id: n.id,
        position: {
          x: 80 + (idx % 3) * 210,
          y: 70 + Math.floor(idx / 3) * 140,
        },
        data: { label: n.label },
        style: {
          borderRadius: 14,
          border: '2px solid #2563EB',
          background: '#FFFFFF',
          color: '#1D1D1F',
          fontWeight: 600,
          fontSize: 12,
          padding: '8px 12px',
          boxShadow: '0 6px 18px rgba(37,99,235,0.08)',
        },
      })),
    [parsed.nodes]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      parsed.edges.map((e, idx) => ({
        id: `e-${idx}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isPlaying || params.flowType !== 'none',
        style: { stroke: '#2563EB', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2563EB' },
      })),
    [parsed.edges, isPlaying, params.flowType]
  );

  useEffect(() => {
    if (!onAnchorsChange || !containerRef.current) return;
    const w = containerRef.current.clientWidth || 640;
    const h = containerRef.current.clientHeight || 400;
    onAnchorsChange({
      overview: { x: w * 0.5, y: h * 0.5 },
    });
  }, [onAnchorsChange, stepIndex, activeMode]);

  useEffect(() => {
    if (activeMode !== 'cytoscape' || !cyRef.current) return;
    const cy = cytoscape({
      container: cyRef.current,
      elements: [
        ...parsed.nodes.map((n) => ({ data: { id: n.id, label: n.label } })),
        ...parsed.edges.map((e, idx) => ({
          data: { id: `cye_${idx}`, source: e.source, target: e.target, label: e.label || '' },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#2563EB',
            label: 'data(label)',
            color: '#1D1D1F',
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 30,
            height: 30,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2.5,
            'line-color': '#94A3B8',
            'target-arrow-color': '#2563EB',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 10,
            color: '#475569',
          },
        },
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 36,
      },
    });

    return () => {
      cy.destroy();
    };
  }, [activeMode, parsed]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white">
      <div className="absolute top-3 right-3 z-20 inline-flex items-center rounded-full bg-white/95 border border-black/[0.08] p-0.5 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveMode('xyflow')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
            activeMode === 'xyflow'
              ? 'bg-[#0071E3] text-white'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          React Flow
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('cytoscape')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
            activeMode === 'cytoscape'
              ? 'bg-[#0071E3] text-white'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Cytoscape Graf
        </button>
      </div>

      {activeMode === 'xyflow' ? (
        <ReactFlow nodes={flowNodes} edges={flowEdges} fitView proOptions={{ hideAttribution: true }}>
          <Background color="#E2E8F0" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      ) : (
        <div ref={cyRef} className="w-full h-full" />
      )}
    </div>
  );
};

export default NetworkGraphStage;
