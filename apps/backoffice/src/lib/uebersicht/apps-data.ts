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

// label/sub sind bt()-Keys (in BO_STRINGS gepflegt); Komponenten lösen via bt(app.label, lang) auf.
export const APPS: SetupApp[] = [
  { id: 1, num: '01', label: 'app.1.label',  sub: 'app.1.sub',
    activeAt: 0,  doneAt: 15,  sticker: { todo: 'WAIT', active: 'START', done: 'DONE'   }, href: '/profile/settings'          },
  { id: 2, num: '02', label: 'app.2.label',  sub: 'app.2.sub',
    activeAt: 15, doneAt: 30,  sticker: { todo: 'WAIT', active: 'START', done: 'DONE'   }, href: '/branding'          },
  { id: 3, num: '03', label: 'app.3.label',  sub: 'app.3.sub',
    activeAt: 30, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: '3/5 ON' }, href: '/features'          },
  { id: 4, num: '04', label: 'app.4.label',  sub: 'app.4.sub',
    activeAt: -1, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: 'LINKED' }, href: '/pms'               },
  { id: 5, num: '05', label: 'app.5.label',  sub: 'app.5.sub',
    activeAt: -1, doneAt: 71,  sticker: { todo: 'WAIT', active: 'START', done: 'ARMED'  }, href: '/profile/security'   },
  { id: 6, num: '06', label: 'app.6.label',  sub: 'app.6.sub',
    activeAt: 71, doneAt: 100, sticker: { todo: '0/6',  active: 'START', done: '6/6 ON' }, href: '/admin/nfc-tags'    },
  { id: 7, num: '07', label: 'app.7.label',  sub: 'app.7.sub',
    activeAt: -1, doneAt: 100, sticker: { todo: 'SOLO', active: 'START', done: '3 USR'  }, href: '/team'              },
];
