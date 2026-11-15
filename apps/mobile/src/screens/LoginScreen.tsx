/**
 * Sign-in screen (WP5d): one identifier field (email or username) and a password. Route: `/login`.
 *
 * - Validation before the request: identifier required, password >= 8 (the API's minimum) with inline field errors.
 * - Server failures map to distinct plain messages (wrong credentials / locked, too many tries, no network, server
 *   problem); a session the server ended shows "You were signed out" above the form.
 * - Success needs no navigation code: the AuthGate sees `signedIn` and moves to the farm picker or home.
 * - Language chips on the screen itself: a worker may not have the right language yet when first opening the app.
 */
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Locale } from '@rakhal/domain';
import { Button } from '../components/actions/Button.tsx';
import { Chip, ChipGroup } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Heading, Text } from '../components/primitives/Text.tsx';
import { authErrorMessageKey } from '../auth/auth-errors.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

const MIN_PASSWORD_LENGTH = 8;
const LOCALES: readonly Locale[] = ['bn', 'en'];

export function LoginScreen() {
  const { signIn, expired } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { tokens, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const passwordRef = useRef<TextInputInstance | null>(null);

  async function submit() {
    if (submitting) return;
    const trimmed = identifier.trim();
    const idError = trimmed === '' ? t('auth.error.identifierRequired') : undefined;
    const pwError = password.length < MIN_PASSWORD_LENGTH ? t('auth.error.passwordShort') : undefined;
    setIdentifierError(idError);
    setPasswordError(pwError);
    setFormError(undefined);
    if (idError || pwError) return;

    setSubmitting(true);
    try {
      await signIn(trimmed, password);
    } catch (error) {
      setFormError(t(authErrorMessageKey(error)));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + tokens.spacing.xxl,
          paddingBottom: insets.bottom + tokens.spacing.xxl,
          paddingLeft: insets.left + tokens.spacing.xl,
          paddingRight: insets.right + tokens.spacing.xl,
          gap: tokens.spacing.lg,
        }}
      >
        <ChipGroup accessibilityLabel={t('common.language')}>
          {LOCALES.map((value) => (
            <Chip
              key={value}
              label={t(value === 'bn' ? 'language.bn' : 'language.en')}
              selected={locale === value}
              onPress={() => setLocale(value)}
              testID={`login-language-${value}`}
            />
          ))}
        </ChipGroup>

        <View style={{ gap: tokens.spacing.xs }}>
          <Heading>{t('auth.login.title')}</Heading>
          <Text color="mutedForeground">{t('auth.login.subtitle')}</Text>
        </View>

        {expired ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="login-expired-notice">
            <Text role="label">{t('state.error.session.title')}</Text>
            <Text color="mutedForeground">{t('state.error.session.message')}</Text>
          </View>
        ) : null}

        <TextField
          label={t('auth.field.identifier')}
          value={identifier}
          onChangeText={setIdentifier}
          error={identifierError}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          disabled={submitting}
          testID="login-identifier"
        />

        <View style={{ gap: tokens.spacing.xs }}>
          <TextField
            label={t('auth.field.password')}
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            inputRef={passwordRef}
            disabled={submitting}
            testID="login-password"
          />
          <Button
            label={t(showPassword ? 'auth.password.hide' : 'auth.password.show')}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => setShowPassword((v) => !v)}
            testID="login-toggle-password"
          />
        </View>

        {formError ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="login-form-error">
            <Text color="destructive">{formError}</Text>
          </View>
        ) : null}

        <Button label={t('auth.submit')} onPress={() => void submit()} loading={submitting} testID="login-submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
