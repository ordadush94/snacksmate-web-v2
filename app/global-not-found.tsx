import type { Metadata } from "next";
import { fontClassName } from "@/app/fonts";
import { NotFoundScreen } from "@/components/site/NotFoundScreen";
import "./globals.css";

export const metadata: Metadata = {
  title: "Page not found",
};

const directionScript = `(function(){var p=location.pathname;var he=p==="/he"||p.indexOf("/he/")===0;document.documentElement.lang=he?"he":"en";document.documentElement.dir=he?"rtl":"ltr";})();`;

export default function GlobalNotFound() {
  return (
    <html className={fontClassName}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: directionScript }} />
      </head>
      <body>
        <NotFoundScreen />
      </body>
    </html>
  );
}
