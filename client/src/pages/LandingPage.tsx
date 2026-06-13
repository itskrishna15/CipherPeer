import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, ArrowRight, Copy, Check, Users, Moon, Sun } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LandingPageProps {
  onJoin: (roomCode: string, username: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onJoin, isDark, toggleTheme }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [username, setUsername] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 4; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `CP-${p1}-${p2}`;
    setGeneratedCode(code);
    setCopied(false);
    
    // Play celebratory micro-confetti
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#06b6d4', '#8b5cf6']
    });
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please choose a display name');
      return;
    }

    if (activeTab === 'create') {
      if (!generatedCode) {
        setError('Please generate a room code first');
        return;
      }
      onJoin(generatedCode, username.trim());
    } else {
      if (!roomCodeInput.trim()) {
        setError('Please enter a room code');
        return;
      }
      const cleanedCode = roomCodeInput.trim().toUpperCase();
      if (!/^CP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanedCode)) {
        setError('Invalid room code format (Should look like CP-XXXX-XXXX)');
        return;
      }
      onJoin(cleanedCode, username.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center relative overflow-hidden bg-grid-pattern px-4 transition-colors duration-300">
      {/* Interactive Cyber Glow Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-cyan/5 dark:bg-cyber-cyan/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-accent/5 dark:bg-cyber-accent/10 rounded-full blur-[120px] pointer-events-none animate-pulse delay-700"></div>

      {/* Theme and Security Headers */}
      <div className="absolute top-6 right-6 flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-all backdrop-blur-md shadow-sm"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Brand/Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyber-cyan to-cyber-accent flex items-center justify-center shadow-glow-cyan mb-4"
          >
            <Shield className="w-9 h-9 text-slate-950 stroke-[2.5]" />
          </motion.div>
          
          <motion.h1
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            Cipher<span className="text-cyber-cyan">Peer</span>
          </motion.h1>
          
          <motion.p
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-slate-600 dark:text-slate-400 mt-2 text-sm max-w-sm"
          >
            Decentralized P2P rooms with browser-based AI toxicity filters and zero message logs.
          </motion.p>
        </div>

        {/* Card Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden"
        >
          {/* Card Accent Lines */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyber-cyan to-cyber-accent"></div>

          {/* Form Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-950/80 rounded-2xl mb-8 border border-slate-200 dark:border-slate-900">
            <button
              onClick={() => {
                setActiveTab('create');
                setError('');
              }}
              className={`py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'create'
                  ? isDark
                    ? 'bg-gradient-to-r from-cyber-cyan/20 to-cyber-accent/20 text-white border border-cyber-cyan/30 shadow-glow-cyan'
                    : 'bg-white text-cyber-cyan border border-cyber-cyan/20 shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 border border-transparent'
                    : 'text-slate-500 hover:text-slate-800 border border-transparent'
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                setError('');
              }}
              className={`py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'join'
                  ? isDark
                    ? 'bg-gradient-to-r from-cyber-cyan/20 to-cyber-accent/20 text-white border border-cyber-cyan/30 shadow-glow-cyan'
                    : 'bg-white text-cyber-cyan border border-cyber-cyan/20 shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 border border-transparent'
                    : 'text-slate-500 hover:text-slate-800 border border-transparent'
              }`}
            >
              Join Room
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Alias</label>
              <input
                type="text"
                maxLength={16}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Neo, Trinity"
                className="w-full bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan outline-none rounded-xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all text-sm font-medium shadow-inner dark:shadow-none"
              />
            </div>

            {/* Conditional Tab Rendering */}
            {activeTab === 'create' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Generate Code</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between px-4 h-[50px] font-mono text-base tracking-wider text-cyber-cyan">
                      {generatedCode || <span className="text-slate-400 dark:text-slate-600 text-sm font-sans tracking-normal font-normal">Generate a secure room code...</span>}
                      {generatedCode && (
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="text-slate-400 hover:text-cyber-cyan transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-5 h-[50px] font-semibold text-sm transition-all flex items-center justify-center"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Secure Room Code</label>
                <div className="relative">
                  <Key className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    placeholder="CP-XXXX-XXXX"
                    className="w-full bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan outline-none rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all font-mono tracking-wider text-sm shadow-inner dark:shadow-none"
                  />
                </div>
              </div>
            )}

            {/* Error alerts */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl font-medium"
              >
                {error}
              </motion.div>
            )}

            {/* Join Action Button */}
            <button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-cyber-cyan to-cyber-accent text-slate-950 font-extrabold rounded-xl shadow-glow-cyan hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group text-sm uppercase tracking-wider"
            >
              {activeTab === 'create' ? 'Launch Room' : 'Join Session'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform stroke-[2.5]" />
            </button>
          </form>
        </motion.div>

        {/* Security badges footer */}
        <div className="mt-8 flex justify-center items-center gap-6 text-xs text-slate-500 font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyber-cyan" />
            Local TFJS Scanning
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyber-accent" />
            End-to-End P2P (WebRTC)
          </div>
        </div>

        {/* Copyright Footer */}
        <div className="mt-8 text-center text-[10px] font-mono text-slate-500 dark:text-slate-600 tracking-wider">
          <p>© 2026 Made by <span className="text-cyber-cyan font-bold hover:text-cyber-accent transition-colors duration-300">Krishna Kumar Sharma</span>. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
