/**
 * RecordEventModal: Interactive bottom sheet modal for selecting and recording events on an animal.
 * Directly opens specific event forms (Heat, Service, Weight, Illness) or categorized event picker.
 * Connects directly to POST /api/v1/cattle/:id/events with Idempotency-Key.
 * Strictly ADR-007 compliant (zero drop shadows, 1px border separation, token fills).
 */
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { Button } from '../../components/actions/Button.tsx';
import { Glyph } from '../../components/internal/Glyph.tsx';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../../components/internal/SheetModal.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { ArrowLeftIcon, EventKindIcon } from '../CattleIcons.tsx';

export interface RecordEventModalProps {
  visible: boolean;
  onClose: () => void;
  detail: CattleDetail;
  initialEventKey?: string | null;
  onSuccess: (message: string) => void;
  testID?: string;
}

interface EventOption {
  key: string;
  backendType: string;
  label: string;
  category: 'REPRODUCTION' | 'HEALTH' | 'MILK' | 'GROWTH' | 'MOVE' | 'OTHER';
}

const EVENT_OPTIONS: EventOption[] = [
  // Reproduction
  { key: 'HEAT', backendType: 'HEAT', label: 'Heat Observation', category: 'REPRODUCTION' },
  { key: 'SERVICE', backendType: 'BREEDING', label: 'AI / Service', category: 'REPRODUCTION' },
  { key: 'PREG_CHECK', backendType: 'PREG_CHECK', label: 'Pregnancy Check', category: 'REPRODUCTION' },
  { key: 'CALVING', backendType: 'CALVING', label: 'Calving', category: 'REPRODUCTION' },
  { key: 'DRY_OFF', backendType: 'DRY_OFF', label: 'Dry Off', category: 'REPRODUCTION' },

  // Health
  { key: 'ILLNESS', backendType: 'ILLNESS', label: 'Report Illness / Sickness', category: 'HEALTH' },
  { key: 'TREATMENT', backendType: 'TREATMENT', label: 'Administer Treatment', category: 'HEALTH' },
  { key: 'VACCINATION', backendType: 'VACCINATION', label: 'Vaccination', category: 'HEALTH' },
  { key: 'DEWORMING', backendType: 'DEWORMING', label: 'Deworming', category: 'HEALTH' },

  // Growth
  { key: 'WEIGHT', backendType: 'WEIGHT', label: 'Weigh Animal', category: 'GROWTH' },
  { key: 'BCS', backendType: 'BCS', label: 'Body Condition Score (BCS)', category: 'GROWTH' },

  // Move
  { key: 'MOVE', backendType: 'MOVE', label: 'Transfer Shed / Pen', category: 'MOVE' },

  // Other
  { key: 'NOTE', backendType: 'NOTE', label: 'General Note', category: 'OTHER' },
];

const BACKEND_TYPE_MAP: Record<string, string> = {
  HEAT: 'HEAT',
  SERVICE: 'BREEDING',
  BREEDING: 'BREEDING',
  PREG_CHECK: 'PREG_CHECK',
  CALVING: 'CALVING',
  ABORTION: 'ABORTION',
  DRY_OFF: 'DRY_OFF',
  WEIGHT: 'WEIGHT',
  BCS: 'BCS',
  ILLNESS: 'ILLNESS',
  TREATMENT: 'TREATMENT',
  VACCINATION: 'VACCINATION',
  DEWORMING: 'DEWORMING',
  MOVE: 'MOVE',
  NOTE: 'NOTE',
};

const CONDITIONS = [
  { id: 'MASTITIS', labelEn: 'Mastitis', labelBn: 'ওলান প্রদাহ' },
  { id: 'FEVER', labelEn: 'Fever', labelBn: 'জ্বর' },
  { id: 'LAMENESS', labelEn: 'Lameness', labelBn: 'খুড়া রোগ' },
  { id: 'METRITIS', labelEn: 'Metritis', labelBn: 'জরায়ু প্রদাহ' },
  { id: 'KETOSIS', labelEn: 'Ketosis', labelBn: 'কিটোসিস' },
  { id: 'MILK_FEVER', labelEn: 'Milk Fever', labelBn: 'মিল্ক ফিভার' },
  { id: 'INJURY', labelEn: 'Injury', labelBn: 'আঘাত' },
  { id: 'OTHER', labelEn: 'Other', labelBn: 'অন্যান্য' },
] as const;

function generateIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function RecordEventModal({
  visible,
  onClose,
  detail,
  initialEventKey = null,
  onSuccess,
  testID = 'record-event-modal',
}: RecordEventModalProps) {
  const { colors } = useTheme();
  const { t, locale } = useLocale();
  const { client } = useAuth();

  const [customEventKey, setCustomEventKey] = useState<string | null>(null);
  const currentEventKey = customEventKey ?? initialEventKey;
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Common Event Form State
  const [dateChoice, setDateChoice] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HEAT fields
  const [heatDetectionMethod, setHeatDetectionMethod] = useState<'VISUAL' | 'MANUAL' | 'COLLAR_SENSOR' | 'PEDOMETER'>('VISUAL');
  const [standingHeat, setStandingHeat] = useState(true);
  const [mucusDischarge, setMucusDischarge] = useState(false);
  const [mountingBehavior, setMountingBehavior] = useState(false);
  const [restlessness, setRestlessness] = useState(false);

  // SERVICE (BREEDING) fields
  const [breedingMethod, setBreedingMethod] = useState<'AI' | 'NATURAL' | 'EMBRYO_TRANSFER'>('AI');
  const [semenSource, setSemenSource] = useState<'FARM_INVENTORY' | 'TECHNICIAN_SUPPLIED' | 'EXTERNAL'>('FARM_INVENTORY');
  const [sireNameOrCode, setSireNameOrCode] = useState('');
  const [inseminator, setInseminator] = useState('');
  const [serviceCost, setServiceCost] = useState('');

  // PREG_CHECK fields
  const [pregResult, setPregResult] = useState<'PREGNANT' | 'NOT_PREGNANT' | 'SUSPECTED'>('PREGNANT');
  const [diagnosisMethod, setDiagnosisMethod] = useState<'PALPATION' | 'ULTRASOUND' | 'LAB'>('PALPATION');
  const [monthsPregnant, setMonthsPregnant] = useState('2');

  // WEIGHT fields
  const [weightKg, setWeightKg] = useState('');

  // BCS fields
  const [bcsScore, setBcsScore] = useState('3.0');

  // CALVING fields
  const [calvingEase, setCalvingEase] = useState<'NORMAL' | 'ASSISTED' | 'DIFFICULT' | 'CESAREAN'>('NORMAL');
  const [calfCount, setCalfCount] = useState<'1' | '2'>('1');
  const [calfGender, setCalfGender] = useState<'FEMALE' | 'MALE'>('FEMALE');
  const [calfTagNumber, setCalfTagNumber] = useState('');
  const [birthWeight, setBirthWeight] = useState('');

  // DRY_OFF fields
  const [dryOffReason, setDryOffReason] = useState<'SCHEDULED' | 'LOW_PRODUCTION' | 'HEALTH'>('SCHEDULED');

  // ILLNESS fields
  const [condition, setCondition] = useState<string>('MASTITIS');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [symptoms, setSymptoms] = useState('');

  // VACCINATION / DEWORMING / TREATMENT fields
  const [medicineName, setMedicineName] = useState('');
  const [doseAmount, setDoseAmount] = useState('10');
  const [doseUnit, setDoseUnit] = useState('ml');
  const [medRoute, setMedRoute] = useState<'IM' | 'SC' | 'ORAL' | 'IV' | 'TOPICAL' | 'OTHER'>('IM');

  // NOTE fields
  const [noteContent, setNoteContent] = useState('');

  const resetFormFields = () => {
    setDateChoice('today');
    setCustomDate(new Date().toISOString().slice(0, 10));
    setGeneralNotes('');
    setWeightKg('');
    setSireNameOrCode('');
    setInseminator('');
    setServiceCost('');
    setSymptoms('');
    setMedicineName('');
    setCalfTagNumber('');
    setBirthWeight('');
    setNoteContent('');
    setStandingHeat(true);
    setMucusDischarge(false);
    setMountingBehavior(false);
    setRestlessness(false);
    setError(null);
  };

  const handleClose = () => {
    resetFormFields();
    setCustomEventKey(null);
    onClose();
  };

  const resolveEventDate = (): string => {
    const now = new Date();
    if (dateChoice === 'today') {
      return now.toISOString();
    }
    if (dateChoice === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return y.toISOString();
    }
    // Custom date: append current time
    try {
      const d = new Date(customDate);
      if (!isNaN(d.getTime())) {
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        return d.toISOString();
      }
    } catch {
      // fallback
    }
    return now.toISOString();
  };

  const handleSubmit = async () => {
    if (!currentEventKey) return;
    setError(null);
    setSubmitting(true);

    try {
      const backendType = BACKEND_TYPE_MAP[currentEventKey] ?? currentEventKey;
      const eventAt = resolveEventDate();
      const payload: Record<string, unknown> = {};

      if (currentEventKey === 'HEAT') {
        payload.detectionMethod = heatDetectionMethod;
        payload.standingHeat = standingHeat;
        payload.mucusDischarge = mucusDischarge;
        payload.mountingBehavior = mountingBehavior;
        payload.restlessness = restlessness;
      } else if (currentEventKey === 'SERVICE') {
        payload.breedingMethod = breedingMethod;
        if (breedingMethod === 'AI') {
          payload.semenSource = semenSource;
          if (inseminator.trim()) payload.inseminator = inseminator.trim();
        }
        if (sireNameOrCode.trim()) payload.sireNameOrCode = sireNameOrCode.trim();
        const costNum = parseFloat(serviceCost);
        if (!isNaN(costNum) && costNum >= 0) {
          payload.serviceCost = costNum;
        }
      } else if (currentEventKey === 'PREG_CHECK') {
        payload.result = pregResult;
        payload.diagnosisMethod = diagnosisMethod;
        const months = parseFloat(monthsPregnant);
        if (!isNaN(months) && months > 0) {
          payload.gestationDay = Math.round(months * 30);
        }
      } else if (currentEventKey === 'WEIGHT') {
        const parsed = parseFloat(weightKg);
        if (isNaN(parsed) || parsed <= 0) {
          setError(t('cattle.eventForm.error.weightRequired'));
          setSubmitting(false);
          return;
        }
        payload.weightKg = parsed;
      } else if (currentEventKey === 'BCS') {
        payload.score = parseFloat(bcsScore) || 3.0;
      } else if (currentEventKey === 'CALVING') {
        payload.calvingEase = calvingEase;
        payload.calfCount = parseInt(calfCount, 10) || 1;
        if (calfGender) {
          const calfBirthWeight = parseFloat(birthWeight);
          payload.calves = [
            {
              gender: calfGender,
              tagNumber: calfTagNumber.trim() || undefined,
              birthWeight: !isNaN(calfBirthWeight) && calfBirthWeight > 0 ? calfBirthWeight : undefined,
              status: 'ALIVE',
            },
          ];
        }
      } else if (currentEventKey === 'DRY_OFF') {
        payload.reason = dryOffReason;
      } else if (currentEventKey === 'ILLNESS') {
        if (!condition) {
          setError(t('cattle.eventForm.error.conditionRequired'));
          setSubmitting(false);
          return;
        }
        payload.condition = condition;
        payload.severity = severity;
        if (symptoms.trim()) payload.symptoms = symptoms.trim();
      } else if (currentEventKey === 'VACCINATION' || currentEventKey === 'DEWORMING' || currentEventKey === 'TREATMENT') {
        if (!medicineName.trim()) {
          setError(t('cattle.eventForm.error.medicineRequired'));
          setSubmitting(false);
          return;
        }
        payload.medicineName = medicineName.trim();
        payload.doseAmount = parseFloat(doseAmount) || 1;
        payload.doseUnit = doseUnit.trim() || 'ml';
        payload.route = medRoute;
      } else if (currentEventKey === 'NOTE') {
        if (!noteContent.trim() && !generalNotes.trim()) {
          setError(t('cattle.eventForm.error.noteRequired'));
          setSubmitting(false);
          return;
        }
        payload.text = noteContent.trim() || generalNotes.trim();
      }

      const idempotencyKey = generateIdempotencyKey();
      const requestBody = {
        type: backendType,
        eventAt,
        payload,
        notes: generalNotes.trim() || undefined,
      };

      await client.post(
        `/cattle/${encodeURIComponent(detail.id)}/events`,
        requestBody,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );

      const successMsg = t('cattle.workspace.eventSuccess');
      handleClose();
      onSuccess(successMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.eventForm.error.generic');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { key: 'ALL', label: t('cattle.workspace.timeline.filterAll') },
    { key: 'REPRODUCTION', label: t('cattle.workspace.timeline.filterRepro') },
    { key: 'HEALTH', label: t('cattle.workspace.timeline.filterHealth') },
    { key: 'GROWTH', label: t('cattle.workspace.timeline.filterGrowth') },
    { key: 'MOVE', label: t('cattle.workspace.timeline.filterMoves') },
    { key: 'OTHER', label: t('cattle.workspace.timeline.filterNotes') },
  ];

  const visibleOptions = EVENT_OPTIONS.filter((opt) => {
    if (selectedCategory !== 'ALL' && opt.category !== selectedCategory) return false;
    // Hide reproduction for non-females
    if (opt.category === 'REPRODUCTION' && detail.gender !== 'FEMALE') return false;
    return true;
  });

  const getEventTitle = (key: string): string => {
    switch (key) {
      case 'HEAT':
        return t('cattle.eventForm.heat.title');
      case 'SERVICE':
        return t('cattle.eventForm.service.title');
      case 'PREG_CHECK':
        return t('cattle.eventForm.pregCheck.title');
      case 'CALVING':
        return t('cattle.eventForm.calving.title');
      case 'DRY_OFF':
        return t('cattle.eventForm.dryOff.title');
      case 'WEIGHT':
        return t('cattle.eventForm.weight.title');
      case 'BCS':
        return t('cattle.eventForm.bcs.title');
      case 'ILLNESS':
        return t('cattle.eventForm.illness.title');
      case 'VACCINATION':
      case 'DEWORMING':
      case 'TREATMENT':
        return t('cattle.eventForm.vaccination.title');
      case 'NOTE':
        return t('cattle.eventForm.note.title');
      default:
        return t('cattle.eventForm.title');
    }
  };

  return (
    <SheetModal
      visible={visible}
      onRequestClose={handleClose}
      heightFraction={currentEventKey ? 0.88 : 0.8}
      testID={testID}
    >
      {/* 1. Event Picker View */}
      {!currentEventKey ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SheetTitle>{t('cattle.workspace.recordEventTitle')}</SheetTitle>
            <PressableSurface
              accessibilityRole="button"
              pressedStyle="overlay"
              accessibilityLabel={t('common.cancel')}
              testID="picker-close-btn"
              onPress={handleClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.muted,
              }}
            >
              <Glyph name="close" size={16} color="foreground" />
            </PressableSurface>
          </View>

          <Text role="body" style={{ color: colors.mutedForeground }}>
            {t('cattle.workspace.selectEventType')} ({detail.name || detail.tagNumber})
          </Text>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <PressableSurface
                  key={cat.key}
                  accessibilityRole="button"
                  pressedStyle="overlay"
                  testID={`category-chip-${cat.key.toLowerCase()}`}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderRadius: radius.full,
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    role="body"
                    style={{
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? colors.primaryForeground : colors.foreground,
                    }}
                  >
                    {cat.label}
                  </Text>
                </PressableSurface>
              );
            })}
          </ScrollView>

          {/* Event List */}
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {visibleOptions.map((opt) => (
              <PressableSurface
                key={opt.key}
                accessibilityRole="button"
                pressedStyle="overlay"
                testID={`event-option-${opt.key.toLowerCase()}`}
                onPress={() => {
                  setError(null);
                  setCustomEventKey(opt.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 52,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: colors.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EventKindIcon kind={opt.key} size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text role="body" style={{ fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </View>
              </PressableSurface>
            ))}
          </ScrollView>
        </View>
      ) : (
        /* 2. Specific Event Recording Form */
        <View style={{ flex: 1, gap: 14 }}>
          {/* Header with Back button and Event Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            {!initialEventKey ? (
              <PressableSurface
                accessibilityRole="button"
                pressedStyle="overlay"
                accessibilityLabel={t('cattle.eventForm.back')}
                testID="form-back-to-picker"
                onPress={() => {
                  setError(null);
                  setCustomEventKey(null);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <ArrowLeftIcon size={18} color={colors.foreground} />
              </PressableSurface>
            ) : null}
            <View style={{ flex: 1 }}>
              <SheetTitle>{getEventTitle(currentEventKey)}</SheetTitle>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {detail.name || detail.tagNumber}
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {error ? (
            <View
              testID="event-form-error"
              style={{
                padding: 10,
                borderRadius: radius.md,
                backgroundColor: colors.destructiveTint,
                borderWidth: 1,
                borderColor: colors.destructive,
              }}
            >
              <Text role="caption" style={{ color: colors.destructiveText, fontWeight: '600' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Form Scrollable Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date Choice */}
            <View style={{ gap: 6 }}>
              <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                {t('cattle.eventForm.date')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['today', 'yesterday', 'custom'] as const).map((choice) => {
                  const isSel = dateChoice === choice;
                  const label =
                    choice === 'today'
                      ? t('cattle.eventForm.today')
                      : choice === 'yesterday'
                        ? t('cattle.eventForm.yesterday')
                        : customDate;
                  return (
                    <PressableSurface
                      key={choice}
                      accessibilityRole="button"
                      pressedStyle="overlay"
                      testID={`date-choice-${choice}`}
                      onPress={() => setDateChoice(choice)}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        paddingHorizontal: 8,
                        borderRadius: radius.md,
                        backgroundColor: isSel ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: isSel ? colors.primary : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        role="caption"
                        style={{
                          fontWeight: '600',
                          color: isSel ? colors.primaryForeground : colors.foreground,
                        }}
                      >
                        {label}
                      </Text>
                    </PressableSurface>
                  );
                })}
              </View>
            </View>

            {/* Event Specific Fields */}

            {/* 1. HEAT OBSERVATION */}
            {currentEventKey === 'HEAT' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.heat.method')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(
                      [
                        { id: 'VISUAL', label: t('cattle.eventForm.heat.method.visual') },
                        { id: 'MANUAL', label: t('cattle.eventForm.heat.method.manual') },
                        { id: 'COLLAR_SENSOR', label: t('cattle.eventForm.heat.method.sensor') },
                        { id: 'PEDOMETER', label: t('cattle.eventForm.heat.method.pedometer') },
                      ] as const
                    ).map((m) => {
                      const isSel = heatDetectionMethod === m.id;
                      return (
                        <PressableSurface
                          key={m.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`heat-method-${m.id.toLowerCase()}`}
                          onPress={() => setHeatDetectionMethod(m.id)}
                          style={{
                            minHeight: 40,
                            paddingHorizontal: 12,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {m.label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Symptoms Observed */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.heat.symptoms')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { active: standingHeat, set: setStandingHeat, label: t('cattle.eventForm.heat.standing'), testID: 'heat-symptom-standing' },
                      { active: mucusDischarge, set: setMucusDischarge, label: t('cattle.eventForm.heat.mucus'), testID: 'heat-symptom-mucus' },
                      { active: mountingBehavior, set: setMountingBehavior, label: t('cattle.eventForm.heat.mounting'), testID: 'heat-symptom-mounting' },
                      { active: restlessness, set: setRestlessness, label: t('cattle.eventForm.heat.restless'), testID: 'heat-symptom-restless' },
                    ].map((sym) => (
                      <PressableSurface
                        key={sym.testID}
                        accessibilityRole="button"
                        pressedStyle="overlay"
                        testID={sym.testID}
                        onPress={() => sym.set((prev: boolean) => !prev)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 40,
                          paddingHorizontal: 12,
                          borderRadius: radius.full,
                          backgroundColor: sym.active ? colors.muted : colors.card,
                          borderWidth: 1,
                          borderColor: sym.active ? colors.primary : colors.border,
                        }}
                      >
                        <Glyph name={sym.active ? 'check' : 'plus'} size={16} color={sym.active ? 'primary' : 'mutedForeground'} />
                        <Text role="caption" style={{ fontWeight: '600', color: sym.active ? colors.primary : colors.foreground }}>
                          {sym.label}
                        </Text>
                      </PressableSurface>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {/* 2. SERVICE (BREEDING) */}
            {currentEventKey === 'SERVICE' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.service.method')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(
                      [
                        { id: 'AI', label: t('cattle.eventForm.service.method.ai') },
                        { id: 'NATURAL', label: t('cattle.eventForm.service.method.natural') },
                        { id: 'EMBRYO_TRANSFER', label: t('cattle.eventForm.service.method.embryo') },
                      ] as const
                    ).map((m) => {
                      const isSel = breedingMethod === m.id;
                      return (
                        <PressableSurface
                          key={m.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`breeding-method-${m.id.toLowerCase()}`}
                          onPress={() => setBreedingMethod(m.id)}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            paddingHorizontal: 8,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                              textAlign: 'center',
                            }}
                          >
                            {m.label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Semen Source for AI */}
                {breedingMethod === 'AI' ? (
                  <View style={{ gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      Semen Source
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(
                        [
                          { id: 'FARM_INVENTORY', label: 'Inventory' },
                          { id: 'TECHNICIAN_SUPPLIED', label: 'Technician' },
                          { id: 'EXTERNAL', label: 'External' },
                        ] as const
                      ).map((src) => {
                        const isSel = semenSource === src.id;
                        return (
                          <PressableSurface
                            key={src.id}
                            accessibilityRole="button"
                            pressedStyle="overlay"
                            testID={`semen-source-${src.id.toLowerCase()}`}
                            onPress={() => setSemenSource(src.id)}
                            style={{
                              flex: 1,
                              minHeight: 38,
                              borderRadius: radius.md,
                              backgroundColor: isSel ? colors.primary : colors.muted,
                              borderWidth: 1,
                              borderColor: isSel ? colors.primary : colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              role="caption"
                              style={{
                                fontWeight: '600',
                                color: isSel ? colors.primaryForeground : colors.foreground,
                              }}
                            >
                              {src.label}
                            </Text>
                          </PressableSurface>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Sire / Bull Name */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.service.sire')}
                  </Text>
                  <TextInput
                    value={sireNameOrCode}
                    onChangeText={setSireNameOrCode}
                    placeholder="e.g. Friesian-102"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-service-sire"
                    style={{
                      minHeight: 46,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: radius.md,
                      paddingHorizontal: 12,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                    }}
                  />
                </View>

                {/* Inseminator */}
                {breedingMethod === 'AI' ? (
                  <View style={{ gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.eventForm.service.inseminator')}
                    </Text>
                    <TextInput
                      value={inseminator}
                      onChangeText={setInseminator}
                      placeholder="e.g. Dr. Alam"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-service-inseminator"
                      style={{
                        minHeight: 46,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                        fontSize: 15,
                      }}
                    />
                  </View>
                ) : null}

                {/* Service Cost */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.service.cost')}
                  </Text>
                  <TextInput
                    value={serviceCost}
                    onChangeText={setServiceCost}
                    keyboardType="numeric"
                    placeholder="e.g. 500"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-service-cost"
                    style={{
                      minHeight: 46,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: radius.md,
                      paddingHorizontal: 12,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* 3. PREGNANCY CHECK */}
            {currentEventKey === 'PREG_CHECK' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.pregCheck.result')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(
                      [
                        { id: 'PREGNANT', label: t('cattle.eventForm.pregCheck.result.pregnant') },
                        { id: 'NOT_PREGNANT', label: t('cattle.eventForm.pregCheck.result.notPregnant') },
                        { id: 'SUSPECTED', label: t('cattle.eventForm.pregCheck.result.suspected') },
                      ] as const
                    ).map((r) => {
                      const isSel = pregResult === r.id;
                      return (
                        <PressableSurface
                          key={r.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`preg-result-${r.id.toLowerCase()}`}
                          onPress={() => setPregResult(r.id)}
                          style={{
                            flex: 1,
                            minHeight: 42,
                            paddingHorizontal: 6,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                              textAlign: 'center',
                            }}
                          >
                            {r.label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Method */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.pregCheck.method')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(
                      [
                        { id: 'PALPATION', label: t('cattle.eventForm.pregCheck.method.palpation') },
                        { id: 'ULTRASOUND', label: t('cattle.eventForm.pregCheck.method.ultrasound') },
                        { id: 'LAB', label: t('cattle.eventForm.pregCheck.method.lab') },
                      ] as const
                    ).map((m) => {
                      const isSel = diagnosisMethod === m.id;
                      return (
                        <PressableSurface
                          key={m.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`preg-method-${m.id.toLowerCase()}`}
                          onPress={() => setDiagnosisMethod(m.id)}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            paddingHorizontal: 6,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {m.label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Months Pregnant */}
                {pregResult === 'PREGNANT' ? (
                  <View style={{ gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.eventForm.pregCheck.months')}
                    </Text>
                    <TextInput
                      value={monthsPregnant}
                      onChangeText={setMonthsPregnant}
                      keyboardType="numeric"
                      placeholder="e.g. 2.5"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-preg-months"
                      style={{
                        minHeight: 46,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                        fontSize: 15,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* 4. WEIGHT */}
            {currentEventKey === 'WEIGHT' ? (
              <View style={{ gap: 6 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                  {t('cattle.eventForm.weight.input')}
                </Text>
                <TextInput
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="numeric"
                  placeholder="e.g. 385"
                  placeholderTextColor={colors.mutedForeground}
                  testID="input-weight-kg"
                  style={{
                    minHeight: 46,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
            ) : null}

            {/* 5. BCS (Body Condition Score) */}
            {currentEventKey === 'BCS' ? (
              <View style={{ gap: 6 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                  {t('cattle.eventForm.bcs.input')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['2.0', '2.5', '3.0', '3.5', '4.0', '4.5'].map((sc) => {
                    const isSel = bcsScore === sc;
                    return (
                      <PressableSurface
                        key={sc}
                        accessibilityRole="button"
                        pressedStyle="overlay"
                        testID={`bcs-score-${sc}`}
                        onPress={() => setBcsScore(sc)}
                        style={{
                          width: 52,
                          height: 44,
                          borderRadius: radius.md,
                          backgroundColor: isSel ? colors.primary : colors.muted,
                          borderWidth: 1,
                          borderColor: isSel ? colors.primary : colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          role="body"
                          style={{
                            fontWeight: '700',
                            color: isSel ? colors.primaryForeground : colors.foreground,
                          }}
                        >
                          {sc}
                        </Text>
                      </PressableSurface>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* 6. CALVING */}
            {currentEventKey === 'CALVING' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.calving.ease')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(
                      [
                        { id: 'NORMAL', label: t('cattle.eventForm.calving.ease.normal') },
                        { id: 'ASSISTED', label: t('cattle.eventForm.calving.ease.assisted') },
                        { id: 'DIFFICULT', label: t('cattle.eventForm.calving.ease.difficult') },
                      ] as const
                    ).map((e) => {
                      const isSel = calvingEase === e.id;
                      return (
                        <PressableSurface
                          key={e.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`calving-ease-${e.id.toLowerCase()}`}
                          onPress={() => setCalvingEase(e.id)}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            paddingHorizontal: 6,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {e.label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Calf Count */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.calving.count')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['1', '2'] as const).map((cnt) => {
                      const isSel = calfCount === cnt;
                      return (
                        <PressableSurface
                          key={cnt}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`calf-count-${cnt}`}
                          onPress={() => setCalfCount(cnt)}
                          style={{
                            width: 60,
                            minHeight: 40,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text role="caption" style={{ fontWeight: '600', color: isSel ? colors.primaryForeground : colors.foreground }}>
                            {cnt}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Calf Gender & Tag */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.detail.gender')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['FEMALE', 'MALE'] as const).map((g) => {
                        const isSel = calfGender === g;
                        return (
                          <PressableSurface
                            key={g}
                            accessibilityRole="button"
                            pressedStyle="overlay"
                            testID={`calf-gender-${g.toLowerCase()}`}
                            onPress={() => setCalfGender(g)}
                            style={{
                              flex: 1,
                              minHeight: 40,
                              borderRadius: radius.md,
                              backgroundColor: isSel ? colors.primary : colors.muted,
                              borderWidth: 1,
                              borderColor: isSel ? colors.primary : colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              role="caption"
                              style={{
                                fontWeight: '600',
                                color: isSel ? colors.primaryForeground : colors.foreground,
                              }}
                            >
                              {g === 'FEMALE' ? t('cattle.gender.female') : t('cattle.gender.male')}
                            </Text>
                          </PressableSurface>
                        );
                      })}
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.detail.tag')}
                    </Text>
                    <TextInput
                      value={calfTagNumber}
                      onChangeText={setCalfTagNumber}
                      placeholder="e.g. C-101"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-calf-tag"
                      style={{
                        minHeight: 44,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* DRY OFF */}
            {currentEventKey === 'DRY_OFF' ? (
              <View style={{ gap: 6 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                  {t('cattle.eventForm.dryOff.reason')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(
                    [
                      { id: 'SCHEDULED', label: t('cattle.eventForm.dryOff.reason.scheduled') },
                      { id: 'LOW_PRODUCTION', label: t('cattle.eventForm.dryOff.reason.lowProduction') },
                      { id: 'HEALTH', label: t('cattle.eventForm.dryOff.reason.health') },
                    ] as const
                  ).map((r) => {
                    const isSel = dryOffReason === r.id;
                    return (
                      <PressableSurface
                        key={r.id}
                        accessibilityRole="button"
                        pressedStyle="overlay"
                        testID={`dry-off-reason-${r.id.toLowerCase()}`}
                        onPress={() => setDryOffReason(r.id)}
                        style={{
                          flex: 1,
                          minHeight: 40,
                          paddingHorizontal: 8,
                          borderRadius: radius.md,
                          backgroundColor: isSel ? colors.primary : colors.muted,
                          borderWidth: 1,
                          borderColor: isSel ? colors.primary : colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text role="caption" style={{ fontWeight: '600', color: isSel ? colors.primaryForeground : colors.foreground }}>
                          {r.label}
                        </Text>
                      </PressableSurface>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* 7. ILLNESS / SICKNESS */}
            {currentEventKey === 'ILLNESS' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.illness.condition')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {CONDITIONS.map((cond) => {
                      const isSel = condition === cond.id;
                      const label = locale === 'bn' ? cond.labelBn : cond.labelEn;
                      return (
                        <PressableSurface
                          key={cond.id}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`condition-${cond.id.toLowerCase()}`}
                          onPress={() => setCondition(cond.id)}
                          style={{
                            minHeight: 40,
                            paddingHorizontal: 12,
                            borderRadius: radius.full,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {label}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Severity */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.illness.severity')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => {
                      const isSel = severity === sev;
                      return (
                        <PressableSurface
                          key={sev}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`severity-${sev.toLowerCase()}`}
                          onPress={() => setSeverity(sev)}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            paddingHorizontal: 4,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            role="caption"
                            style={{
                              fontWeight: '600',
                              color: isSel ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {sev}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>

                {/* Symptoms description */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.illness.symptoms')}
                  </Text>
                  <TextInput
                    value={symptoms}
                    onChangeText={setSymptoms}
                    placeholder="e.g. Swollen udder, reduced feed intake"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-illness-symptoms"
                    style={{
                      minHeight: 46,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: radius.md,
                      paddingHorizontal: 12,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* 8. VACCINATION / DEWORMING / TREATMENT */}
            {currentEventKey === 'VACCINATION' || currentEventKey === 'DEWORMING' || currentEventKey === 'TREATMENT' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.vaccination.medicine')}
                  </Text>
                  <TextInput
                    value={medicineName}
                    onChangeText={setMedicineName}
                    placeholder="e.g. FMD Vaccine / Penicillin"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-med-name"
                    style={{
                      minHeight: 46,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: radius.md,
                      paddingHorizontal: 12,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                    }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.eventForm.vaccination.dose')}
                    </Text>
                    <TextInput
                      value={doseAmount}
                      onChangeText={setDoseAmount}
                      keyboardType="numeric"
                      placeholder="10"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-med-dose"
                      style={{
                        minHeight: 44,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                      }}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                      {t('cattle.eventForm.vaccination.unit')}
                    </Text>
                    <TextInput
                      value={doseUnit}
                      onChangeText={setDoseUnit}
                      placeholder="ml"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-med-unit"
                      style={{
                        minHeight: 44,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                      }}
                    />
                  </View>
                </View>

                {/* Route */}
                <View style={{ gap: 6 }}>
                  <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                    {t('cattle.eventForm.vaccination.route')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(['IM', 'SC', 'ORAL', 'IV', 'TOPICAL', 'OTHER'] as const).map((rt) => {
                      const isSel = medRoute === rt;
                      return (
                        <PressableSurface
                          key={rt}
                          accessibilityRole="button"
                          pressedStyle="overlay"
                          testID={`med-route-${rt.toLowerCase()}`}
                          onPress={() => setMedRoute(rt)}
                          style={{
                            minHeight: 38,
                            paddingHorizontal: 12,
                            borderRadius: radius.md,
                            backgroundColor: isSel ? colors.primary : colors.muted,
                            borderWidth: 1,
                            borderColor: isSel ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text role="caption" style={{ fontWeight: '600', color: isSel ? colors.primaryForeground : colors.foreground }}>
                            {rt}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            {/* 9. NOTE */}
            {currentEventKey === 'NOTE' ? (
              <View style={{ gap: 6 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                  {t('cattle.eventForm.note.text')}
                </Text>
                <TextInput
                  value={noteContent}
                  onChangeText={setNoteContent}
                  placeholder="e.g. Animal moved to shed B for monitoring"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  testID="input-note-content"
                  style={{
                    minHeight: 80,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    textAlignVertical: 'top',
                    fontSize: 15,
                  }}
                />
              </View>
            ) : null}

            {/* General Notes for All Other Events */}
            {currentEventKey !== 'NOTE' ? (
              <View style={{ gap: 6 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.mutedForeground }}>
                  {t('cattle.eventForm.notes')}
                </Text>
                <TextInput
                  value={generalNotes}
                  onChangeText={setGeneralNotes}
                  placeholder="Optional observations or remarks..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={2}
                  testID="input-event-notes"
                  style={{
                    minHeight: 60,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky Action Footer */}
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                size="md"
                label={t('cattle.eventForm.cancel')}
                onPress={handleClose}
                disabled={submitting}
                testID="event-form-cancel"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="primary"
                size="md"
                label={submitting ? t('cattle.eventForm.saving') : t('cattle.eventForm.save')}
                onPress={handleSubmit}
                disabled={submitting}
                testID="event-form-save"
              />
            </View>
          </View>
        </View>
      )}
    </SheetModal>
  );
}
