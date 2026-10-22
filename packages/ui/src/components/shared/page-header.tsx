import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Primary action slot — usually a Button ("Add cattle", "Export"). */
  actions?: React.ReactNode;
  className?: string;
}

/** Standard module-landing-page header: breadcrumb, title + description, primary action slot. */
export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex flex-col gap-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
