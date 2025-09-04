"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function RegisteredFaces() {
  const { data: session } = useSession();
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.accessToken) return;

    console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("API URL is not defined. Check .env.local and restart dev server.");
      setLoading(false);
      return;
    }

    const fetchFaces = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/registered-faces`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch registered faces");
        }

        const data = await res.json();
        setFaces(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFaces();
  }, [session]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Registered Faces</h1>

        {loading && <p className="text-center">Loading...</p>}

        {error && <p className="text-center text-red-500">Error: {error}</p>}

        {!loading && faces.length === 0 && (
          <p className="text-center text-gray-400">No registered faces found.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {faces.map((face, idx) => (
            <div
              key={idx}
              className="bg-[#1e293b] p-4 rounded-xl shadow hover:shadow-lg transition duration-200"
            >
              <div className="w-full h-48 flex items-center justify-center bg-gray-900 rounded-md mb-4">
                <img
                  src={`data:image/jpeg;base64,${face.image}`}
                  alt={`Face ${idx}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <p className="text-center text-lg font-medium">{face.name || "Unnamed"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
