import { findByProps } from "@metro/common";

const settings = {
  staff: true,
  partner: true,
  hypesquad: true,
  bugHunter: true,
  earlySupporter: true,
  verifiedBot: true
};

const Badges = findByProps("getCurrentUser");

const badgeFlags: Record<string, number> = {
  staff: 1 << 0,
  partner: 1 << 1,
  hypesquad: 1 << 2,
  bugHunter: 1 << 3,
  earlySupporter: 1 << 9,
  verifiedBot: 1 << 16
};

export function applyCustomBadges() {
  const user = Badges?.getCurrentUser?.();

  if (!user) return;

  const originalFlags = user.flags ?? 0;

  let flags = originalFlags;

  for (const [badge, enabled] of Object.entries(settings)) {
    const bit = badgeFlags[badge];

    if (enabled && bit) {
      flags |= bit;
    } else if (!enabled && bit) {
      flags &= ~bit;
    }
  }

  user.flags = flags;
}

export default {
  name: "Custom Badges",

  onLoad() {
    applyCustomBadges();
  },

  onUnload() {
    applyCustomBadges();
  }
};
