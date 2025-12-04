import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Palette, Lock, User } from 'lucide-react'; // 引入新图标

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  // ✨ 新增：密码状态 (虽然现在不做验证，但UI先做好)
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // ✨ 解决问题：每次进入登录页，强制重置网页标题
  useEffect(() => {
    document.title = 'CollabCanvas - 登录';
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    // 如果加了密码，这里将来会把 password 发给后端验证
    // 目前演示阶段，我们允许任意密码或空密码
    navigate('/board', { state: { username } });
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 z-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)',
        backgroundSize: '40px 40px'
      }}></div>

      <div className="z-10 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          {/* ✨ 优化：使用漂亮的图标代替原来的 "C" */}
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 transform hover:rotate-6 transition-transform">
            <Palette size={32} className="text-white" />
          </div>
          
          {/* ✨ 更名：CollabCanvas */}
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            欢迎来到 CollabCanvas
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            多人实时协作 · 创意无限延伸
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* 用户名输入 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              昵称
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入您的昵称"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-gray-50 focus:bg-white"
                autoFocus
              />
            </div>
          </div>

          {/* ✨ 新增：密码输入框 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              房间密码 <span className="font-normal text-gray-300 normal-case">(可选)</span>
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="设置或输入房间密码"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-200 mt-6"
          >
            进入画板
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
        
        <p className="text-center text-xs text-gray-400 mt-6">
          v1.2 In-Memory Edition
        </p>
      </div>
    </div>
  );
};