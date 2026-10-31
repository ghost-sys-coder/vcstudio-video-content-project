"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readSelectItems } from "@/lib/ui/select-items";

export function FormSelect({
  children,
  className,
  defaultValue,
  disabled,
  id,
  name,
  onValueChange,
  required,
  value,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  defaultValue?: string | number;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  value?: string | number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const items = readSelectItems(children);
  const [initialValue] = useState(() =>
    defaultValue === undefined ? (items[0]?.value ?? "") : String(defaultValue),
  );
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Base UI owns the hidden form input; preserve native form/reset behavior for
  // the uncontrolled fields that previously used a native select.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || value !== undefined) return;
    function reset(event: Event) {
      queueMicrotask(() => {
        if (!event.defaultPrevented) setSelectedValue(initialValue);
      });
    }
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initialValue, value]);

  return (
    <Select
      disabled={disabled}
      inputRef={inputRef}
      items={items}
      name={name}
      onValueChange={(nextValue) => {
        if (nextValue === null) return;
        if (value === undefined) setSelectedValue(nextValue);
        onValueChange?.(nextValue);
      }}
      required={required}
      value={value === undefined ? selectedValue : String(value)}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={className}
        id={id}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
