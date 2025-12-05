import { io, Socket } from 'socket.io-client';
import type{ 
  ServerToClientEvents, 
  ClientToServerEvents,
  DrawAction,
  Point
} from '../shared/protocol';

// 指定后端地址 (通常开发环境是 3000 或 3001，取决于后端设置)
// 如果你的后端跑在 3000 端口，请确保这里一致
const SERVER_URL = 'http://localhost:3000'; 

class NetworkMgr {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  
  // 简单的单例模式
  private static instance: NetworkMgr;

  private constructor() {
    this.socket = io(SERVER_URL, {
      transports: ['websocket'], // 强制使用 WebSocket，性能更好
      autoConnect: true,
    });

    this.setupDebugListeners();
  }

  public static getInstance(): NetworkMgr {
    if (!NetworkMgr.instance) {
      NetworkMgr.instance = new NetworkMgr();
    }
    return NetworkMgr.instance;
  }

  // 调试日志
  private setupDebugListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ Connection error:', err.message);
    });
  }

  /* -------------------------------------------------------------------------- */
  /* API 封装 (供前端组件调用)                                                  */
  /* -------------------------------------------------------------------------- */

  /** 加入房间 */
  public joinRoom(roomId: string, userName: string) {
    this.socket.emit('room:join', { roomId, userName });
  }

  /** 发送绘制动作 */
  public sendDrawAction(roomId: string, action: DrawAction) {
    this.socket.emit('draw:commit', { roomId, action });
  }

  /** 更新光标位置 (会节流，但这由调用者控制，这里只负责发) */
  public sendCursor(roomId: string, position: Point, pageId: string) {
      this.socket.emit('cursor:update', { roomId, position, pageId });
    }
}

export const network = NetworkMgr.getInstance();