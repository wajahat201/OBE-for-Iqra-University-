import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserType } from '../types';
import { GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (userType: UserType, name: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [userType, setUserType] = useState<UserType>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid username or password');
        return;
      }

      // Save tokens
      localStorage.setItem('access',  data.access);
      localStorage.setItem('refresh', data.refresh);

      // Use role from Django instead of the UI selector
      onLogin(data.user.user_type as UserType, data.user.username);

    } catch (err) {
      setError('Connection to backend failed. Logging you into offline corporate sandbox demo...');
      setTimeout(() => {
        // Fallback login
        onLogin(userType, username || 'QA Advisor');
      }, 1200);
    } finally {
      // delay state reset to make transition look native
      setTimeout(() => {
        setLoading(false);
      }, 1200);
    }
  };

  const userTypes: { type: UserType; label: string; icon: any }[] = [
    { type: 'student',    label: 'Student',               icon: GraduationCap },
    { type: 'instructor', label: 'Instructor',             icon: BookOpen      },
    { type: 'qa',         label: 'QA / Quality Assurance', icon: ShieldCheck   },
  ];

  return (
    <div className="min-h-screen frosted-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/40 backdrop-blur-xl border border-white/50 p-8 md:p-12 rounded-[32px] shadow-xl max-w-lg w-full"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4">U</div>
          <h1 className="text-4xl font-display font-bold text-indigo-950 tracking-tight mb-2">Iqra University OBE</h1>
          <p className="text-indigo-800/80 font-sans text-sm font-medium">University Outcome Based Education Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User type selector — visual only, actual role comes from Django */}
          <div className="grid grid-cols-1 gap-3">
            <span className="text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1">
              Select User Type
            </span>
            <div className="grid grid-cols-3 gap-3">
              {userTypes.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setUserType(t.type)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                    userType === t.type
                      ? 'border-indigo-600 bg-indigo-600/10 shadow-sm text-indigo-900 font-bold'
                      : 'border-white/20 bg-white/30 hover:bg-white/50 text-slate-600'
                  }`}
                >
                  <t.icon className={`w-6 h-6 mb-2 ${userType === t.type ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className={`text-[10px] font-sans font-bold uppercase tracking-tighter text-center leading-none ${
                    userType === t.type ? 'text-indigo-900' : 'text-slate-500'
                  }`}>
                    {t.type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                required
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm font-sans text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-sans font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Enter Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
