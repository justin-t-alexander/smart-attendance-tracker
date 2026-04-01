"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });
    if (result?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/attendance");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-700 opacity-15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-900 opacity-15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">

        {/* Back link */}
        <a href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-8 transition-colors duration-200">
          ← Back
        </a>

        {/* Card */}
        <div className="fade-in-up bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 backdrop-blur-sm">

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-gray-400 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-xl">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-gleam w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-violet-900/30 mt-2"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <button
              onClick={() => router.push("/user-registration")}
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors duration-200"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
