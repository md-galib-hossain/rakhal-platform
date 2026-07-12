"use client";

import { addYears, subYears } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { DayPicker, useDayPicker, type NavProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// `rounded-lg` in this design system is `--radius-lg: 1rem` (16px), tuned for cards — on a 32px
// icon button that resolves to a full circle, not the mock's soft rounded square. `rounded-md`
// (10px) is the right scale for icon-sized controls.
const navButtonClass = cn(buttonVariants({ variant: "outline", size: "icon" }), "size-8 rounded-md");

/**
 * Reference mock (`«  ‹  February 2022  ›  »`) wants a year-jump pair either side of the plain
 * month-jump pair, which `DayPicker`'s built-in `Nav` doesn't offer — it only exposes prev/next
 * *month*. Overriding `Nav` entirely (rather than just `PreviousMonthButton`/`NextMonthButton`)
 * gives access to `goToMonth` from `useDayPicker()` so the outer pair can jump a year at a time.
 */
function Nav({ className }: NavProps) {
  const { goToMonth, nextMonth, previousMonth, months } = useDayPicker();
  const currentMonth = months[0]?.date ?? new Date();

  return (
    <nav className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-1.5">
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
      <div className="flex items-center gap-1.5">
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

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center text-base font-semibold",
        // `captionLayout="dropdown"` support: react-day-picker renders each month/year `Dropdown` as
        // a real (but normally invisible) `<select>` absolutely stacked UNDER a visible fake label +
        // chevron span (see `node_modules/react-day-picker/dist/.../components/Dropdown.js`) — it
        // relies entirely on consumer CSS to actually hide/position the select. This app never
        // imports react-day-picker's own stylesheet, so without these 4 classNames the select had no
        // positioning at all and rendered as a second, fully visible native dropdown right next to
        // the fake label — the "March ▾ March" / "2023 ▾ 2023" duplicate the user screenshotted.
        dropdowns: "flex items-center gap-1.5",
        dropdown_root: "relative inline-flex items-center",
        dropdown: "absolute inset-0 z-10 cursor-pointer opacity-0",
        caption_label: "pointer-events-none flex items-center gap-1 text-base font-semibold",
        nav: "flex items-center justify-between absolute inset-x-0 top-0",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-xs",
        week: "flex w-full mt-2",
        day: "size-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent rounded-md",
        day_button: cn(buttonVariants({ variant: "ghost" }), "size-9 rounded-md p-0 font-normal aria-selected:opacity-100"),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ Nav }}
      {...props}
    />
  );
}
