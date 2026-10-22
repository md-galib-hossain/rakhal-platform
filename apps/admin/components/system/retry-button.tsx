"use client";

import { retryJobAction } from "@/lib/actions/ops";
import { ActionDialog } from "@/components/directory/action-dialog";

/** Retry one failed queue job. Gated by `system.manage` on the page and again on the server. */
export function RetryJobButton({ queue, jobId }: { queue: string; jobId: string }) {
  return (
    <ActionDialog
      action={retryJobAction.bind(null, queue, jobId)}
      triggerLabel="Retry"
      title="Retry this failed job?"
      description="The job goes back on the queue and runs again. If the cause is not fixed it will fail again."
      confirmValue={jobId}
      confirmNoun="job id"
      submitLabel="Retry job"
    />
  );
}
