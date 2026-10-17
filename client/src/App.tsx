import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { ChatApp } from './pages/ChatApp';
import { AuthCard } from './components/Auth/AuthCard';

const MainRouting: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center" style={{ backgroundColor: '#0d1117' }}>
        <div className="spinner-border text-success mb-3" style={{ width: '2.5rem', height: '2.5rem' }} role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="text-muted small">Connecting...</p>
      </div>
    );
  }

  if (currentPath === '/' && !user) {
    return <LandingPage onOpenApp={() => navigateTo('/app')} />;
  }

  if (!user) {
    return <AuthCard onBackToLanding={() => navigateTo('/')} />;
  }

  return <ChatApp />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainRouting />
    </AuthProvider>
  );
};

export default App;
