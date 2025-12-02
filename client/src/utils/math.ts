import type { Point } from '../shared/protocol';

/**
 * 将像素坐标转换为归一化坐标 (0~1)
 * 接收 Point 对象 {x, y} 而不是单独的 x, y
 */
export function normalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: width === 0 ? 0 : point.x / width,
    y: height === 0 ? 0 : point.y / height,
  };
}

/**
 * 将归一化坐标转换为像素坐标
 */
export function denormalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}