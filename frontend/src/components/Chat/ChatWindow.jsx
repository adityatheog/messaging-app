import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { messagesAPI } from '../../services/api';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { MessageCircle } from 'lucide-react';

const ChatWindow = ({ selectedUser }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Id of the conversation currently on screen. Responses for any other conversation are dropped.
  const activeUserIdRef = useRef(null);

  // Use useCallback to memoize fetchMessages function
  const fetchMessages = useCallback(async () => {
    if (!selectedUser) return;
    const requestedFor = selectedUser.id;

    try {
      const data = await messagesAPI.getConversation(requestedFor);
      // Ignore a late response that belongs to a conversation the user already left
      if (activeUserIdRef.current !== requestedFor) return;
      // Keep the same array when nothing changed so polling does not re-render
      // (and re-scroll to the bottom) every 3 seconds
      setMessages((prev) =>
        prev.length === data.length && prev[prev.length - 1]?.id === data[data.length - 1]?.id
          ? prev
          : data
      );
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [selectedUser]);

  useEffect(() => {
    activeUserIdRef.current = selectedUser ? selectedUser.id : null;
    // Never show the previous conversation under the new user's header
    setMessages([]);

    if (selectedUser) {
      fetchMessages();
      // Poll for new messages every 3 seconds
      const interval = setInterval(fetchMessages, 3000);
      return () => {
        clearInterval(interval);
        activeUserIdRef.current = null;
      };
    }
  }, [selectedUser, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Resolves true on success so MessageInput only clears the text once the message was really sent
  const handleSendMessage = async (content) => {
    if (!selectedUser || !content.trim()) return false;

    setLoading(true);
    try {
      await messagesAPI.send({
        receiverId: selectedUser.id,
        content
      });
      
      // Fetch updated messages
      await fetchMessages();
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      // A 401 already reset the session (back to login); don't alert on top of that
      if (error.response?.status !== 401) {
        alert(error.response?.data?.error || 'Failed to send message. Please try again.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Welcome to Messaging App
          </h3>
          <p className="text-gray-500">
            Select a user from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b p-4 flex items-center gap-3 shadow-sm">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full ${getAvatarColor(selectedUser.id)} flex items-center justify-center text-white font-semibold`}>
            {getInitials(selectedUser.fullName || selectedUser.username)}
          </div>
          {selectedUser.isOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">
            {selectedUser.fullName || selectedUser.username}
          </h3>
          <p className="text-sm text-gray-500">
            {selectedUser.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSent={message.senderId === user.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} disabled={loading} />
    </div>
  );
};

export default ChatWindow;