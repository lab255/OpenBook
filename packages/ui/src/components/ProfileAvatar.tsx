import {DATA_CHIP_CLASS} from '@/lib/dataColorVars';
import React from 'react';
import {cn} from '@/lib/utils';
import {useTranslation, type ProfilePreferences} from '@/providers';

/**
 * The user's avatar, everywhere it appears: an uploaded image if there is
 * one, else the chosen emoji, else a lettered monogram derived from the
 * name — tinted with a hue that is stable for that name, so "Ada" is always
 * the same color without anyone picking it.
 */

/** First letters of the first two words, uppercased — "Ada Lovelace" → "AL". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join('');
}

/** Preserve each name's hue slot across data-colour schemes. */
const MONOGRAM_TOKENS = ['red', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;

/** A stable hue for a given name (same input → same color, every session). */
export function monogramHue(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return DATA_CHIP_CLASS[MONOGRAM_TOKENS[h % MONOGRAM_TOKENS.length]];
}

export const ProfileAvatar: React.FC<{
  profile: ProfilePreferences;
  /** Size + type scale, e.g. "h-6 w-6 text-[10px]". */
  className?: string;
}> = ({profile, className}) => {
  const {t} = useTranslation();
  if (profile.avatarImage) {
    return (
      <img
        src={profile.avatarImage}
        alt=""
        data-avatar-kind="image"
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  if (profile.avatar) {
    return (
      <span
        data-avatar-kind="emoji"
        className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted leading-none', className)}
        aria-hidden
      >
        {profile.avatar}
      </span>
    );
  }
  const name = profile.displayName.trim() || profile.name.trim() || t('profile.anonymous');
  return (
    <span
      data-avatar-kind="initials"
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none',
        monogramHue(name),
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
};
