import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTyping,
  disabled
}) => {
  const [text, setText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (onTyping) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending || disabled) return;

    if (onTyping) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      onTyping(false);
    }

    setSending(true);
    const success = await onSendMessage(clean);
    if (success) {
      setText('');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setText(prompt);
  };

  return (
    <div className="bg-white border-top p-3 safe-bottom">
      {/* Quick response chips */}
      <div className="d-flex flex-wrap mb-2 pb-1">
        {['Sounds great! 👍', 'Let’s review the specs', 'Working on it right now!'].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleQuickPrompt(chip)}
            className="btn btn-sm btn-secondary mr-2 mb-1 py-1 px-2 font-weight-normal text-muted"
            style={{ fontSize: '0.8rem', minHeight: 'auto' }}
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="d-flex align-items-center">
        <div className="input-group input-group-alternative flex-grow-1 mr-2 shadow-sm">
          <div className="input-group-prepend">
            <span className="input-group-text">
              <MessageSquare size={16} />
            </span>
          </div>
          <input
            type="text"
            className="form-control"
            placeholder="Type a message... (Enter to send)"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          disabled={!text.trim() || sending || disabled}
          className="btn btn-primary d-flex align-items-center justify-content-center px-3"
          style={{ height: 'calc(2.75rem + 2px)', width: '48px', flexShrink: 0 }}
          title="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
