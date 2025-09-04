"use client";

import { useEffect, useRef, useState } from "react";

export default function LiveAttendance() {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const [results, setResults] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  useEffect(() => {
    // Fix WebSocket URL construction
    const wsUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL.replace(/^https?/, "ws")}/ws/live-attendance`
      : "ws://localhost:8000/ws/live-attendance"; // fallback

    console.log("Connecting to WebSocket:", wsUrl);

    // Connect to WebSocket
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("WebSocket connection open");
      setConnectionStatus("Connected");
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setResults(data);
        } else {
          console.error("Unexpected WS data:", data);
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error("WS error:", err);
      setConnectionStatus("Error");
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      setConnectionStatus("Disconnected");
    };

    // Start webcam with proper error handling
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Wait for video metadata to load before playing
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(err => {
              console.error("Video play error:", err);
            });
          };
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setConnectionStatus("Camera Error");
      }
    };

    initCamera();

    // Send frames periodically (reduced frequency to prevent overload)
    const interval = setInterval(() => {
      if (
        videoRef.current && 
        wsRef.current && 
        wsRef.current.readyState === WebSocket.OPEN &&
        videoRef.current.videoWidth > 0 // ensure video is loaded
      ) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoRef.current, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8); // reduce quality for faster transfer
          wsRef.current.send(dataUrl);
        } catch (err) {
          console.error("Frame capture error:", err);
        }
      }
    }, 2000); // Increased to 2 seconds to reduce load

    return () => {
      clearInterval(interval);
      
      // Clean up video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Live Attendance</h1>
        
        {/* Connection status */}
        <div className="mb-4 text-center">
          <span className={`px-3 py-1 rounded ${
            connectionStatus === "Connected" ? "bg-green-600" :
            connectionStatus === "Connecting..." ? "bg-yellow-600" :
            "bg-red-600"
          }`}>
            {connectionStatus}
          </span>
        </div>

        <video 
          ref={videoRef} 
          className="w-full h-auto rounded-lg mb-6" 
          muted // Important: prevents audio feedback
          playsInline // Important for mobile
        />

        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-gray-400 text-center">No faces detected</p>
          ) : (
            results.map((res, idx) => (
              <p
                key={idx}
                className={
                  res.status === "present" ? "text-green-500" : "text-red-500"
                }
              >
                {res.name || "Unknown"}: {res.status}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}