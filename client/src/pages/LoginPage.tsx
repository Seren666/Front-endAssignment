import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Palette, Lock, User, Hash, AlertCircle, 
  PlusCircle, LogIn, Eye, EyeOff // ✨ 引入眼睛图标
} from 'lucide-react';
import classNames from 'classnames';

export const LoginPage = () => {
  const navigate = useNavigate();
  
  const [isCreating, setIsCreating] = useState(false); 
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ✨ 新增：控制密码是否可见
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = 'CollabCanvas - 入口';
  }, []);

  const validatePassword = (pwd: string) => {
    const regex = /^[a-zA-Z0-9!@#$%^&*]{6}$/;
    return regex.test(pwd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !roomId.trim()) {
      setErrorMsg('请填写完整的昵称和房间号');
      return;
    }

    if (!validatePassword(password)) {
      setErrorMsg('密码格式错误');
      return;
    }

    navigate('/board', { 
      state: { 
        username, 
        roomId, 
        password,
        mode: isCreating ? 'create' : 'join' 
      } 
    });
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)',
        backgroundSize: '40px 40px'
      }}></div>

      <div className="z-10 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-300">
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 transform hover:rotate-6 transition-transform">
            <Palette size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            CollabCanvas
          </h1>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button 
            className={classNames("flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2", !isCreating ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            onClick={() => { setIsCreating(false); setErrorMsg(''); }}
          >
            <LogIn size={16}/> 加入房间
          </button>
          <button 
            className={classNames("flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2", isCreating ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            onClick={() => { setIsCreating(true); setErrorMsg(''); }}
          >
            <PlusCircle size={16}/> 创建房间
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. 房间号 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              {isCreating ? '设置新房间号' : '输入房间号'}
            </label>
            <div className="relative">
              <Hash size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder={isCreating ? "例如: My-Project-01" : "例如: 1024"}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          {/* 2. 昵称 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              您的昵称
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如: 设计师小王"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          {/* 3. 密码 (含眼睛按钮) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
              {isCreating ? '设置访问密码' : '输入房间密码'}
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                // ✨ 动态切换 type
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入6位密码"
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-gray-50 focus:bg-white font-mono tracking-widest"
                maxLength={6}
              />
              
              {/* ✨ 眼睛按钮 */}
              <button
                type="button" // 必须写 type="button"，否则会触发表单提交
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                tabIndex={-1} // 防止 tab 键误触
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100 text-[10px] text-gray-500 leading-tight">
              <p>密码规则：</p>
              <ul className="list-disc list-inside ml-1">
                <li>必须正好 6 位字符</li>
                <li>允许：数字、大小写字母、特殊符号</li>
              </ul>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-200 mt-6"
          >
            {isCreating ? '立即创建并进入' : '验证并加入'}
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};