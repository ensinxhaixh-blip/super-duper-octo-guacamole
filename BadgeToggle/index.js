(function () {
  "use strict";

  var React = vendetta.metro.common.React;
  var RN = vendetta.metro.common.ReactNative;
  var findByName = vendetta.metro.findByName;
  var findByProps = vendetta.metro.findByProps;
  var findByStoreName = vendetta.metro.findByStoreName;
  var after = vendetta.patcher.after;
  var storage = vendetta.plugin.storage;
  var Forms = vendetta.ui.components.Forms;

  var FormSwitchRow = Forms.FormSwitchRow;
  var FormSection = Forms.FormSection;

  var CDN = "https://cdn.discordapp.com/badge-icons/";

  var OPAL_ICON =
    CDN + "5b154df19c53dce2af92c9b61e6be5e2.png";

  var EARLY_SUPPORTER_ICON =
    CDN + "7060786766c9c840eb3019e725d2b358.png";

  if (storage.fakeBadges == null)
    storage.fakeBadges = true;

  if (storage.opal == null)
    storage.opal = true;

  if (storage.earlySupporter == null)
    storage.earlySupporter = true;

  var unpatches = [];

  function clearPatches() {
    for (var i = 0; i < unpatches.length; i++) {
      try {
        unpatches[i]();
      } catch (_) {}
    }

    unpatches = [];
  }

  function getCurrentUser() {
    try {
      var UserStore = findByStoreName("UserStore");

      if (
        UserStore &&
        typeof UserStore.getCurrentUser === "function"
      ) {
        return UserStore.getCurrentUser();
      }
    } catch (_) {}

    return null;
  }

  function getUserId(value) {
    if (value == null)
      return null;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }

    if (typeof value !== "object")
      return null;

    if (value.userId != null)
      return String(value.userId);

    if (value.id != null)
      return String(value.id);

    if (
      value.user &&
      typeof value.user === "object"
    ) {
      if (value.user.userId != null)
        return String(value.user.userId);

      if (value.user.id != null)
        return String(value.user.id);
    }

    if (
      value.member &&
      value.member.user
    ) {
      if (value.member.user.id != null)
        return String(value.member.user.id);

      if (value.member.user.userId != null)
        return String(value.member.user.userId);
    }

    if (
      value.profile &&
      value.profile.user
    ) {
      if (value.profile.user.id != null)
        return String(value.profile.user.id);
    }

    return null;
  }

  function isOwnProfile(value) {
    var current = getCurrentUser();

    if (!current || current.id == null)
      return false;

    var target = getUserId(value);

    return (
      target != null &&
      String(target) === String(current.id)
    );
  }

  function createFakeBadges() {
    var result = [];

    if (storage.opal) {
      result.push({
        id: "badge-toggle-opal",
        description: "Nitro · Opal (72+ mo)",
        icon: " "
      });
    }

    if (storage.earlySupporter) {
      result.push({
        id: "badge-toggle-early-supporter",
        description: "Early Supporter",
        icon: " "
      });
    }

    return result;
  }

  function patchBadges() {
    try {
      var mod = findByName("useBadges", false);

      if (!mod)
        return;

      var key = null;

      if (typeof mod.default === "function")
        key = "default";

      if (
        !key &&
        typeof mod.useBadges === "function"
      ) {
        key = "useBadges";
      }

      if (!key)
        return;

      unpatches.push(
        after(
          key,
          mod,
          function (args, ret) {
            try {
              if (!storage.fakeBadges)
                return ret;

              if (!Array.isArray(ret))
                return ret;

              var user =
                args && args.length
                  ? args[0]
                  : null;

              if (!isOwnProfile(user))
                return ret;

              return createFakeBadges();
            } catch (_) {
              return ret;
            }
          }
        )
      );
    } catch (_) {}
  }

  function patchBadgeImages() {
    try {
      var jsx = findByProps("jsx", "jsxs");

      if (!jsx)
        return;

      function patchJSX(args, ret) {
        try {
          if (!ret || !ret.props)
            return ret;

          var Type = args[0];

          if (typeof Type !== "function")
            return ret;

          var name =
            Type.displayName ||
            Type.name ||
            "";

          if (
            name !== "ProfileBadge" &&
            name !== "RenderedBadge"
          ) {
            return ret;
          }

          var id = ret.props.id;

          if (id === "badge-toggle-opal") {
            ret.props.source = {
              uri: OPAL_ICON
            };

            ret.props.description =
              "Nitro · Opal (72+ mo)";

            ret.props.onPress = undefined;
            ret.props.onLongPress = undefined;

            return ret;
          }

          if (
            id ===
            "badge-toggle-early-supporter"
          ) {
            ret.props.source = {
              uri: EARLY_SUPPORTER_ICON
            };

            ret.props.description =
              "Early Supporter";

            ret.props.onPress = undefined;
            ret.props.onLongPress = undefined;

            return ret;
          }

          return ret;
        } catch (_) {
          return ret;
        }
      }

      unpatches.push(
        after(
          "jsx",
          jsx,
          patchJSX
        )
      );

      unpatches.push(
        after(
          "jsxs",
          jsx,
          patchJSX
        )
      );
    } catch (_) {}
  }

  function refreshProfile() {
    try {
      var stores = [
        "UserStore",
        "UserProfileStore",
        "UserProfileStoreV2",
        "GuildMemberProfileStore"
      ];

      for (var i = 0; i < stores.length; i++) {
        try {
          var store =
            findByStoreName(stores[i]);

          if (
            store &&
            typeof store.emitChange ===
              "function"
          ) {
            store.emitChange();
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  function Settings() {
    return React.createElement(
      RN.ScrollView,
      {
        style: {
          flex: 1
        }
      },

      React.createElement(
        FormSection,
        {
          title: "Fake Profile Badges"
        },

        React.createElement(
          FormSwitchRow,
          {
            label: "Replace my badges",
            subLabel:
              "Locally replaces your profile badges",
            value:
              !!storage.fakeBadges,

            onValueChange:
              function (value) {
                storage.fakeBadges =
                  !!value;

                refreshProfile();
              }
          }
        ),

        React.createElement(
          FormSwitchRow,
          {
            label: "Opal Nitro",
            subLabel:
              "Nitro Opal badge",
            value:
              !!storage.opal,

            onValueChange:
              function (value) {
                storage.opal =
                  !!value;

                refreshProfile();
              }
          }
        ),

        React.createElement(
          FormSwitchRow,
          {
            label: "Early Supporter",
            subLabel:
              "Early Supporter badge",
            value:
              !!storage.earlySupporter,

            onValueChange:
              function (value) {
                storage.earlySupporter =
                  !!value;

                refreshProfile();
              }
          }
        )
      )
    );
  }

  return {
    onLoad: function () {
      clearPatches();

      patchBadges();
      patchBadgeImages();

      refreshProfile();
    },

    onUnload: function () {
      clearPatches();
      refreshProfile();
    },

    settings: Settings
  };
})()
