import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';

import { getSession, onAuthStateChange } from '../services/auth';
import { signInWithEmail, signInWithGoogle, getSupabaseClient } from '../services/supabaseClient';

type AuthGateProps = {
  children: React.ReactNode | ((session: Session | null) => React.ReactNode);
};

const renderChildren = (
  children: AuthGateProps['children'],
  session: Session | null
) => {
  if (typeof children === 'function') {
    return children(session);
  }

  return children;
};

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isSupabaseConfigured = !!getSupabaseClient();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const syncSession = async () => {
      const activeSession = await getSession();
      if (!isMounted) return;
      setSession(activeSession);
      setLoading(false);
    };

    syncSession();

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (nextSession) {
        setAuthMessage(null);
        setAuthError(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isSupabaseConfigured]);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    const response = await signInWithEmail(email);
    if (response?.error) {
      setAuthError(response.error.message);
    } else {
      setAuthMessage('Magic link sent! Check your email to continue.');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    const response = await signInWithGoogle();
    if (response?.error) {
      setAuthError(response.error.message);
    }
  };

  if (!isSupabaseConfigured) {
    return <>{renderChildren(children, null)}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span className="font-medium">Checking your session…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md space-y-6 p-8">
          <div>
            <h1 className="text-xl font-bold">Sign in to SmartRoster</h1>
            <p className="text-sm text-slate-400">Use a magic link or continue with Google.</p>
          </div>
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <label className="text-sm font-semibold text-slate-200">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors"
            >
              Send magic link
            </button>
          </form>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-700" />
            <span>or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-lg shadow-lg shadow-slate-900/20 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <span>Continue with Google</span>
          </button>
          {authMessage && <div className="text-emerald-300 text-sm">{authMessage}</div>}
          {authError && <div className="text-rose-300 text-sm">{authError}</div>}
        </div>
      </div>
    );
  }

  return <>{renderChildren(children, session)}</>;
};

export default AuthGate;
