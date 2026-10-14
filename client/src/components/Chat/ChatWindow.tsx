import React, { useEffect, useRef } from 'react';
import { User, Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { getAvatarColor, getInitials } from '../../constants/config';
import { Shield, ArrowLeft, Lock, Phone } from 'lucide-react';

interface ChatWindowProps {
  selectedUser: User | null;
  messages: Message[];
  currentUserId: string;
  isTyping?: boolean;
  onSendMessage: (content: string, type?: string, mediaName?: string) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
  onRetryMessage?: (message: Message) => void;
  onBackToList?: () => void;
  loadingMessages?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  selectedUser,
  messages,
  currentUserId,
  isTyping,
  onSendMessage,
  onTyping,
  onRetryMessage,
  onBackToList,
  loadingMessages
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!selectedUser) {
    return (
      <div className="chat-window d-flex align-items-center justify-content-center p-4">
        <div className="text-center" style={{ maxWidth: '420px' }}>
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle p-4 mb-3"
            style={{ width: '80px', height: '80px', backgroundColor: '#161b22', border: '1px solid #30363d' }}
          >
            <Shield size={38} className="text-success" />
          </div>
          <h4 className="font-weight-bold text-white mb-2">SimpleLink Private Messaging</h4>
          <p className="text-muted small">
            Select a pairwise channel from the sidebar or use the Pairwise tab to exchange invitation links and QR codes.
          </p>
          <div className="badge-simplex d-inline-block">
            Double-Ratchet E2EE · No Permanent IDs
          </div>
        </div>
      </div>
    );
  }

  const recipientColor = getAvatarColor(selectedUser.id, selectedUser.avatarColor);

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div
        className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between"
        style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
      >
        <div className="d-flex align-items-center">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="btn btn-sm btn-link text-muted p-2 mr-2 d-md-none"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="position-relative mr-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white font-weight-bold"
              style={{
                width: '42px',
                height: '42px',
                fontSize: '15px',
                backgroundColor: recipientColor
              }}
            >
              {getInitials(selectedUser.fullName || selectedUser.username)}
            </div>
            <span
              className="online-indicator position-absolute"
              style={{
                bottom: 0,
                right: 0,
                backgroundColor: selectedUser.isOnline ? '#10b981' : '#8b949e'
              }}
            />
          </div>

          <div>
            <div className="d-flex align-items-center">
              <h6 className="font-weight-bold text-white mb-0 d-block text-truncate mr-2" style={{ maxWidth: '240px' }}>
                {selectedUser.fullName || selectedUser.username}
              </h6>
              <span className="badge-simplex" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                Verified E2EE
              </span>
            </div>
            <small className="d-flex align-items-center text-muted" style={{ fontSize: '0.75rem' }}>
              <Lock size={10} className="text-success mr-1" />
              <span>{selectedUser.isOnline ? 'Online · Pairwise Ratchet' : 'Offline · Pairwise Ratchet'}</span>
            </small>
          </div>
        </div>

        <div className="d-flex align-items-center">
          <button
            type="button"
            className="btn btn-sm btn-link text-success p-2"
            title="Start Encrypted Voice Call"
            onClick={() => alert(`Initiating encrypted P2P audio call with ${selectedUser.fullName || selectedUser.username}...`)}
          >
            <Phone size={18} />
          </button>
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-grow-1 overflow-auto p-3 p-md-4">
        {loadingMessages ? (
          <div className="d-flex justify-content-center align-items-center h-100 text-muted">
            <div className="spinner-border spinner-border-sm mr-2 text-success" role="status" />
            Synchronizing encrypted messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <Shield size={36} className="text-success mb-2 opacity-50" />
            <p className="font-weight-bold mb-1 text-white">Encrypted Pairwise Channel Established</p>
            <small className="text-muted">Send an encrypted text, voice note, or attachment below.</small>
          </div>
        ) : (
          <div>
            {messages.map((msg, index) => {
              const isOutgoing = msg.senderId === currentUserId;
              const prevMsg = messages[index - 1];
              const showDateSeparator =
                !prevMsg ||
                new Date(msg.timestamp).toDateString() !==
                  new Date(prevMsg.timestamp).toDateString();

              return (
                <React.Fragment key={msg.id || msg.clientMsgId || index}>
                  {showDateSeparator && (
                    <div className="text-center my-3">
                      <span
                        className="badge px-3 py-1 font-weight-normal text-muted"
                        style={{ backgroundColor: '#21262d', border: '1px solid #30363d' }}
                      >
                        {new Date(msg.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOutgoing={isOutgoing}
                    onRetry={onRetryMessage}
                  />
                </React.Fragment>
              );
            })}

            {isTyping && (
              <div className="d-flex justify-content-start mb-2">
                <div
                  className="py-1 px-3 rounded-pill text-muted small"
                  style={{ backgroundColor: '#21262d', border: '1px solid #30363d' }}
                >
                  <span className="font-italic mr-1">@{selectedUser.username} is typing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Composer Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        disabled={loadingMessages}
      />
    </div>
  );
};
