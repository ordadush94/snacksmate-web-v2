import Link from "next/link";

export default function LanguageGatePage() {
  return (
    <>
      <style>{`
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          font: 500 17px/1.4 system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
          background: #fffaf2;
          color: #23201c;
        }
        a { color: #23201c; }
      `}</style>
      <Link href="/en">English</Link>
      <Link href="/he" lang="he">
        עברית
      </Link>
    </>
  );
}
