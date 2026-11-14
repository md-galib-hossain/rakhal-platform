"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { MoneyText } from "@/components/shared/money-text";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import {
  useAcceptConsent,
  useCheckout,
  useConsentStatus,
  useFarmProfile,
  usePlans,
  usePreviewCheckout,
  useScheduleDowngrade,
  useUpdateFarmProfile,
} from "../../hooks/use-billing";
import { checkoutSchema, profileCompletionSchema, type CheckoutFormValues, type ProfileCompletionFormValues } from "../../schemas";
import { subscriptionApi } from "../../api";
import { useSubscription } from "../../hooks/use-subscription";
import type { BillingPeriod, PreviewCheckoutResult, PublicPlan } from "../../types";

type Stage = "plan" | "profile" | "coupon" | "confirm-downgrade" | "status";
const USABLE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Upgrade/checkout modal behind the Current-Plan card's Upgrade/Manage buttons (RFE-036 follow-up).
 * Replaces the old single-stage `PlanPickerSheet` + standalone `BkashPaymentModal` with one modal,
 * three real stages:
 *  1. "plan"    — pick plan + period (unchanged UI from the old sheet).
 *  2a. "profile" — Free plan only: mandatory phone/address/farm-name completion
 *      (`PATCH /billing/profile`) before the ৳0 checkout can activate. Server-enforced
 *      (`BillingService.checkout`'s Free-plan gate) independent of this client-side routing.
 *  2b. "coupon"  — paid plan only: optional coupon code with a live, server-priced preview
 *      (`POST /billing/checkout/preview`, non-mutating) before the real checkout.
 *  3. "status"   — post-bKash return. Auto-detected via `?status=` on mount (same deliberate
 *      `window.location.search` read as the old `BkashPaymentModal` — cosmetic only, never trusted
 *      for real state) so this stage renders correctly even on a fresh mount after the bKash redirect
 *      lands back on `/settings?tab=billing`.
 */
export function UpgradePlanModal({
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
  const router = useRouter();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<Stage>("plan");
  const [statusForced, setStatusForced] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"polling" | "success" | "failed">("polling");
  const [couponCode, setCouponCode] = useState("");
  const [preview, setPreview] = useState<PreviewCheckoutResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const subscriptionQuery = useSubscription();
  const plansQuery = usePlans();
  const consentQuery = useConsentStatus();
  const checkout = useCheckout();
  const acceptConsent = useAcceptConsent();
  const previewCheckout = usePreviewCheckout();
  const scheduleDowngrade = useScheduleDowngrade();
  const updateProfile = useUpdateFarmProfile();
  const farmProfileQuery = useFarmProfile(stage === "profile");

  const alreadyConsented = consentQuery.data?.all_accepted ?? false;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { planId: "", billingPeriod: "MONTHLY", couponCode: "", consent: false },
  });

  const profileForm = useForm<ProfileCompletionFormValues>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: { phone: "", farmName: "", address: "" },
  });

  // ?status= on mount → this is the bKash return landing, not a fresh Upgrade/Manage click. Force
  // the modal open on the status stage regardless of the `open` prop — the page remounted fresh, so
  // nothing else has called setSheet({open:true}) yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = new URLSearchParams(window.location.search).get("status");
    if (status) {
      setGatewayStatus(status);
      setStage("status");
      setStatusForced(true);
    }
  }, []);

  const isOpen = open || statusForced;

  // A real Upgrade/Manage click always starts fresh at the plan stage.
  useEffect(() => {
    if (open && !statusForced) {
      setStage("plan");
      setCouponCode("");
      setPreview(null);
      setPreviewError(null);
    }
  }, [open, statusForced]);

  useEffect(() => {
    if (open) {
      form.reset({
        planId: currentPlanId ?? "",
        billingPeriod: "MONTHLY",
        couponCode: "",
        consent: alreadyConsented,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPlanId, alreadyConsented]);

  useEffect(() => {
    if (stage === "profile" && farmProfileQuery.data) {
      profileForm.reset({
        phone: farmProfileQuery.data.phone ?? "",
        farmName: farmProfileQuery.data.farm_name,
        address: farmProfileQuery.data.address ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, farmProfileQuery.data]);

  // Post-bKash polling — only while the status stage is showing.
  useEffect(() => {
    if (stage !== "status") return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      while (!cancelled) {
        try {
          const sub = await subscriptionApi.current();
          if (USABLE_STATUSES.has(sub.status)) {
            if (!cancelled) {
              queryClient.setQueryData(qk.subscription.current(), sub);
              void queryClient.invalidateQueries({ queryKey: ["billing"] });
              setOutcome("success");
            }
            return;
          }
        } catch {
          // transient fetch failure — keep polling until the timeout
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          if (!cancelled) setOutcome("failed");
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [stage, queryClient]);

  const selectedPlanId = form.watch("planId");
  const billingPeriod = form.watch("billingPeriod");
  const consent = form.watch("consent");

  const plans = plansQuery.data ?? [];
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const currentPlan = plans.find((p) => p.id === currentPlanId);
  const isFreeSelected = selectedPlan ? selectedPlan.name === "Free" : false;
  // A downgrade/lateral move (RFE-036 follow-up) never charges — it schedules the switch for the
  // current period's end instead of routing through checkout. Same tier signal the backend uses
  // (`monthly_price`), and only relevant when actually changing plans (re-selecting the current plan
  // is a no-op, not a downgrade).
  const isDowngradeSelected =
    !!selectedPlan &&
    !!currentPlan &&
    selectedPlan.id !== currentPlan.id &&
    selectedPlan.monthly_price <= currentPlan.monthly_price;
  // Only ask for the farm name if the farm genuinely doesn't have one yet — it almost always already
  // does (Farm.name is required at creation), so this field is the exception, not the norm.
  const needsFarmName = !!farmProfileQuery.data && !farmProfileQuery.data.farm_name;

  const stepIndex = stage === "plan" ? 0 : stage === "profile" || stage === "coupon" ? 1 : 2;
  const steps = [t("stepper.plan"), t("stepper.details"), t("stepper.confirm")];

  function handleStatusClose() {
    setGatewayStatus(null);
    setStatusForced(false);
    setOutcome("polling");
    setStage("plan");
    onOpenChange(false);
    router.replace("/settings?tab=billing");
  }

  function onPlanContinue() {
    if (!selectedPlanId || consent !== true) return;
    // A farm with no active plan yet (NONE/EXPIRED) has nothing to "downgrade" from — always route
    // through a real activation. Otherwise a downgrade/lateral move schedules, never charges.
    if (currentPlan && isDowngradeSelected) {
      setStage("confirm-downgrade");
      return;
    }
    setStage(isFreeSelected ? "profile" : "coupon");
  }

  async function onConfirmDowngrade() {
    try {
      const result = await scheduleDowngrade.mutateAsync({ planId: selectedPlanId, billingPeriod });
      toast.success(t("planPicker.downgrade.scheduledToast", { plan: result.pending_plan_name }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("planPicker.error"));
    }
  }

  async function onProfileSubmit(values: ProfileCompletionFormValues) {
    if (needsFarmName && !values.farmName?.trim()) {
      profileForm.setError("farmName", { message: t("profile.farmNameRequired") });
      return;
    }
    try {
      if (!alreadyConsented) {
        await acceptConsent.mutateAsync();
      }
      await updateProfile.mutateAsync({
        phone: values.phone,
        address: values.address,
        farm_name: needsFarmName ? values.farmName?.trim() : undefined,
      });
      const result = await checkout.mutateAsync({ planId: selectedPlanId, billingPeriod });
      if (result.invoice.status === "PAID") {
        toast.success(t("planPicker.activated"));
        onOpenChange(false);
        return;
      }
      toast.error(t("planPicker.pendingError"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("planPicker.error"));
    }
  }

  async function onApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setPreviewError(null);
    try {
      const result = await previewCheckout.mutateAsync({ planId: selectedPlanId, billingPeriod, couponCode: code });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof ApiError ? err.message : t("coupon.invalid"));
    }
  }

  async function onCouponContinue() {
    try {
      if (!alreadyConsented) {
        await acceptConsent.mutateAsync();
      }
      const trimmed = couponCode.trim();
      const result = await checkout.mutateAsync({
        planId: selectedPlanId,
        billingPeriod,
        couponCode: trimmed ? trimmed : undefined,
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
      toast.error(t("planPicker.pendingError"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("planPicker.error"));
    }
  }

  const profileSubmitting = updateProfile.isPending || checkout.isPending || acceptConsent.isPending;
  const couponSubmitting = checkout.isPending || acceptConsent.isPending;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (next) return;
        if (stage === "status") {
          if (outcome !== "polling") handleStatusClose();
          return;
        }
        onOpenChange(false);
      }}
    >
      <SheetContent side="right"
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-5 border-0 p-4 shadow-2xl overflow-y-auto sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-3xl sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
        showClose={stage !== "status" || outcome !== "polling"}
        onEscapeKeyDown={(e) => stage === "status" && outcome === "polling" && e.preventDefault()}
        onInteractOutside={(e) => stage === "status" && outcome === "polling" && e.preventDefault()}
      >
        <div className="mx-auto flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i < stepIndex
                      ? "bg-primary text-white"
                      : i === stepIndex
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground",
                  )}
                >
                  {i < stepIndex ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className={cn("text-xs font-medium", i === stepIndex ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 ? <div className="h-px w-8 bg-border" aria-hidden /> : null}
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center">
        {stage === "plan" ? (
          <>
            <SheetHeader className="items-center text-center">
              <SheetTitle className="text-2xl">
                {mode === "manage" ? t("planPicker.manageTitle") : t("planPicker.title")}
              </SheetTitle>
              <SheetDescription>{t("planPicker.description")}</SheetDescription>
            </SheetHeader>

            {plansQuery.isError ? (
              <ErrorState description={t("planPicker.error")} onRetry={() => void plansQuery.refetch()} />
            ) : plansQuery.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <EmptyState title={t("planPicker.empty")} />
            ) : (
              <form onSubmit={form.handleSubmit(onPlanContinue)} className="flex flex-col gap-5">
                <div className="mx-auto flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
                  {(["MONTHLY", "YEARLY"] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => form.setValue("billingPeriod", period)}
                      className={cn(
                        "rounded-sm px-4 py-1.5 text-sm font-medium transition-colors",
                        billingPeriod === period
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(period === "MONTHLY" ? "planPicker.monthly" : "planPicker.yearly")}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
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
                          "flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all",
                          selected
                            ? "border-primary bg-success-tint shadow-[0_0_40px_-16px_var(--color-primary)]"
                            : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-foreground">{plan.name}</p>
                            {isCurrent ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {t("planPicker.currentBadge")}
                              </span>
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                              selected ? "border-primary bg-primary text-white" : "border-border",
                            )}
                          >
                            {selected ? <Check className="size-3" aria-hidden /> : null}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1">
                          <p className="text-2xl font-bold text-foreground">
                            <MoneyText amount={price} />
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {t(billingPeriod === "MONTHLY" ? "planPicker.perMonth" : "planPicker.perYear")}
                          </span>
                        </div>

                        {plan.description ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{plan.description}</p>
                        ) : null}

                        <div className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3">
                          {planBullets(plan, t).map((bullet) => (
                            <div key={bullet} className="flex items-center gap-2 text-xs text-foreground">
                              <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                              {bullet}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

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

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t("planPicker.cancel")}
                  </Button>
                  <Button type="submit" className="gap-1.5" disabled={!selectedPlanId || consent !== true}>
                    {t("planPicker.continue")}
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : null}

        {stage === "confirm-downgrade" && selectedPlan ? (
          <>
            <SheetHeader className="items-center text-center sm:text-center">
              <SheetTitle>{t("planPicker.downgrade.title")}</SheetTitle>
              <SheetDescription>
                {currentPlan && subscriptionQuery.data?.expires_at
                  ? t("planPicker.downgrade.description", {
                      currentPlan: currentPlan.name,
                      targetPlan: selectedPlan.name,
                    })
                  : null}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
                {currentPlan ? (
                  <p>
                    {t("planPicker.downgrade.keepCurrent", { plan: currentPlan.name })}{" "}
                    {subscriptionQuery.data?.expires_at ? (
                      <DateText date={subscriptionQuery.data.expires_at} className="font-semibold" />
                    ) : null}
                    .
                  </p>
                ) : null}
                <p className="mt-1 text-muted-foreground">
                  {t("planPicker.downgrade.switchThen", { plan: selectedPlan.name })}
                </p>
                <p className="mt-2 font-semibold text-success">{t("planPicker.downgrade.noChargeToday")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStage("plan")}>
                  {t("planPicker.downgrade.back")}
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => void onConfirmDowngrade()}
                  disabled={scheduleDowngrade.isPending}
                >
                  {scheduleDowngrade.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("planPicker.downgrade.confirm")}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {stage === "profile" ? (
          <>
            <SheetHeader className="items-center text-center sm:text-center">
              <SheetTitle>{t("profile.title")}</SheetTitle>
              <SheetDescription>{t("profile.description")}</SheetDescription>
            </SheetHeader>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("profile.phoneLabel")}</label>
                <Input type="tel" placeholder={t("profile.phonePlaceholder")} {...profileForm.register("phone")} />
                {profileForm.formState.errors.phone ? (
                  <p className="text-xs text-destructive">{t("profile.phoneError")}</p>
                ) : null}
              </div>
              {needsFarmName ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("profile.farmNameLabel")}</label>
                  <Input placeholder={t("profile.farmNamePlaceholder")} {...profileForm.register("farmName")} />
                  {profileForm.formState.errors.farmName ? (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.farmName.message}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("profile.addressLabel")}</label>
                <Input placeholder={t("profile.addressPlaceholder")} {...profileForm.register("address")} />
              </div>

              <p className="text-xs text-muted-foreground">{t("profile.editableNote")}</p>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStage("plan")}>
                  {t("profile.back")}
                </Button>
                <Button type="submit" className="gap-1.5" disabled={profileSubmitting}>
                  {profileSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("planPicker.submitFree")}
                </Button>
              </div>
            </form>
          </>
        ) : null}

        {stage === "coupon" && selectedPlan ? (
          <>
            <SheetHeader className="items-center text-center sm:text-center">
              <SheetTitle>{t("coupon.title")}</SheetTitle>
              <SheetDescription>{selectedPlan.name}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t("coupon.placeholder")}
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setPreview(null);
                    setPreviewError(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onApplyCoupon()}
                  disabled={!couponCode.trim() || previewCheckout.isPending}
                >
                  {previewCheckout.isPending ? t("coupon.applying") : t("coupon.apply")}
                </Button>
              </div>
              {previewError ? <p className="text-xs text-destructive">{previewError}</p> : null}

              <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("coupon.subtotal")}</span>
                  <MoneyText amount={preview?.subtotal ?? priceFor(selectedPlan, billingPeriod)} />
                </div>
                {preview && preview.discount_total > 0 ? (
                  <div className="flex items-center justify-between text-success">
                    <span>{t("coupon.discount")}</span>
                    <span>
                      -<MoneyText amount={preview.discount_total} />
                    </span>
                  </div>
                ) : null}
                {preview && preview.tax_amount > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("coupon.tax")}</span>
                    <MoneyText amount={preview.tax_amount} />
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-dashed border-border pt-1.5 font-semibold text-foreground">
                  <span>{t("coupon.total")}</span>
                  <MoneyText amount={preview?.total ?? priceFor(selectedPlan, billingPeriod)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStage("plan")}>
                  {t("coupon.back")}
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => void onCouponContinue()}
                  disabled={couponSubmitting}
                >
                  {couponSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("planPicker.submit")}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {stage === "status" ? (
          <SheetHeader className="items-center text-center sm:text-center">
            {outcome === "polling" ? (
              <>
                <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
                <SheetTitle>{t("return.polling")}</SheetTitle>
                <SheetDescription>{t("return.pollingDescription")}</SheetDescription>
              </>
            ) : outcome === "success" ? (
              <>
                <CheckCircle2 className="size-10 text-success" aria-hidden />
                <SheetTitle>{t("return.success")}</SheetTitle>
              </>
            ) : (
              <>
                <XCircle className="size-10 text-destructive" aria-hidden />
                <SheetTitle>{gatewayStatus === "failed" ? t("return.gatewayFailed") : t("return.timeout")}</SheetTitle>
                <SheetDescription>{t("return.failedDescription")}</SheetDescription>
              </>
            )}
            {outcome !== "polling" ? (
              <Button onClick={handleStatusClose} className="mx-auto mt-2">
                {t("return.backToSettings")}
              </Button>
            ) : null}
          </SheetHeader>
        ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function priceFor(plan: PublicPlan, period: BillingPeriod): number {
  if (period === "YEARLY") return plan.yearly_price ?? plan.monthly_price * 12;
  return plan.monthly_price;
}

/** Real, non-fabricated bullets — limits + feature count straight from `/plans`. No invented
 * marketing copy ("priority support" etc.) since the catalogue doesn't carry per-feature labels. */
function planBullets(plan: PublicPlan, t: ReturnType<typeof useTranslations>): string[] {
  const cattle =
    plan.limits.max_cattle === null ? t("planPicker.unlimitedCattle") : t("planPicker.maxCattle", { n: plan.limits.max_cattle });
  const members =
    plan.limits.max_farm_members === null
      ? t("planPicker.unlimitedMembers")
      : t("planPicker.maxMembers", { n: plan.limits.max_farm_members });
  return [cattle, members, t("planPicker.featureCount", { n: plan.features.length })];
}
