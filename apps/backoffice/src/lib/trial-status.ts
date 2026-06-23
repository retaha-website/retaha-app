export const TRIAL_DURATION_DAYS = 14;

export type TrialUrgency = 'normal' | 'warning' | 'critical' | 'expired';

export type TrialStatus = {
  isInTrial: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  endsAt: Date | null;
  urgencyLevel: TrialUrgency;
};

const NOT_IN_TRIAL: TrialStatus = {
  isInTrial: false,
  daysRemaining: 0,
  hoursRemaining: 0,
  endsAt: null,
  urgencyLevel: 'normal',
};

export function calculateTrialStatus(hotel: {
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string;
}): TrialStatus {
  // Neues Modell (finale Spec): explizites trial_ends_at hat Vorrang — Trial aktiv
  // solange now() < trial_ends_at. Fallback auf das alte Modell (subscription_status
  // === 'trial' + trial_started_at + 14 Tage), solange trial_ends_at noch nicht
  // überall gesetzt ist.
  let endsAtMs: number | null = null;
  if (hotel.trial_ends_at) {
    const m = new Date(hotel.trial_ends_at).getTime();
    if (!Number.isNaN(m)) endsAtMs = m;
  } else if (hotel.subscription_status === 'trial' && hotel.trial_started_at) {
    const startedAtMs = new Date(hotel.trial_started_at).getTime();
    if (!Number.isNaN(startedAtMs)) {
      endsAtMs = startedAtMs + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
    }
  }
  if (endsAtMs == null) return NOT_IN_TRIAL;

  const nowMs = Date.now();
  const msRemaining = endsAtMs - nowMs;

  const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  let urgencyLevel: TrialUrgency;
  if (msRemaining <= 0) urgencyLevel = 'expired';
  else if (daysRemaining <= 2) urgencyLevel = 'critical';
  else if (daysRemaining <= 7) urgencyLevel = 'warning';
  else urgencyLevel = 'normal';

  return {
    isInTrial: true,
    daysRemaining,
    hoursRemaining,
    endsAt: new Date(endsAtMs),
    urgencyLevel,
  };
}
