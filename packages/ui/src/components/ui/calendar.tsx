"use client";

import { createContext, useContext } from "react";
import { addYears, subYears } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  DayPicker,
  useDayPicker,
  type DayButtonProps,
  type DayProps,
  type NavProps,
} from "react-day-picker";
import { cn } from "../../lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * The nav row needs to know whether it owns the "September 2026" label. When the calendar shows a
 * single month and the caption is plain text, the label lives *inside* the nav row (one compact
 * header line, arrows flanking the label — the mock's layout). With `captionLayout="dropdown*"` or
 * multiple months, react-day-picker's own per-month caption is kept instead and the nav row shows
 * arrows only.
 */
const NavLabelContext = createContext(true);

const navButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * `DayPicker` renders `Nav` as a sibling *above* the months, and its built-in nav only exposes
 * prev/next month. Overriding `Nav` wholesale gives `goToMonth()` from `useDayPicker()`, so the
 * outer pair can jump a year (`«  ‹  September 2026  ›  »`).
 *
 * The previous version positioned this row with `absolute inset-x-0 top-0` while its nearest
 * positioned ancestor was the *popover* (the `months` wrapper had no `relative`), so the arrows
 * escaped the calendar and pinned themselves to the popover's own edges — the cramped, overlapping
 * buttons in the reported screenshots. It is now a normal in-flow row with real padding, so the
 * arrows can never collide with the popover border or the range picker's preset column.
 */
function Nav({ className }: NavProps) {
  const { goToMonth, nextMonth, previousMonth, months } = useDayPicker();
  const showLabel = useContext(NavLabelContext);
  const currentMonth = months[0]?.date ?? new Date();

  return (
    <nav className={cn("flex items-center justify-between gap-2 pb-2", className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous year"
          className={navButtonClass}
          onClick={() => goToMonth(subYears(currentMonth, 1))}
        >
          <ChevronsLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Previous month"
          disabled={!previousMonth}
          className={navButtonClass}
          onClick={() => previousMonth && goToMonth(previousMonth)}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      {showLabel ? (
        <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">
          {currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Next month"
          disabled={!nextMonth}
          className={navButtonClass}
          onClick={() => nextMonth && goToMonth(nextMonth)}
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Next year"
          className={navButtonClass}
          onClick={() => goToMonth(addYears(currentMonth, 1))}
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

/**
 * Range styling can't be expressed through `classNames` alone: in range mode every day of the range
 * carries the `selected` modifier *as well as* `range_middle`, so a `selected:bg-primary` class and
 * a `range_middle:bg-primary/10` class both apply and the winner is decided by Tailwind's stylesheet
 * order, not by intent — which is why an in-progress range rendered as a solid green block. Custom
 * `Day`/`DayButton` components resolve the states in JS instead, so the precedence is explicit.
 */
// `day` is destructured only to keep react-day-picker's internal object off the DOM node.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Day({ day, modifiers, className, ...props }: DayProps) {
  const inRange = modifiers.range_middle || modifiers.range_start || modifiers.range_end;
  return (
    <td
      {...props}
      className={cn(
        "size-10 p-0 text-center text-sm",
        inRange && "bg-primary/10",
        modifiers.range_middle && "rounded-none",
        modifiers.range_start && "rounded-l-md",
        modifiers.range_end && "rounded-r-md",
        !inRange && "rounded-md",
        className,
      )}
    />
  );
}

// Same as `Day` above: `day` is stripped so it never lands on the <button>.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  const isEndpoint = modifiers.range_start || modifiers.range_end;
  const isSolid = isEndpoint || (modifiers.selected && !modifiers.range_middle);

  return (
    <button
      {...props}
      className={cn(
        "flex size-10 items-center justify-center rounded-md text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !isSolid && "hover:bg-muted",
        modifiers.today && !isSolid && "font-semibold text-primary ring-1 ring-inset ring-primary/40",
        modifiers.range_middle && "text-foreground hover:bg-primary/20",
        isSolid && "bg-primary font-semibold text-white hover:bg-primary-hover",
        modifiers.outside && !isSolid && "text-muted-foreground opacity-60",
        modifiers.disabled && "pointer-events-none text-muted-foreground opacity-40",
        className,
      )}
    />
  );
}

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const navOwnsLabel = !props.captionLayout && (props.numberOfMonths ?? 1) === 1;

  return (
    <NavLabelContext.Provider value={navOwnsLabel}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        classNames={{
          // The nav row lives INSIDE this container alongside the month(s), so it must stay a
          // column — `sm:flex-row` (the old value, harmless while the nav was absolutely
          // positioned) put the arrows beside the grid instead of above it.
          months: "relative flex flex-col gap-2",
          month: "flex flex-col gap-2",
          month_caption: cn(
            "flex items-center justify-center pb-1 text-sm font-semibold",
            navOwnsLabel && "sr-only",
          ),
          // `captionLayout="dropdown"` support: react-day-picker renders each month/year `Dropdown`
          // as a real (but normally invisible) `<select>` absolutely stacked UNDER a visible fake
          // label + chevron span — it relies entirely on consumer CSS to hide/position the select.
          // This app never imports react-day-picker's stylesheet, so without these the select
          // renders as a second, fully visible native dropdown next to the fake label.
          dropdowns: "flex items-center gap-1.5",
          dropdown_root: "relative inline-flex items-center",
          dropdown: "absolute inset-0 z-10 cursor-pointer opacity-0",
          caption_label: "pointer-events-none flex items-center gap-1 text-sm font-semibold",
          nav: "flex items-center justify-between",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "w-10 text-center text-xs font-medium text-muted-foreground",
          week: "flex w-full",
          hidden: "invisible",
          ...classNames,
        }}
        components={{ Nav, Day, DayButton }}
        {...props}
      />
    </NavLabelContext.Provider>
  );
}
