/**
 * Auth state for the app (WP5c). Wraps the framework-free `ApiClient` from `@rakhal/api-client`:
 *
 *  - `restoring`: reading SecureStore (no network). The shell may render as soon as this settles, even offline.
 *  - `signedIn`: a refresh token is stored. `user` is null until the first successful refresh/login (cold start
 *    offline); `farmId` may be `''` when the account still has to pick a farm (`needsFarm`).
 *  - `signedOut`: no session. `expired` is true when the server ended it (revoked, expired, reuse detected), so the
 *    login screen can say so instead of a generic message.
 *
 * Not mounted in `AppProviders` yet: WP5d adds the login/farm screens and mounts it with them.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Constants from 'expo-constants';
import {
  createApiClient,
  type ApiClient,
  type AuthUser,
  type FarmSummary,
  type SessionInfo,
} from '@rakhal/api-client';
import { currentApiBaseUrl } from '../config/runtime-api-url.ts';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import type { PrefStorage } from '../storage/prefs.ts';
import { clearAccess, loadAccess, saveAccess } from './access-store.ts';
import { secureTokenStore } from './secure-token-store.ts';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Active farm; `''` when signed in but not yet scoped to a farm. */
  farmId: string;
  needsFarm: boolean;
  /** Farms offered after a login with two or more memberships and no farm chosen. */
  farms: FarmSummary[] | null;
  /** True when the last sign-out was forced by the server. Reset by the next successful sign-in. */
  expired: boolean;
  /**
   * The account's permissions for the active farm (`resource.action`, `*`, `resource.*`), or `null` while unknown
   * (no farm yet, or first load with neither a cached nor a server answer). Use `can()` / `PermissionGate`.
   */
  permissions: string[] | null;
  /** Active farm's display name; `null` until known. */
  farmName: string | null;
  /** Where `permissions` came from: nothing yet, the offline cache, or the server (fresh). */
  accessSource: 'none' | 'cache' | 'server';
  /** Typed API access for screens and the sync engine. */
  client: ApiClient;
  signIn(identifier: string, password: string, farmId?: string): Promise<SessionInfo>;
  signOut(): Promise<void>;
  switchFarm(farmId: string): Promise<SessionInfo>;
}

export interface ClientHooks {
  onSessionExpired: () => void;
}

export interface AuthProviderProps {
  children: ReactNode;
  /** Tests inject a client built over a fake fetch; production builds one over SecureStore. */
  createClient?: (hooks: ClientHooks) => ApiClient;
  /** Where the offline access snapshot is cached (prefs store; not a credential). Tests inject memoryPrefs. */
  accessStorage?: PrefStorage;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function defaultCreateClient(hooks: ClientHooks): ApiClient {
  return createApiClient({
    baseUrl: currentApiBaseUrl(),
    store: secureTokenStore,
    deviceName: Constants.deviceName ?? undefined,
    onSessionExpired: hooks.onSessionExpired,
  });
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  farmId: string;
  needsFarm: boolean;
  farms: FarmSummary[] | null;
  expired: boolean;
}

const INITIAL: AuthState = {
  status: 'restoring',
  user: null,
  farmId: '',
  needsFarm: false,
  farms: null,
  expired: false,
};

interface AccessState {
  permissions: string[] | null;
  farmName: string | null;
  source: 'none' | 'cache' | 'server';
}

const NO_ACCESS: AccessState = { permissions: null, farmName: null, source: 'none' };

export function AuthProvider({
  children,
  createClient = defaultCreateClient,
  accessStorage = asyncStoragePrefs,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(INITIAL);
  const [access, setAccess] = useState<AccessState>(NO_ACCESS);
  const expireRef = useRef<() => void>(() => undefined);

  // Created once per provider mount; a new factory identity must not drop the session.
  const [client] = useState(() => createClient({ onSessionExpired: () => expireRef.current() }));

  useEffect(() => {
    expireRef.current = () => setState({ ...INITIAL, status: 'signedOut', expired: true });
    return () => {
      expireRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await client.restore().catch(() => ({ signedIn: false, farmId: '' }));
      if (cancelled) return;
      if (!restored.signedIn) {
        setState({ ...INITIAL, status: 'signedOut' });
        return;
      }
      setState({
        ...INITIAL,
        status: 'signedIn',
        farmId: restored.farmId,
        needsFarm: restored.farmId === '',
      });
      // Fill in the user in the background. Offline or a server error leaves the restored session as it is;
      // a 401 is handled by the client's onSessionExpired.
      try {
        const info = await client.refresh();
        if (!cancelled) {
          setState((prev) =>
            prev.status === 'signedIn'
              ? { ...prev, user: info.user, farmId: info.farmId, needsFarm: info.needsFarm }
              : prev,
          );
        }
      } catch {
        // intentionally ignored (see above)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Permissions and farm name for the ACTIVE farm. Shown from the cache first (so the shell renders offline), then
  // replaced by the server's answer. A failed fetch keeps the cache; a signed-out session clears it.
  useEffect(() => {
    if (state.status === 'signedOut') {
      setAccess(NO_ACCESS);
      void clearAccess(accessStorage);
      return;
    }
    if (state.status !== 'signedIn' || state.farmId === '') {
      setAccess(NO_ACCESS);
      return;
    }
    const farmId = state.farmId;
    let cancelled = false;
    void (async () => {
      const cached = await loadAccess(accessStorage, farmId);
      if (cancelled) return;
      if (cached) setAccess({ permissions: cached.permissions, farmName: cached.farmName, source: 'cache' });

      const [me, farms] = await Promise.allSettled([
        client.get<{ permissions?: unknown }>('/auth/me'),
        client.get<FarmSummary[]>('/farms'),
      ]);
      if (cancelled || me.status !== 'fulfilled') return; // offline or server error: keep what we have
      const raw = me.value.data.permissions;
      const permissions = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
      const farmList = farms.status === 'fulfilled' && Array.isArray(farms.value.data) ? farms.value.data : [];
      const farmName = farmList.find((f) => f.id === farmId)?.name ?? cached?.farmName ?? null;
      setAccess({ permissions, farmName, source: 'server' });
      await saveAccess(accessStorage, { farmId, farmName, permissions });
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.farmId, client, accessStorage]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (identifier, password, farmId) => {
      const info = await client.login({ identifier, password, farmId });
      setState({
        status: 'signedIn',
        user: info.user,
        farmId: info.farmId,
        needsFarm: info.needsFarm,
        farms: info.farms ?? null,
        expired: false,
      });
      return info;
    },
    [client],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    await client.logout();
    setState({ ...INITIAL, status: 'signedOut' });
  }, [client]);

  const switchFarm = useCallback<AuthContextValue['switchFarm']>(
    async (farmId) => {
      const info = await client.switchFarm(farmId);
      setState((prev) => ({
        ...prev,
        user: info.user,
        farmId: info.farmId,
        needsFarm: info.needsFarm,
        farms: null,
      }));
      return info;
    },
    [client],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      permissions: access.permissions,
      farmName: access.farmName,
      accessSource: access.source,
      client,
      signIn,
      signOut,
      switchFarm,
    }),
    [state, access, client, signIn, signOut, switchFarm],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
