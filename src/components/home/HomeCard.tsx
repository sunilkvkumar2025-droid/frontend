// File: components/home/HomeCard.tsx
// Reusable card component for home page actions

"use client";

import Link from "next/link";

type HomeCardProps = {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonHref?: string;
  onClick?: () => void;
  gradient: "warm" | "cool";
  icon?: string;
  badge?: string;
  loading?: boolean;
};

export default function HomeCard({
  title,
  subtitle,
  buttonText,
  buttonHref,
  onClick,
  gradient,
  icon,
  badge,
  loading = false,
}: HomeCardProps) {
  const gradientClasses = {
    warm: "bg-gradient-to-br from-pink-300 via-orange-200 to-yellow-200",
    cool: "bg-gradient-to-br from-blue-300 via-cyan-200 to-green-200",
  };

  return (
    <div
      className={`${gradientClasses[gradient]} rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 min-h-[280px] flex flex-col`}
    >
      {/* TODAY label */}
      <div className="text-xs uppercase opacity-70 tracking-wider mb-3 text-zinc-800 font-semibold">
        TODAY
      </div>

      {/* Icon */}
      {icon && <div className="text-4xl mb-3">{icon}</div>}

      {/* Title */}
      <h2 className="text-2xl font-bold mb-2 text-zinc-900">{title}</h2>

      {/* Badge */}
      {badge && (
        <div className="inline-block mb-3">
          <span className="text-xs bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full font-semibold text-zinc-800">
            {badge}
          </span>
        </div>
      )}

      {/* Subtitle */}
      <p className="text-sm opacity-80 mb-6 text-zinc-800">{subtitle}</p>

      {/* Button - pushed to bottom with mt-auto */}
      <div className="mt-auto">
        {onClick ? (
          <button
            onClick={onClick}
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-100 disabled:bg-zinc-200 disabled:opacity-50 text-zinc-900 font-semibold px-6 py-3 rounded-full transition-colors shadow-md"
          >
            {loading ? "Loading..." : buttonText}
          </button>
        ) : buttonHref ? (
          <Link href={buttonHref}>
            <button className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold px-6 py-3 rounded-full transition-colors shadow-md">
              {buttonText}
            </button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
