(function () {
  "use strict";

  var React = vendetta.metro.common.React;
  var RN = vendetta.metro.common.ReactNative;
  var findByName = vendetta.metro.findByName;
  var findByNameAll = vendetta.metro.findByNameAll;
  var findByDisplayName = vendetta.metro.findByDisplayName;
  var findByDisplayNameAll = vendetta.metro.findByDisplayNameAll;
  var findByProps = vendetta.metro.findByProps;
  var findByStoreName = vendetta.metro.findByStoreName;
  var findAll = vendetta.metro.findAll;
  var after = vendetta.patcher.after;
  var before = vendetta.patcher.before;
  var storage = vendetta.plugin.storage;
  var Forms = vendetta.ui.components.Forms;

  var FormSwitchRow = Forms.FormSwitchRow;
  var FormSection = Forms.FormSection;

  var CDN = "https://cdn.discordapp.com/badge-icons";
  var OPAL = CDN + "/5b154df19c53dce2af92c9b61e6be5e2.png";

  // Experimental decoration layer: does NOT modify UserStore or profile objects.
  // It targets Discord's decoration resolver/hook instead.
  var DECORATIONS = [
    ["decor_angry", "Angry", "a_3c97a2d37f433a7913a1c7b7a735d000"],
    ["decor_owlbear", "Owlbear Cub", "a_3c5743cedcb72131c58278278a97c143"],
    ["decor_strawhat", "Straw Hat", "a_3d1e6078b2e4c8865e0ad0f429d651b1"],
    ["decor_heartbloom", "Heartbloom", "a_3e1fc3c7ee2e34e8176f4737427e8f4f"],
    ["decor_candlelight", "Candlelight", "a_3f29e6edfe1cff43736f644cf1d01278"],
    ["decor_butterflies", "Butterflies", "a_4cd9ae5a8d103c219eacd3674d7730cd"],
    ["decor_ufo", "UFO", "a_6fdbddb6229453eac3bbb212edf5cd1c"],
    ["decor_sakura", "Sakura Warrior", "a_7cf09c7e78d6eb35ae354acc1d5cc676"],
    ["decor_inlove", "In Love", "a_8ffa2ba9bff18e96b76c2e66fd0d7fa3"],
    ["decor_solar", "Solar Orbit", "a_9a6bf0ab30a6719d6eb09fa4996984ca"],
    ["decor_ruby", "Ruby Hearts", "a_a1c0581971d4a296908829289fea2c47"],
    ["decor_fire", "Fire", "a_a065206df7b011a5510e4e5bca7d49be"]
  ];

  var DECOR_CDN = "https://cdn.discordapp.com/avatar-decoration-presets/";
  var decorUnpatches = [];
  var decorPatched = false;
  var decorResolverPatched = false;
  var decorJSXPatched = false;

  if (storage.decorationsEnabled == null) storage.decorationsEnabled = false;
  for (var di = 0; di < DECORATIONS.length; di++) {
    if (storage[DECORATIONS[di][0]] == null) storage[DECORATIONS[di][0]] = false;
  }

  function selectedDecoration() {
    if (!storage.decorationsEnabled) return null;
    for (var i = 0; i < DECORATIONS.length; i++) {
      if (storage[DECORATIONS[i][0]]) return DECORATIONS[i];
    }
    return null;
  }

  function currentUserId() {
    var id = null;
    safe(function () {
      var us = findByStoreName("UserStore");
      if (us && typeof us.getCurrentUser === "function") {
        var u = us.getCurrentUser();
        if (u) id = String(u.id);
      }
    });
    return id;
  }

  function argUserId(args) {
    try {
      if (!args || !args.length) return null;
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (!a || typeof a !== "object") continue;
        if (a.user && a.user.id != null) return String(a.user.id);
        if (a.currentUser && a.currentUser.id != null) return String(a.currentUser.id);
        if (a.userId != null) return String(a.userId);
      }
    } catch (_) {}
    return null;
  }

  // Discord's decoration renderer expects a normal AvatarDecoration-shaped
  // object. Use the same local SKU convention used by Vencord's Decor plugin
  // instead of the placeholder SKU that caused iOS profile rendering to crash.
  var DECOR_SKU_ID = "100101099111114";

  function decorationObject() {
    var d = selectedDecoration();
    if (!d) return null;
    return { asset: d[2], skuId: DECOR_SKU_ID };
  }

  // Decoration strategy: render a local overlay around the user's avatar.
  // This mirrors the reference implementation's important idea: the frame is
  // a separate visual layer positioned over the avatar, rather than mutating
  // Discord's UserStore/profile object.
  var avatarOverlayUnpatches = [];
  var avatarOverlayPatched = false;
  var DECOR_SKU_ID = "100101099111114";

  function decorationObject() {
    var d = selectedDecoration();
    if (!d) return null;
    return { asset: d[2], skuId: DECOR_SKU_ID };
  }

  function isCurrentUserFromProps(props) {
    try {
      if (!props) return false;
      var me = currentUserId();
      if (!me) return false;
      var candidates = [
        props.user,
        props.currentUser,
        props.userData,
        props.account
      ];
      for (var i = 0; i < candidates.length; i++) {
        var u = candidates[i];
        if (u && u.id != null && String(u.id) === me) return true;
      }
      if (props.userId != null && String(props.userId) === me) return true;
      return false;
    } catch (_) { return false; }
  }

  function avatarSize(props, element) {
    try {
      if (props && typeof props.size === "number") return props.size;
      if (props && typeof props.avatarSize === "number") return props.avatarSize;
      var st = element && element.props && element.props.style;
      if (st && typeof st === "object" && !Array.isArray(st)) {
        if (typeof st.width === "number" && st.width === st.height) return st.width;
      }
    } catch (_) {}
    return 48;
  }

  function overlayAvatarResult(args, ret) {
    try {
      if (!storage.decorationsEnabled) return ret;
      if (!ret || !React || typeof React.isValidElement !== "function" || !React.isValidElement(ret)) return ret;
      var props = (args && args[0] && typeof args[0] === "object") ? args[0] : null;
      if (!isCurrentUserFromProps(props)) return ret;
      var d = decorationObject();
      if (!d) return ret;

      var size = avatarSize(props, ret);
      var url = DECOR_CDN + d.asset + ".png?size=" + Math.max(16, Math.round(size * 2));
      var wrapperStyle = {
        position: "relative",
        width: size,
        height: size,
        overflow: "visible"
      };
      var imageStyle = {
        position: "absolute",
        left: -Math.round(size * 0.10),
        top: -Math.round(size * 0.10),
        width: Math.round(size * 1.20),
        height: Math.round(size * 1.20),
        zIndex: 10,
        pointerEvents: "none"
      };
      var overlay = React.createElement(RN.Image, {
        source: { uri: url },
        style: imageStyle,
        resizeMode: "contain",
        pointerEvents: "none"
      });
      return React.createElement(RN.View, { style: wrapperStyle }, ret, overlay);
    } catch (_) {
      return ret;
    }
  }

  function patchOneAvatarTarget(mod, method) {
    try {
      var target = null;
      if (typeof mod === "function") target = mod;
      else if (mod && method && typeof mod[method] === "function") target = mod;
      else if (mod && typeof mod.default === "function") { target = mod; method = "default"; }
      else if (mod && typeof mod.render === "function") { target = mod; method = "render"; }
      if (!target) return false;

      var un = method ? after(method, target, overlayAvatarResult) : after(target, overlayAvatarResult);
      if (typeof un === "function") avatarOverlayUnpatches.push(un);
      return !!un;
    } catch (_) { return false; }
  }

  function patchAvatarOverlays() {
    if (avatarOverlayPatched) return true;
    var names = [
      "Avatar",
      "UserAvatar",
      "AvatarWithDecoration",
      "UserAvatarWithDecoration",
      "UserAvatarComponent"
    ];
    var found = 0;
    var seen = [];

    function add(mod) {
      if (!mod) return;
      var key = mod;
      if (typeof mod === "object") key = mod.default || mod.render || mod;
      if (seen.indexOf(key) !== -1) return;
      seen.push(key);
      if (patchOneAvatarTarget(mod, null)) found++;
    }

    for (var i = 0; i < names.length; i++) {
      try {
        var arr = typeof findByNameAll === "function" ? findByNameAll(names[i], false) : [];
        if (Array.isArray(arr)) arr.forEach(add);
        else add(safe(function () { return findByName(names[i], false); }));
      } catch (_) {}
      try {
        var arr2 = typeof findByDisplayNameAll === "function" ? findByDisplayNameAll(names[i], false) : [];
        if (Array.isArray(arr2)) arr2.forEach(add);
        else add(safe(function () { return findByDisplayName(names[i], false); }));
      } catch (_) {}
    }

    if (found > 0) avatarOverlayPatched = true;
    return found > 0;
  }

  function patchDecorations() {
    if (!storage.decorationsEnabled) return false;
    return patchAvatarOverlays();
  }

  function clearDecorationPatches() {
    for (var i = 0; i < avatarOverlayUnpatches.length; i++) {
      try { avatarOverlayUnpatches[i](); } catch (_) {}
    }
    avatarOverlayUnpatches = [];
    avatarOverlayPatched = false;
  }

  function safe(fn) {
    try { return fn(); } catch (_) { return null; }
  }

  function clearPatches() {
    for (var i = 0; i < unpatches.length; i++) {
      safe(unpatches[i]);
    }
    unpatches = [];
    patchedHook = false;
    patchedJsx = false;
  }

  function currentUserId() {
    var store = safe(function () { return findByStoreName("UserStore"); });
    if (!store) return null;
    var u = safe(function () {
      if (typeof store.getCurrentUser === "function") return store.getCurrentUser();
      if (typeof store.getCurrentUserId === "function") return store.getCurrentUserId();
      return null;
    });
    if (u && typeof u === "object") return u.id ? String(u.id) : null;
    return u != null ? String(u) : null;
  }

  function isCurrentUser(id) {
    if (id == null) return false;
    var me = currentUserId();
    return me != null && String(id) === me;
  }

  function enabledBadges() {
    if (!storage.enabled) return [];
    var out = [];
    for (var i = 0; i < BADGES.length; i++) {
      if (storage[BADGES[i].key]) out.push(BADGES[i]);
    }
    return out;
  }

  function badgePayload(b) {
    return {
      id: "badgetoggle-" + b.key,
      description: b.name,
      icon: " ",
      source: b.url,
      _badgeToggle: true,
      _badgeToggleKey: b.key
    };
  }

  function patchUseBadges() {
    if (patchedHook) return true;

    var mod = safe(function () { return findByName("useBadges", false); });
    if (!mod) return false;

    var target = null;
    var method = null;

    if (typeof mod === "function") {
      target = mod;
      method = null;
    } else if (typeof mod.useBadges === "function") {
      target = mod;
      method = "useBadges";
    } else if (typeof mod.default === "function") {
      target = mod;
      method = "default";
    }

    if (!target) return false;

    try {
      if (method === null) {
        var un = after(target, function (_, ret) {
          return replaceBadgeResult(arguments[0], ret);
        });
        if (typeof un === "function") unpatches.push(un);
      } else {
        var un2 = after(method, target, function (args, ret) {
          return replaceBadgeResult(args, ret);
        });
        if (typeof un2 === "function") unpatches.push(un2);
      }
      patchedHook = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function replaceBadgeResult(args, ret) {
    if (!storage.enabled) return ret;

    var uid = null;
    try {
      if (args && args.length) {
        var a = args[0];
        if (typeof a === "string" || typeof a === "number") uid = String(a);
        else if (a && typeof a === "object") uid = a.userId || a.user_id || a.id || null;
      }
    } catch (_) {}

    if (!uid || !isCurrentUser(uid)) return ret;

    // Replace the real badges entirely in the local rendered result.
    var fake = enabledBadges().map(badgePayload);
    if (Array.isArray(ret)) return fake;
    if (ret && typeof ret === "object") {
      var copy = {};
      for (var k in ret) if (Object.prototype.hasOwnProperty.call(ret, k)) copy[k] = ret[k];
      copy.badges = fake;
      if (Array.isArray(ret.items)) copy.items = fake;
      return copy;
    }
    return fake;
  }

  function patchJsx() {
    if (patchedJsx) return true;

    var jsx = safe(function () { return findByProps("jsx", "jsxs"); });
    if (!jsx) return false;

    var methods = ["jsx", "jsxs"];
    var did = false;

    for (var i = 0; i < methods.length; i++) {
      var name = methods[i];
      if (typeof jsx[name] !== "function") continue;

      try {
        var un = after(name, jsx, function (args, ret) {
          try {
            if (!ret || !ret.props) return ret;

            var type = ret.type;
            var typeName = "";
            if (type) typeName = String(type.displayName || type.name || "");

            if (typeName !== "ProfileBadge" &&
                typeName !== "RenderedBadge" &&
                typeName.indexOf("ProfileBadge") === -1 &&
                typeName.indexOf("RenderedBadge") === -1) {
              return ret;
            }

            var props = ret.props;
            var id = props.id || props.badgeId || props.badge && props.badge.id;
            var meta = null;

            for (var j = 0; j < BADGES.length; j++) {
              if ("badgetoggle-" + BADGES[j].key === String(id)) {
                meta = BADGES[j];
                break;
              }
            }

            if (!meta) {
              var src = props.source;
              if (src && typeof src === "object" && src.uri) {
                for (var z = 0; z < BADGES.length; z++) {
                  if (src.uri === BADGES[z].url) {
                    meta = BADGES[z];
                    break;
                  }
                }
              }
            }

            if (meta) {
              props.source = { uri: meta.url };
              props.uri = meta.url;
              props.image = { uri: meta.url };
            }
          } catch (_) {}
          return ret;
        });

        if (typeof un === "function") unpatches.push(un);
        did = true;
      } catch (_) {}
    }

    if (did) patchedJsx = true;
    return did;
  }

  function refresh() {
    safe(function () {
      var names = [
        "UserStore",
        "UserProfileStore",
        "UserProfileStoreV2",
        "GuildMemberProfileStore"
      ];
      for (var i = 0; i < names.length; i++) {
        var st = findByStoreName(names[i]);
        if (st && typeof st.emitChange === "function") st.emitChange();
      }
    });
  }

  function tryPatch() {
    patchUseBadges();
    patchJsx();
    if (storage.decorationsEnabled) patchDecorations();

    if (patchedHook && patchedJsx) {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }
  }

  function startPatching() {
    tryPatch();
    if (!retryTimer) {
      var attempts = 0;
      retryTimer = setInterval(function () {
        attempts++;
        tryPatch();
        if (attempts >= 60) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 500);
    }
    if (!decorRetryTimer) {
      var decorAttempts = 0;
      decorRetryTimer = setInterval(function () {
        decorAttempts++;
        if (storage.decorationsEnabled) patchDecorations();
        else { clearInterval(decorRetryTimer); decorRetryTimer = null; return; }
        if (decorAttempts >= 120) {
          clearInterval(decorRetryTimer);
          decorRetryTimer = null;
        }
      }, 500);
    }
  }

  function setBadge(key, value) {
    storage[key] = !!value;
    refresh();
  }

  function Settings() {
    var children = [];

    children.push(React.createElement(
      FormSection,
      { title: "Badge Toggle" },
      React.createElement(FormSwitchRow, {
        label: "Enable local badge spoofing",
        subLabel: "Only changes how your own profile is rendered on this device",
        value: !!storage.enabled,
        onValueChange: function (v) {
          storage.enabled = !!v;
          refresh();
        }
      })
    ));

    for (var s = 0; s < SECTIONS.length; s++) {
      var rows = [];
      var section = SECTIONS[s];

      for (var b = 0; b < section.badges.length; b++) {
        var item = SECTION_LOOKUP[section.title][b];

        rows.push(React.createElement(FormSwitchRow, {
          key: item.key,
          label: item.name,
          subLabel: "Local only",
          value: !!storage[item.key],
          onValueChange: (function (key) {
            return function (v) { setBadge(key, v); };
          })(item.key)
        }));
      }

      children.push(React.createElement(
        FormSection,
        { key: section.title, title: section.title },
        rows
      ));
    }

    children.push(React.createElement(
      FormSection,
      { title: "Avatar Decorations (Experimental)" },
      React.createElement(FormSwitchRow, {
        label: "Enable local decorations",
        subLabel: "Renderer-only; does not modify UserStore",
        value: !!storage.decorationsEnabled,
        onValueChange: function (v) {
          storage.decorationsEnabled = !!v;
          if (!v) clearDecorationPatches();
          else {
            patchDecorations();
            if (!decorRetryTimer) {
              var da = 0;
              decorRetryTimer = setInterval(function () {
                da++;
                if (storage.decorationsEnabled) patchDecorations();
                else { clearInterval(decorRetryTimer); decorRetryTimer = null; return; }
                if (da >= 120) { clearInterval(decorRetryTimer); decorRetryTimer = null; }
              }, 500);
            }
          }
          refresh();
        }
      }),
      DECORATIONS.map(function (item) {
        return React.createElement(FormSwitchRow, {
          key: item[0], label: item[1], subLabel: "Experimental / local only",
          value: !!storage[item[0]],
          onValueChange: function (v) {
            for (var j = 0; j < DECORATIONS.length; j++) storage[DECORATIONS[j][0]] = false;
            storage[item[0]] = !!v;
            storage.decorationsEnabled = !!v;
            clearDecorationPatches();
            if (v) {
              patchDecorations();
              var da2 = 0;
              decorRetryTimer = setInterval(function () {
                da2++;
                if (storage.decorationsEnabled) patchDecorations();
                else { clearInterval(decorRetryTimer); decorRetryTimer = null; return; }
                if (da2 >= 120) { clearInterval(decorRetryTimer); decorRetryTimer = null; }
              }, 500);
            }
            refresh();
          }
        });
      })
    ));

    return React.createElement(
      RN.ScrollView,
      {
        style: { flex: 1 },
        contentContainerStyle: { paddingBottom: 48 }
      },
      children
    );
  }

  return {
    onLoad: function () {
      startPatching();
    },

    onUnload: function () {
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = null;
      if (decorRetryTimer) clearInterval(decorRetryTimer);
      decorRetryTimer = null;
      clearPatches();
      clearDecorationPatches();
      refresh();
    },

    settings: Settings
  };
})()
