import React, { useEffect, useRef } from 'react';
import { User, Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { getAvatarColor, getInitials } from '../../constants/config';
import { MessageSquare, ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
  selectedUser: User | null;
  messages: Message[];
  currentUserId: string;
  isTyping?: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
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
      <div className="chat-pane d-flex align-items-center justify-content-center p-4">
        <div className="text-center" style={{ maxWidth: '400px' }}>
          <div
            className="d-inline-flex align-items-center justify-content-center bg-white text-primary rounded-circle p-4 mb-3 shadow"
            style={{ width: '80px', height: '80px' }}
          >
            <MessageSquare size={36} />
          </div>
          <h3 className="font-weight-bold text-dark mb-2">Welcome to Messaging App</h3>
          <p className="text-muted">
            Select a conversation from the sidebar or find a teammate in the People tab to start chatting.
          </p>
        </div>
      </div>
    );
  }

  const recipientColor = getAvatarColor(selectedUser.id, selectedUser.avatarColor);

  return (
    <div className="chat-pane">
      {/* Chat Header with Gradient Top Bar */}
      <div className="bg-white border-bottom px-3 py-2 shadow-sm d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="btn btn-sm btn-link text-muted p-2 mr-2 d-md-none"
              title="Back to conversations"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="position-relative mr-3">
            <div
              className="avatar-circle shadow-sm"
              style={{
                width: '44px',
                height: '44px',
                fontSize: '16px',
                backgroundColor: recipientColor
              }}
            >
              {getInitials(selectedUser.fullName || selectedUser.username)}
            </div>
            <span
              className={`status-indicator-dot ${selectedUser.isOnline ? 'online' : 'offline'}`}
            />
          </div>

          <div>
            <h5 className="font-weight-bold text-dark mb-0 d-block text-truncate" style={{ maxWidth: '240px' }}>
              {selectedUser.fullName || selectedUser.username}
            </h5>
            <small className="d-flex align-items-center">
              <span className="text-muted mr-1">@{selectedUser.username}</span>
              <span className={`font-weight-600 ${selectedUser.isOnline ? 'text-success' : 'text-muted'}`}>
                • {selectedUser.isOnline ? 'Active Now' : 'Offline'}
              </span>
            </small>
          </div>
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-grow-1 overflow-auto p-3 p-md-4">
        {loadingMessages ? (
          <div className="d-flex justify-content-center align-items-center h-100 text-muted">
            <div className="spinner-border spinner-border-sm mr-2 text-primary" role="status" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <MessageSquare size={36} className="text-muted mb-2 opacity-50" />
            <p className="font-weight-bold mb-1">No messages yet</p>
            <small>Send a message below to start the conversation!</small>
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
                      <span className="badge badge-secondary text-muted px-3 py-1 font-weight-normal shadow-none">
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

            {/* Live Typing Indicator Bubble */}
            {isTyping && (
              <div className="d-flex justify-content-start mb-3">
                <div className="message-bubble-incoming py-2 px-3 d-flex align-items-center">
                  <span className="small text-muted mr-2 font-italic">
                    {selectedUser.fullName || selectedUser.username} is typing
                  </span>
                  <div className="spinner-grow spinner-grow-sm text-primary" style={{ width: '6px', height: '6px' }} />
                  <div className="spinner-grow spinner-grow-sm text-primary mx-1" style={{ width: '6px', height: '6px' }} />
                  <div className="spinner-grow spinner-grow-sm text-primary" style={{ width: '6px', height: '6px' }} />
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
