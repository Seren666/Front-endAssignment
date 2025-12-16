//Vite 的配置文件，用来告诉 Vite 怎么启动和打包项目
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
})

