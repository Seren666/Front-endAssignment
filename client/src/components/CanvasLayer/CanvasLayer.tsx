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

  const lasersRef = useRef<FadingStroke[]>([]);

  // --- 动画循环 (处理激光消失 + 实时拖拽预览) ---
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const ctx = previewCanvasRef.current?.getContext('2d');
      if (!ctx) return;

      // 1. 清空 Preview 层
      ctx.clearRect(0, 0, size.width, size.height);
      const now = Date.now();

      // 2. 绘制正在消失的激光 (Lasers)
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
        const item = lasersRef.current[i];
        const age = now - item.startTime;
        const lifeTime = 2000; // 激光存活 2 秒

        if (age >= lifeTime) {
          lasersRef.current.splice(i, 1);
        } else {
          const alpha = 1 - (age / lifeTime);
          ctx.save();
          ctx.globalAlpha = alpha;
          // 渲染 laser，注意传入宽高
          renderAction(ctx, item.action, size.width, size.height);
          ctx.restore();
        }
      }

      // 3. 绘制当前正在画的内容 (Current Drawing)
      if (isDrawing && startPoint.current && lastPoint.current) {
        if (activeTool === 'freehand') {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // --- 笔刷样式处理 ---
          if (brushType === 'marker') {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = strokeWidth * 2;
          } else if (brushType === 'laser') {
            ctx.strokeStyle = color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
          } else if (brushType === 'eraser') {
            // 橡皮擦预览：白色，不加倍 (完全由 strokeWidth 控制)
            ctx.strokeStyle = '#ffffff'; 
            ctx.lineWidth = strokeWidth;
          }

          // ✨ 关键修复：预览层也支持画点
          if (freehandPoints.current.length > 0) {
             const points = freehandPoints.current;
             ctx.moveTo(points[0].x, points[0].y);
             
             if (points.length === 1) {
               // 只有一个点，原地画一下
               ctx.lineTo(points[0].x, points[0].y);
             } else {
               // 多个点，正常连线
               for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
             }
             ctx.stroke();
          }
          
          // 还原状态
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;

        } else {
          // 形状预览
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

  // --- 监听网络消息 ---
  useEffect(() => {
    const socket = network.socket;
    const handleRemoteDraw = (payload: { roomId: string; action: DrawAction }) => {
      if (payload.roomId !== roomId || payload.action.pageId !== pageId) return;

      if (payload.action.type === 'freehand' && payload.action.brushType === 'laser') {
        lasersRef.current.push({
          action: payload.action,
          startTime: Date.now()
        });
      } else {
        const ctx = mainCanvasRef.current?.getContext('2d');
        if (ctx) {
          renderAction(ctx, payload.action, size.width, size.height);
        }
      }
    };
    
    const handleClear = (payload: { roomId: string; pageId: PageId }) => {
      if (payload.roomId === roomId && payload.pageId === pageId) {
        const ctx = mainCanvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, size.width, size.height);
      }
    };

    socket.on('draw:created', handleRemoteDraw);
    socket.on('board:cleared', handleClear);

    return () => {
      socket.off('draw:created', handleRemoteDraw);
      socket.off('board:cleared', handleClear);
    };
  }, [roomId, pageId, size]);

  // --- 辅助：形状预览 ---
  const drawPreviewShape = (ctx: CanvasRenderingContext2D, type: DrawActionType, start: Point, end: Point) => {
    if (type === 'rect') {
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (type === 'ellipse') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    } else if (type === 'triangle') {
      const cx = (start.x + end.x) / 2;
      ctx.moveTo(cx, start.y);
      ctx.lineTo(start.x, end.y);
      ctx.lineTo(end.x, end.y);
      ctx.closePath();
    } else if (type === 'star') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
      const spikes = 5;
      const outerRadius = radius;
      const innerRadius = radius / 2;
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
    } else if (type === 'arrow') {
      const headlen = 15;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
    } else if (type === 'diamond') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.moveTo(cx, start.y);
      ctx.lineTo(end.x, cy);
      ctx.lineTo(cx, end.y);
      ctx.lineTo(start.x, cy);
      ctx.closePath();
    } else if (type === 'pentagon') {
      drawPreviewPolygon(ctx, start, end, 5);
    } else if (type === 'hexagon') {
      drawPreviewPolygon(ctx, start, end, 6);
    }
    ctx.stroke();
  };

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

  // --- 事件处理 ---
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
    // 注意：这里删除了旧的 ctx 设置逻辑，完全交由 renderLoop 处理，更清晰
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint.current || !lastPoint.current) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentPoint = { x, y };

    if (activeTool === 'freehand') {
      freehandPoints.current.push(currentPoint);
    }
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
      action = {
        ...baseAction,
        type: 'freehand',
        brushType, 
        points: freehandPoints.current.map(p => normalizePoint(p, width, height)),
      };
    } else if (['rect', 'ellipse', 'triangle', 'star', 'arrow', 'diamond', 'pentagon', 'hexagon'].includes(activeTool) && startPoint.current && lastPoint.current) {
      action = {
        ...baseAction,
        type: activeTool as any,
        start: normalizePoint(startPoint.current, width, height),
        end: normalizePoint(lastPoint.current, width, height),
      };
    }

    if (action) {
      if (activeTool === 'freehand' && brushType === 'laser') {
        lasersRef.current.push({
          action: action,
          startTime: Date.now()
        });
      } else {
        const mainCtx = mainCanvasRef.current!.getContext('2d')!;
        renderAction(mainCtx, action, width, height); 
      }
      
      network.sendDrawAction(roomId, action);
    }

    startPoint.current = null;
    lastPoint.current = null;
    freehandPoints.current = [];
  };

  return (
    <div ref={containerRef} className="relative w-full h-full touch-none cursor-crosshair overflow-hidden">
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