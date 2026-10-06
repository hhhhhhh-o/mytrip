import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TripFormSheet } from '@/components/TripFormSheet';
import { ItineraryFormSheet } from '@/components/ItineraryFormSheet';
import { ImportTravelSheet } from '@/components/ImportTravelSheet';
import { findItineraryConflicts, sortItinerary } from '@/domain/itinerary';
import type { ItineraryItem, Trip } from '@/domain/trip';
import { getTripPhase, phaseDescription } from '@/domain/tripStatus';
import { loadTrip, removeTrip, upsertTrip } from '@/storage/tripRepository';

const accent = '#2563EB';
const kindLabel: Record<ItineraryItem['kind'], string> = { transport: '交通', stay: '住宿', activity: '活动', place: '地点' };
const stateLabel: Record<ItineraryItem['state'], string> = { candidate: '候选', confirmed: '已确认', locked: '已锁定', completed: '已完成' };

function dayLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
    .format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function TimelineItem({ item, onPress }: { item: ItineraryItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.timelineRow, pressed && styles.itemPressed]}>
      <View style={styles.timeColumn}><Text style={styles.itemTime}>{item.timeTBD ? '待安排' : item.startsAt.slice(11, 16)}</Text><View style={[styles.dot, item.flexibility === 'fixed' && styles.fixedDot]} /></View>
      <View style={styles.itemContent}>
        <View style={styles.itemTopline}><Text style={styles.kind}>{kindLabel[item.kind]}</Text><Text style={[styles.itemState, item.state === 'locked' && styles.lockedState]}>{item.state === 'locked' ? '锁定 · ' : ''}{stateLabel[item.state]}</Text></View>
        <Text style={styles.itemTitle}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
        {item.location ? <Text style={styles.location}>⌖ {item.location}</Text> : null}
        {item.source ? <Text style={styles.source}>来源：{item.source.provider ?? item.source.label}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip>();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [choosingPastEntryMethod, setChoosingPastEntryMethod] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem>();
  const [importing, setImporting] = useState(false);
  const [importDraft, setImportDraft] = useState<ItineraryItem>();
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    setLoading(true);
    loadTrip(id).then(setTrip).finally(() => setLoading(false));
  }, [id]));

  const groupedItems = useMemo(() => sortItinerary(trip?.items ?? []).reduce<Record<string, ItineraryItem[]>>((result, item) => {
    const date = item.startsAt.slice(0, 10);
    result[date] = [...(result[date] ?? []), item];
    return result;
  }, {}), [trip]);
  const conflicts = useMemo(() => findItineraryConflicts(trip?.items ?? []), [trip]);

  async function saveEdited(next: Trip) {
    await upsertTrip(next);
    setTrip(next);
  }

  async function saveCopy(next: Trip) {
    await upsertTrip(next);
    setCopying(false);
    router.replace({ pathname: '/trip/[id]', params: { id: next.id } });
  }

  async function deleteCurrent() {
    if (!trip) return;
    await removeTrip(trip.id);
    setConfirmingDelete(false);
    router.replace('/');
  }

  async function saveItem(item: ItineraryItem) {
    if (!trip) return;
    const nextItems = trip.items.some((current) => current.id === item.id)
      ? trip.items.map((current) => current.id === item.id ? item : current)
      : [...trip.items, item];
    const next = { ...trip, items: sortItinerary(nextItems) };
    await upsertTrip(next);
    setTrip(next);
  }

  async function deleteItem(item: ItineraryItem) {
    if (!trip) return;
    const next = { ...trip, items: trip.items.filter((current) => current.id !== item.id) };
    await upsertTrip(next);
    setTrip(next);
  }

  function reviewImport(item: ItineraryItem, fields: string[]) {
    setImporting(false);
    setUncertainFields(fields);
    setImportDraft(item);
  }

  function choosePastEntry(method: 'manual' | 'image') {
    setChoosingPastEntryMethod(false);
    if (method === 'manual') setAddingItem(true);
    else setImporting(true);
  }

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator color={accent} /></SafeAreaView>;
  if (!trip) return <SafeAreaView style={styles.loading}><Text style={styles.missing}>没有找到这段旅行</Text><Pressable onPress={() => router.replace('/')}><Text style={styles.backLink}>返回旅行列表</Text></Pressable></SafeAreaView>;

  const phase = getTripPhase(trip);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.navigation}>
          <Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.navButton}><Text style={styles.backIcon}>‹</Text></Pressable>
          <Text style={styles.navTitle}>旅行详情</Text>
          <Pressable accessibilityLabel="更多操作" onPress={() => setMenuOpen(true)} style={styles.navButton}><Text style={styles.moreIcon}>···</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={[styles.phaseBadge, phase === 'active' && styles.activeBadge]}><Text style={[styles.phaseText, phase === 'active' && styles.activePhaseText]}>{phase === 'active' ? '正在进行' : phase === 'upcoming' ? '即将出发' : '往期旅程'}</Text></View>
          <Text style={styles.destination}>{trip.destination}</Text>
          <Text style={styles.tripTitle}>{trip.title}</Text>
          <Text style={styles.dates}>{trip.startsOn.replaceAll('-', '.')} — {trip.endsOn.replaceAll('-', '.')}</Text>
          <View style={styles.divider} />
          <View style={styles.summaryRow}><View><Text style={styles.summaryValue}>{phaseDescription(trip)}</Text><Text style={styles.summaryLabel}>当前状态</Text></View><View style={styles.summaryRight}><Text style={styles.summaryNumber}>{trip.items.length}</Text><Text style={styles.summaryLabel}>全部行程</Text></View></View>
        </View>

        {phase !== 'past' ? (
          <><Pressable onPress={() => setImporting(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>＋ 导入旅行信息</Text></Pressable><Pressable onPress={() => setAddingItem(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>手动添加行程</Text></Pressable></>
        ) : <><Pressable onPress={() => setChoosingPastEntryMethod(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>＋ 补记行程</Text></Pressable><Pressable onPress={() => setCopying(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>复制为新旅行</Text></Pressable></>}

        <Text style={styles.sectionTitle}>{phase === 'past' ? '旅行记录' : '行程'}</Text>
        {conflicts.length ? <View style={styles.conflictBanner}><Text style={styles.conflictTitle}>发现 {conflicts.length} 处时间冲突</Text><Text style={styles.conflictText}>{conflicts[0].first.title} 与 {conflicts[0].second.title} 的时间有重叠。锁定内容不会被自动修改。</Text></View> : null}
        {trip.items.length ? (
          <View style={styles.timelineCard}>{Object.entries(groupedItems).map(([date, items]) => (
            <View key={date} style={styles.dayGroup}><Text style={styles.dayTitle}>{dayLabel(date)}</Text>{items.map((item) => <TimelineItem item={item} key={item.id} onPress={() => setEditingItem(item)} />)}</View>
          ))}</View>
        ) : <View style={styles.emptyItems}><Text style={styles.emptyTitle}>{phase === 'past' ? '没有具体行程记录' : '还没有安排'}</Text><Text style={styles.emptyText}>{phase === 'past' ? '可以保留这份简要记录，或补记当时去过的地点与活动。' : '可以导入订单截图，或者手动添加第一项行程。'}</Text></View>}
      </ScrollView>

      <Modal animationType="fade" transparent visible={menuOpen} onRequestClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => setMenuOpen(false)} style={styles.menuBackdrop}>
          <View style={styles.menuCard}>
            {phase === 'past' ? <><Pressable onPress={() => { setMenuOpen(false); setChoosingPastEntryMethod(true); }} style={styles.menuAction}><Text style={styles.menuText}>补记行程</Text></Pressable><View style={styles.menuDivider} /></> : null}
            <Pressable onPress={() => { setMenuOpen(false); setEditing(true); }} style={styles.menuAction}><Text style={styles.menuText}>编辑旅行</Text></Pressable>
            <View style={styles.menuDivider} />
            <Pressable onPress={() => { setMenuOpen(false); setCopying(true); }} style={styles.menuAction}><Text style={styles.menuText}>复制为新旅行</Text></Pressable>
            <View style={styles.menuDivider} />
            <Pressable onPress={() => { setMenuOpen(false); setConfirmingDelete(true); }} style={styles.menuAction}><Text style={styles.deleteText}>删除旅行</Text></Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={choosingPastEntryMethod} onRequestClose={() => setChoosingPastEntryMethod(false)}>
        <Pressable onPress={() => setChoosingPastEntryMethod(false)} style={styles.entryBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.entryCard}>
            <Text style={styles.entryTitle}>补记行程</Text>
            <Text style={styles.entryDescription}>选择一种方式补充这段旅行的记录。</Text>
            <Pressable onPress={() => choosePastEntry('manual')} style={({ pressed }) => [styles.entryOption, pressed && styles.itemPressed]}>
              <View style={styles.entryIcon}><Text style={styles.entryIconText}>＋</Text></View>
              <View style={styles.entryOptionCopy}><Text style={styles.entryOptionTitle}>手动添加</Text><Text style={styles.entryOptionText}>自行填写时间、地点和行程内容</Text></View>
              <Text style={styles.entryChevron}>›</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable onPress={() => choosePastEntry('image')} style={({ pressed }) => [styles.entryOption, pressed && styles.itemPressed]}>
              <View style={styles.entryIcon}><Text style={styles.entryImageIcon}>▧</Text></View>
              <View style={styles.entryOptionCopy}><Text style={styles.entryOptionTitle}>从图片识别</Text><Text style={styles.entryOptionText}>选择订单、票根或攻略截图并核对结果</Text></View>
              <Text style={styles.entryChevron}>›</Text>
            </Pressable>
            <Pressable onPress={() => setChoosingPastEntryMethod(false)} style={styles.entryCancel}><Text style={styles.entryCancelText}>取消</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={confirmingDelete} onRequestClose={() => setConfirmingDelete(false)}>
        <View style={styles.confirmBackdrop}><View style={styles.confirmCard}><Text style={styles.confirmTitle}>删除这段旅行？</Text><Text style={styles.confirmText}>旅行信息和行程记录将从当前设备移除。</Text><Pressable onPress={deleteCurrent} style={styles.deleteButton}><Text style={styles.deleteButtonText}>删除</Text></Pressable><Pressable onPress={() => setConfirmingDelete(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>取消</Text></Pressable></View></View>
      </Modal>

      {editing ? <TripFormSheet initialTrip={trip} onClose={() => setEditing(false)} onSave={saveEdited} visible /> : null}
      {copying ? <TripFormSheet copy initialTrip={trip} onClose={() => setCopying(false)} onSave={saveCopy} visible /> : null}
      {addingItem ? <ItineraryFormSheet onClose={() => setAddingItem(false)} onSave={saveItem} tripEndsOn={trip.endsOn} tripStartsOn={trip.startsOn} visible /> : null}
      {editingItem ? <ItineraryFormSheet initialItem={editingItem} onClose={() => setEditingItem(undefined)} onDelete={deleteItem} onSave={saveItem} tripEndsOn={trip.endsOn} tripStartsOn={trip.startsOn} visible /> : null}
      {importing ? <ImportTravelSheet destination={trip.destination} onClose={() => setImporting(false)} onDraft={reviewImport} tripStartsOn={trip.startsOn} visible /> : null}
      {importDraft ? <ItineraryFormSheet heading="核对识别结果" initialItem={importDraft} notice={`以下字段暂未自动识别：${uncertainFields.join('、')}。请根据截图核对后再保存。`} onClose={() => setImportDraft(undefined)} onSave={saveItem} tripEndsOn={trip.endsOn} tripStartsOn={trip.startsOn} visible /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F7' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F7' }, missing: { color: '#202329', fontSize: 18, fontWeight: '700' }, backLink: { color: accent, marginTop: 12 }, page: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  navigation: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, backIcon: { color: accent, fontSize: 40, lineHeight: 40, fontWeight: '300' }, moreIcon: { color: accent, fontSize: 23, fontWeight: '700', marginTop: -8 }, navTitle: { color: '#202329', fontSize: 16, fontWeight: '700' },
  hero: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE1E6' }, phaseBadge: { alignSelf: 'flex-start', backgroundColor: '#EEF0F3', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 14 }, activeBadge: { backgroundColor: '#E1F4E8' }, phaseText: { color: '#696F78', fontSize: 12, fontWeight: '700' }, activePhaseText: { color: '#167846' }, destination: { color: accent, fontSize: 14, fontWeight: '700' }, tripTitle: { color: '#111318', fontSize: 29, lineHeight: 36, fontWeight: '700', marginTop: 7 }, dates: { color: '#747A83', fontSize: 14, marginTop: 8 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E4E8', marginVertical: 19 }, summaryRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, summaryValue: { color: '#202329', fontSize: 18, fontWeight: '700' }, summaryRight: { alignItems: 'flex-end' }, summaryNumber: { color: '#202329', fontSize: 22, fontWeight: '700' }, summaryLabel: { color: '#8C9199', fontSize: 12, marginTop: 4 },
  primaryButton: { minHeight: 52, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }, secondaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9DCE1', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryButtonText: { color: '#30343B', fontSize: 15, fontWeight: '600' }, sectionTitle: { color: '#17191E', fontSize: 23, fontWeight: '700', marginTop: 32, marginBottom: 12 },
  conflictBanner: { backgroundColor: '#FFF3DF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8C789' }, conflictTitle: { color: '#815512', fontSize: 14, fontWeight: '700' }, conflictText: { color: '#8B6A37', fontSize: 12, lineHeight: 18, marginTop: 4 }, timelineCard: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE1E6' }, dayGroup: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECEEF1' }, dayTitle: { color: '#555B65', fontSize: 13, fontWeight: '700', marginBottom: 16 }, timelineRow: { flexDirection: 'row', marginBottom: 22, borderRadius: 9, paddingVertical: 3 }, itemPressed: { opacity: 0.6 }, timeColumn: { width: 64 }, itemTime: { color: '#5F6570', fontSize: 13 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A8ADB6', marginTop: 12, marginLeft: 7 }, fixedDot: { backgroundColor: accent }, itemContent: { flex: 1 }, itemTopline: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, kind: { color: '#717680', fontSize: 12, fontWeight: '600' }, itemState: { color: '#8A8F98', fontSize: 12, fontWeight: '600' }, lockedState: { color: accent }, itemTitle: { color: '#17191E', fontSize: 17, lineHeight: 22, fontWeight: '700' }, itemSubtitle: { color: '#6F747D', fontSize: 14, lineHeight: 20, marginTop: 4 }, location: { color: '#505660', fontSize: 13, marginTop: 9 }, source: { color: '#9A9FA7', fontSize: 12, marginTop: 7 }, emptyItems: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE1E6' }, emptyTitle: { color: '#24272D', fontSize: 17, fontWeight: '700' }, emptyText: { color: '#7C818A', fontSize: 14, lineHeight: 20, marginTop: 6 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center', padding: 24 }, menuCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }, menuAction: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 18 }, menuText: { color: '#202329', fontSize: 16 }, deleteText: { color: '#C83B35', fontSize: 16 }, menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E3E5E8' },
  entryBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.24)', justifyContent: 'flex-end', padding: 12 }, entryCard: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 10 }, entryTitle: { color: '#17191E', fontSize: 19, fontWeight: '700', textAlign: 'center' }, entryDescription: { color: '#7B8089', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5, marginBottom: 12 }, entryOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, entryIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' }, entryIconText: { color: accent, fontSize: 25, lineHeight: 28, fontWeight: '400' }, entryImageIcon: { color: accent, fontSize: 21, lineHeight: 24, fontWeight: '600' }, entryOptionCopy: { flex: 1, marginLeft: 12 }, entryOptionTitle: { color: '#202329', fontSize: 16, fontWeight: '600' }, entryOptionText: { color: '#858A93', fontSize: 12, lineHeight: 17, marginTop: 3 }, entryChevron: { color: '#A5A9B0', fontSize: 28, fontWeight: '300', marginLeft: 8 }, entryCancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3E5E8', marginTop: 4 }, entryCancelText: { color: accent, fontSize: 15, fontWeight: '600' },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', padding: 28 }, confirmCard: { width: '100%', maxWidth: 350, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22 }, confirmTitle: { color: '#181A1F', fontSize: 19, fontWeight: '700' }, confirmText: { color: '#727780', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 20 }, deleteButton: { minHeight: 46, backgroundColor: '#C83B35', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, deleteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, cancelButtonText: { color: '#555B65', fontSize: 15, fontWeight: '600' },
});
