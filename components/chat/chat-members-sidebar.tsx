'use client';

import { ChatRoom } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatMembersSidebarProps {
  room: ChatRoom;
  onlineUsers: Set<string>;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ChatMembersSidebar({ room, onlineUsers }: ChatMembersSidebarProps) {
  const { user } = useAuthStore();

  const onlineMembers = room.members.filter((m) => onlineUsers.has(m.user.id));
  const offlineMembers = room.members.filter((m) => !onlineUsers.has(m.user.id));

  if (room.type === 'DIRECT') {
    return null;
  }

  return (
    <div className="w-full bg-[hsl(var(--layout-card))] h-full border-l border-[hsl(var(--layout-border))]">
      <ScrollArea className="h-full py-4">
        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <div className="px-4 mb-4">
            <h4 className="text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase mb-2">
              Online — {onlineMembers.length}
            </h4>
            <div className="space-y-1">
              {onlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[hsl(var(--layout-card-hover))]/50 cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.user.avatar} />
                      <AvatarFallback className="bg-blue-500 text-white text-xs">
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[hsl(var(--layout-card))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        member.user.id === user?.id ? 'text-blue-400' : 'text-[hsl(var(--text-primary))]'
                      )}
                    >
                      {member.user.name}
                      {member.user.id === user?.id && ' (you)'}
                    </p>
                    {member.user.role && (
                      <p className="text-xs text-[hsl(var(--text-secondary))] truncate">{member.user.role}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline Members */}
        {offlineMembers.length > 0 && (
          <div className="px-4">
            <h4 className="text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase mb-2">
              Offline — {offlineMembers.length}
            </h4>
            <div className="space-y-1">
              {offlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[hsl(var(--layout-card-hover))]/50 cursor-pointer opacity-60"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.user.avatar} />
                      <AvatarFallback className="bg-blue-500 text-white text-xs">
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-500 rounded-full border-2 border-[hsl(var(--layout-card))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        member.user.id === user?.id ? 'text-blue-400' : 'text-[hsl(var(--text-primary))]'
                      )}
                    >
                      {member.user.name}
                      {member.user.id === user?.id && ' (you)'}
                    </p>
                    {member.user.role && (
                      <p className="text-xs text-[hsl(var(--text-secondary))] truncate">{member.user.role}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
