import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, RefreshCw } from 'lucide-react-native';

import { CAPTCHA_CHALLENGE_URL, CAPTCHA_VERIFY_URL } from '../config';

const WORDS = {
  0: 'cero', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco',
  6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
  11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
  16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve', 20: 'veinte',
};

function w(n) {
  return WORDS[n] || String(n);
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uniqueOptions(answer, extra = []) {
  const pool = new Set([answer, ...extra]);
  while (pool.size < 4) {
    const cand = answer + (Math.floor(Math.random() * 7) + 1) * (Math.random() < 0.5 ? -1 : 1);
    if (cand > 0 && cand !== answer) pool.add(cand);
  }
  return shuffle([...pool]).slice(0, 4);
}

function makeLocalChallenge() {
  const kinds = ['add', 'sub', 'mul', 'max', 'even', 'dots'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === 'add') {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    const answer = a + b;
    return { prompt: `¿Cuánto es ${w(a)} más ${w(b)}?`, options: uniqueOptions(answer), answer, token: null };
  }
  if (kind === 'sub') {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 1 + Math.floor(Math.random() * (a - 1));
    const answer = a - b;
    return { prompt: `¿Cuánto es ${w(a)} menos ${w(b)}?`, options: uniqueOptions(answer), answer, token: null };
  }
  if (kind === 'mul') {
    const a = 2 + Math.floor(Math.random() * 4);
    const b = 2 + Math.floor(Math.random() * 5);
    const answer = a * b;
    return { prompt: `¿Cuánto es ${w(a)} por ${w(b)}?`, options: uniqueOptions(answer), answer, token: null };
  }
  if (kind === 'max') {
    const options = shuffle([
      2 + Math.floor(Math.random() * 8),
      9 + Math.floor(Math.random() * 8),
      4 + Math.floor(Math.random() * 6),
      12 + Math.floor(Math.random() * 7),
    ]);
    const uniq = [...new Set(options)];
    if (uniq.length < 4) return makeLocalChallenge();
    return { prompt: 'Toca el número más grande', options: uniq.slice(0, 4), answer: Math.max(...uniq), token: null };
  }
  if (kind === 'even') {
    const odds = [3, 5, 7, 9, 11, 13, 15].sort(() => Math.random() - 0.5).slice(0, 3);
    const answer = (1 + Math.floor(Math.random() * 8)) * 2;
    return { prompt: 'Toca el único número par', options: shuffle([...odds, answer]), answer, token: null };
  }
  const answer = 3 + Math.floor(Math.random() * 6);
  return {
    prompt: `¿Cuántos puntos hay?  ${'● '.repeat(answer).trim()}`,
    options: uniqueOptions(answer),
    answer,
    token: null,
  };
}

export default function RobotCaptcha({ checked, onChange, error }) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fails, setFails] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [ready, setReady] = useState(false);
  const readyAtRef = useRef(0);
  const timerRef = useRef(null);
  const lockTimerRef = useRef(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
  };

  const applyChallenge = useCallback((ch, minWait = 1600) => {
    setChallenge(ch);
    setFeedback('');
    setReady(false);
    readyAtRef.current = Date.now() + minWait;
    timerRef.current = setTimeout(() => setReady(true), minWait);
    onChangeRef.current(false, null);
  }, []);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setFeedback('');
    onChangeRef.current(false, null);
    try {
      if (CAPTCHA_CHALLENGE_URL) {
        const resp = await fetch(CAPTCHA_CHALLENGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = await resp.json().catch(() => null);
        if (resp.ok && json?.prompt && Array.isArray(json?.options)) {
          applyChallenge({
            prompt: String(json.prompt),
            options: json.options.map((n) => Number(n)),
            answer: null,
            token: json.token || null,
          }, Number(json.minWaitMs) || 1600);
          setLoading(false);
          return;
        }
      }
      applyChallenge(makeLocalChallenge());
    } catch {
      applyChallenge(makeLocalChallenge());
    } finally {
      setLoading(false);
    }
  }, [applyChallenge]);

  useEffect(() => {
    loadChallenge();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lockUntil) {
      setLocked(false);
      return undefined;
    }
    const tick = () => {
      const left = lockUntil - Date.now();
      if (left <= 0) {
        setLocked(false);
        setLockUntil(0);
        setFails(0);
        loadChallenge();
      } else {
        setLocked(true);
      }
    };
    tick();
    lockTimerRef.current = setInterval(tick, 400);
    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, [lockUntil, loadChallenge]);

  const failAndRefresh = (msg) => {
    const nextFails = fails + 1;
    setFails(nextFails);
    setFeedback(msg);
    onChangeRef.current(false, null);
    if (nextFails >= 3) {
      setLockUntil(Date.now() + 8000);
      setFeedback('Demasiados intentos. Espera unos segundos.');
      return;
    }
    timerRef.current = setTimeout(() => loadChallenge(), 650);
  };

  const handleChoose = async (n) => {
    if (checked || loading || locked || !challenge) return;
    if (Date.now() < readyAtRef.current || !ready) {
      failAndRefresh('Demasiado rápido. Lee la pregunta y vuelve a intentar.');
      return;
    }
    const knownAnswer = challenge.answer;
    if (knownAnswer != null && Number(n) !== Number(knownAnswer)) {
      failAndRefresh('Respuesta incorrecta. Nueva pregunta.');
      return;
    }
    if (challenge.token && CAPTCHA_VERIFY_URL) {
      try {
        const resp = await fetch(CAPTCHA_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: challenge.token, answer: n }),
        });
        let json = null;
        try {
          json = JSON.parse(await resp.text());
        } catch {
          json = null;
        }
        if (!resp.ok || json?.ok === false) {
          failAndRefresh('Respuesta incorrecta. Nueva pregunta.');
          return;
        }
      } catch {
        failAndRefresh('No se pudo verificar. Nueva pregunta.');
        return;
      }
    }
    setFeedback('');
    onChangeRef.current(true, { token: challenge.token, answer: n });
  };

  const lockLeft = locked ? Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000)) : 0;

  const boxStyle = useMemo(
    () => [styles.box, error ? styles.boxError : null, checked ? styles.boxOk : null],
    [error, checked]
  );

  return (
    <View style={boxStyle}>
      <View style={styles.topRow}>
        <View style={[styles.checkbox, checked ? styles.checkboxOn : null]}>
          {checked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>No soy un robot</Text>
          <Text style={styles.hint}>
            {checked
              ? 'Verificación completada'
              : locked
                ? `Bloqueado ${lockLeft}s`
                : ready
                  ? 'Elige la respuesta correcta'
                  : 'Lee la pregunta…'}
          </Text>
        </View>
        <Pressable onPress={() => !locked && loadChallenge()} hitSlop={8} style={styles.refresh} disabled={locked}>
          {loading ? <ActivityIndicator size="small" /> : <RefreshCw size={16} color="#6B7280" />}
        </Pressable>
      </View>

      {!checked && challenge && !loading ? (
        <View style={styles.challenge}>
          <Text style={styles.prompt}>{challenge.prompt}</Text>
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          <View style={styles.options}>
            {(challenge.options || []).map((n, idx) => (
              <Pressable
                key={`${n}-${idx}`}
                onPress={() => { handleChoose(n); }}
                disabled={locked || !ready}
                style={[styles.option, (!ready || locked) ? styles.optionDisabled : null]}
              >
                <Text style={styles.optionText}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
  },
  boxError: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  boxOk: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  title: { fontWeight: '800', color: '#111827', fontSize: 14 },
  hint: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  refresh: { padding: 6 },
  challenge: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  prompt: { fontWeight: '800', color: '#374151', marginBottom: 8, lineHeight: 20 },
  feedback: { color: '#B91C1C', fontWeight: '700', fontSize: 12, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionDisabled: { opacity: 0.45 },
  optionText: { fontWeight: '800', color: '#374151', fontSize: 16 },
});
