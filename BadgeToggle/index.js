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
    "https://cdn.jsdelivr.net/gh/merlinfuchs/discord-badges/PNG/";

  /*
   * All selectable badges.
   *
   * These are LOCAL visual replacements.
   * They do not change your actual Discord account.
   */

  var BADGES = [
    {
      key: "staff",
      name: "Discord Staff",
      description: "Discord Staff",
      image: "staff.png"
    },

    {
      key: "partner",
      name: "Partnered Server Owner",
      description: "Partnered Server Owner",
      image: "partnered_server_owner.png"
    },

    {
      key: "hypesquadEvents",
      name: "HypeSquad Events",
      description: "HypeSquad Events",
      image: "hypesquad_events.png"
    },

    {
      key: "hypesquadBravery",
      name: "HypeSquad Bravery",
      description: "HypeSquad Bravery",
      image: "hypesquad_bravery.png"
    },

    {
      key: "hypesquadBrilliance",
      name: "HypeSquad Brilliance",
      description: "HypeSquad Brilliance",
      image: "hypesquad_brilliance.png"
    },

    {
      key: "hypesquadBalance",
      name: "HypeSquad Balance",
      description: "HypeSquad Balance",
      image: "hypesquad_balance.png"
    },

    {
      key: "bugHunter1",
      name: "Bug Hunter",
      description: "Discord Bug Hunter",
      image: "bug_hunter_level_1.png"
    },

    {
      key: "bugHunter2",
      name: "Golden Bug Hunter",
      description: "Discord Bug Hunter Level 2",
      image: "bug_hunter_level_2.png"
    },

    {
      key: "earlySupporter",
      name: "Early Supporter",
      description: "Early Supporter",
      image: "early_supporter.png"
    },

    {
      key: "earlyDeveloper",
      name: "Early Verified Developer",
      description: "Early Verified Bot Developer",
      image: "early_verified_developer.png"
    },

    {
      key: "moderator",
      name: "Certified Moderator",
      description: "Moderator Programs Alumni",
      image: "certified_moderator.png"
    },

    {
      key: "activeDeveloper",
      name: "Active Developer",
      description: "Active Developer",
      image: "active_developer.png"
    },

    {
      key: "nitro",
      name: "Nitro",
      description: "Discord Nitro",
      image: "nitro.png"
    },

    {
      key: "boost1",
      name: "Server Booster — 1 Month",
      description: "Server boosting for 1 month",
      image: "boosting_1_months.png"
    },

    {
      key: "boost2",
      name: "Server Booster — 2 Months",
      description: "Server boosting for 2 months",
      image: "boosting_2_months.png"
    },

    {
      key: "boost3",
      name: "Server Booster — 3 Months",
      description: "Server boosting for 3 months",
      image: "boosting_3_months.png"
    },

    {
      key: "boost6",
      name: "Server Booster — 6 Months",
      description: "Server boosting for 6 months",
      image: "boosting_6_months.png"
    },

    {
      key: "boost9",
      name: "Server Booster — 9 Months",
      description: "Server boosting for 9 months",
      image: "boosting_9_months.png"
    },

    {
      key: "boost12",
      name: "Server Booster — 12 Months",
      description: "Server boosting for 12 months",
      image: "boosting_12_months.png"
    },

    {
      key: "boost15",
      name: "Server Booster — 15 Months",
      description: "Server boosting for 15 months",
      image: "boosting_15_months.png"
    },

    {
      key: "boost18",
      name: "Server Booster — 18 Months",
      description: "Server boosting for 18 months",
      image: "boosting_18_months.png"
    },

    {
      key: "boost24",
      name: "Server Booster — 24 Months",
      description: "Server boosting for 24 months",
      image: "boosting_24_months.png"
    }
  ];


  /* -------------------------
     STORAGE
  ------------------------- */

  if (storage.enabled == null)
    storage.enabled = true;

  for (var s = 0; s < BADGES.length; s++) {
    var badgeKey = BADGES[s].key;

    if (storage[badgeKey] == null) {
      storage[badgeKey] = false;
    }
  }


  /*
   * Make badge ID.
   *
   * The ID is local and intentionally different
   * from Discord's real badge IDs.
   */

  function badgeId(badge) {
    return "badge-toggle-" + badge.key;
  }


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
        typeof UserStore.getCurrentUser === "function"
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
      typeof value === "number"
    ) {
      return String(value);
    }

    if (typeof value !== "object")
      return null;

    if (value.userId != null)
      return String(value.userId);

    if (value.id != null)
      return String(value.id);

    if (value.user && value.user.id != null)
      return String(value.user.id);

    if (
      value.member &&
      value.member.user &&
      value.member.user.id != null
    ) {
      return String(value.member.user.id);
    }

    if (
      value.profile &&
      value.profile.user &&
      value.profile.user.id != null
    ) {
      return String(value.profile.user.id);
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

    return String(target) === String(current.id);
  }


  /* -------------------------
     CREATE SELECTED BADGES
  ------------------------- */

  function makeBadges() {
    var result = [];

    for (var i = 0; i < BADGES.length; i++) {
      var badge = BADGES[i];

      if (!storage[badge.key])
        continue;

      result.push({
        id: badgeId(badge),
        description: badge.description,
        icon: " "
      });
    }

    return result;
  }


  /* -------------------------
     PATCH useBadges
  ------------------------- */

  function patchBadges() {
    try {
      var mod =
        findByName("useBadges", false);

      if (!mod)
        return false;

      var key = null;

      if (typeof mod.default === "function") {
        key = "default";
      }

      if (
        !key &&
        typeof mod.useBadges === "function"
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
              args && args.length
                ? args[0]
                : null;

            if (!isCurrentUser(user))
              return ret;

            return makeBadges();
          } catch (_) {
            return ret;
          }
        }
      );

      if (typeof unpatch === "function") {
        unpatches.push(unpatch);
      }

      patchedBadgesModule = mod;
      patchedBadgesKey = key;

      return true;
    } catch (_) {
      return false;
    }
  }


  /* -------------------------
     PATCH BADGE ICONS
  ------------------------- */

  function patchBadgeIcons() {
    try {
      var jsx =
        findByProps("jsx", "jsxs");

      if (!jsx)
        return false;

      if (patchedJSX === jsx)
        return true;

      function handle(args, ret) {
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

          if (typeof id !== "string")
            return ret;

          for (var i = 0; i < BADGES.length; i++) {
            var badge = BADGES[i];

            if (id !== badgeId(badge))
              continue;

            ret.props.source = {
              uri: CDN + badge.image
            };

            ret.props.description =
              badge.description;

            ret.props.onPress = undefined;
            ret.props.onLongPress = undefined;

            return ret;
          }

          return ret;
        } catch (_) {
          return ret;
        }
      }


      var p1 =
        after(
          "jsx",
          jsx,
          handle
        );

      var p2 =
        after(
          "jsxs",
          jsx,
          handle
        );

      if (typeof p1 === "function")
        unpatches.push(p1);

      if (typeof p2 === "function")
        unpatches.push(p2);

      patchedJSX = jsx;

      return true;
    } catch (_) {
      return false;
    }
  }


  /* -------------------------
     REFRESH
  ------------------------- */

  function refresh() {
    try {
      var UserStore =
        findByStoreName("UserStore");

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


  /* -------------------------
     RETRY
  ------------------------- */

  function startRetry() {
    var attempts = 0;

    if (retryTimer) {
      try {
        clearInterval(retryTimer);
      } catch (_) {}
    }

    retryTimer =
      setInterval(function () {
        attempts++;

        var badgeOK =
          patchBadges();

        var iconOK =
          patchBadgeIcons();

        if (badgeOK && iconOK) {
          try {
            clearInterval(retryTimer);
          } catch (_) {}

          retryTimer = null;

          refresh();
        }

        if (attempts >= 30) {
          try {
            clearInterval(retryTimer);
          } catch (_) {}

          retryTimer = null;
        }
      }, 500);
  }


  /* -------------------------
     SETTINGS
  ------------------------- */

  function Settings() {
    var rows = [];

    rows.push(
      React.createElement(
        vendetta.ui.components.Forms.FormSwitchRow,
        {
          key: "enabled",

          label: "Enable fake badges",

          subLabel:
            "Replace your profile badges locally",

          value: !!storage.enabled,

          onValueChange: function (value) {
            storage.enabled = !!value;
            refresh();
          }
        }
      )
    );


    for (var i = 0; i < BADGES.length; i++) {
      var badge = BADGES[i];

      rows.push(
        React.createElement(
          vendetta.ui.components.Forms.FormSwitchRow,
          {
            key: badge.key,

            label: badge.name,

            subLabel:
              badge.description,

            value:
              !!storage[badge.key],

            onValueChange:
              (function (key) {
                return function (value) {
                  storage[key] =
                    !!value;

                  refresh();
                };
              })(badge.key)
          }
        )
      );
    }


    return React.createElement(
      RN.ScrollView,
      {
        style: {
          flex: 1
        }
      },

      React.createElement(
        vendetta.ui.components.Forms.FormSection,
        {
          title:
            "Fake Profile Badges"
        },

        rows
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
          clearInterval(retryTimer);
        } catch (_) {}

        retryTimer = null;
      }

      clearPatches();

      refresh();
    },

    settings: Settings
  };
})()
