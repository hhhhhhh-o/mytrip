import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Trip } from '@/domain/trip';
import { statusForTrip } from '@/domain/tripStatus';

const accent = '#2563EB';

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

interface TripFormSheetProps {
  copy?: boolean;
  initialTrip?: Trip;
  visible: boolean;
  onClose: () => void;
  onSave: (trip: Trip) => Promise<void> | void;
}

export function TripFormSheet({ copy = false, initialTrip, visible, onClose, onSave }: TripFormSheetProps) {
  const [title, setTitle] = useState(initialTrip?.title ?? '');
  const [destination, setDestination] = useState(initialTrip?.destination ?? '');
  const [startsOn, setStartsOn] = useState(initialTrip?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(initialTrip?.endsOn ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const validDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!title.trim() || !destination.trim()) return setError('请填写旅行名称和目的地。');
    if (!validDate.test(startsOn) || !validDate.test(endsOn)) return setError('请完整输入 8 位日期数字。');
    if (endsOn < startsOn) return setError('结束日期不能早于开始日期。');

    const next: Trip = {
      id: copy || !initialTrip ? `trip-${Date.now()}` : initialTrip.id,
      title: title.trim(),
      destination: destination.trim(),
      startsOn,
      endsOn,
      status: statusForTrip({ startsOn, endsOn }),
      items: initialTrip?.items ?? [],
    };

    setSaving(true);
    setError('');
    try {
      await onSave(next);
      onClose();
    } catch {
      setError('保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable>
            <Text style={styles.title}>{copy ? '复制旅行' : initialTrip ? '编辑旅行' : '创建旅行'}</Text>
            <Pressable disabled={saving} onPress={submit}><Text style={[styles.save, saving && styles.disabled]}>{saving ? '保存中…' : '保存'}</Text></Pressable>
          </View>
          <Text style={styles.label}>旅行名称</Text>
          <TextInput autoFocus onChangeText={(value) => { setTitle(value); setError(''); }} placeholder="例如：东京周末" placeholderTextColor="#A0A4AB" style={styles.input} value={title} />
          <Text style={styles.label}>目的地</Text>
          <TextInput onChangeText={(value) => { setDestination(value); setError(''); }} placeholder="例如：日本 · 东京" placeholderTextColor="#A0A4AB" style={styles.input} value={destination} />
          <View style={styles.dateRow}>
            <View style={styles.dateField}><Text style={styles.label}>开始日期</Text><TextInput inputMode="numeric" maxLength={10} onChangeText={(value) => { setStartsOn(formatDateInput(value)); setError(''); }} placeholder="YYYY-MM-DD" placeholderTextColor="#A0A4AB" style={styles.input} value={startsOn} /></View>
            <View style={styles.dateField}><Text style={styles.label}>结束日期</Text><TextInput inputMode="numeric" maxLength={10} onChangeText={(value) => { setEndsOn(formatDateInput(value)); setError(''); }} placeholder="YYYY-MM-DD" placeholderTextColor="#A0A4AB" style={styles.input} value={endsOn} /></View>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>输入 8 位数字，横线会自动补充。状态会根据开始与结束日期自动更新。</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#F7F7F9', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingBottom: 32 },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C8CBD1', alignSelf: 'center', marginTop: 9, marginBottom: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginBottom: 14 },
  cancel: { color: '#5F6570', fontSize: 15 }, title: { color: '#17191E', fontSize: 17, fontWeight: '700' }, save: { color: accent, fontSize: 15, fontWeight: '700' }, disabled: { opacity: 0.5 },
  label: { color: '#626872', fontSize: 12, fontWeight: '600', marginBottom: 7, marginTop: 12 },
  input: { minHeight: 48, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DADDE2', color: '#17191E', fontSize: 15, paddingHorizontal: 13 },
  dateRow: { flexDirection: 'row', gap: 10 }, dateField: { flex: 1 }, error: { color: '#C43A32', fontSize: 13, lineHeight: 18, marginTop: 14 }, hint: { color: '#898E97', fontSize: 12, lineHeight: 18, marginTop: 12 },
});
