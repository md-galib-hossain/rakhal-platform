import type { ColorTokens } from '../theme/tokens.ts';

export interface AvatarTintColors {
  bg: string;
  text: string;
}

/**
 * Deterministic per-cattle tint for avatar initial fallback.
 * Rotates through semantic token pairs (tint background + text color).
 * Strictly complies with token system (no raw hex or colour literals).
 */
export function avatarTint(id: string, colors: ColorTokens): AvatarTintColors {
  const tints: AvatarTintColors[] = [
    { bg: colors.accentIndigoTint, text: colors.accentIndigo },
    { bg: colors.infoTint, text: colors.info },
    { bg: colors.successTint, text: colors.primaryText },
    { bg: colors.warningTint, text: colors.warningText },
    { bg: colors.accentPinkTint, text: colors.accentPink },
    { bg: colors.accentTealTint, text: colors.accentTeal },
    { bg: colors.accentPurpleTint, text: colors.accentPurple },
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return tints[Math.abs(hash) % tints.length]!;
}
