# CollaBoard (v1.0 进阶版) 软件设计说明书 (SDD)

> 技术栈回顾：
> 前端：React + TypeScript + Vite + HTML5 Canvas + Tailwind CSS
> 后端：Node.js + Express + Socket.io
> 存储：内存存储（In-Memory），不做持久化

---

## 1. 引言

### 1.1 编写目的

本《软件设计说明书》用于指导一个由大学生组成的前端 / 全栈小组实现 **CollaBoard v1.0 进阶版**——一个多人实时协作白板应用。

目标：

* 让项目 **超过简单 MVP 难度**，在功能和架构上更完整、更工程化。
* 同时保证 **实现难度在学生可控范围内**，不涉及复杂数学、不涉及 CRDT、无限画布等高难度内容。
* 通过清晰的数据结构和通信协议，减少“写着写着迷路”的情况。

### 1.2 读者对象

* 前端开发：负责 React + TS + Canvas + Tailwind 实现。
* 后端开发：负责 Express + Socket.io，维护房间状态。
* 全栈 / 组长：负责整体架构、代码组织和集成。
* 指导老师 / 助教：用于理解项目设计成熟度。

### 1.3 项目背景与范围

**核心功能范围（必须实现）：**

* 自由绘制（铅笔工具，平滑/折线均可）
* 矩形 / 圆形绘制（带 “预览-确认” 交互）
* 撤销 / 重做（至少支持“撤销自己操作”）
* 多人在线房间 & 实时光标（Live Cursors）
* 画布导出为图片（PNG 下载）

**明确不在本次范围内（刻意排除，避免过度复杂）：**

* ❌ 无限画布（Infinite Canvas）
* ❌ 画布缩放 / 平移（Zoom / Pan）
* ❌ 高级文本编辑（富文本、换行排版等）
* ❌ CRDT / OT 等复杂协同编辑算法
* ❌ 数据库持久化、鉴权系统

---

## 2. 总体设计 (Architecture)

### 2.1 系统逻辑架构描述

整体采用典型的 **Client–Server + WebSocket** 模型，后端为“权威状态”，前端只做“展示 + 输入”。

```text
+----------------------+            +---------------------------+
|      浏览器 Client   |   Socket   |         Node Server       |
|----------------------| <--------> |---------------------------|
| React + TS + Canvas  |            | Express + Socket.io       |
|                      |            |                           |
|  - Toolbar           |            |  - RoomMgr (房间管理)     |
|  - CanvasLayer       |            |  - ClientMgr (连接管理)   |
|  - CursorLayer       |            |  - In-Memory RoomState    |
|  - NetworkMgr        |            |                           |
+----------------------+            +---------------------------+
```

**数据流（以一次绘制为例）：**

1. 用户在前端操作鼠标（CanvasLayer 捕获事件）。
2. 前端根据当前工具生成 `DrawAction`，在本地预览。
3. 在 `pointerup` 时将完整 `DrawAction` 通过 Socket.io 发送给服务端。
4. 服务端将该 `DrawAction` 写入房间状态（内存），并广播给房间内所有客户端。
5. 各客户端更新本地的 RoomState，并重新绘制画布。

### 2.2 前端模块划分

#### 2.2.1 Toolbar 模块 (v1.2 重构)
* UI 布局：

  * 位置：画布左上角的悬浮面板（BoardMix 风格）。

  * 一级菜单：竖向排列，包含分类图标（画笔、形状、颜色、撤销、清屏）。

  * 二级菜单 (Popover)：点击“画笔”或“形状”时，向右侧弹出具体样式的选择面板。

* 功能状态：

  * 画笔类：pencil (铅笔), marker (马克笔), laser (激光笔)。

  * 形状类：rect, ellipse, triangle, star, diamond, pentagon, hexagon, arrow。

* 交互逻辑：

  * 引入 lucide-react 图标库提升视觉体验。

  * 使用 CSS pointer-events 解决悬浮层遮挡画布的问题

#### 2.2.2 CanvasLayer 模块

* 功能：

  * 负责所有 **持久绘制内容**（历史笔迹、矩形、圆形）。
  * 响应鼠标 / 触摸事件，计算绘制轨迹。
  * 将最终的绘制结果构造成 `DrawAction` 并交给 `NetworkMgr`。
* 内部组成：

  * `mainCanvas`：最终绘制层（所有 commit 后的内容）
  * `previewCanvas`：预览层（矩形 / 圆形正在拉的过程、正在绘制中的笔迹）
* 依赖：

  * 从全局 state 接收 `actions` 列表，并负责根据 actions 重绘。

#### 2.2.3 CursorLayer 模块

* 功能：

  * 使用单独的 `<canvas>` 或多个绝对定位的 `<div>` 绘制/显示 **其他用户的光标**。
  * 通过 `NetworkMgr` 接收其他用户的光标事件并更新 UI。
* 特点：

  * 不参与导出图片（导出时可只导出绘图层）。

#### 2.2.4 NetworkMgr 模块

* 功能：

  * 封装 Socket.io 客户端逻辑。
  * 统一管理房间加入、消息收发。
  * 提供类型安全的接口，例如 `sendDrawAction(...)`, `sendCursorPosition(...)`。
* 形式：

  * 可以是一个自定义 hook：`useCollaBoardSocket(roomId)`。
  * 或单例模块，用 Context 提供给整个应用。

### 2.3 后端模块划分

#### 2.3.1 RoomMgr（房间管理）

* 负责：

  * 创建 / 查找房间 `RoomState`
  * 管理房间中的 `actions` 和 `users`
  * 处理 `draw:commit`, `action:undo`, `action:redo` 等与房间状态相关的事件

#### 2.3.2 ClientMgr（客户端连接管理）

* 负责：

  * 为每个 Socket 记录 `userId`, `roomId`
  * 处理用户加入 / 离开房间
  * 当用户断开时，从对应房间移除该用户，并广播 `user:left`

---

## 3. 详细功能设计 (Functional Specification)

> 在功能设计中，我们遵循一个原则：
>
> * **绘制逻辑尽量在前端完成**，后端只存储结果；
> * **房间状态以动作列表为核心**，Undo/Redo 基于此进行。

### 3.1 基础：坐标系 & 归一化

#### 3.1.1 Canvas 尺寸与坐标

* 画布在页面中的 CSS 尺寸为：

  * `cssWidth = container.clientWidth`
  * `cssHeight = container.clientHeight`
* 绘制和网络同步使用 **归一化坐标**：

  * `xNorm = x / cssWidth` ∈ [0, 1]
  * `yNorm = y / cssHeight` ∈ [0, 1]

**原因：**

* 不同用户屏幕大小不一样，若直接用像素坐标会导致白板内容在别人屏幕上位置偏移。
* 用归一化坐标，其他客户端只需要用自己的 canvas 尺寸反归一化即可：

```ts
const x = xNorm * canvasWidth;
const y = yNorm * canvasHeight;
```

> 多人光标和绘制点 **都使用相同的归一化坐标系统**。

### 3.2 自由绘制 (Freehand Tool)
支持 brushType 属性，包含三种模式：

1. 铅笔 (Pencil)：

   * 默认实心线条，globalAlpha = 1.0。

2. 马克笔 (Marker)：

   * 模拟水彩笔效果，渲染时设置 globalAlpha = 0.5 且线宽加倍，实现笔迹叠加变深的效果。

3. 激光笔 (Laser)：

  * 短暂存活：笔迹不写入 Main Canvas（持久层），仅在 Preview Canvas（预览层）绘制。

  * 动画循环：前端维护一个 lasers 队列，利用 requestAnimationFrame 每一帧递减透明度。

  * 自动消失：设定生命周期为 2000ms，超时后从队列移除。

3.3 图形与连接线 (Shapes)
所有图形统一采用 双点定义法 (start, end)，渲染器根据这两点计算几何路径：

* 基础图形：矩形、圆/椭圆、三角形。

* 多边形：

* 五角星 (Star)：计算外接圆半径，使用三角函数生成 10 个顶点。

* 菱形 (Diamond)、五边形 (Pentagon)、六边形 (Hexagon)：基于外接圆或对角线计算顶点。

* 连接线 (Arrow)：

  * 根据起点和终点计算角度 (Math.atan2)。

  * 在终点处反向绘制两条短线段形成箭头头部。

### 3.4 撤销 / 重做：软删除 vs 动作栈

#### 3.4.1 两种策略对比

1. **动作栈策略（Stack-based）**

   * 单机版常用：

     * `undoStack: DrawAction[]`
     * `redoStack: DrawAction[]`
   * 每次绘制：push 到 `undoStack`，清空 `redoStack`。
   * 撤销：从 `undoStack` pop 一个 action，推到 `redoStack`。
   * 重做：从 `redoStack` pop，一个推回 `undoStack`。

   **问题：**

   * 多人协作时，如果每个用户都维护自己的栈，很容易状态不一致。
   * 如果在撤销期间有其他用户新建 action，逻辑会很复杂。

2. **软删除策略（Soft Delete）**

   * 后端维护一个全局的 `actions` 列表（按时间 / 插入顺序）。
   * 每个 `DrawAction` 有一个 `isDeleted: boolean`。
   * 撤销并不是“从数组中删除”，而是：

     * 找到最近一个当前用户的且 `isDeleted === false` 的 action。
     * 将其标记为 `isDeleted = true`。
   * 重做：

     * 为每个用户维护一个 `undoStack`，里面是被撤销 action 的 id。
     * 重做时从 `undoStack` 弹出一个 id，将对应 action 的 `isDeleted` 改回 `false`。

   **优势：**

   * actions 列表在所有客户端和服务器上结构始终一致；
   * 只需改变一个布尔值即可实现撤销 / 重做；
   * 在多人协作场景下更容易保持一致。

> **结论：对于本项目（多人协作），推荐使用 `软删除 + 每用户 undo 栈` 的组合策略。**

#### 3.4.2 撤销逻辑（软删除实现步骤）

以“只撤销当前用户的最后一个操作”为例：

1. 前端用户点击 Undo，发送事件：

   ```json
   {
     "roomId": "room-1"
   }
   ```

2. 服务端：

   * 从 `RoomState.actionOrder` 的末尾向前遍历，找到第一个满足：

     * `action.userId === currentUserId`
     * `action.isDeleted === false`
   * 如果找到：

     * 将 `action.isDeleted = true`
     * 将该 `action.id` push 到 `room.userUndoStacks[userId]`。
     * 向房间广播 `action:updatedDeleted` 事件，载荷包括 `actionId` 和 `isDeleted: true`。

3. 客户端：

   * 收到广播后，将本地对应 `DrawAction` 标记为 deleted。
   * 在重新绘制 canvas 时，跳过 `isDeleted === true` 的动作。

#### 3.4.3 重做逻辑

1. 前端用户点击 Redo，发事件：

   ```json
   {
     "roomId": "room-1"
   }
   ```

2. 服务端：

   * 从 `room.userUndoStacks[userId]` pop 一个 actionId。
   * 如果存在：

     * 将对应 `action.isDeleted = false`
     * 广播 `action:updatedDeleted`，携带 `isDeleted: false`。

3. 客户端：

   * 更新本地 `action.isDeleted`，触发重新绘制。

### 3.5 多人光标 (Live Cursors)

#### 3.5.1 坐标节流（Throttle）

* 光标更新频率不宜太高，否则会产生网络风暴。
* 前端对 `pointermove` 进行节流，例如每 50ms 发送一次：

伪代码：

```ts
function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let last = 0;
  let timer: number | null = null;
  return function (...args: any[]) {
    const now = Date.now();
    const remain = delay - (now - last);
    if (remain <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = window.setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remain);
    }
  } as T;
}
```

然后：

```ts
const sendCursorThrottled = useMemo(
  () => throttle((xNorm: number, yNorm: number) => {
    socket.emit('cursor:update', { roomId, position: { x: xNorm, y: yNorm } });
  }, 50),
  [socket, roomId]
);
```

#### 3.5.2 坐标归一化

* 与绘制统一的归一化规则：

  * `xNorm = x / canvasWidth`
  * `yNorm = y / canvasHeight`
* 服务端不关心具体像素，只转发 `0~1` 的归一化坐标。
* 客户端接收后用自己 canvas 尺寸进行反归一化。

#### 3.5.3 显示逻辑

* CursorLayer 维护一个 `otherUsers: User[]`，每个 user 内含 `cursor`。
* 对于每个有 `cursor != null` 的用户，在对应位置渲染一个小圆点 + 用户名 label。
* **注意：** 不显示自己的光标（或使用本地系统光标）。

### 3.6 图片导出

两种实现方式，选一种即可：

1. **简单方式（推荐）：**

   * 所有最终绘制内容都在同一个 `mainCanvas` 上。
   * 点击“导出”时：

     * 调用 `mainCanvas.toDataURL('image/png')`。
     * 创建一个 `<a>` 标签，`href = dataURL`，`download = 'collaboard.png'`，触发点击。

2. **更可控方式：**

   * 导出时：

     * 创建一个离屏 canvas（`offscreenCanvas`），尺寸与主画布一致。
     * 遍历 `RoomState.actions`，忽略 `isDeleted` 的动作，在离屏 canvas 上重绘一遍。
     * `offscreenCanvas.toDataURL()` 后下载。
   * 优点：即使将来有多层 canvas，导出逻辑仍然统一；也可以选择不导出光标。

3.7 多画布支持 (Multi-Page) [v1.2 新增]
* 数据结构：所有 DrawAction 和用户 Cursor 均增加 pageId 字段 (默认 'page-1')。

* 渲染隔离：

  * 前端渲染循环中增加过滤条件：if (action.pageId === currentPageId) 才进行绘制。

  * 切换页面时，立即清空画布并请求/重绘新页面的数据。

* 清屏逻辑：

  * board:clear 事件必须携带 pageId，后端只标记该页面的动作为删除。

---
## 4. 接口与协议设计 (Interface & Protocol v1.2)
### 4.1 数据结构定义 (TypeScript)
```TypeScript
export const PROTOCOL_VERSION = '1.2.0';

/* --- 基础类型 --- */
export type RoomId = string;
export type UserId = string;
export type ActionId = string;
export type PageId = string; // 新增：多画布页码 ID

export interface Point {
  x: number;
  y: number;
}

/* --- 绘制动作 DrawAction --- */
export type DrawActionType = 
  | 'freehand' // 自由画笔
  | 'rect' | 'ellipse' | 'triangle' | 'star' 
  | 'diamond' | 'pentagon' | 'hexagon' // v1.2 新增形状
  | 'arrow';   // v1.2 新增箭头

export type BrushType = 'pencil' | 'marker' | 'laser'; // v1.2 新增笔刷

/** 公共字段 */
export interface DrawActionBase {
  id: ActionId;
  roomId: RoomId;
  pageId: PageId; // 必须字段
  userId: UserId;
  type: DrawActionType;
  color: string;
  strokeWidth: number;
  isDeleted: boolean;
  createdAt: number;
}

/** 自由绘制 */
export interface FreehandDrawAction extends DrawActionBase {
  type: 'freehand';
  points: Point[];
  brushType: BrushType; // 区分铅笔/水彩/激光
}

/** 形状绘制 (双点定义) */
export interface ShapeDrawAction extends DrawActionBase {
  type: 'rect' | 'ellipse' | 'triangle' | 'star' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon';
  start: Point;
  end: Point;
}

export type DrawAction = FreehandDrawAction | ShapeDrawAction;

/* --- 用户与房间 --- */
export interface CursorPosition {
  x: number;
  y: number;
  pageId: PageId; // 光标所在页
  updatedAt: number;
}

export interface User {
  id: UserId;
  name: string;
  color: string;
  cursor: CursorPosition | null;
}

export interface RoomState {
  id: RoomId;
  users: Record<UserId, User>;
  actions: Record<ActionId, DrawAction>;
  actionOrder: ActionId[];
  createdAt: number;
  userUndoStacks: Record<UserId, ActionId[]>;
}
```
### 4.2 Socket.io 事件清单
Client -> Server
事件名,Payload 结构,说明
room:join,"{ roomId, userName }",加入房间
draw:commit,"{ roomId, action: DrawAction }",提交绘制
action:undo,"{ roomId, userId }",撤销该用户的上一步
board:clear,"{ roomId, pageId }",新增：清空指定页面的画布
cursor:update,"{ roomId, position: Point, pageId }",更新光标 (含页码)

Server -> Client
事件名,Payload 结构,说明
room:joined,"{ roomId, self, state }",加入成功，返回全量状态
draw:created,"{ roomId, action }",广播新动作
action:updatedDeleted,"{ roomId, actionId, isDeleted }",广播撤销/恢复
board:cleared,"{ roomId, pageId }",新增：广播清屏指令
cursor:updated,"{ roomId, userId, position, pageId }",广播他人光标
room:state-sync,"{ roomId, state, reason }",全量同步兜底
---

## 5. 关键技术难点与解决方案

### 5.1 高分屏模糊问题 & devicePixelRatio

**问题：**

* 在 retina / 高 DPI 屏幕上，如果 canvas 的真实像素尺寸和 CSS 尺寸相同，会导致绘制模糊。
* 例如：CSS 宽度 800px，`devicePixelRatio = 2` 时，实际应有 1600 像素。

**解决方案：**

1. 获取 `devicePixelRatio`：

   ```ts
   const dpr = window.devicePixelRatio || 1;
   ```

2. 将 canvas 的实际像素尺寸设置为 CSS 尺寸 × dpr：

   ```ts
   const rect = canvas.getBoundingClientRect();
   canvas.width = rect.width * dpr;
   canvas.height = rect.height * dpr;
   const ctx = canvas.getContext('2d')!;
   ctx.scale(dpr, dpr); // 坐标系缩放回“CSS 像素”
   ```

3. 鼠标事件的坐标依然用 CSS 坐标计算（通过 boundingRect 计算），不需要关心 dpr。

4. 由于我们存储的是 **归一化坐标 (0~1)**，绘制时只需：

   ```ts
   const x = point.x * rect.width;
   const y = point.y * rect.height;
   ```

   然后由 `ctx.scale(dpr, dpr)` 自动映射到实际像素。

> 小结：
>
> * **存储：归一化**
> * **渲染：归一化 → CSS 像素 → 由 ctx.scale 自动转换为物理像素**

### 5.2 网络风暴 & 节流策略

**问题：**

* `pointermove` 触发频率极高，如果每次都发送 `cursor:update` 或绘图数据，会产生大量 Socket 消息，导致：

  * 网络拥塞
  * 浏览器卡顿
  * 服务端压力增大

**解决方案：**

* 对 `cursor:update` 和（如果做实时边画边传）`draw:update` 进行节流。
* 推荐做法：

  * 光标更新：每 50ms 发送一次；
  * 实时绘制（如果有）：可以降低频率到 16~30 FPS（33~60ms 一次）。

**工程建议：**

* 封装一个可复用的 `throttle` 函数（上面已给出伪代码）。
* 注意：对 React 来说，`throttle` 通常应放在 `useMemo` 中，避免每次渲染都创建新函数导致节流失效。

### 5.3 React 闭包陷阱（Socket 监听中的状态获取）

**问题：**

* 在 React 中，如果你在 `useEffect` 中设置了 socket 监听器：

  ```ts
  useEffect(() => {
    socket.on('draw:created', (payload) => {
      // stale: 这里的 actions 是 effect 创建时的旧值
      setActions([...actions, payload.action]);
    });
  }, [socket]);
  ```

  由于 `actions` 不是依赖项，监听器捕获的是“旧的 actions”，导致：

  * 新 action 会覆盖掉前一次更新（经典 bug）。

**解决方案 1：使用函数式 `setState`**

```ts
useEffect(() => {
  socket.on('draw:created', ({ action }) => {
    setActions(prev => [...prev, action]);
  });

  return () => {
    socket.off('draw:created');
  };
}, [socket]);
```

* 不再使用闭包捕获的 `actions`，而是通过 `prev`（React 始终提供最新值）。

**解决方案 2：使用 `useRef` 存储最新状态**

如果你需要在监听器中读取当前最新的完整 RoomState：

```ts
const roomStateRef = useRef<RoomState | null>(null);
const [roomState, setRoomState] = useState<RoomState | null>(null);

// 同步 ref
useEffect(() => {
  roomStateRef.current = roomState;
}, [roomState]);

useEffect(() => {
  socket.on('room:state-sync', ({ state }) => {
    setRoomState(state);
  });

  socket.on('some:event', () => {
    const current = roomStateRef.current;
    if (!current) return;
    // 使用最新 roomStateRef.current 做复杂逻辑
  });

  return () => {
    socket.off('room:state-sync');
    socket.off('some:event');
  };
}, [socket]);
```

**解决方案 3：使用全局状态管理（如 Zustand）**

* 将 RoomState 放在一个 store 中，socket 监听器直接调用 store 的 `set` 方法。
* 在 store 内使用不可变数据更新，组件通过订阅 store 渲染。

> 对本项目建议：
>
> * 为减小复杂度，优先用 **函数式 setState**。
> * 只有在需要在监听器中读取“当前完整状态”做复杂逻辑时，再考虑 `useRef` 或状态管理库。

---

## 6. 异常处理

### 6.1 断网重连机制

**目标：**

* 用户网络短暂中断（例如切换 Wi-Fi），恢复后可以自动重新加入房间并同步最新白板状态。

**基于 Socket.io 的处理方案：**

1. 利用 Socket.io 的自动重连机制（默认开启）。

2. 在客户端监听：

   ```ts
   socket.on('connect', () => {
     // 如果之前有加入的 roomId，则重新发送 room:join
     if (lastRoomId && lastUserName) {
       socket.emit('room:join', { roomId: lastRoomId, userName: lastUserName });
     }
   });
   ```

3. 服务端在 `room:join` 逻辑中：

   * 如果房间已存在，则将用户重新加入 `RoomState.users` 中。
   * 然后发送 `room:joined` + 当前 `RoomState`。

4. 客户端收到 `room:joined` 后，直接用返回的 state 覆盖本地 state，保证“重连即同步”。

### 6.2 数据乱序的基础处理

**问题：**

* 网络环境不稳定时，消息可能乱序到达，例如：

  * `draw:created` A1、A2、A3 顺序打乱；
  * 或 `action:updatedDeleted` 在 `draw:created` 之前收到。

**简单可行的解决思路（不引入 CRDT）：**

1. **服务器权威排序：**

   * 所有 `DrawAction` 的 `createdAt` 统一由服务器生成（例如 `Date.now()`）。
   * 同时在 `RoomState.actionOrder` 中按插入顺序维护 id。
   * 客户端渲染时 **只信任 `actionOrder` 的顺序**。

2. **幂等更新：**

   * 当收到 `draw:created`：

     * 若本地不存在该 id，则插入；
     * 若已经存在，则忽略（防止重复）。
   * 当收到 `action:updatedDeleted`：

     * 若本地已存在对应 action，则仅更新 `isDeleted`；
     * 若本地还没有这个 action，则可以暂存该更新（或在下一次 `room:state-sync` 中自动被覆盖）。

3. **定期 / 特殊时机全量同步：**

   * 在以下场景触发 `room:state-sync`：

     * 客户端重连。
     * 检测到异常（例如某 actionId 在删除时本地不存在）。
   * `room:state-sync` 直接携带完整 `RoomState`，客户端用其覆盖本地状态。