import { rootMetadata } from "@/lib/metadata";

export const metadata = rootMetadata;
export const dynamic = "force-dynamic";

export default function RootGateLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
