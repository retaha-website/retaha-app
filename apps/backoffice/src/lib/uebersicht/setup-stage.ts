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

// Hero-Texte (title/sub) liegen als bt()-Keys 'hero.<stage>.title|sub' in BO_STRINGS;
// HeroSection löst sie sprachabhängig auf (title via set:html, da HTML enthalten).
