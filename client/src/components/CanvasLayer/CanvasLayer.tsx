import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useCanvasScaling } from '../../hooks/useCanvasScaling';
import type{ DrawActionType, DrawAction, Point } from '../../shared/protocol';
import { network } from '../../services/socket';
import { generateId } from '../../utils/id';
import { normalizePoint } from '../../utils/math';
import { renderAction } from '../../utils/render';

// ✅ 确保这里的接口定义里有 roomId
interface CanvasLayerProps {
  roomId: string; 
  activeTool: DrawActionType;
  color: string;
  strokeWidth: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ 
  roomId,
  activeTool, 
  color, 
  strokeWidth 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const canvasRefList = useMemo(() => [mainCanvasRef, previewCanvasRef], []);
  const size = useCanvasScaling(containerRef, canvasRefList);

  const [isDrawing, setIsDrawing] = useState(false);
  
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const freehandPoints = useRef<Point[]>([]);

  /* 监听网络消息并绘制 */
  useEffect(() => {
    const socket = network.socket;
    const handleRemoteDraw = (payload: { roomId: string; action: DrawAction }) => {
      if (payload.roomId !== roomId) return;
      const ctx = mainCanvasRef.current?.getContext('2d');
      if (ctx) {
        renderAction(ctx, payload.action);
      }
    };
    socket.on('draw:created', handleRemoteDraw);
    return () => {
      socket.off('draw:created', handleRemoteDraw);
    };
  }, [roomId]);

  /* 事件处理 */
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = { x, y };

    startPoint.current = p;
    lastPoint.current = p;
    
    if (activeTool === 'freehand') {
      freehandPoints.current = [p];
    }

    const ctx = previewCanvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint.current || !lastPoint.current) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentPoint = { x, y };

    const ctx = previewCanvasRef.current!.getContext('2d')!;

    if (activeTool === 'freehand') {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
      freehandPoints.current.push(currentPoint);
      lastPoint.current = currentPoint;
    } else {
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.beginPath();
      
      if (activeTool === 'rect') {
        const w = currentPoint.x - startPoint.current.x;
        const h = currentPoint.y - startPoint.current.y;
        ctx.rect(startPoint.current.x, startPoint.current.y, w, h);
      } else if (activeTool === 'ellipse') {
        const cx = (startPoint.current.x + currentPoint.x) / 2;
        const cy = (startPoint.current.y + currentPoint.y) / 2;
        const rx = Math.abs(currentPoint.x - startPoint.current.x) / 2;
        const ry = Math.abs(currentPoint.y - startPoint.current.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      }
      ctx.stroke();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const { width, height } = size; 
    const baseAction = {
      id: generateId(),
      roomId,
      userId: network.socket.id || 'unknown',
      color,
      strokeWidth,
      isDeleted: false,
      createdAt: Date.now(),
    };

    let action: DrawAction | null = null;

    if (activeTool === 'freehand' && freehandPoints.current.length > 0) {
      action = {
        ...baseAction,
        type: 'freehand',
        points: freehandPoints.current.map(p => normalizePoint(p, width, height)),
      };
    } else if (activeTool === 'rect' && startPoint.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const endP = { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      };
      action = {
        ...baseAction,
        type: 'rect',
        start: normalizePoint(startPoint.current, width, height),
        end: normalizePoint(endP, width, height),
      };
    } else if (activeTool === 'ellipse' && startPoint.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const endP = { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      };
      action = {
        ...baseAction,
        type: 'ellipse',
        start: normalizePoint(startPoint.current, width, height),
        end: normalizePoint(endP, width, height),
      };
    }

    if (action) {
      const mainCtx = mainCanvasRef.current!.getContext('2d')!;
      mainCtx.drawImage(previewCanvasRef.current!, 0, 0, width, height);
      network.sendDrawAction(roomId, action);
    }

    const previewCtx = previewCanvasRef.current!.getContext('2d')!;
    previewCtx.clearRect(0, 0, width, height);
    
    startPoint.current = null;
    lastPoint.current = null;
    freehandPoints.current = [];
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full touch-none cursor-crosshair overflow-hidden"
    >
      <canvas ref={mainCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
      <canvas 
        ref={previewCanvasRef} 
        className="absolute top-0 left-0 w-full h-full z-10"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
      />
    </div>
  );
};