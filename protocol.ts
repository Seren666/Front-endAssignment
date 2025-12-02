/**
 * 🚨 shared/protocol.ts
 * CollaBoard v1.0 前后端共享协议定义文件
 *
 * 约定：
 * - 所有房间 / 用户 / 动作的结构在这里统一定义。
 * - 所有 Socket.io 事件名 & Payload 结构在这里统一定义。
 * - 前端 / 后端只能 import 使用，不允许在各自代码里“自创”结构。
 * - 如需修改协议，请全队讨论，并同时更新前后端代码。
 */

export const PROTOCOL_VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */
/* 基础类型                                                                   */
/* -------------------------------------------------------------------------- */

/** 房间 ID */
export type RoomId = string;
/** 用户 ID */
export type UserId = string;
/** 绘制动作 ID（一次笔画 / 矩形 / 圆形） */
export type ActionId = string;

/**
 * 归一化坐标：
 * - x, y ∈ [0, 1]
 * - 与 canvas 宽高无关，适用于不同分辨率 / 屏幕。
 */
export interface Point {
  x: number;
  y: number;
}

/* -------------------------------------------------------------------------- */
/* 绘制动作 DrawAction                                                        */
/* -------------------------------------------------------------------------- */

export type DrawActionType = 'freehand' | 'rect' | 'ellipse';

/**
 * 所有绘制动作的公共字段
 */
export interface DrawActionBase {
  /** 动作唯一 ID（由服务器生成或由客户端生成后服务器确认） */
  id: ActionId;
  /** 所属房间 ID */
  roomId: RoomId;
  /** 创建该动作的用户 ID */
  userId: UserId;
  /** 动作类型 */
  type: DrawActionType;
  /** 颜色，如 '#ff0000' */
  color: string;
  /** 线宽（逻辑像素，渲染时可乘以 dpr） */
  strokeWidth: number;
  /**
   * 是否已被软删除：
   * - false：正常展示
   * - true：被 Undo 标记为删除，在重绘时应跳过
   */
  isDeleted: boolean;
  /** 服务器生成的创建时间戳（ms since epoch） */
  createdAt: number;
}

/**
 * 自由绘制（铅笔工具）
 * - points 为整条笔迹的采样点（归一化坐标）
 */
export interface FreehandDrawAction extends DrawActionBase {
  type: 'freehand';
  points: Point[];
}

/**
 * 矩形绘制
 * - start / end 为拖动过程的对角点（归一化坐标）
 */
export interface RectDrawAction extends DrawActionBase {
  type: 'rect';
  start: Point;
  end: Point;
}

/**
 * 圆 / 椭圆绘制
 * - start / end 为包围椭圆的矩形的两个对角点
 */
export interface EllipseDrawAction extends DrawActionBase {
  type: 'ellipse';
  start: Point;
  end: Point;
}

/** 单次绘制动作的联合类型 */
export type DrawAction =
  | FreehandDrawAction
  | RectDrawAction
  | EllipseDrawAction;

/* -------------------------------------------------------------------------- */
/* 用户 & 光标                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 用户光标位置（归一化坐标）
 */
export interface CursorPosition {
  x: number;
  y: number;
  /** 最后一次更新的时间戳（ms） */
  updatedAt: number;
}

/**
 * 房间内的在线用户
 */
export interface User {
  /** 用户唯一 ID（与 socket 绑定） */
  id: UserId;
  /** 用户昵称 */
  name: string;
  /** 用户主题颜色（光标 / 默认画笔颜色） */
  color: string;
  /** 用户当前光标位置；为 null 则不显示光标 */
  cursor: CursorPosition | null;
}

/* -------------------------------------------------------------------------- */
/* 房间状态 RoomState                                                         */
/* -------------------------------------------------------------------------- */

/**
 * RoomState 同步原因：
 * - 'reconnect'：客户端断线重连后，做一次全量同步
 * - 'admin'：管理员（未来可能有）强制刷新
 * - 'full-sync'：其他需要完整同步的场景
 */
export type RoomStateSyncReason = 'reconnect' | 'admin' | 'full-sync';

/**
 * 房间内的完整状态：
 * - 内存存储，不做数据库持久化（本项目约束）
 */
export interface RoomState {
  /** 房间 ID */
  id: RoomId;
  /** 房间内所有用户，以 userId 为 key */
  users: Record<UserId, User>;
  /**
   * 房间内所有绘制动作，以 actionId 为 key
   * - 软删除通过修改 DrawAction.isDeleted 实现
   */
  actions: Record<ActionId, DrawAction>;
  /**
   * 动作顺序（服务器插入顺序）
   * - 渲染时按该顺序遍历 actionId，再从 actions 中取出绘制
   */
  actionOrder: ActionId[];
  /** 房间创建时间 */
  createdAt: number;
  /**
   * 每个用户的撤销栈（用于重做）
   * - key: userId
   * - value: 被撤销的 actionId 列表（栈顶在数组末尾）
   */
  userUndoStacks: Record<UserId, ActionId[]>;
}

/* -------------------------------------------------------------------------- */
/* 错误类型                                                                   */
/* -------------------------------------------------------------------------- */

export interface ErrorPayload {
  code: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Socket.io 事件类型                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Client → Server 事件
 *
 * 注意：
 * - 前端 emit 时，请严格使用这些事件名和 payload 结构。
 */
export interface ClientToServerEvents {
  /**
   * 加入房间
   * - 服务器收到后，应将该 socket 加入对应 room，并返回 room:joined 或 room:join:error
   */
  'room:join': (payload: { roomId: RoomId; userName: string }) => void;

  /**
   * 主动离开房间（可选）
   * - 一般由断开连接触发，但也可以专门调用
   */
  'room:leave': (payload: { roomId: RoomId }) => void;

  /**
   * 提交一次完整绘制动作
   * - 建议在 pointerup 之后发送
   */
  'draw:commit': (payload: { roomId: RoomId; action: DrawAction }) => void;

  /**
   * 撤销当前用户在该房间的最近一次未删除动作
   * - 服务端负责根据 userId + roomId 查找
   */
  'action:undo': (payload: { roomId: RoomId }) => void;

  /**
   * 重做当前用户最近一次撤销的动作
   */
  'action:redo': (payload: { roomId: RoomId }) => void;

  /**
   * 更新当前用户的光标位置
   * - position 为归一化坐标
   * - 前端应对该事件做节流（例如 50ms 一次）
   */
  'cursor:update': (payload: { roomId: RoomId; position: Point }) => void;

  /**
   * 用户修改昵称（可选功能）
   */
  'user:rename': (payload: { roomId: RoomId; name: string }) => void;
}

/**
 * Server → Client 事件
 *
 * 注意：
 * - 后端广播时，请使用这些事件名。
 * - 前端监听时，可以用它们做类型约束。
 */
export interface ServerToClientEvents {
  /**
   * 成功加入房间
   * - self：服务器分配/确认的当前用户信息
   * - state：当前房间的完整状态（actions + users）
   */
  'room:joined': (payload: {
    roomId: RoomId;
    self: User;
    state: RoomState;
  }) => void;

  /**
   * 加入房间失败
   * - 例如房间不存在 / 房间人数达到上限等
   */
  'room:join:error': (payload: {
    roomId: RoomId;
    code: string;
    message: string;
  }) => void;

  /**
   * 有新用户加入房间
   */
  'room:user-joined': (payload: { roomId: RoomId; user: User }) => void;

  /**
   * 有用户离开房间
   * - userId：离开的用户
   */
  'room:user-left': (payload: { roomId: RoomId; userId: UserId }) => void;

  /**
   * 房间内新增了一条绘制动作
   * - 由服务器在处理 draw:commit 后广播
   */
  'draw:created': (payload: { roomId: RoomId; action: DrawAction }) => void;

  /**
   * 某个动作的软删除状态发生变化（Undo/Redo）
   * - isDeleted: true = 被撤销；false = 被恢复
   */
  'action:updatedDeleted': (payload: {
    roomId: RoomId;
    actionId: ActionId;
    isDeleted: boolean;
  }) => void;

  /**
   * 某个用户的光标位置更新
   * - 通常由服务器在处理 cursor:update 后广播
   */
  'cursor:updated': (payload: {
    roomId: RoomId;
    userId: UserId;
    position: Point;
  }) => void;

  /**
   * 服务器向客户端发送一次完整房间状态同步
   * - 场景：重连、检测到状态不一致、管理员刷新等
   */
  'room:state-sync': (payload: {
    roomId: RoomId;
    state: RoomState;
    reason: RoomStateSyncReason;
  }) => void;

  /**
   * 通用错误事件
   * - 可用于非房间特定的错误（例如服务器内部错误）
   */
  error: (payload: ErrorPayload) => void;
}

/* -------------------------------------------------------------------------- */
/* （可选）辅助类型别名                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 如果你在前端使用 socket.io-client，可以这样写：
 *
 * import { io, Socket } from 'socket.io-client';
 * import type { ServerToClientEvents, ClientToServerEvents } from '../shared/protocol';
 *
 * export type CollaBoardClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
 */

/**
 * 如果你在后端使用 socket.io（Node），可以这样写：
 *
 * import { Server, Socket } from 'socket.io';
 * import type { ServerToClientEvents, ClientToServerEvents } from '../shared/protocol';
 *
 * export type CollaBoardServer = Server<ClientToServerEvents, ServerToClientEvents>;
 * export type CollaBoardServerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
 */

