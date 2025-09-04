"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function Attendance() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !name) {
      setMessage("Please provide a name and select a file.");
      return;
    }

    if (!session?.accessToken) {
      setMessage("You must be logged in to register a face.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("name", name);

    try {
      const response = await fetch("http://localhost:8000/api/register-faces", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (response.ok) {
        setMessage("Face registered successfully!");
        setName("");
        setSelectedFile(null);
      } else {
        const data = await response.json();
        setMessage(data.detail || "Upload failed.");
      }
    } catch (error) {
      setMessage("Error uploading file.");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-8">Smart Attendance Tracker</h1>

      <div className="p-6 bg-gray-800 rounded-xl space-y-4 w-full max-w-md shadow-lg">
        <div>
          <label className="block mb-2 text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium">Upload Face Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full"
          />
        </div>

        <button
          onClick={handleUpload}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
        >
          Register Face
        </button>

        {message && (
          <p className="text-center text-sm text-yellow-400">{message}</p>
        )}
      </div>

      {/* Buttons Container */}
      <div className="pt-6 flex flex-col items-center space-y-4">
        <button
          onClick={() => router.push("/registered-faces")}
          className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-full transition-colors"
        >
          View Registered Faces
        </button>

        <button
          onClick={() => router.push("/live-attendance")}
          className="bg-sky-600 hover:bg-sky-700 text-white py-2 px-6 rounded-full transition-colors"
        >
          Start Live Attendance
        </button>
      </div>
    </div>
  );
}
