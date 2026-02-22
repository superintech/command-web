'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/auth-store';
import { useUnreadStore } from '@/lib/unread-store';
import { toast } from '@/hooks/use-toast';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface MentionNotification {
  roomId: string;
  messageId: string;
  senderName: string;
  content: string;
  roomName?: string;
}

export function ChatNotificationProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken || !user) return;

    // Connect to socket for notifications
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Notification socket connected');
    });

    socket.on('mention-notification', (data: MentionNotification) => {
      // Show toast notification for mentions
      toast({
        title: `@${data.senderName} mentioned you`,
        description: data.roomName
          ? `in #${data.roomName}: "${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}"`
          : `"${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}"`,
        duration: 5000,
      });

      // Play notification sound (if available)
      try {
        const audio = new Audio('/sounds/mention.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Ignore audio play errors (user might not have interacted with page yet)
        });
      } catch {
        // Ignore if audio not available
      }
    });

    // Listen for unread-message events to update sidebar badges
    socket.on('unread-message', (data: { roomId: string; senderId: string; messageId: string }) => {
      // Skip messages from ourselves
      if (data.senderId === user.id) return;
      // Skip if this room is currently active (user is reading it)
      const { activeRoomId, incrementForRoom } = useUnreadStore.getState();
      if (data.roomId === activeRoomId) return;
      incrementForRoom(data.roomId);
    });

    socket.on('disconnect', () => {
      console.log('Notification socket disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, user]);

  return <>{children}</>;
}
