import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { BoardPage } from './pages/BoardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 默认路径：显示登录页 */}
        <Route path="/" element={<LoginPage />} />
        
        {/* 画板路径 */}
        <Route path="/board" element={<BoardPage />} />
        
        {/* 任何未知路径重定向回登录页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;