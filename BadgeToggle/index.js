import { findByProps, findByStoreName } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { ReactNative as RN } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormSwitchRow, FormSection } = Forms;

storage.showBadges ??= true;

let unpatches = [];

function applyPatches() {
  unpatches.forEach((unpatch) => {
    try {
      unpatch();
    } catch {}
  });

  unpatches = [];

  // Badges enabled: don't apply any patches.
  if (storage.showBadges) return;

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

    if (typeof mod.getUserProfile === "function") {
      unpatches.push(
        after("getUserProfile", mod, (_, ret) => {
          if (ret) {
            ret.badges = [];

            if (ret.user) {
              ret.user.badges = [];
            }
          }

          return ret;
        })
      );
    }
  }

  try {
    const BadgeComponents =
      findByProps("Badge", "ProfileBadge") || {};

    Object.keys(BadgeComponents).forEach((key) => {
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
    unpatches.forEach((unpatch) => {
      try {
        unpatch();
      } catch {}
    });

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
          onValueChange={(value) => {
            storage.showBadges = value;
            applyPatches();
          }}
        />
      </FormSection>
    </RN.ScrollView>
  ),
};
