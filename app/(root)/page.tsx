import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { localeHomePath, preferredLocale } from "@/lib/language";
import { LANG_COOKIE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function LanguageGatePage({
  searchParams,
}: PageProps<"/">) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = preferredLocale({
    cookie: cookieStore.get(LANG_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }
  redirect(localeHomePath(locale, query.toString()));
}
