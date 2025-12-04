import React, { useState } from 'react';
import classNames from 'classnames';
import { 
  Pencil, Square, Circle, Triangle, Star, MoveRight, 
  Undo2, Trash2, Palette, Minus, Highlighter,
  Diamond, Hexagon, Eraser, 
  SlidersHorizontal 
} from 'lucide-react';
import type{ DrawActionType, BrushType } from '../../shared/protocol';

interface ToolbarProps {
  activeTool: DrawActionType;
  onToolChange: (tool: DrawActionType) => void;
  brushType: BrushType;
  onBrushChange: (brush: BrushType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  brushType,
  onBrushChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onClear,
}) => {
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [showShapePanel, setShowShapePanel] = useState(false);
  const [showBrushPanel, setShowBrushPanel] = useState(false);

  // ✨ 定义 isEraser 变量 (这就是你要找的 "最开头定义")
  const isEraser = activeTool === 'freehand' && brushType === 'eraser';

  // 按钮通用样式
  const btnClass = (isActive: boolean) => classNames(
    "p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative group cursor-pointer",
    isActive 
      ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
      : "bg-white text-gray-500 hover:bg-gray-50 hover:text-blue-600 border border-gray-100"
  );

  return (
    <div className="flex gap-4 items-start">
      
      {/* --- 左侧主工具栏 --- */}
      <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-2xl shadow-xl border border-gray-100/50 pointer-events-auto">
        
        {/* 1. 画笔工具 */}
        <div className="relative">
          <button 
            className={btnClass(activeTool === 'freehand' && !isEraser)}
            onClick={() => {
              onToolChange('freehand');
              if (brushType === 'eraser') onBrushChange('pencil');
              
              setShowBrushPanel(!showBrushPanel);
              setShowShapePanel(false);
              setShowColorPanel(false);
            }}
            title="画笔工具"
          >
            {brushType === 'marker' && !isEraser ? <Highlighter size={20} /> : 
             brushType === 'laser' && !isEraser ? <div className="w-5 h-5 rounded-full bg-red-500 shadow-[0_0_10px_red]" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} /> :
             <Pencil size={20} />
            }
          </button>
        </div>

        {/* 2. 橡皮擦工具 */}
        <div className="relative">
          <button 
            className={btnClass(isEraser)}
            onClick={() => {
              onToolChange('freehand');
              onBrushChange('eraser');
              // 自动打开大小调节
              setShowColorPanel(true); 
              setShowBrushPanel(false);
              setShowShapePanel(false);
            }}
            title="橡皮擦"
          >
            <Eraser size={20} />
          </button>
        </div>

        {/* 3. 形状工具 */}
        <div className="relative">
          <button 
            className={btnClass(['rect', 'ellipse', 'triangle', 'star', 'arrow', 'diamond', 'pentagon', 'hexagon'].includes(activeTool))}
            onClick={() => {
              if (!['rect', 'ellipse', 'triangle', 'star', 'arrow', 'diamond', 'pentagon', 'hexagon'].includes(activeTool)) {
                onToolChange('rect');
              }
              setShowShapePanel(!showShapePanel);
              setShowBrushPanel(false);
              setShowColorPanel(false);
            }}
            title="形状工具"
          >
            {activeTool === 'rect' && <Square size={20} />}
            {activeTool === 'ellipse' && <Circle size={20} />}
            {activeTool === 'triangle' && <Triangle size={20} />}
            {activeTool === 'star' && <Star size={20} />}
            {activeTool === 'arrow' && <MoveRight size={20} />}
            {activeTool === 'diamond' && <Diamond size={20} />}
            {activeTool === 'pentagon' && <Hexagon size={20} />}
            {activeTool === 'hexagon' && <Hexagon size={20} />}
            {/* 默认 */}
            {activeTool === 'freehand' && <Square size={20} />} 
          </button>
        </div>

        <div className="w-8 h-[1px] bg-gray-200 mx-auto my-1" />

        {/* 4. 样式设置 */}
        <button 
          className={btnClass(showColorPanel)}
          style={{ color: isEraser ? undefined : color }} 
          onClick={() => {
            setShowColorPanel(!showColorPanel);
            setShowShapePanel(false);
            setShowBrushPanel(false);
          }}
          title={isEraser ? "调节大小" : "颜色设置"}
        >
          {isEraser ? <SlidersHorizontal size={20} /> : <Palette size={20} />}
        </button>

        {/* 5. 撤销 */}
        <button className={btnClass(false)} onClick={onUndo} title="撤销">
          <Undo2 size={20} />
        </button>

        {/* 6. 清屏 */}
        <button 
          className={classNames(btnClass(false), "hover:text-red-500 hover:bg-red-50")} 
          onClick={() => { if(window.confirm('确定要清空画布吗？')) onClear(); }}
          title="清空画布"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* --- 二级菜单 --- */}
      
      {showBrushPanel && activeTool === 'freehand' && !isEraser && (
        <div className="flex flex-col gap-2 bg-white p-3 rounded-xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-left-4 pointer-events-auto">
          <span className="text-xs font-bold text-gray-400 px-1">笔刷</span>
          <button className={classNames("p-2 rounded flex items-center gap-2 text-sm", brushType === 'pencil' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50")} onClick={() => onBrushChange('pencil')}>
            <Pencil size={16} /> 铅笔
          </button>
          <button className={classNames("p-2 rounded flex items-center gap-2 text-sm", brushType === 'marker' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50")} onClick={() => onBrushChange('marker')}>
            <Highlighter size={16} /> 水彩/马克
          </button>
          <button className={classNames("p-2 rounded flex items-center gap-2 text-sm", brushType === 'laser' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50")} onClick={() => onBrushChange('laser')}>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}/> 激光笔
          </button>
        </div>
      )}

      {showShapePanel && activeTool !== 'freehand' && (
        <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-left-4 pointer-events-auto w-72">
          <span className="col-span-4 text-xs font-bold text-gray-400 px-1">形状</span>
          {[
            { id: 'rect', icon: Square, label: '矩形' },
            { id: 'ellipse', icon: Circle, label: '圆形' },
            { id: 'triangle', icon: Triangle, label: '三角形' },
            { id: 'star', icon: Star, label: '五角星' },
            { id: 'arrow', icon: MoveRight, label: '连接线' },
            { id: 'diamond', icon: Diamond, label: '菱形' },
            { id: 'pentagon', icon: Hexagon, label: '五边形' },
            { id: 'hexagon', icon: Hexagon, label: '六边形' },
          ].map((item) => (
            <button
              key={item.id}
              className={classNames("p-2 rounded flex flex-col items-center justify-center gap-1 text-xs w-16 h-16 transition-colors", activeTool === item.id ? "bg-blue-50 text-blue-600 border border-blue-200" : "hover:bg-gray-50 border border-transparent")}
              onClick={() => onToolChange(item.id as DrawActionType)}
            >
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </div>
      )}

      {showColorPanel && (
        <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-left-4 w-48 pointer-events-auto">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-bold text-gray-400">{isEraser ? "橡皮大小" : "线宽"}</span>
              <span className="text-xs text-gray-500">{strokeWidth}</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus size={12} className="text-gray-400"/>
              {/* ✨ 动态滑块上限 */}
              <input 
                type="range" 
                min="1" 
                max={isEraser ? "100" : "20"} 
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div 
                className={classNames("rounded-full bg-black", isEraser ? "border border-gray-300 bg-white" : "")} 
                style={{ 
                  width: Math.min(24, isEraser ? strokeWidth / 3 : strokeWidth), 
                  height: Math.min(24, isEraser ? strokeWidth / 3 : strokeWidth),
                  backgroundColor: isEraser ? 'white' : 'black'
                }} 
              />
            </div>
          </div>

          {!isEraser && (
            <div>
              <span className="text-xs font-bold text-gray-400 block mb-2">颜色</span>
              <div className="grid grid-cols-5 gap-2">
                {['#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'].map(c => (
                  <button key={c} className={classNames("w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110", color === c ? "ring-2 ring-blue-500 ring-offset-2" : "")} style={{ backgroundColor: c }} onClick={() => onColorChange(c)}/>
                ))}
                <label className="w-6 h-6 rounded-full border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 relative overflow-hidden">
                  <Palette size={12} className="text-gray-500"/>
                  <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};