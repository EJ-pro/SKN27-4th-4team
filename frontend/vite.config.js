import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const VIDEO_BASE = path.resolve('운동_3D영상')

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  plugins: [
    react(),
    {
      name: 'serve-exercise-videos',
      configureServer(server) {
        server.middlewares.use('/videos', (req, res, next) => {
          try {
            const decoded = decodeURIComponent(req.url)
            const filePath = path.join(VIDEO_BASE, decoded)
            if (!filePath.startsWith(VIDEO_BASE)) { next(); return }
            if (fs.existsSync(filePath)) {
              const stat = fs.statSync(filePath)
              const range = req.headers.range
              if (range) {
                const parts = range.replace(/bytes=/, '').split('-')
                const start = parseInt(parts[0], 10)
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
                const chunkSize = end - start + 1
                res.writeHead(206, {
                  'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': chunkSize,
                  'Content-Type': 'video/mp4',
                })
                fs.createReadStream(filePath, { start, end }).pipe(res)
              } else {
                res.setHeader('Content-Type', 'video/mp4')
                res.setHeader('Content-Length', stat.size)
                res.setHeader('Accept-Ranges', 'bytes')
                fs.createReadStream(filePath).pipe(res)
              }
            } else {
              next()
            }
          } catch { next() }
        })
      }
    }
  ],
})
