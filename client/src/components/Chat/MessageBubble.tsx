import React from 'react';
import { Message } from '../../types';
import { Check, CheckCheck, Clock, AlertCircle, Play, FileText, Image as ImageIcon } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  onRetry?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  onRetry,
  onReaction
}) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';
  const isRead = message.read || message.status === 'read';
  const isDelivered = message.delivered || message.status === 'delivered';

  return (
    <div className={`d-flex mb-2 ${isOutgoing ? 'justify-content-end' : 'justify-content-start'}`}>
      <div className={`message-bubble ${isOutgoing ? 'message-sent' : 'message-received'}`}>
        {/* Reply Quote Banner */}
        {message.replyToText && (
          <div className="message-reply-preview">
            {message.replyToSender && (
              <strong className="d-block text-truncate" style={{ fontSize: '0.78rem' }}>
                {message.replyToSender}
              </strong>
            )}
            <span className="text-truncate d-block">{message.replyToText}</span>
          </div>
        )}

        {/* Voice Note Payload */}
        {message.messageType === 'VOICE' && (
          <div className="d-flex align-items-center py-1">
            <button
              type="button"
              className="btn btn-sm btn-light rounded-circle p-1 mr-2 d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px' }}
              title="Play voice note"
            >
              <Play size={15} />
            </button>
            <div className="d-flex align-items-center flex-grow-1 mr-2">
              {[12, 18, 24, 16, 22, 28, 14, 20, 16, 10, 22, 14].map((h, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: `${h}px`,
                    backgroundColor: isOutgoing ? '#fff' : '#10b981',
                    opacity: 0.8,
                    borderRadius: '2px',
                    marginRight: '2px'
                  }}
                />
              ))}
            </div>
            <small style={{ opacity: 0.85 }}>0:{message.audioDurationSeconds || 8}</small>
          </div>
        )}

        {/* Image Attachment */}
        {message.messageType === 'IMAGE' && (
          <div className="rounded p-2 mb-1 bg-black bg-opacity-25 d-flex align-items-center">
            <ImageIcon size={28} className="mr-2" />
            <div>
              <div className="font-weight-bold small">{message.mediaName || 'Encrypted_Image.png'}</div>
              <small style={{ opacity: 0.75 }}>E2EE Encrypted Payload</small>
            </div>
          </div>
        )}

        {/* Document Attachment */}
        {message.messageType === 'DOCUMENT' && (
          <div className="rounded p-2 mb-1 bg-black bg-opacity-25 d-flex align-items-center">
            <FileText size={28} className="mr-2" />
            <div>
              <div className="font-weight-bold small">{message.mediaName || 'Document.pdf'}</div>
              <small style={{ opacity: 0.75 }}>1.2 MB · Verified Payload</small>
            </div>
          </div>
        )}

        {/* Text content */}
        {message.content && (message.messageType === 'TEXT' || !message.messageType) && (
          <div className="message-content">{message.content}</div>
        )}

        {/* Footer: timestamp, edited, delivery ticks */}
        <div
          className="d-flex align-items-center justify-content-end mt-1"
          style={{ fontSize: '0.75rem', opacity: 0.8 }}
        >
          {message.isEdited && <span className="font-italic mr-1">(edited)</span>}
          <span>{formattedTime}</span>

          {isOutgoing && (
            <span className="d-inline-flex align-items-center ml-1">
              {isFailed ? (
                <button
                  type="button"
                  onClick={() => onRetry && onRetry(message)}
                  className="btn btn-sm btn-link text-warning p-0 d-inline-flex align-items-center"
                  title="Retry sending"
                >
                  <AlertCircle size={13} className="mr-1" />
                  <span>Retry</span>
                </button>
              ) : isPending ? (
                <Clock size={13} />
              ) : isRead ? (
                <CheckCheck size={14} style={{ color: '#a7f3d0' }} />
              ) : isDelivered ? (
                <CheckCheck size={14} />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="d-flex flex-wrap mt-1">
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <span
                key={emoji}
                onClick={() => onReaction && onReaction(message.id, emoji)}
                className="badge badge-light mr-1 mb-1 px-1 py-0 cursor-pointer"
                style={{ fontSize: '0.72rem', cursor: 'pointer' }}
              >
                {emoji} {users.length}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
