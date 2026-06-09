export interface NfcTag {
  id: 'arrival' | 'in_house' | 'departure';
  label: string;
  actionCard: {
    title: string;
    description: string;
    cta: string;
  };
}

export const demoTags: NfcTag[] = [
  {
    id: 'arrival',
    label: 'Anreise',
    actionCard: {
      title: 'check-in starten',
      description: 'gib uns deine reservierungsnummer und wir haben deinen schlüssel in 2 minuten bereit.',
      cta: 'jetzt einchecken',
    },
  },
  {
    id: 'in_house',
    label: 'Im Hotel',
    actionCard: {
      title: 'service rufen',
      description: 'extra handtücher, frühstück im zimmer oder eine flasche wein? wir bringen es.',
      cta: 'service anfragen',
    },
  },
  {
    id: 'departure',
    label: 'Abreise',
    actionCard: {
      title: 'check-out starten',
      description: 'rechnung prüfen, schlüssel abgeben, feedback hinterlassen — alles in einem schritt.',
      cta: 'check-out starten',
    },
  },
];
