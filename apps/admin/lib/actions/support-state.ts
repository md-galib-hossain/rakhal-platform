/**
 * Shared shape of a support action's result. Lives outside `support.ts` on purpose: a "use server" file may
 * only export async functions, so a constant exported from there breaks the whole module at runtime.
 */
export interface ActionState {
  ok: boolean;
  message: string | null;
  errors?: Record<string, string>;
}

export const initialActionState: ActionState = { ok: false, message: null };
