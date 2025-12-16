//typescript协议文件，整个白板前后端通信的数据类型和事件定义。
// 定义了白板里所有数据结构和 socket.io 事件的类型规范，保证前后端通信一致且类型安全。
export const PROTOCOL_VERSION = '1.5.0';

/* --- 基础类型 --- */
export type RoomId = string;
export type UserId = string;
export type ActionId = string;
export type PageId = string; 

export interface Point {
  x: number;
  y: number;
}

export interface Page {
  id: PageId;
  name: string;
}

/* --- 绘制动作 --- */
// ✨ 新增 'select' 工具
export type DrawActionType = 
  | 'select' 
  | 'freehand' | 'rect' | 'ellipse' | 'arrow' | 'triangle' | 'star' 
  | 'diamond' | 'pentagon' | 'hexagon';

export type BrushType = 'pencil' | 'marker' | 'laser' | 'eraser';

export interface DrawActionBase {
  id: ActionId;
  roomId: RoomId;
  pageId: PageId;
  userId: UserId;
  type: DrawActionType;
  color: string;
  strokeWidth: number;
  isDeleted: boolean;
  createdAt: number;
}

export interface FreehandDrawAction extends DrawActionBase {
  type: 'freehand';
  points: Point[];
  brushType: BrushType; 
}

export interface ShapeDrawAction extends DrawActionBase {
  type: 'rect' | 'ellipse' | 'triangle' | 'star' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon';
  start: Point;
  end: Point;
}

export type DrawAction = FreehandDrawAction | ShapeDrawAction;

/* --- 用户与房间 --- */
export interface CursorPosition {
  x: number;
  y: number;
  pageId: PageId;
  updatedAt: number;
}

export interface User {
  id: UserId;
  name: string;
  color: string;
  cursor: CursorPosition | null;
}

export type RoomStateSyncReason = 'reconnect' | 'admin' | 'full-sync';

export interface RoomState {
  id: RoomId;
  password?: string; 
  users: Record<UserId, User>;
  actions: Record<ActionId, DrawAction>;
  actionOrder: ActionId[];
  pages: Page[]; 
  createdAt: number;
  userUndoStacks: Record<UserId, ActionId[]>;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

/* --- Socket.io 事件 --- */
export interface ClientToServerEvents {
  'room:join': (payload: { roomId: RoomId; userName: string; password?: string; action: 'create' | 'join'; persistentId?: string }) => void;
  'room:leave': (payload: { roomId: RoomId }) => void;
  'draw:commit': (payload: { roomId: RoomId; action: DrawAction }) => void;
  
  // ✨ 新增：移动图形事件
  'draw:moved': (payload: { roomId: RoomId; actionIds: ActionId[]; dx: number; dy: number }) => void;

  'action:undo': (payload: { roomId: RoomId; userId: UserId }) => void;
  'board:clear': (payload: { roomId: RoomId; pageId: PageId }) => void;
  'cursor:update': (payload: { roomId: RoomId; position: Point; pageId: PageId }) => void;
  'page:create': (payload: { roomId: RoomId }) => void;
  'page:delete': (payload: { roomId: RoomId; pageId: PageId }) => void;
}

export interface ServerToClientEvents {
  'room:joined': (payload: { roomId: RoomId; self: User; state: RoomState }) => void;
  'room:join:error': (payload: { roomId: RoomId; code: string; message: string }) => void;
  'room:user-joined': (payload: { roomId: RoomId; user: User }) => void;
  'room:user-left': (payload: { roomId: RoomId; userId: UserId }) => void;
  'room:state-sync': (payload: { roomId: RoomId; state: RoomState; reason: RoomStateSyncReason }) => void;
  'draw:created': (payload: { roomId: RoomId; action: DrawAction }) => void;
  
  // ✨ 新增：接收移动广播
  'draw:moved': (payload: { roomId: RoomId; actionIds: ActionId[]; dx: number; dy: number }) => void;

  'action:updatedDeleted': (payload: { roomId: RoomId; actionId: ActionId; isDeleted: boolean }) => void;
  'board:cleared': (payload: { roomId: RoomId; pageId: PageId }) => void;
  'cursor:updated': (payload: { roomId: RoomId; userId: UserId; position: Point; pageId: PageId }) => void;
  'page:updated': (payload: { roomId: RoomId; pages: Page[] }) => void;
  error: (payload: ErrorPayload) => void;
}