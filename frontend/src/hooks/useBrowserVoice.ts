"use client";
// RESEARCH: MDN Web Speech APIs; react-speech-recognition reviewed (not needed here).
// DECISION: Native feature detection, no SDK/polyfill, audio storage or paid service.
import { useEffect, useRef, useState } from "react";
import { claimSpeech, ownsSpeech, releaseSpeech, setAudioSession, settleAudioSession } from "@/lib/speech-focus";
export type VoiceActivity = "idle" | "listening" | "processing" | "speaking";
type Results = {
  length: number;
  [n: number]: { isFinal?: boolean; [n: number]: { transcript: string } };
};
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: Results }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useBrowserVoice() {
  const [supported, setSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [mode, modeState] = useState(false);
  const [consent, consentState] = useState(false);
  const [muted, mutedState] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechPending, setSpeechPending] = useState(false);
  const [speechEvent, setSpeechEvent] = useState("Sin prueba de voz");
  const speechOwner = useRef(Symbol("jarvis-voice"));
  const [beat, setBeat] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("auto");
  const prefs = useRef({
    mode: false,
    consent: false,
    muted: false,
    voiceURI: "auto",
  });
  const recognition = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenSession = useRef<symbol | null>(null);
  const finishTurn = useRef<(() => void) | null>(null);
  const engineWatch = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  function clearListenTimer() {
    if (listenTimer.current) clearTimeout(listenTimer.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (restartTimer.current) clearTimeout(restartTimer.current);
  }
  function clearSpeechTimer() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    if (engineWatch.current) clearInterval(engineWatch.current);
  }
  function cancelListening() {
    const instance = recognition.current;
    recognition.current = null;
    listenSession.current = null;
    finishTurn.current = null;
    clearListenTimer();
    if (instance) {
      instance.onend = null;
      instance.onresult = null;
      instance.onerror = null;
      instance.onstart = null;
      instance.onspeechstart = null;
      instance.onspeechend = null;
      try {
        instance.abort();
      } catch {
        /* Already ended. */
      }
      settleAudioSession();
    }
    if (mounted.current) {
      setListening(false);
      setStarting(false);
    }
  }
  function resetSpeech() {
    utterance.current = null;
    clearSpeechTimer();
    if (mounted.current) { setSpeechPending(false); setSpeaking(false); setBeat(false); }
  }
  function stopSpeech() {
    resetSpeech();
    releaseSpeech(speechOwner.current);
  }
  function stopAll() {
    cancelListening();
    stopSpeech();
  }
  useEffect(() => {
    mounted.current = true;
    const w = window as VoiceWindow;
    const synth = window.speechSynthesis;
    const detect = () => {
      setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
      setSpeechSupported(Boolean(synth && window.SpeechSynthesisUtterance));
      const available =
        synth
          ?.getVoices()
          .filter((v) => /^es(?:-|_)/i.test(v.lang) || v.lang === "es") || [];
      voicesRef.current = available;
      setVoices(available);
    };
    const timer = setTimeout(detect, 0);
    synth?.addEventListener("voiceschanged", detect);
    const hide = () => {
      if (document.hidden) stopAll();
    };
    const leave = () => stopAll();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      stopAll();
      synth?.removeEventListener("voiceschanged", detect);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
    // This subscription lives for the mounted chat; callbacks operate through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setMode(value: boolean) {
    prefs.current.mode = value;
    modeState(value);
    if (!value) stopAll();
  }
  function setConsent(value: boolean) {
    prefs.current.consent = value;
    consentState(value);
    if (!value) cancelListening();
  }
  function setMuted(value: boolean) {
    prefs.current.muted = value;
    mutedState(value);
    if (value) stopSpeech();
  }
  function selectVoice(value: string) {
    prefs.current.voiceURI = value;
    setVoiceURI(value);
    stopSpeech();
  }
  function listen(
    draft: string,
    update: (text: string) => void,
    completed?: (text: string) => void,
  ) {
    if (!prefs.current.mode || !prefs.current.consent || listenSession.current || document.hidden)
      return;
    const w = window as VoiceWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) {
      setError("Este navegador no ofrece reconocimiento. Usa el micrófono del teclado del iPad en el campo de mensaje.");
      return;
    }
    stopSpeech();
    setError("");
    setStarting(true);
    const token = Symbol("voice-turn");
    listenSession.current = token;
    const valid = () => mounted.current && listenSession.current === token && prefs.current.mode && prefs.current.consent && !document.hidden;
    let transcript = "", committed = "", sessionText = "";
    let lastChange = Date.now(), restarts = 0, manualFinish = false, open = false;
    // MDN: results is a session snapshot: final entries persist, interim entries
    // are replaced. end means service disconnection, not that the user finished.
    // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent/results
    // https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event
    const appendSession = (previous: string, next: string) => {
      if (!previous) return next;
      if (!next) return previous;
      const a = previous.split(/\s+/), b = next.split(/\s+/);
      const key = (word: string) => word.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]/gu, "");
      // A restarted WebKit service can replay its previous phrase. Replace a
      // full replay and overlapping phrases; do not append every interim event.
      if (a.length <= b.length && a.every((word, i) => key(word) === key(b[i]))) return next;
      if (b.length <= a.length && b.every((word, i) => key(word) === key(a[i]))) return previous;
      let overlap = 0;
      for (let count = 2; count <= Math.min(a.length, b.length); count++) {
        if (a.slice(-count).every((word, i) => key(word) === key(b[i]))) overlap = count;
      }
      return [...a, ...b.slice(overlap)].join(" ").slice(0, 6000);
    };
    const detach = (instance: Recognition) => {
      instance.onresult = instance.onend = instance.onstart = instance.onerror = null;
      instance.onspeechstart = instance.onspeechend = null;
    };
    const deliver = (abort = true) => {
      if (listenSession.current !== token) return;
      if (!valid()) { cancelListening(); return; }
      const instance = recognition.current;
      listenSession.current = null; recognition.current = null; finishTurn.current = null;
      clearListenTimer();
      if (instance) {
        detach(instance);
        // A stable automatic turn already has its latest hypothesis. Abort
        // releases capture before Gemini/TTS instead of waiting for stop/end.
        if (abort && open) { try { instance.abort(); } catch { /* Already ended. */ } }
      }
      settleAudioSession();
      setStarting(false); setListening(false);
      completed?.(transcript);
    };
    const pause = (delay = 2800) => {
      if (!completed || !transcript || manualFinish) return;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => deliver(), delay);
    };
    const start = () => {
      if (!valid()) { if (listenSession.current === token) cancelListening(); return; }
      let instance: Recognition;
      try { instance = new Constructor(); }
      catch { setError("No se pudo abrir el reconocimiento. El texto se conserva; usa el dictado del teclado."); cancelListening(); return; }
      recognition.current = instance;
      const current = () => valid() && recognition.current === instance;
      const finals = new Map<number, string>();
      let nativeSpeech = false;
      sessionText = "";
      instance.lang = "es-ES";
      instance.continuous = true;
      instance.interimResults = true;
      instance.onstart = () => { if (current()) { setStarting(false); setListening(true); } };
      instance.onspeechstart = () => {
        if (!current()) return;
        nativeSpeech = true;
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        // Keep a bounded fallback for engines omitting a subsequent speechend.
        pause(6000);
      };
      instance.onresult = (event) => {
        if (!current()) return;
        const slots = new Map(finals);
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const value = item[0]?.transcript?.trim() || "";
          if (item.isFinal) finals.set(i, value);
          slots.set(i, value);
        }
        const snapshot = [...slots].sort(([a], [b]) => a - b).map(([, value]) => value).filter(Boolean).join(" ");
        // Keep already heard text if a service drops its last interim at end.
        if (!snapshot) return;
        sessionText = snapshot;
        const next = appendSession(committed, sessionText).slice(0, 6000);
        if (next !== transcript) {
          transcript = next; lastChange = Date.now();
          update([draft.trim(), transcript].filter(Boolean).join(" ").slice(0, 6000));
          pause(nativeSpeech ? 6000 : 2800);
        }
      };
      instance.onspeechend = () => {
        if (!current()) return;
        nativeSpeech = false;
        pause(); // A normal pause needs margin; never close after 500 ms.
      };
      instance.onend = () => {
        if (!current()) return;
        open = false; detach(instance);
        committed = appendSession(committed, sessionText);
        transcript = committed;
        setListening(false);
        if (!completed || manualFinish) { deliver(false); return; }
        if (!transcript) {
          setError("No se detectó voz. Puedes volver a pulsar el micrófono.");
          cancelListening(); return;
        }
        const remaining = Math.max(0, 2800 - (Date.now() - lastChange));
        if (!remaining) { deliver(false); return; }
        pause(remaining);
        // Recover only short service disconnects inside this authorized turn.
        // No retry after errors, empty sessions, cancellation, or permission loss.
        if (sessionText && restarts < 2) {
          restarts++; setStarting(true);
          restartTimer.current = setTimeout(start, 150);
        } else setStarting(false);
      };
      instance.onerror = (event) => {
        if (!current()) return;
        const messages: Record<string, string> = {
          "not-allowed": "Permiso de micrófono denegado. Revisa los permisos de Safari o usa el dictado del teclado.",
          "service-not-allowed": "Safari no permite este servicio de reconocimiento. Usa el dictado del teclado.",
          "audio-capture": "No se pudo acceder al micrófono. Comprueba que esté disponible.",
          "no-speech": "No se detectó voz. Puedes volver a pulsar el micrófono.",
          network: "El reconocimiento no pudo contactar con su servicio. Usa el dictado del teclado.",
          aborted: "El reconocimiento se interrumpió. Pulsa el micrófono para continuar.",
        };
        setError((messages[event.error] || "No se pudo transcribir. Usa el dictado del teclado.") + (transcript ? " La transcripción se conserva; no se ha enviado." : ""));
        cancelListening();
      };
      try { setAudioSession("play-and-record"); open = true; instance.start(); }
      catch { setError("Safari no pudo iniciar el micrófono. La transcripción se conserva; pulsa el micrófono o utiliza el dictado del teclado."); cancelListening(); }
    };
    finishTurn.current = () => {
      if (!valid()) { cancelListening(); return; }
      manualFinish = true;
      clearListenTimer();
      if (!open || !recognition.current) { deliver(false); return; }
      try { recognition.current.stop(); }
      catch { deliver(); return; }
      // Manual Finish gives the service a bounded chance to return final text.
      if (listenSession.current === token) listenTimer.current = setTimeout(() => deliver(), 1000);
    };
    start();
    if (listenSession.current === token) listenTimer.current = setTimeout(() => {
      if (!valid()) { cancelListening(); return; }
      if (completed && transcript) deliver();
      else { setError("La escucha terminó tras 45 segundos. Revisa la transcripción antes de enviar."); cancelListening(); }
    }, 45000);
  }
  function finishListening() {
    finishTurn.current?.();
  }

  function speak(text: string, completed?: () => void) {
    if (
      !prefs.current.mode ||
      prefs.current.muted ||
      !window.speechSynthesis ||
      !window.SpeechSynthesisUtterance ||
      !text.trim() ||
      document.hidden
    )
      return;
    cancelListening();
    stopSpeech();
    setError("");
    claimSpeech(speechOwner.current, resetSpeech);
    setSpeechPending(true);
    setSpeechEvent("Locución en cola; esperando al motor");
    let available = voicesRef.current;
    try {
      const refreshed = window.speechSynthesis.getVoices().filter((v) => /^es(?:-|_)/i.test(v.lang) || v.lang === "es");
      if (refreshed.length) available = refreshed;
    } catch { /* Cached voice or the native Spanish default remains available. */ }
    const selected =
      available.find((v) => v.voiceURI === prefs.current.voiceURI) ||
      available.find((v) => v.localService && /premium|enhanced|mejorada|natural/i.test(v.name)) ||
      available.find(
        (v) =>
          v.localService &&
          /jorge|carlos|diego|antonio|juan|pablo|andr[eé]s/i.test(v.name),
      ) ||
      available.find((v) =>
        /jorge|carlos|diego|antonio|juan|pablo|andr[eé]s/i.test(v.name),
      ) ||
      available.find((v) => v.localService) ||
      available[0];
    // Short utterances avoid Safari dropping long responses.
    // The session greeting is audible and originates from the explicit user tap.
    const chunks: string[] = [];
    let chunk = "";
    for (const word of text
      .replace(/```[\s\S]*?```/g, " Código disponible en pantalla. ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(^|\n)\s*#{1,6}\s*/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/(^|\n)\s*[-•]\s*/g, "$1")
      .split(/\s+/)
      .flatMap((value) => value.match(/.{1,170}/gu) || [])) {
      if (chunk && chunk.length + word.length > 180) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += `${word} `;
    }
    if (chunk.trim()) chunks.push(chunk.trim());
    if (!chunks.length) { stopSpeech(); setError("No hay texto legible para reproducir; la respuesta sigue en pantalla."); return; }
    function next(index: number, useDefaultVoice = false) {
      if (!mounted.current || !prefs.current.mode || prefs.current.muted)
        return;
      let item: SpeechSynthesisUtterance;
      try { item = new SpeechSynthesisUtterance(chunks[index]); }
      catch { stopSpeech(); setError("No se pudo abrir la voz del dispositivo; el texto se conserva."); return; }
      item.lang = selected?.lang || "es-ES";
      if (selected && !useDefaultVoice) item.voice = selected;
      item.rate = 0.95;
      item.pitch = 1;
      item.volume = 1;
      utterance.current = item;
      const current = () => mounted.current && utterance.current === item && ownsSpeech(speechOwner.current);
      let started = false, finished = false, idleSamples = 0, startedAt = 0;
      const finish = () => {
        if (!current() || finished) return;
        finished = true;
        clearSpeechTimer(); utterance.current = null;
        if (index + 1 < chunks.length) next(index + 1, useDefaultVoice);
        else {
          releaseSpeech(speechOwner.current, false);
          setSpeechPending(false); setSpeaking(false); setBeat(false);
          setSpeechEvent("El motor terminó la locución"); completed?.();
        }
      };
      const markStarted = () => {
        if (!current() || started) return;
        started = true; startedAt = Date.now();
        // Preserve the engine watcher; replace only the start deadline.
        if (speechTimer.current) clearTimeout(speechTimer.current);
        setSpeechPending(false); setSpeaking(true);
        setSpeechEvent("El motor inició la locución");
        speechTimer.current = setTimeout(() => {
          if (current()) { stopSpeech(); setSpeechEvent("Lectura interrumpida"); setError("La lectura se detuvo; el texto sigue disponible."); }
        }, Math.max(15000, chunks[index].length * 300));
      };
      item.onstart = markStarted;
      item.onboundary = () => { if (current()) { markStarted(); setBeat((p) => !p); } };
      item.onend = finish;
      // Some WebKit versions omit start/end events. Native engine flags provide
      // progress evidence, not proof that the device speakers are audible.
      engineWatch.current = setInterval(() => {
        if (!current()) return;
        const synth = window.speechSynthesis;
        if (synth.speaking === true && synth.paused !== true) { markStarted(); idleSamples = 0; }
        else if (started && Date.now() - startedAt >= 1000 && synth.speaking === false && synth.pending === false) {
          if (++idleSamples >= 2) finish();
        }
      }, 200);
      item.onerror = (event) => {
        if (current()) {
          // A listed/downloadable voice is not necessarily playable on iPad.
          // Retry only before any audio starts, once, with the native Spanish
          // default. Never retry a permission denial or a partially read chunk.
          if (!started && selected && !useDefaultVoice &&
            ["voice-unavailable", "language-unavailable", "synthesis-failed"].includes(event?.error)) {
            clearSpeechTimer();
            utterance.current = null;
            try { window.speechSynthesis.cancel(); } catch { /* Keep the text available. */ }
            setSpeechEvent("Reintentando con la voz española predeterminada");
            next(index, true);
            return;
          }
          stopSpeech();
          setSpeechEvent(`Error de voz del navegador: ${event?.error || "desconocido"}`);
          setError(
            event?.error === "not-allowed"
              ? "Safari bloqueó la reproducción automática. Pulsa Reactivar voz para escuchar la respuesta; no se repetirá la consulta."
              : "El dispositivo no pudo reproducir la voz. Pulsa Reactivar voz para reintentarlo; el texto se conserva.",
          );
        }
      };
      speechTimer.current = setTimeout(() => {
        if (current() && !started) {
          stopSpeech();
          setSpeechEvent("Sin inicio confirmado del motor");
          setError(
            "El dispositivo no inició la voz. Tu texto se conserva. Pulsa Reactivar voz para reanudar el audio.",
          );
        }
      }, 12000);
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(item);
      } catch {
        stopSpeech();
        setError(
          "No se pudo iniciar la voz. Usa Reproducir respuesta o lee el texto.",
        );
      }
    }
    next(0);
  }
  return {
    mode,
    consent,
    muted,
    supported,
    speechSupported,
    listening,
    starting,
    speaking,
    speechPending,
    speechEvent,
    beat,
    error,
    voices,
    voiceURI,
    setMode,
    setConsent,
    setMuted,
    selectVoice,
    listen,
    finishListening,
    cancelListening,
    stopSpeech,
    stopAll,
    speak,
  };
}
