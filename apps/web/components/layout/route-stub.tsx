import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/** Placeholder body for module routes not yet built — swapped out ticket-by-ticket (RFE-020+). */
export function RouteStub({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <EmptyState title={description ?? "Coming soon"} />
    </div>
  );
}
