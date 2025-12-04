/**
 * 🚨 shared/protocol.ts
 * CollaBoard v1.3 最终版协议
 * * 更新日志：
 * - v1.0: 基础绘图 (Freehand, Rect, Ellipse)
 * - v1.1: 增加 Arrow, Star, Triangle, BrushType, PageId
 * - v1.2: 增加 Diamond, Pentagon, Hexagon
 * - v1.3: 增加 橡皮擦 (Eraser) & 房间密码 (Password)
 */

export const PROTOCOL_VERSION = '1.2.0';

/* -------------------------------------------------------------------------- */
/* 基础类型                                                                   */
/* -------------------------------------------------------------------------- */

export type RoomId = string;
export type UserId = string;
export type ActionId = string;
export type PageId = string; // 多画布页码 ID (默认 'page-1')

export interface Point {
  x: number;
  y: number;
}

/* -------------------------------------------------------------------------- */
/* 绘制动作 DrawAction                                                        */
/* -------------------------------------------------------------------------- */

// 1. 动作类型枚举
export type DrawActionType = 
  | 'freehand' // 自由画笔
  | 'rect'     // 矩形
  | 'ellipse'  // 圆/椭圆
  | 'arrow'    // 连接线(箭头)
  | 'triangle' // 三角形
  | 'star'     // 五角星
  | 'diamond'  // 菱形
  | 'pentagon' // 五边形
  | 'hexagon'; // 六边形

// 2. 笔刷类型枚举
export type BrushType = 
  | 'pencil'     // 铅笔 (实心)
  | 'marker'     // 马克笔/水彩 (半透明)
  | 'laser'    // 激光笔 (稍后消失)
  | 'eraser';    // 橡皮擦

/** 所有绘制动作的公共字段 */
export interface DrawActionBase {
  id: ActionId;
  roomId: RoomId;
  pageId: PageId; // 必须字段：属于哪一页
  userId: UserId;
  type: DrawActionType;
  color: string;
  strokeWidth: number;
  isDeleted: boolean;
  createdAt: number;
}

/** 自由绘制 (含笔刷样式) */
export interface FreehandDrawAction extends DrawActionBase {
  type: 'freehand';
  points: Point[];
  brushType: BrushType; // 区分铅笔/水彩/激光
}

/** 形状绘制 (双点定义：起点、终点) */
export interface ShapeDrawAction extends DrawActionBase {
  type: 'rect' | 'ellipse' | 'triangle' | 'star' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon';
  start: Point;
  end: Point;
}

/** 联合类型 */
export type DrawAction =
  | FreehandDrawAction
  | ShapeDrawAction;

/* -------------------------------------------------------------------------- */
/* 用户 & 房间                                                                */
/* -------------------------------------------------------------------------- */

export interface CursorPosition {
  x: number;
  y: number;
  pageId: PageId; // 光标所在页码
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
  users: Record<UserId, User>;
  actions: Record<ActionId, DrawAction>;
  actionOrder: ActionId[];
  createdAt: number;
  userUndoStacks: Record<UserId, ActionId[]>;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Socket.io 事件                                                             */
/* -------------------------------------------------------------------------- */

export interface ClientToServerEvents {
  // 基础
  'room:join': (payload: { roomId: RoomId; userName: string }) => void;
  'room:leave': (payload: { roomId: RoomId }) => void;
  
  // 绘图
  'draw:commit': (payload: { roomId: RoomId; action: DrawAction }) => void;
  
  // 状态操作
  'action:undo': (payload: { roomId: RoomId; userId: UserId }) => void;
  'board:clear': (payload: { roomId: RoomId; pageId: PageId }) => void;
  
  // 光标
  'cursor:update': (payload: { roomId: RoomId; position: Point; pageId: PageId }) => void;
}

export interface ServerToClientEvents {
  // 房间状态
  'room:joined': (payload: { roomId: RoomId; self: User; state: RoomState }) => void;
  'room:join:error': (payload: { roomId: RoomId; code: string; message: string }) => void;
  'room:user-joined': (payload: { roomId: RoomId; user: User }) => void;
  'room:user-left': (payload: { roomId: RoomId; userId: UserId }) => void;
  'room:state-sync': (payload: { roomId: RoomId; state: RoomState; reason: RoomStateSyncReason }) => void;
  
  // 绘图广播
  'draw:created': (payload: { roomId: RoomId; action: DrawAction }) => void;
  'action:updatedDeleted': (payload: { roomId: RoomId; actionId: ActionId; isDeleted: boolean }) => void;
  'board:cleared': (payload: { roomId: RoomId; pageId: PageId }) => void;
  
  // 光标广播
  'cursor:updated': (payload: { roomId: RoomId; userId: UserId; position: Point; pageId: PageId }) => void;
  
  // 错误
  error: (payload: ErrorPayload) => void;
}