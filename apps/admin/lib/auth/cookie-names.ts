/** Admin session cookies. Distinct from any consumer-app cookie names (separate origin + identity). */
export const ACCESS_COOKIE = "rk_admin_at";
export const REFRESH_COOKIE = "rk_admin_rt";
/** Short-lived token that only authorises the 2FA setup/enable calls. */
export const SETUP_COOKIE = "rk_admin_setup";

export const ACCESS_MAX_AGE_FALLBACK_S = 60 * 60;
export const REFRESH_MAX_AGE_S = 7 * 24 * 60 * 60;
export const SETUP_MAX_AGE_S = 10 * 60;
