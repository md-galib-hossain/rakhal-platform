import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** Shared control-size scale — keep in sync with `SelectTrigger`'s `controlSizeVariants` in
 * `select.tsx` so an `Input` and a `SelectTrigger` in the same row/toolbar line up exactly. */
export const controlSizeVariants = cva("", {
  variants: {
    size: {
      default: "h-11 px-3 py-2",
      sm: "h-9 px-2.5 py-1.5",
    },
  },
  defaultVariants: { size: "default" },
});

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders a small message under the input in the destructive color. */
  error?: string;
  /** Height/padding scale. Named `controlSize` (not `size`) because native `<input>` already has a
   * `size` attribute (character-width count) that means something else entirely. */
  controlSize?: VariantProps<typeof controlSizeVariants>["size"];
  /** React 19 ref-as-prop — no `forwardRef` needed. Forwarded straight to the underlying `<input>`. */
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, error, controlSize, ref, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        ref={ref}
        data-slot="input"
        className={cn(
          "flex w-full rounded-md border border-input bg-card text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          controlSizeVariants({ size: controlSize }),
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
