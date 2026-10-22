"use client"; // password-visibility toggle needs client state

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Renders a small message under the input in the destructive color. */
  error?: string;
}

/**
 * Floating-label input (label overlaps the top border) — matches the Figma "Input Field/lg - 52px"
 * component used across the auth screens (Sign In/Sign Up/Reset Password/Set New Password).
 * `type="password"` gets a built-in show/hide toggle in place of the Figma eye icon.
 */
export function FloatingInput({ className, label, error, id, type, ...props }: FloatingInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={inputId}
          data-slot="floating-input"
          type={isPassword ? (visible ? "text" : "password") : type}
          className={cn(
            "peer flex h-[52px] w-full rounded-[14px] border border-input bg-card px-4 py-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            isPassword && "pr-11",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="pointer-events-none absolute -top-2.5 left-3 rounded-[4px] bg-card px-1 text-xs font-medium text-foreground"
        >
          {label}
        </label>
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
