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

// 简单的 ID 生成器 (用于 PageID)
const generatePageId = () => 'page-' + Math.random().toString(36).substr(2, 9);

const app = express();
app.use(cors());

const server = http.createServer(app);

// 初始化 Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*", // 允许跨域
    methods: ["GET", "POST"]
  }
});

// --- 内存数据库 ---
const rooms = new Map<RoomId, RoomState>();

io.on('connection', (socket) => {
  console.log('🔌 新客户端连接:', socket.id);

  // 1. 加入/创建房间
  socket.on('room:join', ({ roomId, userName, password, action }) => {
    let room = rooms.get(roomId);

    // --- 分支 A: 创建房间 ---
    if (action === 'create') {
      if (room) {
        socket.emit('room:join:error', { roomId, code: '409', message: '房间号已被占用，请更换' });
        return;
      }

      console.log(`✨ 创建新房间: ${roomId} (密码: ${password || '无'})`);
      const newRoom: RoomState = {
        id: roomId,
        password: password,
        users: {},
        actions: {},
        actionOrder: [],
        // 默认第一页
        pages: [{ id: 'page-1', name: '画布 1' }],
        createdAt: Date.now(),
        userUndoStacks: {}
      };
      rooms.set(roomId, newRoom);
      room = newRoom;
    } 
    
    // --- 分支 B: 加入房间 ---
    else {
      if (!room) {
        socket.emit('room:join:error', { roomId, code: '404', message: '房间不存在，请先创建' });
        return;
      }

      if (room.password && room.password !== password) {
        console.log(`🔒 ${userName} 加入 ${roomId} 失败: 密码错误`);
        socket.emit('room:join:error', { roomId, code: '401', message: '房间密码错误' });
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
    if (!room.userUndoStacks[socket.id]) {
      room.userUndoStacks[socket.id] = [];
    }

    // 发送完整状态 (包含 actions 和 pages)
    socket.emit('room:joined', {
      roomId,
      self: newUser,
      state: room
    });

    socket.to(roomId).emit('room:user-joined', {
      roomId,
      user: newUser
    });

    console.log(`✅ ${userName} (${action === 'create' ? '创建' : '加入'}) 了 ${roomId}`);
  });

  // 2. 提交绘制
  socket.on('draw:commit', ({ roomId, action }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const serverAction: DrawAction = {
      ...action,
      userId: socket.id,
      createdAt: Date.now()
    };

    room.actions[serverAction.id] = serverAction;
    room.actionOrder.push(serverAction.id);

    socket.to(roomId).emit('draw:created', { roomId, action: serverAction });
  });

  // ✨✨✨ 3. 处理移动  ✨✨✨
  socket.on('draw:moved', ({ roomId, actionIds, dx, dy }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // 批量更新内存中的坐标
    actionIds.forEach(id => {
      const action = room.actions[id];
      if (action && !action.isDeleted) {
        // 根据类型更新坐标
        if (action.type === 'freehand') {
          action.points.forEach(p => {
            p.x += dx;
            p.y += dy;
          });
        } else {
          // 形状 (利用 ts-ignore 忽略类型检查，因为形状一定有 start/end)
          // @ts-ignore
          action.start.x += dx;
          // @ts-ignore
          action.start.y += dy;
          // @ts-ignore
          action.end.x += dx;
          // @ts-ignore
          action.end.y += dy;
        }
      }
    });

    // 广播给其他人，让他们也看到移动效果
    socket.to(roomId).emit('draw:moved', { roomId, actionIds, dx, dy });
  });

  // 4. 撤销
  socket.on('action:undo', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    for (let i = room.actionOrder.length - 1; i >= 0; i--) {
      const actionId = room.actionOrder[i];
      const action = room.actions[actionId];

      if (action.userId === userId && !action.isDeleted) {
        action.isDeleted = true;
        room.userUndoStacks[userId].push(actionId);

        io.to(roomId).emit('action:updatedDeleted', {
          roomId,
          actionId,
          isDeleted: true
        });
        console.log(`↩️ ${userId} 撤销了动作 ${actionId}`);
        break;
      }
    }
  });

  // 5. 清屏
  socket.on('board:clear', ({ roomId, pageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    console.log(`🗑️ 清空房间 ${roomId} 的页面 ${pageId}`);

    Object.values(room.actions).forEach(action => {
      if (action.pageId === pageId) {
        action.isDeleted = true;
      }
    });

    io.to(roomId).emit('board:cleared', { roomId, pageId });
  });

  // 6. 光标同步
  socket.on('cursor:update', ({ roomId, position, pageId }) => {
    socket.to(roomId).emit('cursor:updated', { 
      roomId, 
      userId: socket.id, 
      position, 
      pageId 
    });
  });

  // 7. 主动离开
  socket.on('room:leave', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.users[socket.id]) {
      const name = room.users[socket.id].name;
      delete room.users[socket.id];
      socket.leave(roomId);
      socket.to(roomId).emit('room:user-left', { roomId, userId: socket.id });
      console.log(`🚪 ${name} 主动离开了房间 ${roomId}`);
    }
  });

  // 8. 断开连接
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.users[socket.id]) {
        const name = room.users[socket.id].name;
        delete room.users[socket.id];
        socket.to(roomId).emit('room:user-left', { roomId, userId: socket.id });
        console.log(`❌ ${name} 断开连接 (离开 ${roomId})`);
      }
    });
  });

  // 9. 页面管理: 创建
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
    io.to(roomId).emit('page:updated', { roomId, pages: room.pages });
  });

  // 10. 页面管理: 删除
  socket.on('page:delete', ({ roomId, pageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.pages.length <= 1) return;

    room.pages = room.pages.filter(p => p.id !== pageId);

    // 清理该页面的画作
    Object.values(room.actions).forEach(action => {
      if (action.pageId === pageId) {
        action.isDeleted = true;
      }
    });

    console.log(`🗑️ 房间 ${roomId} 删除页面: ${pageId}`);
    io.to(roomId).emit('page:updated', { roomId, pages: room.pages });
  });

});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`
  🚀 后端服务已启动!
  ---------------------------
  Local: http://localhost:${PORT}
  ---------------------------
  `);
});