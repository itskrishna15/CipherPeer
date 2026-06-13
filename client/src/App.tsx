import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';

function App() {
  const [roomCode, setRoomCode] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(true);

  const handleJoin = (code: string, name: string) => {
    setRoomCode(code);
    setUsername(name);
  };

  const handleLeave = () => {
    setRoomCode('');
    setUsername('');
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Sync dark/light class with root document
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDark]);

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 font-sans ${
      isDark ? 'bg-cyber-dark text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {roomCode && username ? (
        <ChatPage
          roomCode={roomCode}
          username={username}
          onLeave={handleLeave}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />
      ) : (
        <LandingPage
          onJoin={handleJoin}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}

export default App;
