import Link from "next/link";
import { Radar } from "lucide-react";

export default function RadarNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Radar className="w-8 h-8 text-gray-300" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[#303549] mb-2">Position not found</h1>
        <p className="text-sm text-gray-400 max-w-xs">
          This network or wallet address was not found in our radar data.
        </p>
      </div>
      <Link
        href="/radar"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5382E3] text-white rounded-lg hover:bg-[#4371D0] transition-colors text-sm font-medium"
      >
        Back to Radar
      </Link>
    </div>
  );
}
