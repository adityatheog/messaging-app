import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Conversation } from '../../types';
import { ChatsList } from './ChatsList';
import { PeopleList } from './PeopleList';
import { ProfileModal } from '../Profile/ProfileModal';
import { getAvatarColor, getInitials } from '../../constants/config';
import {
  MessageSquare,
  Users,
  Search,
  X,
  LogOut,
  Settings,
  Circle
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  users: User[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  users,
  selectedUser,
  onSelectUser
}) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'chats' | 'people'>('chats');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  if (!user) return null;

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const userColor = getAvatarColor(user.id, user.avatarColor);

  return (
    <aside className="sidebar-pane">
      {/* Profile Header with Argon Gradient Band */}
      <div className="bg-gradient-primary text-white p-3 shadow-sm">
        <div className="d-flex align-items-center justify-content-between">
          <div
            className="d-flex align-items-center cursor-pointer"
            onClick={() => setIsProfileOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="position-relative mr-2">
              <div
                className="avatar-circle shadow-sm"
                style={{
                  width: '42px',
                  height: '42px',
                  fontSize: '16px',
                  backgroundColor: userColor
                }}
              >
                {getInitials(user.fullName || user.username)}
              </div>
              <span className="status-indicator-dot online" />
            </div>
            <div>
              <span className="font-weight-bold text-white d-block text-truncate" style={{ maxWidth: '140px' }}>
                {user.fullName || user.username}
              </span>
              <small className="text-white-50">@{user.username}</small>
            </div>
          </div>

          <div className="d-flex align-items-center">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="btn btn-sm btn-link text-white p-1 mr-1"
              title="Edit Profile"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={logout}
              className="btn btn-sm btn-link text-white p-1"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-white border-bottom">
        <div className="input-group input-group-alternative">
          <div className="input-group-prepend">
            <span className="input-group-text">
              <Search size={16} />
            </span>
          </div>
          <input
            type="text"
            className="form-control"
            placeholder={activeTab === 'chats' ? 'Search conversations...' : 'Search teammates...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div className="input-group-append">
              <button
                type="button"
                className="btn btn-link text-muted p-2"
                onClick={() => setSearchQuery('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Chats and People */}
      <div className="nav nav-pills nav-fill bg-white p-2 border-bottom">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`nav-link py-2 font-weight-bold d-flex align-items-center justify-content-center ${
            activeTab === 'chats' ? 'active bg-primary text-white shadow-sm' : 'text-muted'
          }`}
          style={{ borderRadius: '0.375rem', border: 'none' }}
        >
          <MessageSquare size={16} className="mr-1" />
          Chats
          {totalUnread > 0 && (
            <span className={`badge badge-pill ml-1 ${activeTab === 'chats' ? 'badge-white text-primary' : 'badge-primary text-white'}`}>
              {totalUnread}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`nav-link py-2 font-weight-bold d-flex align-items-center justify-content-center ${
            activeTab === 'people' ? 'active bg-primary text-white shadow-sm' : 'text-muted'
          }`}
          style={{ borderRadius: '0.375rem', border: 'none' }}
        >
          <Users size={16} className="mr-1" />
          People
          <span className={`badge badge-pill ml-1 ${activeTab === 'people' ? 'badge-white text-primary' : 'badge-secondary text-muted'}`}>
            {users.length}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'chats' ? (
        <ChatsList
          conversations={
            searchQuery
              ? conversations.filter(
                  (c) =>
                    c.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : conversations
          }
          selectedUser={selectedUser}
          onSelectUser={onSelectUser}
        />
      ) : (
        <PeopleList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={onSelectUser}
          searchQuery={searchQuery}
        />
      )}

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
};
