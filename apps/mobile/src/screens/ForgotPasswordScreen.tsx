/**
 * Forgot-password screen: lets users request a password reset email. Route: `/forgot-password`.
 *
 * - Email validation before the request (required, basic format check).
 * - Sends request via `client.post('/auth/forgot-password', { email }, { auth: false })`.
 * - On success: Displays confirmation details and notes for email-less workers.
 * - Language selector chips supported on screen for pre-auth accessibility.
 * - Zero shadows (ADR-007 compliant).
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Locale } from '@rakhal/domain';
import { Button } from '../components/actions/Button.tsx';
import { Card } from '../components/display/Card.tsx';
import { Chip, ChipGroup } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Heading, Text } from '../components/primitives/Text.tsx';
import { authErrorMessageKey } from '../auth/auth-errors.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

const LOCALES: readonly Locale[] = ['bn', 'en'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordScreen() {
  const { client } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { tokens, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<MessageKey | undefined>();
  const [formError, setFormError] = useState<MessageKey | undefined>();

  async function submit() {
    if (submitting) return;
    const trimmed = email.trim();
    if (trimmed === '') {
      setEmailError('auth.error.emailRequired');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('auth.error.emailInvalid');
      return;
    }

    setEmailError(undefined);
    setFormError(undefined);
    setSubmitting(true);

    try {
      await client.post('/auth/forgot-password', { email: trimmed }, { auth: false });
      setSubmittedEmail(trimmed);
    } catch (error) {
      setFormError(authErrorMessageKey(error));
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
              testID={`forgot-password-language-${value}`}
            />
          ))}
        </ChipGroup>

        <View style={{ gap: tokens.spacing.xs }}>
          <Heading>{t('auth.forgotPassword.title')}</Heading>
          <Text color="mutedForeground">{t('auth.forgotPassword.subtitle')}</Text>
        </View>

        {submittedEmail ? (
          <View style={{ gap: tokens.spacing.lg }} testID="forgot-password-success-view">
            <Card style={{ gap: tokens.spacing.md }}>
              <Heading role="h2">{t('auth.forgotPassword.successTitle')}</Heading>
              <Text color="foreground">
                {t('auth.forgotPassword.successMessage', { email: submittedEmail })}
              </Text>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: tokens.spacing.sm,
                }}
              >
                <Text role="caption" color="mutedForeground">
                  {t('auth.forgotPassword.workerNote')}
                </Text>
              </View>
            </Card>

            <Button
              label={t('auth.forgotPassword.backToLogin')}
              variant="primary"
              size="lg"
              onPress={() => router.replace('/login')}
              testID="forgot-password-back-login"
            />
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.lg }}>
            <TextField
              label={t('auth.field.email')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(undefined);
              }}
              error={emailError ? t(emailError) : undefined}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              disabled={submitting}
              testID="forgot-password-email"
            />

            {formError ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="forgot-password-form-error">
                <Text color="destructive">{t(formError)}</Text>
              </View>
            ) : null}

            <View style={{ gap: tokens.spacing.sm }}>
              <Button
                label={t('auth.forgotPassword.submit')}
                variant="primary"
                size="lg"
                onPress={() => void submit()}
                loading={submitting}
                testID="forgot-password-submit"
              />

              <Button
                label={t('auth.forgotPassword.backToLogin')}
                variant="ghost"
                size="md"
                onPress={() => router.replace('/login')}
                disabled={submitting}
                testID="forgot-password-cancel"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
