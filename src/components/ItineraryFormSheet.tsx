import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ItineraryItem, TripItemFlexibility, TripItemKind } from '@/domain/trip';

const accent = '#2563EB';
const kinds: { id: TripItemKind; label: string }[] = [
  { id: 'transport', label: '交通' },
  { id: 'stay', label: '住宿' },
  { id: 'activity', label: '活动' },
  { id: 'place', label: '景点/餐饮' },
];

function formatDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function formatTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function datePart(value?: string) { return value?.slice(0, 10) ?? ''; }
function timePart(value?: string) { return value?.slice(11, 16) ?? ''; }

interface Props {
  initialItem?: ItineraryItem;
  tripStartsOn: string;
  tripEndsOn: string;
  visible: boolean;
  onClose: () => void;
  onSave: (item: ItineraryItem) => Promise<void> | void;
  onDelete?: (item: ItineraryItem) => Promise<void> | void;
}

export function ItineraryFormSheet({ initialItem, tripStartsOn, tripEndsOn, visible, onClose, onSave, onDelete }: Props) {
  const [kind, setKind] = useState<TripItemKind>(initialItem?.kind ?? 'activity');
  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [date, setDate] = useState(datePart(initialItem?.startsAt));
  const [startTime, setStartTime] = useState(initialItem?.timeTBD ? '' : timePart(initialItem?.startsAt));
  const [endTime, setEndTime] = useState(timePart(initialItem?.endsAt));
  const [location, setLocation] = useState(initialItem?.location ?? '');
  const [notes, setNotes] = useState(initialItem?.notes ?? initialItem?.subtitle ?? '');
  const [flexibility, setFlexibility] = useState<TripItemFlexibility>(initialItem?.flexibility ?? 'fixed');
  const [locked, setLocked] = useState(initialItem?.state === 'locked');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit() {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!title.trim()) return setError('请填写行程名称。');
    if (!datePattern.test(date)) return setError('请完整输入 8 位日期数字。');
    if (date < tripStartsOn || date > tripEndsOn) return setError('行程日期需要位于本次旅行期间。');
    if (startTime && !timePattern.test(startTime)) return setError('开始时间无效，请输入 0000 至 2359。');
    if (endTime && !timePattern.test(endTime)) return setError('结束时间无效，请输入 0000 至 2359。');
    if (endTime && !startTime) return setError('填写结束时间前，需要先填写开始时间。');
    if (startTime && endTime && endTime <= startTime) return setError('结束时间需要晚于开始时间。');

    const timeTBD = !startTime;
    const next: ItineraryItem = {
      id: initialItem?.id ?? `item-${Date.now()}`,
      kind,
      title: title.trim(),
      notes: notes.trim() || undefined,
      subtitle: notes.trim() || undefined,
      location: location.trim() || undefined,
      flexibility,
      state: locked ? 'locked' : flexibility === 'flexible' ? 'candidate' : 'confirmed',
      startsAt: `${date}T${startTime || '23:59'}:00`,
      endsAt: endTime ? `${date}T${endTime}:00` : undefined,
      timeTBD,
      source: initialItem?.source ?? { id: `source-${Date.now()}`, type: 'manual', label: '手动添加' },
    };

    setSaving(true);
    try { await onSave(next); onClose(); }
    catch { setError('保存失败，请稍后重试。'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!initialItem || !onDelete) return;
    setSaving(true);
    try { await onDelete(initialItem); onClose(); }
    catch { setError('删除失败，请稍后重试。'); setSaving(false); }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable>
            <Text style={styles.heading}>{initialItem ? '编辑行程' : '添加行程'}</Text>
            <Pressable disabled={saving} onPress={submit}><Text style={[styles.save, saving && styles.disabled]}>{saving ? '保存中…' : '保存'}</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>类型</Text>
            <View style={styles.options}>{kinds.map((option) => <Pressable key={option.id} onPress={() => setKind(option.id)} style={[styles.option, kind === option.id && styles.activeOption]}><Text style={[styles.optionText, kind === option.id && styles.activeOptionText]}>{option.label}</Text></Pressable>)}</View>
            <Text style={styles.label}>名称</Text>
            <TextInput autoFocus onChangeText={(value) => { setTitle(value); setError(''); }} placeholder="例如：演唱会" placeholderTextColor="#A0A4AB" style={styles.input} value={title} />
            <Text style={styles.label}>日期</Text>
            <TextInput inputMode="numeric" maxLength={10} onChangeText={(value) => { setDate(formatDate(value)); setError(''); }} placeholder="YYYY-MM-DD" placeholderTextColor="#A0A4AB" style={styles.input} value={date} />
            <View style={styles.timeRow}>
              <View style={styles.timeField}><Text style={styles.label}>开始时间</Text><TextInput inputMode="numeric" maxLength={5} onChangeText={(value) => { setStartTime(formatTime(value)); setError(''); }} placeholder="可不填" placeholderTextColor="#A0A4AB" style={styles.input} value={startTime} /></View>
              <View style={styles.timeField}><Text style={styles.label}>结束时间</Text><TextInput inputMode="numeric" maxLength={5} onChangeText={(value) => { setEndTime(formatTime(value)); setError(''); }} placeholder="可不填" placeholderTextColor="#A0A4AB" style={styles.input} value={endTime} /></View>
            </View>
            <Text style={styles.timeHint}>输入 1930 会自动显示为 19:30；不填时间则标记为“待安排”。</Text>
            <Text style={styles.label}>地点</Text>
            <TextInput onChangeText={setLocation} placeholder="例如：首尔奥林匹克公园" placeholderTextColor="#A0A4AB" style={styles.input} value={location} />
            <Text style={styles.label}>备注</Text>
            <TextInput multiline onChangeText={setNotes} placeholder="入场时间、座位或其他信息" placeholderTextColor="#A0A4AB" style={[styles.input, styles.notes]} value={notes} />
            <Text style={styles.label}>安排方式</Text>
            <View style={styles.toggleRow}><Pressable onPress={() => setFlexibility('fixed')} style={[styles.toggle, flexibility === 'fixed' && styles.activeToggle]}><Text style={[styles.toggleText, flexibility === 'fixed' && styles.activeToggleText]}>固定安排</Text></Pressable><Pressable onPress={() => { setFlexibility('flexible'); setLocked(false); }} style={[styles.toggle, flexibility === 'flexible' && styles.activeToggle]}><Text style={[styles.toggleText, flexibility === 'flexible' && styles.activeToggleText]}>灵活安排</Text></Pressable></View>
            <Pressable onPress={() => flexibility === 'fixed' && setLocked((value) => !value)} style={[styles.lockRow, flexibility !== 'fixed' && styles.disabledRow]}><View><Text style={styles.lockTitle}>锁定行程</Text><Text style={styles.lockHint}>锁定后，AI 不得调整时间和地点。</Text></View><View style={[styles.switch, locked && styles.switchOn]}><View style={[styles.switchThumb, locked && styles.switchThumbOn]} /></View></Pressable>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {initialItem && onDelete ? (!confirmDelete ? <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteLink}><Text style={styles.deleteText}>删除此行程</Text></Pressable> : <View style={styles.deleteConfirm}><Text style={styles.deleteQuestion}>确定删除此行程？</Text><View style={styles.deleteActions}><Pressable onPress={() => setConfirmDelete(false)} style={styles.keepButton}><Text style={styles.keepText}>保留</Text></Pressable><Pressable onPress={remove} style={styles.deleteButton}><Text style={styles.deleteButtonText}>确认删除</Text></Pressable></View></View>) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end' }, sheet: { width: '100%', maxWidth: 520, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#F7F7F9', borderTopLeftRadius: 18, borderTopRightRadius: 18 }, handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C8CBD1', alignSelf: 'center', marginTop: 9 }, header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }, cancel: { color: '#5F6570', fontSize: 15 }, heading: { color: '#17191E', fontSize: 17, fontWeight: '700' }, save: { color: accent, fontSize: 15, fontWeight: '700' }, disabled: { opacity: 0.5 }, form: { paddingHorizontal: 20, paddingBottom: 36 }, label: { color: '#626872', fontSize: 12, fontWeight: '600', marginBottom: 7, marginTop: 13 }, input: { minHeight: 48, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DADDE2', color: '#17191E', fontSize: 15, paddingHorizontal: 13 }, notes: { minHeight: 74, paddingTop: 12, textAlignVertical: 'top' }, options: { flexDirection: 'row', gap: 7 }, option: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E9EC', borderRadius: 9, paddingHorizontal: 4 }, activeOption: { backgroundColor: '#DDE8FF' }, optionText: { color: '#6D727B', fontSize: 12, fontWeight: '600' }, activeOptionText: { color: accent }, timeRow: { flexDirection: 'row', gap: 10 }, timeField: { flex: 1 }, timeHint: { color: '#92969E', fontSize: 11, lineHeight: 16, marginTop: 7 }, toggleRow: { flexDirection: 'row', backgroundColor: '#E8E9EC', padding: 3, borderRadius: 10 }, toggle: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, activeToggle: { backgroundColor: '#FFFFFF' }, toggleText: { color: '#777C85', fontSize: 14, fontWeight: '600' }, activeToggleText: { color: '#17191E' }, lockRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 13, marginTop: 12 }, disabledRow: { opacity: 0.45 }, lockTitle: { color: '#262A30', fontSize: 14, fontWeight: '700' }, lockHint: { color: '#8A8F98', fontSize: 11, marginTop: 3 }, switch: { width: 42, height: 25, borderRadius: 13, backgroundColor: '#C7CBD1', padding: 2 }, switchOn: { backgroundColor: accent }, switchThumb: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFFFFF' }, switchThumbOn: { marginLeft: 17 }, error: { color: '#C43A32', fontSize: 13, lineHeight: 18, marginTop: 14 }, deleteLink: { alignItems: 'center', paddingVertical: 16, marginTop: 16 }, deleteText: { color: '#C83B35', fontSize: 14, fontWeight: '600' }, deleteConfirm: { backgroundColor: '#FCEAE8', borderRadius: 10, padding: 13, marginTop: 16 }, deleteQuestion: { color: '#8F2F2A', fontSize: 14, fontWeight: '700' }, deleteActions: { flexDirection: 'row', gap: 8, marginTop: 11 }, keepButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 8 }, keepText: { color: '#555B65', fontWeight: '600' }, deleteButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C83B35', borderRadius: 8 }, deleteButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
