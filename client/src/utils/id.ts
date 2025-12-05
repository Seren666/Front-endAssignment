import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid();
}

// ✨ 新增：获取持久化用户 ID
export function getPersistentUserId(): string {
  let id = localStorage.getItem('collab_device_id');
  if (!id) {
    id = 'user_' + nanoid(8);
    localStorage.setItem('collab_device_id', id);
  }
  return id;
}