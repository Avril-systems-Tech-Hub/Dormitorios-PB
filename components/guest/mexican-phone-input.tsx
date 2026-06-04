"use client";

import { MEXICO_PHONE_PREFIX, sanitizeMexicanPhoneInput } from "@/lib/phone";
import { cn } from "@/lib/utils";

type MexicanPhoneInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

/** Guest flows only: fixed +52 prefix, user enters 10-digit Mexican mobile. */
export function MexicanPhoneInput({
  id,
  name,
  value,
  onChange,
  placeholder = "5512345678",
  disabled,
  required,
  className,
}: MexicanPhoneInputProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-full overflow-hidden rounded-lg border border-border-soft bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/40",
        disabled && "opacity-60",
        className,
      )}
    >
      <span
        className="flex shrink-0 items-center border-r border-border-soft bg-gray-50 px-3 text-sm font-medium tabular-nums text-text-main"
        aria-hidden
      >
        {MEXICO_PHONE_PREFIX}
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={10}
        value={value}
        onChange={(event) => onChange(sanitizeMexicanPhoneInput(event.target.value))}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-text-main placeholder:text-text-muted focus-visible:outline-none"
        aria-label={`Teléfono celular, ${MEXICO_PHONE_PREFIX} más 10 dígitos`}
      />
    </div>
  );
}
