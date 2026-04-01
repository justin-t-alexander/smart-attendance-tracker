"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); // eslint-disable-line
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!username || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        setError("Registration succeeded but auto-login failed");
      } else {
        router.push("/attendance");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred during registration");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-700 opacity-15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-purple-900 opacity-15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">

        {/* Back link */}
        <a href="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-8 transition-colors duration-200">
          ← Back to login
        </a>

        {/* Card */}
        <div className="fade-in-up bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 backdrop-blur-sm">

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="text-gray-400 text-sm">Get started with Smart Attendance</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
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
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-xl">
                <span>⚠</span> {error}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-2.5 rounded-xl">
                <span>✓</span> {message}
              </div>
            )}

            <button
              type="submit"
              className="btn-gleam w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-violet-900/30 mt-2"
            >
              Create Account
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors duration-200">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
