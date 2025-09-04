"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
      // Call your backend registration endpoint
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      // Auto-login after registration
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.03] cursor-pointer">
        <div className="p-8 space-y-6">
          <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white tracking-tight">
            Create an Account
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            Fill in your credentials to join the classroom.
          </p>

          <form className="space-y-6" onSubmit={handleRegister}>
            <div>
              <label
                htmlFor="username"
                className="block mb-1 text-sm text-gray-700 dark:text-gray-300 font-semibold"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-sky-400 dark:focus:ring-sky-600 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block mb-1 text-sm text-gray-700 dark:text-gray-300 font-semibold"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-sky-400 dark:focus:ring-sky-600 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block mb-1 text-sm text-gray-700 dark:text-gray-300 font-semibold"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-sky-400 dark:focus:ring-sky-600 transition-all duration-200"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm font-medium">{error}</div>
            )}
            {message && (
              <div className="text-green-500 text-sm font-medium">{message}</div>
            )}

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105"
            >
              Register
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
