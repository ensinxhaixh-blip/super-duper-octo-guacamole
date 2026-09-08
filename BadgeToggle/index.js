(function () {
  "use strict";

  var React = vendetta.metro.common.React;
  var RN = vendetta.metro.common.ReactNative;

  var findByName = vendetta.metro.findByName;
  var findByProps = vendetta.metro.findByProps;
  var findByStoreName = vendetta.metro.findByStoreName;

  var after = vendetta.patcher.after;
  var storage = vendetta.plugin.storage;

  var unpatches = [];
  var retryTimer = null;

  var patchedBadgesModule = null;
  var patchedBadgesKey = null;
  var patchedJSX = null;

  var CDN =
    "https://cdn.discordapp.com/badge-icons/";

  var OPAL =
    CDN + "5b154df19c53dce2af92c9b61e6be5e2.png";

  var EARLY_SUPPORTER =
    CDN + "7060786766c9c840eb3019e725d2b358.png";


  /* -------------------------
     STORAGE
  ------------------------- */

  if (storage.enabled == null)
    storage.enabled = true;

  if (storage.opal == null)
    storage.opal = true;

  if (storage.early == null)
    storage.early = true;


  /* -------------------------
     CLEANUP
  ------------------------- */

  function clearPatches() {
    for (var i = 0; i < unpatches.length; i++) {
      try {
        unpatches[i]();
      } catch (_) {}
    }

    unpatches = [];

    patchedBadgesModule = null;
    patchedBadgesKey = null;
    patchedJSX = null;
  }


  /* -------------------------
     CURRENT USER
  ------------------------- */

  function getCurrentUser() {
    try {
      var UserStore =
        findByStoreName("UserStore");

      if (
        UserStore &&
        typeof UserStore.getCurrentUser ===
          "function"
      ) {
        return UserStore.getCurrentUser();
      }
    } catch (_) {}

    return null;
  }


  function extractUserId(value) {
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
      if (value.userId != null)
        return String(value.userId);

      if (value.user.id != null)
        return String(value.user.id);

      if (value.user.userId != null)
        return String(value.user.userId);
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

      if (
        value.profile.user.userId != null
      ) {
        return String(
          value.profile.user.userId
        );
      }
    }

    return null;
  }


  function isCurrentUser(value) {
    var current = getCurrentUser();

    if (!current || current.id == null)
      return false;

    var target = extractUserId(value);

    if (target == null)
      return false;

    return (
      String(target) ===
      String(current.id)
    );
  }


  /* -------------------------
     FAKE BADGES
  ------------------------- */

  function makeBadges() {
    var badges = [];

    if (storage.opal) {
      badges.push({
        id:
          "larp-premium_tenure_opal",

        description:
          "Nitro · Opal (72+ mo)",

        icon: " "
      });
    }

    if (storage.early) {
      badges.push({
        id:
          "larp-early_supporter",

        description:
          "Early Supporter",

        icon: " "
      });
    }

    return badges;
  }


  /* -------------------------
     BADGE HOOK
  ------------------------- */

  function patchBadges() {
    try {
      var mod =
        findByName(
          "useBadges",
          false
        );

      if (!mod)
        return false;

      var key = null;

      if (
        typeof mod.default ===
        "function"
      ) {
        key = "default";
      }

      if (
        !key &&
        typeof mod.useBadges ===
          "function"
      ) {
        key = "useBadges";
      }

      if (!key)
        return false;

      if (
        patchedBadgesModule === mod &&
        patchedBadgesKey === key
      ) {
        return true;
      }

      var unpatch = after(
        key,
        mod,
        function (args, ret) {
          try {
            if (!storage.enabled)
              return ret;

            if (!Array.isArray(ret))
              return ret;

            var user =
              args &&
              args.length
                ? args[0]
                : null;

            /*
             * Only replace YOUR badges.
             */
            if (
              !isCurrentUser(user)
            ) {
              return ret;
            }

            return makeBadges();
          } catch (_) {
            return ret;
          }
        }
      );

      if (
        typeof unpatch ===
        "function"
      ) {
        unpatches.push(unpatch);
      }

      patchedBadgesModule = mod;
      patchedBadgesKey = key;

      console.log(
        "[Badge Toggle] useBadges hooked"
      );

      return true;
    } catch (e) {
      console.log(
        "[Badge Toggle] useBadges error",
        e
      );

      return false;
    }
  }


  /* -------------------------
     BADGE ICON RENDERER
  ------------------------- */

  function patchBadgeIcons() {
    try {
      var jsx =
        findByProps(
          "jsx",
          "jsxs"
        );

      if (!jsx)
        return false;

      if (patchedJSX === jsx)
        return true;

      function handle(args, ret) {
        try {
          if (
            !ret ||
            !ret.props
          ) {
            return ret;
          }

          var Type = args[0];

          if (
            typeof Type !==
            "function"
          ) {
            return ret;
          }

          var name =
            Type.displayName ||
            Type.name ||
            "";

          if (
            name !==
              "ProfileBadge" &&
            name !==
              "RenderedBadge"
          ) {
            return ret;
          }

          var id =
            ret.props.id;

          if (
            typeof id !==
            "string"
          ) {
            return ret;
          }


          /* OPAL */

          if (
            id ===
            "larp-premium_tenure_opal"
          ) {
            ret.props.source = {
              uri: OPAL
            };

            ret.props.description =
              "Nitro · Opal (72+ mo)";

            ret.props.onPress =
              undefined;

            ret.props.onLongPress =
              undefined;

            return ret;
          }


          /* EARLY SUPPORTER */

          if (
            id ===
            "larp-early_supporter"
          ) {
            ret.props.source = {
              uri:
                EARLY_SUPPORTER
            };

            ret.props.description =
              "Early Supporter";

            ret.props.onPress =
              undefined;

            ret.props.onLongPress =
              undefined;

            return ret;
          }

          return ret;
        } catch (_) {
          return ret;
        }
      }


      var p1 = after(
        "jsx",
        jsx,
        handle
      );

      var p2 = after(
        "jsxs",
        jsx,
        handle
      );

      if (
        typeof p1 ===
        "function"
      ) {
        unpatches.push(p1);
      }

      if (
        typeof p2 ===
        "function"
      ) {
        unpatches.push(p2);
      }

      patchedJSX = jsx;

      console.log(
        "[Badge Toggle] JSX hooked"
      );

      return true;
    } catch (e) {
      console.log(
        "[Badge Toggle] JSX error",
        e
      );

      return false;
    }
  }


  /* -------------------------
     REFRESH PROFILE
  ------------------------- */

  function refresh() {
    try {
      var UserStore =
        findByStoreName(
          "UserStore"
        );

      if (
        UserStore &&
        typeof UserStore.emitChange ===
          "function"
      ) {
        UserStore.emitChange();
      }
    } catch (_) {}

    try {
      var stores = [
        "UserProfileStore",
        "UserProfileStoreV2",
        "GuildMemberProfileStore"
      ];

      for (
        var i = 0;
        i < stores.length;
        i++
      ) {
        try {
          var store =
            findByStoreName(
              stores[i]
            );

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


  /* -------------------------
     RETRY LOADER
  ------------------------- */

  function startRetry() {
    var attempts = 0;

    if (retryTimer) {
      try {
        clearInterval(
          retryTimer
        );
      } catch (_) {}
    }

    retryTimer =
      setInterval(
        function () {
          attempts++;

          var badgeOK =
            patchBadges();

          var iconOK =
            patchBadgeIcons();

          if (
            badgeOK &&
            iconOK
          ) {
            try {
              clearInterval(
                retryTimer
              );
              retryTimer = null;
            } catch (_) {}

            refresh();

            console.log(
              "[Badge Toggle] ready"
            );
          }

          if (attempts >= 30) {
            try {
              clearInterval(
                retryTimer
              );
              retryTimer = null;
            } catch (_) {}
          }
        },
        500
      );
  }


  /* -------------------------
     SETTINGS
  ------------------------- */

  function Settings() {
    return React.createElement(
      RN.ScrollView,
      {
        style: {
          flex: 1
        }
      },

      React.createElement(
        vendetta.ui.components.Forms
          .FormSection,
        {
          title:
            "Fake Profile Badges"
        },

        React.createElement(
          vendetta.ui.components.Forms
            .FormSwitchRow,
          {
            label:
              "Replace my badges",

            subLabel:
              "Locally replace your profile badges",

            value:
              !!storage.enabled,

            onValueChange:
              function (value) {
                storage.enabled =
                  !!value;

                refresh();
              }
          }
        ),

        React.createElement(
          vendetta.ui.components.Forms
            .FormSwitchRow,
          {
            label:
              "Opal Nitro",

            subLabel:
              "72+ month Nitro badge",

            value:
              !!storage.opal,

            onValueChange:
              function (value) {
                storage.opal =
                  !!value;

                refresh();
              }
          }
        ),

        React.createElement(
          vendetta.ui.components.Forms
            .FormSwitchRow,
          {
            label:
              "Early Supporter",

            subLabel:
              "Early Supporter badge",

            value:
              !!storage.early,

            onValueChange:
              function (value) {
                storage.early =
                  !!value;

                refresh();
              }
          }
        )
      )
    );
  }


  /* -------------------------
     PLUGIN
  ------------------------- */

  return {
    onLoad: function () {
      clearPatches();

      patchBadges();
      patchBadgeIcons();

      startRetry();

      refresh();
    },

    onUnload: function () {
      if (retryTimer) {
        try {
          clearInterval(
            retryTimer
          );
        } catch (_) {}

        retryTimer = null;
      }

      clearPatches();
      refresh();
    },

    settings: Settings
  };
})()
