import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ApiMeta } from "@rakhal/admin-api-client";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { AdminApiError, callAdminApi, callAdminApiPage } from "./admin-api";

// ---- Types (mirror rakhal-backend `AdminDirectoryService` / audit list) ------------------------

export interface SubscriptionSummary {
  status: string;
  startsAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  subscriptionPlan: { id: string; name: string };
  pendingPlan: { id: string; name: string } | null;
}

export interface FarmRow {
  id: string;
  name: string;
  farmCode: string | null;
  status: string;
  division: string | null;
  district: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  memberCount: number;
  subscription: SubscriptionSummary | null;
}

export interface FarmDetail {
  id: string;
  name: string;
  slug: string;
  farmCode: string | null;
  status: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  operationalPurpose: string | null;
  herdSizeBand: string | null;
  timezone: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
    isEmailVerified: boolean;
    isBlocked: boolean;
    lastLoginAt: string | null;
  };
  members: {
    joinedAt: string;
    role: string;
    id: string;
    name: string;
    email: string;
    isBlocked: boolean;
    lastLoginAt: string | null;
  }[];
  cattleRecords: number;
  lastActivityAt: string | null;
  subscription: SubscriptionSummary | null;
  subscriptionHistory: SubscriptionSummary[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  isBlocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  farmCount: number;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  isBlocked: boolean;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  lastFailedLoginAt: string | null;
  lastLoginAt: string | null;
  lastPasswordChangedAt: string | null;
  preferredLanguage: string;
  createdAt: string;
  mfaConfigured: boolean;
  ownedFarmCount: number;
  activeSessionCount: number;
  memberships: { joinedAt: string; role: string; farm: { id: string; name: string; status: string } }[];
}

export interface DayCount {
  day: string;
  count: number;
}

export interface Overview {
  generatedAt: string;
  farms: { total: number; byStatus: Record<string, number>; newLast7Days: number; newLast30Days: number };
  users: { total: number; blocked: number; newLast7Days: number; newLast30Days: number };
  subscriptions: { byStatus: Record<string, number> };
  signups: { days: number; farms: DayCount[]; users: DayCount[] };
}

export interface AuditRow {
  id: string;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: string;
  actorEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestId: string | null;
  metadata: unknown;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  meta: ApiMeta & { endCursor?: string | null; hasNextPage?: boolean; limit?: number };
}

// ---- Fetchers -----------------------------------------------------------------------------------

async function withToken<T>(run: (token: string) => Promise<T>): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");
  try {
    return await run(token);
  } catch (err) {
    if (err instanceof AdminApiError) {
      if (err.status === 401) redirect("/login");
      if (err.status === 404) notFound();
    }
    throw err;
  }
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) sp.set(key, value);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const page = async <T>(path: string): Promise<Page<T>> =>
  withToken(async (token) => {
    const { data, meta } = await callAdminApiPage<T[]>(path, { token });
    return { items: data, meta: (meta ?? {}) as Page<T>["meta"] };
  });

export const getOverview = () => withToken((token) => callAdminApi<Overview>("/admin/overview", { token }));

export const listFarms = (p: { search?: string; status?: string; cursor?: string }) =>
  page<FarmRow>(`/admin/farms${qs({ ...p, limit: "20" })}`);

export const getFarm = (id: string) =>
  withToken((token) => callAdminApi<FarmDetail>(`/admin/farms/${encodeURIComponent(id)}`, { token }));

export const listUsers = (p: { search?: string; cursor?: string }) =>
  page<UserRow>(`/admin/users${qs({ ...p, limit: "20" })}`);

export const getUser = (id: string) =>
  withToken((token) => callAdminApi<UserDetail>(`/admin/users/${encodeURIComponent(id)}`, { token }));

// ---- Phase 5: operations + config ----------------------------------------------------------------

export interface QueueSummary {
  name: string;
  paused: boolean;
  counts: { waiting: number; active: number; delayed: number; completed: number; failed: number };
}
export interface FailedJob {
  id: string | null;
  name: string;
  attemptsMade: number;
  failedReason: string;
  failedAt: string | null;
  createdAt: string | null;
}
export interface IntegrationItem {
  key: string;
  label: string;
  status: "ok" | "degraded" | "down" | "not_configured" | "info";
  detail: string;
  latencyMs?: number;
}
export interface EmailStatus {
  provider: string;
  last24h: Record<string, number>;
  last7d: Record<string, number>;
  recentFailures: { id: string; to: string; template: string; retries: number; error: string; createdAt: string }[];
}
export interface CronRow {
  name: string;
  running: boolean;
  next_run: string | null;
  last_run: string | null;
}
export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  farmIds: string[];
  updatedAt: string;
}
export interface PlatformSettingRow {
  key: string;
  value: unknown;
  description: string;
  updatedAt: string;
}

export const getQueues = () =>
  withToken((token) => callAdminApi<{ checkedAt: string; queues: QueueSummary[] }>("/admin/ops/queues", { token }));
export const getFailedJobs = (queue: string) =>
  withToken((token) =>
    callAdminApi<{ queue: string; jobs: FailedJob[] }>(`/admin/ops/queues/${encodeURIComponent(queue)}/failed?limit=10`, {
      token,
    }),
  );
export const getEmailStatus = () => withToken((token) => callAdminApi<EmailStatus>("/admin/ops/email-status", { token }));
export const getIntegrations = () =>
  withToken((token) => callAdminApi<{ checkedAt: string; items: IntegrationItem[] }>("/admin/ops/integrations", { token }));
export const getCrons = () => withToken((token) => callAdminApi<{ crons: CronRow[] }>("/admin/crons", { token }));
export const getFlags = () => withToken((token) => callAdminApi<FeatureFlag[]>("/admin/config/flags", { token }));
export const getSettings = () =>
  withToken((token) => callAdminApi<PlatformSettingRow[]>("/admin/config/settings", { token }));

export const listAudit = (p: { action?: string; cursor?: string }) =>
  page<AuditRow>(`/admin/audit${qs({ ...p, limit: "25" })}`);

// ---- Phase 6: commercial + analytics ------------------------------------------------------------

export interface MatrixPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  maxCattle: number | null;
  maxFarmMembers: number | null;
  farmCount: number;
  enabledFeatures: string[];
}
export interface PlanMatrix {
  features: { id: string; key: string; description: string | null }[];
  plans: MatrixPlan[];
}
export interface UsageAnalytics {
  generatedAt: string;
  subscriptions: { byPlan: { plan: string; counts: Record<string, number> }[] };
  mrr: { listPriceBdt: number };
  revenue: { windowDays: number; paidInvoices: number; totalBdt: number };
  activeFarms: { last7Days: number; last30Days: number };
  expiring: { farmId: string; farm: string; plan: string; status: string; expiresAt: string }[];
}

export const getPlanMatrix = () => withToken((token) => callAdminApi<PlanMatrix>("/admin/plans/matrix", { token }));
export const getUsage = () => withToken((token) => callAdminApi<UsageAnalytics>("/admin/analytics/usage", { token }));
