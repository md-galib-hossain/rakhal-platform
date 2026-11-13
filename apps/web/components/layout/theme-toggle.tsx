"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakhal/ui/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@rakhal/ui/ui/button";

const emptySubscribe = () => () => {};

/** True only after hydration — avoids a mismatch since next-themes only knows the real theme client-side. */
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const mounted = useMounted();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("toggle")}
              className="size-10 rounded-full border-border bg-card shadow-xs"
            >
              {mounted && theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("toggle")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="size-4" /> {t("light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="size-4" /> {t("dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="size-4" /> {t("system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
