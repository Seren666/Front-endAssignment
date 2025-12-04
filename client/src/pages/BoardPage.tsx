import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CanvasLayer } from '../components/CanvasLayer/CanvasLayer';
import { Toolbar } from '../components/Toolbar/Toolbar';
import type{ DrawActionType, BrushType, PageId } from '../shared/protocol';
import { network } from '../services/socket';
import { nanoid } from 'nanoid';
import { File, Plus, LogOut } from 'lucide-react';

const TEST_ROOM_ID = 'room-1';

export const BoardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialName = location.state?.username || 'User-' + nanoid(4);
  const [userName, setUserName] = useState(initialName);
  
  // ✨ 更名：默认白板名
  const [boardName, setBoardName] = useState('未命名创作');
  
  const [activeTool, setActiveTool] = useState<DrawActionType>('freehand');
  const [brushType, setBrushType] = useState<BrushType>('pencil');
  const [activePage, setActivePage] = useState<PageId>('page-1'); 
  const [color, setColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);       
  const [eraserWidth, setEraserWidth] = useState(30);    

  // ✨ 动态修改标题：这里也改成 CollabCanvas
  useEffect(() => {
    document.title = `${boardName} - CollabCanvas`; 
  }, [boardName]);

  const isEraser = activeTool === 'freehand' && brushType === 'eraser';
  const currentStrokeWidth = isEraser ? eraserWidth : brushWidth;

  const handleStrokeWidthChange = (width: number) => {
    if (isEraser) setEraserWidth(width);
    else setBrushWidth(width);
  };

  useEffect(() => {
    network.joinRoom(TEST_ROOM_ID, userName);
  }, []);

  const handleUndo = () => network.socket.emit('action:undo', { roomId: TEST_ROOM_ID, userId: network.socket.id || '' });
  const handleClear = () => network.socket.emit('board:clear', { roomId: TEST_ROOM_ID, pageId: activePage });

  const handleLogout = () => {
    if(window.confirm("确定要退出画板吗？")) {
      navigate('/'); 
    }
  };

  return (
    <div 
      className="w-screen h-screen flex flex-col bg-gray-50 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(#dbdbdb 2px, transparent 2px)',
        backgroundSize: '30px 30px'
      }}
    >
      <header className="h-12 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center px-4 justify-between z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 mr-2 transition-colors" title="退出 / 注销">
            <LogOut size={18} />
          </button>

          {/* Logo: 显示用户首字 */}
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          
          <span 
            className="font-bold text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors select-none"
            onClick={() => {
              const newName = window.prompt("重命名白板:", boardName);
              if (newName) setBoardName(newName);
            }}
            title="点击重命名"
          >
            {boardName}
          </span>
        </div>
        
        <div className="flex bg-gray-100/50 p-1 rounded-lg gap-1">
          <button className="px-3 py-1 bg-white shadow-sm rounded text-xs font-medium text-gray-700 flex items-center gap-1">
            <File size={12}/> 画布 1
          </button>
          <button className="px-2 py-1 hover:bg-white/50 rounded text-xs text-gray-500">
            <Plus size={12}/>
          </button>
        </div>

        <div 
          className="text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-gray-100 px-2 py-1 rounded transition-colors select-none"
          onClick={() => {
            const newName = window.prompt("修改您的昵称:", userName);
            if (newName) setUserName(newName);
          }}
          title="点击修改昵称"
        >
          {userName}
        </div>
      </header>

      <main className="flex-1 relative">
        <div className="absolute top-4 left-4 z-30 pointer-events-none">
          <Toolbar 
            activeTool={activeTool}
            onToolChange={setActiveTool}
            brushType={brushType}
            onBrushChange={setBrushType}
            color={color}
            onColorChange={setColor}
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
          strokeWidth={currentStrokeWidth}
        />
      </main>
    </div>
  );
};