(function () {
  "use strict";

  var React = vendetta.metro.common.React;
  var RN = vendetta.metro.common.ReactNative;
  var findByProps = vendetta.metro.findByProps;
  var findByStoreName = vendetta.metro.findByStoreName;
  var instead = vendetta.patcher.instead;
  var after = vendetta.patcher.after;
  var storage = vendetta.plugin.storage;
  var Forms = vendetta.ui.components.Forms;

  var FormSwitchRow = Forms.FormSwitchRow;
  var FormSection = Forms.FormSection;

  if (storage.showBadges == null) {
    storage.showBadges = true;
  }

  var unpatches = [];

  function clearPatches() {
    for (var i = 0; i < unpatches.length; i++) {
      try {
        unpatches[i]();
      } catch (_) {}
    }
    unpatches = [];
  }

  function addPatch(fn) {
    try {
      var unpatch = fn();
      if (typeof unpatch === "function") {
        unpatches.push(unpatch);
      }
    } catch (_) {}
  }

  function applyPatches() {
    clearPatches();

    if (storage.showBadges) return;

    var possibleModules = [];

    function addModule(fn) {
      try {
        var mod = fn();
        if (mod) possibleModules.push(mod);
      } catch (_) {}
    }

    addModule(function () { return findByProps("getBadges"); });
    addModule(function () { return findByProps("getUserBadges"); });
    addModule(function () { return findByProps("badges", "getBadges"); });
    addModule(function () { return findByProps("ProfileBadges"); });
    addModule(function () { return findByStoreName("UserProfileStore"); });

    var modules = [];
    for (var m = 0; m < possibleModules.length; m++) {
      if (modules.indexOf(possibleModules[m]) === -1) {
        modules.push(possibleModules[m]);
      }
    }

    for (var j = 0; j < modules.length; j++) {
      var mod = modules[j];

      if (typeof mod.getBadges === "function") {
        addPatch(function (target) {
          return function () {
            return instead("getBadges", target, function () {
              return [];
            });
          };
        }(mod));
      }

      if (typeof mod.getUserBadges === "function") {
        addPatch(function (target) {
          return function () {
            return instead("getUserBadges", target, function () {
              return [];
            });
          };
        }(mod));
      }

      if (typeof mod.getUserProfile === "function") {
        addPatch(function (target) {
          return function () {
            return after("getUserProfile", target, function (_, ret) {
              if (!ret || typeof ret !== "object") return ret;

              return {
                ...ret,
                badges: [],
                user:
                  ret.user && typeof ret.user === "object"
                    ? { ...ret.user, badges: [] }
                    : ret.user
              };
            });
          };
        }(mod));
      }
    }

    try {
      var BadgeComponents = findByProps("Badge", "ProfileBadge");

      if (BadgeComponents) {
        ["Badge", "ProfileBadge"].forEach(function (key) {
          if (typeof BadgeComponents[key] === "function") {
            addPatch(function (target, name) {
              return function () {
                return instead(name, target, function () {
                  return null;
                });
              };
            }(BadgeComponents, key));
          }
        });
      }
    } catch (_) {}
  }

  function Settings() {
    return React.createElement(
      RN.ScrollView,
      {
        style: { flex: 1 },
        contentContainerStyle: { paddingBottom: 40 }
      },
      React.createElement(
        FormSection,
        { title: "Badge Toggle" },
        React.createElement(FormSwitchRow, {
          label: "Show badges",
          subLabel: storage.showBadges
            ? "User badges are visible"
            : "User badges are hidden client-side",
          value: !!storage.showBadges,
          onValueChange: function (value) {
            storage.showBadges = !!value;
            applyPatches();
          }
        })
      )
    );
  }

  return {
    onLoad: function () {
      applyPatches();
    },

    onUnload: function () {
      clearPatches();
    },

    settings: Settings
  };
})()
