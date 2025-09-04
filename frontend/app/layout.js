// app/layout.js
import './globals.css';
import ClientProviders from './ClientProviders';

export const metadata = {
  title: "Smart Attendance Tracker",
  description: "Effortless, secure, AI-powered check-ins",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
