// app/page.js

// app/page.tsx or app/home/page.tsx (depending on your routing)
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl text-center">
        {/* Navigation */}
        <nav className="absolute top-6 right-6 flex space-x-6 text-sm font-medium text-gray-300">
          <a
            href="/"
            className="hover:text-white transition-colors duration-200"
          >
            Home
          </a>
          <a
            href="/login"
            className="hover:text-white transition-colors duration-200"
          >
            Login
          </a>
        </nav>

        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold text-gray-800 dark:text-white">
            Smart Attendance Tracker
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Effortless, secure, AI-powered check-ins built for the modern
            classroom or office.
          </p>
          <div className="mt-8">
            <a
              href="/login"
              className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
// This is the main page of your application, styled with Tailwind CSS.