import React, { useRef, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type DrawEvent = { x: number; y: number; t: 'start' | 'move' | 'end' }

const socket: Socket = io('http://localhost:3000')

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color] = useState('#111')
  const [name, setName] = useState('')
  const [room, setRoom] = useState('lobby')
  const [messages, setMessages] = useState<string[]>([])
  const joinedRef = useRef(false)

  useEffect(() => {
    socket.on('chat', (msg: string) => setMessages(m => [...m, msg]))
    socket.on('draw', (ev: DrawEvent) => remoteDraw(ev))
    socket.on('drawHistory', (events: DrawEvent[]) => {
      // replace local canvas with history replay
      clearCanvas()
      events.forEach(ev => drawOnCanvas(ev, false))
    })
    socket.on('clearCanvas', () => clearCanvas())
    socket.on('disconnect', () => clearCanvas())
    return () => {
      socket.off('chat')
      socket.off('draw')
      socket.off('drawHistory')
      socket.off('clearCanvas')
      socket.off('disconnect')
    }
  }, [])

  // Auto-join a default room on mount so multiple tabs see each other's drawings
  useEffect(() => {
    if (joinedRef.current) return
    const defaultName = localStorage.getItem('skribbl_name') || `Guest${Math.floor(Math.random()*1000)}`
    setName(defaultName)
    socket.emit('joinRoom', { name: defaultName, room })
    localStorage.setItem('skribbl_name', defaultName)
    joinedRef.current = true
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = c.clientWidth * devicePixelRatio
    c.height = c.clientHeight * devicePixelRatio
    const ctx = c.getContext('2d')!
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = color
  }, [color])

  const join = () => {
    if (!name) return alert('Enter name')
    // Wipe local board when switching rooms
    clearCanvas()
    socket.emit('joinRoom', { name, room })
  }

  const sendChat = (text: string) => {
    if (!text) return
    socket.emit('chat', text)
    setMessages(m => [...m, `You: ${text}`])
  }

  const getCtx = () => canvasRef.current!.getContext('2d')!

  const clearCanvas = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    // clear considering devicePixelRatio scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    // reapply scale and stroke settings
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = color
  }

  const localDraw = (e: React.MouseEvent, t: DrawEvent['t']) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left)
    const y = (e.clientY - rect.top)
    const ev = { x, y, t }
    socket.emit('draw', ev)
    drawOnCanvas(ev, true)
  }

  const remoteDraw = (ev: DrawEvent) => drawOnCanvas(ev, false)

  const drawOnCanvas = (ev: DrawEvent, isLocal: boolean) => {
    const ctx = getCtx()
    if (ev.t === 'start') {
      ctx.beginPath()
      ctx.moveTo(ev.x, ev.y)
    } else if (ev.t === 'move') {
      ctx.lineTo(ev.x, ev.y)
      ctx.stroke()
    } else if (ev.t === 'end') {
      ctx.closePath()
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h3>Skribbl MVP</h3>
        <div>
          <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <input placeholder="Room" value={room} onChange={e=>setRoom(e.target.value)} />
        </div>
        <button onClick={join}>Join Room</button>
        <div style={{marginTop:12}}>
          <h4>Chat</h4>
          <div style={{height:200,overflow:'auto',border:'1px solid #eee',padding:8}}>
            {messages.map((m,i)=>(<div key={i}>{m}</div>))}
          </div>
          <ChatInput onSend={sendChat} />
        </div>
      </div>
      <div className="canvasWrap">
        <div className="controls">
          <span>Brush: 3px</span>
        </div>
        <div style={{flex:1,padding:8}}>
          <canvas ref={canvasRef} style={{width:'100%',height:500}}
            onMouseDown={(e)=>{setIsDrawing(true); localDraw(e,'start')}}
            onMouseMove={(e)=>{ if(isDrawing) localDraw(e,'move')}}
            onMouseUp={(e)=>{ setIsDrawing(false); localDraw(e,'end')}}
            onMouseLeave={(e)=>{ if(isDrawing){ setIsDrawing(false); localDraw(e,'end')}}}
          />
        </div>
      </div>
    </div>
  )
}

function ChatInput({onSend}:{onSend:(s:string)=>void}){
  const [text,setText] = useState('')
  return (
    <div style={{marginTop:8}}>
      <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type..." />
      <button onClick={()=>{onSend(text); setText('')}}>Send</button>
    </div>
  )
}
