// SKILLFORGE AI — voice interaction helpers (Speak → Select → Demonstrate).
// Built on the browser Web Speech API with graceful degradation: the
// simulation works fully with typed input or button selection when speech
// is unavailable.

export interface SpeechSupport {
  recognition: boolean;
  synthesis: boolean;
}

export function speechSupport(): SpeechSupport {
  if (typeof window === 'undefined') return { recognition: false, synthesis: false };
  const w = window as unknown as Record<string, unknown>;
  return {
    recognition: 'SpeechRecognition' in w || 'webkitSpeechRecognition' in w,
    synthesis: 'speechSynthesis' in window,
  };
}

export type RecognitionLang = 'en-IN' | 'ta-IN';

interface RecognitionHandle {
  stop: () => void;
}

/**
 * Start one-shot speech recognition. Returns a cancel handle; all callbacks
 * are optional. Never throws — speech is a convenience, not a requirement.
 */
export function listenOnce(opts: {
  lang?: RecognitionLang;
  onPartial?: (text: string) => void;
  onResult: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}): RecognitionHandle | null {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        continuous: boolean;
        onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
        onerror: ((e: { error: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      })
    | undefined;
  if (!Ctor) {
    opts.onError?.('Speech recognition is not available in this browser.');
    return null;
  }
  try {
    const rec = new Ctor();
    rec.lang = opts.lang ?? 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      let final = '';
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else partial += r[0].transcript;
      }
      if (partial) opts.onPartial?.(partial);
      if (final) opts.onResult(final.trim());
    };
    rec.onerror = (e) => opts.onError?.(e.error);
    rec.onend = () => opts.onEnd?.();
    rec.start();
    return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
  } catch (err) {
    opts.onError?.(err instanceof Error ? err.message : 'Could not start the microphone.');
    return null;
  }
}

/** Speak a prompt aloud (for low-literacy candidates). Best effort. */
export function speak(text: string, lang: 'en-IN' | 'ta-IN' = 'en-IN'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch {
    /* TTS is best-effort */
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
}
