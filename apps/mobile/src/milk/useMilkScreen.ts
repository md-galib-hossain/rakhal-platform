/**
 * Hook managing the milk logging screen state and queued writes (WP10, ADR-006, UI/UX Redesign).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useToast } from '../components/feedback/Toast.tsx';
import type { PickerDayEntry } from '../components/picker/DateRangePicker.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import type { OutboxRow } from '../offline/outbox.ts';
import {
  DEFAULT_SESSIONS,
  defaultSessionByClock,
  toIsoDateString,
  type MilkCowRow,
  type MilkCowSessionEntry,
  type MilkEntryStatus,
  type MilkSession,
  type MilkTotals,
} from './milk-model.ts';
import type { MilkTankOption } from './TankSelectorSheet.tsx';

export interface ShedFilterOption {
  id: string;
  name: string;
}

export type MilkStatusFilter = 'all' | 'milking' | 'withheld';
export type MilkScreenTab = 'collection' | 'analytics';

export function useMilkScreen() {
  const sync = useSync();
  const { ready, snapshot } = sync;
  const { client } = useAuth();
  const { t } = useLocale();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<MilkScreenTab>('collection');
  const [date, setDate] = useState(() => toIsoDateString());
  const [session, setSession] = useState<MilkSession>(() => defaultSessionByClock());
  const [selectedShedId, setSelectedShedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MilkStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [configuredSessions, setConfiguredSessions] = useState<MilkSession[]>(() => [...DEFAULT_SESSIONS]);
  const [sheds, setSheds] = useState<ShedFilterOption[]>([]);
  const [rawCows, setRawCows] = useState<Record<string, unknown>[]>([]);
  const [rawMilkLogs, setRawMilkLogs] = useState<Record<string, unknown>[]>([]);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tanks state
  const [tanks, setTanks] = useState<MilkTankOption[]>([]);
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);

  // Calendar status days (e.g. missing entries)
  const [calendarDays, setCalendarDays] = useState<PickerDayEntry[]>([]);

  // Optimistic local yield overrides per cow & session
  const [multiYieldOverrides, setMultiYieldOverrides] = useState<
    Record<string, Partial<Record<MilkSession, number | null>>>
  >({});
  const [yieldOverrides, setYieldOverrides] = useState<Record<string, number | null>>({});

  // Container overrides per cow & session
  const [tankOverrides, setTankOverrides] = useState<
    Record<string, Partial<Record<MilkSession, string>>>
  >({});

  const lastSaveLocalId = useRef<string | null>(null);

  // Reset yieldOverrides when date changes
  useEffect(() => {
    setYieldOverrides({});
    setMultiYieldOverrides({});
    setTankOverrides({});
  }, [date]);

  // Query calendar days for the active month
  const currentMonth = date.slice(0, 7);
  useEffect(() => {
    let cancelled = false;
    void client
      .get<{ month?: string; days?: Array<{ date: string; status: string }> }>('/milk/log/calendar', {
        query: { month: currentMonth },
      })
      .then((res) => {
        if (cancelled) return;
        const days = res.data?.days;
        if (Array.isArray(days)) {
          const mapped: PickerDayEntry[] = days.map((d) => ({
            date: d.date,
            status: d.status === 'missing' ? 'missing' : d.status === 'complete' ? 'complete' : 'none',
          }));
          setCalendarDays(mapped);
        }
      })
      .catch(() => {
        // Safe offline fallback: network errors do not disrupt the screen
      });

    return () => {
      cancelled = true;
    };
  }, [client, currentMonth]);

  // Load sheds, tanks, and session config from cache
  useEffect(() => {
    if (!ready) return;

    void sync.readCache('sheds').then((rows) => {
      const parsedSheds: ShedFilterOption[] = rows
        .filter((r) => typeof r.id === 'string' && typeof r.name === 'string')
        .map((r) => ({ id: r.id as string, name: r.name as string }));
      setSheds(parsedSheds);
    });

    void sync.readCache('milkTanks').then((rows) => {
      const parsed: MilkTankOption[] = rows
        .filter((r) => typeof r.id === 'string' && typeof r.name === 'string')
        .map((r) => ({
          id: r.id as string,
          name: r.name as string,
          tankType: typeof r.tankType === 'string' ? (r.tankType as 'SELLABLE' | 'WITHHOLDING') : 'SELLABLE',
          totalCapacityL: typeof r.totalCapacityL === 'number' ? r.totalCapacityL : null,
          currentVolumeL: typeof r.currentVolumeL === 'number' ? r.currentVolumeL : null,
          isPrimary: r.isPrimary === true,
        }));
      setTanks(parsed);
      if (parsed.length > 0) {
        setSelectedTankId((prev) => {
          if (prev && parsed.some((t) => t.id === prev)) return prev;
          const primary =
            parsed.find((t) => t.isPrimary) ?? parsed.find((t) => t.tankType === 'SELLABLE') ?? parsed[0];
          return primary ? primary.id : null;
        });
      }
    });

    void sync.readSessionConfig().then((cfg) => {
      if (!cfg) return;
      const active: MilkSession[] = [];
      if (cfg.morning) active.push('MORNING');
      if (cfg.noon) active.push('NOON');
      if (cfg.evening) active.push('EVENING');
      if (cfg.night) active.push('NIGHT');
      if (active.length > 0) {
        setConfiguredSessions(active);
        if (!active.includes(session)) {
          setSession(defaultSessionByClock(new Date(), active));
        }
      }
    });
  }, [ready]);

  // Load cached cattle, milk logs, and outbox rows
  const reloadData = useCallback(() => {
    if (!ready) return;

    void sync.readCache('cattle').then(setRawCows);
    void sync.readCache('milkLog').then(setRawMilkLogs);
    void sync.list().then((rows) => {
      setOutboxRows(rows);
      const saves = rows.filter((r) => r.endpoint === 'milk.saveLog' && r.status !== 'done');
      if (saves.length > 0) {
        lastSaveLocalId.current = saves[saves.length - 1]!.localId;
      }
    });
  }, [ready, sync]);

  // Refresh whenever lastSyncedAt or outbox waiting count changes
  useEffect(() => {
    reloadData();
  }, [reloadData, snapshot.lastSyncedAt, snapshot.waiting, snapshot.conflict, snapshot.failed]);

  // Primary tank & withholding tank lookup
  const primaryTank = tanks.find((t) => t.isPrimary) ?? tanks.find((t) => t.tankType === 'SELLABLE') ?? tanks[0];
  const withholdingTank = tanks.find((t) => t.tankType === 'WITHHOLDING');

  // Build the list of cow rows
  const rows: MilkCowRow[] = useMemo(() => {
    // Index server milk logs by cattleId
    const serverLogByCow = new Map<string, Record<string, unknown>>();
    for (const log of rawMilkLogs) {
      if (typeof log.cattleId === 'string') {
        serverLogByCow.set(log.cattleId, log);
      }
    }

    // Index outbox pending writes per session
    // Map: `${cattleId}:${session}` -> { yieldL, status, localId, tankId }
    const outboxByCowSession = new Map<
      string,
      { yieldL: number | null; status: MilkEntryStatus; localId: string; tankId?: string }
    >();

    const localSubmittedSessions = new Set<string>();

    for (const ob of outboxRows) {
      if (ob.status === 'done') continue;
      if (ob.endpoint === 'milk.submit') {
        const body = ob.body as { date?: string; session?: string } | null;
        if (body && body.date === date && body.session) {
          localSubmittedSessions.add(body.session);
        }
      } else if (ob.endpoint === 'milk.saveLog') {
        const body = ob.body as {
          date?: string;
          session?: string;
          entries?: Array<{ cattleId: string; yieldL: number | null; tankId?: string }>;
        } | null;
        if (body && body.date === date && body.session && Array.isArray(body.entries)) {
          let entryStatus: MilkEntryStatus = 'waiting';
          if (ob.status === 'conflict') entryStatus = 'conflict';
          else if (ob.status === 'failed') entryStatus = 'failed';

          for (const entry of body.entries) {
            if (typeof entry.cattleId === 'string') {
              outboxByCowSession.set(`${entry.cattleId}:${body.session}`, {
                yieldL: typeof entry.yieldL === 'number' ? entry.yieldL : null,
                status: entryStatus,
                localId: ob.localId,
                tankId: entry.tankId,
              });
            }
          }
        }
      }
    }

    const term = search.trim().toLowerCase();
    const result: MilkCowRow[] = [];

    for (const cow of rawCows) {
      const id = typeof cow.id === 'string' ? cow.id : null;
      if (!id) continue;

      const gender = typeof cow.gender === 'string' ? cow.gender : null;
      if (gender && gender !== 'FEMALE') continue;

      const herdStatus = typeof cow.herdStatus === 'string' ? cow.herdStatus : null;
      if (herdStatus && herdStatus !== 'ACTIVE') continue;

      const prodStatus = typeof cow.productionStatus === 'string' ? cow.productionStatus : null;
      if (prodStatus === 'DRY') continue;

      const shedId = typeof cow.shedId === 'string' ? cow.shedId : undefined;
      if (selectedShedId && shedId !== selectedShedId) continue;

      const tag = typeof cow.tagNumber === 'string' ? cow.tagNumber : '';
      const name = typeof cow.name === 'string' ? cow.name : null;

      if (term) {
        const matchesTag = tag.toLowerCase().includes(term);
        const matchesName = name ? name.toLowerCase().includes(term) : false;
        if (!matchesTag && !matchesName) continue;
      }

      const sLog = serverLogByCow.get(id);
      const logData = (sLog?.log as Record<string, unknown> | undefined) ?? undefined;

      const withholding = Boolean(sLog?.withholding ?? cow.withholding);
      if (statusFilter === 'milking' && withholding) continue;
      if (statusFilter === 'withheld' && !withholding) continue;

      if (selectedTankId) {
        const selectedTank = tanks.find((t) => t.id === selectedTankId);
        if (selectedTank) {
          if (selectedTank.tankType === 'WITHHOLDING' && !withholding) continue;
          if (selectedTank.tankType === 'SELLABLE' && withholding) continue;
        }
      }

      const withholdingReason =
        typeof sLog?.withholdingReason === 'string'
          ? (sLog.withholdingReason as string)
          : typeof cow.withholdingReason === 'string'
            ? (cow.withholdingReason as string)
            : undefined;

      const prevDayYieldL =
        typeof sLog?.prevDayYieldL === 'number'
          ? (sLog.prevDayYieldL as number)
          : typeof cow.prevDayYieldL === 'number'
            ? (cow.prevDayYieldL as number)
            : undefined;

      const avgYield7d =
        typeof sLog?.avgYield7d === 'number'
          ? (sLog.avgYield7d as number)
          : typeof cow.avgYield7d === 'number'
            ? (cow.avgYield7d as number)
            : undefined;

      const serverAnomaly = Boolean(logData?.anomalyFlag);

      const submittedSessions = Array.isArray(logData?.submittedSessions)
        ? (logData.submittedSessions as string[])
        : [];

      const updatedMap =
        logData && typeof logData.updatedAt === 'object' && logData.updatedAt !== null
          ? (logData.updatedAt as Record<string, string>)
          : undefined;
      const baseUpdatedAt = updatedMap?.[session] ?? null;

      // Build session-wise entries
      const sessionsRecord: Record<MilkSession, MilkCowSessionEntry> = {
        MORNING: { yieldL: null },
        NOON: { yieldL: null },
        EVENING: { yieldL: null },
        NIGHT: { yieldL: null },
      };

      let cowTodaySum = 0;

      for (const s of DEFAULT_SESSIONS) {
        const key = `${s.toLowerCase()}L` as 'morningL' | 'noonL' | 'eveningL' | 'nightL';
        const serverSessionYield =
          logData && typeof logData[key] === 'number' ? (logData[key] as number) : null;

        const isSessSubmitted = submittedSessions.includes(s) || localSubmittedSessions.has(s);

        const obSessionEntry = outboxByCowSession.get(`${id}:${s}`);

        let finalSessionYield = serverSessionYield;
        let finalSessionStatus: MilkEntryStatus | null = serverSessionYield !== null ? 'saved' : null;

        if (obSessionEntry) {
          finalSessionYield = obSessionEntry.yieldL;
          finalSessionStatus = obSessionEntry.status;
        }

        // Multi-yield override check
        if (multiYieldOverrides[id]?.[s] !== undefined) {
          finalSessionYield = multiYieldOverrides[id]![s]!;
        } else if (s === session && id in yieldOverrides) {
          finalSessionYield = yieldOverrides[id]!;
        }

        // Container assignment
        const assignedTankId =
          tankOverrides[id]?.[s] ??
          obSessionEntry?.tankId ??
          (withholding ? withholdingTank?.id : selectedTankId ?? primaryTank?.id);

        const assignedTank = tanks.find((t) => t.id === assignedTankId);

        sessionsRecord[s] = {
          yieldL: finalSessionYield,
          tankId: assignedTankId,
          tankName: assignedTank?.name ?? (withholding ? 'Withholding Tank' : 'Tank A'),
          status: finalSessionStatus,
          isSubmitted: isSessSubmitted,
        };

        if (typeof finalSessionYield === 'number' && finalSessionYield > 0) {
          cowTodaySum += finalSessionYield;
        }
      }

      const activeSessionEntry = sessionsRecord[session];
      const isCurrentSessionSubmitted = activeSessionEntry.isSubmitted ?? false;

      result.push({
        cattleId: id,
        tag,
        name,
        animalCategory: typeof cow.animalCategory === 'string' ? cow.animalCategory : 'COW',
        breedName: typeof cow.breedName === 'string' ? cow.breedName : undefined,
        shedId,
        shedName: typeof cow.shedName === 'string' ? cow.shedName : undefined,
        withholding,
        withholdingReason,
        sessions: sessionsRecord,
        todayTotalL: Math.round(cowTodaySum * 10) / 10,
        yieldL: activeSessionEntry.yieldL,
        prevDayYieldL,
        avgYield7d,
        anomalyFlag: serverAnomaly,
        status: activeSessionEntry.status ?? null,
        baseUpdatedAt,
        outboxLocalId: outboxByCowSession.get(`${id}:${session}`)?.localId,
        isSubmitted: isCurrentSessionSubmitted,
      });
    }

    return result;
  }, [
    rawCows,
    rawMilkLogs,
    outboxRows,
    session,
    date,
    selectedShedId,
    statusFilter,
    selectedTankId,
    tanks,
    search,
    yieldOverrides,
    multiYieldOverrides,
    tankOverrides,
    primaryTank,
    withholdingTank,
  ]);

  // Reactive Live Totals
  const liveTotals: MilkTotals = useMemo(() => {
    let total = 0;
    let sellable = 0;
    let withheld = 0;
    let logged = 0;

    for (const r of rows) {
      const cowTotal = r.todayTotalL ?? (r.yieldL ?? 0);
      if (cowTotal > 0) {
        total += cowTotal;
        logged += 1;
        if (r.withholding) {
          withheld += cowTotal;
        } else {
          sellable += cowTotal;
        }
      }
    }

    return {
      totalL: Math.round(total * 10) / 10,
      sellableL: Math.round(sellable * 10) / 10,
      withheldL: Math.round(withheld * 10) / 10,
      loggedCount: logged,
      totalCows: rows.length,
    };
  }, [rows]);

  const totalLitres = liveTotals.totalL;
  const loggedCowsCount = liveTotals.loggedCount;

  // Is whole session already submitted?
  const isSessionSubmitted = useMemo(() => {
    return rows.length > 0 && rows.every((r) => r.isSubmitted);
  }, [rows]);

  // Update configured sessions
  const updateConfiguredSessions = useCallback(
    (newSessions: MilkSession[]) => {
      if (newSessions.length === 0) return;
      setConfiguredSessions(newSessions);
      if (!newSessions.includes(session)) {
        setSession(newSessions[0]!);
      }
    },
    [session],
  );

  const changeDay = useCallback((delta: number) => {
    setDate((cur) => {
      const parts = cur.split('-').map(Number);
      const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
      d.setDate(d.getDate() + delta);
      return toIsoDateString(d);
    });
  }, []);

  // Update yield: supports both (cattleId, yieldL) and (cattleId, session, yieldL, tankId)
  const updateYield = useCallback(
    async (
      cattleId: string,
      sessionOrYield: MilkSession | number | null,
      maybeYield?: number | null,
      tankId?: string,
    ) => {
      let targetSession: MilkSession = session;
      let newYieldL: number | null = null;

      if (typeof sessionOrYield === 'string') {
        targetSession = sessionOrYield;
        newYieldL = maybeYield !== undefined ? maybeYield : null;
      } else {
        newYieldL = sessionOrYield;
      }

      const cow = rows.find((r) => r.cattleId === cattleId);
      if (!cow) return;

      // Optimistic override
      setMultiYieldOverrides((prev) => ({
        ...prev,
        [cattleId]: {
          ...(prev[cattleId] || {}),
          [targetSession]: newYieldL,
        },
      }));

      if (targetSession === session) {
        setYieldOverrides((prev) => ({ ...prev, [cattleId]: newYieldL }));
      }

      const effectiveTankId = tankId ?? tankOverrides[cattleId]?.[targetSession] ?? selectedTankId;

      try {
        const queued = await sync.enqueue({
          endpoint: 'milk.saveLog',
          method: 'POST',
          path: '/milk/log',
          body: {
            date,
            session: targetSession,
            entries: [
              {
                cattleId,
                yieldL: newYieldL,
                baseUpdatedAt: cow.baseUpdatedAt,
                tankId: effectiveTankId,
              },
            ],
          },
        });
        lastSaveLocalId.current = queued.localId;
        reloadData();
      } catch (err) {
        console.warn('Failed to queue milk save', err);
      }
    },
    [rows, sync, date, session, selectedTankId, tankOverrides, reloadData],
  );

  // Update container for a cow & session
  const updateContainer = useCallback((cattleId: string, targetSession: MilkSession, tankId: string) => {
    setTankOverrides((prev) => ({
      ...prev,
      [cattleId]: {
        ...(prev[cattleId] || {}),
        [targetSession]: tankId,
      },
    }));
  }, []);

  // Save all entered drafts across sessions
  const saveAllDrafts = useCallback(async () => {
    let savedAny = false;

    for (const s of configuredSessions) {
      const entriesToSave: Array<{
        cattleId: string;
        yieldL: number | null;
        baseUpdatedAt: string | null;
        tankId?: string | null;
      }> = [];

      for (const r of rows) {
        if (r.withholding) continue;
        const sEntry = r.sessions?.[s];
        const yieldVal = sEntry?.yieldL ?? (s === session ? r.yieldL : null);
        if (typeof yieldVal === 'number' && yieldVal > 0) {
          entriesToSave.push({
            cattleId: r.cattleId,
            yieldL: yieldVal,
            baseUpdatedAt: r.baseUpdatedAt,
            tankId: sEntry?.tankId ?? tankOverrides[r.cattleId]?.[s] ?? selectedTankId,
          });
        }
      }

      if (entriesToSave.length > 0) {
        try {
          const queued = await sync.enqueue({
            endpoint: 'milk.saveLog',
            method: 'POST',
            path: '/milk/log',
            body: {
              date,
              session: s,
              entries: entriesToSave,
            },
          });
          lastSaveLocalId.current = queued.localId;
          savedAny = true;
        } catch (err) {
          console.warn('Failed to queue milk draft save for session', s, err);
        }
      }
    }

    if (savedAny) {
      reloadData();
      toast.show({
        message: t('milk.draftSaved'),
        tone: 'success',
      });
    }
  }, [configuredSessions, rows, session, tankOverrides, selectedTankId, sync, date, reloadData, toast, t]);

  // Submit current session
  const submitSession = useCallback(async () => {
    if (isSubmitting || isSessionSubmitted) return;
    setIsSubmitting(true);
    try {
      await sync.enqueue({
        endpoint: 'milk.submit',
        method: 'POST',
        path: '/milk/submit',
        body: {
          date,
          session,
        },
      });
      reloadData();
      toast.show({
        message: t('milk.submitted'),
        tone: 'success',
      });
    } catch (err) {
      console.warn('Failed to queue milk submit', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isSessionSubmitted, sync, date, session, reloadData, toast, t]);

  return {
    activeTab,
    setActiveTab,
    date,
    setDate,
    changeDay,
    session,
    setSession,
    configuredSessions,
    updateConfiguredSessions,
    sheds,
    selectedShedId,
    setSelectedShedId,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    rows,
    liveTotals,
    totalLitres,
    loggedCowsCount,
    tanks,
    selectedTankId,
    setSelectedTankId,
    calendarDays,
    isSessionSubmitted,
    isSubmitting,
    updateYield,
    updateContainer,
    saveAllDrafts,
    submitSession,
    reloadData,
  };
}
