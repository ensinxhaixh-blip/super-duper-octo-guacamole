(function () {
  "use strict";

  var React = vendetta.metro.common.React;
  var RN = vendetta.metro.common.ReactNative;
  var findByName = vendetta.metro.findByName;
  var findByProps = vendetta.metro.findByProps;
  var after = vendetta.patcher.after;
  var storage = vendetta.plugin.storage;

  var unpatches = [];

  var CDN = "https://cdn.discordapp.com/badge-icons/";

  var OPAL =
    CDN + "5b154df19c53dce2af92c9b61e6be5e2.png";

  var EARLY =
    CDN + "7060786766c9c840eb3019e725d2b358.png";

  if (storage.enabled == null)
    storage.enabled = true;

  if (storage.opal == null)
    storage.opal = true;

  if (storage.early == null)
    storage.early = true;

  function clear() {
    for (var i = 0; i < unpatches.length; i++) {
      try {
        unpatches[i]();
      } catch (_) {}
    }

    unpatches = [];
  }

  function makeBadges() {
    var badges = [];

    if (storage.opal) {
      badges.push({
        id: "larp-premium_tenure_opal",
        description: "Nitro · Opal (72+ mo)",
        icon: " "
      });
    }

    if (storage.early) {
      badges.push({
        id: "larp-early_supporter",
        description: "Early Supporter",
        icon: " "
      });
    }

    return badges;
  }

  function patchBadges() {
    try {
      var mod = findByName("useBadges", false);

      if (!mod) {
        console.log(
          "[Badge Toggle] useBadges not found"
        );
        return;
      }

      var key = null;

      if (typeof mod.default === "function") {
        key = "default";
      } else if (
        typeof mod.useBadges === "function"
      ) {
        key = "useBadges";
      }

      if (!key) {
        console.log(
          "[Badge Toggle] useBadges function not found"
        );
        return;
      }

      unpatches.push(
        after(
          key,
          mod,
          function (args, ret) {
            try {
              if (!storage.enabled)
                return ret;

              if (!Array.isArray(ret))
                return ret;

              return makeBadges();
            } catch (e) {
              console.log(
                "[Badge Toggle] badge error",
                e
              );

              return ret;
            }
          }
        )
      );

      console.log(
        "[Badge Toggle] useBadges patched"
      );
    } catch (e) {
      console.log(
        "[Badge Toggle] patch failed",
        e
      );
    }
  }

  function patchIcons() {
    try {
      var jsx = findByProps("jsx", "jsxs");

      if (!jsx)
        return;

      function handle(args, ret) {
        try {
          if (!ret || !ret.props)
            return ret;

          var component = args[0];

          if (typeof component !== "function")
            return ret;

          var name =
            component.displayName ||
            component.name ||
            "";

          if (
            name !== "ProfileBadge" &&
            name !== "RenderedBadge"
          ) {
            return ret;
          }

          var id = ret.props.id;

          if (
            id ===
            "larp-premium_tenure_opal"
          ) {
            ret.props.source = {
              uri: OPAL
            };

            ret.props.description =
              "Nitro · Opal (72+ mo)";

            return ret;
          }

          if (
            id ===
            "larp-early_supporter"
          ) {
            ret.props.source = {
              uri: EARLY
            };

            ret.props.description =
              "Early Supporter";

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
          handle
        )
      );

      unpatches.push(
        after(
          "jsxs",
          jsx,
          handle
        )
      );
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
        vendetta.ui.components.Forms.FormSection,
        {
          title: "Badge Toggle"
        },

        React.createElement(
          vendetta.ui.components.Forms.FormSwitchRow,
          {
            label: "Fake badges",
            subLabel:
              "Replace profile badges locally",

            value:
              !!storage.enabled,

            onValueChange:
              function (value) {
                storage.enabled =
                  !!value;

                clear();
                patchBadges();
                patchIcons();
              }
          }
        ),

        React.createElement(
          vendetta.ui.components.Forms.FormSwitchRow,
          {
            label: "Opal Nitro",
            value:
              !!storage.opal,

            onValueChange:
              function (value) {
                storage.opal =
                  !!value;
              }
          }
        ),

        React.createElement(
          vendetta.ui.components.Forms.FormSwitchRow,
          {
            label: "Early Supporter",
            value:
              !!storage.early,

            onValueChange:
              function (value) {
                storage.early =
                  !!value;
              }
          }
        )
      )
    );
  }

  return {
    onLoad: function () {
      clear();

      patchBadges();
      patchIcons();
    },

    onUnload: function () {
      clear();
    },

    settings: Settings
  };
})()
