// React ports of the Halftone Design System primitives used by the mockups
// (Button, Tag, Input, Window). Styling lives in app/globals.css.
import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "chip" | "solid" | "window";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: Size;
  /** Render as a Next.js link instead of a <button>. */
  href?: string;
};

export function Button({ variant = "chip", size = "md", href, className = "", children, style, ...rest }: ButtonProps) {
  const cls = `btn btn-${variant} btn-${size} ${className}`.trim();
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} style={style} {...rest}>
      {children}
    </button>
  );
}

export function Tag({ tone = "ink", children }: { tone?: "ink" | "accent" | "outline" | "paper"; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };

export function Input({ label, ...rest }: InputProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <input {...rest} />
    </label>
  );
}

type WindowProps = {
  title?: ReactNode;
  tone?: "gray" | "white";
  width?: number | string;
  padding?: number | string;
  children: ReactNode;
  style?: CSSProperties;
};

export function Window({ title, tone = "gray", width, padding = 6, children, style }: WindowProps) {
  return (
    <div className={`win win-${tone}`} style={{ width, maxWidth: "100%", ...style }}>
      {title != null && <div className="win-title">{title}</div>}
      <div className="win-body" style={{ padding }}>
        {children}
      </div>
    </div>
  );
}
