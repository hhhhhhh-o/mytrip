import type { Trip } from '@/domain/trip';

export type TripPhase = 'active' | 'upcoming' | 'past';

export function localDateString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getTripPhase(trip: Trip, today = localDateString()): TripPhase {
  if (trip.endsOn < today) return 'past';
  if (trip.startsOn <= today) return 'active';
  return 'upcoming';
}

export function dayDifference(value: string, reference = new Date()) {
  const target = new Date(`${value}T00:00:00`);
  reference.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - reference.getTime()) / 86_400_000);
}

export function phaseDescription(trip: Trip) {
  const phase = getTripPhase(trip);
  if (phase === 'past') return `已结束 ${Math.abs(dayDifference(trip.endsOn))} 天`;
  if (phase === 'active') return `正在进行 · 还剩 ${Math.max(0, dayDifference(trip.endsOn)) + 1} 天`;
  return `${dayDifference(trip.startsOn)} 天后出发`;
}

export function statusForTrip(trip: Pick<Trip, 'startsOn' | 'endsOn'>): Trip['status'] {
  const phase = getTripPhase({ ...trip, id: '', title: '', destination: '', items: [], status: 'draft' });
  return phase === 'past' ? 'completed' : phase === 'active' ? 'active' : 'upcoming';
}
