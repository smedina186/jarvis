"use client";
// RESEARCH: MDN Web Speech APIs; react-speech-recognition reviewed (not needed here).
// DECISION: Native feature detection, no SDK/polyfill, audio storage or paid service.
import { useEffect, useRef, useState } from "react";
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
  const mounted = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  function clearListenTimer() {
    if (listenTimer.current) clearTimeout(listenTimer.current);
  }
  function clearSpeechTimer() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
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
      try {
        instance.abort();
      } catch {
        /* Already ended. */
      }
    }
    if (mounted.current) {
      setListening(false);
      setStarting(false);
    }
  }
  function stopSpeech() {
    utterance.current = null;
    clearSpeechTimer();
    window.speechSynthesis?.cancel();
    if (mounted.current) {
      setSpeaking(false);
      setBeat(false);
    }
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
  function listen(draft: string, update: (text: string) => void) {
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
    instance.onresult = (event) => {
      if (!current()) return;
      let transcript = "";
      for (let i = 0; i < event.results.length; i++)
        transcript += `${event.results[i][0].transcript} `;
      update(
        [draft.trim(), transcript.trim()]
          .filter(Boolean)
          .join(" ")
          .slice(0, 6000),
      );
    };
    instance.onend = () => {
      if (current()) {
        recognition.current = null;
        clearListenTimer();
        setStarting(false);
        setListening(false);
      }
    };
    instance.onerror = (event) => {
      if (!current()) return;
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
      instance.start();
      listenTimer.current = setTimeout(() => {
        if (current()) {
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

  function speak(text: string) {
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
    const available = voicesRef.current;
    const selected =
      available.find((v) => v.voiceURI === prefs.current.voiceURI) ||
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
    // Short utterances avoid Safari dropping long responses. No silent unlock audio.
    const chunks: string[] = [];
    let chunk = "";
    for (const word of text
      .split(/\s+/)
      .flatMap((value) => value.match(/.{1,170}/gu) || [])) {
      if (chunk && chunk.length + word.length > 180) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += `${word} `;
    }
    if (chunk.trim()) chunks.push(chunk.trim());
    function next(index: number) {
      if (!mounted.current || !prefs.current.mode || prefs.current.muted)
        return;
      const item = new SpeechSynthesisUtterance(chunks[index]);
      item.lang = selected?.lang || "es-ES";
      if (selected) item.voice = selected;
      item.rate = 1;
      item.pitch = 0.95;
      utterance.current = item;
      const current = () => mounted.current && utterance.current === item;
      item.onstart = () => {
        if (!current()) return;
        clearSpeechTimer();
        setSpeaking(true);
        speechTimer.current = setTimeout(
          () => {
            if (current()) {
              stopSpeech();
              setError(
                "La lectura se detuvo. Pulsa Reproducir respuesta para volver a intentarlo.",
              );
            }
          },
          Math.max(15000, chunks[index].length * 300),
        );
      };
      item.onboundary = () => {
        if (current()) setBeat((previous) => !previous);
      };
      item.onend = () => {
        if (!current()) return;
        clearSpeechTimer();
        utterance.current = null;
        if (index + 1 < chunks.length) next(index + 1);
        else {
          setSpeaking(false);
          setBeat(false);
        }
      };
      item.onerror = () => {
        if (current()) {
          stopSpeech();
          setError(
            "Safari no pudo reproducir la voz. Pulsa Reproducir respuesta; también puedes leer el texto.",
          );
        }
      };
      speechTimer.current = setTimeout(() => {
        if (current()) {
          stopSpeech();
          setError(
            "Safari puede requerir un toque para iniciar el audio. Pulsa Reproducir respuesta.",
          );
        }
      }, 3000);
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
