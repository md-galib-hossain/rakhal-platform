"use client"; // drafts across all sessions + save/submit mutations + client-side search/shed filter + pagination + keyboard nav refs

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ChevronDown, History, Lock, Minus, TrendingDown, TrendingUp, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Can, useCan } from "@/lib/auth/permissions";
import { useMilkTanks } from "@/features/inventory/hooks/use-inventory";
import type { MilkTank, MilkTankType as InventoryMilkTankType } from "@/features/inventory/types";
import { useSaveMilkLog, useSubmitMilk, useUpdateMilkSessions } from "../hooks/use-milk";
import { MILK_SESSIONS } from "../types";
import type { MilkDisposition, MilkLogRow, MilkSession, MilkSessionKey } from "../types";

/** Any of the 4 sessions can be locked/unlocked by the Owner — the backend only requires at
 * least one to stay active, enforced below by disabling the last remaining session's unlock icon. */
const LOCKABLE_SESSIONS: MilkSession[] = ["MORNING", "NOON", "EVENING", "NIGHT"];

const SESSION_FIELD: Record<MilkSession, "morningL" | "noonL" | "eveningL" | "nightL"> = {
  MORNING: "morningL",
  NOON: "noonL",
  EVENING: "eveningL",
  NIGHT: "nightL",
};

const SESSION_COLUMN_LABEL: Record<MilkSession, string> = {
  MORNING: "morningLog",
  NOON: "noonLog",
  EVENING: "eveningLog",
  NIGHT: "nightLog",
};

const SESSION_LABEL_KEY: Record<MilkSession, string> = {
  MORNING: "session.morning",
  NOON: "session.noon",
  EVENING: "session.evening",
  NIGHT: "session.night",
};

const SESSION_KEY: Record<MilkSession, MilkSessionKey> = {
  MORNING: "morning",
  NOON: "noon",
  EVENING: "evening",
  NIGHT: "night",
};

/** Per-session tinted glow on the log-input cell (Figma "Milk Log" table, node 734:32487 — each
 * session column's input pill carries a distinct colored drop-shadow). Uses the `--session-*`
 * tokens added to globals.css rather than raw hex, per this project's semantic-tokens-only rule. */
const SESSION_GLOW: Record<MilkSession, string> = {
  MORNING: "shadow-[0_0_2px_color-mix(in_srgb,var(--color-session-morning)_40%,transparent)]",
  NOON: "shadow-[0_0_3px_color-mix(in_srgb,var(--color-session-noon)_40%,transparent)]",
  EVENING: "shadow-[0_0_3px_color-mix(in_srgb,var(--color-session-evening)_40%,transparent)]",
  NIGHT: "shadow-[0_0_3px_color-mix(in_srgb,var(--color-session-night)_40%,transparent)]",
};

/** RAKHAL-277 disposition chip colors — per session-cell, only shown for sessions that already
 * have a logged entry (`row.log.dispositions[session]`). Distinct from the withholding status Chip
 * (Status column) which reflects the cow's overall current tank routing, not one session's value. */
const DISPOSITION_VARIANT: Record<MilkDisposition, "primary" | "destructive" | "info" | "teal" | "muted" | "purple"> = {
  SALEABLE: "primary",
  WITHHELD: "destructive",
  COLOSTRUM: "info",
  CALF_FEED: "teal",
  DISCARDED: "muted",
  HOUSEHOLD_USE: "purple",
};

const DEFAULT_PAGE_SIZE = 8;

function draftKey(cattleId: string, session: MilkSession): string {
  return `${cattleId}:${session}`;
}

// Builds drafts for all 4 sessions regardless of which are active — locked
// columns simply never render an input for these keys, and save/submit only
// ever iterate the active `sessions` list, so the extra entries are inert.
function buildInitialDrafts(rows: MilkLogRow[]): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const row of rows) {
    for (const session of MILK_SESSIONS) {
      const value = row.log[SESSION_FIELD[session]];
      drafts[draftKey(row.cattleId, session)] = value == null ? "" : String(value);
    }
  }
  return drafts;
}

// Seeds one tank choice per cow (keyed by cattleId, not per-session — the Tank column is one
// selection per cow per day) from whichever saved entry already named a tank, if any.
function buildInitialTankOverrides(rows: MilkLogRow[]): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    if (row.log.tankId) overrides[row.cattleId] = row.log.tankId;
  }
  return overrides;
}

/** Header control for a session column that's currently locked (not in `activeSessions`) — shows
 * a lock icon; the farm Owner (`settings.milk-sessions-manage`) can click it to unlock, everyone
 * else sees a static muted label with no affordance. */
function SessionLockControl({ session, activeSessions }: { session: MilkSession; activeSessions: MilkSession[] }) {
  const t = useTranslations("milk.log");
  const can = useCan();
  const canManage = can("settings.milk-sessions-manage");
  const updateSessions = useUpdateMilkSessions();
  const [open, setOpen] = useState(false);
  const label = t(SESSION_LABEL_KEY[session]);

  async function handleEnable() {
    const next = new Set(activeSessions.map((s) => SESSION_KEY[s]));
    next.add(SESSION_KEY[session]);
    try {
      await updateSessions.mutateAsync({ active_sessions: [...next] });
      toast.success(t("enableSessionSuccessToast", { session: label }));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("enableSessionError"));
    }
  }

  if (!canManage) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground" title={t("sessionLockedNoAccess", { session: label })}>
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lock className="size-3.5 shrink-0" aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-sm text-foreground">{t("sessionLockedDescription", { session: label })}</p>
        <Button size="sm" disabled={updateSessions.isPending} onClick={handleEnable}>
          {updateSessions.isPending ? t("enabling") : t("enableSession", { session: label })}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Mirror of `SessionLockControl` for the opposite direction — an active session's column header
 * shows an open-lock icon the Owner can click to lock it back. The farm must always keep at least
 * one session active (backend-enforced), so the last remaining active session shows a disabled
 * icon instead of a clickable popover. Everyone else just sees the plain column label. */
function SessionActiveControl({ session, activeSessions }: { session: MilkSession; activeSessions: MilkSession[] }) {
  const t = useTranslations("milk.log");
  const can = useCan();
  const canManage = can("settings.milk-sessions-manage");
  const updateSessions = useUpdateMilkSessions();
  const [open, setOpen] = useState(false);
  const label = t(`columns.${SESSION_COLUMN_LABEL[session]}`);
  const sessionLabel = t(SESSION_LABEL_KEY[session]);

  if (!LOCKABLE_SESSIONS.includes(session) || !canManage) {
    return <>{label}</>;
  }

  const isLastActive = activeSessions.length <= 1;

  if (isLastActive) {
    return (
      <span
        className="inline-flex items-center gap-1 text-muted-foreground"
        title={t("lastActiveSessionCannotLock", { session: sessionLabel })}
      >
        {label}
        <Unlock className="size-3.5 shrink-0 opacity-40" aria-hidden />
      </span>
    );
  }

  async function handleDisable() {
    const next = new Set(activeSessions.map((s) => SESSION_KEY[s]));
    next.delete(SESSION_KEY[session]);
    try {
      await updateSessions.mutateAsync({ active_sessions: [...next] });
      toast.success(t("disableSessionSuccessToast", { session: sessionLabel }));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("disableSessionError"));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {label}
          <Unlock className="size-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-sm text-foreground">{t("disableSessionDescription", { session: sessionLabel })}</p>
        <Button size="sm" variant="outline" disabled={updateSessions.isPending} onClick={handleDisable}>
          {updateSessions.isPending ? t("disabling") : t("disableSession", { session: sessionLabel })}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Tank column header — click opens a popover to set a default tank per SELLABLE/WITHHOLDING
 * type, applied immediately to every row of that type (rows can still be overridden below). */
function TankColumnHeaderControl({
  tanks,
  onSetDefault,
}: {
  tanks: MilkTank[];
  onSetDefault: (tankType: InventoryMilkTankType, tankId: string) => void;
}) {
  const t = useTranslations("milk.log");
  const [open, setOpen] = useState(false);
  const sellable = tanks.filter((tk) => tk.tankType === "SELLABLE" && tk.isActive);
  const withholding = tanks.filter((tk) => tk.tankType === "WITHHOLDING" && tk.isActive);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("columns.tank")}
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">{t("tankDefaultDescription")}</p>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">{t("tankSellable")}</span>
          <Select onValueChange={(v) => onSetDefault("SELLABLE", v)}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={t("tankSelectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {sellable.map((tk) => (
                <SelectItem key={tk.id} value={tk.id}>
                  {tk.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">{t("tankWithholding")}</span>
          <Select onValueChange={(v) => onSetDefault("WITHHOLDING", v)}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder={t("tankSelectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {withholding.map((tk) => (
                <SelectItem key={tk.id} value={tk.id}>
                  {tk.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The editable grid for one day — all of the farm's configured sessions as columns at once (Figma
 * "Milk Log" table, node 734:32499), parented by `MilkLogSection` which remounts this (via
 * `key={date}`) on every date change so `useState`'s initializer always seeds fresh from that day's
 * saved values, with no `useEffect` resync needed. Search/shed filtering only affects which rows are
 * *displayed* — Save/Submit always act on the full day's rows (`entries`), not just the current
 * filtered/paginated page, since "Submit All Logs" means the whole day, not the current view. */
export function MilkLogTable({
  date,
  sessions,
  entries,
  search,
  shed,
  onDirtyChange,
}: {
  date: string;
  sessions: MilkSession[];
  entries: MilkLogRow[];
  search: string;
  shed: string | null;
  /** Bubbles up whenever drafts diverge from the last-saved snapshot, so the parent
   * (which owns `date`) can warn before a date switch discards unsaved input. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslations("milk.log");
  const saveLog = useSaveMilkLog();
  const submitMilk = useSubmitMilk();
  const initialDrafts = useMemo(() => buildInitialDrafts(entries), [entries]);
  const initialTankOverrides = useMemo(() => buildInitialTankOverrides(entries), [entries]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => initialDrafts);
  const [tankOverrides, setTankOverrides] = useState<Record<string, string>>(() => initialTankOverrides);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const tanksQuery = useMilkTanks({});
  const tanks = tanksQuery.data ?? [];
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | null>(null);

  const isDirty = useMemo(() => {
    for (const key of Object.keys(drafts)) {
      if ((drafts[key] ?? "") !== (initialDrafts[key] ?? "")) return true;
    }
    for (const key of Object.keys(tankOverrides)) {
      if ((tankOverrides[key] ?? "") !== (initialTankOverrides[key] ?? "")) return true;
    }
    return false;
  }, [drafts, tankOverrides, initialDrafts, initialTankOverrides]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // A draft that differs from the last-saved value AND belongs to a session already
  // `submitted` — re-saving it reconciles the tank balance (backend), not a plain
  // overwrite, so it gets one confirmation instead of silently firing on every Save.
  const touchesSubmittedEntry = useMemo(() => {
    for (const row of entries) {
      for (const session of row.log.submittedSessions) {
        const key = draftKey(row.cattleId, session);
        if ((drafts[key] ?? "") !== (initialDrafts[key] ?? "")) return true;
      }
    }
    return false;
  }, [entries, drafts, initialDrafts]);

  function handleSetDefaultTank(tankType: InventoryMilkTankType, tankId: string) {
    setTankOverrides((prev) => {
      const next = { ...prev };
      for (const row of entries) {
        const rowType: InventoryMilkTankType = row.withholding ? "WITHHOLDING" : "SELLABLE";
        if (rowType === tankType) next[row.cattleId] = tankId;
      }
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((row) => {
      if (shed && row.shed !== shed) return false;
      if (!q) return true;
      return row.tag.toLowerCase().includes(q) || (row.name ?? "").toLowerCase().includes(q);
    });
  }, [entries, search, shed]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Live per-row total from `drafts`, not the stale `row.log.totalL` snapshot from the last
  // fetch/save — otherwise the Total column never reacts to typing until a full Save round-trip.
  const liveTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of entries) {
      let sum = 0;
      for (const session of sessions) {
        const raw = drafts[draftKey(row.cattleId, session)];
        const value = Number(raw);
        if (raw !== "" && Number.isFinite(value) && value >= 0) sum += value;
      }
      totals.set(row.cattleId, Math.round(sum * 100) / 100);
    }
    return totals;
  }, [entries, sessions, drafts]);

  // `sessions` (from `FarmModuleSettings.milkActiveSessions`) isn't guaranteed to arrive in
  // chronological order — e.g. enabling Noon after Morning/Evening appends it last. Columns always
  // render in MILK_SESSIONS order regardless (below), so Space-navigation must use that same fixed
  // order too, or it'd jump somewhere other than "the next column to the right".
  const orderedActiveSessions = MILK_SESSIONS.filter((s) => sessions.includes(s));

  // Spreadsheet-style entry (milk is the highest-traffic module — a 10+ row table entered by mouse
  // alone is slow). Only fires when a yield input is focused, and only for Enter/Space; every other
  // key (digits, Tab, arrows, backspace) behaves natively. Scoped to the current page's active
  // (unlocked) session columns — a locked column has no input to navigate into, so it's skipped
  // automatically rather than needing special-cased logic.
  function focusCell(rowIndex: number, session: MilkSession) {
    if (rowIndex < 0 || rowIndex >= pageRows.length) return;
    const target = inputRefs.current.get(draftKey(pageRows[rowIndex].cattleId, session));
    if (!target) return;
    target.focus();
    target.select();
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, session: MilkSession) {
    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(rowIndex + 1, session);
    } else if (e.key === " ") {
      e.preventDefault();
      const sessionIndex = orderedActiveSessions.indexOf(session);
      const nextSession = orderedActiveSessions[sessionIndex + 1];
      if (nextSession) {
        focusCell(rowIndex, nextSession);
      } else if (orderedActiveSessions.length > 0) {
        // Last active column of the row — wrap to the next row's first session column,
        // same as a spreadsheet's Tab-at-end-of-row behavior.
        focusCell(rowIndex + 1, orderedActiveSessions[0]);
      }
    }
  }

  // Shared by `handleSave` (standalone) and `handleSubmit` (save-then-submit, see below) — the
  // only thing that persists `drafts` state to the backend. Entries whose session was already
  // `submitted` carry a fixed audit note — the backend reconciles the tank balance regardless.
  async function persistDrafts(): Promise<{ saved: number; anomaliesFlagged: number }> {
    let saved = 0;
    let anomaliesFlagged = 0;
    for (const session of sessions) {
      const sessionEntries = entries
        .map((row) => ({
          cattleId: row.cattleId,
          yieldL: Number(drafts[draftKey(row.cattleId, session)]),
          tankId: tankOverrides[row.cattleId],
          editReason: row.log.submittedSessions.includes(session)
            ? "Edited after submit via Milk Log"
            : undefined,
        }))
        .filter((entry) => {
          const raw = drafts[draftKey(entry.cattleId, session)];
          return raw !== "" && Number.isFinite(entry.yieldL) && entry.yieldL >= 0;
        });
      if (sessionEntries.length === 0) continue;
      const result = await saveLog.mutateAsync({ date, session, entries: sessionEntries });
      saved += result.saved;
      anomaliesFlagged += result.anomaliesFlagged;
    }
    return { saved, anomaliesFlagged };
  }

  async function handleSave() {
    if (touchesSubmittedEntry) {
      setPendingAction("save");
      setConfirmEditOpen(true);
      return;
    }
    await runSave();
  }

  async function runSave() {
    try {
      const { saved, anomaliesFlagged } = await persistDrafts();
      if (saved === 0) {
        toast.error(t("noEntries"));
        return;
      }
      toast.success(t("savedToast", { saved, anomalies: anomaliesFlagged }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  // Submit used to assume Save had already run — a user who typed values and hit Submit directly
  // (never clicking Save first) got a confusing "no entries" error from the backend, since nothing
  // had been persisted yet. Now Submit always saves whatever's pending first.
  async function handleSubmit() {
    if (touchesSubmittedEntry) {
      setPendingAction("submit");
      setConfirmEditOpen(true);
      return;
    }
    await runSubmit();
  }

  async function runSubmit() {
    try {
      await persistDrafts();
      for (const session of sessions) {
        try {
          await submitMilk.mutateAsync({ date, session });
        } catch (err) {
          // A session with nothing pending (already submitted, or never touched today) is
          // not a real failure here — `sessions` is every active column, not just the ones
          // this submit actually wrote to. Only that specific backend message means "skip
          // it and keep going"; any other error still aborts the loop.
          if (
            err instanceof ApiError &&
            err.isValidation &&
            err.message === "No new milk log entries to submit for this session"
          ) {
            continue;
          }
          throw err;
        }
      }
      // Distinct cows, not summed per-session counts — a cow logged in both Morning and
      // Evening is one cow, and summing `totalCowsLogged` across sessions double-counted it.
      const loggedCattleIds = new Set<string>();
      for (const row of entries) {
        for (const session of sessions) {
          const raw = drafts[draftKey(row.cattleId, session)];
          const value = Number(raw);
          if (raw !== "" && Number.isFinite(value) && value >= 0) {
            loggedCattleIds.add(row.cattleId);
            break;
          }
        }
      }
      toast.success(t("submittedToast", { count: loggedCattleIds.size }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("submitError"));
    }
  }

  async function handleConfirmEdit() {
    if (pendingAction === "save") await runSave();
    else if (pendingAction === "submit") await runSubmit();
    setPendingAction(null);
  }

  const isPending = saveLog.isPending || submitMilk.isPending;

  return (
    <>
      {filtered.length === 0 ? (
        <EmptyState title={entries.length === 0 ? t("noCattle") : t("noSearchResults")} />
      ) : (
        <>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border",
              // Figma "Milk Log" table spec (node 734:32487), scoped to this instance only: 54px
              // normal-case header row, 56px body rows (trimmed `py-2` cell padding) — same
              // convention `CattleTable` uses to pixel-match its own Figma header/row spec.
              "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
              "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
              "[&_tbody_td]:py-2",
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.cowId")}</TableHead>
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.shed")}</TableHead>
                  {MILK_SESSIONS.map((session) =>
                    sessions.includes(session) ? (
                      <TableHead key={session}>
                        <SessionActiveControl session={session} activeSessions={sessions} />
                      </TableHead>
                    ) : (
                      <TableHead key={session}>
                        <SessionLockControl session={session} activeSessions={sessions} />
                      </TableHead>
                    ),
                  )}
                  <TableHead>
                    <TankColumnHeaderControl tanks={tanks} onSetDefault={handleSetDefaultTank} />
                  </TableHead>
                  <TableHead>{t("columns.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, rowIndex) => (
                  <TableRow key={row.cattleId}>
                    <TableCell className="font-medium text-foreground">
                      <AnimalLink
                        id={row.cattleId}
                        tagNumber={row.tag}
                        className="text-foreground hover:text-primary"
                      >
                        {row.tag}
                      </AnimalLink>
                    </TableCell>
                    <TableCell>
                      <AnimalLink
                        id={row.cattleId}
                        animalName={row.name}
                        tagNumber={row.tag}
                        className="group flex items-center gap-2 text-left font-normal"
                      >
                        <Avatar className="size-8">
                          <AvatarFallback>{(row.name ?? row.tag).slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground group-hover:underline">{row.name ?? row.tag}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.avgYield7d != null ? t("avgYieldCaption", { value: row.avgYield7d }) : "—"}
                          </span>
                        </div>
                      </AnimalLink>
                    </TableCell>
                    <TableCell>
                      <Chip variant={row.withholding ? "destructive" : "primary"}>
                        {row.withholding ? t("statusWithholding") : t("statusMilking")}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.shed ?? "—"}</TableCell>
                    {MILK_SESSIONS.map((session) =>
                      !sessions.includes(session) ? (
                        <TableCell key={session}>
                          <div
                            className="flex h-9 w-24 items-center justify-center gap-1 rounded-sm bg-muted/50 px-1.5 text-muted-foreground"
                            title={t("sessionLockedNoAccess", { session: t(SESSION_LABEL_KEY[session]) })}
                          >
                            <Lock className="size-3.5 shrink-0" aria-hidden />
                            <span className="text-xs">{t("sessionLocked")}</span>
                          </div>
                        </TableCell>
                      ) : (
                        <TableCell key={session}>
                          <Can I="milk.log">
                            <div className="flex flex-col items-start gap-1">
                              <div
                                className={cn(
                                  "flex h-9 w-24 items-center gap-1 rounded-sm bg-card px-1.5",
                                  SESSION_GLOW[session],
                                )}
                              >
                                {row.log.submittedSessions.includes(session) ? (
                                  <span title={t("sessionAlreadySubmitted")}>
                                    <History className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  </span>
                                ) : null}
                                <Input
                                  ref={(el) => {
                                    const key = draftKey(row.cattleId, session);
                                    if (el) inputRefs.current.set(key, el);
                                    else inputRefs.current.delete(key);
                                  }}
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  className="h-auto w-full border-none p-0 text-sm leading-none shadow-none focus-visible:ring-0"
                                  value={drafts[draftKey(row.cattleId, session)] ?? ""}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({ ...prev, [draftKey(row.cattleId, session)]: e.target.value }))
                                  }
                                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, session)}
                                />
                                <span className="shrink-0 text-xs text-muted-foreground">L</span>
                              </div>
                              {row.log.dispositions[session] ? (
                                <Chip
                                  variant={DISPOSITION_VARIANT[row.log.dispositions[session]!]}
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  {t(`dispositionOptions.${row.log.dispositions[session]}`)}
                                </Chip>
                              ) : null}
                            </div>
                          </Can>
                        </TableCell>
                      ),
                    )}
                    <TableCell>
                      <Select
                        value={tankOverrides[row.cattleId] ?? ""}
                        onValueChange={(v) => setTankOverrides((prev) => ({ ...prev, [row.cattleId]: v }))}
                      >
                        <SelectTrigger size="sm" className="w-[130px] rounded-sm border-none bg-card px-1.5 text-xs shadow-card">
                          <SelectValue placeholder={row.withholding ? t("tankWithholding") : t("tankSellable")} />
                        </SelectTrigger>
                        <SelectContent>
                          {tanks
                            .filter((tk) => tk.tankType === (row.withholding ? "WITHHOLDING" : "SELLABLE") && tk.isActive)
                            .map((tk) => (
                              <SelectItem key={tk.id} value={tk.id}>
                                {tk.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{liveTotals.get(row.cattleId) ?? 0}L</span>
                        {row.prevDayYieldL != null ? (
                          (() => {
                            const live = liveTotals.get(row.cattleId) ?? 0;
                            if (live > row.prevDayYieldL) {
                              return <TrendingUp className="size-3.5 text-success" aria-hidden />;
                            }
                            if (live < row.prevDayYieldL) {
                              return <TrendingDown className="size-3.5 text-destructive" aria-hidden />;
                            }
                            return <Minus className="size-3.5 text-muted-foreground" aria-hidden />;
                          })()
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length > DEFAULT_PAGE_SIZE ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[8, 20, 50, 100]}
            />
          ) : null}
        </>
      )}
      <Can I="milk.log">
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={isPending} onClick={handleSave}>
            {saveLog.isPending ? t("saving") : t("save")}
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {submitMilk.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </Can>
      <ConfirmDialog
        open={confirmEditOpen}
        onOpenChange={(open) => {
          setConfirmEditOpen(open);
          if (!open) setPendingAction(null);
        }}
        title={t("editSubmittedTitle")}
        description={t("editSubmittedDescription")}
        confirmLabel={t("editSubmittedConfirm")}
        variant="primary"
        onConfirm={handleConfirmEdit}
      />
    </>
  );
}
