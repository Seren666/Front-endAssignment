//Canvas 渲染模块，负责把之前定义的 DrawAction 画到画布上，是把白板里的每个动作从数据变成可见图形的核心工具
import type{ DrawAction, Point } from '../shared/protocol';

/**
 * 核心渲染器：支持 v1.2 所有图形，并自动处理坐标反归一化
 * @param width 画布宽度 (用于将 0~1 坐标还原为像素)
 * @param height 画布高度
 */
export function renderAction(ctx: CanvasRenderingContext2D, action: DrawAction, width: number, height: number) {
  const { type, color, strokeWidth } = action;

  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 1. 默认设置
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over'; // 默认：新图覆盖旧图
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;

  // 2. 特殊笔刷处理
  if (type === 'freehand') {
    if (action.brushType === 'marker') {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = strokeWidth * 2;
    } else if (action.brushType === 'laser') {
      ctx.strokeStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
    } 
    // ✨✨✨ 橡皮擦逻辑 ✨✨✨
    else if (action.brushType === 'eraser') {
      // 关键：destination-out 模式会让重叠部分的像素变透明
      ctx.globalCompositeOperation = 'destination-out'; 
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = 'rgba(0,0,0,1)'; // 颜色不重要，只要不透明即可触发擦除
      ctx.shadowBlur = 0;
    }
  }

  // 3. 坐标转换 (保持不变)
  const toX = (val: number) => val * width;
  const toY = (val: number) => val * height;
  const toPoint = (p: Point) => ({ x: p.x * width, y: p.y * height });

  // 4. 绘制路径 (保持不变)
  switch (type) {
    case 'freehand': {
      const { points } = action;
      if (points.length < 1) return;
      
      const p0 = points[0];
      ctx.moveTo(toX(p0.x), toY(p0.y));

      if (points.length === 1) {
        // ✨ 如果只有一个点，画一个“原地”的线，配合 round lineCap 形成圆点
        ctx.lineTo(toX(p0.x), toY(p0.y));
      } else {
        // 多个点，正常连线
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(toX(points[i].x), toY(points[i].y));
        }
      }
      break;
    }
    case 'rect': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      break;
    }
    case 'ellipse': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      break;
    }
    case 'triangle': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      const cx = (start.x + end.x) / 2;
      ctx.moveTo(cx, start.y);
      ctx.lineTo(start.x, end.y);
      ctx.lineTo(end.x, end.y);
      ctx.closePath();
      break;
    }
    case 'star': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const radius = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
      drawStar(ctx, cx, cy, 5, radius, radius / 2);
      break;
    }
    case 'arrow': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      drawArrow(ctx, start.x, start.y, end.x, end.y);
      break;
    }
    case 'diamond': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.moveTo(cx, start.y);
      ctx.lineTo(end.x, cy);
      ctx.lineTo(cx, end.y);
      ctx.lineTo(start.x, cy);
      ctx.closePath();
      break;
    }
    case 'pentagon': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      drawPolygon(ctx, start, end, 5);
      break;
    }
    case 'hexagon': {
      const start = toPoint(action.start);
      const end = toPoint(action.end);
      drawPolygon(ctx, start, end, 6);
      break;
    }
  }

  ctx.stroke();

  // 5. ⚠️ 非常重要：绘制结束后，必须把模式重置回默认！
  // 否则下一次画笔会全部变成透明的。
  ctx.globalCompositeOperation = 'source-over'; 
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
}

// 辅助函数保持不变，因为它们接收的已经是像素坐标了
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
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

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
  const headlen = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
}

function drawPolygon(ctx: CanvasRenderingContext2D, start: Point, end: Point, sides: number) {
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