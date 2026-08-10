import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`rounded-lg border border-line bg-paper-0 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-crit-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
