// src/app/test/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';

export default function TestPage() {
  const [email, setEmail] = useState('tester@example.com');
  const [password, setPassword] = useState('testpass123');
  const [sessionId, setSessionId] = useState<string>('');
  const [log, setLog] = useState<string>('');

  async function signIn() {
    setLog('Signing in…');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setLog(`Sign-in error: ${error.message}`);
    setLog(`Signed in as ${data.user?.email}`);
  }

  async function startSession() {
    try {
      setLog('Starting session…');
      const data = await callFunction<{ sessionId: string; level_hint: string }>('start-session', {
        topic: 'About your day',
        level_hint: 'A2',
        topic_hi: 'Aapke din par baat-chit',
      });
      setSessionId(data.sessionId);
      setLog(`Session started: ${data.sessionId}`);
    } catch (e: any) {
      setLog(e.message);
    }
  }

  async function chatOnce() {
    try {
      if (!sessionId) return setLog('No sessionId yet.');
      setLog('Chatting…');
      // wantAudio true will stream speak_text tokens; for this simple test we just get final json
      const res = await callFunction<any>('chat', {
        sessionId,
        userMessage: 'Hi Coco, I woke up late and missed the bus.',
        wantAudio: false,
      });
      setLog(`Chat ok. See Network tab for SSE events.\n${JSON.stringify(res).slice(0, 200)}…`);
    } catch (e: any) {
      setLog(e.message);
    }
  }

  async function endSession() {
    try {
      if (!sessionId) return setLog('No sessionId yet.');
      setLog('Ending session…');
      const res = await callFunction<any>('end-session', { sessionId });
      setLog(`Ended. Score: ${res?.finalScore?.overall_score_0_100 ?? '—'}`);
    } catch (e: any) {
      setLog(e.message);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Frontend → Supabase wiring test</h1>

      <div style={{ marginTop: 16 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          style={{ padding: 8, width: '100%', marginBottom: 8 }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          type="password"
          style={{ padding: 8, width: '100%', marginBottom: 8 }}
        />
        <button onClick={signIn}>Sign in (email/pass)</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={startSession} disabled={!supabase}>
          Start Session
        </button>
        <button onClick={chatOnce} disabled={!sessionId} style={{ marginLeft: 8 }}>
          Chat Once
        </button>
        <button onClick={endSession} disabled={!sessionId} style={{ marginLeft: 8 }}>
          End Session
        </button>
      </div>

      <pre style={{ marginTop: 16, background: '#111', color: '#0f0', padding: 12, whiteSpace: 'pre-wrap' }}>
        {log}
      </pre>
    </div>
  );
}
