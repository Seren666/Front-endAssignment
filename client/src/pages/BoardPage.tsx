import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CanvasLayer } from '../components/CanvasLayer/CanvasLayer';
import { Toolbar } from '../components/Toolbar/Toolbar';
import type { DrawActionType, BrushType, PageId, Page } from '../shared/protocol';
import { network } from '../services/socket';
import { File, Plus, LogOut, X, ChevronDown, Check, ChevronLeft, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';
import classNames from 'classnames';

export const BoardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasJoined = useRef(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // --- 1. 数据获取 ---
  const getStoredData = () => {
    const state = location.state || {};
    return {
      roomId: state.roomId || sessionStorage.getItem('collab_room_id') || '',
      username: state.username || sessionStorage.getItem('collab_username') || '',
      password: state.password || sessionStorage.getItem('collab_password') || '',
      mode: state.mode || 'join',
      alreadyJoined: state.joined === true,
      initialState: state.initialState || null
    };
  };

  const { roomId, username, password, alreadyJoined, initialState } = getStoredData();

  // --- 状态定义 ---
  const [boardName, setBoardName] = useState(roomId ? `房间: ${roomId}` : '未连接');
  const [activeTool, setActiveTool] = useState<DrawActionType>('freehand');
  const [brushType, setBrushType] = useState<BrushType>('pencil');
  const [color, setColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);       
  const [eraserWidth, setEraserWidth] = useState(30);    

  const [pages, setPages] = useState<Page[]>([{ id: 'page-1', name: '画布 1' }]);
  const [activePage, setActivePage] = useState<PageId>('page-1');
  const [showPageMenu, setShowPageMenu] = useState(false);

  // --- 弹窗状态管理 ---
  const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);
  const [ignoreDeleteConfirm, setIgnoreDeleteConfirm] = useState(false);
  const [tempDeleteCheckbox, setTempDeleteCheckbox] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [ignoreClearConfirm, setIgnoreClearConfirm] = useState(false);
  const [tempClearCheckbox, setTempClearCheckbox] = useState(false);

  useEffect(() => {
    if(boardName) document.title = `${boardName} - CollabCanvas`; 
  }, [boardName]);

  const isEraser = activeTool === 'freehand' && brushType === 'eraser';
  const currentStrokeWidth = isEraser ? eraserWidth : brushWidth;

  const handleStrokeWidthChange = (width: number) => {
    if (isEraser) setEraserWidth(width);
    else setBrushWidth(width);
  };

  // --- 2. 自动滚动 ---
  useLayoutEffect(() => {
    const activeTab = document.getElementById(`tab-${activePage}`);
    if (activeTab && scrollContainerRef.current) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activePage]); 

  // --- 3. 长按滑动 ---
  const startScrolling = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const step = direction === 'left' ? -100 : 100;
    scrollContainerRef.current.scrollBy({ left: step, behavior: 'smooth' });
    scrollIntervalRef.current = window.setInterval(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 150);
  };

  const stopScrolling = () => {
    if (scrollIntervalRef.current !== null) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // --- 4. Socket ---
  useEffect(() => {
    if (!roomId || !username) {
      navigate('/', { replace: true });
      return;
    }

    const handlePageUpdate = (payload: { pages: Page[] }) => {
      setPages(prev => {
        if (payload.pages.length > prev.length) {
          const newPage = payload.pages[payload.pages.length - 1];
          setTimeout(() => setActivePage(newPage.id), 50);
        }
        return payload.pages;
      });
    };

    const handleJoinedData = (payload: { state: any }) => {
      if (payload.state && payload.state.pages) {
        setPages(payload.state.pages);
        const currentExists = payload.state.pages.find((p: Page) => p.id === activePage);
        if (!currentExists && payload.state.pages.length > 0) {
           setActivePage(payload.state.pages[0].id);
        }
      }
    };

    network.socket.on('page:updated', handlePageUpdate);
    network.socket.on('room:joined', handleJoinedData);
    
    if (!alreadyJoined && !hasJoined.current) {
      console.log(`🔄 自动重连: ${roomId}`);
      network.joinRoom(roomId, username, password, 'join');
      hasJoined.current = true;
    }

    if (alreadyJoined && initialState && initialState.pages) {
      setPages(initialState.pages);
    }

    return () => {
      network.socket.off('page:updated', handlePageUpdate);
      network.socket.off('room:joined', handleJoinedData);
    };
  }, [roomId, username, password, navigate, alreadyJoined, initialState]); 

  // --- 5. 操作逻辑 ---
  const handleAddPage = () => network.socket.emit('page:create', { roomId });

  const handleDeletePageClick = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (pages.length <= 1) {
      alert("至少保留一个画布！");
      return;
    }
    if (ignoreDeleteConfirm) {
      executeDelete(pageId);
    } else {
      setPendingDeletePageId(pageId);
      setTempDeleteCheckbox(false);
    }
  };

  const executeDelete = (pageId: string) => {
    if (activePage === pageId) {
      const index = pages.findIndex(p => p.id === pageId);
      const prevIndex = index > 0 ? index - 1 : 0;
      setActivePage(pages[prevIndex].id);
    }
    network.socket.emit('page:delete', { roomId, pageId });
  };

  const confirmDelete = () => {
    if (pendingDeletePageId) {
      if (tempDeleteCheckbox) setIgnoreDeleteConfirm(true);
      executeDelete(pendingDeletePageId);
      setPendingDeletePageId(null);
    }
  };

  const handleClearClick = () => {
    if (ignoreClearConfirm) {
      executeClear();
    } else {
      setShowClearConfirm(true);
      setTempClearCheckbox(false);
    }
  };

  const executeClear = () => {
    network.socket.emit('board:clear', { roomId, pageId: activePage });
  };

  const confirmClear = () => {
    if (tempClearCheckbox) setIgnoreClearConfirm(true);
    executeClear();
    setShowClearConfirm(false);
  };

  const handleUndo = () => network.socket.emit('action:undo', { roomId, userId: network.socket.id || '' });

  const handleLogout = () => {
    if(window.confirm("确定要退出房间吗？")) {
      network.leaveRoom(roomId);
      sessionStorage.clear();
      navigate('/'); 
    }
  };

  if (!roomId || !username) return null;

  return (
    <div 
      className="w-screen h-screen flex flex-col bg-gray-50 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(#dbdbdb 2px, transparent 2px)',
        backgroundSize: '30px 30px'
      }}
    >
      <header className="h-12 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center px-4 justify-between z-50 shadow-sm relative">
        <div className="flex items-center gap-2 min-w-[150px]">
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 mr-2 transition-colors" title="退出">
            <LogOut size={18} />
          </button>
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <span 
            className="font-bold text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors select-none truncate max-w-[120px]"
            onClick={() => {
              const newName = window.prompt("重命名白板:", boardName);
              if (newName) setBoardName(newName);
            }}
          >
            {boardName}
          </span>
        </div>
        
        <div className="flex-1 flex justify-center items-center gap-2 mx-2 min-w-0">
          <div className="flex items-center bg-gray-100/80 p-1 rounded-lg gap-1 max-w-full relative">
            <button 
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-colors active:scale-95 flex-shrink-0"
              onMouseDown={() => startScrolling('left')}
              onMouseUp={stopScrolling}
              onMouseLeave={stopScrolling}
            >
              <ChevronLeft size={16} />
            </button>

            <div 
              ref={scrollContainerRef}
              className="flex gap-1 overflow-x-hidden max-w-[40vw] scroll-smooth"
            >
              {pages.map((page) => (
                <div 
                  key={page.id}
                  id={`tab-${page.id}`}
                  onClick={() => setActivePage(page.id)}
                  className={classNames(
                    "px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 cursor-pointer transition-all border select-none group flex-shrink-0 min-w-[90px] justify-between",
                    activePage === page.id 
                      ? "bg-white text-blue-600 shadow-sm border-gray-200" 
                      : "text-gray-500 border-transparent hover:bg-white/50"
                  )}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    <File size={12} className="flex-shrink-0"/> 
                    <span className="truncate max-w-[60px]">{page.name}</span>
                  </div>
                  
                  {pages.length > 1 && (
                    <button 
                      onClick={(e) => handleDeletePageClick(e, page.id)}
                      className={classNames(
                        "rounded p-0.5 transition-all flex-shrink-0",
                        activePage === page.id ? "hover:bg-red-100 hover:text-red-500 text-gray-300" : "opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500"
                      )}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button 
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-colors active:scale-95 flex-shrink-0"
              onMouseDown={() => startScrolling('right')}
              onMouseUp={stopScrolling}
              onMouseLeave={stopScrolling}
            >
              <ChevronRight size={16} />
            </button>

            <div className="w-[1px] h-4 bg-gray-300 mx-1 flex-shrink-0"></div>

            <button 
              onClick={handleAddPage}
              className="px-2 py-1.5 hover:bg-white/80 hover:text-blue-600 rounded text-gray-500 transition-colors flex-shrink-0"
            >
              <Plus size={16}/>
            </button>

            {pages.length > 7 && (
              <div className="relative flex-shrink-0">
                <button 
                  className={classNames("px-2 py-1.5 rounded text-gray-500 hover:bg-white/80 transition-colors", showPageMenu && "bg-white text-blue-600 shadow-sm")}
                  onClick={() => setShowPageMenu(!showPageMenu)}
                >
                  <ChevronDown size={16} />
                </button>

                {showPageMenu && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowPageMenu(false)} />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] py-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase sticky top-0 bg-white">
                        所有画布 ({pages.length})
                      </div>
                      {pages.map(page => (
                        <button
                          key={page.id}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                          onClick={() => {
                            setActivePage(page.id);
                            setShowPageMenu(false);
                          }}
                        >
                          <span className={classNames(activePage === page.id ? "text-blue-600 font-bold" : "text-gray-700")}>
                            {page.name}
                          </span>
                          {activePage === page.id && <Check size={14} className="text-blue-600"/>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center justify-end min-w-[150px]">
          <div className="text-xs text-gray-500 px-2 py-1 rounded select-none bg-gray-100/50 border border-gray-200/50 truncate max-w-[120px]">
            {username}
          </div>
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
            onClear={handleClearClick}
          />
        </div>

        <CanvasLayer 
          roomId={roomId}
          pageId={activePage}
          activeTool={activeTool}
          brushType={brushType}
          color={color}
          strokeWidth={currentStrokeWidth}
          initialState={initialState} 
        />
      </main>

      {/* 弹窗 A: 删除画布确认 */}
      {pendingDeletePageId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-1">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">确认删除画布？</h3>
              <div className="text-sm text-gray-500 flex flex-col gap-1">
                <span>此操作将永久删除该画布上的所有内容</span>
                <span className="font-bold text-red-500">且无法恢复</span>
              </div>
              
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-2 hover:text-gray-800 select-none">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={tempDeleteCheckbox}
                  onChange={(e) => setTempDeleteCheckbox(e.target.checked)}
                />
                在此房间内不再提示
              </label>

              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setPendingDeletePageId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗 B: 清空画布确认 (✨ 文字双行居中，红色字体) */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-1">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">清空当前画布？</h3>
              <div className="text-sm text-gray-500 flex flex-col gap-1">
                <span>该行为将清除当前画布上的所有内容</span>
                <span className="font-bold text-red-500">其他用户的绘制也会被清空</span>
              </div>
              
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-2 hover:text-gray-800 select-none">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  checked={tempClearCheckbox}
                  onChange={(e) => setTempClearCheckbox(e.target.checked)}
                />
                在此房间内不再提示
              </label>

              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmClear}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 shadow-lg shadow-orange-200 transition-colors"
                >
                  立即清空
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};