"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center text-sm font-medium",
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
        caption_label: "pointer-events-none flex items-center gap-1 text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 top-0",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-xs",
        week: "flex w-full mt-2",
        day: "size-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent rounded-md",
        day_button: cn(buttonVariants({ variant: "ghost" }), "size-9 p-0 font-normal aria-selected:opacity-100"),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...chevronProps} />
          ) : (
            <ChevronRight className="size-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
