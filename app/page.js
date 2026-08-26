'use client';

import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import AuthPage from './components/AuthPage';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) return <div className="auth-overlay"><div className="gate-icon" style={{ fontSize: 32 }}>⏳</div></div>;
  if (!user) return <AuthPage />;

  return (
    <div className="app-shell">
      <Header />
      <ChatInterface />
    </div>
  );
}
