import AsyncStorage from '@react-native-async-storage/async-storage';

import { demoTrip } from '@/data/demoTrip';
import type { Trip } from '@/domain/trip';

const STORAGE_KEY = '@mytrip/trips/v1';

export async function loadTrips(): Promise<Trip[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (!stored) {
    await saveTrips([demoTrip]);
    return [demoTrip];
  }

  try {
    const parsed = JSON.parse(stored) as Trip[];
    return Array.isArray(parsed) ? parsed : [demoTrip];
  } catch {
    return [demoTrip];
  }
}

export async function saveTrips(trips: Trip[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export async function loadTrip(id: string) {
  const trips = await loadTrips();
  return trips.find((trip) => trip.id === id);
}

export async function upsertTrip(trip: Trip) {
  const trips = await loadTrips();
  const existingIndex = trips.findIndex((item) => item.id === trip.id);
  const next = [...trips];
  if (existingIndex >= 0) next[existingIndex] = trip;
  else next.unshift(trip);
  await saveTrips(next);
  return next;
}

export async function removeTrip(id: string) {
  const trips = await loadTrips();
  const next = trips.filter((trip) => trip.id !== id);
  await saveTrips(next);
  return next;
}
