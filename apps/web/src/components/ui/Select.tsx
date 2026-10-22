"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  className?: string;
}

export function Select({ id, label, value, options, onValueChange, className = "" }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger id={id} className={`select-trigger ${className}`} aria-label={label}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon><ChevronDown size={15} aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="select-content" position="popper" sideOffset={5}>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item className="select-item" key={option.value} value={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-indicator">
                  <Check size={14} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
