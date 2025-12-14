import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  DrawAction, 
  Point
} from '../shared/protocol';

// ✨ 核心修改：动态计算 Socket 地址
// 1. 如果你在浏览器访问 localhost:5173 -> 它就连 localhost:3000
// 2. 如果你在浏览器访问 10.136.x.x:5173 -> 它就连 10.136.x.x:3000
const getSocketUrl = () => {
  const { hostname } = window.location;
  // 这里假设后端端口永远是 3000
  return `http://${hostname}:3000`;
};

class NetworkMgr {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  
  private static instance: NetworkMgr;

  private constructor() {
    // ✨ 在初始化时直接使用动态 URL，这已经足够了
    // 因为页面不刷新，hostname 是不会变的
    this.socket = io(getSocketUrl(), {
      transports: ['websocket'], 
      // 🔴 1. 彻底关闭自动连接
      autoConnect: false, 
      // 🔴 2. 彻底关闭自动重连 
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
      // ⚠️ 删除了之前报错的这一行：this.socket.io.uri = ...
      // 不需要重新设置，初始化时已经定好了
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
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // 可以在这里处理断连逻辑
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