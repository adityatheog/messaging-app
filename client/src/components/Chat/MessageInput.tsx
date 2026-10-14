import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, FileText } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string, type?: string, mediaName?: string) => Promise<boolean>;
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
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
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
    const success = await onSendMessage(clean, 'TEXT');
    if (success) {
      setText('');
    }
    setSending(false);
  };

  const handleSendVoice = async () => {
    setSending(true);
    await onSendMessage('🎤 Encrypted voice note', 'VOICE');
    setSending(false);
  };

  const handleSendFile = async (type: 'IMAGE' | 'DOCUMENT') => {
    setShowAttachMenu(false);
    setSending(true);
    if (type === 'IMAGE') {
      await onSendMessage('📷 Encrypted photo attachment', 'IMAGE', 'Photo_E2EE.jpg');
    } else {
      await onSendMessage('📄 Encrypted protocol document', 'DOCUMENT', 'Security_Spec.pdf');
    }
    setSending(false);
  };

  return (
    <div className="p-3 border-top" style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}>
      {/* Quick response chips */}
      <div className="d-flex flex-wrap mb-2">
        {['Safety numbers verified ✅', 'Reviewing protocol spec', 'Voice call online 📞'].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setText(chip)}
            className="btn btn-sm mr-2 mb-1 py-1 px-2 text-muted"
            style={{ fontSize: '0.75rem', backgroundColor: '#21262d', border: '1px solid #30363d' }}
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="d-flex align-items-center position-relative">
        {/* Attachment menu trigger */}
        <div className="position-relative mr-2">
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="btn btn-sm btn-link text-muted p-2"
            title="Attach Media or File"
          >
            <Paperclip size={18} />
          </button>

          {showAttachMenu && (
            <div
              className="position-absolute shadow-lg rounded p-2"
              style={{
                bottom: '100%',
                left: 0,
                backgroundColor: '#21262d',
                border: '1px solid #30363d',
                zIndex: 1050,
                width: '180px'
              }}
            >
              <button
                type="button"
                onClick={() => handleSendFile('IMAGE')}
                className="btn btn-sm btn-block text-left text-light d-flex align-items-center mb-1"
              >
                <ImageIcon size={15} className="mr-2 text-success" />
                <span>Send Photo</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendFile('DOCUMENT')}
                className="btn btn-sm btn-block text-left text-light d-flex align-items-center"
              >
                <FileText size={15} className="mr-2 text-success" />
                <span>Send Document</span>
              </button>
            </div>
          )}
        </div>

        <input
          type="text"
          className="form-control mr-2"
          placeholder="Type an end-to-end encrypted message..."
          value={text}
          onChange={handleTextChange}
          disabled={disabled || sending}
          autoComplete="off"
        />

        {text.trim() ? (
          <button
            type="submit"
            disabled={sending || disabled}
            className="btn btn-primary d-flex align-items-center justify-content-center"
            style={{ width: '42px', height: '42px' }}
            title="Send"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSendVoice}
            disabled={sending || disabled}
            className="btn btn-outline-primary d-flex align-items-center justify-content-center"
            style={{ width: '42px', height: '42px' }}
            title="Record Voice Note"
          >
            <Mic size={18} />
          </button>
        )}
      </form>
    </div>
  );
};
