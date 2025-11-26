import { Server, Socket } from 'socket.io';


export const handleJoinLobbyChat = (socket: Socket, data: any) => {
  socket.join('lobby-chat');
  socket.emit('lobby-chat-system-msg', { text: 'Você entrou no chat da fila.' });
};


export const handleLeaveLobbyChat = (socket: Socket) => {
  socket.leave('lobby-chat');
};


export const handleLobbyChatMessage = (io: Server, socket: Socket, data: any) => {
  const { text, username, avatarUrl } = data;

  const messagePayload = {
    id: `lmsg_${Date.now()}_${socket.id}`,
    userId: socket.id,
    username,
    avatarUrl,
    text,
    timestamp: Date.now(),
    type: 'message'
  };

  io.to('lobby-chat').emit('lobby-chat-message', messagePayload);
};