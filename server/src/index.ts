// server/src/index.ts

import express from 'express';
import http from 'http'; 
import { Server } from 'socket.io'; 

const app = express();
const port = 3000; 

// 1. 将 Express 应用传入 Node.js 内置的 HTTP 服务器
const server = http.createServer(app);

// 2. 将 Socket.io 附加到 HTTP 服务器
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- Express HTTP 路由 ---
app.get('/', (req, res) => {
    res.send('CollaBoard Backend Server is Operational.');
});

// --- Socket.io 连接处理 ---
io.on('connection', (socket) => {
    console.log(`[Socket.io]: Client connected: ${socket.id}`);

    // ... (这里是你的 room:join 和 cursor:update 逻辑) ...

    socket.on('disconnect', () => {
        console.log(`[Socket.io]: Client disconnected: ${socket.id}`);
    });
});


// 3. 启动 HTTP 服务器 (监听端口)
server.listen(port, () => { // 这一行会启动一个持久运行的进程
    console.log(`[Server]: Server running on http://localhost:${port}`);
    console.log(`[Socket.io]: Listening for WebSocket connections on port ${port}`);
});