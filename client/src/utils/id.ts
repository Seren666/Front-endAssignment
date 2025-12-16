//前端生成唯一 ID 的工具函数
import { nanoid } from 'nanoid';
//每次调用都会生成一个全新的随机 ID，用于标记动作、页面等需要唯一标识的对象
export function generateId(): string {
  return nanoid();
}

// ✨ 获取持久化用户 ID（动作 ID 是一次性的，用户 ID 是持久化的，方便前端和后端区分是谁操作的）
export function getPersistentUserId(): string {
  let id = localStorage.getItem('collab_device_id');
  if (!id) {
    id = 'user_' + nanoid(8);
    localStorage.setItem('collab_device_id', id);
  }
  return id;
}