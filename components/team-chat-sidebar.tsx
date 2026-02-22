'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { useUnreadStore } from '@/lib/unread-store';
import { useSocket, useOnlineUsers } from '@/hooks/use-socket';
import { chatApi, usersApi, ChatRoom, ChatMessage, User } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamChatSidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function TeamChatSidebar({ expanded, onToggle }: TeamChatSidebarProps) {
  const { user, accessToken } = useAuthStore();
  const onlineUsers = useOnlineUsers();
  const { unreadByUser, initFromRooms, clearForRoom, setActiveRoom } = useUnreadStore();

  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tempIdCounter = useRef(0);

  // Fetch team members
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  // Fetch rooms (for unread store initialization)
  const { data: roomsData } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: () => chatApi.getRooms(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000,
  });

  const teamMembers = (usersData?.data || []).filter((u) => u.id !== user?.id);
  const rooms = roomsData?.data || [];

  // Initialize unread store with room→user mappings
  useEffect(() => {
    if (rooms.length > 0 && user) {
      initFromRooms(rooms, user.id);
    }
  }, [rooms, user, initFromRooms]);

  // Socket connection with message handler
  const { joinRoom, leaveRoom, sendMessage: socketSendMessage, isConnected } = useSocket({
    onMessage: useCallback((message: ChatMessage) => {
      if (!activeChatRoom) return;
      if (message.roomId !== activeChatRoom.id) return;

      setMessages((prev) => {
        // Deduplicate: if sender is current user and we have a temp message, replace it
        if (message.senderId === user?.id) {
          const tempIdx = prev.findIndex(
            (m) => m.id.startsWith('temp-') && m.senderId === user?.id
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = message;
            return updated;
          }
        }
        // Avoid duplicates by ID
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    }, [activeChatRoom, user?.id]),
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (activeChatUser && expanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeChatUser, expanded]);

  // Open a DM with a user
  const openChat = async (targetUser: User) => {
    if (!accessToken) return;
    setActiveChatUser(targetUser);
    setLoadingMessages(true);

    try {
      const roomRes = await chatApi.getOrCreateDM(targetUser.id, accessToken);
      const room = roomRes.data;
      setActiveChatRoom(room);

      // Join the socket room
      joinRoom(room.id);

      // Mark as read
      clearForRoom(room.id);
      setActiveRoom(room.id);

      // Load messages
      const msgsRes = await chatApi.getMessages(room.id, accessToken, { limit: 50 });
      setMessages(msgsRes.data || []);
    } catch (error) {
      console.error('Failed to open chat:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Close active chat
  const closeChat = () => {
    if (activeChatRoom) {
      leaveRoom();
      setActiveRoom(null);
    }
    setActiveChatUser(null);
    setActiveChatRoom(null);
    setMessages([]);
  };

  // Send message with optimistic update
  const handleSend = () => {
    if (!messageInput.trim() || !activeChatRoom || !user) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Optimistic: append temp message immediately
    const tempId = `temp-${++tempIdCounter.current}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      content,
      roomId: activeChatRoom.id,
      senderId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, avatar: user.avatar },
    };
    setMessages((prev) => [...prev, tempMessage]);

    // Send via socket
    socketSendMessage(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Find room for a user (to get unread count)
  const getRoomForUser = (userId: string) => {
    return rooms.find(
      (r) => r.type === 'DIRECT' && r.members.some((m) => m.user.id === userId)
    );
  };

  // ─── COLLAPSED VIEW ───────────────────────────────────────
  if (!expanded) {
    return (
      <TooltipProvider delayDuration={200}>
        <aside className="w-16 bg-[hsl(var(--layout-card))] border-l border-[hsl(var(--layout-border))] hidden lg:flex flex-col h-full shrink-0">
          {/* Expand button */}
          <div className="flex justify-center py-3 border-b border-[hsl(var(--layout-border))]">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                  onClick={onToggle}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expand chat</TooltipContent>
            </Tooltip>
          </div>

          {/* Avatar list */}
          <ScrollArea className="flex-1 py-2">
            <div className="flex flex-col items-center gap-2">
              {teamMembers.map((member) => {
                const isOnline = onlineUsers.has(member.id);
                const unread = unreadByUser[member.id] || 0;

                return (
                  <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="relative group"
                        onClick={() => {
                          onToggle();
                          // Small delay so sidebar expands before opening chat
                          setTimeout(() => openChat(member), 150);
                        }}
                      >
                        <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-blue-500/50 transition-colors">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-blue-500/20 text-blue-400 text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online dot */}
                        <span
                          className={cn(
                            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[hsl(var(--layout-card))]',
                            isOnline ? 'bg-green-500' : 'bg-slate-500'
                          )}
                        />
                        {/* Unread badge */}
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <span>{member.name}</span>
                      {unread > 0 && (
                        <span className="ml-1 text-red-400">({unread} new)</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </ScrollArea>
        </aside>
      </TooltipProvider>
    );
  }

  // ─── EXPANDED VIEW ────────────────────────────────────────
  return (
    <aside className="w-80 bg-[hsl(var(--layout-card))] border-l border-[hsl(var(--layout-border))] hidden lg:flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-[hsl(var(--layout-border))] shrink-0">
        {activeChatUser ? (
          <>
            <button
              onClick={closeChat}
              className="flex items-center gap-2 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium truncate max-w-[150px]">
                {activeChatUser.name}
              </span>
            </button>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  onlineUsers.has(activeChatUser.id) ? 'bg-green-500' : 'bg-slate-500'
                )}
              />
              <span className="text-xs text-[hsl(var(--text-secondary))]">
                {onlineUsers.has(activeChatUser.id) ? 'Online' : 'Offline'}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Team Chat
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
              onClick={onToggle}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {activeChatUser ? (
        /* ─── CHAT VIEW ─── */
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[hsl(var(--text-secondary))]">
                <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Say hello!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isOwn = msg.senderId === user?.id;
                  const isTemp = msg.id.startsWith('temp-');
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex gap-2', isOwn && 'flex-row-reverse')}
                    >
                      {!isOwn && (
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={msg.sender?.avatar} />
                          <AvatarFallback className="bg-blue-500/20 text-blue-400 text-[10px]">
                            {msg.sender ? getInitials(msg.sender.name) : '?'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-xl px-3 py-1.5',
                          isOwn
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-[hsl(var(--layout-bg))] text-[hsl(var(--text-primary))] rounded-tl-sm',
                          isTemp && 'opacity-70'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <p className={cn(
                          'text-[10px] mt-0.5',
                          isOwn ? 'text-blue-200' : 'text-[hsl(var(--text-secondary))]'
                        )}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="p-2 border-t border-[hsl(var(--layout-border))] shrink-0">
            <div className="flex gap-1.5">
              <Input
                ref={inputRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 h-9 text-sm bg-[hsl(var(--layout-bg))] border-[hsl(var(--layout-border))] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-secondary))]"
              />
              <Button
                size="icon"
                className="h-9 w-9 bg-blue-500 hover:bg-blue-600 shrink-0"
                onClick={handleSend}
                disabled={!messageInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* ─── USER LIST VIEW ─── */
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {teamMembers.map((member) => {
              const isOnline = onlineUsers.has(member.id);
              const unread = unreadByUser[member.id] || 0;

              return (
                <button
                  key={member.id}
                  onClick={() => openChat(member)}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--layout-card-hover))] hover:text-[hsl(var(--text-primary))] transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="bg-blue-500/20 text-blue-400 text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--layout-card))]',
                        isOnline ? 'bg-green-500' : 'bg-slate-500'
                      )}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs opacity-60 truncate">
                      {member.designation || member.role}
                    </p>
                  </div>
                  {unread > 0 && (
                    <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px]">
                      {unread > 9 ? '9+' : unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
