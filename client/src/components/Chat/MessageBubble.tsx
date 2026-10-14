import React from 'react';
import { Message } from '../../types';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  onRetry?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOutgoing, onRetry }) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';
  const isRead = message.read || message.status === 'read';
  const isDelivered = message.delivered || message.status === 'delivered';

  return (
    <div className={`d-flex mb-3 ${isOutgoing ? 'justify-content-end' : 'justify-content-start'}`}>
      <div className={isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming'}>
        <div className="message-content mb-1" style={{ fontSize: '0.9375rem', lineHeight: '1.45' }}>
          {message.content}
        </div>
        <div
          className={`d-flex align-items-center justify-content-end ${
            isOutgoing ? 'message-time text-white-50' : 'message-time text-muted'
          }`}
        >
          <span className="mr-1">{formattedTime}</span>

          {isOutgoing && (
            <span className="d-inline-flex align-items-center ml-1">
              {isFailed ? (
                <button
                  type="button"
                  onClick={() => onRetry && onRetry(message)}
                  className="btn btn-sm btn-link text-warning p-0 d-inline-flex align-items-center"
                  title="Retry sending"
                  style={{ textDecoration: 'none' }}
                >
                  <AlertCircle size={13} className="mr-1" />
                  <span style={{ fontSize: '0.7rem' }}>Retry</span>
                </button>
              ) : isPending ? (
                <span title="Sending...">
                  <Clock size={13} className="text-white-50" />
                </span>
              ) : isRead ? (
                <span title="Read">
                  <CheckCheck size={14} style={{ color: '#11cdef' }} />
                </span>
              ) : isDelivered ? (
                <span title="Delivered">
                  <CheckCheck size={14} className="text-white" />
                </span>
              ) : (
                <span title="Sent">
                  <Check size={14} className="text-white-50" />
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
