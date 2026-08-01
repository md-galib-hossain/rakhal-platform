/**
 * Default breed rows every new farm starts with (a brand-new farm's `Breed`
 * table is otherwise empty — nothing in the register/create-farm/onboarding
 * path ever seeded it). Mirrors the curated list in `prisma/demo-data/breeds.json`.
 */
export const DEFAULT_BREEDS: ReadonlyArray<{
  name: string;
  description: string;
}> = [
  { name: 'Holstein Friesian', description: 'High-yield exotic dairy breed' },
  { name: 'Sahiwal', description: 'Heat-tolerant zebu dairy breed' },
  { name: 'Jersey', description: 'Small-frame, high-fat milk' },
  {
    name: 'Red Chittagong',
    description: 'Native Bangladeshi dual-purpose breed',
  },
  { name: 'Local Cross', description: 'Holstein × local crossbred' },
];
