import React, { useEffect, useRef, useState } from 'react';
import { User, Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput, AttachmentMetadata } from './MessageInput';
import { getAvatarColor, getInitials } from '../../constants/config';
import { Shield, ArrowLeft, Lock, Phone } from 'lucide-react';

interface ChatWindowProps {
  selectedUser: User | null;
  messages: Message[];
  currentUserId: string;
  isTyping?: boolean;
  hasOlderMessages?: boolean;
  loadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onSendMessage: (
    content: string,
    type?: Message['messageType'],
    mediaName?: string,
    attachment?: AttachmentMetadata
  ) => Promise<boolean>;
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
  hasOlderMessages,
  loadingOlderMessages,
  onLoadOlderMessages,
  onSendMessage,
  onTyping,
  onRetryMessage,
  onBackToList,
  loadingMessages
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  useEffect(() => {
    setCallNotice(null);
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current);
      }
    };
  }, []);

  if (!selectedUser) {
    return (
      <div className="chat-window d-flex align-items-center justify-content-center p-4">
        <div className="text-center" style={{ maxWidth: '380px' }}>
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle p-3 mb-3"
            style={{ width: '64px', height: '64px', backgroundColor: '#161b22', border: '1px solid #30363d' }}
          >
            <Shield size={30} className="text-success" />
          </div>
          <h5 className="font-weight-bold text-white mb-2">No chat selected</h5>
          <p className="text-muted small mb-0">
            Choose a conversation from the sidebar or start a new chat.
          </p>
        </div>
      </div>
    );
  }

  const recipientColor = getAvatarColor(selectedUser.id, selectedUser.avatarColor);

  const handleStartCall = () => {
    if (callTimerRef.current) clearTimeout(callTimerRef.current);
    setCallNotice(`Calling ${selectedUser.fullName || selectedUser.username}...`);
    callTimerRef.current = setTimeout(() => {
      setCallNotice(null);
    }, 3000);
  };

  return (
    <div className="chat-window">
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
            </div>
            <small className="d-flex align-items-center text-muted" style={{ fontSize: '0.75rem' }}>
              <Lock size={10} className="text-success mr-1" />
              <span>{callNotice || (selectedUser.isOnline ? 'Online' : 'Offline')}</span>
            </small>
          </div>
        </div>

        <div className="d-flex align-items-center">
          <button
            type="button"
            className="btn btn-sm btn-link text-success p-2"
            title="Start Voice Call"
            onClick={handleStartCall}
          >
            <Phone size={18} />
          </button>
        </div>
      </div>

      <div className="flex-grow-1 overflow-auto p-3 p-md-4">
        {loadingMessages ? (
          <div className="d-flex justify-content-center align-items-center h-100 text-muted">
            <div className="spinner-border spinner-border-sm mr-2 text-success" role="status" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <Shield size={36} className="text-success mb-2 opacity-50" />
            <p className="font-weight-bold mb-1 text-white">No messages here yet</p>
            <small className="text-muted">Say hello to start the conversation.</small>
          </div>
        ) : (
          <div>
            {hasOlderMessages && onLoadOlderMessages && (
              <div className="text-center mb-3">
                <button
                  type="button"
                  disabled={loadingOlderMessages}
                  onClick={onLoadOlderMessages}
                  className="btn btn-sm btn-outline-secondary text-light"
                >
                  {loadingOlderMessages ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}

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

      <MessageInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        disabled={loadingMessages}
      />
    </div>
  );
};
