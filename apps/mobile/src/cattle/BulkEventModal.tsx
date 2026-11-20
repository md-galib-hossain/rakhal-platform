/**
 * Modal to batch record events for multiple selected animals.
 * Supports: Illness / Sickness, Vaccination, Deworming, Weight.
 * Zero drop shadows (ADR-007 compliant).
 */
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export interface BulkEventModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: (message: string) => void;
  testID?: string;
}

type BulkEventType = 'ILLNESS' | 'VACCINATION' | 'DEWORMING' | 'WEIGHT';

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

const SEVERITIES = [
  { id: 'LOW', labelEn: 'Low', labelBn: 'কম' },
  { id: 'MEDIUM', labelEn: 'Medium', labelBn: 'মাঝারি' },
  { id: 'HIGH', labelEn: 'High', labelBn: 'বেশি' },
  { id: 'CRITICAL', labelEn: 'Critical', labelBn: 'মারাত্মক' },
] as const;

const ROUTES = ['IM', 'SC', 'ORAL', 'IV', 'TOPICAL', 'OTHER'] as const;

export function BulkEventModal({
  visible,
  onClose,
  selectedIds,
  onSuccess,
  testID = 'bulk-event-modal',
}: BulkEventModalProps) {
  const { colors, tokens } = useTheme();
  const { t, locale } = useLocale();
  const format = useFormat();
  const { client } = useAuth();

  const [eventType, setEventType] = useState<BulkEventType>('ILLNESS');
  const [condition, setCondition] = useState<string>('MASTITIS');
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [symptoms, setSymptoms] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [doseAmount, setDoseAmount] = useState('10');
  const [doseUnit, setDoseUnit] = useState('ml');
  const [route, setRoute] = useState<string>('IM');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const resetForm = () => {
    setEventType('ILLNESS');
    setCondition('MASTITIS');
    setSeverity('MEDIUM');
    setSymptoms('');
    setMedicineName('');
    setDoseAmount('10');
    setDoseUnit('ml');
    setRoute('IM');
    setWeightKg('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};

      if (eventType === 'ILLNESS') {
        payload.condition = condition;
        payload.severity = severity;
        if (symptoms.trim()) payload.symptoms = symptoms.trim();
      } else if (eventType === 'VACCINATION' || eventType === 'DEWORMING') {
        if (!medicineName.trim()) {
          setError('Medicine or vaccine name is required');
          setSubmitting(false);
          return;
        }
        payload.medicineName = medicineName.trim();
        payload.doseAmount = parseFloat(doseAmount) || 1;
        payload.doseUnit = doseUnit.trim() || 'ml';
        payload.route = route;
      } else if (eventType === 'WEIGHT') {
        const parsedWeight = parseFloat(weightKg);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
          setError('Valid weight is required');
          setSubmitting(false);
          return;
        }
        payload.weightKg = parsedWeight;
      }

      const res = await client.post<{
        saved?: number;
        skipped?: number;
      }>('/animal-events/bulk', {
        type: eventType,
        eventAt: new Date().toISOString(),
        cattleIds: selectedIds,
        payload,
        notes: notes.trim() || undefined,
      });

      const savedCount = res?.data?.saved ?? selectedIds.length;
      const skippedCount = res?.data?.skipped ?? 0;
      const msg = t('cattle.bulk.event.success', {
        saved: format.numberSafe(savedCount),
        skipped: format.numberSafe(skippedCount),
      });

      handleClose();
      onSuccess(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.bulk.event.error');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetModal visible={visible} onRequestClose={handleClose} testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
        }}
      >
        <SheetTitle>
          {t('cattle.bulk.event.title', { count: format.numberSafe(selectedIds.length) })}
        </SheetTitle>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.cancel')}
          pressedStyle="overlay"
          onPress={handleClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: tokens.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.muted,
          }}
        >
          <Glyph name="close" size={16} color="foreground" />
        </PressableSurface>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}
      >
        {error ? (
          <View
            style={{
              padding: tokens.spacing.sm,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.destructiveTint,
              borderWidth: 1,
              borderColor: colors.destructive,
            }}
          >
            <Text role="caption" color="destructiveText">
              {error}
            </Text>
          </View>
        ) : null}

        {/* 1. Event Type Selector */}
        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.bulk.event.type')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
            {(
              [
                { type: 'ILLNESS', label: t('cattle.bulk.event.type.illness') },
                { type: 'VACCINATION', label: t('cattle.bulk.event.type.vaccination') },
                { type: 'DEWORMING', label: t('cattle.bulk.event.type.deworming') },
                { type: 'WEIGHT', label: t('cattle.bulk.event.type.weight') },
              ] as const
            ).map((opt) => {
              const active = eventType === opt.type;
              return (
                <PressableSurface
                  key={opt.type}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  pressedStyle="overlay"
                  onPress={() => setEventType(opt.type)}
                  testID={`bulk-event-type-${opt.type}`}
                  style={{
                    paddingVertical: tokens.spacing.xs + 2,
                    paddingHorizontal: tokens.spacing.sm + 2,
                    borderRadius: tokens.radius.sm,
                    backgroundColor: active ? colors.primary : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.primaryEdge : colors.border,
                    minHeight: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    role="label"
                    color={active ? 'primaryForeground' : 'foreground'}
                    style={{ fontWeight: active ? '700' : '500', fontSize: 13 }}
                  >
                    {opt.label}
                  </Text>
                </PressableSurface>
              );
            })}
          </View>
        </View>

        {/* 2. Specific Event Fields */}
        {eventType === 'ILLNESS' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            {/* Condition options */}
            <View style={{ gap: tokens.spacing.xs }}>
              <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                {t('cattle.bulk.event.condition')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
                {CONDITIONS.map((cond) => {
                  const active = condition === cond.id;
                  const label = locale === 'bn' ? cond.labelBn : cond.labelEn;
                  return (
                    <PressableSurface
                      key={cond.id}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      pressedStyle="overlay"
                      onPress={() => setCondition(cond.id)}
                      testID={`bulk-condition-${cond.id}`}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: tokens.spacing.sm,
                        borderRadius: tokens.radius.sm,
                        backgroundColor: active ? colors.successTint : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primaryEdge : colors.border,
                        minHeight: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        role="caption"
                        color={active ? 'primary' : 'foreground'}
                        style={{ fontWeight: active ? '700' : '500', fontSize: 12 }}
                      >
                        {label}
                      </Text>
                    </PressableSurface>
                  );
                })}
              </View>
            </View>

            {/* Severity options */}
            <View style={{ gap: tokens.spacing.xs }}>
              <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                {t('cattle.bulk.event.severity')}
              </Text>
              <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
                {SEVERITIES.map((sev) => {
                  const active = severity === sev.id;
                  const label = locale === 'bn' ? sev.labelBn : sev.labelEn;
                  return (
                    <PressableSurface
                      key={sev.id}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      pressedStyle="overlay"
                      onPress={() => setSeverity(sev.id)}
                      testID={`bulk-severity-${sev.id}`}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: tokens.radius.sm,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primaryEdge : colors.border,
                        minHeight: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        role="caption"
                        color={active ? 'primaryForeground' : 'foreground'}
                        style={{ fontWeight: active ? '700' : '500', fontSize: 12 }}
                      >
                        {label}
                      </Text>
                    </PressableSurface>
                  );
                })}
              </View>
            </View>

            {/* Symptoms */}
            <View style={{ gap: tokens.spacing.xs }}>
              <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                {t('cattle.bulk.event.symptoms')}
              </Text>
              <TextInput
                value={symptoms}
                onChangeText={setSymptoms}
                placeholder="e.g. Coughing, swollen udder, reduced appetite"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.sm,
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs + 2,
                  color: colors.foreground,
                  fontSize: 14,
                  minHeight: 44,
                }}
              />
            </View>
          </View>
        ) : null}

        {eventType === 'VACCINATION' || eventType === 'DEWORMING' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <View style={{ gap: tokens.spacing.xs }}>
              <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                {t('cattle.bulk.event.medicine')}
              </Text>
              <TextInput
                value={medicineName}
                onChangeText={setMedicineName}
                placeholder={eventType === 'VACCINATION' ? 'e.g. FMD Vaccine, Anthrax' : 'e.g. Albendazole, Ivermectin'}
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.sm,
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs + 2,
                  color: colors.foreground,
                  fontSize: 14,
                  minHeight: 44,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
              <View style={{ flex: 1, gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.bulk.event.doseAmount')}
                </Text>
                <TextInput
                  value={doseAmount}
                  onChangeText={setDoseAmount}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    borderRadius: tokens.radius.sm,
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: tokens.spacing.xs + 2,
                    color: colors.foreground,
                    fontSize: 14,
                    minHeight: 44,
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.bulk.event.doseUnit')}
                </Text>
                <TextInput
                  value={doseUnit}
                  onChangeText={setDoseUnit}
                  placeholder="ml"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    borderRadius: tokens.radius.sm,
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: tokens.spacing.xs + 2,
                    color: colors.foreground,
                    fontSize: 14,
                    minHeight: 44,
                  }}
                />
              </View>
            </View>

            <View style={{ gap: tokens.spacing.xs }}>
              <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                {t('cattle.bulk.event.route')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
                {ROUTES.map((r) => {
                  const active = route === r;
                  return (
                    <PressableSurface
                      key={r}
                      accessibilityRole="button"
                      accessibilityLabel={r}
                      pressedStyle="overlay"
                      onPress={() => setRoute(r)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: tokens.spacing.sm,
                        borderRadius: tokens.radius.sm,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primaryEdge : colors.border,
                        minHeight: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        role="caption"
                        color={active ? 'primaryForeground' : 'foreground'}
                        style={{ fontWeight: active ? '700' : '500', fontSize: 12 }}
                      >
                        {r}
                      </Text>
                    </PressableSurface>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {eventType === 'WEIGHT' ? (
          <View style={{ gap: tokens.spacing.xs }}>
            <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
              {t('cattle.bulk.event.weight')}
            </Text>
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="e.g. 250"
              placeholderTextColor={colors.mutedForeground}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                borderRadius: tokens.radius.sm,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: tokens.spacing.xs + 2,
                color: colors.foreground,
                fontSize: 14,
                minHeight: 44,
              }}
            />
          </View>
        ) : null}

        {/* 3. Notes */}
        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.bulk.event.notes')}
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional observations or notes"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={2}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: tokens.radius.sm,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.xs + 4,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 56,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 4. Action Buttons */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('cattle.bulk.cancel')}
              variant="secondary"
              size="md"
              fullWidth
              onPress={handleClose}
              disabled={submitting}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label={
                submitting
                  ? t('cattle.bulk.event.submitting')
                  : t('cattle.bulk.event.submit', { count: format.numberSafe(selectedIds.length) })
              }
              variant="primary"
              size="md"
              fullWidth
              onPress={handleSubmit}
              disabled={submitting}
              testID="bulk-event-submit-btn"
            />
          </View>
        </View>
      </ScrollView>
    </SheetModal>
  );
}
