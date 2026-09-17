import type { Persona } from './types';

export const PERSONAS: Persona[] = [
  { id: 'fm-cluster', name: 'Ramesh Kumar', role: 'FM Cluster Head', email: 'ramesh.k@meesho.com' },
  { id: 'sc-biz', name: 'Priya Menon', role: 'SC Business Team', email: 'priya.m@meesho.com' },
  { id: 'ops-fm', name: 'Tajinder Kaur', role: 'Ops Head (FM)', email: 'tajinder@meesho.com' },
  { id: 'ops-sc', name: 'Soumya Varma', role: 'Ops Head (SC)', email: 'soumya@meesho.com' },
  { id: 'bizfin', name: 'Vidhi Sharma', role: 'BizFin', email: 'vidhi@meesho.com' },
  { id: 'controllership', name: 'Ankita Agarwal', role: 'Controllership', email: 'ankita.a@meesho.com' },
  { id: 'legal', name: 'Mekha Vijayakumar', role: 'Legal', email: 'mekha@meesho.com' },
  { id: 'admin', name: 'Ops Excellence', role: 'Admin', email: 'admin@meesho.com' },
  { id: 'zonal', name: 'Ajay Singh', role: 'Zonal Head (read-only)', email: 'ajay.s@meesho.com' },
];

export function personaById(id: string): Persona {
  return PERSONAS.find(p => p.id === id) ?? PERSONAS[0];
}
