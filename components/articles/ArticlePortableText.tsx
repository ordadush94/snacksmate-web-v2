import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";

const components: PortableTextComponents = {
  marks: {
    link: ({ value, children }) => {
      const href = typeof value?.href === "string" ? value.href : "";
      const external = /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {children}
        </a>
      );
    },
  },
};

type ArticlePortableTextProps = {
  value: PortableTextBlock[];
};

export function ArticlePortableText({ value }: ArticlePortableTextProps) {
  return <PortableText value={value} components={components} />;
}
