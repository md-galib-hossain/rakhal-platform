"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { useIsEligibleForUpgradeAd } from "@/features/subscription/hooks/use-subscription-gates";
import { UPGRADE_AD_CONFIG } from "./upgrade-ad-config";

/**
 * Sidebar ad slot for farms that could still upgrade (2026-07-10 design pass — replaces the old
 * always-docked `UpgradeBanner`; eligibility wired to real subscription data as of RFE-008). Behaves
 * like a real ad slot: slides up from the bottom of the sidebar on a timer, stays up briefly,
 * retracts — not permanently competing with navigation. Dismissing an appearance early doesn't cancel
 * future ones, same as closing an ad. See `upgrade-ad-config.ts` for the cadence.
 */
export function UpgradeAd() {
  const t = useTranslations("upgrade");
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();
  const eligible = useIsEligibleForUpgradeAd();

  useEffect(() => {
    if (!eligible) return;
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    function scheduleShow(delay: number) {
      showTimer = setTimeout(() => {
        setVisible(true);
        hideTimer = setTimeout(() => {
          setVisible(false);
          scheduleShow(UPGRADE_AD_CONFIG.intervalMs);
        }, UPGRADE_AD_CONFIG.visibleDurationMs);
      }, delay);
    }

    scheduleShow(UPGRADE_AD_CONFIG.initialDelayMs);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [eligible]);

  if (!eligible) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="complementary"
          aria-label={t("title")}
          initial={reduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          transition={reduceMotion ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 32 }}
          className="absolute inset-x-4 bottom-4 z-10 overflow-hidden rounded-xl bg-black/30 p-5 text-center shadow-lg backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label={t("dismiss")}
            className="absolute right-2 top-2 rounded-full p-1 text-sidebar-muted transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
          <div className="mx-auto flex size-10 items-center justify-center rounded-[10px] border border-primary-hover bg-primary/10 text-sidebar-foreground">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-base font-bold text-sidebar-foreground">{t("title")}</p>
          <p className="mt-1 text-xs text-sidebar-muted">{t("description")}</p>
          <Button size="sm" className="mt-3 w-full" asChild>
            <Link href="/subscription">{t("cta")}</Link>
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
