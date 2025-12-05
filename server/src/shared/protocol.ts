/**
 * 🚨 shared/protocol.ts
 * CollaBoard v1.4 最终版协议
 * * 变更日志:
 * - ... (v1.0 - v1.3)
 * - v1.4: 增加 Page 结构与多页管理事件
 */

export const PROTOCOL_VERSION = '1.4.0';

/* --- 基础类型 --- */
export type RoomId = string;
export type UserId = string;
export type ActionId = string;
export type PageId = string; 

export interface Point {
  x: number;
  y: number;
}

// ✨ 新增：页面结构
export interface Page {
  id: PageId;
  name: string; // 例如 "画布 1"
}

/* --- 绘制动作 --- */
export type DrawActionType = 
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
  
  // ✨ 新增：房间里的页面列表
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
  'room:join': (payload: { roomId: RoomId; userName: string; password?: string; action: 'create' | 'join' }) => void;
  'room:leave': (payload: { roomId: RoomId }) => void;
  'draw:commit': (payload: { roomId: RoomId; action: DrawAction }) => void;
  'action:undo': (payload: { roomId: RoomId; userId: UserId }) => void;
  'board:clear': (payload: { roomId: RoomId; pageId: PageId }) => void;
  'cursor:update': (payload: { roomId: RoomId; position: Point; pageId: PageId }) => void;
  
  // ✨ 新增：页面管理事件
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
  'action:updatedDeleted': (payload: { roomId: RoomId; actionId: ActionId; isDeleted: boolean }) => void;
  'board:cleared': (payload: { roomId: RoomId; pageId: PageId }) => void;
  'cursor:updated': (payload: { roomId: RoomId; userId: UserId; position: Point; pageId: PageId }) => void;
  
  // ✨ 新增：页面列表更新广播
  'page:updated': (payload: { roomId: RoomId; pages: Page[] }) => void;
  
  error: (payload: ErrorPayload) => void;
}