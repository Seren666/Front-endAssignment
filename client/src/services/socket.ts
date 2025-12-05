import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  DrawAction, 
  Point
} from '../shared/protocol';

const SERVER_URL = 'http://localhost:3000'; 

class NetworkMgr {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  
  private static instance: NetworkMgr;

  private constructor() {
    this.socket = io(SERVER_URL, {
      transports: ['websocket'], 
      // 🔴 1. 彻底关闭自动连接
      autoConnect: false, 
      // 🔴 2. 彻底关闭自动重连 (这就是你要的效果：后端挂了，前端就不试了)
      reconnection: false,      
    });

    this.setupDebugListeners();
  }

  public static getInstance(): NetworkMgr {
    if (!NetworkMgr.instance) {
      NetworkMgr.instance = new NetworkMgr();
    }
    return NetworkMgr.instance;
  }

  // ✨ 手动连接
  public connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  // ✨ 手动断开
  public disconnect() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  private setupDebugListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      // 如果是因为断网或服务器挂了，这里会收到通知
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // 可以在这里弹个窗提示用户 "服务器已断开，请刷新页面"
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ Connection error:', err.message);
    });
  }

  /* --- API 封装 --- */

  public joinRoom(roomId: string, userName: string, password?: string, action: 'create' | 'join' = 'join') {
    this.connect(); 
    this.socket.emit('room:join', { roomId, userName, password, action });
  }

  // ✨✨✨ 新增：离开房间 ✨✨✨
  public leaveRoom(roomId: string) {
    this.socket.emit('room:leave', { roomId });
  }

  public sendDrawAction(roomId: string, action: DrawAction) {
    this.socket.emit('draw:commit', { roomId, action });
  }

  public sendCursor(roomId: string, position: Point, pageId: string) {
    this.socket.emit('cursor:update', { roomId, position, pageId });
  }
}

export const network = NetworkMgr.getInstance();