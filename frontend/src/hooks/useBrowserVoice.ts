"use client";
// RESEARCH: MDN Web Speech APIs; react-speech-recognition reviewed (not needed here).
// DECISION: Native feature detection, no SDK/polyfill, audio storage or paid service.
import { useEffect, useRef, useState } from "react";
import { claimSpeech, ownsSpeech, releaseSpeech, setAudioSession, settleAudioSession } from "@/lib/speech-focus";
export type VoiceActivity = "idle" | "listening" | "processing" | "speaking";
type Results = {
  length: number;
  [n: number]: { [n: number]: { transcript: string } };
};
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
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
  const engineWatch = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  function clearListenTimer() {
    if (listenTimer.current) clearTimeout(listenTimer.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  }
  function clearSpeechTimer() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    if (engineWatch.current) clearInterval(engineWatch.current);
  }
  function cancelListening() {
    const instance = recognition.current;
    recognition.current = null;
    clearListenTimer();
    if (instance) {
      instance.onend = null;
      instance.onresult = null;
      instance.onerror = null;
      instance.onstart = null;
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
    if (!prefs.current.mode || !prefs.current.consent || recognition.current)
      return;
    const w = window as VoiceWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) {
      setError(
        "Este navegador no ofrece reconocimiento. Usa el micrófono del teclado del iPad en el campo de mensaje.",
      );
      return;
    }
    stopSpeech(); // Never listen while JARVIS is reading aloud.
    setError("");
    setStarting(true);
    let instance: Recognition;
    try {
      instance = new Constructor();
    } catch {
      setStarting(false);
      setError(
        "No se pudo abrir el reconocimiento. Usa el dictado del teclado.",
      );
      return;
    }
    recognition.current = instance;
    const current = () => mounted.current && recognition.current === instance;
    instance.lang = "es-ES";
    instance.continuous = false;
    instance.interimResults = true;
    instance.onstart = () => {
      if (current()) {
        setStarting(false);
        setListening(true);
      }
    };
    let lastTranscript = "";
    let delivered = false;
    const deliver = (stop = false) => {
      if (!current() || delivered) return;
      delivered = true;
      recognition.current = null;
      if (!ownsSpeech(speechOwner.current)) setAudioSession("auto");
      clearListenTimer();
      instance.onresult = instance.onend = instance.onstart = instance.onerror = null;
      instance.onspeechend = null;
      if (stop) { try { instance.stop(); } catch { /* Already ended. */ } }
      setStarting(false);
      setListening(false);
      completed?.(lastTranscript);
    };
    instance.onresult = (event) => {
      if (!current()) return;
      let transcript = "";
      for (let i = 0; i < event.results.length; i++)
        transcript += `${event.results[i][0].transcript} `;
      lastTranscript = transcript.trim().slice(0, 6000);
      // Safari may keep the recognition session open after returning text.
      // During an explicitly authorized conversation, stable text ends the turn.
      // Draft dictation deliberately retains the manual review/send behavior.
      if (completed && lastTranscript) {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => deliver(true), 1800);
      }
      update(
        [draft.trim(), transcript.trim()]
          .filter(Boolean)
          .join(" ")
          .slice(0, 6000),
      );
    };
    instance.onspeechend = () => {
      if (completed && lastTranscript && current()) {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        // Let final transcript corrections arrive before ending capture.
        silenceTimer.current = setTimeout(() => deliver(true), 500);
      }
    };
    instance.onend = () => {
      deliver();
    };
    instance.onerror = (event) => {
      if (!current()) return;
      if (completed && lastTranscript && ["no-speech", "aborted"].includes(event.error)) {
        deliver(true);
        return;
      }
      const messages: Record<string, string> = {
        "not-allowed":
          "Permiso de micrófono denegado. Revisa los permisos de Safari o usa el dictado del teclado.",
        "service-not-allowed":
          "Safari no permite este servicio de reconocimiento. Usa el dictado del teclado.",
        "audio-capture":
          "No se pudo acceder al micrófono. Comprueba que esté disponible.",
        "no-speech": "No se detectó voz. Puedes volver a pulsar el micrófono.",
        network:
          "El reconocimiento no pudo contactar con su servicio. Usa el dictado del teclado.",
      };
      if (event.error !== "aborted")
        setError(
          messages[event.error] ||
            "No se pudo transcribir. Usa el dictado del teclado.",
        );
      cancelListening();
    };
    try {
      setAudioSession("play-and-record");
      instance.start();
      listenTimer.current = setTimeout(() => {
        if (current()) {
          if (completed && lastTranscript) { deliver(true); return; }
          setError(
            "La escucha terminó tras 45 segundos. Revisa la transcripción antes de enviar.",
          );
          cancelListening();
        }
      }, 45000);
    } catch {
      cancelListening();
      setError(
        "Safari no pudo iniciar el micrófono. Revisa sus permisos o utiliza el dictado del teclado.",
      );
    }
  }
  function finishListening() {
    const instance = recognition.current;
    if (!instance) return;
    try {
      instance.stop();
    } catch {
      cancelListening();
    }
    clearListenTimer();
    // Allow final recognition results; bound engines that never emit end.
    listenTimer.current = setTimeout(() => {
      if (recognition.current === instance) cancelListening();
    }, 2000);
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
    function next(index: number) {
      if (!mounted.current || !prefs.current.mode || prefs.current.muted)
        return;
      let item: SpeechSynthesisUtterance;
      try { item = new SpeechSynthesisUtterance(chunks[index]); }
      catch { stopSpeech(); setError("No se pudo abrir la voz del dispositivo; el texto se conserva."); return; }
      item.lang = selected?.lang || "es-ES";
      if (selected) item.voice = selected;
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
        if (index + 1 < chunks.length) next(index + 1);
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
      item.onerror = () => {
        if (current()) {
          stopSpeech();
          setSpeechEvent("El motor devolvió un error de voz");
          setError(
            "Safari no pudo reproducir la voz. Pulsa Reproducir respuesta; también puedes leer el texto.",
          );
        }
      };
      speechTimer.current = setTimeout(() => {
        if (current() && !started) {
          stopSpeech();
          setSpeechEvent("Sin inicio confirmado del motor");
          setError(
            "El dispositivo no inició la voz. Tu texto se conserva. Pulsa Escuchar última respuesta para reanudar el audio.",
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
