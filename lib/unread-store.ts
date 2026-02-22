import { create } from 'zustand';

interface UnreadState {
  /** Per-user unread count (keyed by other user's ID) – for sidebar badges */
  unreadByUser: Record<string, number>;
  /** Per-room unread count */
  unreadByRoom: Record<string, number>;
  /** Maps DM roomId → the other user's ID */
  roomToUser: Record<string, string>;
  /** Currently viewed room – skip counting for this room */
  activeRoomId: string | null;

  /** Populate roomToUser mapping from existing rooms list */
  initFromRooms: (rooms: Array<{ id: string; type: string; members: Array<{ user: { id: string } }> }>, currentUserId: string) => void;
  /** Increment unread count for a room (and its mapped user) */
  incrementForRoom: (roomId: string) => void;
  /** Clear unread count for a room (and its mapped user) */
  clearForRoom: (roomId: string) => void;
  /** Set the currently active room */
  setActiveRoom: (roomId: string | null) => void;
  /** Get unread count for a specific user */
  getUnreadForUser: (userId: string) => number;
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreadByUser: {},
  unreadByRoom: {},
  roomToUser: {},
  activeRoomId: null,

  initFromRooms: (rooms, currentUserId) => {
    const roomToUser: Record<string, string> = {};
    for (const room of rooms) {
      if (room.type === 'DIRECT') {
        const other = room.members.find((m) => m.user.id !== currentUserId);
        if (other) {
          roomToUser[room.id] = other.user.id;
        }
      }
    }
    set({ roomToUser });
  },

  incrementForRoom: (roomId) => {
    const state = get();
    // Don't count if this is the active room
    if (state.activeRoomId === roomId) return;

    const newUnreadByRoom = {
      ...state.unreadByRoom,
      [roomId]: (state.unreadByRoom[roomId] || 0) + 1,
    };

    const userId = state.roomToUser[roomId];
    const newUnreadByUser = userId
      ? { ...state.unreadByUser, [userId]: (state.unreadByUser[userId] || 0) + 1 }
      : state.unreadByUser;

    set({ unreadByRoom: newUnreadByRoom, unreadByUser: newUnreadByUser });
  },

  clearForRoom: (roomId) => {
    const state = get();
    const { [roomId]: _, ...restRooms } = state.unreadByRoom;

    const userId = state.roomToUser[roomId];
    let newUnreadByUser = state.unreadByUser;
    if (userId) {
      const { [userId]: __, ...restUsers } = state.unreadByUser;
      newUnreadByUser = restUsers;
    }

    set({ unreadByRoom: restRooms, unreadByUser: newUnreadByUser });
  },

  setActiveRoom: (roomId) => {
    set({ activeRoomId: roomId });
    // Also clear unread for this room when setting it as active
    if (roomId) {
      get().clearForRoom(roomId);
    }
  },

  getUnreadForUser: (userId) => {
    return get().unreadByUser[userId] || 0;
  },
}));
