import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Chip } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { DatePickerSheet } from '../components/picker/DatePickerSheet.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { CalendarIcon, CheckIcon, ChevronDownIcon, ClockIcon } from './notification-icons.tsx';
import type {
  CreateScheduleInput,
  FarmMemberOption,
  ScheduleAudienceMode,
  ScheduleRepeatType,
} from './notification-types.ts';
import { useNotifications } from './useNotifications.ts';

interface NewTabProps {
  editingScheduleId?: string | null;
  onDone?: () => void;
  onCancel?: () => void;
  testID?: string;
}

interface AnimalOption {
  id: string;
  tagNumber: string;
  name?: string | null;
}

export const NewTab = memo(function NewTab({
  editingScheduleId,
  onDone,
  onCancel,
  testID = 'notification-new-tab',
}: NewTabProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { client, user } = useAuth();
  const { createSchedule, updateSchedule, loadFarmMembers } = useNotifications();

  // Form states
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('09:00');

  const [leadMinutes, setLeadMinutes] = useState<number[]>([0]);

  const [repeat, setRepeat] = useState<ScheduleRepeatType>('NEVER');
  const [intervalDays, setIntervalDays] = useState('7');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  const [audienceMode, setAudienceMode] = useState<ScheduleAudienceMode>('USER');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [selectedAnimals, setSelectedAnimals] = useState<AnimalOption[]>([]);
  const [animalModalOpen, setAnimalModalOpen] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');
  const [availableAnimals, setAvailableAnimals] = useState<AnimalOption[]>([]);

  const [members, setMembers] = useState<FarmMemberOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load farm members and animals
  useEffect(() => {
    void loadFarmMembers().then(setMembers);
    void client
      .get<{ items?: Array<{ id: string; tagNumber: string; name?: string }> }>('/cattle', {
        query: { limit: 100 },
      })
      .then((res) => {
        const d = res.data;
        const list = (d && Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : []) as Array<{
          id: string;
          tagNumber: string;
          name?: string;
        }>;
        setAvailableAnimals(list.map((c) => ({ id: c.id, tagNumber: c.tagNumber, name: c.name })));
      })
      .catch(() => {});
  }, [client, loadFarmMembers]);

  // Handle lead times
  const handleToggleLead = useCallback((minutes: number) => {
    setLeadMinutes((prev) => {
      if (prev.includes(minutes)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((m) => m !== minutes);
      }
      return [...prev, minutes].slice(0, 4);
    });
  }, []);

  // Compute recipient count
  const recipientCount = useMemo(() => {
    if (audienceMode === 'USER') return 1;
    if (audienceMode === 'ROLES') {
      if (selectedRoles.length === 0) return 0;
      return members.filter((m) => m.role && selectedRoles.includes(m.role)).length || selectedRoles.length;
    }
    return selectedUserIds.length;
  }, [audienceMode, selectedRoles, selectedUserIds, members]);

  // Compute dynamic preview string
  const previewSendTime = useMemo(() => {
    if (!date) return null;
    const timeStr = allDay ? '08:00 AM' : `${time}`;
    return `${date}, ${timeStr}`;
  }, [date, allDay, time]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setErrorMsg(t('notif.new.titleLabel') + ' is required');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    const payload: CreateScheduleInput = {
      title: title.trim(),
      body: notes.trim() || undefined,
      trigger: 'DATE',
      date,
      time: allDay ? undefined : time,
      repeat:
        repeat !== 'NEVER'
          ? {
              type: repeat,
              interval: repeat === 'EVERY_N_DAYS' ? parseInt(intervalDays, 10) || 7 : undefined,
              end_date: endDate || undefined,
            }
          : undefined,
      lead_minutes: leadMinutes,
      audience: {
        mode: audienceMode,
        user_id: audienceMode === 'USER' ? user?.id : undefined,
        roles: audienceMode === 'ROLES' ? selectedRoles : undefined,
        user_ids: audienceMode === 'USERS' ? selectedUserIds : undefined,
      },
      animal_ids: selectedAnimals.map((a) => a.id),
    };

    try {
      if (editingScheduleId) {
        await updateSchedule(editingScheduleId, payload);
      } else {
        await createSchedule(payload);
      }
      if (onDone) onDone();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to save notification');
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    notes,
    date,
    allDay,
    time,
    repeat,
    intervalDays,
    endDate,
    leadMinutes,
    audienceMode,
    user?.id,
    selectedRoles,
    selectedUserIds,
    selectedAnimals,
    editingScheduleId,
    updateSchedule,
    createSchedule,
    onDone,
    t,
  ]);

  const filteredAnimals = useMemo(() => {
    const q = animalSearch.trim().toLowerCase();
    if (!q) return availableAnimals;
    return availableAnimals.filter(
      (a) => a.tagNumber.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)),
    );
  }, [availableAnimals, animalSearch]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: tokens.spacing.md,
        paddingVertical: tokens.spacing.sm,
        paddingHorizontal: 4,
        paddingBottom: 60,
      }}
      testID={testID}
    >
      {/* 1. Title Input */}
      <TextField
        label={t('notif.new.titleLabel')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('notif.new.titlePlaceholder')}
        testID="notif-input-title"
      />

      {/* 2. Notes Input */}
      <TextField
        label={t('notif.new.notesLabel')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('notif.new.notesPlaceholder')}
        multiline
        testID="notif-input-notes"
      />

      {/* 3. Date Picker */}
      <View style={{ gap: 4 }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.dateLabel')}
        </Text>
        <PressableSurface
          accessibilityRole="button"
          pressedStyle="overlay"
          onPress={() => setDatePickerOpen(true)}
          testID="notif-date-picker-btn"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.sm,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            minHeight: 48,
          }}
        >
          <Text role="body" color="foreground">
            {date}
          </Text>
          <CalendarIcon size={18} color={colors.primary} />
        </PressableSurface>
      </View>

      {/* 4. Time of Day (At a time vs All day) */}
      <View style={{ gap: tokens.spacing.xs }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.timeOfDayLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: tokens.radius.md,
            padding: 2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setAllDay(false)}
            testID="notif-time-at"
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: !allDay ? colors.card : 'transparent',
              borderWidth: !allDay ? 1 : 0,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 36,
            }}
          >
            <Text
              role="caption"
              color={!allDay ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 13 }}
            >
              {t('notif.new.timeAt')}
            </Text>
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setAllDay(true)}
            testID="notif-time-all-day"
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: allDay ? colors.card : 'transparent',
              borderWidth: allDay ? 1 : 0,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 36,
            }}
          >
            <Text
              role="caption"
              color={allDay ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 13 }}
            >
              {t('notif.new.timeAllDay')}
            </Text>
          </PressableSurface>
        </View>

        {allDay ? (
          <Text role="caption" color="mutedForeground" style={{ fontSize: 12, marginTop: 2 }}>
            {t('notif.new.allDayHint')}
          </Text>
        ) : (
          <View style={{ marginTop: 4, gap: 4 }}>
            <Text role="label" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
              {t('notif.new.timeLabel')}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.sm,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                minHeight: 44,
                gap: 8,
              }}
            >
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, color: colors.foreground, fontSize: 14, fontWeight: '600' }}
                testID="notif-input-time"
              />
              <ClockIcon size={18} color={colors.primary} />
            </View>
          </View>
        )}
      </View>

      {/* 5. Notify Me (Lead time chips) */}
      <View style={{ gap: tokens.spacing.xs }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.notifyMeLabel')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
          <Chip
            label={t('notif.new.leadAtTime')}
            selected={leadMinutes.includes(0)}
            onPress={() => handleToggleLead(0)}
            testID="lead-chip-0"
          />
          {!allDay ? (
            <Chip
              label={t('notif.new.leadOneHour')}
              selected={leadMinutes.includes(60)}
              onPress={() => handleToggleLead(60)}
              testID="lead-chip-60"
            />
          ) : null}
          <Chip
            label={t('notif.new.leadOneDay')}
            selected={leadMinutes.includes(1440)}
            onPress={() => handleToggleLead(1440)}
            testID="lead-chip-1440"
          />
          <Chip
            label={t('notif.new.leadOneWeek')}
            selected={leadMinutes.includes(10080)}
            onPress={() => handleToggleLead(10080)}
            testID="lead-chip-10080"
          />
        </View>
      </View>

      {/* 6. Repeat */}
      <View style={{ gap: tokens.spacing.xs }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.repeatLabel')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
          {(['NEVER', 'EVERY_N_DAYS', 'WEEKLY', 'MONTHLY'] as const).map((rep) => (
            <Chip
              key={rep}
              label={
                rep === 'NEVER'
                  ? t('notif.new.repeat.never')
                  : rep === 'EVERY_N_DAYS'
                    ? t('notif.new.repeat.everyN')
                    : rep === 'WEEKLY'
                      ? t('notif.new.repeat.weekly')
                      : t('notif.new.repeat.monthly')
              }
              selected={repeat === rep}
              onPress={() => setRepeat(rep)}
              testID={`repeat-chip-${rep}`}
            />
          ))}
        </View>

        {repeat === 'EVERY_N_DAYS' ? (
          <View style={{ marginTop: 4 }}>
            <TextField
              label={t('notif.new.intervalDaysLabel')}
              value={intervalDays}
              onChangeText={setIntervalDays}
              keyboardType="numeric"
              testID="notif-input-interval"
            />
          </View>
        ) : null}

        {repeat !== 'NEVER' ? (
          <View style={{ marginTop: 4, gap: 4 }}>
            <Text role="label" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
              {t('notif.new.stopRepeatingOn')}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.sm,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                minHeight: 48,
              }}
            >
              <PressableSurface
                accessibilityRole="button"
                pressedStyle="overlay"
                onPress={() => setEndDatePickerOpen(true)}
                style={{ flex: 1 }}
              >
                <Text role="body" color={endDate ? 'foreground' : 'mutedForeground'}>
                  {endDate || '—'}
                </Text>
              </PressableSurface>
              {endDate ? (
                <PressableSurface
                  accessibilityRole="button"
                  pressedStyle="overlay"
                  onPress={() => setEndDate(null)}
                  style={{ padding: 4 }}
                >
                  <Glyph name="close" size={16} color="mutedForeground" />
                </PressableSurface>
              ) : (
                <CalendarIcon size={18} color={colors.primary} />
              )}
            </View>
          </View>
        ) : null}
      </View>

      {/* 7. Who Gets It (Audience) */}
      <View style={{ gap: tokens.spacing.xs }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.whoGetsItLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: tokens.radius.md,
            padding: 2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {(['USER', 'ROLES', 'USERS'] as const).map((mode) => (
            <PressableSurface
              key={mode}
              accessibilityRole="button"
              pressedStyle="overlay"
              onPress={() => setAudienceMode(mode)}
              testID={`audience-mode-${mode}`}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: tokens.radius.md - 2,
                backgroundColor: audienceMode === mode ? colors.card : 'transparent',
                borderWidth: audienceMode === mode ? 1 : 0,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 36,
              }}
            >
              <Text
                role="caption"
                color={audienceMode === mode ? 'primary' : 'mutedForeground'}
                style={{ fontWeight: '700', fontSize: 13 }}
              >
                {mode === 'USER'
                  ? t('notif.new.audience.me')
                  : mode === 'ROLES'
                    ? t('notif.new.audience.roles')
                    : t('notif.new.audience.people')}
              </Text>
            </PressableSurface>
          ))}
        </View>

        {audienceMode === 'USER' ? (
          <Text role="caption" color="mutedForeground" style={{ fontSize: 12, marginTop: 2 }}>
            {t('notif.new.onlyYou')}
          </Text>
        ) : audienceMode === 'ROLES' ? (
          <View style={{ gap: tokens.spacing.xs, marginTop: 4 }}>
            {(['Owner', 'Manager', 'Worker'] as const).map((r) => {
              const selected = selectedRoles.includes(r);
              return (
                <PressableSurface
                  key={r}
                  accessibilityRole="checkbox"
                  pressedStyle="overlay"
                  onPress={() => {
                    setSelectedRoles((prev) =>
                      prev.includes(r) ? prev.filter((role) => role !== r) : [...prev, r],
                    );
                  }}
                  testID={`role-check-${r}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    minHeight: 44,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.inputBorder,
                      backgroundColor: selected ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? <CheckIcon size={12} color={colors.primaryForeground} /> : null}
                  </View>
                  <Text role="body" color="foreground" style={{ fontWeight: '600', fontSize: 13 }}>
                    {r === 'Owner'
                      ? t('notif.new.roles.owner')
                      : r === 'Manager'
                        ? t('notif.new.roles.manager')
                        : t('notif.new.roles.worker')}
                  </Text>
                </PressableSurface>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.xs, marginTop: 4 }}>
            {members.length === 0 ? (
              <Text role="caption" color="mutedForeground">
                Loading members...
              </Text>
            ) : (
              members.map((mem) => {
                const selected = selectedUserIds.includes(mem.id);
                return (
                  <PressableSurface
                    key={mem.id}
                    accessibilityRole="checkbox"
                    pressedStyle="overlay"
                    onPress={() => {
                      setSelectedUserIds((prev) =>
                        prev.includes(mem.id) ? prev.filter((id) => id !== mem.id) : [...prev, mem.id],
                      );
                    }}
                    testID={`people-check-${mem.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: tokens.spacing.sm,
                      paddingHorizontal: tokens.spacing.md,
                      paddingVertical: tokens.spacing.sm,
                      borderRadius: tokens.radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      minHeight: 44,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.inputBorder,
                        backgroundColor: selected ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected ? <CheckIcon size={12} color={colors.primaryForeground} /> : null}
                    </View>
                    <Text role="body" color="foreground" style={{ fontWeight: '600', fontSize: 13 }}>
                      {mem.name}
                    </Text>
                  </PressableSurface>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* 8. Animals (Optional) */}
      <View style={{ gap: tokens.spacing.xs }}>
        <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
          {t('notif.new.animalsLabel')}
        </Text>
        <PressableSurface
          accessibilityRole="button"
          pressedStyle="overlay"
          onPress={() => setAnimalModalOpen(true)}
          testID="notif-animal-picker-btn"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.sm,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            minHeight: 48,
          }}
        >
          <Text role="body" color="mutedForeground">
            {t('notif.new.animalsPlaceholder')}
          </Text>
          <ChevronDownIcon size={16} color={colors.mutedForeground} />
        </PressableSurface>

        {selectedAnimals.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {selectedAnimals.map((animal) => (
              <View
                key={animal.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {animal.tagNumber} {animal.name ? `(${animal.name})` : ''}
                </Text>
                <PressableSurface
                  accessibilityRole="button"
                  pressedStyle="overlay"
                  onPress={() => setSelectedAnimals((prev) => prev.filter((a) => a.id !== animal.id))}
                  style={{ padding: 2 }}
                >
                  <Glyph name="close" size={16} color="mutedForeground" />
                </PressableSurface>
              </View>
            ))}
          </View>
        ) : (
          <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
            {t('notif.new.animalsNone')}
          </Text>
        )}
      </View>

      {/* 9. Dynamic Preview Card */}
      <View
        testID="notif-preview-card"
        style={{
          backgroundColor: colors.muted,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: tokens.spacing.md,
          gap: 4,
        }}
      >
        <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', fontSize: 12 }}>
          {t('notif.new.previewTitle')}
        </Text>
        {previewSendTime ? (
          <>
            <Text role="body" color="foreground" style={{ fontWeight: '700', fontSize: 15 }}>
              {previewSendTime}
            </Text>
            <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
              {t('notif.new.recipientsText', { count: String(recipientCount) })}
            </Text>
          </>
        ) : (
          <Text role="caption" color="mutedForeground">
            {t('notif.new.previewIdle')}
          </Text>
        )}
      </View>

      {errorMsg ? (
        <Text role="caption" color="destructive" style={{ fontWeight: '600' }}>
          {errorMsg}
        </Text>
      ) : null}

      {/* 10. Action Buttons */}
      <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
        <Button
          label={
            submitting
              ? t('notif.new.submitting')
              : editingScheduleId
                ? t('notif.new.submitSave')
                : t('notif.new.submitCreate')
          }
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          disabled={submitting}
          testID="notif-submit-btn"
        />

        {editingScheduleId && onCancel ? (
          <Button label={t('common.cancel')} variant="secondary" size="md" onPress={onCancel} />
        ) : null}
      </View>

      {/* Date Pickers */}
      <DatePickerSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        mode="single"
        value={date}
        onConfirmSingle={(d) => {
          if (d) setDate(d);
          setDatePickerOpen(false);
        }}
      />

      <DatePickerSheet
        visible={endDatePickerOpen}
        onClose={() => setEndDatePickerOpen(false)}
        mode="single"
        value={endDate || date}
        onConfirmSingle={(d) => {
          setEndDate(d);
          setEndDatePickerOpen(false);
        }}
      />

      {/* Animal Search Bottom Sheet */}
      <SheetModal
        visible={animalModalOpen}
        onRequestClose={() => setAnimalModalOpen(false)}
        heightFraction={0.75}
        scrollable={false}
        testID="notif-animal-sheet"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: tokens.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: tokens.spacing.xs,
          }}
        >
          <SheetTitle>
            {t('notif.new.animalsLabel')}
          </SheetTitle>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={() => setAnimalModalOpen(false)}
          />
        </View>

        {/* Search Input */}
        <View style={{ paddingVertical: 2 }}>
          <TextField
            label=""
            value={animalSearch}
            onChangeText={setAnimalSearch}
            placeholder={t('notif.new.animalsPlaceholder')}
          />
        </View>

        {/* Scrollable Animal List */}
        <ScrollView
          style={{ flex: 1, marginTop: tokens.spacing.xs }}
          contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: tokens.spacing.sm }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredAnimals.map((animal) => {
            const selected = selectedAnimals.some((a) => a.id === animal.id);
            return (
              <PressableSurface
                key={animal.id}
                accessibilityRole="button"
                pressedStyle="overlay"
                onPress={() => {
                  setSelectedAnimals((prev) =>
                    selected ? prev.filter((a) => a.id !== animal.id) : [...prev, animal],
                  );
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.md,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  marginBottom: 6,
                }}
              >
                <View>
                  <Text role="body" color="foreground" style={{ fontWeight: '700' }}>
                    {animal.tagNumber}
                  </Text>
                  {animal.name ? (
                    <Text role="caption" color="mutedForeground">
                      {animal.name}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.inputBorder,
                    backgroundColor: selected ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? <CheckIcon size={12} color={colors.primaryForeground} /> : null}
                </View>
              </PressableSurface>
            );
          })}
        </ScrollView>

        {/* Close / Done Button */}
        <View style={{ paddingTop: tokens.spacing.sm }}>
          <Button
            label={t('common.close')}
            variant="primary"
            size="lg"
            onPress={() => setAnimalModalOpen(false)}
          />
        </View>
      </SheetModal>
    </ScrollView>
  );
});
