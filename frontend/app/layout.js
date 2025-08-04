// app/layout.js
import './globals.css';
import Link from 'next/link';

// app/layout.js

export const metadata = {
  title: "Smart Attendance Tracker",
  description: "Effortless, secure, AI-powered check-ins",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
