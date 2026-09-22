import type { ElementType, ReactNode } from "react";

type RevealProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

export function Reveal({ as: Tag = "span", className = "", children }: RevealProps) {
  return (
    <Tag className={className ? `reveal ${className}` : "reveal"}>{children}</Tag>
  );
}
