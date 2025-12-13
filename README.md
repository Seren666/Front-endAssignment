# CollaBoard
<div align="center">

**多人实时协作白板**

</div>

支持自由绘制、图形绘制、撤销/重做、多人光标和导出图片等功能。

【在这里放demo视频】

## 目录
- [CollaBoard](#Collaboard)
  - [目录](#目录)
  - [示例](#示例)
  - [主要功能](#主要功能)
  - [核心原理](#核心原理)
    - [概述](#概述)
    - [协议与事件定义](#协议与事件定义)
    - [开发提示](#开发提示)
  - [快速开始](#快速开始)
    - [安装依赖](#安装依赖)
    - [启动开发环境](#启动开发环境)
  - [项目目录说明](#项目目录说明)
  



## 示例
以下是CollaBoard的使用演示
【在这里放使用演示截图或jpg】


## 主要功能

- 🖍 **自由绘制**：支持多种画笔（铅笔、马克笔、激光笔、橡皮擦）
- 🔷 **图形绘制**：矩形、圆形、三角形、多边形、箭头等几何图形
- 🔄 **撤销 / 重做**：基于软删除和 per-user undo 栈
- 👥 **实时协作**：多人同时在线绘制与光标同步
- 🏠 **创建房间并加入**：支持通过房间号和密码创建和加入特定房间
- 📸 **导出 PNG**：将主画布内容导出为图片
- ⚙️ **高清画布渲染**：支持高 DPI 设备优化 canvas 显示

---

## 核心原理

### 概述
CollaBoard 采用 React + Vite 构建前端界面，Node.js + Express + Socket.io 作为后端服务，通过 WebSocket 实现多人实时协作绘图。

系统整体采用 Client–Server + WebSocket 架构：浏览器端作为 Client 负责用户交互与画面渲染，服务端负责房间管理、状态维护与消息广播。客户端与服务端之间通过 Socket.io 建立长连接，实现低延迟的数据同步。

在协作过程中，用户的每一次绘图操作都会被封装为一个统一的数据结构 DrawAction。前端在接收用户输入时先进行本地渲染预览，并在操作结束（如 pointerup）时将对应的 DrawAction 发送至服务端。服务端接收后更新房间状态，并将该操作广播给房间内的所有客户端。

客户端在收到来自服务端的绘制动作后，根据动作内容更新本地状态并重绘画布，从而保证所有参与者在同一房间中看到的画面始终保持一致，实现真正的实时协作体验。

### 协议与事件定义（Socket）

#### 📨 客户端 → 服务端

| 事件名             | Payload                        | 说明     |
| --------------- | ------------------------------ | ------ |
| `room:join`     | `{ roomId, userName }`         | 加入房间   |
| `draw:commit`   | `{ roomId, action }`           | 提交绘制动作 |
| `action:undo`   | `{ roomId, userId }`           | 撤销操作   |
| `action:redo`   | `{ roomId, userId }`           | 重做操作   |
| `cursor:update` | `{ roomId, position, pageId }` | 光标更新   |
| `board:clear`   | `{ roomId, pageId }`           | 清空画布   |

#### 📤 服务端 → 客户端

| 事件名                     | Payload                                | 说明      |
| ----------------------- | -------------------------------------- | ------- |
| `room:joined`           | `{ roomId, self, state }`              | 加入成功    |
| `draw:created`          | `{ roomId, action }`                   | 广播新动作   |
| `action:updatedDeleted` | `{ roomId, actionId, isDeleted }`      | 撤销/恢复更新 |
| `cursor:updated`        | `{ roomId, userId, position, pageId }` | 光标更新    |
| `board:cleared`         | `{ roomId, pageId }`                   | 清屏广播    |
| `room:state-sync`       | `{ roomId, state }`                    | 全量同步    |
### 开发提示

* 所有动作使用 **归一化坐标（0~1）**，不同屏幕尺寸保持一致
* 撤销用软删除（`isDeleted`），减少冲突
* 光标更新建议 **节流 50ms**
* canvas 在高 DPI 屏幕下需要处理 `devicePixelRatio` 并用 `ctx.scale(dpr, dpr)` 避免模糊

## 快速开始

### 安装依赖

在根目录运行：

```bash
npm run install:all
````

或手动安装：

```bash
cd client
npm install

cd ../server
npm install
```

---

### 启动开发环境

**前端（Client）：**

```bash
cd client
npm run dev
```

默认：[http://localhost:5173](http://localhost:5173)

**后端（Server）：**

```bash
cd server
npm run dev
```

默认：[http://localhost:3000](http://localhost:3000)

---

### 两端一起跑

安装 concurrently：

```bash
npm install -D concurrently
```

根目录 `package.json` 添加：

```json
"scripts": {
  "dev:client": "cd client && npm run dev",
  "dev:server": "cd server && npm run dev",
  "start": "concurrently \"npm:dev:server\" \"npm:dev:client\""
}
```

然后运行：

```bash
npm run start
```


## 项目目录说明

```
/
├── client/       # 前端 React + Vite
├── server/       # 后端 Express + Socket.io
├── README.md
```