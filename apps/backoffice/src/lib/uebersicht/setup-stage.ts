import type { SetupApp, AppStatus } from './apps-data';

export type Stage = 0 | 15 | 30 | 71 | 100;

export function normalizeStage(raw: number | null | undefined): Stage {
  if (!raw || raw <= 0)  return 0;
  if (raw >= 100)        return 100;
  if (raw >= 71)         return 71;
  if (raw >= 30)         return 30;
  if (raw >= 15)         return 15;
  return 0;
}

export function getAppStatus(app: SetupApp, stage: Stage): AppStatus {
  if (stage >= app.doneAt)        return 'done';
  if (app.activeAt === stage)     return 'active';
  return 'todo';
}

export function getDoneCount(stage: Stage): number {
  if (stage === 0)   return 0;
  if (stage === 15)  return 1;
  if (stage === 30)  return 2;
  if (stage === 71)  return 5;
  return 7;
}

export const HERO_TEXTS: Record<Stage, { title: string; sub: string }> = {
  0: {
    title: 'Willkommen<span class="dot-pink">.</span><br><strong>Lass uns dein Hotel einrichten.</strong>',
    sub:   'Sieben Apps, sieben Bereiche. Wir gehen das gemeinsam durch.',
  },
  15: {
    title: 'Gut gemacht<span class="dot-pink">.</span><br><strong>Jetzt kommt das Branding.</strong>',
    sub:   'Hotel-Daten stehen. Jetzt Logo, Farben und Theme einrichten.',
  },
  30: {
    title: 'Schöner Anfang<span class="dot-pink">.</span><br><strong>Weiter geht es.</strong>',
    sub:   'Hotel-Daten und Branding stehen. Fünf Bereiche noch.',
  },
  71: {
    title: 'Noch wenige Schritte,<br><strong>dann ist dein Hotel bereit<span class="dot-pink">.</span></strong>',
    sub:   'Karten brauchen Inhalt, ein Team fehlt noch. Fast geschafft.',
  },
  100: {
    title: 'Dein Hotel<br><strong>läuft<span class="dot-pink">.</span></strong>',
    sub:   'Alle Einstellungen findest du in den Apps. Klicke um zu ändern.',
  },
};
