/**
 * AddAnimalModal: 2-step Add Animal sheet modal for mobile.
 * Translates web drawer workflow into a tactile, mobile-first experience.
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation, token fills).
 * Modal capped with SheetModal heightFraction={0.88}, pinned header, scrollable body
 * with paddingHorizontal: 4 so input focus rings are never cut off, and sticky footer.
 */
import { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { DatePickerSheet } from '../components/picker/DatePickerSheet.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './CattleIcons.tsx';
import {
  deriveCategoryPreview,
  expandDate,
  formatIsoToday,
  previewItems,
  toHistoryPayload,
  type AnimalCategory,
  type BreedingMethod,
  type HistoryValues,
} from './add-animal-model.ts';

export interface AddAnimalModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  testID?: string;
}

interface OptionItem {
  id: string;
  name: string;
  subtitle?: string;
}

const DEFAULT_BREEDS: OptionItem[] = [
  { id: 'holstein-friesian', name: 'Holstein-Friesian' },
  { id: 'sahiwal', name: 'Sahiwal' },
  { id: 'jersey', name: 'Jersey' },
  { id: 'red-chittagong', name: 'Red Chittagong' },
  { id: 'local-deshi', name: 'Local / Deshi' },
  { id: 'sindhi', name: 'Sindhi' },
  { id: 'crossbred', name: 'Crossbred' },
];

const SOURCE_OPTIONS: Array<{ key: 'BORN' | 'PURCHASED' | 'LEASED' | 'OTHER'; labelKey: 'sourceBorn' | 'sourcePurchased' | 'sourceLeased' | 'sourceOther' }> = [
  { key: 'BORN', labelKey: 'sourceBorn' },
  { key: 'PURCHASED', labelKey: 'sourcePurchased' },
  { key: 'LEASED', labelKey: 'sourceLeased' },
  { key: 'OTHER', labelKey: 'sourceOther' },
];

export function AddAnimalModal({
  visible,
  onClose,
  onSuccess,
  testID = 'add-animal-modal',
}: AddAnimalModalProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();
  const sync = useSync();

  // Wizard Step: 'basic' = Step 1, 'history' = Step 2
  const [step, setStep] = useState<'basic' | 'history'>('basic');

  // Step 1: Basic Form State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [gender, setGender] = useState<'FEMALE' | 'MALE'>('FEMALE');
  const [dob, setDob] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<OptionItem>(DEFAULT_BREEDS[0]!);
  const [selectedShedId, setSelectedShedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Step 1: Additional Form State
  const [selectedMotherId, setSelectedMotherId] = useState<string | null>(null);
  const [selectedFatherId, setSelectedFatherId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'BORN' | 'PURCHASED' | 'LEASED' | 'OTHER'>('BORN');
  const [color, setColor] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');

  // Dropdown expansion toggles
  const [expandedSection, setExpandedSection] = useState<'breed' | 'shed' | 'group' | 'mother' | 'father' | null>(null);

  // Step 2: History State
  const [historyValues, setHistoryValues] = useState<HistoryValues>({});
  const [lastCalvingMonthMode, setLastCalvingMonthMode] = useState(false);
  const [milkingMonthMode, setMilkingMonthMode] = useState(false);
  const [dryMonthMode, setDryMonthMode] = useState(false);
  const [expectedMonthMode, setExpectedMonthMode] = useState(false);
  const [breedingMonthMode, setBreedingMonthMode] = useState(false);
  const [vaccinationMonthMode, setVaccinationMonthMode] = useState(false);

  // Options Loaded from Offline Cache / API
  const [breeds, setBreeds] = useState<OptionItem[]>(DEFAULT_BREEDS);
  const [sheds, setSheds] = useState<OptionItem[]>([]);
  const [groups, setGroups] = useState<OptionItem[]>([]);
  const [femaleCattle, setFemaleCattle] = useState<OptionItem[]>([]);
  const [maleCattle, setMaleCattle] = useState<OptionItem[]>([]);

  // DatePickerSheet State
  const [datePickerTarget, setDatePickerTarget] = useState<
    'dob' | 'lastCalving' | 'milkingSince' | 'drySince' | 'expectedCalving' | 'lastBreeding' | 'lastVaccination' | null
  >(null);

  // Status & Error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const today = formatIsoToday();

  // Load cache options on visible
  useEffect(() => {
    if (!visible) return;
    let active = true;

    async function loadOptions() {
      try {
        // 1. Sheds
        const shedRows = await sync.readCache('sheds');
        if (!active) return;
        if (Array.isArray(shedRows) && shedRows.length > 0) {
          const parsedSheds = shedRows
            .map((r) => {
              const rec = r as Record<string, unknown>;
              return typeof rec.id === 'string' && typeof rec.name === 'string'
                ? { id: rec.id, name: rec.name }
                : null;
            })
            .filter((s): s is OptionItem => s !== null);
          setSheds(parsedSheds);
        }

        // 2. Animal Groups
        const groupRows = await sync.readCache('animalGroups');
        if (!active) return;
        if (Array.isArray(groupRows) && groupRows.length > 0) {
          const parsedGroups = groupRows
            .map((r) => {
              const rec = r as Record<string, unknown>;
              return typeof rec.id === 'string' && typeof rec.name === 'string'
                ? { id: rec.id, name: rec.name }
                : null;
            })
            .filter((g): g is OptionItem => g !== null);
          setGroups(parsedGroups);
        }

        // 3. Cattle (for mother/father pickers)
        const cattleRows = await sync.readCache('cattle', { limit: 100 });
        if (!active) return;
        if (Array.isArray(cattleRows)) {
          const females: OptionItem[] = [];
          const males: OptionItem[] = [];
          for (const row of cattleRows) {
            const rec = row as Record<string, unknown>;
            if (typeof rec.id !== 'string') continue;
            const tag = typeof rec.tagNumber === 'string' ? rec.tagNumber : '';
            const cowName = typeof rec.name === 'string' ? rec.name : '';
            const g = typeof rec.gender === 'string' ? rec.gender.toUpperCase() : '';
            const displayTitle = cowName ? `${tag} (${cowName})` : tag;
            if (g === 'FEMALE') {
              females.push({ id: rec.id, name: displayTitle });
            } else if (g === 'MALE') {
              males.push({ id: rec.id, name: displayTitle });
            }
          }
          setFemaleCattle(females);
          setMaleCattle(males);
        }

        // 4. Try API for breeds
        try {
          const breedsRes = await client.get<Array<{ id: string; name: string }>>('/breeds');
          if (!active) return;
          if (breedsRes?.data && Array.isArray(breedsRes.data) && breedsRes.data.length > 0) {
            setBreeds(breedsRes.data);
            setSelectedBreed(breedsRes.data[0]!);
          }
        } catch {
          // Use default fallback breeds
        }
      } catch {
        // Non-fatal, fallback to empty lists
      }
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, [visible, sync, client]);

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      // User cancelled or picker unavailable
    }
  };

  // Reset modal state on close/open
  const handleClose = () => {
    if (submitting) return;
    setStep('basic');
    setSubmitError(null);
    setTagError(null);
    setExpandedSection(null);
    setImageUri(null);
    onClose();
  };

  // Derive Animal Category Preview
  const previewCategory: AnimalCategory = deriveCategoryPreview(
    gender,
    dob,
    historyValues.calvedBefore === 'yes',
  );

  const categoryNameMap: Record<AnimalCategory, string> = {
    CALF: t('cattle.category.calf'),
    HEIFER: t('cattle.category.heifer'),
    COW: t('cattle.category.cow'),
    BULL: t('cattle.category.bull'),
    STEER: t('cattle.category.steer'),
  };

  const categoryToneMap: Record<AnimalCategory, 'info' | 'neutral' | 'success' | 'warning'> = {
    CALF: 'info',
    HEIFER: 'neutral',
    COW: 'success',
    BULL: 'warning',
    STEER: 'neutral',
  };

  // Step 1 -> Step 2 validation & transition
  const handleNextStep = () => {
    const trimmedTag = tagId.trim();
    if (!trimmedTag) {
      setTagError(t('cattle.add.tagRequired'));
      return;
    }
    setTagError(null);
    setStep('history');
  };

  // Submission handler
  const handleSave = async (withHistory: boolean) => {
    const trimmedTag = tagId.trim();
    if (!trimmedTag) {
      setTagError(t('cattle.add.tagRequired'));
      setStep('basic');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const historyItems = withHistory ? toHistoryPayload(historyValues, gender, today) : undefined;
      const payload: Record<string, unknown> = {
        tagNumber: trimmedTag,
        ...(name.trim() ? { name: name.trim() } : {}),
        gender,
        ...(selectedBreed?.id ? { breedId: selectedBreed.id } : {}),
        ...(selectedShedId ? { shedId: selectedShedId } : {}),
        ...(selectedGroupId ? { animalGroupId: selectedGroupId } : {}),
        ...(dob.trim() ? { dateOfBirth: expandDate(dob.trim()) } : {}),
        ...(selectedMotherId ? { motherId: selectedMotherId } : {}),
        ...(selectedFatherId ? { fatherId: selectedFatherId } : {}),
        sourceType,
        ...(color.trim() ? { color: color.trim() } : {}),
        ...(weightKg.trim() && !Number.isNaN(Number(weightKg)) ? { weightKg: Number(weightKg) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(historyItems && historyItems.length > 0 ? { history: historyItems } : {}),
      };

      await client.post('/cattle', payload);

      // Trigger cache refresh
      try {
        await sync.syncNow();
      } catch {
        // Background pull failure does not block UI success
      }

      onSuccess(t('cattle.add.success', { tag: trimmedTag }));
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.add.error');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 Preview Items
  const previewList = previewItems(historyValues, gender, today);

  if (!visible) return null;

  return (
    <SheetModal
      visible={visible}
      onRequestClose={handleClose}
      heightFraction={0.88}
      scrollable={false}
      dismissable={!submitting}
      testID={testID}
    >
      {/* 1. PINNED HEADER */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          minHeight: 48,
        }}
      >
        {step === 'history' ? (
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('cattle.add.history.back')}
            pressedStyle="overlay"
            onPress={() => setStep('basic')}
            disabled={submitting}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: tokens.spacing.xs,
              paddingHorizontal: tokens.spacing.xs + 2,
              minHeight: tokens.touchTarget.min,
            }}
            testID="add-animal-back-btn"
          >
            <Text role="body" color="primary" style={{ fontWeight: '700', fontSize: 16 }}>
              ‹ {t('cattle.add.history.back')}
            </Text>
          </PressableSurface>
        ) : (
          <SheetTitle>{t('cattle.add.title')}</SheetTitle>
        )}

        {step === 'history' ? (
          <Text role="h2" color="popoverForeground" style={{ flex: 1, textAlign: 'center' }}>
            {gender === 'FEMALE' ? t('cattle.add.history.titleFemale') : t('cattle.add.history.titleMale')}
          </Text>
        ) : null}

        <IconButton
          icon="close"
          accessibilityLabel={t('cattle.add.cancel')}
          variant="ghost"
          size="md"
          onPress={handleClose}
          disabled={submitting}
          testID="add-animal-close-btn"
        />
      </View>

      {/* SUBMISSION ERROR BANNER */}
      {submitError ? (
        <View
          style={{
            marginHorizontal: 4,
            marginTop: tokens.spacing.xs,
            padding: tokens.spacing.sm,
            borderRadius: tokens.radius.sm,
            backgroundColor: colors.destructiveTint,
            borderWidth: 1,
            borderColor: colors.destructive,
          }}
        >
          <Text role="caption" color="destructiveText">
            {submitError}
          </Text>
        </View>
      ) : null}

      {/* 2. SCROLLABLE BODY (paddingHorizontal: 4 prevents focus ring clipping) */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 4,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.xl,
          gap: tokens.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'basic' ? (
          <>
            {/* CARD 1: BASIC INFO */}
            <View
              style={{
                padding: tokens.spacing.md,
                borderRadius: tokens.radius.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: tokens.spacing.md,
              }}
            >
              <Text role="label" color="foreground" style={{ fontWeight: '700', fontSize: 15 }}>
                {t('cattle.add.basicSection')}
              </Text>

              {/* Photo Box */}
              <View style={{ alignItems: 'center' }}>
                {imageUri ? (
                  <View style={{ width: 100, height: 100, position: 'relative' }}>
                    <Image
                      source={{ uri: imageUri }}
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: tokens.radius.md,
                        borderWidth: 1,
                        borderColor: colors.primary,
                      }}
                      resizeMode="cover"
                      testID="add-animal-photo-preview"
                    />
                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel={t('cattle.add.removePhoto')}
                      pressedStyle="overlay"
                      onPress={() => {
                        setImageUri(null);
                      }}
                      hitSlop={8}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      testID="add-animal-photo-remove"
                    >
                      <Glyph name="close" size={16} color="foreground" />
                    </PressableSurface>
                  </View>
                ) : (
                  <PressableSurface
                    accessibilityRole="button"
                    accessibilityLabel={t('cattle.add.photoBox')}
                    pressedStyle="overlay"
                    onPress={() => void handlePickPhoto()}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: tokens.radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: 8,
                    }}
                    testID="add-animal-photo-box"
                  >
                    <Glyph
                      key="glyph-plus"
                      name="plus"
                      size={24}
                      color="mutedForeground"
                    />
                    <Text
                      role="caption"
                      color="mutedForeground"
                      style={{ textAlign: 'center', fontSize: 11, fontWeight: '600' }}
                    >
                      {t('cattle.add.photoBox')}
                    </Text>
                  </PressableSurface>
                )}
              </View>

              {/* Tag ID (Required) */}
              <TextField
                label={`${t('cattle.add.tag')} *`}
                value={tagId}
                onChangeText={(val) => {
                  setTagId(val);
                  if (tagError) setTagError(null);
                }}
                placeholder={t('cattle.add.tagPlaceholder')}
                error={tagError ?? undefined}
                autoCapitalize="characters"
                testID="add-animal-tag-input"
              />

              {/* Cow Name (Optional) */}
              <TextField
                label={t('cattle.add.name')}
                value={name}
                onChangeText={setName}
                placeholder={t('cattle.add.namePlaceholder')}
                optional
                testID="add-animal-name-input"
              />

              {/* Gender Pill Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.gender')}
                </Text>
                <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                  <PressableSurface
                    accessibilityRole="button"
                    accessibilityLabel={t('cattle.add.genderFemale')}
                    pressedStyle="overlay"
                    onPress={() => setGender('FEMALE')}
                    style={{
                      flex: 1,
                      minHeight: tokens.touchTarget.min,
                      borderRadius: tokens.radius.md,
                      borderWidth: 1,
                      borderColor: gender === 'FEMALE' ? colors.primaryEdge : colors.border,
                      backgroundColor: gender === 'FEMALE' ? colors.primary : colors.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    testID="add-animal-gender-female"
                  >
                    <Text
                      role="label"
                      color={gender === 'FEMALE' ? 'primaryForeground' : 'foreground'}
                      style={{ fontWeight: gender === 'FEMALE' ? '700' : '500' }}
                    >
                      {t('cattle.add.genderFemale')}
                    </Text>
                  </PressableSurface>

                  <PressableSurface
                    accessibilityRole="button"
                    accessibilityLabel={t('cattle.add.genderMale')}
                    pressedStyle="overlay"
                    onPress={() => setGender('MALE')}
                    style={{
                      flex: 1,
                      minHeight: tokens.touchTarget.min,
                      borderRadius: tokens.radius.md,
                      borderWidth: 1,
                      borderColor: gender === 'MALE' ? colors.primaryEdge : colors.border,
                      backgroundColor: gender === 'MALE' ? colors.primary : colors.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    testID="add-animal-gender-male"
                  >
                    <Text
                      role="label"
                      color={gender === 'MALE' ? 'primaryForeground' : 'foreground'}
                      style={{ fontWeight: gender === 'MALE' ? '700' : '500' }}
                    >
                      {t('cattle.add.genderMale')}
                    </Text>
                  </PressableSurface>
                </View>
              </View>

              {/* Breed Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.breed')}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.breed')}
                  pressedStyle="overlay"
                  onPress={() => {
                    setExpandedSection(expandedSection === 'breed' ? null : 'breed');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: tokens.touchTarget.min,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: expandedSection === 'breed' ? colors.primaryEdge : colors.border,
                    backgroundColor: colors.background,
                  }}
                  testID="add-animal-breed-picker-trigger"
                >
                  <Text role="body" color="foreground">
                    {selectedBreed.name}
                  </Text>
                  {expandedSection === 'breed' ? (
                    <ChevronUpIcon size={16} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDownIcon size={16} color={colors.mutedForeground} />
                  )}
                </PressableSurface>

                {expandedSection === 'breed' ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                      backgroundColor: colors.background,
                      padding: tokens.spacing.xs,
                      gap: 4,
                      maxHeight: 180,
                    }}
                  >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      {breeds.map((b) => {
                        const isSelected = selectedBreed.id === b.id;
                        return (
                          <PressableSurface
                            key={b.id}
                            accessibilityRole="button"
                            accessibilityLabel={b.name}
                            pressedStyle="overlay"
                            onPress={() => {
                              setSelectedBreed(b);
                              setExpandedSection(null);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                              paddingHorizontal: tokens.spacing.sm,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: isSelected ? colors.muted : 'transparent',
                            }}
                          >
                            <Text
                              role="body"
                              color="foreground"
                              style={{ fontWeight: isSelected ? '700' : '400' }}
                            >
                              {b.name}
                            </Text>
                            {isSelected ? <Glyph name="check" size={16} color="primary" /> : null}
                          </PressableSurface>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* Shed Location Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.shed')}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.shed')}
                  pressedStyle="overlay"
                  onPress={() => setExpandedSection(expandedSection === 'shed' ? null : 'shed')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: tokens.touchTarget.min,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: expandedSection === 'shed' ? colors.primaryEdge : colors.border,
                    backgroundColor: colors.background,
                  }}
                  testID="add-animal-shed-picker-trigger"
                >
                  <Text role="body" color={selectedShedId ? 'foreground' : 'mutedForeground'}>
                    {selectedShedId ? sheds.find((s) => s.id === selectedShedId)?.name ?? selectedShedId : t('cattle.add.noShed')}
                  </Text>
                  {expandedSection === 'shed' ? (
                    <ChevronUpIcon size={16} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDownIcon size={16} color={colors.mutedForeground} />
                  )}
                </PressableSurface>

                {expandedSection === 'shed' ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                      backgroundColor: colors.background,
                      padding: tokens.spacing.xs,
                      gap: 4,
                      maxHeight: 180,
                    }}
                  >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      <PressableSurface
                        accessibilityRole="button"
                        accessibilityLabel={t('cattle.add.noShed')}
                        pressedStyle="overlay"
                        onPress={() => {
                          setSelectedShedId(null);
                          setExpandedSection(null);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 40,
                          paddingHorizontal: tokens.spacing.sm,
                          borderRadius: tokens.radius.sm,
                          backgroundColor: selectedShedId === null ? colors.muted : 'transparent',
                        }}
                      >
                        <Text role="body" color="mutedForeground" style={{ fontWeight: selectedShedId === null ? '700' : '400' }}>
                          {t('cattle.add.noShed')}
                        </Text>
                        {selectedShedId === null ? <Glyph name="check" size={16} color="primary" /> : null}
                      </PressableSurface>

                      {sheds.map((s) => {
                        const isSelected = selectedShedId === s.id;
                        return (
                          <PressableSurface
                            key={s.id}
                            accessibilityRole="button"
                            accessibilityLabel={s.name}
                            pressedStyle="overlay"
                            onPress={() => {
                              setSelectedShedId(s.id);
                              setExpandedSection(null);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                              paddingHorizontal: tokens.spacing.sm,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: isSelected ? colors.muted : 'transparent',
                            }}
                          >
                            <Text role="body" color="foreground" style={{ fontWeight: isSelected ? '700' : '400' }}>
                              {s.name}
                            </Text>
                            {isSelected ? <Glyph name="check" size={16} color="primary" /> : null}
                          </PressableSurface>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* Animal Group Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.group')}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.group')}
                  pressedStyle="overlay"
                  onPress={() => setExpandedSection(expandedSection === 'group' ? null : 'group')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: tokens.touchTarget.min,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: expandedSection === 'group' ? colors.primaryEdge : colors.border,
                    backgroundColor: colors.background,
                  }}
                  testID="add-animal-group-picker-trigger"
                >
                  <Text role="body" color={selectedGroupId ? 'foreground' : 'mutedForeground'}>
                    {selectedGroupId ? groups.find((g) => g.id === selectedGroupId)?.name ?? selectedGroupId : t('cattle.add.noGroup')}
                  </Text>
                  {expandedSection === 'group' ? (
                    <ChevronUpIcon size={16} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDownIcon size={16} color={colors.mutedForeground} />
                  )}
                </PressableSurface>

                {expandedSection === 'group' ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                      backgroundColor: colors.background,
                      padding: tokens.spacing.xs,
                      gap: 4,
                      maxHeight: 180,
                    }}
                  >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      <PressableSurface
                        accessibilityRole="button"
                        accessibilityLabel={t('cattle.add.noGroup')}
                        pressedStyle="overlay"
                        onPress={() => {
                          setSelectedGroupId(null);
                          setExpandedSection(null);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 40,
                          paddingHorizontal: tokens.spacing.sm,
                          borderRadius: tokens.radius.sm,
                          backgroundColor: selectedGroupId === null ? colors.muted : 'transparent',
                        }}
                      >
                        <Text role="body" color="mutedForeground" style={{ fontWeight: selectedGroupId === null ? '700' : '400' }}>
                          {t('cattle.add.noGroup')}
                        </Text>
                        {selectedGroupId === null ? <Glyph name="check" size={16} color="primary" /> : null}
                      </PressableSurface>

                      {groups.map((g) => {
                        const isSelected = selectedGroupId === g.id;
                        return (
                          <PressableSurface
                            key={g.id}
                            accessibilityRole="button"
                            accessibilityLabel={g.name}
                            pressedStyle="overlay"
                            onPress={() => {
                              setSelectedGroupId(g.id);
                              setExpandedSection(null);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                              paddingHorizontal: tokens.spacing.sm,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: isSelected ? colors.muted : 'transparent',
                            }}
                          >
                            <Text role="body" color="foreground" style={{ fontWeight: isSelected ? '700' : '400' }}>
                              {g.name}
                            </Text>
                            {isSelected ? <Glyph name="check" size={16} color="primary" /> : null}
                          </PressableSurface>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* Date of Birth */}
              <View style={{ gap: tokens.spacing.xs }}>
                <TextField
                  label={t('cattle.add.dob')}
                  value={dob}
                  onChangeText={setDob}
                  placeholder={t('cattle.add.dobPlaceholder')}
                  optional
                  trailingAction={{
                    icon: <CalendarIcon size={18} color={colors.primary} />,
                    onPress: () => setDatePickerTarget('dob'),
                    accessibilityLabel: t('cattle.add.dob'),
                  }}
                  testID="add-animal-dob-input"
                />
              </View>

              {/* Category Preview Badge */}
              <View
                style={{
                  padding: tokens.spacing.sm,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                testID="add-animal-category-preview"
              >
                <Text role="caption" color="mutedForeground">
                  {t('cattle.add.categoryPreview', { category: '' }).split(':')[0]}:
                </Text>
                <StatusBadge
                  label={categoryNameMap[previewCategory]}
                  tone={categoryToneMap[previewCategory]}
                />
              </View>
            </View>

            {/* CARD 2: ADDITIONAL INFO */}
            <View
              style={{
                padding: tokens.spacing.md,
                borderRadius: tokens.radius.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: tokens.spacing.md,
              }}
            >
              <Text role="label" color="foreground" style={{ fontWeight: '700', fontSize: 15 }}>
                {t('cattle.add.additionalSection')}
              </Text>

              {/* Mother Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.mother')}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.mother')}
                  pressedStyle="overlay"
                  onPress={() => setExpandedSection(expandedSection === 'mother' ? null : 'mother')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: tokens.touchTarget.min,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: expandedSection === 'mother' ? colors.primaryEdge : colors.border,
                    backgroundColor: colors.background,
                  }}
                  testID="add-animal-mother-picker-trigger"
                >
                  <Text role="body" color={selectedMotherId ? 'foreground' : 'mutedForeground'}>
                    {selectedMotherId
                      ? femaleCattle.find((c) => c.id === selectedMotherId)?.name ?? selectedMotherId
                      : t('cattle.add.noMother')}
                  </Text>
                  {expandedSection === 'mother' ? (
                    <ChevronUpIcon size={16} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDownIcon size={16} color={colors.mutedForeground} />
                  )}
                </PressableSurface>

                {expandedSection === 'mother' ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                      backgroundColor: colors.background,
                      padding: tokens.spacing.xs,
                      gap: 4,
                      maxHeight: 180,
                    }}
                  >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      <PressableSurface
                        accessibilityRole="button"
                        accessibilityLabel={t('cattle.add.noMother')}
                        pressedStyle="overlay"
                        onPress={() => {
                          setSelectedMotherId(null);
                          setExpandedSection(null);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 40,
                          paddingHorizontal: tokens.spacing.sm,
                          borderRadius: tokens.radius.sm,
                          backgroundColor: selectedMotherId === null ? colors.muted : 'transparent',
                        }}
                      >
                        <Text role="body" color="mutedForeground" style={{ fontWeight: selectedMotherId === null ? '700' : '400' }}>
                          {t('cattle.add.noMother')}
                        </Text>
                        {selectedMotherId === null ? <Glyph name="check" size={16} color="primary" /> : null}
                      </PressableSurface>

                      {femaleCattle.map((c) => {
                        const isSelected = selectedMotherId === c.id;
                        return (
                          <PressableSurface
                            key={c.id}
                            accessibilityRole="button"
                            accessibilityLabel={c.name}
                            pressedStyle="overlay"
                            onPress={() => {
                              setSelectedMotherId(c.id);
                              setExpandedSection(null);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                              paddingHorizontal: tokens.spacing.sm,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: isSelected ? colors.muted : 'transparent',
                            }}
                          >
                            <Text role="body" color="foreground" style={{ fontWeight: isSelected ? '700' : '400' }}>
                              {c.name}
                            </Text>
                            {isSelected ? <Glyph name="check" size={16} color="primary" /> : null}
                          </PressableSurface>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* Father Selector */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.father')}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.father')}
                  pressedStyle="overlay"
                  onPress={() => setExpandedSection(expandedSection === 'father' ? null : 'father')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: tokens.touchTarget.min,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: expandedSection === 'father' ? colors.primaryEdge : colors.border,
                    backgroundColor: colors.background,
                  }}
                  testID="add-animal-father-picker-trigger"
                >
                  <Text role="body" color={selectedFatherId ? 'foreground' : 'mutedForeground'}>
                    {selectedFatherId
                      ? maleCattle.find((c) => c.id === selectedFatherId)?.name ?? selectedFatherId
                      : t('cattle.add.noFather')}
                  </Text>
                  {expandedSection === 'father' ? (
                    <ChevronUpIcon size={16} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDownIcon size={16} color={colors.mutedForeground} />
                  )}
                </PressableSurface>

                {expandedSection === 'father' ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                      backgroundColor: colors.background,
                      padding: tokens.spacing.xs,
                      gap: 4,
                      maxHeight: 180,
                    }}
                  >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      <PressableSurface
                        accessibilityRole="button"
                        accessibilityLabel={t('cattle.add.noFather')}
                        pressedStyle="overlay"
                        onPress={() => {
                          setSelectedFatherId(null);
                          setExpandedSection(null);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 40,
                          paddingHorizontal: tokens.spacing.sm,
                          borderRadius: tokens.radius.sm,
                          backgroundColor: selectedFatherId === null ? colors.muted : 'transparent',
                        }}
                      >
                        <Text role="body" color="mutedForeground" style={{ fontWeight: selectedFatherId === null ? '700' : '400' }}>
                          {t('cattle.add.noFather')}
                        </Text>
                        {selectedFatherId === null ? <Glyph name="check" size={16} color="primary" /> : null}
                      </PressableSurface>

                      {maleCattle.map((c) => {
                        const isSelected = selectedFatherId === c.id;
                        return (
                          <PressableSurface
                            key={c.id}
                            accessibilityRole="button"
                            accessibilityLabel={c.name}
                            pressedStyle="overlay"
                            onPress={() => {
                              setSelectedFatherId(c.id);
                              setExpandedSection(null);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                              paddingHorizontal: tokens.spacing.sm,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: isSelected ? colors.muted : 'transparent',
                            }}
                          >
                            <Text role="body" color="foreground" style={{ fontWeight: isSelected ? '700' : '400' }}>
                              {c.name}
                            </Text>
                            {isSelected ? <Glyph name="check" size={16} color="primary" /> : null}
                          </PressableSurface>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* Source Picker */}
              <View style={{ gap: tokens.spacing.xs }}>
                <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                  {t('cattle.add.source')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
                  {SOURCE_OPTIONS.map((opt) => {
                    const isSelected = sourceType === opt.key;
                    return (
                      <PressableSurface
                        key={opt.key}
                        accessibilityRole="button"
                        accessibilityLabel={t(`cattle.add.${opt.labelKey}`)}
                        pressedStyle="overlay"
                        onPress={() => setSourceType(opt.key)}
                        style={{
                          minHeight: tokens.touchTarget.min,
                          paddingHorizontal: tokens.spacing.md,
                          paddingVertical: tokens.spacing.xs,
                          borderRadius: tokens.radius.md,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primaryEdge : colors.border,
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          role="caption"
                          color={isSelected ? 'primaryForeground' : 'foreground'}
                          style={{ fontWeight: isSelected ? '700' : '500' }}
                        >
                          {t(`cattle.add.${opt.labelKey}`)}
                        </Text>
                      </PressableSurface>
                    );
                  })}
                </View>
              </View>

              {/* Color */}
              <TextField
                label={t('cattle.add.color')}
                value={color}
                onChangeText={setColor}
                placeholder={t('cattle.add.colorPlaceholder')}
                optional
                testID="add-animal-color-input"
              />

              {/* Weight */}
              <TextField
                label={t('cattle.add.weight')}
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder={t('cattle.add.weightPlaceholder')}
                unit="kg"
                keyboardType="decimal-pad"
                optional
                testID="add-animal-weight-input"
              />

              {/* Notes */}
              <TextField
                label={t('cattle.add.notes')}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('cattle.add.notesPlaceholder')}
                multiline
                optional
                testID="add-animal-notes-input"
              />
            </View>
          </>
        ) : (
          /* STEP 2: HER / HIS HISTORY */
          <View style={{ gap: tokens.spacing.md }}>
            {/* Intro text */}
            <Text role="body" color="mutedForeground">
              {t('cattle.add.history.intro')}
            </Text>

            {gender === 'FEMALE' ? (
              <>
                {/* 1. Has she calved before? */}
                <View
                  style={{
                    padding: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: tokens.spacing.md,
                  }}
                >
                  <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                    {t('cattle.add.history.calvedBefore')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                    {(['yes', 'no'] as const).map((opt) => {
                      const isSelected = historyValues.calvedBefore === opt;
                      return (
                        <PressableSurface
                          key={opt}
                          accessibilityRole="button"
                          accessibilityLabel={t(`cattle.add.history.${opt}`)}
                          pressedStyle="overlay"
                          onPress={() =>
                            setHistoryValues((prev) => ({
                              ...prev,
                              calvedBefore: opt,
                              ...(opt === 'no' ? { milkingNow: undefined, milkingSince: undefined, drySince: undefined, lastCalvingDate: undefined, calvingNumber: undefined } : {}),
                            }))
                          }
                          style={{
                            flex: 1,
                            minHeight: tokens.touchTarget.min,
                            borderRadius: tokens.radius.md,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primaryEdge : colors.border,
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          testID={`history-calved-${opt}`}
                        >
                          <Text
                            role="label"
                            color={isSelected ? 'primaryForeground' : 'foreground'}
                            style={{ fontWeight: isSelected ? '700' : '500' }}
                          >
                            {t(`cattle.add.history.${opt}`)}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>

                  {/* Sub-section if calvedBefore === 'yes' */}
                  {historyValues.calvedBefore === 'yes' ? (
                    <View
                      style={{
                        borderLeftWidth: 2,
                        borderLeftColor: colors.primaryEdge,
                        paddingLeft: tokens.spacing.md,
                        gap: tokens.spacing.md,
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      {/* Last Calving Date */}
                      <View style={{ gap: tokens.spacing.xs }}>
                        <TextField
                          label={t('cattle.add.history.lastCalving')}
                          value={historyValues.lastCalvingDate ?? ''}
                          onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, lastCalvingDate: val || undefined }))}
                          placeholder={lastCalvingMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                          optional
                          trailingAction={
                            !lastCalvingMonthMode
                              ? {
                                  icon: <CalendarIcon size={18} color={colors.primary} />,
                                  onPress: () => setDatePickerTarget('lastCalving'),
                                  accessibilityLabel: t('cattle.add.history.lastCalving'),
                                }
                              : undefined
                          }
                        />
                        <PressableSurface
                          accessibilityRole="button"
                          accessibilityLabel={t('cattle.add.history.monthOnly')}
                          pressedStyle="overlay"
                          onPress={() => {
                            const next = !lastCalvingMonthMode;
                            setLastCalvingMonthMode(next);
                            if (historyValues.lastCalvingDate) {
                              setHistoryValues((prev) => ({
                                ...prev,
                                lastCalvingDate: next ? prev.lastCalvingDate?.slice(0, 7) : `${prev.lastCalvingDate?.slice(0, 7)}-15`,
                              }));
                            }
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                        >
                          <Glyph name={lastCalvingMonthMode ? 'check' : 'dot'} size={16} color={lastCalvingMonthMode ? 'primary' : 'mutedForeground'} />
                          <Text role="caption" color="mutedForeground">
                            {t('cattle.add.history.monthOnly')}
                          </Text>
                        </PressableSurface>
                      </View>

                      {/* Calving Number */}
                      <TextField
                        label={t('cattle.add.history.calvingNumber')}
                        value={historyValues.calvingNumber ? String(historyValues.calvingNumber) : ''}
                        onChangeText={(val) => {
                          const n = Number(val);
                          setHistoryValues((prev) => ({ ...prev, calvingNumber: val && !Number.isNaN(n) ? Math.min(20, Math.max(1, n)) : undefined }));
                        }}
                        placeholder="1"
                        keyboardType="number-pad"
                        optional
                      />

                      {/* Is she milking now? */}
                      <View style={{ gap: tokens.spacing.xs }}>
                        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                          {t('cattle.add.history.milkingNow')}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                          {(['yes', 'no'] as const).map((opt) => {
                            const isSelected = historyValues.milkingNow === opt;
                            return (
                              <PressableSurface
                                key={opt}
                                accessibilityRole="button"
                                accessibilityLabel={t(`cattle.add.history.${opt}`)}
                                pressedStyle="overlay"
                                onPress={() =>
                                  setHistoryValues((prev) => ({
                                    ...prev,
                                    milkingNow: opt,
                                    ...(opt === 'yes' ? { drySince: undefined } : { milkingSince: undefined }),
                                  }))
                                }
                                style={{
                                  flex: 1,
                                  minHeight: tokens.touchTarget.min,
                                  borderRadius: tokens.radius.md,
                                  borderWidth: 1,
                                  borderColor: isSelected ? colors.primaryEdge : colors.border,
                                  backgroundColor: isSelected ? colors.primary : colors.card,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text
                                  role="label"
                                  color={isSelected ? 'primaryForeground' : 'foreground'}
                                  style={{ fontWeight: isSelected ? '700' : '500' }}
                                >
                                  {t(`cattle.add.history.${opt}`)}
                                </Text>
                              </PressableSurface>
                            );
                          })}
                        </View>
                      </View>

                      {/* Milking Since */}
                      {historyValues.milkingNow === 'yes' ? (
                        <View style={{ gap: tokens.spacing.xs }}>
                          <TextField
                            label={t('cattle.add.history.milkingSince')}
                            value={historyValues.milkingSince ?? ''}
                            onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, milkingSince: val || undefined }))}
                            placeholder={milkingMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                            optional
                            trailingAction={
                              !milkingMonthMode
                                ? {
                                    icon: <CalendarIcon size={18} color={colors.primary} />,
                                    onPress: () => setDatePickerTarget('milkingSince'),
                                    accessibilityLabel: t('cattle.add.history.milkingSince'),
                                  }
                              : undefined
                            }
                          />
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel={t('cattle.add.history.monthOnly')}
                            pressedStyle="overlay"
                            onPress={() => {
                              const next = !milkingMonthMode;
                              setMilkingMonthMode(next);
                              if (historyValues.milkingSince) {
                                setHistoryValues((prev) => ({
                                  ...prev,
                                  milkingSince: next ? prev.milkingSince?.slice(0, 7) : `${prev.milkingSince?.slice(0, 7)}-15`,
                                }));
                              }
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                          >
                            <Glyph name={milkingMonthMode ? 'check' : 'dot'} size={16} color={milkingMonthMode ? 'primary' : 'mutedForeground'} />
                            <Text role="caption" color="mutedForeground">
                              {t('cattle.add.history.monthOnly')}
                            </Text>
                          </PressableSurface>
                        </View>
                      ) : null}

                      {/* Dry Since */}
                      {historyValues.milkingNow === 'no' ? (
                        <View style={{ gap: tokens.spacing.xs }}>
                          <TextField
                            label={t('cattle.add.history.drySince')}
                            value={historyValues.drySince ?? ''}
                            onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, drySince: val || undefined }))}
                            placeholder={dryMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                            optional
                            trailingAction={
                              !dryMonthMode
                                ? {
                                    icon: <CalendarIcon size={18} color={colors.primary} />,
                                    onPress: () => setDatePickerTarget('drySince'),
                                    accessibilityLabel: t('cattle.add.history.drySince'),
                                  }
                              : undefined
                            }
                          />
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel={t('cattle.add.history.monthOnly')}
                            pressedStyle="overlay"
                            onPress={() => {
                              const next = !dryMonthMode;
                              setDryMonthMode(next);
                              if (historyValues.drySince) {
                                setHistoryValues((prev) => ({
                                  ...prev,
                                  drySince: next ? prev.drySince?.slice(0, 7) : `${prev.drySince?.slice(0, 7)}-15`,
                                }));
                              }
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                          >
                            <Glyph name={dryMonthMode ? 'check' : 'dot'} size={16} color={dryMonthMode ? 'primary' : 'mutedForeground'} />
                            <Text role="caption" color="mutedForeground">
                              {t('cattle.add.history.monthOnly')}
                            </Text>
                          </PressableSurface>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* 2. Is she pregnant? */}
                <View
                  style={{
                    padding: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: tokens.spacing.md,
                  }}
                >
                  <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                    {t('cattle.add.history.pregnant')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                    {(['yes', 'no'] as const).map((opt) => {
                      const isSelected = historyValues.pregnant === opt;
                      return (
                        <PressableSurface
                          key={opt}
                          accessibilityRole="button"
                          accessibilityLabel={t(`cattle.add.history.${opt}`)}
                          pressedStyle="overlay"
                          onPress={() =>
                            setHistoryValues((prev) => ({
                              ...prev,
                              pregnant: opt,
                              ...(opt === 'no' ? { monthsPregnant: undefined, expectedCalvingDate: undefined } : {}),
                            }))
                          }
                          style={{
                            flex: 1,
                            minHeight: tokens.touchTarget.min,
                            borderRadius: tokens.radius.md,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primaryEdge : colors.border,
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          testID={`history-pregnant-${opt}`}
                        >
                          <Text
                            role="label"
                            color={isSelected ? 'primaryForeground' : 'foreground'}
                            style={{ fontWeight: isSelected ? '700' : '500' }}
                          >
                            {t(`cattle.add.history.${opt}`)}
                          </Text>
                        </PressableSurface>
                      );
                    })}
                  </View>

                  {/* Sub-section if pregnant === 'yes' */}
                  {historyValues.pregnant === 'yes' ? (
                    <View
                      style={{
                        borderLeftWidth: 2,
                        borderLeftColor: colors.primaryEdge,
                        paddingLeft: tokens.spacing.md,
                        gap: tokens.spacing.md,
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      <Text role="caption" color="mutedForeground">
                        {t('cattle.add.history.pregnantHint')}
                      </Text>

                      {/* Months pregnant */}
                      <TextField
                        label={t('cattle.add.history.monthsPregnant')}
                        value={historyValues.monthsPregnant !== undefined ? String(historyValues.monthsPregnant) : ''}
                        onChangeText={(val) => {
                          const num = Number(val);
                          setHistoryValues((prev) => ({
                            ...prev,
                            monthsPregnant: val && !Number.isNaN(num) ? num : undefined,
                          }));
                        }}
                        placeholder="e.g. 5"
                        keyboardType="decimal-pad"
                        optional
                      />

                      <Text role="caption" color="mutedForeground" style={{ textAlign: 'center' }}>
                        — {t('cattle.add.history.or')} —
                      </Text>

                      {/* Expected calving date */}
                      <View style={{ gap: tokens.spacing.xs }}>
                        <TextField
                          label={t('cattle.add.history.expectedCalving')}
                          value={historyValues.expectedCalvingDate ?? ''}
                          onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, expectedCalvingDate: val || undefined }))}
                          placeholder={expectedMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                          optional
                          trailingAction={
                            !expectedMonthMode
                              ? {
                                  icon: <CalendarIcon size={18} color={colors.primary} />,
                                  onPress: () => setDatePickerTarget('expectedCalving'),
                                  accessibilityLabel: t('cattle.add.history.expectedCalving'),
                                }
                              : undefined
                          }
                        />
                        <PressableSurface
                          accessibilityRole="button"
                          accessibilityLabel={t('cattle.add.history.monthOnly')}
                          pressedStyle="overlay"
                          onPress={() => {
                            const next = !expectedMonthMode;
                            setExpectedMonthMode(next);
                            if (historyValues.expectedCalvingDate) {
                              setHistoryValues((prev) => ({
                                ...prev,
                                expectedCalvingDate: next ? prev.expectedCalvingDate?.slice(0, 7) : `${prev.expectedCalvingDate?.slice(0, 7)}-15`,
                              }));
                            }
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                        >
                          <Glyph name={expectedMonthMode ? 'check' : 'dot'} size={16} color={expectedMonthMode ? 'primary' : 'mutedForeground'} />
                          <Text role="caption" color="mutedForeground">
                            {t('cattle.add.history.monthOnly')}
                          </Text>
                        </PressableSurface>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* 3. Last AI / Service */}
                <View
                  style={{
                    padding: tokens.spacing.md,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: tokens.spacing.md,
                  }}
                >
                  <View style={{ gap: tokens.spacing.xs }}>
                    <TextField
                      label={t('cattle.add.history.lastService')}
                      value={historyValues.lastBreedingDate ?? ''}
                      onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, lastBreedingDate: val || undefined }))}
                      placeholder={breedingMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                      optional
                      trailingAction={
                        !breedingMonthMode
                          ? {
                              icon: <CalendarIcon size={18} color={colors.primary} />,
                              onPress: () => setDatePickerTarget('lastBreeding'),
                              accessibilityLabel: t('cattle.add.history.lastService'),
                            }
                          : undefined
                      }
                    />
                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel={t('cattle.add.history.monthOnly')}
                      pressedStyle="overlay"
                      onPress={() => {
                        const next = !breedingMonthMode;
                        setBreedingMonthMode(next);
                        if (historyValues.lastBreedingDate) {
                          setHistoryValues((prev) => ({
                            ...prev,
                            lastBreedingDate: next ? prev.lastBreedingDate?.slice(0, 7) : `${prev.lastBreedingDate?.slice(0, 7)}-15`,
                          }));
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                    >
                      <Glyph name={breedingMonthMode ? 'check' : 'dot'} size={16} color={breedingMonthMode ? 'primary' : 'mutedForeground'} />
                      <Text role="caption" color="mutedForeground">
                        {t('cattle.add.history.monthOnly')}
                      </Text>
                    </PressableSurface>
                  </View>

                  {/* Sub-section if breeding date entered */}
                  {historyValues.lastBreedingDate ? (
                    <View
                      style={{
                        borderLeftWidth: 2,
                        borderLeftColor: colors.primaryEdge,
                        paddingLeft: tokens.spacing.md,
                        gap: tokens.spacing.md,
                      }}
                    >
                      {/* Service Method */}
                      <View style={{ gap: tokens.spacing.xs }}>
                        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                          {t('cattle.add.history.serviceMethod')}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
                          {(
                            [
                              { key: 'AI', labelKey: 'methodAi' },
                              { key: 'NATURAL', labelKey: 'methodNatural' },
                              { key: 'EMBRYO_TRANSFER', labelKey: 'methodEmbryo' },
                            ] as const
                          ).map((m) => {
                            const isSelected = (historyValues.breedingMethod ?? 'AI') === m.key;
                            return (
                              <PressableSurface
                                key={m.key}
                                accessibilityRole="button"
                                accessibilityLabel={t(`cattle.add.history.${m.labelKey}`)}
                                pressedStyle="overlay"
                                onPress={() => setHistoryValues((prev) => ({ ...prev, breedingMethod: m.key as BreedingMethod }))}
                                style={{
                                  minHeight: tokens.touchTarget.min,
                                  paddingHorizontal: tokens.spacing.md,
                                  paddingVertical: tokens.spacing.xs,
                                  borderRadius: tokens.radius.md,
                                  borderWidth: 1,
                                  borderColor: isSelected ? colors.primaryEdge : colors.border,
                                  backgroundColor: isSelected ? colors.primary : colors.card,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text
                                  role="caption"
                                  color={isSelected ? 'primaryForeground' : 'foreground'}
                                  style={{ fontWeight: isSelected ? '700' : '500' }}
                                >
                                  {t(`cattle.add.history.${m.labelKey}`)}
                                </Text>
                              </PressableSurface>
                            );
                          })}
                        </View>
                      </View>

                      {/* Bull */}
                      <TextField
                        label={t('cattle.add.history.bull')}
                        value={historyValues.bull ?? ''}
                        onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, bull: val || undefined }))}
                        placeholder={t('cattle.add.history.bullPlaceholder')}
                        optional
                      />
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {/* 4. Last Vaccination (Both Female and Male) */}
            <View
              style={{
                padding: tokens.spacing.md,
                borderRadius: tokens.radius.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: tokens.spacing.md,
              }}
            >
              <View style={{ gap: tokens.spacing.xs }}>
                <TextField
                  label={t('cattle.add.history.lastVaccination')}
                  value={historyValues.lastVaccinationDate ?? ''}
                  onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, lastVaccinationDate: val || undefined }))}
                  placeholder={vaccinationMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'}
                  optional
                  trailingAction={
                    !vaccinationMonthMode
                      ? {
                          icon: <CalendarIcon size={18} color={colors.primary} />,
                          onPress: () => setDatePickerTarget('lastVaccination'),
                          accessibilityLabel: t('cattle.add.history.lastVaccination'),
                        }
                      : undefined
                  }
                />
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('cattle.add.history.monthOnly')}
                  pressedStyle="overlay"
                  onPress={() => {
                    const next = !vaccinationMonthMode;
                    setVaccinationMonthMode(next);
                    if (historyValues.lastVaccinationDate) {
                      setHistoryValues((prev) => ({
                        ...prev,
                        lastVaccinationDate: next ? prev.lastVaccinationDate?.slice(0, 7) : `${prev.lastVaccinationDate?.slice(0, 7)}-15`,
                      }));
                    }
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                >
                  <Glyph name={vaccinationMonthMode ? 'check' : 'dot'} size={16} color={vaccinationMonthMode ? 'primary' : 'mutedForeground'} />
                  <Text role="caption" color="mutedForeground">
                    {t('cattle.add.history.monthOnly')}
                  </Text>
                </PressableSurface>
              </View>

              {historyValues.lastVaccinationDate ? (
                <View
                  style={{
                    borderLeftWidth: 2,
                    borderLeftColor: colors.primaryEdge,
                    paddingLeft: tokens.spacing.md,
                  }}
                >
                  <TextField
                    label={t('cattle.add.history.vaccineProduct')}
                    value={historyValues.vaccineProduct ?? ''}
                    onChangeText={(val) => setHistoryValues((prev) => ({ ...prev, vaccineProduct: val || undefined }))}
                    placeholder={t('cattle.add.history.vaccinePlaceholder')}
                    optional
                  />
                </View>
              ) : null}
            </View>

            {/* 5. "WE WILL SET UP" DYNAMIC PREVIEW BOX */}
            <View
              style={{
                padding: tokens.spacing.md,
                borderRadius: tokens.radius.md,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                gap: tokens.spacing.xs,
              }}
              testID="add-animal-history-preview"
            >
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', letterSpacing: 0.8 }}>
                {t('cattle.add.history.previewTitle')}
              </Text>

              {previewList.length === 0 ? (
                <Text role="body" color="mutedForeground">
                  {t('cattle.add.history.previewEmpty')}
                </Text>
              ) : (
                <View style={{ gap: 6, marginTop: 4 }}>
                  {previewList.map((item, idx) => {
                    let textMsg = '';
                    switch (item.kind) {
                      case 'calving':
                        textMsg = t('cattle.add.history.previewCalving', { date: item.date ?? '' });
                        break;
                      case 'milking':
                        textMsg = t('cattle.add.history.previewMilking', { date: item.date ?? '' });
                        break;
                      case 'dry':
                        textMsg = t('cattle.add.history.previewDry', { date: item.date ?? '' });
                        break;
                      case 'service':
                        textMsg = t('cattle.add.history.previewService', { date: item.date ?? '' });
                        break;
                      case 'pregnant':
                        textMsg = t('cattle.add.history.previewPregnant', { date: item.date ?? '' });
                        break;
                      case 'reminderDryOff':
                        textMsg = t('cattle.add.history.previewDryOff', { date: item.date ?? '' });
                        break;
                      case 'reminderPregCheck':
                        textMsg = t('cattle.add.history.previewPregCheck', { date: item.date ?? '' });
                        break;
                      case 'vaccination':
                        textMsg = t('cattle.add.history.previewVaccination', { date: item.date ?? '' });
                        break;
                    }
                    return (
                      <View key={`${item.kind}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Glyph name="dot" size={16} color="primary" />
                        <Text role="body" color="foreground" style={{ fontSize: 13 }}>
                          {textMsg}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 3. PINNED STICKY FOOTER */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
          gap: tokens.spacing.xs,
        }}
      >
        {step === 'basic' ? (
          <View style={{ gap: tokens.spacing.xs }}>
            {/* Primary Action: Full Width */}
            <Button
              label={gender === 'FEMALE' ? t('cattle.add.nextFemale') : t('cattle.add.nextMale')}
              variant="primary"
              size="md"
              fullWidth
              onPress={handleNextStep}
              disabled={submitting}
              testID="add-animal-next-btn"
            />

            {/* Secondary Actions: Clean 50/50 Row */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('cattle.add.cancel')}
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={handleClose}
                  disabled={submitting}
                  testID="add-animal-cancel-btn"
                />
              </View>

              <View style={{ flex: 1.5 }}>
                <Button
                  label={t('cattle.add.saveWithout')}
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={() => void handleSave(false)}
                  disabled={submitting}
                  testID="add-animal-save-without-history-btn"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.xs }}>
            {/* Primary Action: Full Width */}
            <Button
              label={submitting ? t('cattle.add.submitting') : t('cattle.add.history.save')}
              variant="primary"
              size="md"
              fullWidth
              onPress={() => void handleSave(true)}
              disabled={submitting}
              testID="add-animal-history-save-btn"
            />

            {/* Secondary Actions: Clean 50/50 Row */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('cattle.add.history.back')}
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={() => setStep('basic')}
                  disabled={submitting}
                  testID="add-animal-history-back-btn"
                />
              </View>

              <View style={{ flex: 1.5 }}>
                <Button
                  label={t('cattle.add.history.skip')}
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={() => void handleSave(false)}
                  disabled={submitting}
                  testID="add-animal-history-skip-btn"
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* DatePickerSheet for Date Inputs */}
      {datePickerTarget !== null ? (
        <DatePickerSheet
          visible={datePickerTarget !== null}
          mode="single"
          onClose={() => setDatePickerTarget(null)}
          onConfirmSingle={(selected) => {
            if (selected) {
              switch (datePickerTarget) {
                case 'dob':
                  setDob(selected);
                  break;
                case 'lastCalving':
                  setHistoryValues((prev) => ({ ...prev, lastCalvingDate: selected }));
                  break;
                case 'milkingSince':
                  setHistoryValues((prev) => ({ ...prev, milkingSince: selected }));
                  break;
                case 'drySince':
                  setHistoryValues((prev) => ({ ...prev, drySince: selected }));
                  break;
                case 'expectedCalving':
                  setHistoryValues((prev) => ({ ...prev, expectedCalvingDate: selected }));
                  break;
                case 'lastBreeding':
                  setHistoryValues((prev) => ({ ...prev, lastBreedingDate: selected }));
                  break;
                case 'lastVaccination':
                  setHistoryValues((prev) => ({ ...prev, lastVaccinationDate: selected }));
                  break;
              }
            }
            setDatePickerTarget(null);
          }}
        />
      ) : null}
    </SheetModal>
  );
}
