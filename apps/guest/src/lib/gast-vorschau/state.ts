export interface PreviewState {
  persona: 'arrival' | 'in_house' | 'departure';
  view: 'home' | 'eve' | 'recommendations' | 'service';
  branding: { theme: 'coffee' | 'ocean' | 'forest' };
  modules: {
    eve: boolean;
    recommendations: boolean;
    service: boolean;
    breakfast: boolean;
    self_checkout: boolean;
    action_cards: boolean;
    wallet: boolean;
  };
  welcomeText: string;
  formality: 'du' | 'sie';
  activeLanguages: string[];
  defaultLanguage: string;
}

export const initialState: PreviewState = {
  persona: 'in_house',
  view: 'home',
  branding: { theme: 'coffee' },
  modules: {
    eve: true,
    recommendations: true,
    service: true,
    breakfast: true,
    self_checkout: true,
    action_cards: true,
    wallet: true,
  },
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
