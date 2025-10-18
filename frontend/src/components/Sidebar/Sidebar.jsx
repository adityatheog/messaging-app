import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../services/api';
import { LogOut, MessageCircle } from 'lucide-react';
import SearchBar from './SearchBar';
import UserList from './UserList';

const Sidebar = ({ selectedUser, onSelectUser }) => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      const data = await usersAPI.getAll();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full md:w-80 bg-white border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-purple-500">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8" />
            <div>
              <h2 className="font-bold text-lg">{user?.fullName || user?.username}</h2>
              <p className="text-sm text-blue-100">@{user?.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-white/20 rounded-lg transition"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {/* User List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <UserList 
          users={filteredUsers} 
          selectedUser={selectedUser} 
          onSelectUser={onSelectUser} 
        />
      )}
    </div>
  );
};

export default Sidebar;