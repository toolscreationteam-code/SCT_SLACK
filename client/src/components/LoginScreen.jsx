import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  User,
  Key,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import { AVATAR_COLORS } from '../constants/members';

export default function LoginScreen({ users, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const memberList = Array.isArray(users) ? users : [];

  const handleSelectMember = (m) => {
    setUsername(m.username);
    setPassword(m.username);
    setError('');
    setMemberSearch('');
    setIsUserPickerOpen(false);
  };

  const selectedMember = memberList.find((m) => m.username === username);
  const filteredMembers = memberList.filter((m) => {
    const phrase = memberSearch.trim().toLowerCase();
    return !phrase || `${m.name} ${m.username} ${m.id}`.toLowerCase().includes(phrase);
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid username or password.');
      } else {
        onLoginSuccess(data.user, keepLoggedIn ? data.expiresAt : null, data.workspaces || []);
      }
    } catch (err) {
      setError('Unable to connect to the server. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#1A1D21] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4A154B]/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-xl z-10"
      >
        {/* Header Branding */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#3F0E40] border border-[#ECB22E]/40 shadow-2xl mb-3 text-[#ECB22E]"
          >
            <Sparkles className="w-7 h-7" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            AVK Workspace
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            AVK Team Collaboration • Sign In
          </p>
        </div>

        <div className="w-full bg-[#222529]/95 border border-[#383C40] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#ECB22E]" /> Sign In
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                Select your account, then sign in securely.
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-3 bg-red-950/60 border border-red-500/40 text-red-300 rounded-xl text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Searchable username dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Username <span className="text-gray-500 font-normal">(search by name or ID)</span>
                  </label>
                  <div className="relative">
                    <button type="button" onClick={() => setIsUserPickerOpen((open) => !open)} className={`w-full min-h-13 px-3 py-2.5 rounded-xl bg-[#1A1D21] border text-left flex items-center justify-between gap-3 transition-all ${isUserPickerOpen ? 'border-[#ECB22E] ring-2 ring-[#ECB22E]/15' : 'border-[#383C40] hover:border-[#6b5b6e]'}`}>
                      {selectedMember ? <span className="flex items-center gap-2.5 min-w-0"><span className={`w-8 h-8 rounded-lg grid place-items-center font-bold text-xs text-white shrink-0 ${AVATAR_COLORS[selectedMember.id] || 'bg-gray-600'}`}>{selectedMember.avatar || selectedMember.name?.slice(0, 2)}</span><span className="min-w-0"><span className="block text-sm font-semibold text-white truncate">{selectedMember.name}</span><span className="block text-[10px] text-gray-400 truncate">User ID: {selectedMember.username}</span></span></span> : <span className="flex items-center gap-2 text-sm text-gray-400"><User className="w-4 h-4" /> Search and select your account</span>}
                      <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isUserPickerOpen ? 'rotate-180 text-[#ECB22E]' : ''}`} />
                    </button>
                    {isUserPickerOpen && <div className="absolute z-30 top-[calc(100%+8px)] left-0 right-0 rounded-2xl bg-[#25282D] border border-[#ECB22E]/50 shadow-2xl overflow-hidden"><div className="p-2.5 border-b border-[#383C40]"><div className="relative"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /><input autoFocus value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search name or User ID..." className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#1A1D21] border border-[#ECB22E] text-sm text-white placeholder-gray-500 focus:outline-none shadow-inner" /></div></div><div className="max-h-[280px] overflow-y-auto p-2 space-y-1"><button type="button" onClick={() => { setUsername(''); setPassword(''); setMemberSearch(''); setIsUserPickerOpen(false); }} className="w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between bg-[#ECB22E]/10 hover:bg-[#ECB22E]/20 text-[#F9D776] text-sm transition-colors"><span>-- Select a User --</span>{!selectedMember && <Check className="w-4 h-4" />}</button>{filteredMembers.length ? filteredMembers.map((m) => { const isSelected = username === m.username; return <button key={m.id} type="button" onClick={() => handleSelectMember(m)} className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl text-left transition-colors ${isSelected ? 'bg-[#1164A3]/35 ring-1 ring-[#ECB22E]/60' : 'hover:bg-white/7'}`}><span className="flex items-center gap-2.5 min-w-0"><span className={`w-8 h-8 rounded-lg grid place-items-center font-bold text-[10px] text-white shrink-0 ${AVATAR_COLORS[m.id] || 'bg-gray-600'}`}>{m.avatar || m.name?.slice(0, 2)}</span><span className="min-w-0"><span className="block text-sm text-white font-semibold truncate">{m.name}</span><span className="block text-[10px] text-gray-400 truncate">{m.team_name || 'AVK'} · ID: {m.username}</span></span></span><span className="flex items-center gap-2 shrink-0"><span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-black/35 text-[#ECB22E]">{m.username}</span>{isSelected && <Check className="w-4 h-4 text-emerald-400" />}</span></button>; }) : <p className="py-6 text-center text-xs text-gray-500">No user found. Try another name or ID.</p>}</div></div>}
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-[#1A1D21] border border-[#383C40] focus:border-[#ECB22E] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-500 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 20 Days Session Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="keepLoggedIn"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    className="rounded text-[#ECB22E] focus:ring-0 w-4 h-4 bg-[#1A1D21] border-[#383C40] cursor-pointer"
                  />
                  <label htmlFor="keepLoggedIn" className="text-xs text-gray-300 cursor-pointer select-none">
                    Keep me signed in for 20 days
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#007A5A] hover:bg-[#148567] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-900/30 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="text-[11px] text-gray-500 mt-4 pt-3 border-t border-[#383C40]/50 text-center">
              Selected Account: <span className="text-[#ECB22E] font-semibold">{username || 'None'}</span>
            </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-5 text-xs text-gray-500">
          AVK Team Collaboration • Secure Real-Time Workspace
        </div>
      </motion.div>
    </div>
  );
}
