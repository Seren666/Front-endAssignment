import { useState, useEffect } from 'react';
import { CanvasLayer } from './components/CanvasLayer/CanvasLayer';
import { Toolbar } from './components/Toolbar/Toolbar';
import type{ DrawActionType, BrushType, PageId } from './shared/protocol';
import { network } from './services/socket';
import { nanoid } from 'nanoid';
import { File, Plus } from 'lucide-react';

const TEST_ROOM_ID = 'room-1';
const USER_NAME = 'User-' + nanoid(4);

function App() {
  // 状态管理
  const [activeTool, setActiveTool] = useState<DrawActionType>('freehand');
  const [brushType, setBrushType] = useState<BrushType>('pencil');
  const [activePage, setActivePage] = useState<PageId>('page-1'); 
  const [color, setColor] = useState('#000000');
  
  // ✨✨✨ 核心修改：分离笔刷宽度和橡皮宽度 ✨✨✨
  const [brushWidth, setBrushWidth] = useState(3);       // 画笔/形状 默认细一点
  const [eraserWidth, setEraserWidth] = useState(30);    // 橡皮擦 默认粗一点

  // 计算当前应该使用的宽度
  const isEraser = activeTool === 'freehand' && brushType === 'eraser';
  const currentStrokeWidth = isEraser ? eraserWidth : brushWidth;

  // 处理宽度变更
  const handleStrokeWidthChange = (width: number) => {
    if (isEraser) {
      setEraserWidth(width);
    } else {
      setBrushWidth(width);
    }
  };

  // 初始化连接
  useEffect(() => {
    network.joinRoom(TEST_ROOM_ID, USER_NAME);
  }, []);

  const handleUndo = () => network.socket.emit('action:undo', { roomId: TEST_ROOM_ID, userId: network.socket.id || '' });
  const handleClear = () => network.socket.emit('board:clear', { roomId: TEST_ROOM_ID, pageId: activePage });

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-100 overflow-hidden">
      
      {/* 1. 顶部极简栏 */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 justify-between z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">C</div>
          <span className="font-bold text-gray-700">CollaBoard</span>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
          <button className="px-3 py-1 bg-white shadow-sm rounded text-xs font-medium text-gray-700 flex items-center gap-1">
            <File size={12}/> 画布 1
          </button>
          <button className="px-2 py-1 hover:bg-white/50 rounded text-xs text-gray-500">
            <Plus size={12}/>
          </button>
        </div>

        <div className="text-xs text-gray-400">
          {USER_NAME}
        </div>
      </header>

      {/* 2. 主区域 */}
      <main className="flex-1 relative">
        
        <div className="absolute top-4 left-4 z-30 pointer-events-none">
          <Toolbar 
            activeTool={activeTool}
            onToolChange={setActiveTool}
            brushType={brushType}
            onBrushChange={setBrushType}
            color={color}
            onColorChange={setColor}
            // ✨ 传入动态计算后的宽度和处理函数
            strokeWidth={currentStrokeWidth}
            onStrokeWidthChange={handleStrokeWidthChange}
            onUndo={handleUndo}
            onClear={handleClear}
          />
        </div>

        <CanvasLayer 
          roomId={TEST_ROOM_ID}
          pageId={activePage}
          activeTool={activeTool}
          brushType={brushType}
          color={color}
          // ✨ 传入动态计算后的宽度
          strokeWidth={currentStrokeWidth}
        />
      </main>
    </div>
  );
}

export default App;