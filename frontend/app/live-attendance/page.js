"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LiveAttendance() {
  const { data: session } = useSession();
  const router = useRouter();
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  const [wsStatus, setWsStatus] = useState("connecting");
  const [presentMap, setPresentMap] = useState({});
  const [sessionLog, setSessionLog] = useState([]);
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    fetch(`${API}/api/registered-faces`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then(r => r.json())
      .then(d => setRegisteredFaces(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    const wsUrl = API.replace(/^https?/, "ws") + "/ws/live-attendance";
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => setWsStatus("live");
    wsRef.current.onerror = () => setWsStatus("error");
    wsRef.current.onclose = () => setWsStatus("disconnected");

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS received:", data);
        if (!Array.isArray(data) || data.length === 0) return;
        data.forEach(result => {
          if (result.status === "present" && result.name) {
            setPresentMap(prev => {
              if (prev[result.name]) return prev;
              const entry = { time: new Date().toLocaleTimeString(), confidence: result.confidence };
              setSessionLog(log => [{ name: result.name, ...entry }, ...log.slice(0, 49)]);
              return { ...prev, [result.name]: entry };
            });
          }
        });
      } catch (e) { console.error("WS parse error:", e); }
    };

    const initCamera = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        const iPhoneCamera = videoDevices.find(d =>
          (d.label.toLowerCase().includes("iphone") || d.label.toLowerCase() === "ok camera") &&
          !d.label.toLowerCase().includes("desk")
        );
        const macCamera = videoDevices.find(d =>
          d.label.toLowerCase().includes("facetime") || d.label.toLowerCase().includes("built-in")
        );
        const selected = iPhoneCamera || macCamera || videoDevices[0];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selected?.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => {});
        }
      } catch { setWsStatus("error"); }
    };

    initCamera();

    intervalRef.current = setInterval(() => {
      if (videoRef.current && wsRef.current?.readyState === WebSocket.OPEN && videoRef.current.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
        wsRef.current.send(canvas.toDataURL("image/jpeg", 0.85));
      }
    }, 500);

    return () => {
      clearInterval(intervalRef.current);
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
      wsRef.current?.close();
    };
  }, []);

  const handleEndSession = async () => {
    setEnding(true);
    clearInterval(intervalRef.current);
    clearInterval(timerRef.current);
    wsRef.current?.close();
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    try {
      await fetch(`${API}/api/end-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
    } catch {}
    setSessionEnded(true);
    setEnding(false);
  };

  const presentNames = Object.keys(presentMap);
  const absentNames = registeredFaces.map(f => f.name).filter(n => !presentNames.includes(n));
  const presentPct = registeredFaces.length > 0 ? Math.round((presentNames.length / registeredFaces.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">

      {/* Nav */}
      <nav className="bg-[#13131f] border-b border-violet-500/15 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm shadow-violet-950/30">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/attendance")} className="text-gray-500 hover:text-white text-sm transition-colors">← Dashboard</button>
          <span className="text-gray-700">|</span>
          <span className="text-sm font-semibold">Live Session</span>
          {wsStatus === "live" && !sessionEnded && (
            <span className="glow-pulse flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Recording
            </span>
          )}
          {sessionEnded && (
            <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">Ended</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm font-mono tabular-nums">{fmt(elapsed)}</span>
          {!sessionEnded ? (
            <button
              onClick={handleEndSession}
              disabled={ending}
              className="btn-gleam btn-gleam-red bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {ending ? "Ending..." : "End Session"}
            </button>
          ) : (
            <button
              onClick={() => router.push("/attendance")}
              className="btn-gleam bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </nav>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel */}
        <div className="flex flex-col flex-1 p-5 gap-4 overflow-y-auto bg-[#0d0d14]">

          {/* Camera */}
          <div className="relative rounded-2xl overflow-hidden bg-[#13131f] border border-violet-500/20 aspect-video shadow-lg shadow-violet-950/30">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
            {sessionEnded && (
              <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-black mb-1">Session Complete</p>
                  <p className="text-gray-400 text-sm">{presentNames.length} present · {absentNames.length} absent</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
              <div className="flex gap-2">
                <span className="bg-black/70 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full border border-white/10 text-green-400">
                  ✓ {presentNames.length} present
                </span>
                <span className="bg-black/70 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-400">
                  {absentNames.length} not scanned
                </span>
              </div>
              <span className="bg-violet-600/80 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full font-semibold">
                {presentPct}%
              </span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-green-950/60 to-[#13131f] border border-green-500/25 rounded-2xl p-4 text-center shadow-md">
              <p className="text-3xl font-black text-green-400">{presentNames.length}</p>
              <p className="text-xs text-green-600 mt-1 uppercase tracking-widest font-medium">Present</p>
            </div>
            <div className="bg-gradient-to-br from-red-950/60 to-[#13131f] border border-red-500/25 rounded-2xl p-4 text-center shadow-md">
              <p className="text-3xl font-black text-red-400">{absentNames.length}</p>
              <p className="text-xs text-red-700 mt-1 uppercase tracking-widest font-medium">Absent</p>
            </div>
            <div className="bg-gradient-to-br from-violet-950/60 to-[#13131f] border border-violet-500/25 rounded-2xl p-4 text-center shadow-md">
              <p className="text-3xl font-black text-violet-400">{presentPct}%</p>
              <p className="text-xs text-violet-700 mt-1 uppercase tracking-widest font-medium">Rate</p>
            </div>
          </div>

          {/* Live feed */}
          <div className="bg-gradient-to-b from-[#13131f] to-[#0f0f18] border border-white/10 rounded-2xl p-4 flex-1 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Detection Feed</h3>
              {wsStatus === "live" && !sessionEnded && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>
            {sessionLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                <p className="text-gray-600 text-sm">Scanning for faces...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {sessionLog.map((entry, i) => (
                  <div key={i} className={`flex items-center justify-between text-sm py-1.5 px-3 rounded-lg ${i === 0 ? "bg-green-500/10 border border-green-500/20" : "bg-white/3"}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-900/60 flex items-center justify-center text-xs font-bold text-green-300">
                        {entry.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{entry.name}</span>
                      <span className="text-gray-500 text-xs">checked in</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-green-400">{Math.round(entry.confidence * 100)}%</span>
                      <span>{entry.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right roster panel */}
        <div className="w-64 bg-[#0f0f18] border-l border-violet-500/10 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-violet-500/10 bg-[#13131f]">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Roster</h3>
            <p className="text-xs text-gray-600 mt-0.5">{registeredFaces.length} enrolled</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {presentNames.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-green-400 px-1">Present · {presentNames.length}</p>
                {presentNames.map(name => (
                  <div key={name} className="slide-in-right flex items-center gap-2.5 bg-green-500/8 border border-green-500/15 rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-green-900/50 flex items-center justify-center text-xs font-bold text-green-300 flex-shrink-0">
                      {name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-gray-500">{presentMap[name]?.time}</p>
                    </div>
                    <span className="ml-auto text-green-400 text-xs">✓</span>
                  </div>
                ))}
              </div>
            )}

            {absentNames.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 px-1">Not Scanned · {absentNames.length}</p>
                {absentNames.map(name => (
                  <div key={name} className="flex items-center gap-2.5 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 opacity-50">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                      {name[0].toUpperCase()}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{name}</p>
                  </div>
                ))}
              </div>
            )}

            {registeredFaces.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-12">No enrolled people</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
