import { Server, Socket } from 'socket.io';


interface GlobalUser {

  id: string; // Socket ID
  userId: string;
  username: string;
  avatarUrl?: string;
  online: boolean;

}


const globalChatUsers = new Map<string, GlobalUser>();


export const handleJoinGlobalChat = (io: Server, socket: Socket, data: any) => {
  const { userId, username, avatarUrl } = data;

  const user: GlobalUser = {
    id: socket.id,
    userId,
    username,
    avatarUrl,
    online: true
  };

  // 1. Adiciona usuário ao mapa e à sala do chat global
  globalChatUsers.set(socket.id, user);
  socket.join('global-chat');

  // 2. Avisa a todos que um usuário entrou (Mensagem de Sistema)
  const systemMsg = {
    id: `sys_${Date.now()}`,
    userId: 'system',
    username: 'Sistema',
    text: `${username} entrou no chat!`,
    timestamp: Date.now(),
    type: 'system'
  };
  io.to('global-chat').emit('global-chat-message', systemMsg);

  // 3. Atualiza a lista de usuários para todos na sala
  broadcastUserList(io);
};

export const handleGlobalChatMessage = (io: Server, socket: Socket, data: any) => {
  const messagePayload = {
    ...data,
    id: `msg_${Date.now()}_${socket.id}`,
  };

  io.to('global-chat').emit('global-chat-message', messagePayload);
};

export const handleGlobalDisconnect = (io: Server, socket: Socket) => {
  if (globalChatUsers.has(socket.id)) {
    const user = globalChatUsers.get(socket.id);
    globalChatUsers.delete(socket.id);

    if (user) {
      // Avisa que saiu
      const systemMsg = {
        id: `sys_${Date.now()}`,
        userId: 'system',
        username: 'Sistema',
        text: `${user.username} saiu do chat.`,
        timestamp: Date.now(),
        type: 'system'
      };
      io.to('global-chat').emit('global-chat-message', systemMsg);
      
      // Atualiza a lista
      broadcastUserList(io);
    }
  }
};

// Função auxiliar para enviar a lista atualizada
const broadcastUserList = (io: Server) => {
  const usersList = Array.from(globalChatUsers.values());
  io.to('global-chat').emit('global-chat-users-list', { users: usersList });
};