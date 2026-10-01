import React from 'react';
import { formatMessageTime } from '../../utils/helpers';

const MessageBubble = ({ message, isSent }) => {
  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
          isSent
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <p className="break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isSent ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;