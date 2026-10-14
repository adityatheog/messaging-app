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
  Shield,
  QrCode,
  Copy,
  Check
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
  const [activeTab, setActiveTab] = useState<'chats' | 'people' | 'connections'>('chats');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!user) return null;

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const userColor = getAvatarColor(user.id, user.avatarColor);
  const inviteLink = `simplelink:invite?code=sx-${user.id.slice(0, 8)}&user=${user.username}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <aside className="sidebar">
      {/* SimpleLink Profile & Security Header */}
      <div className="p-3 border-bottom" style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}>
        <div className="d-flex align-items-center justify-content-between">
          <div
            className="d-flex align-items-center cursor-pointer"
            onClick={() => setIsProfileOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="position-relative mr-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white font-weight-bold"
                style={{
                  width: '40px',
                  height: '40px',
                  fontSize: '15px',
                  backgroundColor: userColor
                }}
              >
                {getInitials(user.fullName || user.username)}
              </div>
              <span className="online-indicator position-absolute" style={{ bottom: 0, right: 0 }} />
            </div>
            <div>
              <div className="d-flex align-items-center">
                <span className="font-weight-bold text-white d-block text-truncate" style={{ maxWidth: '160px' }}>
                  {user.fullName || user.username}
                </span>
              </div>
              <small className="text-muted">@{user.username}</small>
            </div>
          </div>

          <div className="d-flex align-items-center">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="btn btn-sm btn-link text-muted p-1 mr-1"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={logout}
              className="btn btn-sm btn-link text-muted p-1"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-bottom" style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}>
        <div className="position-relative">
          <input
            type="text"
            className="form-control form-control-sm pl-4"
            placeholder={
              activeTab === 'chats'
                ? 'Search chats...'
                : activeTab === 'people'
                ? 'Search contacts...'
                : 'Search...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={14} className="position-absolute text-muted" style={{ left: '10px', top: '10px' }} />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-link text-muted p-0 position-absolute"
              style={{ right: '10px', top: '6px' }}
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Chats, People, Invite */}
      <div className="d-flex border-bottom" style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}>
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex-grow-1 py-2 font-weight-bold btn btn-sm rounded-0 border-0 ${
            activeTab === 'chats' ? 'text-success border-bottom border-success' : 'text-muted'
          }`}
          style={{ borderBottomWidth: activeTab === 'chats' ? '2px' : '0' }}
        >
          <MessageSquare size={14} className="mr-1" />
          Chats
          {totalUnread > 0 && (
            <span className="badge badge-pill badge-success ml-1" style={{ fontSize: '0.65rem' }}>
              {totalUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`flex-grow-1 py-2 font-weight-bold btn btn-sm rounded-0 border-0 ${
            activeTab === 'people' ? 'text-success border-bottom border-success' : 'text-muted'
          }`}
          style={{ borderBottomWidth: activeTab === 'people' ? '2px' : '0' }}
        >
          <Users size={14} className="mr-1" />
          People
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connections')}
          className={`flex-grow-1 py-2 font-weight-bold btn btn-sm rounded-0 border-0 ${
            activeTab === 'connections' ? 'text-success border-bottom border-success' : 'text-muted'
          }`}
          style={{ borderBottomWidth: activeTab === 'connections' ? '2px' : '0' }}
        >
          <QrCode size={14} className="mr-1" />
          Invite
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-grow-1 overflow-auto">
        {activeTab === 'chats' && (
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
        )}

        {activeTab === 'people' && (
          <PeopleList
            users={users}
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'connections' && (
          <div className="p-3">
            <div className="card p-3 mb-3" style={{ backgroundColor: '#21262d', borderColor: '#30363d' }}>
              <div className="d-flex align-items-center mb-2">
                <QrCode size={18} className="text-success mr-2" />
                <h6 className="mb-0 font-weight-bold text-white">Invite a Contact</h6>
              </div>
              <p className="small text-muted mb-2">
                Share your invite link to start a private, end-to-end encrypted conversation.
              </p>
              <div
                className="p-2 rounded font-monospace small mb-3 text-truncate text-success"
                style={{ backgroundColor: '#0d1117', fontSize: '0.75rem' }}
              >
                {inviteLink}
              </div>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="btn btn-sm btn-success d-flex align-items-center justify-content-center"
              >
                {copiedLink ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                {copiedLink ? 'Link copied!' : 'Copy invite link'}
              </button>
            </div>

            <div className="card p-3" style={{ backgroundColor: '#21262d', borderColor: '#30363d' }}>
              <div className="d-flex align-items-center mb-2">
                <Shield size={18} className="text-success mr-2" />
                <h6 className="mb-0 font-weight-bold text-white">Direct & Private</h6>
              </div>
              <p className="small text-muted mb-0">
                You can chat directly without exchanging phone numbers, email addresses, or social accounts.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
};
