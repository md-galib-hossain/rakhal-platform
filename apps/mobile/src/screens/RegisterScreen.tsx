/**
 * Native registration screen (WP5 / AUTH1). Route: `/register`.
 *
 * - Full name, email, and password (min 8 chars) inputs with field validation.
 * - Password visibility toggle via inline EyeIcon / EyeOffIcon.
 * - Submits directly to backend `POST /auth/register` without session credentials.
 * - On success: auto-signs in with `signIn(email, password)` and transitions to `/farm`.
 * - Pre-auth language switcher (bn / en).
 * - Zero shadows (ADR-007 compliant).
 */
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, NetworkError } from '@rakhal/api-client';
import type { Locale } from '@rakhal/domain';
import { EyeIcon } from '../assets/icons/EyeIcon.tsx';
import { EyeOffIcon } from '../assets/icons/EyeOffIcon.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Chip, ChipGroup } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Heading, Text } from '../components/primitives/Text.tsx';
import { useAuth } from '../auth/AuthProvider.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

const LOCALES: readonly Locale[] = ['bn', 'en'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function registerErrorMessageKey(error: unknown): MessageKey {
  if (error instanceof NetworkError) return 'auth.error.network';
  if (error instanceof ApiError) {
    if (error.status === 409) return 'auth.error.emailTaken';
    if (error.status === 429) return 'auth.error.rateLimited';
    if (error.status >= 500) return 'auth.error.server';
  }
  return 'auth.error.server';
}

export function RegisterScreen() {
  const { client, signIn } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { tokens, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [nameError, setNameError] = useState<MessageKey | undefined>();
  const [emailError, setEmailError] = useState<MessageKey | undefined>();
  const [passwordError, setPasswordError] = useState<MessageKey | undefined>();
  const [formError, setFormError] = useState<MessageKey | undefined>();

  const emailRef = useRef<TextInputInstance | null>(null);
  const passwordRef = useRef<TextInputInstance | null>(null);

  async function submit() {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    let hasError = false;

    if (trimmedName === '') {
      setNameError('auth.error.nameRequired');
      hasError = true;
    } else {
      setNameError(undefined);
    }

    if (trimmedEmail === '') {
      setEmailError('auth.error.emailRequired');
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('auth.error.emailInvalid');
      hasError = true;
    } else {
      setEmailError(undefined);
    }

    if (password.length < 8) {
      setPasswordError('auth.error.passwordShort');
      hasError = true;
    } else {
      setPasswordError(undefined);
    }

    if (hasError) return;

    setFormError(undefined);
    setSubmitting(true);

    try {
      await client.post('/auth/register', { name: trimmedName, email: trimmedEmail, password }, { auth: false });

      // Automatically sign in upon successful registration
      try {
        await signIn(trimmedEmail, password);
        router.replace('/farm');
      } catch {
        router.replace('/login');
      }
    } catch (error) {
      setFormError(registerErrorMessageKey(error));
    } finally {
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
          justifyContent: 'center',
          paddingTop: insets.top + tokens.spacing.xl,
          paddingBottom: insets.bottom + tokens.spacing.xl,
          paddingLeft: insets.left + tokens.spacing.xl,
          paddingRight: insets.right + tokens.spacing.xl,
          gap: tokens.spacing.lg,
        }}
      >
        <View style={{ alignItems: 'flex-end' }}>
          <ChipGroup accessibilityLabel="Choose language">
            {LOCALES.map((code) => (
              <Chip
                key={code}
                label={code === 'bn' ? 'বাংলা' : 'English'}
                selected={locale === code}
                onPress={() => setLocale(code)}
                testID={`register-language-${code}`}
              />
            ))}
          </ChipGroup>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Heading role="h2">{t('auth.register.title')}</Heading>
          <Text color="mutedForeground">{t('auth.register.subtitle')}</Text>
        </View>

        <TextField
          label={t('auth.field.name')}
          value={name}
          onChangeText={setName}
          error={nameError ? t(nameError) : undefined}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          disabled={submitting}
          testID="register-name"
        />

        <TextField
          label={t('auth.field.email')}
          value={email}
          onChangeText={setEmail}
          error={emailError ? t(emailError) : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          inputRef={emailRef}
          disabled={submitting}
          testID="register-email"
        />

        <TextField
          label={t('auth.field.password')}
          value={password}
          onChangeText={setPassword}
          error={passwordError ? t(passwordError) : undefined}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          inputRef={passwordRef}
          disabled={submitting}
          testID="register-password"
          trailingAction={{
            icon: showPassword ? (
              <EyeOffIcon size={20} color={colors.mutedForeground} />
            ) : (
              <EyeIcon size={20} color={colors.mutedForeground} />
            ),
            onPress: () => setShowPassword((v) => !v),
            accessibilityLabel: t(showPassword ? 'auth.password.hide' : 'auth.password.show'),
            testID: 'register-toggle-password',
          }}
        />

        {formError ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="register-form-error">
            <Text color="destructive">{t(formError)}</Text>
          </View>
        ) : null}

        <Button
          label={t('auth.register.submit')}
          onPress={() => void submit()}
          loading={submitting}
          testID="register-submit"
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.xs }}>
          <Text role="caption" color="mutedForeground">
            {t('auth.register.signInPrompt')}
          </Text>
          <Button
            label={t('auth.register.signInLink')}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/login')}
            testID="register-back-to-login"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
