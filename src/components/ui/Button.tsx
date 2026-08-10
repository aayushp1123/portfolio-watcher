import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-teal-600 text-white hover:opacity-90 disabled:bg-line disabled:text-ink-500 disabled:opacity-100",
  secondary:
    "bg-paper-0 text-ink-700 border border-line hover:border-teal-600 hover:text-teal-600 disabled:hover:border-line disabled:hover:text-ink-500 disabled:text-ink-500",
  ghost: "text-teal-600 hover:underline disabled:text-ink-500 disabled:no-underline",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
