import { useState, useEffect } from 'react';
import { CanvasLayer } from './components/CanvasLayer/CanvasLayer';
import { Toolbar } from './components/Toolbar/Toolbar';
import type{ DrawActionType } from './shared/protocol';
import { network } from './services/socket'; // 引入网络服务
import { nanoid } from 'nanoid';

// 固定的测试房间 ID，方便调试
const TEST_ROOM_ID = 'room-1';
// 随机生成一个用户名
const USER_NAME = 'User-' + nanoid(4);

function App() {
  const [activeTool, setActiveTool] = useState<DrawActionType>('freehand');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // 1. 初始化连接并加入房间
  useEffect(() => {
    // 组件挂载时，发送加入房间指令
    console.log(`🔌 正在尝试加入房间: ${TEST_ROOM_ID} as ${USER_NAME}...`);
    network.joinRoom(TEST_ROOM_ID, USER_NAME);

    // 这里可以监听连接状态 (可选)
    network.socket.on('room:joined', (data) => {
      console.log('✅ 成功加入房间!', data);
    });

    return () => {
      // 组件卸载时可以做清理，暂不需要离开房间逻辑
    };
  }, []);

  const handleUndo = () => network.socket.emit('action:undo', { roomId: TEST_ROOM_ID });
  const handleRedo = () => network.socket.emit('action:redo', { roomId: TEST_ROOM_ID });

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm z-20 justify-between">
        <h1 className="font-bold text-xl text-gray-800 tracking-tight">
          🎨 CollaBoard <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-2">v1.0</span>
        </h1>
        <div className="text-sm text-gray-400">
          Room: <span className="font-mono text-gray-600">{TEST_ROOM_ID}</span> | User: {USER_NAME}
        </div>
      </header>

      <main className="flex-1 relative flex">
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

        {/* 2. 把 roomId 传给 CanvasLayer，它发消息时需要用 */}
        <CanvasLayer 
          roomId={TEST_ROOM_ID}
          activeTool={activeTool}
          color={color}
          strokeWidth={strokeWidth}
        />
      </main>
    </div>
  );
}

export default App;