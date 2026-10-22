"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  footer,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className={`dialog-content ${className}`}>
          <div className="dialog-heading">
            <div>
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="dialog-description">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <button className="icon-button dialog-close" type="button" aria-label="Cerrar diálogo">
                <X aria-hidden="true" size={18} />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-footer">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
