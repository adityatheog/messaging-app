import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { uploadsAPI } from '../../services/api';
import { Send, Paperclip, Mic, Image as ImageIcon, FileText } from 'lucide-react';

export interface AttachmentMetadata {
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  audioDurationSeconds?: number | null;
}

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type?: Message['messageType'],
    mediaName?: string,
    attachment?: AttachmentMetadata
  ) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTyping,
  disabled
}) => {
  const [text, setText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [pendingType, setPendingType] = useState<'IMAGE' | 'DOCUMENT'>('IMAGE');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    await onSendMessage('Voice message', 'VOICE', undefined, { audioDurationSeconds: 8 });
    setSending(false);
  };

  const handleChooseAttachment = (type: 'IMAGE' | 'DOCUMENT') => {
    setShowAttachMenu(false);
    setPendingType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === 'IMAGE' ? 'image/png,image/jpeg,image/gif,image/webp' : 'application/pdf,text/plain';
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSending(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const { attachment } = await uploadsAPI.upload({
        fileName: file.name,
        mimeType: file.type || (pendingType === 'IMAGE' ? 'image/png' : 'application/pdf'),
        dataBase64
      });
      await onSendMessage(
        pendingType === 'IMAGE' ? 'Photo' : 'Document',
        pendingType,
        attachment.originalName,
        {
          mediaUrl: attachment.url,
          mediaName: attachment.originalName,
          mediaSize: attachment.sizeBytes
        }
      );
    } catch {
      await onSendMessage(
        pendingType === 'IMAGE' ? 'Photo' : 'Document',
        pendingType,
        file.name
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 border-top" style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <form onSubmit={handleSubmit} className="d-flex align-items-center position-relative">
        <div className="position-relative mr-2">
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="btn btn-sm btn-link text-muted p-2"
            title="Attach file"
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
                onClick={() => handleChooseAttachment('IMAGE')}
                className="btn btn-sm btn-block text-left text-light d-flex align-items-center mb-1"
              >
                <ImageIcon size={15} className="mr-2 text-success" />
                <span>Send Photo</span>
              </button>
              <button
                type="button"
                onClick={() => handleChooseAttachment('DOCUMENT')}
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
          placeholder="Write a message..."
          value={text}
          onChange={handleTextChange}
          disabled={disabled || sending}
          autoComplete="off"
          style={{
            backgroundColor: '#0d1117',
            borderColor: '#30363d',
            color: '#f0f6fc',
            borderRadius: '20px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}
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
