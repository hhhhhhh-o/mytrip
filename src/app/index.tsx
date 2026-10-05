import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TripFormSheet } from '@/components/TripFormSheet';
import type { Trip } from '@/domain/trip';
import { getTripPhase, localDateString, type TripPhase } from '@/domain/tripStatus';
import { loadTrips, upsertTrip } from '@/storage/tripRepository';

const accent = '#2563EB';
const tabs: { id: TripPhase; label: string }[] = [
  { id: 'active', label: '正在进行' },
  { id: 'upcoming', label: '即将出发' },
  { id: 'past', label: '往期旅程' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(`${value}T12:00:00`));
}

function duration(trip: Trip) {
  const start = new Date(`${trip.startsOn}T12:00:00`);
  const end = new Date(`${trip.endsOn}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function cardStatus(trip: Trip, phase: TripPhase) {
  if (phase === 'active') return `第 ${Math.max(1, Math.round((Date.now() - new Date(`${trip.startsOn}T00:00:00`).getTime()) / 86_400_000) + 1)} 天`;
  if (phase === 'upcoming') return `${Math.max(1, Math.ceil((new Date(`${trip.startsOn}T00:00:00`).getTime() - Date.now()) / 86_400_000))} 天后出发`;
  return '已保存';
}

function TripCard({ phase, trip, onPress }: { phase: TripPhase; trip: Trip; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTopline}>
        <Text numberOfLines={1} style={styles.destination}>{trip.destination}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text numberOfLines={1} style={styles.tripTitle}>{trip.title}</Text>
      <Text style={styles.dates}>{formatDate(trip.startsOn)} — {formatDate(trip.endsOn)} · {duration(trip)}天</Text>
      <View style={styles.cardDivider} />
      <View style={styles.cardMeta}>
        <Text style={styles.status}>{cardStatus(trip, phase)}</Text>
        <Text style={styles.itemCount}>{trip.items.length} 项行程</Text>
      </View>
    </Pressable>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [phase, setPhase] = useState<TripPhase>('upcoming');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    const stored = await loadTrips();
    const currentDate = localDateString();
    setTrips(stored);
    setToday(currentDate);
    if (!initialized.current) {
      const hasActive = stored.some((trip) => getTripPhase(trip, currentDate) === 'active');
      const hasUpcoming = stored.some((trip) => getTripPhase(trip, currentDate) === 'upcoming');
      setPhase(hasActive ? 'active' : hasUpcoming ? 'upcoming' : 'past');
      initialized.current = true;
    }
    setLoading(false);
    return stored;
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useEffect(() => {
    const interval = setInterval(() => setToday(localDateString()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const visibleTrips = useMemo(() => {
    const filtered = trips.filter((trip) => getTripPhase(trip, today) === phase);
    return filtered.sort((a, b) => phase === 'past' ? b.endsOn.localeCompare(a.endsOn) : a.startsOn.localeCompare(b.startsOn));
  }, [phase, today, trips]);

  async function createTrip(trip: Trip) {
    await upsertTrip(trip);
    await refresh();
    setPhase(getTripPhase(trip));
  }

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator color={accent} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>MYTrip</Text><Text style={styles.heading}>我的旅行</Text></View>
          <Pressable accessibilityLabel="创建旅行" onPress={() => setCreating(true)} style={styles.addButton}><Text style={styles.addButtonText}>＋</Text></Pressable>
        </View>

        <View style={styles.segmentedControl}>
          {tabs.map((tab) => (
            <Pressable key={tab.id} onPress={() => setPhase(tab.id)} style={[styles.segment, phase === tab.id && styles.activeSegment]}>
              <Text numberOfLines={1} style={[styles.segmentText, phase === tab.id && styles.activeSegmentText]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{tabs.find((tab) => tab.id === phase)?.label}</Text>
          <Text style={styles.listCount}>{visibleTrips.length} 段旅行</Text>
        </View>

        {visibleTrips.length ? visibleTrips.map((trip) => (
          <TripCard key={trip.id} phase={phase} trip={trip} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} />
        )) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{phase === 'active' ? '当前没有正在进行的旅行' : phase === 'upcoming' ? '还没有即将出发的旅行' : '还没有往期旅程'}</Text>
            <Text style={styles.emptyText}>{phase === 'past' ? '旅行结束后会自动保存到这里。' : '创建旅行后，状态会根据日期自动变化。'}</Text>
            <Pressable onPress={() => setCreating(true)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>创建旅行</Text></Pressable>
          </View>
        )}

        <Text style={styles.footer}>旅行会按照开始与结束日期自动流转。</Text>
      </ScrollView>
      {creating ? <TripFormSheet onClose={() => setCreating(false)} onSave={createTrip} visible /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F7' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F7' },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 24 }, eyebrow: { color: accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 }, heading: { color: '#111318', fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.7 }, addButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EBFB' }, addButtonText: { color: accent, fontSize: 23, fontWeight: '500', marginTop: -2 },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#E8E9EC', borderRadius: 10, padding: 3, marginBottom: 28 }, segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: 8, paddingHorizontal: 3 }, activeSegment: { backgroundColor: '#FFFFFF' }, segmentText: { color: '#777C85', fontSize: 13, fontWeight: '600' }, activeSegmentText: { color: '#17191E' },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 }, listTitle: { color: '#17191E', fontSize: 22, fontWeight: '700' }, listCount: { color: '#92969E', fontSize: 13 },
  card: { minHeight: 164, backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE1E6', padding: 18, marginBottom: 12 }, cardPressed: { opacity: 0.72 }, cardTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, destination: { flex: 1, color: accent, fontSize: 13, fontWeight: '700' }, chevron: { color: '#A0A4AB', fontSize: 25, lineHeight: 25 }, tripTitle: { color: '#15171B', fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 5 }, dates: { color: '#737983', fontSize: 13, marginTop: 7 }, cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E4E6E9', marginVertical: 14 }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between' }, status: { color: '#42474F', fontSize: 13, fontWeight: '600' }, itemCount: { color: '#858A93', fontSize: 13 },
  emptyState: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE1E6', paddingHorizontal: 28, paddingVertical: 50 }, emptyTitle: { color: '#202329', fontSize: 18, fontWeight: '700', textAlign: 'center' }, emptyText: { color: '#7D828B', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, emptyButton: { backgroundColor: accent, borderRadius: 11, paddingHorizontal: 21, paddingVertical: 12, marginTop: 21 }, emptyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }, footer: { color: '#969BA4', fontSize: 12, textAlign: 'center', marginTop: 22 },
});
