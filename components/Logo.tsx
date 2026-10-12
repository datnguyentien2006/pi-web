"use client";

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  /** "accent" = gradient teal (mặc định).
   *  "mono" = kế thừa currentColor (dùng trên nền có sẵn màu). */
  variant?: "accent" | "mono";
}

/**
 * Logo mark: chữ π hình học trong ô vuông bo góc.
 * Dùng cho favicon, sidebar header, avatar assistant.
 */
export function LogoMark({ size = 32, variant = "accent" }: LogoMarkProps) {
  const reactId = useId();
  const gradientId = `pi-logo-grad-${reactId.replace(/:/g, "")}`;

  if (variant === "mono") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Pi Agent"
        role="img"
        style={{ display: "block", flexShrink: 0 }}
      >
        <path
          d="M 15 25 L 85 25 L 85 40 L 75 40 L 75 85 L 60 85 L 60 40 L 40 40 L 40 85 L 25 85 L 25 40 L 15 40 Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pi Agent"
      role="img"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="24"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M 15 25 L 85 25 L 85 40 L 75 40 L 75 85 L 60 85 L 60 40 L 40 40 L 40 85 L 25 85 L 25 40 L 15 40 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

interface PiWordmarkProps {
  size?: "sm" | "md" | "lg";
}

/**
 * Wordmark: logo mark + chữ "Pi Agent".
 * Dùng cho top bar giữa.
 */
export function PiWordmark({ size = "md" }: PiWordmarkProps) {
  const sizes = {
    sm: { logo: 20, text: 13 },
    md: { logo: 24, text: 15 },
    lg: { logo: 32, text: 18 },
  };
  const { logo, text } = sizes[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
      }}
    >
      <LogoMark size={logo} />
      <span
        style={{
          fontSize: text,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--text)",
          fontFamily: "var(--font-mono)",
          lineHeight: 1,
        }}
      >
        Pi Agent
      </span>
    </div>
  );
}