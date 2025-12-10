import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useCanvasScaling } from '../../hooks/useCanvasScaling';
import type { DrawActionType, DrawAction, Point, BrushType, PageId } from '../../shared/protocol';
import { network } from '../../services/socket';
import { generateId } from '../../utils/id';
import { normalizePoint, getActionBounds, isIntersecting, getGroupBounds, getDistanceFromAction } from '../../utils/math';
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
  const startScreenPoint = useRef<Point | null>(null); 

  const freehandPoints = useRef<Point[]>([]);
  const lasersRef = useRef<FadingStroke[]>([]);
  const actionsRef = useRef<Map<string, DrawAction>>(new Map());

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const dragOffset = useRef<Point>({ x: 0, y: 0 }); 
  const selectionBoxStart = useRef<Point | null>(null); 

  const renderActionWithOffset = (ctx: CanvasRenderingContext2D, action: DrawAction, width: number, height: number, offset: Point) => {
    const movedAction = JSON.parse(JSON.stringify(action)); 
    if (movedAction.type === 'freehand') {
      movedAction.points.forEach((p: Point) => { p.x += offset.x; p.y += offset.y; });
    } else {
      // @ts-ignore
      movedAction.start.x += offset.x; movedAction.start.y += offset.y;
      // @ts-ignore
      movedAction.end.x += offset.x; movedAction.end.y += offset.y;
    }
    renderAction(ctx, movedAction, width, height);
  };

  const redrawAll = () => {
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (!ctx || size.width === 0 || size.height === 0) return;

    ctx.clearRect(0, 0, size.width, size.height);

    const allActions = Array.from(actionsRef.current.values());
    allActions.sort((a, b) => a.createdAt - b.createdAt);

    allActions.forEach(action => {
      const actionPageId = action.pageId || 'page-1';
      if (actionPageId === pageId && !action.isDeleted) {
        if (selectedIds.has(action.id) && isDraggingSelection) return; 
        renderAction(ctx, action, size.width, size.height);
      }
    });
  };

  useEffect(() => {
    if (actionsRef.current.size > 0 && size.width > 0) {
      redrawAll();
    }
  }, [size.width, size.height, pageId, selectedIds, isDraggingSelection]);

  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
      const ctx = previewCanvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.shadowBlur = 0; 
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([]); 
      
      ctx.clearRect(0, 0, size.width, size.height);
      const now = Date.now();

      // A. 激光
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

      // B. 拖拽
      if (isDraggingSelection && selectedIds.size > 0) {
        selectedIds.forEach(id => {
          const action = actionsRef.current.get(id);
          if (action) {
            renderActionWithOffset(ctx, action, size.width, size.height, dragOffset.current);
          }
        });
      }

      // C. ✨✨✨ 蓝框渲染 ✨✨✨
      if (!isDraggingSelection && selectedIds.size > 0 && !isDrawing) {
        const selectedActions: DrawAction[] = [];
        let maxStroke = 0; 

        selectedIds.forEach(id => {
          const a = actionsRef.current.get(id);
          if (a) {
            selectedActions.push(a);
            // 找出最粗的线宽
            if (a.strokeWidth > maxStroke) maxStroke = a.strokeWidth;
          }
        });
        
        const bounds = getGroupBounds(selectedActions);
        if (bounds) {
          ctx.save();
          ctx.strokeStyle = '#3b82f6'; 
          ctx.lineWidth = 1;
          
          const boxX = bounds.x * size.width;
          const boxY = bounds.y * size.height;
          const boxW = bounds.w * size.width;
          const boxH = bounds.h * size.height;
          
          // ✨✨✨ 基础10px + 线宽的一半 ✨✨✨
          const padding = 10 + (maxStroke / 2);
          
          ctx.strokeRect(boxX - padding, boxY - padding, boxW + padding * 2, boxH + padding * 2);
          
          ctx.fillStyle = '#3b82f6';
          const drawCorner = (x: number, y: number) => {
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
          };
          drawCorner(boxX - padding, boxY - padding);
          drawCorner(boxX + boxW + padding, boxY - padding);
          drawCorner(boxX + boxW + padding, boxY + boxH + padding);
          drawCorner(boxX - padding, boxY + boxH + padding);

          ctx.restore();
        }
      }

      // D. 框选
      if (activeTool === 'select' && isDrawing && selectionBoxStart.current && lastPoint.current && !isDraggingSelection) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]); 
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; 
        const w = lastPoint.current.x - selectionBoxStart.current.x;
        const h = lastPoint.current.y - selectionBoxStart.current.y;
        ctx.fillRect(selectionBoxStart.current.x, selectionBoxStart.current.y, w, h);
        ctx.strokeRect(selectionBoxStart.current.x, selectionBoxStart.current.y, w, h);
        ctx.restore();
      }

      // E. 绘图预览
      if (isDrawing && startPoint.current && lastPoint.current && activeTool !== 'select') {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (activeTool === 'freehand') {
          if (brushType === 'marker') {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = strokeWidth * 2;
          } else if (brushType === 'laser') {
            ctx.strokeStyle = color;
            ctx.shadowBlur = 10; 
            ctx.shadowColor = color;
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
        } else {
          drawPreviewShape(ctx, activeTool, startPoint.current, lastPoint.current);
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [size, isDrawing, activeTool, brushType, color, strokeWidth, selectedIds, isDraggingSelection]);

  // --- 3. 初始数据 ---
  useEffect(() => {
    if (initialState && initialState.actions) {
      actionsRef.current.clear();
      const actions = Object.values(initialState.actions) as DrawAction[];
      actions.forEach(a => actionsRef.current.set(a.id, a));
      redrawAll();
    }
  }, [initialState]);

  // --- 4. Socket ---
  useEffect(() => {
    const socket = network.socket;

    const handleRemoteDraw = (payload: { roomId: string; action: DrawAction }) => {
      if (payload.roomId !== roomId) return;
      if (payload.action.type === 'freehand' && payload.action.brushType === 'laser') {
        const actionPageId = payload.action.pageId || 'page-1';
        if (actionPageId === pageId) lasersRef.current.push({ action: payload.action, startTime: Date.now() });
        return;
      }
      actionsRef.current.set(payload.action.id, payload.action);
      const actionPageId = payload.action.pageId || 'page-1';
      if (actionPageId === pageId) redrawAll();
    };
    
    const handleRemoteMove = (payload: { roomId: string; actionIds: string[]; dx: number; dy: number }) => {
      if (payload.roomId !== roomId) return;
      let needRedraw = false;
      payload.actionIds.forEach(id => {
        const action = actionsRef.current.get(id);
        if (action) {
          if (action.type === 'freehand') {
            action.points.forEach(p => { p.x += payload.dx; p.y += payload.dy; });
          } else {
            // @ts-ignore
            action.start.x += payload.dx; action.start.y += payload.dy;
            // @ts-ignore
            action.end.x += payload.dx; action.end.y += payload.dy;
          }
          if ((action.pageId || 'page-1') === pageId) needRedraw = true;
        }
      });
      if (needRedraw) redrawAll();
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
    socket.on('draw:moved', handleRemoteMove);
    socket.on('board:cleared', handleClear);
    socket.on('action:updatedDeleted', handleUpdateDeleted);
    socket.on('room:joined', handleStateSync);
    socket.on('room:state-sync', handleStateSync);

    return () => {
      socket.off('draw:created', handleRemoteDraw);
      socket.off('draw:moved', handleRemoteMove);
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
    const np = normalizePoint(p, size.width, size.height);
    
    startScreenPoint.current = p; 

    if (activeTool === 'select') {
      let bestActionId: string | null = null;
      let minDistance = Infinity;
      const HIT_TOLERANCE = 3; 

      const allActions = Array.from(actionsRef.current.values());
      for (let i = allActions.length - 1; i >= 0; i--) {
        const action = allActions[i];
        const actionPageId = action.pageId || 'page-1';
        if (actionPageId === pageId && !action.isDeleted) {
          const dist = getDistanceFromAction(np, action, size.width, size.height);
          if (dist <= HIT_TOLERANCE) {
            if (dist < minDistance) {
              minDistance = dist;
              bestActionId = action.id;
            }
          }
        }
      }

      // 1. 优先判定：是否在蓝框内
      let insideGroupBounds = false;
      if (selectedIds.size > 0) {
        let maxStroke = 0;
        selectedIds.forEach(id => {
          const a = actionsRef.current.get(id);
          if (a && a.strokeWidth > maxStroke) maxStroke = a.strokeWidth;
        });

        const selectedActions: DrawAction[] = [];
        selectedIds.forEach(id => {
          const a = actionsRef.current.get(id);
          if (a) selectedActions.push(a);
        });
        const bounds = getGroupBounds(selectedActions);
        if (bounds) {
          // 判定范围：与视觉蓝框一致 (Padding = 10 + 线宽一半)
          const paddingPx = 10 + (maxStroke / 2);
          const padX = paddingPx / size.width;
          const padY = paddingPx / size.height;

          if (np.x >= bounds.x - padX && np.x <= bounds.x + bounds.w + padX &&
              np.y >= bounds.y - padY && np.y <= bounds.y + bounds.h + padY) {
            insideGroupBounds = true;
          }
        }
      }

      if (insideGroupBounds) {
        setIsDraggingSelection(true);
        startPoint.current = np;
        lastPoint.current = np;
        dragOffset.current = { x: 0, y: 0 };
      } 
      else if (bestActionId) {
        setSelectedIds(new Set([bestActionId]));
        setIsDraggingSelection(true);
        startPoint.current = np;
        lastPoint.current = np;
        dragOffset.current = { x: 0, y: 0 };
      } 
      else {
        setSelectedIds(new Set()); 
        selectionBoxStart.current = p; 
        startPoint.current = p; 
        lastPoint.current = p;
      }
    } else {
      setSelectedIds(new Set());
      startPoint.current = p; 
      lastPoint.current = p;
      if (activeTool === 'freehand') freehandPoints.current = [p];
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint.current || !lastPoint.current) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const np = normalizePoint(p, size.width, size.height);

    if (activeTool === 'select') {
      if (isDraggingSelection) {
        dragOffset.current = {
          x: np.x - startPoint.current!.x,
          y: np.y - startPoint.current!.y
        };
        lastPoint.current = p; 
      } else {
        lastPoint.current = p;
      }
    } else {
      if (activeTool === 'freehand') freehandPoints.current.push(p);
      lastPoint.current = p;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const rect = containerRef.current!.getBoundingClientRect();
    const currentScreenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
    if (activeTool === 'select') {
      if (isDraggingSelection) {
        if (Math.abs(dragOffset.current.x) > 0 || Math.abs(dragOffset.current.y) > 0) {
          selectedIds.forEach(id => {
            const action = actionsRef.current.get(id);
            if (action) {
              if (action.type === 'freehand') {
                action.points.forEach(p => { p.x += dragOffset.current.x; p.y += dragOffset.current.y; });
              } else {
                // @ts-ignore
                action.start.x += dragOffset.current.x; action.start.y += dragOffset.current.y;
                // @ts-ignore
                action.end.x += dragOffset.current.x; action.end.y += dragOffset.current.y;
              }
            }
          });
          
          network.socket.emit('draw:moved', {
            roomId,
            actionIds: Array.from(selectedIds),
            dx: dragOffset.current.x,
            dy: dragOffset.current.y
          });

          dragOffset.current = { x: 0, y: 0 };
          redrawAll();
        }
        setIsDraggingSelection(false);
      } else {
        const dragDist = Math.hypot(
          currentScreenPoint.x - (startScreenPoint.current?.x || 0), 
          currentScreenPoint.y - (startScreenPoint.current?.y || 0)
        );

        if (selectionBoxStart.current && dragDist > 5) {
          const start = normalizePoint(selectionBoxStart.current, size.width, size.height);
          const end = normalizePoint(lastPoint.current!, size.width, size.height);
          
          const selectionRect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y)
          };

          const newSelectedIds = new Set<string>();
          actionsRef.current.forEach(action => {
            const actionPageId = action.pageId || 'page-1';
            if (actionPageId === pageId && !action.isDeleted) {
              const bounds = getActionBounds(action);
              if (bounds && isIntersecting(selectionRect, bounds)) {
                newSelectedIds.add(action.id);
              }
            }
          });
          setSelectedIds(newSelectedIds);
        }
        selectionBoxStart.current = null;
      }
      return;
    }

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

  const getCursorStyle = () => {
    if (activeTool === 'select') {
      if (isDraggingSelection) return 'cursor-grabbing';
      if (selectedIds.size > 0) return 'cursor-grab';
      return 'cursor-default';
    }
    return activeTool === 'freehand' && brushType === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';
  };

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