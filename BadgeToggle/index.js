const main = "index.js";

import { findByProps, findByStoreName } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { ReactNative as RN } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormSwitchRow, FormSection } = Forms;

// Default setting
storage.showBadges ??= true;

let unpatches = [];

function applyPatches() {
  // Clean previous patches
  unpatches.forEach(u => u());
  unpatches = [];

  if (storage.showBadges) return; // do nothing when badges are enabled

  // Common places badges come from on mobile
  const possibleModules = [
    findByProps("getBadges"),
    findByProps("getUserBadges"),
    findByProps("badges", "getBadges"),
    findByProps("ProfileBadges"),
    findByStoreName("UserProfileStore"),
  ].filter(Boolean);

  for (const mod of possibleModules) {
    if (typeof mod.getBadges === "function") {
      unpatches.push(
        instead("getBadges", mod, () => [])
      );
    }

    if (typeof mod.getUserBadges === "function") {
      unpatches.push(
        instead("getUserBadges", mod, () => [])
      );
    }

    if (mod.getUserProfile) {
      unpatches.push(
        after("getUserProfile", mod, (_, ret) => {
          if (ret) {
            ret.badges = [];
            if (ret.user) ret.user.badges = [];
          }
          return ret;
        })
      );
    }
  }

  // Extra safety: patch common React components that render badges
  try {
    const BadgeComponents = findByProps("Badge", "ProfileBadge") || {};
    Object.keys(BadgeComponents).forEach(key => {
      if (typeof BadgeComponents[key] === "function") {
        unpatches.push(
          instead(key, BadgeComponents, () => null)
        );
      }
    });
  } catch {}
}

export default {
  onLoad() {
    applyPatches();
  },

  onUnload() {
    unpatches.forEach(u => u());
    unpatches = [];
  },

  settings: () => (
    <RN.ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <FormSection title="Badge Toggle">
        <FormSwitchRow
          label="Show badges"
          subLabel="When disabled, all user badges are hidden client-side"
          leading={
            <Forms.FormIcon
              source={RN.Image.resolveAssetSource({
                uri: "ic_badge_staff"
              })}
            />
          }
          value={storage.showBadges}
          onValueChange={(v) => {
            storage.showBadges = v;
            applyPatches();
          }}
        />
      </FormSection>
    </RN.ScrollView>
  )
};
