import React from 'react';
import type{ DrawActionType } from '../../shared/protocol';
import classNames from 'classnames';

interface ToolbarProps {
  activeTool: DrawActionType;
  onToolChange: (tool: DrawActionType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  undo: () => void;
  redo: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  undo,
  redo,
}) => {
  
  // 简单的按钮样式封装
  const btnClass = (isActive: boolean) => classNames(
    "p-2 rounded transition-colors border",
    isActive ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
  );

  return (
    <div className="flex flex-col gap-4 p-4 bg-white shadow-lg rounded-xl border border-gray-100 pointer-events-auto">
      
      {/* 1. 工具选择 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-gray-400 uppercase">Tools</span>
        <div className="flex gap-2">
          <button 
            className={btnClass(activeTool === 'freehand')}
            onClick={() => onToolChange('freehand')}
          >
            ✏️ 铅笔
          </button>
          <button 
            className={btnClass(activeTool === 'rect')}
            onClick={() => onToolChange('rect')}
          >
            ⬜ 矩形
          </button>
          <button 
            className={btnClass(activeTool === 'ellipse')}
            onClick={() => onToolChange('ellipse')}
          >
            ⭕ 圆形
          </button>
        </div>
      </div>

      {/* 2. 样式调整 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-gray-400 uppercase">Style</span>
        <div className="flex items-center gap-2">
          {/* 颜色选择器 */}
          <input 
            type="color" 
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
          />
          {/* 粗细滑块 */}
          <input 
            type="range" 
            min="1" max="20"
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="w-24 cursor-pointer"
          />
          <span className="text-sm text-gray-500 w-6">{strokeWidth}</span>
        </div>
      </div>

      {/* 3. 历史记录 (撤销/重做) - 暂时留空，后面接后端 */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button className={btnClass(false)} onClick={undo}>↩️ 撤销</button>
        <button className={btnClass(false)} onClick={redo}>↪️ 重做</button>
      </div>
    </div>
  );
};