import Link from "next/link";
import { FaXTwitter, FaGithub } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
        <span className="text-center sm:text-left">
          &copy; {new Date().getFullYear()} Projection Finance — created by{" "}
          <a href="https://github.com/maximedotair" target="_blank" rel="noopener noreferrer" className="hover:text-[#303549] transition-colors underline">maximedotair</a>
        </span>

        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-[#303549] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#303549] transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-[#303549] transition-colors">
            Contact
          </Link>
          <a
            href="https://github.com/projection-finance/web"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="hover:text-[#303549] transition-colors"
          >
            <FaGithub className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://x.com/projection_fi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="hover:text-[#303549] transition-colors"
          >
            <FaXTwitter className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
