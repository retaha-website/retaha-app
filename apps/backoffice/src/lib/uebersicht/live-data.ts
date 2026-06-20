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
  // label/sub sind bt()-Keys; LiveTile löst via bt(tile.label, lang) auf.
  return [
    { key: 'empfang',    num: 3,  label: 'live.1.label', sub: 'live.1.sub', href: '/checkins'            },
    { key: 'schluessel', num: 12, label: 'live.2.label', sub: 'live.2.sub', href: '/admin/nfc-tags'      },
    { key: 'glocke',     num: 5,  label: 'live.3.label', sub: 'live.3.sub', href: '/admin/concierge'     },
    { key: 'gaeste',     num: 23, label: 'live.4.label', sub: 'live.4.sub', href: '/admin/guests'        },
    { key: 'brief',      num: 2,  label: 'live.5.label', sub: 'live.5.sub', href: '/admin/eve/knowledge' },
  ];
}
