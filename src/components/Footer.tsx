import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line px-4 py-6 text-center text-xs text-ink-500">
      <p>
        &copy; {new Date().getFullYear()} Portfolio Watcher ·{" "}
        <Link href="/terms" className="hover:text-teal-600">
          Terms of Service
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-teal-600">
          Privacy Policy
        </Link>
      </p>
    </footer>
  );
}
