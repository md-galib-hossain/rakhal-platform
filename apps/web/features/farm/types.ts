/** Shape of `GET /farms` list entries — same contract `lib/auth/session.ts`'s login bootstrap already
 * consumes. No location/address field exists on this model; `slug` is the closest secondary identifier. */
export interface FarmSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
}
