import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' })
]

const stop = () => children.forEach(child => child.kill('SIGTERM'))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach(child => child.on('exit', code => {
  if (code && code !== 0) process.exitCode = code
}))
