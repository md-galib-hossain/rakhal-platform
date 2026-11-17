/**
 * Hook managing the milk logging screen state and queued writes (WP10, ADR-006).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/feedback/Toast.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import type { OutboxRow } from '../offline/outbox.ts';
import {
  DEFAULT_SESSIONS,
  defaultSessionByClock,
  toIsoDateString,
  type MilkCowRow,
  type MilkEntryStatus,
  type MilkSession,
} from './milk-model.ts';

export interface ShedFilterOption {
  id: string;
  name: string;
}

export function useMilkScreen() {
  const sync = useSync();
  const { ready, snapshot } = sync;
  const { t } = useLocale();
  const format = useFormat();
  const toast = useToast();

  const [date, setDate] = useState(() => toIsoDateString());
  const [session, setSession] = useState<MilkSession>(() => defaultSessionByClock());
  const [selectedShedId, setSelectedShedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [configuredSessions, setConfiguredSessions] = useState<MilkSession[]>(() => [...DEFAULT_SESSIONS]);
  const [sheds, setSheds] = useState<ShedFilterOption[]>([]);
  const [rawCows, setRawCows] = useState<Record<string, unknown>[]>([]);
  const [rawMilkLogs, setRawMilkLogs] = useState<Record<string, unknown>[]>([]);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastSaveLocalId = useRef<string | null>(null);

  // Load sheds and session config from cache
  useEffect(() => {
    if (!ready) return;

    void sync.readCache('sheds').then((rows) => {
      const parsedSheds: ShedFilterOption[] = rows
        .filter((r) => typeof r.id === 'string' && typeof r.name === 'string')
        .map((r) => ({ id: r.id as string, name: r.name as string }));
      setSheds(parsedSheds);
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
        // If current session is not in active, switch to default
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
      // Find the last milk.saveLog id for dependencies
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

  // Build the list of cow rows
  const rows: MilkCowRow[] = useMemo(() => {
    // Session property name in server log (e.g. MORNING -> morningL)
    const sessionKey = `${session.toLowerCase()}L` as 'morningL' | 'noonL' | 'eveningL' | 'nightL';

    // Index server milk logs by cattleId
    const serverLogByCow = new Map<string, Record<string, unknown>>();
    for (const log of rawMilkLogs) {
      if (typeof log.cattleId === 'string') {
        serverLogByCow.set(log.cattleId, log);
      }
    }

    // Index outbox pending writes for this date and session
    // Map: cattleId -> { yieldL, status, localId }
    const outboxByCow = new Map<
      string,
      { yieldL: number | null; status: MilkEntryStatus; localId: string }
    >();

    // Also check if submit is queued or done for this date and session
    let isSessionSubmittedLocally = false;

    for (const ob of outboxRows) {
      if (ob.status === 'done') continue;
      if (ob.endpoint === 'milk.submit') {
        const body = ob.body as { date?: string; session?: string } | null;
        if (body && body.date === date && body.session === session) {
          isSessionSubmittedLocally = true;
        }
      } else if (ob.endpoint === 'milk.saveLog') {
        const body = ob.body as {
          date?: string;
          session?: string;
          entries?: Array<{ cattleId: string; yieldL: number | null }>;
        } | null;
        if (body && body.date === date && body.session === session && Array.isArray(body.entries)) {
          let entryStatus: MilkEntryStatus = 'waiting';
          if (ob.status === 'conflict') entryStatus = 'conflict';
          else if (ob.status === 'failed') entryStatus = 'failed';

          for (const entry of body.entries) {
            if (typeof entry.cattleId === 'string') {
              outboxByCow.set(entry.cattleId, {
                yieldL: typeof entry.yieldL === 'number' ? entry.yieldL : null,
                status: entryStatus,
                localId: ob.localId,
              });
            }
          }
        }
      }
    }

    // Filter cows:
    // Eligible milking cows: FEMALE, productionStatus not 'DRY' (or 'MILKING'/'HEIFER'/etc), not departed
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

      // Check server log
      const sLog = serverLogByCow.get(id);
      const logData = (sLog?.log as Record<string, unknown> | undefined) ?? undefined;

      const serverYield = logData && typeof logData[sessionKey] === 'number' ? (logData[sessionKey] as number) : null;
      const submittedSessions = Array.isArray(logData?.submittedSessions)
        ? (logData.submittedSessions as string[])
        : [];
      const isServerSubmitted = submittedSessions.includes(session);
      const isSubmitted = isServerSubmitted || isSessionSubmittedLocally;

      // updatedAt dictionary per session from Step 1
      const updatedMap =
        logData && typeof logData.updatedAt === 'object' && logData.updatedAt !== null
          ? (logData.updatedAt as Record<string, string>)
          : undefined;
      const baseUpdatedAt = updatedMap?.[session] ?? null;

      const withholding = Boolean(sLog?.withholding ?? cow.withholding);
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

      // Check if outbox has a write for this cow
      const obEntry = outboxByCow.get(id);

      let finalYieldL = serverYield;
      let finalStatus: MilkEntryStatus | null = serverYield !== null ? 'saved' : null;
      let outboxLocalId: string | undefined;

      if (obEntry) {
        finalYieldL = obEntry.yieldL;
        finalStatus = obEntry.status;
        outboxLocalId = obEntry.localId;
      }

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
        yieldL: finalYieldL,
        prevDayYieldL,
        avgYield7d,
        anomalyFlag: serverAnomaly,
        status: finalStatus,
        baseUpdatedAt,
        outboxLocalId,
        isSubmitted,
      });
    }

    return result;
  }, [rawCows, rawMilkLogs, outboxRows, session, date, selectedShedId, search]);

  // Totals
  const { totalLitres, loggedCowsCount } = useMemo(() => {
    let litres = 0;
    let count = 0;
    for (const r of rows) {
      if (r.yieldL !== null && r.yieldL > 0) {
        litres += r.yieldL;
        count += 1;
      }
    }
    return { totalLitres: litres, loggedCowsCount: count };
  }, [rows]);

  // Is whole session already submitted?
  const isSessionSubmitted = useMemo(() => {
    return rows.length > 0 && rows.every((r) => r.isSubmitted);
  }, [rows]);

  // Update yield with 5-second undo toast
  const changeDay = useCallback((delta: number) => {
    setDate((cur) => {
      const parts = cur.split('-').map(Number);
      const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
      d.setDate(d.getDate() + delta);
      return toIsoDateString(d);
    });
  }, []);

  const updateYield = useCallback(
    async (cattleId: string, newYieldL: number | null) => {
      const cow = rows.find((r) => r.cattleId === cattleId);
      if (!cow) return;

      const prevYieldL = cow.yieldL;

      try {
        const queued = await sync.enqueue({
          endpoint: 'milk.saveLog',
          method: 'POST',
          path: '/milk/log',
          body: {
            date,
            session,
            entries: [
              {
                cattleId,
                yieldL: newYieldL,
                baseUpdatedAt: cow.baseUpdatedAt,
              },
            ],
          },
        });
        lastSaveLocalId.current = queued.localId;
        reloadData();

        // 5s Undo Toast
        const cowTitle = cow.tag || cow.name || cattleId;
        toast.show({
          message: t('milk.savedToast', {
            tag: cowTitle,
            yield: format.numberSafe(newYieldL ?? 0),
          }),
          tone: 'success',
          action: {
            label: t('milk.undo'),
            onPress: () => {
              void sync.enqueue({
                endpoint: 'milk.saveLog',
                method: 'POST',
                path: '/milk/log',
                body: {
                  date,
                  session,
                  entries: [
                    {
                      cattleId,
                      yieldL: prevYieldL,
                      baseUpdatedAt: cow.baseUpdatedAt,
                    },
                  ],
                },
              }).then(reloadData);
            },
          },
        });
      } catch (err) {
        console.warn('Failed to queue milk save', err);
      }
    },
    [rows, sync, date, session, reloadData, toast, t, format],
  );

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
        dependsOn: lastSaveLocalId.current || undefined,
      });
      reloadData();
      toast.show({
        message: t('milk.saved'),
        tone: 'success',
      });
    } catch (err) {
      console.warn('Failed to queue milk submit', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isSessionSubmitted, sync, date, session, reloadData, toast, t]);

  return {
    date,
    setDate,
    changeDay,
    session,
    setSession,
    configuredSessions,
    sheds,
    selectedShedId,
    setSelectedShedId,
    search,
    setSearch,
    rows,
    totalLitres,
    loggedCowsCount,
    isSessionSubmitted,
    isSubmitting,
    updateYield,
    submitSession,
    reloadData,
  };
}
