import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The `<form>` — caller owns the react-hook-form + zod wiring, this just supplies the chrome. */
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  side?: "left" | "right" | "top" | "bottom";
  className?: string;
}

/** Same contract as FormDialog but as a mobile-friendlier side drawer (Sheet). */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  pending = false,
  side = "right",
  className,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("flex w-full flex-col sm:max-w-lg", className)}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-1 flex-col gap-4 overflow-y-auto"
          noValidate
        >
          <div className="flex-1">{children}</div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "…" : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
