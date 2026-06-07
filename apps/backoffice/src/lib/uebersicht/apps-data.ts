export type AppStatus = 'todo' | 'active' | 'done';

export interface SetupApp {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  num: string;
  label: string;
  sub: string;
  activeAt: number;
  doneAt: number;
  sticker: { todo: string; active: string; done: string };
  href: string;
}

export const APPS: SetupApp[] = [
  { id: 1, num: '01', label: 'Hotel-Daten',  sub: 'Name · Adresse',
    activeAt: 0,  doneAt: 15,  sticker: { todo: 'WAIT', active: 'START', done: 'DONE'   }, href: '/settings'          },
  { id: 2, num: '02', label: 'Branding',     sub: 'Farben · Schrift',
    activeAt: 15, doneAt: 30,  sticker: { todo: 'WAIT', active: 'START', done: 'DONE'   }, href: '/branding'          },
  { id: 3, num: '03', label: 'Module',       sub: 'Eve · Empfehlungen',
    activeAt: 30, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: '3/5 ON' }, href: '/features'          },
  { id: 4, num: '04', label: 'PMS-Bridge',   sub: 'Apaleo · Protel',
    activeAt: -1, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: 'LINKED' }, href: '/admin/pms'         },
  { id: 5, num: '05', label: '2FA-Sicherheit', sub: 'Zwei-Faktor',
    activeAt: -1, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: 'ARMED'  }, href: '/admin/sicherheit'  },
  { id: 6, num: '06', label: 'NFC-Karten',   sub: 'Gast-Content',
    activeAt: 71, doneAt: 100, sticker: { todo: '0/6',  active: 'START', done: '6/6 ON' }, href: '/admin/nfc-tags'    },
  { id: 7, num: '07', label: 'Team',         sub: 'Einladen',
    activeAt: -1, doneAt: 100, sticker: { todo: 'SOLO', active: 'START', done: '3 USR'  }, href: '/admin/team'        },
];
