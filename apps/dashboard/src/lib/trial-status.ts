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
  trial_started_at: string | null;
  subscription_status: string;
}): TrialStatus {
  if (hotel.subscription_status !== 'trial' || !hotel.trial_started_at) {
    return NOT_IN_TRIAL;
  }

  const startedAtMs = new Date(hotel.trial_started_at).getTime();
  if (Number.isNaN(startedAtMs)) return NOT_IN_TRIAL;

  const endsAtMs = startedAtMs + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
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
