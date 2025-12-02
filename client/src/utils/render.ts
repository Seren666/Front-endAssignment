import type{ DrawAction } from '../shared/protocol';

/**
 * 核心渲染器：根据 Action 数据在 Canvas 上绘制
 * 这个函数既用于画自己的最终结果，也用于画别人传来的动作
 */
export function renderAction(ctx: CanvasRenderingContext2D, action: DrawAction) {
  const { type, color, strokeWidth } = action;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'freehand': {
      const { points } = action;
      if (points.length < 1) return;
      
      // 移动到第一个点 (注意：这里已经是像素坐标，假设传入前已处理好，或者在外部处理)
      // *修正策略*：为了简单，我们约定传入 ctx 之前，canvas 已经处理好缩放，
      // 这里的 points 应该是【实际像素坐标】。
      // 但 Protocol 里存的是【归一化坐标】。
      // 所以我们需要一个 helper 来转换，或者在外部转换。
      // 为保持 render 函数纯粹，我们假设传入的 points 已经是反归一化过的，或者我们在外部缩放 Context。
      
      // *更好的策略*：利用 Canvas 的 scale 功能。
      // 如果我们传入归一化坐标，ctx 需要 scale(width, height)。
      // 但为了通用性，我们这里先假设传入的是 【0~1 归一化坐标】，
      // 调用者负责 ctx.scale(width, height)。
      
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      break;
    }

    case 'rect': {
      const { start, end } = action;
      const w = end.x - start.x;
      const h = end.y - start.y;
      ctx.rect(start.x, start.y, w, h);
      break;
    }

    case 'ellipse': {
      const { start, end } = action;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      break;
    }
  }

  ctx.stroke();
}