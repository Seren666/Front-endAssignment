import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { BoardPage } from './pages/BoardPage';
import { network } from './services/socket';

function App() {
  // ✨ 防止 React 严格模式导致执行两次连接
  const hasConnected = useRef(false);

  useEffect(() => {
    // 只有第一次才执行连接
    if (!hasConnected.current) {
      network.connect();
      hasConnected.current = true;
    }

    // 页面卸载时断开
    return () => {
      network.disconnect();
      hasConnected.current = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;