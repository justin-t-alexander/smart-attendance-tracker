"use client";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-700 opacity-20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-900 opacity-20 rounded-full blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="absolute top-6 right-8 flex space-x-6 text-sm font-medium text-gray-400">
        <a href="/" className="hover:text-white transition-colors duration-200">Home</a>
        <a href="/login" className="hover:text-white transition-colors duration-200">Login</a>
      </nav>

      {/* Hero */}
      <div className="w-full max-w-2xl text-center space-y-6 z-10">

        {/* Badge */}
        <div className="fade-in-up inline-flex items-center gap-2 bg-violet-950 border border-violet-700 text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          AI-Powered
        </div>

        {/* Title */}
        <h1 className="fade-in-up-delay-1 text-6xl font-black tracking-tight leading-tight">
          Smart{" "}
          <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            Attendance
          </span>
          <br />
          Tracker
        </h1>

        {/* Subtitle */}
        <p className="fade-in-up-delay-2 text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
          Effortless, secure face recognition check-ins built for the modern classroom.
        </p>

        {/* CTA */}
        <div className="fade-in-up-delay-3 flex items-center justify-center gap-4 pt-2">
          <a
            href="/login"
            className="btn-gleam bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-violet-900/40"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="btn-gleam text-gray-400 hover:text-white font-medium py-3 px-6 rounded-xl border border-gray-700 hover:border-violet-500 transition-colors duration-200"
          >
            Sign In
          </a>
        </div>

        {/* Feature pills */}
        <div className="fade-in-up-delay-4 flex flex-wrap justify-center gap-3 pt-6">
          {["Face Recognition", "Live Detection", "Attendance Logs", "Multi-User"].map((f) => (
            <span key={f} className="card-hover text-xs text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full cursor-default">
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
