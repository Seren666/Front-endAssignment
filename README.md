# CollaBoard — 多人实时协作白板

> 一个多人实时协作白板应用，支持自由绘制、图形绘制、撤销/重做、多人光标和导出图片等功能。

CollaBoard 采用 React + Vite 作为前端框架，Node.js + Express + Socket.io 作为后端服务，通过 WebSocket 实现多人协作。每个用户的绘图操作被封装为 `DrawAction` 并广播至房间中的所有客户端，保证不同客户端的状态一致。

---

## 📌 功能特性

### 🖌️ 主要功能

- 🖍 自由绘制：支持多种画笔（铅笔、马克笔、激光笔、橡皮擦）  
- 🔷 图形绘制：矩形、圆形、三角形、多边形、箭头等几何图形  
- 🔄 撤销 / 重做：基于软删除和 per-user undo 栈  
- 👥 实时协作：多人同时在线绘制与光标位置同步  
- 🎯 光标同步：实时显示其他用户的光标位置  
- 📸 导出 PNG：将主画布内容导出为图片  
- ⚙️ 自动高清画布渲染：支持高 DPI 设备优化 canvas 显示

---

## 🧠 核心原理简述

### 🧩 实时协作架构

整个系统采用 **Client–Server + WebSocket** 模式：
浏览器 Client ⟷ Socket.io ⟷ Node 服务端
React + Canvas Express + Socket.io


前端负责获取用户输入，在本地渲染预览并构造绘制动作（DrawAction），在 `pointerup` 时发送给后端。后端做房间状态维护，并广播给房间内所有客户端。客户端根据收到的动作更新本地的 action 列表并重新渲染画布，从而保证每个人看到的内容一致。

---

## 🚀 快速开始

### 🛠️ 安装依赖

在根目录直接运行：

'''bash
npm run install:all

或者分别安装
cd client
npm install
cd ../server
npm install
'''
###👩‍💻 启动开发环境

前端（Client）
'''
cd client
npm run dev
'''

默认前端 dev server 会在 http://localhost:5173
 打开。

后端（Server）
'''
cd server
npm run dev
'''

默认后端socket服务跑在 http://localhost:3000。

🧪 两端一起跑（推荐）

安装 concurrently：
'''
npm install -D concurrently
''

根目录的 package.json 中添加：
'''
"scripts": {
  "dev:client": "cd client && npm run dev",
  "dev:server": "cd server && npm run dev",
  "start": "concurrently \"npm:dev:server\" \"npm:dev:client\""
}

'''
然后：
'''
npm run start
'''

🗂️ 协议与事件定义（Socket）
📨 客户端 → 服务端
事件名	Payload	说明
room:join	{ roomId, userName }	加入房间
draw:commit	{ roomId, action }	提交绘制动作
action:undo	{ roomId, userId }	当前用户撤销上一步
action:redo	{ roomId, userId }	当前用户重做
cursor:update	{ roomId, position, pageId }	光标更新
board:clear	{ roomId, pageId }	清空指定页
📤 服务端 → 客户端
事件名	Payload	说明
room:joined	{ roomId, self, state }	加入成功，返回全量状态
draw:created	{ roomId, action }	广播新动作
action:updatedDeleted	{ roomId, actionId, isDeleted }	广播撤销/恢复
cursor:updated	{ roomId, userId, position, pageId }	广播光标更新
board:cleared	{ roomId, pageId }	广播清屏指令
room:state-sync	{ roomId, state }	全量状态同步
🧠 开发提示

所有动作使用归一化坐标（0~1）以保证不同屏幕尺寸一致显示

撤销采用软删除（设置 isDeleted 字段），避免冲突

光标信息要节流发送，建议 50ms 一次

canvas 在高 DPI 屏幕上需要调整 devicePixelRatio 并 ctx.scale(dpr, dpr) 才不会模糊

📦 目录说明
/
├ client/       – 前端 React + Vite
├ server/       – 后端 Express + Socket.io
├ README.md

