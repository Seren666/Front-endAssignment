import type{ Point, DrawAction } from '../shared/protocol';

export const normalizePoint = (p: Point, width: number, height: number): Point => {
  if (width === 0 || height === 0) return { x: 0, y: 0 };
  return {
    x: p.x / width,
    y: p.y / height,
  };
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- 辅助：生成顶点 (保留用于精准点击检测) ---
function getShapeVertices(type: string, start: Point, end: Point): Point[] {
  const vertices: Point[] = [];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;

  // 这里的逻辑依然保持 1:1，用于点击检测
  const regularRadius = Math.min(rx, ry);

  if (type === 'rect') {
    return [{ x: start.x, y: start.y }, { x: end.x, y: start.y }, { x: end.x, y: end.y }, { x: start.x, y: end.y }];
  } else if (type === 'triangle') {
    return [{ x: cx, y: start.y }, { x: start.x, y: end.y }, { x: end.x, y: end.y }];
  } else if (type === 'diamond') {
    return [{ x: cx, y: start.y }, { x: end.x, y: cy }, { x: cx, y: end.y }, { x: start.x, y: cy }];
  } else if (type === 'star') {
    const spikes = 5;
    const outerRadius = regularRadius;
    const innerRadius = regularRadius / 2;
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    for (let i = 0; i < spikes; i++) {
      vertices.push({ x: cx + Math.cos(rot) * outerRadius, y: cy + Math.sin(rot) * outerRadius });
      rot += step;
      vertices.push({ x: cx + Math.cos(rot) * innerRadius, y: cy + Math.sin(rot) * innerRadius });
      rot += step;
    }
    return vertices;
  } else if (type === 'arrow') {
    return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  } else if (type === 'pentagon' || type === 'hexagon') {
    const sides = type === 'pentagon' ? 5 : 6;
    const startAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / sides;
    for (let i = 0; i <= sides; i++) { 
      const angle = startAngle + i * angleStep;
      vertices.push({ x: cx + regularRadius * Math.cos(angle), y: cy + regularRadius * Math.sin(angle) });
    }
    return vertices;
  }
  return vertices;
}

// 不再计算复杂顶点，直接用 start/end 矩形
export const getActionBounds = (action: DrawAction): Rect | null => {
  if (action.isDeleted) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // A. 自由绘制 (Freehand) 
  if (action.type === 'freehand') {
    if (action.points.length === 0) return null;
    action.points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
  } 
  // B. ✨ 所有形状 (无论是圆、方、还是五角星) ✨
  // 统统使用由 start 和 end 定义的“外接矩形”
  // 这种方式最稳，配合 CanvasLayer 里的 Padding，绝不会重叠
  else {
    // @ts-ignore
    const s = action.start;
    // @ts-ignore
    const e = action.end;
    if (!s || !e) return null;

    minX = Math.min(s.x, e.x);
    minY = Math.min(s.y, e.y);
    maxX = Math.max(s.x, e.x);
    maxY = Math.max(s.y, e.y);
  }

  // 返回纯几何边界，不加 padding
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
};

export const isIntersecting = (r1: Rect, r2: Rect): boolean => {
  return !(
    r2.x > r1.x + r1.w || 
    r2.x + r2.w < r1.x || 
    r2.y > r1.y + r1.h || 
    r2.y + r2.h < r1.y
  );
};

export const getGroupBounds = (actions: DrawAction[]): Rect | null => {
  if (actions.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  actions.forEach(action => {
    const b = getActionBounds(action);
    if (b) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
  });
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

// 像素级计算
function distToSegmentSquaredPx(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
  if (l2 === 0) return (px - x1) ** 2 + (py - y1) ** 2;
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2;
}

function isPointInPolygon(p: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
                      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// 距离计算
export const getDistanceFromAction = (point: Point, action: DrawAction, width: number, height: number): number => {
  if (action.isDeleted) return Infinity;

  const bounds = getActionBounds(action);
  if (!bounds) return Infinity;
  
  // 粗筛 (使用简单的 bounds)
  const tolerance = (action.strokeWidth / 2 + 10) / Math.min(width, height);
  if (
    point.x < bounds.x - tolerance || 
    point.x > bounds.x + bounds.w + tolerance ||
    point.y < bounds.y - tolerance || 
    point.y > bounds.y + bounds.h + tolerance
  ) {
    return Infinity;
  }

  const px = point.x * width;
  const py = point.y * height;
  const strokeRadius = action.strokeWidth / 2; 
  
  if (action.type === 'freehand') {
    let minSq = Infinity;
    for (let i = 0; i < action.points.length - 1; i++) {
      const p1 = action.points[i];
      const p2 = action.points[i+1];
      const distSq = distToSegmentSquaredPx(px, py, p1.x * width, p1.y * height, p2.x * width, p2.y * height);
      if (distSq < minSq) minSq = distSq;
    }
    if (action.points.length === 1) { 
      const p1 = action.points[0];
      minSq = (px - p1.x * width) ** 2 + (py - p1.y * height) ** 2;
    }
    return Math.max(0, Math.sqrt(minSq) - strokeRadius);
  } 
  
  if (action.type === 'arrow') {
    // @ts-ignore
    const { start, end } = action;
    const distSq = distToSegmentSquaredPx(px, py, start.x * width, start.y * height, end.x * width, end.y * height);
    return Math.max(0, Math.sqrt(distSq) - strokeRadius);
  }

  if (action.type === 'ellipse') {
    // @ts-ignore
    const { start, end } = action;
    const cx = (start.x + end.x) / 2 * width;
    const cy = (start.y + end.y) / 2 * height;
    const rx = Math.abs(end.x - start.x) / 2 * width;
    const ry = Math.abs(end.y - start.y) / 2 * height;
    if (rx === 0 || ry === 0) return Infinity;
    const normalizedDist = ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2);
    return normalizedDist <= 1 ? 0 : Infinity; 
  }

  if (['rect', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon'].includes(action.type)) {
    // @ts-ignore
    const vertices = getShapeVertices(action.type, action.start, action.end);
    return isPointInPolygon(point, vertices) ? 0 : Infinity;
  }

  return Infinity;
};

// 兼容接口
export const isPointInAction = (point: Point, action: DrawAction, width: number, height: number): boolean => {
  return getDistanceFromAction(point, action, width, height) <= 3;
};