import type { ItineraryItem } from '@/domain/trip';

export interface ItineraryConflict {
  first: ItineraryItem;
  second: ItineraryItem;
}

export function sortItinerary(items: ItineraryItem[]) {
  return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function findItineraryConflicts(items: ItineraryItem[]) {
  const fixed = sortItinerary(items.filter((item) => item.flexibility === 'fixed' && !item.timeTBD && item.endsAt));
  const conflicts: ItineraryConflict[] = [];

  for (let index = 0; index < fixed.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < fixed.length; otherIndex += 1) {
      const first = fixed[index];
      const second = fixed[otherIndex];
      if (first.startsAt.slice(0, 10) !== second.startsAt.slice(0, 10)) break;
      if (first.startsAt < (second.endsAt ?? '') && second.startsAt < (first.endsAt ?? '')) {
        conflicts.push({ first, second });
      }
    }
  }

  return conflicts;
}
