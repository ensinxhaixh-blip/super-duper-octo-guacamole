import { findByProps, findByStoreName } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { ReactNative as RN } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormSwitchRow, FormSection } = Forms;

storage.showBadges ??= true;

let unpatches = [];

function clearPatches() {
  for (const unpatch of unpatches) {
    try {
      unpatch();
    } catch {}
  }

  unpatches = [];
}

function addPatch(patch) {
  try {
    const unpatch = patch();

    if (typeof unpatch === "function") {
      unpatches.push(unpatch);
    }
  } catch {}
}

function applyPatches() {
  clearPatches();

  // Badges are enabled, so leave Discord untouched.
  if (storage.showBadges) return;

  const possibleModules = [
    findByProps("getBadges"),
    findByProps("getUserBadges"),
    findByProps("badges", "getBadges"),
    findByProps("ProfileBadges"),
    findByStoreName("UserProfileStore"),
  ].filter(Boolean);

  // Prevent the same module from being patched more than once.
  const modules = [...new Set(possibleModules)];

  for (const mod of modules) {
    if (typeof mod.getBadges === "function") {
      addPatch(() =>
        instead("getBadges", mod, () => [])
      );
    }

    if (typeof mod.getUserBadges === "function") {
      addPatch(() =>
        instead("getUserBadges", mod, () => [])
      );
    }

    if (typeof mod.getUserProfile === "function") {
      addPatch(() =>
        after("getUserProfile", mod, (_, ret) => {
          if (!ret || typeof ret !== "object") {
            return ret;
          }

          // Don't mutate Discord's cached profile object.
          return {
            ...ret,
            badges: [],
            user:
              ret.user && typeof ret.user === "object"
                ? {
                    ...ret.user,
                    badges: [],
                  }
                : ret.user,
          };
        })
      );
    }
  }

  /*
   * Fallback for UI components.
   *
   * Only patch the two known badge components.
   * Do NOT patch every function exported by the module.
   */
  try {
    const BadgeComponents =
      findByProps("Badge", "ProfileBadge");

    if (BadgeComponents) {
      for (const key of ["Badge", "ProfileBadge"]) {
        if (typeof BadgeComponents[key] === "function") {
          addPatch(() =>
            instead(
              key,
              BadgeComponents,
              () => null
            )
          );
        }
      }
    }
  } catch {}
}

export default {
  onLoad() {
    applyPatches();
  },

  onUnload() {
    clearPatches();
  },

  settings: () => (
    <RN.ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <FormSection title="Badge Toggle">
        <FormSwitchRow
          label="Show badges"
          subLabel="When disabled, user badges are hidden client-side"
          leading={
            <Forms.FormIcon
              source={RN.Image.resolveAssetSource({
                uri: "ic_badge_staff",
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
