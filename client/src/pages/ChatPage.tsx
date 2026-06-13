import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Paperclip, Shield, ShieldAlert, LogOut, Copy, Check, 
  Image, Video, File, Download, ChevronDown, ChevronUp, Sun, Moon 
} from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { formatBytes } from '../utils/fileHelper';
import { ModerationResult } from '../ai/moderationPipeline';

interface ChatPageProps {
  roomCode: string;
  username: string;
  onLeave: () => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ 
  roomCode, 
  username, 
  onLeave, 
  isDark, 
  toggleTheme 
}) => {
  const {
    peers,
    messages,
    aiStatus,
    isAiReady,
    sendMessage,
    sendFile
  } = useWebRTC(roomCode, username);

  const [inputText, setInputText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Track open detail HUDs for blocked messages
  // messageId -> boolean
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // State to manage the cybersecurity warning modal
  const [activeBlockModal, setActiveBlockModal] = useState<{ text: string; result: ModerationResult } | null>(null);
  const [detailedAssessmentOpen, setDetailedAssessmentOpen] = useState(false);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const currentInput = inputText;
    setInputText(''); // Snappy UI input clear
    const result = await sendMessage(currentInput);
    if (result.isBlocked) {
      setActiveBlockModal({ text: currentInput, result });
    }
  };

  // Cybersecurity Warning Modal Helpers
  const getThreatLevel = (score: number, isCritical: boolean) => {
    if (isCritical || score >= 0.95) {
      return { 
        label: 'CRITICAL', 
        color: 'text-red-500 border-red-500/35 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]' 
      };
    }
    if (score >= 0.8) {
      return { 
        label: 'HIGH', 
        color: 'text-orange-500 border-orange-500/35 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]' 
      };
    }
    if (score >= 0.6) {
      return { 
        label: 'MEDIUM', 
        color: 'text-yellow-500 border-yellow-500/35 bg-yellow-500/10' 
      };
    }
    return { 
      label: 'LOW', 
      color: 'text-cyan-500 border-cyan-500/35 bg-cyan-500/10' 
    };
  };

  const getDetectedCategories = (result: ModerationResult) => {
    const categories: string[] = [];
    const flagged = result.details.toxicLabelsFlagged || [];
    if (flagged.includes('toxicity') || flagged.includes('severe_toxicity')) categories.push('Toxicity');
    if (flagged.includes('insult')) categories.push('Insult');
    if (flagged.includes('identity_attack')) categories.push('Hate Speech');
    if (flagged.includes('threat')) categories.push('Threat');
    if (result.details.spamScore > 0.4) categories.push('Spam');
    if (result.details.phishingScore > 0.4) categories.push('Suspicious Link');
    if (result.details.illegalScore > 0.4) categories.push('Prohibited Activities');
    return categories;
  };

  const getAiExplanation = (result: ModerationResult) => {
    const details = result.details;
    if (details.illegalScore >= 1.0) {
      return "Message blocked due to critical violations of security guidelines regarding weapons, coordinate attacks, or extreme violence.";
    }
    if (details.toxicityScore >= 0.85 || (details.toxicLabelsFlagged && details.toxicLabelsFlagged.length > 0)) {
      return "Message blocked due to high toxicity confidence, offensive slang usage, or abusive language patterns.";
    }
    if (details.phishingScore >= 0.6) {
      return "Suspicious URL structural anomalies identified. Blocked to prevent exposure to potential credential harvesting or phishing scams.";
    }
    if (details.spamScore >= 0.5) {
      return "Message blocked due to signature spam patterns including excessive shouting, key phrase match, or character repetitions.";
    }
    return "Message blocked due to suspicious language patterns and local policy violations.";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      sendFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleBlockDetails = (msgId: string) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col relative bg-grid-pattern h-screen overflow-hidden transition-colors duration-300">
      
      {/* Top Banner Header */}
      <header className="h-16 border-b border-slate-200 dark:border-cyber-border bg-white/80 dark:bg-cyber-card/80 backdrop-blur-md px-6 flex items-center justify-between relative z-20 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyber-cyan to-cyber-accent flex items-center justify-center shadow-glow-cyan">
            <Shield className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-extrabold text-md tracking-tight leading-none text-slate-900 dark:text-white">CipherPeer</h2>
            <span className="text-[10px] text-cyber-cyan font-bold tracking-wider uppercase">P2P Secured room</span>
          </div>
        </div>

        {/* Room Code HUD */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-cyber-border rounded-lg py-1.5 px-3 font-mono text-xs tracking-wider text-slate-700 dark:text-slate-300">
            <span className="text-slate-500">ROOM:</span>
            <span className="text-cyber-cyan font-semibold">{roomCode}</span>
            <button
              onClick={handleCopyCode}
              className="ml-2 text-slate-400 hover:text-cyber-cyan transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Exit */}
          <button
            onClick={onLeave}
            className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg py-2 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar - Peer list & AI panel */}
        <aside className="w-64 border-r border-slate-200 dark:border-cyber-border bg-white/60 dark:bg-cyber-card/40 backdrop-blur-md hidden md:flex flex-col z-10 select-none transition-colors duration-300">
          {/* AI Status Card */}
          <div className="p-4 border-b border-slate-200 dark:border-cyber-border">
            <div className="bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-cyber-border rounded-xl p-4 flex flex-col items-center text-center">
              {isAiReady ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <Shield className="w-5 h-5 text-green-400 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">AI MODERATION ACTIVE</h4>
                  <p className="text-[10px] text-green-600 dark:text-green-400/80 font-medium mt-1">Local TFJS Toxicity Shield Active</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center mb-3 animate-spin duration-1000">
                    <Shield className="w-5 h-5 text-cyber-cyan" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">LOADING AI SHIELD</h4>
                  <p className="text-[10px] text-cyber-cyan font-medium mt-1 truncate max-w-full px-1">{aiStatus}</p>
                </>
              )}
            </div>
          </div>

          {/* Active Peers Directory */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Tunnel Mesh ({peers.length + 1})</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>

            <div className="space-y-3">
              {/* Local User */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-cyber-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-cyber-cyan/25 flex items-center justify-center font-bold text-cyber-cyan text-xs">
                    ME
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{username}</p>
                    <span className="text-[9px] text-slate-500">Signaling Server</span>
                  </div>
                </div>
              </div>

              {/* Connected Peers */}
              {peers.map((peer) => (
                <div key={peer.socketId} className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-cyber-border transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-cyber-accent/25 flex items-center justify-center font-bold text-cyber-accent text-xs">
                      {peer.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{peer.username}</p>
                      <span className="text-[9px] text-cyber-cyan font-semibold block uppercase">
                        {peer.connectionState === 'connected' ? 'P2P TUNNEL SECURED' : 'CONNECTING...'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {peers.length === 0 && (
                <div className="text-center py-8 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Waiting for other peers to join this room code...</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Copyright Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-cyber-border text-center text-[10px] font-mono text-slate-500 dark:text-slate-600 tracking-wider">
            <p>© 2026 Made by <span className="text-cyber-cyan font-bold hover:text-cyber-accent transition-colors duration-300">Krishna Kumar Sharma</span>. All rights reserved.</p>
          </div>
        </aside>

        {/* Chat Feed Panel */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Scrollable messages container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                if (msg.isSystem) {
                  // System announcement bubble
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center"
                    >
                      <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-950/50 border border-slate-900 rounded-full py-1 px-4 backdrop-blur-md">
                        {msg.text}
                      </span>
                    </motion.div>
                  );
                }

                // Normal message
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] sm:max-w-[60%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      {/* Name Header */}
                      <span className="text-[10px] font-bold text-slate-500 mb-1 px-2">
                        {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Message Bubble Content */}
                      {msg.isBlocked ? (
                        // Local Moderation Warning Bubble
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl shadow-glow-purple flex flex-col gap-2 relative overflow-hidden backdrop-blur-sm">
                          <div className="flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-red-500 stroke-[2] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-wider text-red-500">MESSAGE BLOCKED BY LOCAL SHIELD</p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-300 mt-1 italic">"{msg.text}"</p>
                              <p className="text-[11px] text-slate-650 dark:text-slate-400 mt-1.5">
                                This message was blocked locally and was <strong>not transmitted</strong> due to suspicious elements.
                              </p>
                            </div>
                          </div>

                          {/* Block analysis HUD */}
                          <div className="border-t border-red-500/25 mt-2 pt-2">
                            <button
                              onClick={() => toggleBlockDetails(msg.id)}
                              className="text-[10px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1"
                            >
                              {expandedBlocks[msg.id] ? (
                                <>Hide Analysis Logs <ChevronUp className="w-3 h-3" /></>
                              ) : (
                                <>View AI Threat Assessment <ChevronDown className="w-3 h-3" /></>
                              )}
                            </button>

                            {expandedBlocks[msg.id] && msg.blockDetails && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="mt-2 text-[10px] font-semibold font-mono bg-slate-950/80 border border-red-500/20 p-2.5 rounded-lg text-slate-400 space-y-1.5"
                              >
                                <div className="text-red-500">Hazard Rating: {msg.blockDetails.score * 100}%</div>
                                <div>Toxicity Confidence: {msg.blockDetails.details.toxicityScore * 100}%</div>
                                <div>Spam Heuristics: {msg.blockDetails.details.spamScore * 100}%</div>
                                <div>Phishing URL Match: {msg.blockDetails.details.phishingScore * 100}%</div>
                                <div>Prohibited/Abusive Language: {msg.blockDetails.details.illegalScore * 100}%</div>
                                {msg.blockDetails.reasons.length > 0 && (
                                  <div className="border-t border-slate-900 mt-1 pt-1">
                                    <div className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Detection Logs:</div>
                                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 mt-0.5">
                                      {msg.blockDetails.reasons.map((r, i) => (
                                        <li key={i}>{r}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      ) : msg.file ? (
                        // File Bubble
                        <div className="bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-cyber-border p-3.5 rounded-2xl flex flex-col gap-3.5 min-w-[200px] w-full backdrop-blur-md shadow-sm dark:shadow-none">
                          
                          {/* Image preview inline */}
                          {msg.file.isComplete && msg.file.type.startsWith('image/') && msg.file.url ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-cyber-border group max-h-60 bg-slate-100 dark:bg-slate-900">
                              <img 
                                src={msg.file.url} 
                                alt={msg.file.name}
                                className="w-full object-contain max-h-60"
                              />
                            </div>
                          ) : null}

                          {/* Video player inline */}
                          {msg.file.isComplete && msg.file.type.startsWith('video/') && msg.file.url ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-cyber-border max-h-60 bg-slate-100 dark:bg-slate-900">
                              <video 
                                src={msg.file.url} 
                                controls
                                className="w-full max-h-60"
                              />
                            </div>
                          ) : null}

                          {/* General card with status & download */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
                              {msg.file.type.startsWith('image/') ? (
                                <Image className="w-5 h-5 text-cyber-cyan" />
                              ) : msg.file.type.startsWith('video/') ? (
                                <Video className="w-5 h-5 text-cyber-accent" />
                              ) : (
                                <File className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{msg.file.name}</p>
                              <span className="text-[10px] text-slate-500">{formatBytes(msg.file.size)}</span>
                            </div>

                            {/* Download Action */}
                            {msg.file.isComplete && msg.file.url && (
                              <a
                                href={msg.file.url}
                                download={msg.file.name}
                                className="w-8 h-8 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/20 text-cyber-cyan flex items-center justify-center transition-colors flex-shrink-0"
                                title="Download File"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>

                          {/* Progress slider */}
                          {!msg.file.isComplete && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                <span>TRANSFER PROGRESS</span>
                                <span>{msg.file.progress}%</span>
                              </div>
                              <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-cyber-cyan to-cyber-accent h-full transition-all duration-300"
                                  style={{ width: `${msg.file.progress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                        </div>
                      ) : (
                        // Normal Text Bubble
                        <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          msg.isMe 
                            ? 'bg-gradient-to-tr from-cyber-accent/85 to-cyber-accent/75 border border-cyber-accent/50 text-white rounded-tr-none shadow-glow-purple/20' 
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom message input controls */}
          <footer className="p-4 border-t border-slate-200 dark:border-cyber-border bg-white/60 dark:bg-cyber-card/60 backdrop-blur-md relative z-10 transition-colors duration-300">
            <form onSubmit={handleSendText} className="flex gap-2 items-center">
              
              {/* File input trigger */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={triggerFileSelect}
                className="p-3 bg-slate-100 dark:bg-slate-950/70 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-cyber-border text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all"
                title="Send File"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your secure P2P message (AI moderated)..."
                className="flex-1 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-cyber-border focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan outline-none rounded-xl py-3 px-4 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-600 transition-all font-medium h-[46px] shadow-inner dark:shadow-none"
              />

              {/* Send Button */}
              <button
                type="submit"
                className="p-3 bg-gradient-to-tr from-cyber-cyan to-cyber-accent text-slate-950 hover:brightness-110 active:scale-95 rounded-xl transition-all shadow-glow-cyan h-[46px] w-[46px] flex items-center justify-center"
              >
                <Send className="w-5 h-5 stroke-[2.5]" />
              </button>
            </form>
          </footer>

        </main>
      </div>

      {/* Cybersecurity Intercept Modal */}
      <AnimatePresence>
        {activeBlockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-950 border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.25)] max-w-lg w-full rounded-2xl overflow-hidden relative text-slate-100"
            >
              {/* Animated HUD line scanner at top of modal */}
              <div className="h-1 w-full bg-red-500/20 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scan"></div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                
                {/* Header Section */}
                <div className="flex items-center gap-4 border-b border-red-500/10 pb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/35 flex items-center justify-center text-red-500 animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-mono font-black text-red-500 tracking-wider text-sm">SECURITY PROTOCOL ACTIVE</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Local AI Threat Intercept</p>
                  </div>
                </div>

                {/* AI Explanation / Threat Banner */}
                <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-xl space-y-2">
                  <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-wider block font-mono">Assessment:</span>
                  <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                    {getAiExplanation(activeBlockModal.result)}
                  </p>
                </div>

                {/* Blocked message snippet */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Blocked Data Payload:</span>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs font-mono text-slate-400 italic break-all">
                    "{activeBlockModal.text}"
                  </div>
                </div>

                {/* Metrics HUD Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Toxicity</span>
                    <p className="text-lg font-mono font-black text-slate-200">
                      {Math.round(activeBlockModal.result.details.toxicityScore * 100)}%
                    </p>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Spam Prob.</span>
                    <p className="text-lg font-mono font-black text-slate-200">
                      {Math.round(activeBlockModal.result.details.spamScore * 100)}%
                    </p>
                  </div>

                  {/* Threat Level */}
                  {(() => {
                    const level = getThreatLevel(activeBlockModal.result.score, activeBlockModal.result.details.illegalScore >= 1.0);
                    return (
                      <div className={`border p-3 rounded-xl text-center space-y-1 ${level.color}`}>
                        <span className="text-[8px] font-bold opacity-70 uppercase tracking-wider block font-mono">Threat Level</span>
                        <p className="text-md font-mono font-black tracking-widest">{level.label}</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Detected Categories */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Flagged Policy Rules:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {getDetectedCategories(activeBlockModal.result).map((cat, idx) => (
                      <span
                        key={idx}
                        className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono"
                      >
                        {cat}
                      </span>
                    ))}
                    {getDetectedCategories(activeBlockModal.result).length === 0 && (
                      <span className="text-[10px] text-slate-500 font-semibold italic">Heuristics anomaly flag</span>
                    )}
                  </div>
                </div>

                {/* Expandable "View AI Threat Assessment" */}
                <div className="border-t border-slate-900 pt-4">
                  <button
                    onClick={() => setDetailedAssessmentOpen(!detailedAssessmentOpen)}
                    className="text-[10px] font-mono font-bold text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors animate-pulse"
                  >
                    {detailedAssessmentOpen ? (
                      <>[-] CLOSE RAW THREAT ANALYSIS DETAILS</>
                    ) : (
                      <>[+] EXPAND RAW THREAT ANALYSIS DETAILS</>
                    )}
                  </button>

                  {detailedAssessmentOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-3 bg-slate-900 border border-slate-800/85 p-3 rounded-xl space-y-2.5 font-mono text-[9px] text-slate-400"
                    >
                      <div className="flex justify-between border-b border-slate-950 pb-1">
                        <span>TIMESTAMP</span>
                        <span className="text-slate-300">{new Date().toISOString()}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-950 pb-1">
                        <span>OVERALL HAZARD RATING</span>
                        <span className="text-red-500 font-bold">{(activeBlockModal.result.score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-950 pb-1">
                        <span>PHISHING DETECTOR</span>
                        <span className="text-slate-300">{(activeBlockModal.result.details.phishingScore * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-950 pb-1">
                        <span>PROHIBITED TERMS</span>
                        <span className="text-slate-300">{(activeBlockModal.result.details.illegalScore * 100).toFixed(1)}%</span>
                      </div>
                      {activeBlockModal.result.reasons.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-slate-500 uppercase tracking-widest block font-bold text-[8px] mt-1">VIOLATED PATTERNS LOG:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                            {activeBlockModal.result.reasons.map((reason, idx) => (
                              <li key={idx} className="break-all">{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

              </div>

              {/* Modal Actions */}
              <div className="bg-slate-900/30 border-t border-slate-900 p-4 flex justify-end">
                <button
                  onClick={() => {
                    setActiveBlockModal(null);
                    setDetailedAssessmentOpen(false);
                  }}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-500 active:scale-95 text-white font-mono font-bold text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl transition-all shadow-glow-red"
                >
                  Acknowledge & Close HUD
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
