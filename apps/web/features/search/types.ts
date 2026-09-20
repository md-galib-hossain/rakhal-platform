/** `GET /search?q=&limit=` (RAKHAL-257, `search.service.ts`) — one normalized hit across every
 * searchable entity. `link` is server-provided (`/cattle/:id`, `/tasks/:id`, etc.) — the frontend
 * never builds its own route from the entity type, it just navigates to `link`. */
export interface SearchHit {
  id: string;
  label: string;
  sublabel: string | null;
  score: number;
  link: string;
}

export interface SearchResults {
  cattle: SearchHit[];
  tasks: SearchHit[];
  suppliers: SearchHit[];
  buyers: SearchHit[];
  sheds: SearchHit[];
  medicines: SearchHit[];
}

/** Backend returns every group's key even when empty (`SearchService#search`'s own initializer) —
 * the frontend only needs to check each array's length before rendering its `CommandGroup`. */
export interface SearchResponse {
  query: string;
  results: SearchResults;
  total: number;
}
