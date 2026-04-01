"use client";

import { useEffect, useRef, useState } from "react";

export default function LiveAttendance() {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const [results, setResults] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  useEffect(() => {
    // Fix WebSocket URL construction
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^https?/, "ws") + "/ws/live-attendance";

    console.log("API URL:", apiUrl);
    console.log("WebSocket URL:", wsUrl);

    // First, verify backend is running
    fetch(`${apiUrl}/test`)
      .then(res => res.json())
      .then(data => console.log("Backend is running:", data))
      .catch(err => {
        console.error("Backend is not responding:", err);
        setConnectionStatus("Backend Error");
      });

    // Connect to WebSocket
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("✓ WebSocket OPENED");
      setConnectionStatus("Connected");
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setResults(data);
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    wsRef.current.onerror = () => {
      console.log("✗ WebSocket ERROR - ReadyState:", wsRef.current?.readyState);
      setConnectionStatus("Connection Error");
    };

    wsRef.current.onclose = (event) => {
      console.log("✗ WebSocket CLOSED - Code:", event.code, "Reason:", event.reason);
      setConnectionStatus("Disconnected");
    };

    // Start webcam with proper error handling
    const initCamera = async () => {
      try {
        // Request permission first so Safari reveals device labels
        await navigator.mediaDevices.getUserMedia({ video: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        console.log("Available cameras:", videoDevices.map(d => d.label));

        const iPhoneCamera = videoDevices.find(d =>
          (d.label.toLowerCase().includes("iphone") ||
           d.label.toLowerCase() === "ok camera") &&
          !d.label.toLowerCase().includes("desk")
        );
        const macCamera = videoDevices.find(d =>
          d.label.toLowerCase().includes("facetime") ||
          d.label.toLowerCase().includes("built-in")
        );
        const selectedDevice = iPhoneCamera || macCamera || videoDevices[0];
        console.log("Using camera:", selectedDevice?.label);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDevice?.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
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

    // Send frames frequently for better accuracy
    const interval = setInterval(() => {
      if (
        videoRef.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        videoRef.current.videoWidth > 0
      ) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoRef.current, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          wsRef.current.send(dataUrl);
        } catch (err) {
          console.error("Frame capture error:", err);
        }
      }
    }, 500); // 500ms = 2 fps - faster detection without overwhelming backend

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
          muted
          playsInline
          autoPlay
        />

        <div className="space-y-3">
          {results.length === 0 ? (
            <p className="text-gray-400 text-center">No faces detected</p>
          ) : (
            results.map((res, idx) => {
              let bgColor = "bg-gray-700";
              let textColor = "text-gray-300";

              if (res.status === "present") {
                bgColor = "bg-green-900";
                textColor = "text-green-400";
              } else if (res.status === "too_dark") {
                bgColor = "bg-yellow-900";
                textColor = "text-yellow-400";
              } else if (res.status === "blurry") {
                bgColor = "bg-orange-900";
                textColor = "text-orange-400";
              } else if (res.status === "unknown") {
                bgColor = "bg-red-900";
                textColor = "text-red-400";
              }

              return (
                <div key={idx} className={`${bgColor} p-3 rounded`}>
                  <p className={`${textColor} font-semibold`}>
                    {res.name || "Unknown"}: {res.status}
                  </p>
                  {res.confidence !== undefined && (
                    <p className="text-gray-300 text-sm">
                      Confidence: {(res.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}