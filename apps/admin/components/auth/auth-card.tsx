export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary-hover">Rakhal Admin</p>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-card">{children}</div>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md bg-success-tint px-3 py-2 text-sm text-foreground">
      {children}
    </p>
  );
}
