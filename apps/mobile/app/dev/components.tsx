/**
 * Dev-only WP3 component matrix (spec section 6): every built component in every variant and state, so a person
 * or Verity can check them on a device. Same __DEV__ gate as gallery.tsx: outside dev this redirects home. Section
 * and variant labels are English on purpose (developer tooling, not product copy). Real pressed states are
 * checked by pressing; there is no forced "pressed" prop.
 */
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, type ButtonSize, type ButtonVariant } from '../../src/components/actions/Button.tsx';
import { IconButton } from '../../src/components/actions/IconButton.tsx';
import { Card } from '../../src/components/display/Card.tsx';
import { ListRow } from '../../src/components/display/ListRow.tsx';
import { Skeleton, SkeletonList } from '../../src/components/display/Skeleton.tsx';
import {
  StatusBadge,
  type HerdState,
  type StatusTone,
} from '../../src/components/display/StatusBadge.tsx';
import { ConfirmSheet } from '../../src/components/feedback/ConfirmSheet.tsx';
import { EmptyState, ErrorState, type ErrorKind } from '../../src/components/feedback/StateMessage.tsx';
import { useToast } from '../../src/components/feedback/Toast.tsx';
import { Chip, ChipGroup } from '../../src/components/forms/Chip.tsx';
import { StepperField } from '../../src/components/forms/StepperField.tsx';
import { TextField } from '../../src/components/forms/TextField.tsx';
import { Heading, Text } from '../../src/components/primitives/Text.tsx';
import { TextScaleProvider } from '../../src/components/primitives/TextScaleContext.tsx';
import { FontScaleChoice, LocaleChoice, ThemeChoice } from '../../src/dev/GalleryControls.tsx';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';

export default function ComponentsRoute() {
  // Checked at render time (not module load) so tests can flip __DEV__.
  if (!__DEV__) return <Redirect href="/" />;
  return <Components />;
}

const BN_LONG = 'দুগ্ধ উৎপাদন ক্ষমতা যাচাই করে সংরক্ষণ করুন এবং পরবর্তী গরুতে যান';
const BN_CONJUNCT = 'দুগ্ধ উৎপাদন';
const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'destructive', 'ghost'];
const SIZES: readonly ButtonSize[] = ['md', 'lg'];
const TONES: readonly StatusTone[] = ['success', 'warning', 'destructive', 'info', 'neutral'];
const HERD: readonly HerdState[] = ['fresh', 'insemination', 'dry', 'milking', 'pregnant', 'sick'];
const ERROR_KINDS: readonly ErrorKind[] = ['generic', 'network', 'server', 'session'];

function Demo({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Card padding="lg" testID={`demo-${title}`}>
      <View style={{ gap: tokens.spacing.md }}>
        <Heading role="h2">{title}</Heading>
        {children}
      </View>
    </Card>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text role="caption" color="mutedForeground">
      {children}
    </Text>
  );
}

function Stack({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  return <View style={{ gap: tokens.spacing.sm }}>{children}</View>;
}

function Row({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>{children}</View>;
}

const noop = (): void => {};

function ButtonMatrix() {
  return (
    <Demo title="Button">
      {VARIANTS.map((variant) =>
        SIZES.map((size) => (
          <Stack key={`${variant}-${size}`}>
            <Label>{`${variant} / ${size}`}</Label>
            <Row>
              <Button label="Default" variant={variant} size={size} onPress={noop} />
              <Button label="Disabled" variant={variant} size={size} onPress={noop} disabled />
              <Button label="Loading" variant={variant} size={size} onPress={noop} loading />
            </Row>
          </Stack>
        )),
      )}
      <Stack>
        <Label>long Bangla label (wraps)</Label>
        <Button label={BN_LONG} onPress={noop} />
      </Stack>
      <Stack>
        <Label>leading icon</Label>
        <Button label="Add animal" variant="secondary" leadingIcon="plus" onPress={noop} />
      </Stack>
      <Stack>
        <Label>full width</Label>
        <Button label="Save" fullWidth onPress={noop} />
      </Stack>
    </Demo>
  );
}

function IconButtonMatrix() {
  return (
    <Demo title="IconButton">
      {(['primary', 'secondary', 'ghost'] as const).map((variant) => (
        <Stack key={variant}>
          <Label>{variant}</Label>
          <Row>
            {SIZES.map((size) => (
              <IconButton
                key={size}
                icon="plus"
                accessibilityLabel={`Add ${variant} ${size}`}
                variant={variant}
                size={size}
                onPress={noop}
              />
            ))}
            <IconButton icon="close" accessibilityLabel={`Close ${variant} disabled`} variant={variant} disabled onPress={noop} />
            <IconButton icon="check" accessibilityLabel={`Confirm ${variant} loading`} variant={variant} loading onPress={noop} />
          </Row>
        </Stack>
      ))}
    </Demo>
  );
}

function CardDemo() {
  return (
    <Demo title="Card">
      {(['none', 'md', 'lg'] as const).map((padding) => (
        <Card key={padding} padding={padding}>
          <Text>{`padding ${padding}`}</Text>
        </Card>
      ))}
    </Demo>
  );
}

function StatusBadgeMatrix() {
  return (
    <Demo title="StatusBadge">
      <Label>tones</Label>
      <Row>
        {TONES.map((tone) => (
          <StatusBadge key={tone} tone={tone} label={tone} />
        ))}
      </Row>
      <Label>herd states</Label>
      <Row>
        {HERD.map((herdState) => (
          <StatusBadge key={herdState} herdState={herdState} label={herdState} />
        ))}
      </Row>
      <Label>long label wraps</Label>
      <StatusBadge tone="warning" label="Withdrawal period ends in three days, do not sell milk" />
      <StatusBadge herdState="milking" label={BN_LONG} />
    </Demo>
  );
}

function SkeletonDemo() {
  return (
    <Demo title="Skeleton">
      <Label>single blocks</Label>
      <Skeleton height={16} width="60%" />
      <Skeleton height={48} />
      <Label>SkeletonList row x3</Label>
      <SkeletonList rows={3} />
      <Label>SkeletonList card x2</Label>
      <SkeletonList rows={2} variant="card" />
    </Demo>
  );
}

function TextFieldMatrix() {
  const [values, setValues] = useState<Record<string, string>>({ error: 'abc', unit: '12.5', bangla: BN_CONJUNCT });
  const bind = (key: string) => ({
    value: values[key] ?? '',
    onChangeText: (text: string) => setValues((prev) => ({ ...prev, [key]: text })),
  });
  return (
    <Demo title="TextField">
      <TextField label="Default" placeholder="Placeholder" {...bind('default')} />
      <TextField label="With hint" hint="Shown below the field" {...bind('hint')} />
      <TextField label="Error" error="This value is required" {...bind('error')} />
      <TextField label="Unit suffix" unit="L" keyboardType="decimal-pad" {...bind('unit')} />
      <TextField label="Disabled" disabled {...bind('disabled')} />
      <TextField label="Multiline" multiline {...bind('multiline')} />
      <TextField label="Optional" optional {...bind('optional')} />
      <TextField label="Bangla (conjuncts)" {...bind('bangla')} />
    </Demo>
  );
}

function StepperMatrix() {
  const [empty, setEmpty] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(12.5);
  const [atMin, setAtMin] = useState<number | null>(0);
  const [atMax, setAtMax] = useState<number | null>(20);
  const [bad, setBad] = useState<number | null>(null);
  const [bangla, setBangla] = useState<number | null>(8.5);
  const { setDigits } = useLocale();
  return (
    <Demo title="StepperField">
      <StepperField label="Empty with ghost value" value={empty} onChange={setEmpty} placeholderValue={12.5} unit="L" />
      <StepperField label="With value" value={value} onChange={setValue} unit="L" hint="Last: 12.5 L" />
      <StepperField label="At min (0)" value={atMin} onChange={setAtMin} unit="L" />
      <StepperField label="At max (20)" value={atMax} onChange={setAtMax} max={20} unit="L" />
      <StepperField label="Error" value={bad} onChange={setBad} error="Enter a quantity" unit="L" />
      <StepperField label="Bangla digits" value={bangla} onChange={setBangla} unit="L" />
      <Button label="Use Bangla digits" variant="secondary" onPress={() => setDigits('beng')} />
    </Demo>
  );
}

function ChipDemo() {
  const [session, setSession] = useState('morning');
  const [many, setMany] = useState('c1');
  return (
    <Demo title="Chip / ChipGroup">
      <ChipGroup accessibilityLabel="Session">
        <Chip label="Morning" accentColor="sessionMorning" selected={session === 'morning'} onPress={() => setSession('morning')} />
        <Chip label="Noon" accentColor="sessionNoon" selected={session === 'noon'} onPress={() => setSession('noon')} />
        <Chip label="Evening" accentColor="sessionEvening" selected={session === 'evening'} onPress={() => setSession('evening')} />
      </ChipGroup>
      <Label>wrapping row of 6, one disabled</Label>
      <ChipGroup accessibilityLabel="Many chips">
        {['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id, index) => (
          <Chip
            key={id}
            label={index === 2 ? BN_CONJUNCT : `Option ${index + 1}`}
            selected={many === id}
            disabled={index === 5}
            onPress={() => setMany(id)}
          />
        ))}
      </ChipGroup>
    </Demo>
  );
}

function ListRowDemo() {
  return (
    <Demo title="ListRow">
      <Card padding="none">
        <ListRow title="One line" onPress={noop} />
        <ListRow
          title="Two lines with leading and trailing"
          subtitle="Subtitle text"
          leading={<StatusBadge herdState="milking" label="Milking" />}
          trailing={<Text>12.5 L</Text>}
          showChevron
          onPress={noop}
        />
        <ListRow title="Selected" subtitle="Selected row" selected onPress={noop} />
        <ListRow title="Disabled" subtitle="Cannot be pressed" disabled onPress={noop} />
        <ListRow title={BN_LONG} subtitle={BN_CONJUNCT} divider={false} onPress={noop} />
      </Card>
    </Demo>
  );
}

function StateDemo() {
  return (
    <Demo title="EmptyState / ErrorState">
      <Label>EmptyState</Label>
      <EmptyState title="No animals yet" description="Add your first animal to start." action={{ label: 'Add animal', onPress: noop }} />
      {ERROR_KINDS.map((kind) => (
        <Stack key={kind}>
          <Label>{`ErrorState ${kind}`}</Label>
          <ErrorState kind={kind} onRetry={noop} />
        </Stack>
      ))}
      <Label>ErrorState retrying</Label>
      <ErrorState kind="network" onRetry={noop} retrying />
    </Demo>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <Demo title="Toast">
      <Row>
        <Button label="Success" variant="secondary" onPress={() => toast.show({ message: 'Saved' })} testID="toast-trigger-success" />
        <Button
          label="Error"
          variant="secondary"
          testID="toast-trigger-error"
          onPress={() => toast.show({ message: 'Could not save', tone: 'error' })}
        />
        <Button
          label="With Undo"
          variant="secondary"
          testID="toast-trigger-undo"
          onPress={() => toast.show({ message: 'Entry saved', action: { label: 'Undo', onPress: noop } })}
        />
        <Button label="Persistent" variant="secondary" onPress={() => toast.show({ message: 'Stays until closed', durationMs: 0 })} testID="toast-trigger-persistent" />
        <Button
          label="bottomOffset 96"
          variant="secondary"
          onPress={() => toast.show({ message: 'Clears a 96dp bar', bottomOffset: 96 })}
        />
      </Row>
    </Demo>
  );
}

type SheetKind = 'default' | 'destructive' | 'loading' | null;

function ConfirmDemo() {
  const [open, setOpen] = useState<SheetKind>(null);
  const [loading, setLoading] = useState(false);
  const close = () => {
    setLoading(false);
    setOpen(null);
  };
  return (
    <Demo title="ConfirmSheet">
      <Row>
        <Button label="Default" variant="secondary" onPress={() => setOpen('default')} testID="confirm-trigger-default" />
        <Button label="Destructive" variant="secondary" onPress={() => setOpen('destructive')} testID="confirm-trigger-destructive" />
        <Button label="Loading simulation" variant="secondary" onPress={() => setOpen('loading')} testID="confirm-trigger-loading" />
      </Row>
      <ConfirmSheet
        visible={open !== null}
        title={open === 'destructive' ? 'Delete this animal?' : 'Save changes?'}
        message="This is the sheet body text."
        confirmLabel={open === 'destructive' ? 'Delete' : 'Save'}
        tone={open === 'destructive' ? 'destructive' : 'default'}
        loading={loading}
        onCancel={close}
        onConfirm={() => {
          if (open === 'loading') {
            setLoading(true);
            setTimeout(close, 1500);
          } else {
            close();
          }
        }}
      />
    </Demo>
  );
}

function Components() {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState<number | null>(null);

  const page = (
    <ScrollView
      testID="components-scroll"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.lg,
        paddingBottom: insets.bottom + tokens.spacing.lg,
        paddingLeft: insets.left + tokens.spacing.lg,
        paddingRight: insets.right + tokens.spacing.lg,
        gap: tokens.spacing.lg,
      }}
    >
      <Heading>Components</Heading>
      <Demo title="Theme">
        <ThemeChoice />
      </Demo>
      <Demo title="Language / digits">
        <LocaleChoice />
      </Demo>
      <Demo title="Font size">
        <FontScaleChoice scale={scale} onScaleChange={setScale} />
      </Demo>
      <ButtonMatrix />
      <IconButtonMatrix />
      <CardDemo />
      <StatusBadgeMatrix />
      <SkeletonDemo />
      <TextFieldMatrix />
      <StepperMatrix />
      <ChipDemo />
      <ListRowDemo />
      <StateDemo />
      <ToastDemo />
      <ConfirmDemo />
    </ScrollView>
  );

  return scale === null ? page : <TextScaleProvider scale={scale}>{page}</TextScaleProvider>;
}
