import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: '*'}
})

// In-memory per-room draw history (ordered events). Bounded to avoid memory growth.
const roomHistory = new Map<string, DrawEvent[]>()
const MAX_HISTORY = 20000

type DrawEvent = { x:number; y:number; t: 'start'|'move'|'end'; color?: string }

io.on('connection', socket => {
  console.log('conn', socket.id)

  socket.on('joinRoom', ({name, room}:{name:string, room:string})=>{
    // Leave previous app-managed room (if any) so a socket is in only one room
    const prevRoom = socket.data.room as string | undefined
    if (prevRoom && prevRoom !== room) {
      socket.leave(prevRoom)
      socket.to(prevRoom).emit('chat', `${socket.data.name||'Someone'} left the room`)
    }
    socket.join(room)
    socket.data.name = name
    socket.data.room = room
    socket.emit('chat', `Welcome ${name} to ${room}`)
    // Send existing draw history for the room so the joining client sees the current board
    const history = roomHistory.get(room) || []
    if (history.length) socket.emit('drawHistory', history)
    socket.to(room).emit('chat', `${name} joined the room`)
  })

  socket.on('chat', (msg:string) => {
    const room = socket.data.room as string | undefined
    if (room) io.to(room).emit('chat', `${socket.data.name||'Anon'}: ${msg}`)
  })

  socket.on('draw', (ev: DrawEvent) => {
    const room = socket.data.room as string | undefined
    if (room) {
      // Broadcast to others in the room
      socket.to(room).emit('draw', ev)
      // Store event in room history
      const arr = roomHistory.get(room) || []
      arr.push(ev)
      // Enforce max size
      if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY)
      roomHistory.set(room, arr)
    }
  })

  socket.on('disconnect', ()=>{
    console.log('dc', socket.id)
    const room = socket.data.room as string | undefined
    if (room) {
      socket.to(room).emit('chat', `${socket.data.name||'Someone'} disconnected`)
    }
  })
})

app.get('/', (req, res) => res.send('Skribbl MVP backend'))

const PORT = process.env.PORT || 3000
server.listen(PORT, ()=> console.log('listening on', PORT))
