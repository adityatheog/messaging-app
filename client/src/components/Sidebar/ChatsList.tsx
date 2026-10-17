import React from 'react';
import { Conversation, User } from '../../types';
import { getAvatarColor, getInitials } from '../../constants/config';
import { MessageSquare } from 'lucide-react';

interface ChatsListProps {
  conversations: Conversation[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
}

export const ChatsList: React.FC<ChatsListProps> = ({
  conversations,
  selectedUser,
  onSelectUser
}) => {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted my-auto">
        <MessageSquare size={36} className="text-muted mb-2 opacity-50" />
        <p className="mb-1 font-weight-bold text-white">No chats yet</p>
        <small className="text-muted">Start a conversation when you're ready.</small>
      </div>
    );
  }

  return (
    <div className="list-group list-group-flush flex-grow-1 overflow-auto">
      {conversations.map((conv) => {
        const isSelected = selectedUser?.id === conv.user.id;
        const color = getAvatarColor(conv.user.id, conv.user.avatarColor);
        const timeFormatted = new Date(conv.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <button
            key={conv.user.id}
            type="button"
            onClick={() => onSelectUser(conv.user)}
            className={`list-group-item list-group-item-action border-0 px-3 py-3 d-flex align-items-center text-left ${
              isSelected ? 'active-chat-row' : ''
            }`}
            style={{
              borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent',
              cursor: 'pointer'
            }}
          >
            <div className="position-relative mr-3 flex-shrink-0">
              <div
                className="avatar-circle shadow-sm"
                style={{
                  width: '44px',
                  height: '44px',
                  fontSize: '16px',
                  backgroundColor: color
                }}
              >
                {getInitials(conv.user.fullName || conv.user.username)}
              </div>
              <span
                className={`status-indicator-dot ${conv.user.isOnline ? 'online' : 'offline'}`}
              />
            </div>

            <div className="flex-grow-1 min-w-0">
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <span className="font-weight-bold text-white text-truncate d-block" style={{ maxWidth: '140px' }}>
                  {conv.user.fullName || conv.user.username}
                </span>
                <small className="text-muted font-weight-600">{timeFormatted}</small>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted text-truncate d-block" style={{ maxWidth: '170px' }}>
                  {conv.lastMessage.content}
                </small>
                {conv.unreadCount > 0 && (
                  <span className="badge badge-success badge-pill ml-2 px-2 py-1">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
