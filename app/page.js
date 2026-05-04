import Header from './components/Header';
import ChatInterface from './components/ChatInterface';

export default function HomePage() {
  return (
    <div className="app-shell">
      <Header />
      <ChatInterface />
    </div>
  );
}
