import { ArrowRightToLine } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
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

/**
 * Same contract as the old `FormDialog` but chromed as the app's standard floating side panel —
 * inset 10px from the viewport edges, 20px corner radius, 2px border, dashed header/footer dividers,
 * `ArrowRightToLine` close icon — matching `CattleDetailSheet`/`TaskDetailsSheet` (the Figma-sourced
 * reference pattern every right-side modal in this app follows).
 */
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
      <SheetContent
        side={side}
        showClose={false}
        className={cn(
          "inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-lg sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5",
          className,
        )}
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{title}</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-dashed border-border" />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-1 flex-col overflow-y-auto"
          noValidate
        >
          {description ? <SheetDescription className="px-1 pt-4">{description}</SheetDescription> : null}
          <div className="flex flex-1 flex-col gap-4 px-1 py-4">{children}</div>
          <div className="border-t border-dashed border-border" />
          <div className="flex gap-3 px-1 pt-5">
            <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button type="submit" className="h-12 flex-1" disabled={pending}>
              {pending ? "…" : submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
