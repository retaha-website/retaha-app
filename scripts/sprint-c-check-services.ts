// Prüft welche Service-IDs aus mews_integrations.service_id_* gegen
// services/getAll noch valide (Orderable + Active) sind. Falls invalid:
// Vorschlag alternativer Services.

import { getMewsClientFromEnv } from '../src/lib/mews/factory';

const client = getMewsClientFromEnv();

const resp = await client.getServices({ Limitation: { Count: 100 } });
const services = (resp.Services ?? []) as Array<{ Id: string; Name?: string; Type?: string; IsActive?: boolean }>;

const targets = {
  breakfast:  '15ea4f49-ae4a-49be-ad39-b3d3009d184a',  // Breakfast Voucher
  service:    '0bcd98f1-0c20-4a84-94d1-c79f43e6381b',  // Room service 20%
  conference: '5e96e0fd-5eb3-4232-9daf-e812335c68ed',  // Function Room Hire
};

console.log('Aktuelle service_id_* Mappings:');
for (const [k, id] of Object.entries(targets)) {
  const s = services.find(x => x.Id === id);
  if (!s) {
    console.log(`  ${k.padEnd(11)} ${id}  ← NICHT in services/getAll (Pagination?)`);
  } else {
    const flag = s.Type === 'Orderable' && s.IsActive !== false ? '✓' : '✗';
    console.log(`  ${k.padEnd(11)} ${id}  ${flag} Type=${s.Type}  IsActive=${s.IsActive}  Name="${s.Name}"`);
  }
}

const orderable = services.filter(s => s.Type === 'Orderable' && s.IsActive !== false);
console.log('');
console.log(`Orderable+Active total: ${orderable.length} / ${services.length}`);
console.log('');
console.log('Alternativen je Kategorie:');

const findByPattern = (pattern: RegExp) => orderable.filter(s => pattern.test(s.Name ?? ''));
const printList = (label: string, list: typeof services) => {
  console.log(`${label}:`);
  for (const s of list.slice(0, 8)) {
    console.log(`  · ${s.Id}  "${s.Name}"`);
  }
};

printList('Breakfast', findByPattern(/breakfast|frühstück/i));
console.log('');
printList('Service/Room/Spa', findByPattern(/room.*service|laundry|loundry|spa|housekeeping|massage|wellness/i));
console.log('');
printList('Conference/Meeting/Function Room', findByPattern(/conference|meeting|function|room hire|room rental|banquet/i));

console.log('');
console.log('── Alle 17 Active Orderable ──');
for (const s of orderable) {
  console.log(`  · ${s.Id}  "${s.Name}"`);
}
