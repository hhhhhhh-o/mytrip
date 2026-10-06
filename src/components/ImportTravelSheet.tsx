import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ItineraryItem, TripItemKind } from '@/domain/trip';

const accent = '#2563EB';
const kinds: { id: TripItemKind; label: string; hint: string }[] = [
  { id: 'transport', label: '交通', hint: '机票、火车票或汽车票' },
  { id: 'stay', label: '住宿', hint: '酒店、民宿或公寓订单' },
  { id: 'activity', label: '活动', hint: '演出、展览或活动门票' },
  { id: 'place', label: '攻略', hint: '景点、餐厅或攻略内容' },
];
const providers = ['携程', '去哪儿', 'Booking', 'Airbnb'];

interface Props {
  destination: string;
  tripStartsOn: string;
  visible: boolean;
  onClose: () => void;
  onDraft: (item: ItineraryItem, uncertainFields: string[]) => void;
}

function createDraft(kind: TripItemKind, provider: string, fileName: string, date: string, destination: string): ItineraryItem {
  const now = Date.now();
  const common = {
    id: `item-import-${now}`,
    kind,
    flexibility: kind === 'place' ? 'flexible' as const : 'fixed' as const,
    state: kind === 'place' ? 'candidate' as const : 'confirmed' as const,
    source: { id: `source-${now}`, type: 'screenshot' as const, provider: provider.trim() || undefined, label: fileName || '旅行截图' },
  };

  if (kind === 'transport') return { ...common, title: '交通班次（请核对）', startsAt: `${date}T09:00:00`, location: destination };
  if (kind === 'stay') return { ...common, title: '酒店入住（请核对）', startsAt: `${date}T15:00:00`, location: destination };
  if (kind === 'activity') return { ...common, title: '活动安排（请核对）', startsAt: `${date}T19:30:00`, location: destination };
  return { ...common, title: '攻略地点（请核对）', startsAt: `${date}T23:59:00`, timeTBD: true, location: destination };
}

export function ImportTravelSheet({ destination, tripStartsOn, visible, onClose, onDraft }: Props) {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [kind, setKind] = useState<TripItemKind>('transport');
  const [provider, setProvider] = useState('携程');
  const [error, setError] = useState('');

  async function chooseScreenshot() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.85 });
      if (!result.canceled) setAsset(result.assets[0]);
    } catch {
      setError('无法打开相册，请检查浏览器的照片权限。');
    }
  }

  function continueToReview() {
    if (!asset) return setError('请先选择一张订单或攻略截图。');
    const draft = createDraft(kind, provider, asset.fileName ?? '旅行截图', tripStartsOn, destination);
    onDraft(draft, kind === 'place' ? ['名称', '日期', '地点'] : ['名称', '日期', '时间', '地点']);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable>
            <Text style={styles.heading}>导入旅行信息</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.notice}><Text style={styles.noticeTitle}>当前为识别流程演示</Text><Text style={styles.noticeText}>截图仅在当前页面预览，不会上传。下一步接入 AI 后将自动读取内容。</Text></View>

            <Text style={styles.label}>截图</Text>
            <Pressable onPress={chooseScreenshot} style={[styles.picker, asset && styles.pickerSelected]}>
              {asset ? <><Image resizeMode="cover" source={{ uri: asset.uri }} style={styles.preview} /><View style={styles.fileInfo}><Text numberOfLines={1} style={styles.fileName}>{asset.fileName ?? '已选择截图'}</Text><Text style={styles.replace}>点击更换</Text></View></> : <><Text style={styles.pickerIcon}>▧</Text><Text style={styles.pickerTitle}>从相册选择截图</Text><Text style={styles.pickerHint}>支持机票、酒店、门票和攻略截图</Text></>}
            </Pressable>

            <Text style={styles.label}>信息类型</Text>
            <View style={styles.kindGrid}>{kinds.map((option) => <Pressable key={option.id} onPress={() => setKind(option.id)} style={[styles.kindOption, kind === option.id && styles.kindActive]}><Text style={[styles.kindLabel, kind === option.id && styles.kindLabelActive]}>{option.label}</Text><Text style={styles.kindHint}>{option.hint}</Text></Pressable>)}</View>

            <Text style={styles.label}>来源平台</Text>
            <View style={styles.providerRow}>{providers.map((option) => <Pressable key={option} onPress={() => setProvider(option)} style={[styles.providerChip, provider === option && styles.providerActive]}><Text style={[styles.providerText, provider === option && styles.providerTextActive]}>{option}</Text></Pressable>)}</View>
            <TextInput onChangeText={setProvider} placeholder="也可以输入其他来源" placeholderTextColor="#A0A4AB" style={styles.input} value={provider} />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable onPress={continueToReview} style={[styles.continueButton, !asset && styles.continueDisabled]}><Text style={styles.continueText}>生成可编辑结果</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', alignSelf: 'center', backgroundColor: '#F7F7F9', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C8CBD1', alignSelf: 'center', marginTop: 9 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  cancel: { color: '#5F6570', fontSize: 15 }, heading: { color: '#17191E', fontSize: 17, fontWeight: '700' }, headerSpacer: { width: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 36 }, notice: { backgroundColor: '#EEF3FF', borderRadius: 11, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C9D8FA' }, noticeTitle: { color: '#244E9D', fontSize: 13, fontWeight: '700' }, noticeText: { color: '#5670A3', fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: '#626872', fontSize: 12, fontWeight: '600', marginBottom: 7, marginTop: 16 },
  picker: { minHeight: 150, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFC4CC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 14 }, pickerSelected: { minHeight: 104, flexDirection: 'row', justifyContent: 'flex-start', borderStyle: 'solid' }, pickerIcon: { color: accent, fontSize: 28 }, pickerTitle: { color: '#252930', fontSize: 15, fontWeight: '700', marginTop: 8 }, pickerHint: { color: '#8A8F98', fontSize: 12, marginTop: 5 }, preview: { width: 72, height: 72, borderRadius: 9, backgroundColor: '#ECEEF1' }, fileInfo: { flex: 1, marginLeft: 13 }, fileName: { color: '#282C32', fontSize: 14, fontWeight: '600' }, replace: { color: accent, fontSize: 12, marginTop: 7 },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, kindOption: { width: '48%', minHeight: 65, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DADDE2', padding: 11 }, kindActive: { borderColor: accent, backgroundColor: '#F1F5FF' }, kindLabel: { color: '#30343B', fontSize: 14, fontWeight: '700' }, kindLabelActive: { color: accent }, kindHint: { color: '#8A8F98', fontSize: 10, lineHeight: 15, marginTop: 4 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 }, providerChip: { minHeight: 34, justifyContent: 'center', borderRadius: 8, backgroundColor: '#E8E9EC', paddingHorizontal: 11 }, providerActive: { backgroundColor: '#DDE8FF' }, providerText: { color: '#656A73', fontSize: 12, fontWeight: '600' }, providerTextActive: { color: accent }, input: { minHeight: 46, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DADDE2', color: '#17191E', fontSize: 14, paddingHorizontal: 13 },
  error: { color: '#C43A32', fontSize: 13, lineHeight: 18, marginTop: 14 }, continueButton: { minHeight: 50, borderRadius: 11, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, continueDisabled: { opacity: 0.45 }, continueText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
