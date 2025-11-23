# CollaBoard 实时协作白板 - 软件设计说明（SDD）

> 版本：v0.2（MVP 细化版）   
> 项目代号：CollaBoard

---

## 0. 文档信息
- 文档名称：CollaBoard 实时协作白板系统设计说明（Software Design Description）
- 版本：v0.2（MVP 细化版）
---

## 1. 引言（Introduction）
### 1.1 编写目的
- 作为团队统一的设计基线，用于指导 MVP 的实现与验收。
- 便于拆分章节交给 AI/Codex 生成代码，减少沟通成本。
- 为后续迭代（v0.2+）预留扩展与兼容策略。

### 1.2 项目背景
CollaBoard 是 Web 端多人实时协作白板，类似 Google Jamboard / Microsoft Whiteboard：
- 浏览器共享画布，实时看到彼此笔迹动画。
- 侧重实用场景：远程头脑风暴、教学演示、会议讨论。
- 采用 Socket.io 实现实时广播，Canvas 实现绘制与渲染。

### 1.3 读者对象
- 前端 / 后端 / 全栈工程师；技术负责人 / 架构师；测试 / 运维；产品协作方。

---

## 2. 范围与目标（Scope & Goals）
### 2.1 MVP 目标（v0.1/v0.2）
- 创建/加入房间（分享链接进入）。
- 多人实时自由绘图；颜色 ≥4，粗细 ≥3 档。
- 新用户获取当前白板历史并回放。
- 在线人数显示；用户随机昵称与颜色标识。
- 清空画板并同步。
- 桌面端流畅演示，延迟可接受。

### 2.2 硬性约束与假设
- 单房间并发 ≤10 人，短时峰值 ≤15。
- 持久化暂不做，房间状态在内存；重启数据丢失可接受。
- 房间 ID 为随机短串，默认不过期（可配置 TTL，默认关闭）。
- 浏览器要求：Chrome/Edge/Firefox 近两年版本；移动端仅保证可用，不做深度优化。

### 2.3 不在 MVP 范围（留待迭代）
- 撤销/重做；几何图形、文本、便签、图片；无限画布（拖拽/缩放）。
- 用户光标同步；持久化存储；登录鉴权与权限；历史版本/回放；聊天/评论；手绘风格渲染。

---

## 3. 术语与定义（Definitions）
- Room：独立协作会话，roomId 唯一。
- Stroke：一次按下到松开的一条笔画，含多个 Point。
- Point：二维坐标 `{ x, y }`，使用相对 Canvas 像素坐标。
- Client：浏览器端 React 应用；Server：Node.js + Express + Socket.io。
- Snapshot：房间当前 strokes 列表，用于新用户回放。

---

## 4. 用例描述（Use Cases）
**角色**：用户（无需登录，平权）。

- UC-01 创建房间：访问 `/` 点击创建 → POST `/api/rooms` → 返回 roomId → 跳转 `/room/:roomId`。
- UC-02 加入房间：访问 `/room/:roomId` → 生成临时用户信息 → Socket `join_room` → 收到房间状态并回放。
- UC-03 本地绘制：pointer down 开始记录点并局部渲染；节流发送 `draw_stroke`；pointer up/leave 发送 `isComplete: true`。
- UC-04 接收远端笔迹：监听 `stroke_broadcast`，按顺序绘制增量；完成时合并成完整 stroke。
- UC-05 清空画板：触发 `clear_board` → 服务端清空房间状态 → 广播 `board_cleared` → 客户端清空本地。
- UC-06 查看在线人数：通过 `room_joined`/`user_joined`/`user_left` 更新 UI 计数。
- UC-07 异常场景：错误 roomId → `ROOM_NOT_FOUND`；网络抖动自动重连后重放快照。

---

## 5. 总体架构（Architecture）
### 5.1 技术栈
- 前端：React 18+、TypeScript、React Router、Vite、Socket.io Client、HTML5 Canvas（可选 Zustand 做轻量状态）。
- 后端：Node.js 18+、Express、Socket.io；可选 ts-node/nodemon 开发。
- 部署：同域（Express 托管前端构建产物）或分离（前端 Vercel，后端 Render/自建）。

### 5.2 逻辑架构
- Client：路由 + 状态管理；Canvas 绘制；Socket 交互；UI（Toolbar/StatusBar）。
- Server：REST (房间创建/健康检查)；Socket 房间与事件广播；内存 RoomState 管理。
- 数据流：用户操作 → 本地绘制 → Socket 发送增量 → Server 更新 RoomState 并广播 → 其他客户端回放。

### 5.3 目录/模块建议（代码生成时参考）
- 前端：`src/pages/HomePage.tsx`、`src/pages/BoardPage.tsx`、`src/components/Toolbar.tsx`、`src/components/CanvasBoard.tsx`、`src/components/StatusBar.tsx`、`src/utils/socket.ts`、`src/types.ts`。
- 后端：`src/server.ts`、`src/types.ts`、`src/roomStore.ts`（房间状态管理拆分可选）。

---

## 6. 前端设计（Frontend）
### 6.1 路由
- `/` → HomePage
- `/room/:roomId` → BoardPage

### 6.2 组件职责
- HomePage：展示简介；创建房间按钮；可选输入 roomId 加入。
- BoardPage：建立 Socket；发起 join；管理房间状态（在线数、strokes、selfUser）；组合 Toolbar、CanvasBoard、StatusBar。
- Toolbar：颜色选择、粗细选择、清空按钮；向上层透出回调。
- CanvasBoard：Canvas 绘制与 pointer 事件；节流发送 strokes；接收广播绘制；处理 devicePixelRatio 自适应；窗口 resize 重设尺寸并重绘已有 strokes。
- StatusBar：显示房间 ID、在线人数、当前用户昵称/颜色；复制房间链接（可选）。

### 6.3 绘制与同步细节
- Canvas 尺寸：逻辑尺寸 = DOM 尺寸 * devicePixelRatio；绘制时 scale(ctx, dpr, dpr) 以避免模糊。
- Pointer 事件：统一 pointerdown/move/up/cancel；阻止滚动（在 Canvas 上）；支持鼠标与触控。
- 节流策略：
  - 时间片 16–40ms 或点数阈值 5–10；批量发送 `{points: [...]}`；
  - 结束时发送 `isComplete: true` 且包含末尾点。
- strokeId 生成：`${userId}-${Date.now()}-${random}`；在广播回放时按 strokeId 聚合。
- 本地绘制：每收到一批 points 仅绘制增量段，减少重绘；持有 `strokesCache` 重放需要时可全量遍历。
- 清空：本地清空 canvas 与 cache，重置当前笔画缓冲。

### 6.4 状态与错误处理
- Socket 连接状态：connecting/connected/disconnected，用于 UI 提示（可选）。
- 错误提示：ROOM_NOT_FOUND、INVALID_PAYLOAD 等在页面 toast/alert。
- 防抖：颜色/粗细切换即时生效；清空操作需确认（可选，MVP 可直接执行）。

---

## 7. 后端设计（Backend）
### 7.1 REST API
- `POST /api/rooms`
  - 描述：创建房间。
  - 响应：`{ roomId: string }`；roomId 生成可用 nanoid/base36/UUID 片段。
- `GET /api/health`
  - 描述：健康检查。
  - 响应：`{ status: "ok" }`。

### 7.2 Socket.io 事件
- Client → Server
  - `join_room`: `{ roomId, userId, userName, userColor }`
  - `draw_stroke`: `{ roomId, userId, strokeId, color, brushSize, points: Point[], isComplete }`
  - `clear_board`: `{ roomId, userId }`
- Server → Client
  - `room_joined`: `{ roomId, selfUser, users, strokes, onlineCount }`
  - `user_joined`: `{ roomId, user, onlineCount }`
  - `user_left`: `{ roomId, userId, onlineCount }`
  - `stroke_broadcast`: `{ roomId, userId, strokeId, color, brushSize, points, isComplete }`
  - `board_cleared`: `{ roomId, userId }`
  - `error_message`: `{ code, message }`

### 7.3 房间状态管理
- 数据结构：`Map<string, RoomState>`；RoomState 含 `roomId`, `users: Map<userId, UserInfo>`, `strokes: Stroke[]`。
- 新建：无房间则创建，初始化空 users/strokes；可配置 TTL（默认关闭）。
- 用户加入：加入 Socket room；推送 `room_joined`（含快照）；广播 `user_joined`。
- 用户离开：`disconnect` 或 `leave` 时移除 user，广播 `user_left`。
- 笔画存储：若不存在 strokeId 则创建，存在则追加 points；可设置 strokes 上限（如 1000），超出可丢弃最旧（MVP 可仅告警）。
- 清空：重置 strokes=[]；广播 `board_cleared`。

### 7.4 校验与限流（轻量）
- Payload 校验：roomId/userId/strokeId 非空；points 长度 >0；brushSize 合理区间（1–30）。
- 尺寸保护：单次 points 上限（如 200 点）；单 stroke 点数上限（如 2000 点）。
- 频率保护：服务器端对 `draw_stroke` 做最小时间间隔（如 5–10ms）的软限制（可选）。

### 7.5 错误码
- ROOM_NOT_FOUND：房间不存在。
- INVALID_PAYLOAD：缺少字段或类型错误。
- ROOM_OVERLOAD：房间超过容量/上限（可选）。
- INTERNAL_ERROR：服务器异常。

---

## 8. 数据模型（TypeScript）
```ts
export type Point = { x: number; y: number };
export type Stroke = {
  strokeId: string;
  userId: string;
  color: string;
  brushSize: number;
  points: Point[];
};
export type UserInfo = {
  userId: string;
  userName: string;
  userColor: string;
};
export type RoomState = {
  roomId: string;
  users: Map<string, UserInfo>;
  strokes: Stroke[];
};
```
- 传输时 Map 可序列化为数组；服务端内部维持 Map 方便查找。
- strokeId 由客户端生成；服务端按 strokeId 聚合。

---

## 9. 实时与性能策略
- 客户端节流：16–40ms 或 5–10 点一批；结束包带 isComplete。
- 绘制优化：requestAnimationFrame 合并；仅绘制增量；Canvas dpr 适配。
- 内存控制：stroke 点数上限 2000；房间 strokes 上限 1000（可配置）；超限策略可为丢弃最旧或拒绝新笔画（MVP 可先仅记录告警）。
- 重连策略：Socket.io 默认重连；重连后重新 join，并可请求服务端重新下发快照（room_joined）。

---

## 10. UI/UX 要点
- 布局：顶部状态栏（项目名/房间 ID/在线人数）+ 左侧或顶部工具栏 + 主画布。
- 视觉：浅色背景，彩色圆形色块按钮，明确选中态；桌面优先，移动端可折叠工具栏（可选）。
- 动画：笔迹渐进绘制为主；按钮 hover/active 轻量反馈。
- 可用性：提供复制房间链接；错误/断线提示可在 StatusBar 显示。

---

## 11. 非功能性需求
- 性能：单房间 10 人内流畅；端到端笔迹延迟主观可接受（目标 <150ms 本地网络）。
- 可用性：支持最新 Chrome/Edge/Firefox；窗口 resize 自动适配 Canvas。
- 可靠性：断线自动重连；重连后能恢复当前画板（基于快照）。
- 安全性（轻量）：随机 roomId 降低枚举；无鉴权；输入做基本校验。
- 可观察性：最小日志（房间创建、join/leave、clear、错误码），便于排查。

---

## 12. 测试与验收
- 单元/小集成：
  - 后端：room 创建；join_room 正常返回快照；draw_stroke 聚合与广播；clear_board 广播；错误码覆盖。
  - 前端：Toolbar 状态切换；Canvas 坐标缩放与 dpr 适配函数；节流逻辑；stroke 缓存与回放。
- 手动验收脚本：
  1) 两浏览器同房间同步绘制，延迟可接受。
  2) 新窗口加入能看到历史笔画。
  3) 清空后所有端同时清空。
  4) 在线人数随加入/退出更新。
  5) 错误 roomId 提示；断网重连后可恢复。

---

## 13. 部署与运行
- 开发：Node.js 18+；`npm install`；前端 `npm run dev`（Vite），后端 `npm run dev`（nodemon/ts-node）。
- 生产：前端 `npm run build`；同域部署用 Express 托管 build 目录并复用 Socket 域；分离部署在前端配置后端 Socket URL（环境变量如 `VITE_SOCKET_URL`）。
- 环境变量（示例）：`PORT`、`SOCKET_CORS_ORIGIN`、`ROOM_TTL`（可选，单位 ms）。

---

## 14. 迭代计划（示例）
- v0.2（当前）：MVP 细化，基本体验完整。
- v0.3：撤销/重做；直线/矩形；用户光标同步；重连状态优化。
- v0.4：无限画布；持久化快照；基础鉴权（房间口令/临时 token）。
- v1.0：完整用户体系、白板管理、访问控制、历史回放、导出/分享。

---

## 15. 风险与缓解
- 性能：多人高频绘制 → 客户端节流；服务器点数/频率保护；仅增量广播。
- 内存：长会话笔画过多 → 笔画/点数上限与淘汰策略。
- 网络抖动：乱序/丢包 → strokeId + isComplete；客户端增量绘制，必要时可全量重放缓存。
- 体验：移动端适配不足 → 桌面优先，移动端最小可用；工具栏可折叠。

---

## 16. 如何用本 SDD 驱动 AI 生成代码
- 后端：基于第 7 章，让 AI 生成 `server.ts`（Express + Socket.io），实现房间创建、Socket 事件、内存房间管理、基础校验、错误码。
- 前端：基于第 6 章，让 AI 生成 React + TS + Vite 骨架，路由 `/`、`/room/:roomId`，组件 Toolbar/CanvasBoard/StatusBar，含 dpr 适配与节流逻辑。
- 联调：按第 9 章配置节流与 strokeId；按第 12 章的手动验收脚本自测。

（本 SDD 聚焦 MVP 可演示版本，完成后可按第 14 章逐步扩展。）
