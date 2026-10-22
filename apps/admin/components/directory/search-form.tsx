import Link from "next/link";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";

/** GET form: the query lives in the URL, so results are linkable and need no client JS. */
export function SearchForm({
  action,
  search,
  placeholder,
  status,
  statusOptions,
}: {
  action: string;
  search?: string;
  placeholder: string;
  status?: string;
  statusOptions?: string[];
}) {
  const filtered = !!search || !!status;
  return (
    <form action={action} method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-full sm:max-w-sm">
        <Input
          type="search"
          name="search"
          defaultValue={search}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={100}
        />
      </div>
      {statusOptions ? (
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Status"
          className="h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit">Search</Button>
      {filtered ? (
        <Link href={action} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Clear
        </Link>
      ) : null}
    </form>
  );
}
