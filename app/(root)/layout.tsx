import Script from "next/script";
import { LANGUAGE_REDIRECT_SCRIPT } from "@/lib/language";
import { rootMetadata } from "@/lib/metadata";

export const metadata = rootMetadata;

export default function RootGateLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <Script id="snacksmate-lang-redirect" strategy="beforeInteractive">
          {LANGUAGE_REDIRECT_SCRIPT}
        </Script>
        <noscript>
          <meta http-equiv="refresh" content="0;url=/en/" />
        </noscript>
        {children}
      </body>
    </html>
  );
}
