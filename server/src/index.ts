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

const app = express();
app.use(cors());

const server = http.createServer(app);

// 初始化 Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*", // 开发环境允许跨域
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

    // --- 分支 A: 创建房间 (Create) ---
    if (action === 'create') {
      // 1. 检查房间是否已存在
      if (room) {
        console.log(`⚠️ 创建失败: ${roomId} 已存在`);
        socket.emit('room:join:error', { roomId, code: '409', message: '房间号已被占用，请更换' });
        return;
      }

      // 2. 创建新房间
      console.log(`✨ 创建新房间: ${roomId} (密码: ${password || '无'})`);
      const newRoom: RoomState = {
        id: roomId,
        password: password,
        users: {},
        actions: {},
        actionOrder: [],
        createdAt: Date.now(),
        userUndoStacks: {}
      };
      rooms.set(roomId, newRoom);
      room = newRoom;
    } 
    
    // --- 分支 B: 加入房间 (Join) ---
    else {
      // 1. 检查房间是否存在
      if (!room) {
        console.log(`⚠️ 加入失败: ${roomId} 不存在`);
        socket.emit('room:join:error', { roomId, code: '404', message: '房间不存在，请先创建' });
        return;
      }

      // 2. 验证密码
      if (room.password && room.password !== password) {
        console.log(`🔒 ${userName} 加入 ${roomId} 失败: 密码错误`);
        socket.emit('room:join:error', { roomId, code: '401', message: '房间密码错误' });
        return;
      }
    }

    // --- 下面是通用的“加入成功”逻辑 ---
    
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

    // 发送成功事件 + 历史记录
    socket.emit('room:joined', {
      roomId,
      self: newUser,
      state: room
    });

    // 广播给房间其他人
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

  // 4. 清屏
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

  // 5. 光标同步
  socket.on('cursor:update', ({ roomId, position, pageId }) => {
    socket.to(roomId).emit('cursor:updated', { 
      roomId, 
      userId: socket.id, 
      position, 
      pageId 
    });
  });

  // 6. ✨✨✨ 新增：主动离开房间 ✨✨✨
  socket.on('room:leave', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.users[socket.id]) {
      const name = room.users[socket.id].name;
      
      // 1. 从数据中移除
      delete room.users[socket.id];
      
      // 2. 从 Socket 分组中移除
      socket.leave(roomId);
      
      // 3. 通知房间其他人
      socket.to(roomId).emit('room:user-left', { roomId, userId: socket.id });
      
      console.log(`🚪 ${name} 主动离开了房间 ${roomId}`);
    }
  });

  // 7. 断开连接 (意外断网或关闭浏览器)
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