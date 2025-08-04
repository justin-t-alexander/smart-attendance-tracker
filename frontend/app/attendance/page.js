export default function Attendance() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div className="p-8 space-y-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Attendance Overview
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Track student check-ins and attendance logs here.
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
      </div>
    </div>
  );
}
