import React from 'react';
import { getInitials, getAvatarColor } from '../../utils/helpers';

const UserList = ({ users, selectedUser, onSelectUser }) => {
  if (users.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
        No users found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {users.map((user) => (
        <div
          key={user.id}
          onClick={() => onSelectUser(user)}
          className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 transition ${
            selectedUser?.id === user.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
          }`}
        >
          <div className="relative">
            <div className={`w-12 h-12 rounded-full ${getAvatarColor(user.id)} flex items-center justify-center text-white font-semibold`}>
              {getInitials(user.fullName || user.username)}
            </div>
            {user.isOnline && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate">
              {user.fullName || user.username}
            </h3>
            <p className="text-sm text-gray-500 truncate">@{user.username}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;