import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/** 404 rendered inside the authenticated AppShell (sidebar/topbar stay visible). */
export default function AppNotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      action={
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
      className="mt-12"
    />
  );
}
