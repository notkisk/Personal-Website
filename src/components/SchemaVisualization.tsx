import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  ConnectionLineType,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Key, Link, ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;
}

interface Table {
  columns: Column[];
  data: Record<string, unknown>[];
}

interface Schema {
  [tableName: string]: Table;
}

interface TableNodeData {
  [key: string]: unknown;
  label: string;
  columns: Column[];
  isCollapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  isHighlighted?: boolean;
}

const TableNode = ({ data, id }: { data: TableNodeData; id: string }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border shadow-2xl shadow-black/40 min-w-72 backdrop-blur-sm transition-all duration-300 ${
        data.isHighlighted 
          ? 'border-blue-400/60 shadow-blue-500/20 transform scale-105' 
          : 'border-gray-600/60 hover:border-blue-500/40 hover:shadow-blue-500/10'
      }`}
      style={{ borderRadius: '6px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-gradient-to-r from-blue-600/95 to-purple-600/95 text-white px-4 py-3 font-semibold flex items-center justify-between border-b border-gray-600/40" style={{ borderRadius: '6px 6px 0 0' }}>
        <div className="flex items-center gap-2">
          <Database size={16} />
          <span className="text-sm">{data.label}</span>
        </div>
        <button
          onClick={() => data.onToggleCollapse?.(id)}
          className="p-1 hover:bg-white/15 transition-colors"
          style={{ borderRadius: '4px' }}
        >
          {data.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      
      {!data.isCollapsed && (
        <div className="p-4 space-y-2">
          {data.columns.map((column, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between py-2.5 px-3 border hover:bg-gray-700/40 transition-all duration-200 ${
                column.isPrimary 
                  ? 'bg-yellow-500/10 border-yellow-500/30' 
                  : column.isForeign 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-gray-800/40 border-gray-600/30'
              }`}
              style={{ borderRadius: '4px' }}
            >
              <div className="flex items-center gap-2">
                {column.isPrimary && <Key size={12} className="text-yellow-400" />}
                {column.isForeign && <Link size={12} className="text-emerald-400" />}
                <span className={`text-sm font-mono ${
                  column.isPrimary ? 'text-yellow-300 font-semibold' : 
                  column.isForeign ? 'text-emerald-300 font-medium' : 'text-gray-300'
                }`}>
                  {column.name}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono">{column.type}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Relationship indicator */}
      {(isHovered || data.isHighlighted) && data.columns.some(col => col.isForeign) && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 border-2 border-gray-900 animate-pulse" style={{ borderRadius: '50%' }}></div>
      )}
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
};

interface SchemaVisualizationProps {
  schema: Schema;
  showRelationships?: boolean;
}

export const SchemaVisualization: React.FC<SchemaVisualizationProps> = ({ 
  schema, 
  showRelationships = true 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const layoutDone = useRef(false);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    if (!showRelationships) return;
    
    const relatedEdges = edges
      .filter(edge => edge.source === nodeId || edge.target === nodeId)
      .map(edge => edge.id);
    
    const relatedNodes = new Set<string>();
    edges.forEach(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        relatedNodes.add(edge.source);
        relatedNodes.add(edge.target);
      }
    });
    
    setHighlightedEdges(new Set(relatedEdges));
    setHighlightedNodes(relatedNodes);
  }, [edges, showRelationships]);

  const handleNodeMouseLeave = useCallback(() => {
    setHighlightedEdges(new Set());
    setHighlightedNodes(new Set());
  }, []);

  useEffect(() => {
    if (!schema) return;

    const tableNames = Object.keys(schema);
    const currentNodes = nodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {} as Record<string, Node<TableNodeData>>);

    const newNodes: Node<TableNodeData>[] = tableNames.map((tableName, index) => {
      const existingNode = currentNodes[tableName];
      const x = (index % 4) * 420 + 100;
      const y = Math.floor(index / 4) * 380 + 100;

      return {
        id: tableName,
        type: 'table',
        position: existingNode?.position ?? { x, y },
        data: {
          label: tableName,
          columns: schema[tableName].columns,
          isCollapsed: collapsedNodes.has(tableName),
          onToggleCollapse: handleToggleCollapse,
          isHighlighted: highlightedNodes.has(tableName),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    setNodes(newNodes);
    if (newNodes.length > 0 && !layoutDone.current) {
      layoutDone.current = true;
    }
  }, [schema, collapsedNodes, highlightedNodes, handleToggleCollapse, nodes, setNodes]);

  useEffect(() => {
    if (!schema) return;

    const newEdges: Edge[] = [];

    if (showRelationships) {
      Object.keys(schema).forEach(tableName => {
        const table = schema[tableName];
        table.columns.forEach((column) => {
          if (column.isForeign && column.references) {
            const [refTable] = column.references.split('.');
            if (schema[refTable]) {
              const edgeId = `${refTable}-${tableName}-${column.name}`;
              const isHighlighted = highlightedEdges.has(edgeId);
              
              newEdges.push({
                id: edgeId,
                source: refTable,
                target: tableName,
                type: 'straight',
                sourceHandle: null,
                targetHandle: null,
                style: { 
                  stroke: isHighlighted ? '#60a5fa' : '#3b82f6',
                  strokeWidth: isHighlighted ? 3 : 2,
                  strokeDasharray: '6,3',
                  filter: isHighlighted ? 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.8))' : 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.4))',
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: isHighlighted ? '#60a5fa' : '#3b82f6',
                  width: 16,
                  height: 16,
                },
                label: `${column.name}`,
                labelStyle: { 
                  fill: isHighlighted ? '#e5e7eb' : '#9ca3af',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: isHighlighted ? 'bold' : 'normal',
                },
                labelBgStyle: { 
                  fill: '#0f172a',
                  fillOpacity: 0.95,
                  borderRadius: 3,
                  stroke: isHighlighted ? '#60a5fa' : '#374151',
                  strokeWidth: 1,
                },
                animated: isHighlighted,
              });
            }
          }
        });
      });
    }

    setEdges(newEdges);
  }, [schema, showRelationships, highlightedEdges, setEdges]);

  return (
    <div className={`w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 bg-gray-900/80 border border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-800/80 transition-all duration-200 backdrop-blur-sm"
          style={{ borderRadius: '6px' }}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeMouseEnter={(_, node) => handleNodeMouseEnter(node.id)}
        onNodeMouseLeave={handleNodeMouseLeave}
        minZoom={0.2}
        maxZoom={2}
        connectionLineType={ConnectionLineType.Straight}
        defaultEdgeOptions={{
          type: 'straight',
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background 
          color="#374151" 
          gap={24} 
          size={1}
          style={{ opacity: 0.4 }}
        />
        <Controls 
          className="bg-gray-900/80 border border-gray-600/50 backdrop-blur-sm"
          style={{ borderRadius: '6px' }}
          showInteractive={false}
        />
        <MiniMap 
          className="bg-gray-900/80 border border-gray-600/50 backdrop-blur-sm"
          style={{ borderRadius: '6px' }}
          nodeColor={(node) => {
            if (highlightedNodes.has(node.id)) return '#60a5fa';
            return '#3b82f6';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          pannable
          zoomable
        />
      </ReactFlow>

    </div>
  );
};