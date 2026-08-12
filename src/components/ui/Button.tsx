import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-teal-600 text-white shadow-sm hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:bg-line disabled:text-ink-500 disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:shadow-sm",
  secondary:
    "bg-paper-0 text-ink-700 border border-line hover:-translate-y-0.5 hover:border-teal-600 hover:text-teal-600 hover:shadow-sm active:translate-y-0 active:scale-[0.98] disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:text-ink-500 disabled:text-ink-500",
  ghost: "text-teal-600 hover:underline active:scale-[0.98] disabled:text-ink-500 disabled:no-underline",
  danger:
    "bg-crit-600 text-white shadow-sm hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:bg-line disabled:text-ink-500 disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:shadow-sm",
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
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 ease-out disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
