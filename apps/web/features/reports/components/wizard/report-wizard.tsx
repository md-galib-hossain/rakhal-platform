"use client"; // multi-step form state, mutations, router navigation

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { buttonVariants } from "@rakhal/ui/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Wizard, type WizardStep } from "@/components/shared/wizard";
import { useSubscription } from "@/features/subscription/hooks/use-subscription";
import {
  reportErrorKeyFor,
  reportWizardDefaults,
  reportWizardFormSchema,
  useCreateReport,
  usePreviewReport,
  useReportTemplates,
  useReportsAccess,
  wizardFormToPreviewRequest,
  wizardFormToRequest,
  type CreateReportRequest,
  type ReportSummary,
  type ReportTemplatesResponse,
  type ReportWizardFormValues,
} from "@/features/reports";
import { CatalogueStep } from "./catalogue-step";
import { DuplicateDialog } from "./duplicate-dialog";
import { PeriodStep } from "./period-step";
import { ReviewStep } from "./review-step";
import { ScopeStep } from "./scope-step";
import { allMetricIds, catalogueSections, WIZARD_STEP_FIELDS, type Translate } from "./shared";

type StepKey = "report" | "period" | "scope" | "review";

/** Entry point: permission + plan gate, then the catalogue fetch states, then the wizard. */
export function ReportWizard() {
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const access = useReportsAccess();
  const subscription = useSubscription();
  const gateOpen = access.canCreate && access.canUseFeature;
  const templates = useReportTemplates({ enabled: gateOpen });

  if (!access.canCreate) {
    return <EmptyState icon={Lock} title={tw("access.noPermission")} action={<BackLink label={tw("access.backToReports")} />} />;
  }
  if (subscription.isLoading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label={tw("access.loading")}>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!access.canUseFeature) {
    return (
      <EmptyState
        icon={Lock}
        title={tw("access.upgradeTitle")}
        description={tw("access.upgradeBody")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/settings?tab=billing" className={buttonVariants({ variant: "primary" })}>
              {tw("access.upgradeCta")}
            </Link>
            <BackLink label={tw("access.backToReports")} />
          </div>
        }
      />
    );
  }
  if (templates.isLoading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label={tw("access.loading")}>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (templates.isError || !templates.data) {
    return <ErrorState title={tw("catalogue.loadError")} description={undefined} onRetry={() => void templates.refetch()} />;
  }
  if (catalogueSections(templates.data).length === 0) {
    return <EmptyState title={tw("catalogue.empty")} />;
  }
  return <WizardBody templates={templates.data} />;
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/reports" className={buttonVariants({ variant: "secondary" })}>
      {label}
    </Link>
  );
}

export function WizardBody({ templates }: { templates: ReportTemplatesResponse }) {
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const router = useRouter();
  const sections = useMemo(() => catalogueSections(templates), [templates]);
  const maxMetrics = templates.limits.maxMetrics;

  const form = useForm<ReportWizardFormValues>({
    resolver: zodResolver(reportWizardFormSchema),
    defaultValues: { ...reportWizardDefaults, selectedMetricIds: allMetricIds(sections) },
  });
  const [step, setStep] = useState(0);
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ReportSummary | null>(null);
  const [duplicateErrorKey, setDuplicateErrorKey] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const create = useCreateReport();
  const preview = usePreviewReport();
  const inFlight = useRef(false);
  const stepRef = useRef<HTMLDivElement>(null);

  const values = useWatch({ control: form.control });
  const currentFingerprint = useMemo(() => {
    const parsed = reportWizardFormSchema.safeParse(values);
    return parsed.success ? JSON.stringify(wizardFormToPreviewRequest(parsed.data)) : null;
  }, [values]);
  const previewFresh = previewFor !== null && previewFor === currentFingerprint && preview.data;
  const previewStale = previewFor !== null && previewFor !== currentFingerprint && !!preview.data;

  // Move focus to the step body whenever the step changes (not on first paint).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepRef.current?.focus();
  }, [step]);

  async function runPreview() {
    const valid = await form.trigger();
    if (!valid) return;
    const request = wizardFormToPreviewRequest(form.getValues());
    setPreviewFor(JSON.stringify(request));
    preview.mutate(request);
  }

  function goTo(created: ReportSummary) {
    router.push(`/reports/${created.id}`);
  }

  async function submit(request: CreateReportRequest, inDialog: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitErrorKey(null);
    setDuplicateErrorKey(null);
    try {
      const result = await create.mutateAsync(request);
      if (result.kind === "created") goTo(result.report);
      else if (!inDialog) setDuplicate(result.existing);
      else goTo(result.existing);
    } catch (error) {
      const key = reportErrorKeyFor(error);
      if (inDialog) setDuplicateErrorKey(key);
      else setSubmitErrorKey(key);
    } finally {
      inFlight.current = false;
    }
  }

  async function onSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      // Send the user to the first step that has an error.
      const errs = form.formState.errors;
      if (errs.selectedMetricIds) setStep(0);
      else if (errs.preset || errs.customStartDate || errs.customEndDate) setStep(1);
      else setStep(2);
      return;
    }
    await submit(wizardFormToRequest(form.getValues()), false);
  }

  const stepTitle = (k: StepKey) => tw(`steps.${k}.title`);
  const steps: WizardStep[] = [
    {
      key: "report",
      title: stepTitle("report"),
      subtitle: tw("steps.report.subtitle"),
      fields: [...WIZARD_STEP_FIELDS.report],
      content: <CatalogueStep form={form} sections={sections} maxMetrics={maxMetrics} />,
    },
    {
      key: "period",
      title: stepTitle("period"),
      subtitle: tw("steps.period.subtitle"),
      fields: [...WIZARD_STEP_FIELDS.period],
      content: <PeriodStep form={form} />,
    },
    {
      key: "scope",
      title: stepTitle("scope"),
      subtitle: tw("steps.scope.subtitle"),
      fields: [...WIZARD_STEP_FIELDS.scope],
      content: <ScopeStep form={form} />,
    },
    {
      key: "review",
      title: stepTitle("review"),
      subtitle: tw("steps.review.subtitle"),
      content: (
        <ReviewStep
          form={form}
          sections={sections}
          onPreview={() => void runPreview()}
          previewPending={preview.isPending}
          previewError={preview.error}
          preview={previewFresh ? preview.data : null}
          previewStale={previewStale}
          submitErrorKey={submitErrorKey}
        />
      ),
    },
  ];

  const current = steps[step];
  const pending = create.isPending;

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" role="status" aria-live="polite">
        {tw("stepAnnounce", { step: step + 1, total: steps.length, title: current.title })}
      </p>
      <div ref={stepRef} tabIndex={-1} aria-label={current.title} className="outline-none">
        <Wizard
          steps={steps}
          step={step}
          onStepChange={(s) => {
            setSubmitErrorKey(null);
            setStep(s);
          }}
          onValidateStep={(fields) => (fields && fields.length ? form.trigger(fields as never) : true)}
          onSubmit={onSubmit}
          submitting={pending}
          submitLabel={tw("generate")}
          cancelLabel={tw("cancel")}
          backLabel={tw("previous")}
          nextLabel={tw("next")}
          stepOfLabel={(s, total) => tw("stepOf", { step: s, total })}
          onCancel={() => router.push("/reports")}
        />
      </div>
      <DuplicateDialog
        existing={duplicate}
        pending={pending}
        errorKey={duplicateErrorKey}
        onOpenExisting={(id) => router.push(`/reports/${id}`)}
        onGenerateNew={() => void submit({ ...wizardFormToRequest(form.getValues()), forceNew: true }, true)}
        onClose={() => {
          setDuplicate(null);
          setDuplicateErrorKey(null);
        }}
      />
    </div>
  );
}

