import React, { useRef, useState, useMemo } from 'react';
import { useCanvasScaling } from '../../hooks/useCanvasScaling';
import type{ DrawActionType } from '../../shared/protocol';

// 定义组件接收的参数
interface CanvasLayerProps {
  activeTool: DrawActionType;
  color: string;
  strokeWidth: number;
}

interface Point {
  x: number;
  y: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ 
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
  
  // 记录起始点 (用于矩形/圆形) 和 上一个点 (用于铅笔)
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);

  /* -------------------------------------------------------------------------- */
  /* 绘图算法                                                                   */
  /* -------------------------------------------------------------------------- */

  // 1. 画线 (铅笔)
  const drawFreehand = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };

  // 2. 画矩形
  const drawRect = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.beginPath();
    const width = end.x - start.x;
    const height = end.y - start.y;
    ctx.rect(start.x, start.y, width, height);
    ctx.stroke();
  };

  // 3. 画椭圆 (基于对角线计算)
  const drawEllipse = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.beginPath();
    // 计算中心点
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    // 计算半径 (取绝对值)
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.stroke();
  };

  /* -------------------------------------------------------------------------- */
  /* 事件处理                                                                   */
  /* -------------------------------------------------------------------------- */

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = { x, y };

    startPoint.current = p;
    lastPoint.current = p;

    // 设置 Preview Canvas 的样式 (颜色、粗细)
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
      // 铅笔：直接画线段，不清空画布，保留笔迹
      drawFreehand(ctx, lastPoint.current, currentPoint);
      lastPoint.current = currentPoint;
    } else {
      // 形状：先清空 Preview，再画新的形状 (产生拖拽预览效果)
      // 注意：clearRect 使用逻辑像素，不需要乘 DPR
      ctx.clearRect(0, 0, size.width, size.height);
      
      if (activeTool === 'rect') {
        drawRect(ctx, startPoint.current, currentPoint);
      } else if (activeTool === 'ellipse') {
        drawEllipse(ctx, startPoint.current, currentPoint);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // 【本地提交】将 Preview 的内容“印”到 Main 上
    const mainCtx = mainCanvasRef.current!.getContext('2d')!;
    const previewCanvas = previewCanvasRef.current!;
    
    // 这里的 drawImage 会把 preview 上的像素原封不动拷过去
    // 不需要重新执行 drawRect 等逻辑，直接拷贝像素效率最高
    mainCtx.drawImage(previewCanvas, 0, 0, size.width, size.height);
    
    // 清空 Preview，为下一次绘制做准备
    const previewCtx = previewCanvas.getContext('2d')!;
    previewCtx.clearRect(0, 0, size.width, size.height);

    startPoint.current = null;
    lastPoint.current = null;
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full touch-none cursor-crosshair overflow-hidden"
    >
      <canvas
        ref={mainCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
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