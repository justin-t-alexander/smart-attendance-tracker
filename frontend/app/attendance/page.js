"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


// ── Small reusable stat card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "violet" }) {
  const ring = color === "violet" ? "border-violet-500/30" : color === "green" ? "border-green-500/30" : "border-purple-500/30";
  const text = color === "violet" ? "text-violet-400" : color === "green" ? "text-green-400" : "text-purple-400";
  return (
    <div className={`card-hover bg-white/5 border ${ring} rounded-2xl p-5`}>
      <p className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-black ${text}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ── Register face modal ───────────────────────────────────────────────────────
function RegisterModal({ session, onClose, onRegistered }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!name || !file) { setMsg("Name and image are required."); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    try {
      const res = await fetch(`${API}/api/register-faces`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("✓ Registered successfully!");
        setName(""); setFile(null);
        onRegistered();
      } else {
        setMsg(data.detail || "Upload failed.");
      }
    } catch {
      setMsg("Error uploading file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Register Person</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Justin Alexander"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Face Image</label>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            onChange={e => setFile(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:text-sm file:font-medium hover:file:bg-violet-500 transition-all"
          />
          {file && <p className="text-xs text-gray-500">{file.name}</p>}
        </div>

        {msg && (
          <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith("✓") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {msg}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all duration-200"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [faces, setFaces] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  const fetchFaces = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${API}/api/registered-faces`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (res.ok) setFaces(await res.json());
    } catch {}
  };

  const fetchLogs = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${API}/api/attendance`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (res.ok) setLogs(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchFaces();
      fetchLogs();
    }
  }, [session]);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const filteredLogs = selectedPerson === "all"
    ? logs
    : logs.filter(l => l.name === selectedPerson);

  const totalPresent = filteredLogs.length;
  const uniqueDays = [...new Set(filteredLogs.map(l => l.date))].length;
  const totalRegistered = faces.length;

  // Attendance trend by date
  const trendMap = {};
  filteredLogs.forEach(l => {
    trendMap[l.date] = (trendMap[l.date] || 0) + 1;
  });
  const trendData = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, present]) => ({ date: date.slice(5), present }));

  // Attendance by day of week - parse date as local to avoid timezone off-by-one
  const dayMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
  filteredLogs.forEach(l => {
    const [y, m, d] = l.date.split("-").map(Number);
    const day = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
    if (day in dayMap) dayMap[day]++;
  });
  const byDayData = Object.entries(dayMap).map(([day, present]) => ({ day, present }));

  const hasData = trendData.length >= 1;
  const hasDayData = Object.values(dayMap).some(v => v > 0);

  if (status === "loading") return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {showRegister && (
        <RegisterModal
          session={session}
          onClose={() => setShowRegister(false)}
          onRegistered={() => { fetchFaces(); setShowRegister(false); }}
        />
      )}

      {/* Top nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-violet-400 animate-pulse shadow-lg shadow-violet-500/50" />
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
              Smart Attendance
            </span>
            <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-500/50" />
          </div>
          <span className="text-xs text-gray-600 tracking-widest uppercase">AI-Powered Tracking</span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <span className="text-gray-500 text-sm">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-gleam text-xs text-gray-500 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Welcome back, {session?.user?.name}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRegister(true)}
              className="btn-gleam flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium px-4 py-2.5 rounded-xl"
            >
              + Register Person
            </button>
            <button
              onClick={() => router.push("/live-attendance")}
              className="btn-gleam flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-900/30"
            >
              ▶ Start Attendance
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 fade-in-up-delay-1">
          <StatCard label="Registered" value={totalRegistered} sub="people enrolled" color="violet" />
          <StatCard label="Check-ins" value={totalPresent} sub={`across ${uniqueDays} day${uniqueDays !== 1 ? "s" : ""}`} color="green" />
          <StatCard label="Avg / Day" value={uniqueDays > 0 ? (totalPresent / uniqueDays).toFixed(1) : "—"} sub="attendees per session" color="purple" />
        </div>

        {/* Main content: charts + roster */}
        <div className="grid grid-cols-3 gap-6">

          {/* Charts - left 2/3 */}
          <div className="col-span-2 space-y-6">

            {/* Person filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedPerson("all")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedPerson === "all" ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
              >
                All People
              </button>
              {faces.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedPerson(f.name)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedPerson === f.name ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Attendance trend */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4">Attendance Trend</h2>
              {!hasData ? (
                <div className="flex flex-col items-center justify-center h-[180px] gap-2">
                  <p className="text-gray-600 text-sm">No sessions recorded yet</p>
                  <p className="text-gray-700 text-xs">Run a live session to see trends</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#12121a", border: "1px solid #ffffff15", borderRadius: 12, color: "#fff" }} />
                    <Area type="monotone" dataKey="present" stroke="#7c3aed" strokeWidth={2} fill="url(#grad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By day of week */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4">Attendance by Day of Week</h2>
              {!hasDayData ? (
                <div className="flex flex-col items-center justify-center h-[160px] gap-2">
                  <p className="text-gray-600 text-sm">No data yet</p>
                  <p className="text-gray-700 text-xs">Attendance patterns will appear here</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={byDayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#12121a", border: "1px solid #ffffff15", borderRadius: 12, color: "#fff" }} />
                    <Bar dataKey="present" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Roster - right 1/3 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Registered People</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-lg">{faces.length}</span>
                {faces.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm("Remove all registered people?")) return;
                      await fetch(`${API}/reset-faces`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${session.accessToken}` },
                      });
                      fetchFaces();
                    }}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2 py-1 rounded-lg transition-all"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {faces.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl">👤</div>
                <p className="text-gray-500 text-sm">No one registered yet</p>
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  + Add someone
                </button>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {faces.map(face => (
                  <div
                    key={face.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${selectedPerson === face.name ? "bg-violet-600/20 border border-violet-500/30" : "bg-white/5 hover:bg-white/10 border border-transparent"}`}
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => setSelectedPerson(selectedPerson === face.name ? "all" : face.name)}
                    >
                      {face.image_data ? (
                        <img
                          src={`data:image/jpeg;base64,${face.image_data}`}
                          alt={face.name}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-500/30 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                          {face.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{face.name}</p>
                        <p className="text-xs text-gray-500">
                          {logs.filter(l => l.name === face.name).length} check-ins
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Remove ${face.name}?`)) return;
                        await fetch(`${API}/api/registered-faces/${face.id}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${session.accessToken}` },
                        });
                        if (selectedPerson === face.name) setSelectedPerson("all");
                        fetchFaces();
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs px-1.5 py-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowRegister(true)}
              className="mt-4 w-full text-sm text-gray-500 hover:text-white border border-dashed border-white/10 hover:border-white/20 py-2.5 rounded-xl transition-all"
            >
              + Register someone
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
