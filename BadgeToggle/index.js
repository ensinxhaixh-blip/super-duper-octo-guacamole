(function(){
  "use strict";
  try {
    return ((function () {
      "use strict";

      var React = vendetta.metro.common.React;
      var RN = vendetta.metro.common.ReactNative;
      var findByProps = vendetta.metro.findByProps;
      var instead = vendetta.patcher.instead;
      var after = vendetta.patcher.after;
      var storage = vendetta.plugin.storage;
      var Forms = vendetta.ui.components.Forms;

      var FormSwitchRow = Forms.FormSwitchRow;
      var FormSection = Forms.FormSection;

      if (storage.fakeBadges == null) storage.fakeBadges = true;
      if (storage.fakeOpal == null) storage.fakeOpal = true;
      if (storage.fakeEarly == null) storage.fakeEarly = true;

      var unpatches = [];

      var BADGES = {
        opal: {
          id: "badge-toggle-opal",
          description: "Nitro — Opal",
          iconSrc: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png"
        },
        early: {
          id: "badge-toggle-early-supporter",
          description: "Early Supporter",
          iconSrc: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png"
        }
      };

      function clearPatches() {
        for (var i = 0; i < unpatches.length; i++) {
          try { unpatches[i](); } catch (_) {}
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

      function getCurrentUserId() {
        try {
          var UserStore = findByProps("getCurrentUser");
          var user = UserStore &&
            UserStore.getCurrentUser &&
            UserStore.getCurrentUser();

          return user && user.id ? String(user.id) : null;
        } catch (_) {
          return null;
        }
      }

      function fakeBadges() {
        var badges = [];

        if (storage.fakeOpal) {
          badges.push({
            id: BADGES.opal.id,
            description: BADGES.opal.description,
            iconSrc: BADGES.opal.iconSrc,
            position: 0
          });
        }

        if (storage.fakeEarly) {
          badges.push({
            id: BADGES.early.id,
            description: BADGES.early.description,
            iconSrc: BADGES.early.iconSrc,
            position: 0
          });
        }

        return badges;
      }

      function replaceOwnBadges(nativeBadges, userInfo) {
        if (!storage.fakeBadges) {
          return nativeBadges;
        }

        var currentId = getCurrentUserId();

        if (!currentId || !userInfo) {
          return nativeBadges;
        }

        var targetId = null;

        if (
          typeof userInfo === "string" ||
          typeof userInfo === "number"
        ) {
          targetId = String(userInfo);
        } else {
          targetId = userInfo.userId || userInfo.id;

          if (
            !targetId &&
            userInfo.user &&
            userInfo.user.id
          ) {
            targetId = userInfo.user.id;
          }

          if (targetId != null) {
            targetId = String(targetId);
          }
        }

        if (targetId !== currentId) {
          return nativeBadges;
        }

        return fakeBadges();
      }

      function applyPatches() {
        clearPatches();

        var possibleModules = [];

        function addModule(fn) {
          try {
            var mod = fn();

            if (mod) {
              possibleModules.push(mod);
            }
          } catch (_) {}
        }

        addModule(function () {
          return findByProps("getBadges");
        });

        addModule(function () {
          return findByProps("getUserBadges");
        });

        addModule(function () {
          return findByProps("badges", "getBadges");
        });

        var modules = [];

        for (var i = 0; i < possibleModules.length; i++) {
          if (modules.indexOf(possibleModules[i]) === -1) {
            modules.push(possibleModules[i]);
          }
        }

        for (var j = 0; j < modules.length; j++) {
          var mod = modules[j];

          if (typeof mod.getBadges === "function") {
            addPatch(function (target) {
              return function () {
                return after(
                  "getBadges",
                  target,
                  function (args, ret) {
                    try {
                      var userInfo =
                        args && args.length
                          ? args[0]
                          : null;

                      return replaceOwnBadges(
                        ret,
                        userInfo
                      );
                    } catch (_) {
                      return ret;
                    }
                  }
                );
              };
            }(mod));
          }

          if (typeof mod.getUserBadges === "function") {
            addPatch(function (target) {
              return function () {
                return after(
                  "getUserBadges",
                  target,
                  function (args, ret) {
                    try {
                      var userInfo =
                        args && args.length
                          ? args[0]
                          : null;

                      return replaceOwnBadges(
                        ret,
                        userInfo
                      );
                    } catch (_) {
                      return ret;
                    }
                  }
                );
              };
            }(mod));
          }
        }
      }

      function Settings() {
        return React.createElement(
          RN.ScrollView,
          {
            style: { flex: 1 },
            contentContainerStyle: {
              paddingBottom: 40
            }
          },

          React.createElement(
            FormSection,
            { title: "Badge Toggle" },

            React.createElement(FormSwitchRow, {
              label: "Fake badges on my profile",
              subLabel:
                "Replaces your local profile badges with selected badges",
              value: !!storage.fakeBadges,

              onValueChange: function (value) {
                storage.fakeBadges = !!value;
                applyPatches();
              }
            }),

            React.createElement(FormSwitchRow, {
              label: "Opal Nitro",
              subLabel:
                "Show the Opal Nitro badge locally",
              value: !!storage.fakeOpal,

              onValueChange: function (value) {
                storage.fakeOpal = !!value;
              }
            }),

            React.createElement(FormSwitchRow, {
              label: "Early Supporter",
              subLabel:
                "Show the Early Supporter badge locally",
              value: !!storage.fakeEarly,

              onValueChange: function (value) {
                storage.fakeEarly = !!value;
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

    })());
  } catch (err) {
    try {
      if (
        vendetta &&
        vendetta.ui &&
        vendetta.ui.toasts
      ) {
        vendetta.ui.toasts.showToast(
          "[Badge Toggle] " +
          ((err && err.message) || String(err))
        );
      }
    } catch (_) {}

    return {
      onLoad: function () {},
      onUnload: function () {}
    };
  }
})()
