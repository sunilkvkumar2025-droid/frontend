// File: components/layout/TopNav.tsx
// Fixed top navigation bar for the application

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";

export default function TopNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: Logo/Avatar */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="font-semibold text-lg">Coco</span>
        </div>

        {/* Right: User Menu */}
        <div className="relative">
          {user && (
            <>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-2xl hover:opacity-70 transition-opacity"
              >
                ☰
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-zinc-700">
                    <div className="text-sm text-neutral-400">Signed in as</div>
                    <div className="text-white font-medium truncate">{user.email}</div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlay to close menu when clicking outside */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowMenu(false)}
        />
      )}
    </nav>
  );
}
