"use client"; // dropdown open state

import { MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

export interface RowAction {
  key: string;
  label: string;
  onSelect: () => void;
  /** Destructive items sit last, after a separator, in red — and should open a named confirm, never act directly. */
  destructive?: boolean;
}

/**
 * The `⋯` menu for a row or card: everyday actions first, destructive ones last behind a separator. Keeps a bare red
 * trash icon from sitting one mis-click away from a primary button. Renders nothing when there are no actions
 * (e.g. the viewer lacks permission for all of them).
 */
export function RowActionsMenu({
  actions,
  menuLabel,
  className,
}: {
  actions: RowAction[];
  /** Accessible name of the trigger, e.g. "More actions". */
  menuLabel: string;
  className?: string;
}) {
  if (actions.length === 0) return null;
  const normal = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={menuLabel} className={cn("size-8", className)}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {normal.map((a) => (
          <DropdownMenuItem key={a.key} onSelect={a.onSelect}>
            {a.label}
          </DropdownMenuItem>
        ))}
        {normal.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map((a) => (
          <DropdownMenuItem key={a.key} onSelect={a.onSelect} className="text-destructive focus:text-destructive">
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
