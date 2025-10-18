import React, { useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import ChatWindow from '../Chat/ChatWindow';

const MainLayout = () => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar 
        selectedUser={selectedUser} 
        onSelectUser={setSelectedUser} 
      />
      <ChatWindow selectedUser={selectedUser} />
    </div>
  );
};

export default MainLayout;