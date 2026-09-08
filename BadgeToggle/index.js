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

  function decorationObject() {
    var d = selectedDecoration();
    if (!d) return null;
    return { asset: d[2], skuId: "0", sku_id: "0" };
  }

  function patchDecorationHook() {
    if (decorPatched) return true;
    var mod = safe(function () { return findByName("useAvatarDecoration", false); });
    if (!mod) mod = safe(function () { return findByName("useUserAvatarDecoration", false); });
    if (!mod) return false;
    try {
      var target = typeof mod === "function" ? mod : (typeof mod.useAvatarDecoration === "function" ? mod : (typeof mod.useUserAvatarDecoration === "function" ? mod : null));
      var method = null;
      if (!target) return false;
      if (typeof target === "function") method = null;
      else method = typeof target.useAvatarDecoration === "function" ? "useAvatarDecoration" : "useUserAvatarDecoration";
      var cb = function (args, ret) {
        var d = decorationObject();
        if (!d) return ret;
        var uid = argUserId(args);
        if (uid && uid === currentUserId()) return d;
        return ret;
      };
      var un = method === null ? after(target, cb) : after(method, target, cb);
      if (typeof un === "function") decorUnpatches.push(un);
      decorPatched = true;
      return true;
    } catch (_) { return false; }
  }

  function patchDecorationResolver() {
    var mod = safe(function () { return findByName("getAvatarDecorationURL", false); });
    if (!mod) return false;
    try {
      var target = typeof mod === "function" ? mod : (typeof mod.getAvatarDecorationURL === "function" ? mod : (typeof mod.default === "function" ? mod : null));
      var method = null;
      if (!target) return false;
      if (typeof target !== "function") method = typeof target.getAvatarDecorationURL === "function" ? "getAvatarDecorationURL" : "default";
      var cb = function (args, ret) {
        var d = selectedDecoration();
        if (!d) return ret;
        var uid = argUserId(args);
        if (!uid || uid !== currentUserId()) return ret;
        var a = args && args[0] && args[0].avatarDecoration;
        if (a && a._badgeToggleDecoration) return ret;
        return DECOR_CDN + d[2].replace(/^a_/, "") + ".png";
      };
      var un = method === null ? after(target, cb) : after(method, target, cb);
      if (typeof un === "function") decorUnpatches.push(un);
      decorPatched = true;
      return true;
    } catch (_) { return false; }
  }

  function patchDecorations() {
    if (!storage.decorationsEnabled) return true;
    if (decorPatched) return true;
    // Prefer the avatar-decoration hook. Resolver is only a fallback when it can identify the user.
    if (patchDecorationHook()) return true;
    return patchDecorationResolver();
  }

  function clearDecorationPatches() {
    for (var i = 0; i < decorUnpatches.length; i++) safe(function (fn) { return fn(); }.bind(null, decorUnpatches[i]));
    decorUnpatches = [];
    decorPatched = false;
  }


  /*
   * Ordered to follow Discord's badge families/progression:
   * general/profile -> legacy/program -> Nitro -> boosting ->
   * experimental progression families -> app/developer.
   *
   * Every switch is independent. This is a LOCAL visual spoof only.
   */
  var SECTIONS = [
    {
      title: "Profile & program badges",
      badges: [
        ["discord-staff", "Discord Staff", "discord_staff.png"],
        ["partnered-server-owner", "Partnered Server Owner", "partner_server_owner.png"],
        ["hypesquad-events", "HypeSquad Events", "hypesquad_events.png"],
        ["hypesquad-bravery", "HypeSquad Bravery", "hypesquad_bravery.png"],
        ["hypesquad-brilliance", "HypeSquad Brilliance", "hypesquad_brilliance.png"],
        ["hypesquad-balance", "HypeSquad Balance", "hypesquad_balance.png"],
        ["bug-hunter", "Bug Hunter", "bug_hunter.png"],
        ["golden-bug-hunter", "Golden Bug Hunter", "golden_bug_hunter.png"],
        ["early-supporter", "Early Supporter", "early_supporter.png"],
        ["moderator-program-alumni", "Moderator Program Alumni", "moderator_programs_aluminum.png"]
      ]
    },
    {
      title: "Nitro — 1 → 72+ months",
      badges: [
        ["nitro-bronze", "Nitro Bronze · 1 month", "nitro_bronze.png"],
        ["nitro-silver", "Nitro Silver · 3 months", "nitro_silver.png"],
        ["nitro-gold", "Nitro Gold · 6 months", "nitro_gold.png"],
        ["nitro-platinum", "Nitro Platinum · 12 months", "nitro_platinum.png"],
        ["nitro-diamond", "Nitro Diamond · 24 months", "nitro_diamond.png"],
        ["nitro-emerald", "Nitro Emerald · 36 months", "nitro_emerald.png"],
        ["nitro-ruby", "Nitro Ruby · 60 months", "nitro_ruby.png"],
        ["nitro-opal", "Nitro Opal · 72+ months", "nitro_opal.png"]
      ]
    },
    {
      title: "Server Booster — 1 → 24 months",
      badges: [
        ["boost-1", "Server Booster · 1 month", "boost_1_months.png"],
        ["boost-2", "Server Booster · 2 months", "boost_2_months.png"],
        ["boost-3", "Server Booster · 3 months", "boost_3_months.png"],
        ["boost-6", "Server Booster · 6 months", "boost_6_months.png"],
        ["boost-9", "Server Booster · 9 months", "boost_9_months.png"],
        ["boost-12", "Server Booster · 12 months", "boost_12_months.png"],
        ["boost-15", "Server Booster · 15 months", "boost_15_months.png"],
        ["boost-18", "Server Booster · 18 months", "boost_18_months.png"],
        ["boost-24", "Server Booster · 24 months", "boost_24_months.png"]
      ]
    },
    {
      title: "Gifting — 1 → 20 gifts",
      badges: [
        ["gift-patron", "Gifting · Patron · 1×", "gifting_patron.png"],
        ["gift-champion", "Gifting · Champion · 2×", "gifting_champion.png"],
        ["gift-luminary", "Gifting · Luminary · 3×", "gifting_luminary.png"],
        ["gift-icon", "Gifting · Icon · 6×", "gifting_icon.png"],
        ["gift-hero", "Gifting · Hero · 10×", "gifting_hero.png"],
        ["gift-legend", "Gifting · Legend · 20×", "gifting_legend.png"]
      ]
    },
    {
      title: "Account Age — 1 → 10+ years",
      badges: [
        ["age-seed", "Account Age · Seed · 1 year", "account_age_seed.png"],
        ["age-sprout", "Account Age · Sprout · 2 years", "account_age_sprout.png"],
        ["age-bud", "Account Age · Bud · 3 years", "account_age_bud.png"],
        ["age-sapling", "Account Age · Sapling · 4 years", "account_age_sapling.png"],
        ["age-blossom", "Account Age · Blossom · 5 years", "account_age_blossom.png"],
        ["age-redwood", "Account Age · Redwood · 6 years", "account_age_redwood.png"],
        ["age-sequoia", "Account Age · Sequoia · 7 years", "account_age_sequoia.png"],
        ["age-bristlecone", "Account Age · Bristlecone · 8 years", "account_age_bristlecone.png"],
        ["age-stromatolite", "Account Age · Stromatolite · 9 years", "account_age_stromatolite.png"],
        ["age-primordial", "Account Age · Primordial · 10+ years", "account_age_primordial.png"]
      ]
    },
    {
      title: "Streaming — 1 → 5,000+ hours",
      badges: [
        ["stream-newcomer", "Streaming · Newcomer · 1 hour", "streaming_newcomer.png"],
        ["stream-fledgling", "Streaming · Fledgling · 5 hours", "streaming_fledgling.png"],
        ["stream-breakout", "Streaming · Breakout · 20 hours", "streaming_breakout.png"],
        ["stream-standout", "Streaming · Standout · 75 hours", "streaming_standout.png"],
        ["stream-trendsetter", "Streaming · Trendsetter · 150 hours", "streaming_trendsetter.png"],
        ["stream-headliner", "Streaming · Headliner · 300 hours", "streaming_headliner.png"],
        ["stream-star", "Streaming · Star · 500 hours", "streaming_star.png"],
        ["stream-sensation", "Streaming · Sensation · 1,000 hours", "streaming_sensation.png"],
        ["stream-visionary", "Streaming · Visionary · 2,000 hours", "streaming_visionary.png"],
        ["stream-phenomenon", "Streaming · Phenomenon · 5,000+ hours", "streaming_phenomenon.png"]
      ]
    },
    {
      title: "Game Time — 1 → 5,000+ hours",
      badges: [
        ["game-casual", "Game Time · Casual · 1 hour", "game_time_casual.png"],
        ["game-recreational", "Game Time · Recreational · 5 hours", "game_time_recreational.png"],
        ["game-dedicated", "Game Time · Dedicated · 20 hours", "game_time_dedicated.png"],
        ["game-committed", "Game Time · Committed · 75 hours", "game_time_committed.png"],
        ["game-serious", "Game Time · Serious · 150 hours", "game_time_serious.png"],
        ["game-devoted", "Game Time · Devoted · 300 hours", "game_time_devoted.png"],
        ["game-seasoned", "Game Time · Seasoned · 500 hours", "game_time_seasoned.png"],
        ["game-ironclad", "Game Time · Ironclad · 1,000 hours", "game_time_ironclad.png"],
        ["game-unshakeable", "Game Time · Unshakeable · 2,000 hours", "game_time_unshakeable.png"],
        ["game-eternal", "Game Time · Eternal · 5,000+ hours", "game_time_eternal.png"]
      ]
    },
    {
      title: "Game Variety — 2 → 100+ games",
      badges: [
        ["variety-sampler", "Game Variety · Sampler · 2 games", "game_variety_sampler.png"],
        ["variety-dabbler", "Game Variety · Dabbler · 5 games", "game_variety_dabbler.png"],
        ["variety-enthusiast", "Game Variety · Enthusiast · 10 games", "game_variety_enthusiast.png"],
        ["variety-ranger", "Game Variety · Ranger · 15 games", "game_variety_ranger.png"],
        ["variety-explorer", "Game Variety · Explorer · 20 games", "game_variety_explorer.png"],
        ["variety-adventurer", "Game Variety · Adventurer · 30 games", "game_variety_adventurer.png"],
        ["variety-voyager", "Game Variety · Voyager · 40 games", "game_variety_voyager.png"],
        ["variety-maverick", "Game Variety · Maverick · 60 games", "game_variety_maverick.png"],
        ["variety-polymath", "Game Variety · Polymath · 80 games", "game_variety_polymath.png"],
        ["variety-universalist", "Game Variety · Universalist · 100+ games", "game_variety_universalist.png"]
      ]
    },
    {
      title: "Developer & app badges",
      badges: [
        ["early-verified-developer", "Early Verified Developer", "early_verified_developer.png"],
        ["active-developer", "Active Developer (retired)", "active_developer.png"],
        ["supports-commands", "Supports Commands", "supports_application_commands.png"],
        ["uses-automod", "Uses AutoMod", "uses_automod.png"],
        ["discord-quests", "Discord Quests", "complete_a_quest.png"],
        ["orbs", "Orbs", "orbs_apprentice.png"],
        ["legacy-username", "Legacy Username", "originally_known_as.png"],
        ["last-meadow", "Last Meadow Online", "last_meadow.png"]
      ]
    }
  ];

  var BADGES = [];
  var SECTION_LOOKUP = {};
  for (var s = 0; s < SECTIONS.length; s++) {
    SECTION_LOOKUP[SECTIONS[s].title] = [];
    for (var b = 0; b < SECTIONS[s].badges.length; b++) {
      var x = SECTIONS[s].badges[b];
      var item = {
        key: x[0],
        name: x[1],
        file: x[2],
        url: "https://raw.githubusercontent.com/dev-hoehle/discord-badges/main/png/" + x[2]
      };
      BADGES.push(item);
      SECTION_LOOKUP[SECTIONS[s].title].push(item);
      if (storage[item.key] == null) storage[item.key] = false;
    }
  }

  if (storage.enabled == null) storage.enabled = true;

  var unpatches = [];
  var retryTimer = null;
  var patchedHook = false;
  var patchedJsx = false;

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
        else if (a && typeof a === "object") {
          uid = a.userId || a.user_id || a.id || null;
        }
      }
    } catch (_) {}

    if (!uid || !isCurrentUser(uid)) return ret;

    var fake = enabledBadges().map(badgePayload);

    // Preserve Discord's real badges and append only our local visual badges.
    // If no fake badges are enabled, return the original result untouched.
    if (!fake.length) return ret;

    function merge(real) {
      var base = Array.isArray(real) ? real.slice() : [];
      var seen = {};
      for (var r = 0; r < base.length; r++) {
        var rid = base[r] && (base[r].id || base[r].badgeId || base[r].key);
        if (rid != null) seen[String(rid)] = true;
      }
      for (var f = 0; f < fake.length; f++) {
        var fid = String(fake[f].id);
        if (!seen[fid]) {
          base.push(fake[f]);
          seen[fid] = true;
        }
      }
      return base;
    }

    if (Array.isArray(ret)) return merge(ret);
    if (ret && typeof ret === "object") {
      var copy = {};
      for (var k in ret) {
        if (Object.prototype.hasOwnProperty.call(ret, k)) copy[k] = ret[k];
      }
      var originalBadges = Array.isArray(ret.badges) ? ret.badges :
                           (Array.isArray(ret.items) ? ret.items : []);
      var merged = merge(originalBadges);
      copy.badges = merged;
      if (Array.isArray(ret.items)) copy.items = merged;
      return copy;
    }
    return ret;
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
          else patchDecorations();
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
            if (v) patchDecorations();
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
      clearPatches();
      clearDecorationPatches();
      refresh();
    },

    settings: Settings
  };
})()
