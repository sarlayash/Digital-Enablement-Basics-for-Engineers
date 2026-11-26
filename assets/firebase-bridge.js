(function () {
  "use strict";
  var stateKey = "fieldGuideState";
  var ownerKey = "fieldGuideOwnerUid";
  function blankState() { return { name: "", start: null, done: [], notes: {}, answers: {}, xp: 0 }; }
  function readState(raw) {
    try { return Object.assign(blankState(), JSON.parse(raw || "{}")); }
    catch (_) { return blankState(); }
  }

  window.getLearnerStateForFirebase = function () { return state; };

  window.activateFirebaseLearner = function (user, isAdmin) {
    var uid = user.uid;
    var owner = localStorage.getItem(ownerKey);
    var activeRaw = localStorage.getItem(stateKey);
    var ownKey = stateKey + ":" + uid;
    if (owner && owner !== uid && activeRaw) localStorage.setItem(stateKey + ":" + owner, activeRaw);
    var ownRaw = localStorage.getItem(ownKey);
    var next = owner === uid ? readState(activeRaw) : ownRaw ? readState(ownRaw) : readState(activeRaw);
    state = next;
    state.name = state.profileName || state.profile?.fullName || user.displayName || user.email || state.name || "Learner";
    if (!state.start) state.start = Date.now();
    localStorage.setItem(ownerKey, uid);
    localStorage.setItem(ownKey, JSON.stringify(state));
    sessionStorage.removeItem("fieldGuideLoggedOut");
    document.body.classList.remove("logged-out");
    document.getElementById("login")?.classList.remove("show");
    var emailLine = document.querySelector(".profile > div:nth-child(2) small");
    if (emailLine) emailLine.textContent = user.email || (isAdmin ? "Course administrator" : "Google learner account");
    save();
    window.firebaseSetAdminAccess?.(isAdmin);
  };

  window.deactivateFirebaseLearner = function (uid) {
    var activeRaw = localStorage.getItem(stateKey);
    if (uid && activeRaw) localStorage.setItem(stateKey + ":" + uid, activeRaw);
    localStorage.removeItem(ownerKey);
    state = blankState();
    localStorage.setItem(stateKey, JSON.stringify(state));
    sessionStorage.setItem("fieldGuideLoggedOut", "1");
    document.body.classList.add("logged-out");
    document.getElementById("login")?.classList.add("show");
    var input = document.getElementById("nameInput");
    if (input) input.value = "";
    window.firebaseSetAdminAccess?.(false);
  };
})();
