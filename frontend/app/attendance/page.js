"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Attendance() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/auth/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          localStorage.removeItem("token");
          router.push("/login");
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null; // redirect already happened
  }

  const handleRegisterFace = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const formData = new FormData(e.target);

    try {
      const res = await fetch("http://127.0.0.1:8000/register-faces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert("Face registered successfully.");
        e.target.reset();
      } else {
        alert(data.detail || "Registration failed.");
      }
    } catch (err) {
      console.error("Error during face registration:", err);
      alert("An error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div className="p-8 space-y-8">
          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Attendance Overview
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Welcome, <span className="text-white font-medium">{user.username}</span>. Track student check-ins and attendance logs here.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-800 text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr className="hover:bg-gray-800">
                    <td className="px-4 py-3 text-white">Jane Doe</td>
                    <td className="px-4 py-3 text-gray-300">Aug 2, 2025</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-green-700 text-green-100 rounded-full">
                        Present
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800">
                    <td className="px-4 py-3 text-white">John Smith</td>
                    <td className="px-4 py-3 text-gray-300">Aug 2, 2025</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-red-700 text-red-100 rounded-full">
                        Absent
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Register Face Section */}
          <div className="p-6 bg-gray-800 rounded-xl space-y-4">
            <h3 className="text-xl text-white font-semibold">Register a New Face</h3>
            <form onSubmit={handleRegisterFace} className="flex flex-col gap-4">
              <input
                type="text"
                name="name"
                placeholder="Student Name"
                className="p-2 rounded bg-gray-700 text-white"
                required
              />
              <input
                type="file"
                name="file"
                accept="image/*"
                className="text-white"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
              >
                Register Face
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
