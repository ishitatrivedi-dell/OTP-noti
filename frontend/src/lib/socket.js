import { io } from 'socket.io-client'
import { SOCKET_URL } from './config'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
    })
  }
  return socket
}

export function emitUserAction(action, payload = {}) {
  const s = getSocket()
  s.emit('user-action', { action, ...payload })
}

