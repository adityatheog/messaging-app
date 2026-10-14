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
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-page">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="text-muted font-weight-600">Loading Messaging App...</p>
      </div>
    );
  }

  // If path is root "/" and user is not in the app, display Landing Page
  if (currentPath === '/' && !user) {
    return <LandingPage onOpenApp={() => navigateTo('/app')} />;
  }

  // If in /app (or any other path) and unauthenticated, show AuthCard
  if (!user) {
    return <AuthCard onBackToLanding={() => navigateTo('/')} />;
  }

  // Authenticated chat application
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
