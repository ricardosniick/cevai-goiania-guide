/** Shared visitor quotas. Keep below the configured global ceilings when changing them. */
export const GUEST_BUDGET = {
  text_search: { minute: 10, day: 100 },
  nearby_search: { minute: 10, day: 100 },
  details_full: { minute: 15, day: 150 },
  photo: { minute: 75, day: 1000 },
} as const;
export type GuestBucket = keyof typeof GUEST_BUDGET;
export const GUEST_BUDGET_MSG = "As consultas para visitantes atingiram o limite temporário. Tente mais tarde ou entre na sua conta.";
