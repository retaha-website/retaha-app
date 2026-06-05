export interface PreviewState {
  scene: 'empfang' | 'zimmer_101' | 'spa';
  view: 'home' | 'eve' | 'empfehlungen' | 'service';
  branding: { theme: 'coffee' | 'ocean' | 'forest' };
  modules: { eve: boolean; empfehlungen: boolean; service: boolean };
  welcomeText: string;
  formality: 'du' | 'sie';
  activeLanguages: string[];
  defaultLanguage: string;
}

export const initialState: PreviewState = {
  scene: 'empfang',
  view: 'home',
  branding: { theme: 'coffee' },
  modules: { eve: true, empfehlungen: true, service: true },
  welcomeText: 'willkommen im the gate garden hotel',
  formality: 'du',
  activeLanguages: ['de', 'en'],
  defaultLanguage: 'de',
};

let _state: PreviewState = { ...initialState };
const _listeners: Array<(s: PreviewState) => void> = [];

export function getState(): PreviewState { return _state; }

export function updateState(patch: Partial<PreviewState>): void {
  _state = { ..._state, ...patch } as PreviewState;
  _listeners.forEach(fn => fn(_state));
}

export function subscribe(fn: (s: PreviewState) => void): () => void {
  _listeners.push(fn);
  fn(_state); // call immediately with current state
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}
