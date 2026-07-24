"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { useAcceptConsent, useCheckout, useConsentStatus, usePlans } from "../../hooks/use-billing";
import { checkoutSchema, type CheckoutFormValues } from "../../schemas";
import type { BillingPeriod, PublicPlan } from "../../types";

/**
 * Checkout flow behind the Current-Plan card's Upgrade/Manage buttons (RFE-036). Pick a plan +
 * period (+ optional coupon), accept the ToS/Privacy gate, then `POST /billing/checkout`. The server
 * computes the total — the client never sends an amount. On a paid invoice the result carries a
 * bKash `redirect_url` we navigate to (backend callback → `/billing/return`); a ৳0 invoice comes
 * back already PAID. Dynamically imported so its weight stays out of the Settings route bundle.
 */
export function PlanPickerSheet({
  open,
  onOpenChange,
  mode,
  currentPlanId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "upgrade" | "manage";
  currentPlanId: string | null;
}) {
  const t = useTranslations("billing");
  const plansQuery = usePlans();
  const consentQuery = useConsentStatus();
  const checkout = useCheckout();
  const acceptConsent = useAcceptConsent();

  const alreadyConsented = consentQuery.data?.all_accepted ?? false;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { planId: "", billingPeriod: "MONTHLY", couponCode: "", consent: false },
  });

  // Reset each time the sheet opens: pre-select the current plan and pre-satisfy the consent gate
  // when the user has already accepted the current documents (so the checkbox doesn't reappear).
  useEffect(() => {
    if (open) {
      form.reset({
        planId: currentPlanId ?? "",
        billingPeriod: "MONTHLY",
        couponCode: "",
        consent: alreadyConsented,
      });
    }
  }, [open, currentPlanId, alreadyConsented, form]);

  const selectedPlanId = form.watch("planId");
  const billingPeriod = form.watch("billingPeriod");
  const consent = form.watch("consent");

  const plans = plansQuery.data ?? [];
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const isFreeSelected = selectedPlan ? priceFor(selectedPlan, billingPeriod) === 0 : false;

  async function onSubmit(values: CheckoutFormValues) {
    try {
      // The backend 403s checkout without current-document consent — record it first when needed.
      if (!alreadyConsented) {
        await acceptConsent.mutateAsync();
      }
      const result = await checkout.mutateAsync({
        planId: values.planId,
        billingPeriod: values.billingPeriod,
        couponCode: values.couponCode?.trim() ? values.couponCode.trim() : undefined,
      });

      const redirectUrl =
        result.checkout && "redirect_url" in result.checkout ? result.checkout.redirect_url : null;
      if (redirectUrl) {
        toast.loading(t("planPicker.redirecting"));
        window.location.assign(redirectUrl);
        return;
      }
      if (result.invoice.status === "PAID") {
        toast.success(t("planPicker.activated"));
        onOpenChange(false);
        return;
      }
      // PENDING with no gateway configured / gateway initiation failed — the charge couldn't start.
      toast.error(t("planPicker.pendingError"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("planPicker.error"));
    }
  }

  const submitting = checkout.isPending || acceptConsent.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>{mode === "manage" ? t("planPicker.manageTitle") : t("planPicker.title")}</SheetTitle>
          <SheetDescription>{t("planPicker.description")}</SheetDescription>
        </SheetHeader>

        {plansQuery.isError ? (
          <ErrorState description={t("planPicker.error")} onRetry={() => void plansQuery.refetch()} />
        ) : plansQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState title={t("planPicker.empty")} />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Billing period toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
              {(["MONTHLY", "YEARLY"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => form.setValue("billingPeriod", period)}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                    billingPeriod === period
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(period === "MONTHLY" ? "planPicker.monthly" : "planPicker.yearly")}
                </button>
              ))}
            </div>

            {/* Plans */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {plans.map((plan) => {
                const price = priceFor(plan, billingPeriod);
                const selected = plan.id === selectedPlanId;
                const isCurrent = plan.id === currentPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => form.setValue("planId", plan.id, { shouldValidate: true })}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                      selected ? "border-primary bg-success-tint" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                        {isCurrent ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {t("planPicker.currentBadge")}
                          </span>
                        ) : null}
                      </div>
                      {plan.description ? <p className="text-xs text-muted-foreground">{plan.description}</p> : null}
                      <p className="text-xs text-muted-foreground">{planLimits(plan, t)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-base font-bold text-foreground">
                        <MoneyText amount={price} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(billingPeriod === "MONTHLY" ? "planPicker.perMonth" : "planPicker.perYear")}
                      </p>
                      {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Coupon (optional) — priced/validated server-side */}
            <Input placeholder={t("planPicker.coupon")} {...form.register("couponCode")} />

            {/* ToS/Privacy gate — only shown when not already accepted */}
            {!alreadyConsented ? (
              <label className="flex items-start gap-2 text-sm text-foreground">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => form.setValue("consent", v === true, { shouldValidate: true })}
                  className="mt-0.5"
                />
                <span>{t("planPicker.consent")}</span>
              </label>
            ) : null}

            <div className="mt-auto flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                {t("planPicker.cancel")}
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-1.5"
                disabled={submitting || !selectedPlanId || consent !== true}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {isFreeSelected ? t("planPicker.submitFree") : t("planPicker.submit")}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function priceFor(plan: PublicPlan, period: BillingPeriod): number {
  if (period === "YEARLY") return plan.yearly_price ?? plan.monthly_price * 12;
  return plan.monthly_price;
}

function planLimits(plan: PublicPlan, t: ReturnType<typeof useTranslations>): string {
  const cattle =
    plan.limits.max_cattle === null ? t("planPicker.unlimited") : t("planPicker.maxCattle", { n: plan.limits.max_cattle });
  const members =
    plan.limits.max_farm_members === null
      ? t("planPicker.unlimited")
      : t("planPicker.maxMembers", { n: plan.limits.max_farm_members });
  return `${cattle} · ${members}`;
}
