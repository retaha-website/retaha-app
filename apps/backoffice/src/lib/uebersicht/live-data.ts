export type LiveKey = 'empfang' | 'schluessel' | 'glocke' | 'gaeste' | 'brief';

export interface LiveTileData {
  key: LiveKey;
  num: number;
  label: string;
  sub: string;
  href: string;
}

export async function getLiveData(_hotelId: string): Promise<LiveTileData[]> {
  // TODO Sprint-K: echte Daten aus Supabase / Mews-API
  return [
    { key: 'empfang',    num: 3,  label: 'Ankünfte',    sub: 'Heute',             href: '/admin/checkins'      },
    { key: 'schluessel', num: 12, label: 'Schlüssel',   sub: 'ausgegeben',        href: '/admin/nfc-tags'      },
    { key: 'glocke',     num: 5,  label: 'Anfragen',    sub: 'Eve · offen',       href: '/admin/concierge'     },
    { key: 'gaeste',     num: 23, label: 'Gäste',       sub: 'aktuell im Haus',   href: '/admin/guests'        },
    { key: 'brief',      num: 2,  label: 'Nachrichten', sub: 'ungelesen',         href: '/admin/eve/knowledge' },
  ];
}
