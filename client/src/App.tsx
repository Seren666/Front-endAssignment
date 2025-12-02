import { useState } from 'react';
import { CanvasLayer } from './components/CanvasLayer/CanvasLayer';
import { Toolbar } from './components/Toolbar/Toolbar';
import type{ DrawActionType } from './shared/protocol';

function App() {
  // 1. 定义全局状态 (State)
  const [activeTool, setActiveTool] = useState<DrawActionType>('freehand');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // 占位函数，后续对接
  const handleUndo = () => console.log('Undo clicked');
  const handleRedo = () => console.log('Redo clicked');

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-gray-50">
      
      {/* 顶部标题栏 */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm z-20 justify-between">
        <h1 className="font-bold text-xl text-gray-800 tracking-tight">
          🎨 CollaBoard <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-2">v1.0</span>
        </h1>
        <div className="text-sm text-gray-400">
          User: Guest
        </div>
      </header>

      {/* 主体区域 */}
      <main className="flex-1 relative flex">
        
        {/* 悬浮工具栏 (绝对定位在左上角) */}
        <div className="absolute top-4 left-4 z-30">
          <Toolbar 
            activeTool={activeTool}
            onToolChange={setActiveTool}
            color={color}
            onColorChange={setColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            undo={handleUndo}
            redo={handleRedo}
          />
        </div>

        {/* 画布层 (接收当前工具状态) 
            注意：CanvasLayer 现在还没处理这些 props，但我们先传进去
        */}
{/* 画布层 (接收当前工具状态) */}
        <CanvasLayer 
          activeTool={activeTool}
          color={color}
          strokeWidth={strokeWidth}
        />
      </main>
    </div>
  );
}

export default App;