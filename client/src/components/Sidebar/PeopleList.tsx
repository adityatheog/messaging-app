import React from 'react';
import { User } from '../../types';
import { getAvatarColor, getInitials } from '../../constants/config';
import { Users } from 'lucide-react';

interface PeopleListProps {
  users: User[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  searchQuery: string;
}

export const PeopleList: React.FC<PeopleListProps> = ({
  users,
  selectedUser,
  onSelectUser,
  searchQuery
}) => {
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.fullName && u.fullName.toLowerCase().includes(q))
    );
  });

  if (filteredUsers.length === 0) {
    return (
      <div className="p-4 text-center text-muted my-auto">
        <Users size={36} className="text-muted mb-2 opacity-50" />
        <p className="mb-1 font-weight-bold text-white">
          {searchQuery ? 'No contacts found' : 'No contacts yet'}
        </p>
        <small className="text-muted">
          {searchQuery ? 'Check the spelling or try a different search.' : 'People you connect with will appear here.'}
        </small>
      </div>
    );
  }

  return (
    <div className="list-group list-group-flush flex-grow-1 overflow-auto">
      {filteredUsers.map((user) => {
        const isSelected = selectedUser?.id === user.id;
        const color = getAvatarColor(user.id, user.avatarColor);

        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelectUser(user)}
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
                {getInitials(user.fullName || user.username)}
              </div>
              <span
                className={`status-indicator-dot ${user.isOnline ? 'online' : 'offline'}`}
              />
            </div>

            <div className="flex-grow-1 min-w-0">
              <span className="font-weight-bold text-white text-truncate d-block">
                {user.fullName || user.username}
              </span>
              <div className="d-flex align-items-center">
                <small className="text-muted mr-2">@{user.username}</small>
                <small className={`font-weight-600 ${user.isOnline ? 'text-success' : 'text-muted'}`}>
                  • {user.isOnline ? 'Online' : 'Offline'}
                </small>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
