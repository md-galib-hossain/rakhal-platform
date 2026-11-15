import type { SharedLabels } from "@rakhal/ui/lib/labels";
import type { Locale } from "@/lib/constants/i18n";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";

/** Builds the `SharedLabels` object a test's `<LabelsProvider>` needs, from whichever locale's
 * messages JSON the test is already rendering with (the same object passed to
 * `<NextIntlClientProvider messages={...}>`) — so a test stays in its own chosen locale instead of
 * silently falling back to English. Pass the same `en`/`bn` import the test already uses. */
export function buildSharedLabels(messages: typeof en | typeof bn): SharedLabels {
  const common = messages.common;
  return {
    datePicker: { today: common.today, clear: common.clear },
    dateTimePicker: {
      time: common.time,
      hour: common.hour,
      minute: common.minute,
      now: common.now,
      clear: common.clear,
      done: common.done,
    },
    infiniteScroll: {
      loading: common.infiniteScroll.loading,
      error: common.infiniteScroll.error,
      retry: common.infiniteScroll.retry,
      loadMore: common.infiniteScroll.loadMore,
      end: common.infiniteScroll.end,
    },
  };
}

export type { Locale };
