import type{ Point } from '../shared/protocol';

/**
 * 将像素坐标转换为归一化坐标 (0~1)
 */
export function normalizePoint(x: number, y: number, width: number, height: number): Point {
  return {
    x: width === 0 ? 0 : x / width,
    y: height === 0 ? 0 : y / height,
  };
}

/**
 * 将归一化坐标转换为像素坐标
 */
export function denormalizePoint(point: Point, width: number, height: number) {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}