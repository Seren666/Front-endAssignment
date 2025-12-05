import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useCanvasScaling } from '../../hooks/useCanvasScaling';
import type { DrawActionType, DrawAction, Point, BrushType, PageId } from '../../shared/protocol';
import { network } from '../../services/socket';
import { generateId } from '../../utils/id';
import { normalizePoint } from '../../utils/math';
import { renderAction } from '../../utils/render';

interface CanvasLayerProps {
  roomId: string;
  pageId: PageId;
  activeTool: DrawActionType;
  brushType: BrushType;
  color: string;
  strokeWidth: number;
  initialState?: any;
}

interface FadingStroke {
  action: DrawAction;
  startTime: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ 
  roomId,
  pageId,
  activeTool, 
  brushType,
  color, 
  strokeWidth,
  initialState
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
  const lasersRef = useRef<FadingStroke[]>([]);

  const actionsRef = useRef<Map<string, DrawAction>>(new Map());

  // --- 1. 核心重绘 ---
  const redrawAll = () => {
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (!ctx || size.width === 0 || size.height === 0) return;

    ctx.clearRect(0, 0, size.width, size.height);

    const allActions = Array.from(actionsRef.current.values());
    allActions.sort((a, b) => a.createdAt - b.createdAt);

    allActions.forEach(action => {
      const actionPageId = action.pageId || 'page-1';
      if (actionPageId === pageId && !action.isDeleted) {
        renderAction(ctx, action, size.width, size.height);
      }
    });
  };

  // 尺寸变化时重绘
  useEffect(() => {
    if (actionsRef.current.size > 0 && size.width > 0) {
      redrawAll();
    }
  }, [size.width, size.height, pageId]);

  // --- 2. 动画循环 ---
  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
      const ctx = previewCanvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size.width, size.height);
      const now = Date.now();

      // 激光
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
        const item = lasersRef.current[i];
        const age = now - item.startTime;
        if (age >= 2000) {
          lasersRef.current.splice(i, 1);
        } else {
          const alpha = 1 - (age / 2000);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 10;
          ctx.shadowColor = item.action.color;
          renderAction(ctx, item.action, size.width, size.height);
          ctx.restore();
        }
      }

      // 预览绘制
      if (isDrawing && startPoint.current && lastPoint.current) {
        if (activeTool === 'freehand') {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (brushType === 'marker') {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = strokeWidth * 2;
          } else if (brushType === 'laser') {
            ctx.strokeStyle = color;
          } else if (brushType === 'eraser') {
            ctx.strokeStyle = '#ffffff'; 
            ctx.lineWidth = strokeWidth;
          }

          if (freehandPoints.current.length > 0) {
             const points = freehandPoints.current;
             ctx.moveTo(points[0].x, points[0].y);
             if (points.length === 1) ctx.lineTo(points[0].x, points[0].y);
             else for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
             ctx.stroke();
          }
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          drawPreviewShape(ctx, activeTool, startPoint.current, lastPoint.current);
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [size, isDrawing, activeTool, brushType, color, strokeWidth]);

  // --- 3. 初始数据加载 ---
  useEffect(() => {
    if (initialState && initialState.actions) {
      actionsRef.current.clear();
      const actions = Object.values(initialState.actions) as DrawAction[];
      actions.forEach(a => actionsRef.current.set(a.id, a));
      redrawAll();
    }
  }, [initialState]);

  // --- 4. Socket 监听 ---
  useEffect(() => {
    const socket = network.socket;

    const handleRemoteDraw = (payload: { roomId: string; action: DrawAction }) => {
      if (payload.roomId !== roomId) return;

      if (payload.action.type === 'freehand' && payload.action.brushType === 'laser') {
        const actionPageId = payload.action.pageId || 'page-1';
        if (actionPageId === pageId) {
          lasersRef.current.push({ action: payload.action, startTime: Date.now() });
        }
        return;
      }

      actionsRef.current.set(payload.action.id, payload.action);
      
      const actionPageId = payload.action.pageId || 'page-1';
      if (actionPageId === pageId) {
        const ctx = mainCanvasRef.current?.getContext('2d');
        if (ctx && size.width > 0) {
          renderAction(ctx, payload.action, size.width, size.height);
        }
      }
    };
    
    const handleClear = (payload: { roomId: string; pageId: PageId }) => {
      if (payload.roomId !== roomId) return;
      actionsRef.current.forEach(action => {
        const actionPageId = action.pageId || 'page-1';
        if (actionPageId === payload.pageId) action.isDeleted = true;
      });
      if (payload.pageId === pageId) redrawAll();
    };

    const handleUpdateDeleted = (payload: { roomId: string; actionId: string; isDeleted: boolean }) => {
      if (payload.roomId !== roomId) return;
      const action = actionsRef.current.get(payload.actionId);
      if (action) {
        action.isDeleted = payload.isDeleted;
        const actionPageId = action.pageId || 'page-1';
        if (actionPageId === pageId) redrawAll();
      }
    };

    const handleStateSync = (payload: { state: any }) => {
      actionsRef.current.clear();
      if (payload.state && payload.state.actions) {
        const actions = Object.values(payload.state.actions) as DrawAction[];
        actions.forEach(a => actionsRef.current.set(a.id, a));
      }
      redrawAll();
    };

    socket.on('draw:created', handleRemoteDraw);
    socket.on('board:cleared', handleClear);
    socket.on('action:updatedDeleted', handleUpdateDeleted);
    socket.on('room:joined', handleStateSync);
    socket.on('room:state-sync', handleStateSync);

    return () => {
      socket.off('draw:created', handleRemoteDraw);
      socket.off('board:cleared', handleClear);
      socket.off('action:updatedDeleted', handleUpdateDeleted);
      socket.off('room:joined', handleStateSync);
      socket.off('room:state-sync', handleStateSync);
    };
  }, [roomId, pageId, size]);

  // --- 5. 辅助绘图 ---
  const drawPreviewShape = (ctx: CanvasRenderingContext2D, type: DrawActionType, start: Point, end: Point) => {
    ctx.beginPath();
    if (type === 'rect') ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    else if (type === 'ellipse') {
       const cx = (start.x + end.x) / 2; const cy = (start.y + end.y) / 2;
       const rx = Math.abs(end.x - start.x) / 2; const ry = Math.abs(end.y - start.y) / 2;
       ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    } else if (type === 'triangle') {
        const cx = (start.x + end.x) / 2;
        ctx.moveTo(cx, start.y); ctx.lineTo(start.x, end.y); ctx.lineTo(end.x, end.y); ctx.closePath();
    } else if (type === 'star') {
        const cx = (start.x + end.x) / 2; const cy = (start.y + end.y) / 2;
        const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
        drawStar(ctx, cx, cy, 5, radius, radius / 2);
    } else if (type === 'arrow') {
        drawArrow(ctx, start.x, start.y, end.x, end.y);
    } else if (type === 'diamond') {
        const cx = (start.x + end.x) / 2; const cy = (start.y + end.y) / 2;
        ctx.moveTo(cx, start.y); ctx.lineTo(end.x, cy); ctx.lineTo(cx, end.y); ctx.lineTo(start.x, cy); ctx.closePath();
    } else if (type === 'pentagon') {
        drawPreviewPolygon(ctx, start, end, 5);
    } else if (type === 'hexagon') {
        drawPreviewPolygon(ctx, start, end, 6);
    }
    ctx.stroke();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
      let rot = Math.PI / 2 * 3;
      let x = cx; let y = cy;
      const step = Math.PI / spikes;
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
  }

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
      const headlen = 15;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  }

  const drawPreviewPolygon = (ctx: CanvasRenderingContext2D, start: Point, end: Point, sides: number) => {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
    const angleStep = (Math.PI * 2) / sides;
    const startAngle = -Math.PI / 2;
    ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle));
    for (let i = 1; i <= sides; i++) {
      const angle = startAngle + i * angleStep;
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    ctx.closePath();
  }

  // --- 6. 事件处理 ---
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const rect = containerRef.current!.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    startPoint.current = p; lastPoint.current = p;
    if (activeTool === 'freehand') freehandPoints.current = [p];
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint.current || !lastPoint.current) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (activeTool === 'freehand') freehandPoints.current.push(currentPoint);
    lastPoint.current = currentPoint;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const { width, height } = size; 
    
    const baseAction = {
      id: generateId(),
      roomId,
      pageId,
      userId: network.socket.id || 'unknown',
      color,
      strokeWidth,
      isDeleted: false,
      createdAt: Date.now(),
    };

    let action: DrawAction | null = null;
    if (activeTool === 'freehand' && freehandPoints.current.length > 0) {
      action = { ...baseAction, type: 'freehand', brushType, points: freehandPoints.current.map(p => normalizePoint(p, width, height)) };
    } else if (startPoint.current && lastPoint.current) {
       action = { ...baseAction, type: activeTool as any, start: normalizePoint(startPoint.current, width, height), end: normalizePoint(lastPoint.current, width, height) };
    }

    if (action) {
      if (activeTool === 'freehand' && brushType === 'laser') {
        lasersRef.current.push({ action, startTime: Date.now() });
        network.sendDrawAction(roomId, action);
      } else {
        actionsRef.current.set(action.id, action);
        network.sendDrawAction(roomId, action);
        const mainCtx = mainCanvasRef.current!.getContext('2d')!;
        renderAction(mainCtx, action, width, height); 
      }
    }
    startPoint.current = null; lastPoint.current = null; freehandPoints.current = [];
  };

  const getCursorStyle = () => activeTool === 'freehand' && brushType === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  return (
    <div ref={containerRef} className={`relative w-full h-full touch-none overflow-hidden ${getCursorStyle()}`}>
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