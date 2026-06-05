export interface NfcTag {
  id: 'empfang' | 'zimmer_101' | 'spa';
  label: string;
  actionCard: {
    title: string;
    description: string;
    cta: string;
  };
}

export const demoTags: NfcTag[] = [
  {
    id: 'empfang',
    label: 'Empfang',
    actionCard: {
      title: 'check-in starten',
      description: 'gib uns deine reservierungsnummer und wir haben deinen schlüssel in 2 minuten bereit.',
      cta: 'jetzt einchecken',
    },
  },
  {
    id: 'zimmer_101',
    label: 'Zimmer 101',
    actionCard: {
      title: 'service rufen',
      description: 'extra handtücher, frühstück im zimmer oder eine flasche wein? wir bringen es.',
      cta: 'service anfragen',
    },
  },
  {
    id: 'spa',
    label: 'Spa',
    actionCard: {
      title: 'spa-termin buchen',
      description: 'massage, sauna oder maniküre — verfügbarkeit für die nächsten 24h.',
      cta: 'verfügbarkeit ansehen',
    },
  },
];
