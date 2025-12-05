import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  RoomState, 
  DrawAction, 
  User, 
  RoomId 
} from './shared/protocol'; 
import { nanoid } from 'nanoid'; 

const generatePageId = () => 'page-' + Math.random().toString(36).substr(2, 9);

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const rooms = new Map<RoomId, RoomState>();

io.on('connection', (socket) => {
  console.log('🔌 新客户端连接:', socket.id);

  // 1. 加入/创建房间
  socket.on('room:join', ({ roomId, userName, password, action }) => {
    let room = rooms.get(roomId);

    if (action === 'create') {
      if (room) {
        socket.emit('room:join:error', { roomId, code: '409', message: '房间号已被占用' });
        return;
      }
      console.log(`✨ 创建新房间: ${roomId}`);
      const newRoom: RoomState = {
        id: roomId,
        password: password,
        users: {},
        actions: {},
        actionOrder: [],
        // ✨ 初始化：默认有一页
        pages: [{ id: 'page-1', name: '画布 1' }],
        createdAt: Date.now(),
        userUndoStacks: {}
      };
      rooms.set(roomId, newRoom);
      room = newRoom;
    } else {
      if (!room) {
        socket.emit('room:join:error', { roomId, code: '404', message: '房间不存在' });
        return;
      }
      if (room.password && room.password !== password) {
        socket.emit('room:join:error', { roomId, code: '401', message: '密码错误' });
        return;
      }
    }

    if (!room) return;
    socket.join(roomId);

    const newUser: User = {
      id: socket.id,
      name: userName,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      cursor: null
    };

    room.users[socket.id] = newUser;
    if (!room.userUndoStacks[socket.id]) room.userUndoStacks[socket.id] = [];

    // 发送包括 pages 在内的完整状态
    socket.emit('room:joined', { roomId, self: newUser, state: room });
    socket.to(roomId).emit('room:user-joined', { roomId, user: newUser });
    console.log(`✅ ${userName} 进入 ${roomId}`);
  });

  // 2. 提交绘制
  socket.on('draw:commit', ({ roomId, action }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const serverAction = { ...action, userId: socket.id, createdAt: Date.now() };
    room.actions[serverAction.id] = serverAction;
    room.actionOrder.push(serverAction.id);
    socket.to(roomId).emit('draw:created', { roomId, action: serverAction });
  });

  // 3. 撤销
  socket.on('action:undo', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    for (let i = room.actionOrder.length - 1; i >= 0; i--) {
      const actionId = room.actionOrder[i];
      const action = room.actions[actionId];
      if (action.userId === userId && !action.isDeleted) {
        action.isDeleted = true;
        room.userUndoStacks[userId].push(actionId);
        io.to(roomId).emit('action:updatedDeleted', { roomId, actionId, isDeleted: true });
        break;
      }
    }
  });

  // 4. 清屏
  socket.on('board:clear', ({ roomId, pageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    Object.values(room.actions).forEach(action => {
      if (action.pageId === pageId) action.isDeleted = true;
    });
    io.to(roomId).emit('board:cleared', { roomId, pageId });
  });

  // 5. 光标同步
  socket.on('cursor:update', ({ roomId, position, pageId }) => {
    socket.to(roomId).emit('cursor:updated', { roomId, userId: socket.id, position, pageId });
  });

  // 6. 离开
  socket.on('room:leave', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.users[socket.id]) {
      delete room.users[socket.id];
      socket.leave(roomId);
      socket.to(roomId).emit('room:user-left', { roomId, userId: socket.id });
    }
  });

  // 7. 断开连接
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.users[socket.id]) {
        delete room.users[socket.id];
        socket.to(roomId).emit('room:user-left', { roomId, userId: socket.id });
      }
    });
  });

  // ✨✨✨ 8. 页面管理 ✨✨✨
  
  // 创建新页面
  socket.on('page:create', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const newPageId = generatePageId();
    const newPageNumber = room.pages.length + 1;
    
    room.pages.push({
      id: newPageId,
      name: `画布 ${newPageNumber}`
    });

    console.log(`📄 房间 ${roomId} 新增页面: ${newPageId}`);
    // 广播给所有人更新页面列表
    io.to(roomId).emit('page:updated', { roomId, pages: room.pages });
  });

  // 删除页面
  socket.on('page:delete', ({ roomId, pageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // 至少保留一页
    if (room.pages.length <= 1) return;

    // 1. 从列表中移除
    room.pages = room.pages.filter(p => p.id !== pageId);

    // 2. 清理该页面的所有画作 (软删除)
    Object.values(room.actions).forEach(action => {
      if (action.pageId === pageId) {
        action.isDeleted = true;
      }
    });

    console.log(`🗑️ 房间 ${roomId} 删除页面: ${pageId}`);
    // 广播更新
    io.to(roomId).emit('page:updated', { roomId, pages: room.pages });
  });

});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 后端服务已启动 (Port ${PORT})`);
});