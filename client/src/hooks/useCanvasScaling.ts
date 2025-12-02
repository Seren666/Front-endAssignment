import { useEffect, useState } from 'react';

/**
 * 自动处理 Canvas 的高分屏缩放 (DPR) 和 窗口大小变化
 */
export function useCanvasScaling(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRefs: React.RefObject<HTMLCanvasElement | null>[]
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;

      // 1. 获取容器的 CSS 尺寸
      const { clientWidth, clientHeight } = container;
      const dpr = window.devicePixelRatio || 1;

      // 2. 遍历所有传入的 canvas ref，设置物理像素尺寸
      canvasRefs.forEach((ref) => {
        const canvas = ref.current;
        if (canvas) {
          // 设置实际物理像素 (解决模糊)
          canvas.width = clientWidth * dpr;
          canvas.height = clientHeight * dpr;
          
          // 设置 CSS 样式尺寸
          canvas.style.width = `${clientWidth}px`;
          canvas.style.height = `${clientHeight}px`;

          // 缩放绘图上下文，让我们依然可以使用 CSS 像素坐标绘图
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(dpr, dpr);
            // 笔触默认圆润一些
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
        }
      });

      // 3. 更新状态，触发组件重绘
      setSize({ width: clientWidth, height: clientHeight });
    };

    // 初始化
    handleResize();

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerRef, canvasRefs]); // 依赖项

  return size;
}