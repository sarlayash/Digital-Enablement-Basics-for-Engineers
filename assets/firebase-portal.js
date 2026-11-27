const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSNKjFw_AZ0DTFDEABje5R4invmgQw8PE",
  authDomain: "digital-enablement.firebaseapp.com",
  projectId: "digital-enablement",
  storageBucket: "digital-enablement.firebasestorage.app",
  messagingSenderId: "835393063409",
  appId: "1:835393063409:web:863418540f2964cb841c50",
  measurementId: "G-27WQ55ZNTC"
};

const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/13.4.0";
let auth;
let db;
let currentUser = null;
let adminUnsubscribes = [];
let adminDetailUnsubscribes = [];
let adminUsers = [];
let adminFeedback = [];
let adminAttendance = [];
let selectedAdminUid = null;
let adminDayRecords = [];
let adminDetailFeedback = [];
let adminDetailAttendance = [];
let latestState = null;
let syncTimer = 0;
let syncInFlight = Promise.resolve();
let cloudReady = false;
const syncedDayFingerprints = new Map();
let myFeedback = {};
let myAttendance = {};
let myNotifications = [];
let myFeedbackUnsubscribe = null;
let myAttendanceUnsubscribe = null;
let myNotificationsUnsubscribe = null;

function installPortalControls() {
  const login = document.querySelector(".loginbox");
  if (login && !document.getElementById("googleSignInButton")) {
    const title = login.querySelector("h2");
    const intro = title?.nextElementSibling;
    if (intro) intro.textContent = "Sign in with Google to save your learner identity and share your progress with the course team.";
    const google = document.createElement("button");
    google.type = "button";
    google.id = "googleSignInButton";
    google.className = "google-sign-in";
    google.disabled = true;
    google.innerHTML = '<span class="google-mark" aria-hidden="true">G</span><span>Continue with Google</span>';
    google.addEventListener("click", () => window.firebaseSignInGoogle?.());
    if (intro) intro.insertAdjacentElement("afterend", google);

    const name = document.getElementById("nameInput");
    const label = name?.previousElementSibling;
    const error = document.getElementById("loginError");
    const guestButton = error?.nextElementSibling;
    const localNote = guestButton?.nextElementSibling;
    if (name && label && guestButton) {
      const details = document.createElement("details");
      details.className = "guest-sign-in";
      details.innerHTML = "<summary>Continue as a guest on this device</summary>";
      const guestBody = document.createElement("div");
      guestBody.className = "guest-sign-in-body";
      label.textContent = "Your name";
      guestBody.append(label, name, guestButton);
      guestButton.textContent = "Continue as guest";
      if (localNote) {
        localNote.textContent = "Guest progress stays in this browser and is not included in administrator reports.";
        guestBody.append(localNote);
      }
      details.append(guestBody);
      google.insertAdjacentElement("afterend", details);
      error?.insertAdjacentElement("afterend", details);
    }
    const status = document.createElement("p");
    status.id = "firebaseLoginStatus";
    status.className = "firebase-login-status";
    status.setAttribute("role", "status");
    status.textContent = "Google sign-in connects this learner profile to live course reporting.";
    google?.insertAdjacentElement("afterend", status);
  }

  if (!document.getElementById("navProfile")) {
    const nav = document.querySelector(".side .nav");
    if (nav) {
      const profileButton = document.createElement("button");
      profileButton.type = "button";
      profileButton.id = "navProfile";
      profileButton.textContent = "◉  My profile";
      profileButton.addEventListener("click", () => window.showFirebaseProfile?.());
      nav.append(profileButton);
      const notificationsButton = document.createElement("button");
      notificationsButton.type = "button";
      notificationsButton.id = "navNotifications";
      notificationsButton.setAttribute("aria-label", "My Notifications and Actions Section");
      notificationsButton.innerHTML = '◌  My Notifications <span class="notification-nav-count" id="notificationNavCount" hidden>0</span>';
      notificationsButton.addEventListener("click", () => window.showFirebaseNotifications?.());
      nav.append(notificationsButton);
      const button = document.createElement("button");
      button.type = "button";
      button.id = "navAdmin";
      button.hidden = true;
      button.textContent = "▦  Admin dashboard";
      button.addEventListener("click", () => window.showFirebaseAdminDashboard?.());
      nav.append(button);
    }
  }

  const profileDetails = document.querySelector(".profile > div:nth-child(2)");
  if (profileDetails && !document.getElementById("firebaseCloudStatus")) {
    const cloudStatus = document.createElement("small");
    cloudStatus.id = "firebaseCloudStatus";
    cloudStatus.textContent = "Guest profile · device only";
    profileDetails.append(cloudStatus);
  }

  if (!document.getElementById("firebaseAdminDashboard")) {
    const content = document.querySelector(".content");
    content?.insertAdjacentHTML("beforeend", '<section class="firebase-profile" id="firebaseProfilePanel" hidden aria-labelledby="firebaseProfileTitle"></section><section class="firebase-notifications" id="firebaseNotificationsPanel" hidden aria-labelledby="firebaseNotificationsTitle"></section><section class="firebase-admin" id="firebaseAdminDashboard" hidden aria-labelledby="firebaseAdminTitle"></section>');
  }

  document.head.insertAdjacentHTML("beforeend", `<style>
    .google-sign-in{width:100%;display:flex;justify-content:center;align-items:center;gap:11px;border:1px solid #d7dce6;border-radius:11px;padding:12px 15px;background:#fff;color:#25314a;font-weight:700;box-shadow:0 2px 5px #1523440a}
    .google-sign-in:hover{background:#f7f9fc}.google-sign-in:disabled{opacity:.55;cursor:wait}.google-mark{font:800 17px Arial;color:#4285f4}
    .firebase-login-status{font-size:10px!important;color:#707b91;text-align:center;margin:9px 0 14px!important}
    .guest-sign-in{margin-top:14px;padding-top:12px;border-top:1px solid #e7eaf0}.guest-sign-in summary{cursor:pointer;color:#69748a;font-size:11px;font-weight:700}
    .guest-sign-in-body{padding-top:8px}.guest-sign-in-body>p{font-size:10px!important;margin-bottom:0}.guest-sign-in-body button{width:100%}
    #navAdmin[hidden]{display:none}.firebase-admin{padding:26px 0 50px}.firebase-admin[hidden]{display:none}
    .firebase-admin-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}.firebase-admin-head h1{font:800 26px Manrope;margin:5px 0}.firebase-admin-head p{color:var(--muted);font-size:12px;line-height:1.6;margin:0}
    .firebase-live-indicator{display:inline-flex;align-items:center;gap:7px;border-radius:99px;background:#e7f6ec;color:#27714a;padding:8px 11px;font:10px 'DM Mono';white-space:nowrap}.firebase-live-indicator:before{content:'';width:7px;height:7px;border-radius:50%;background:#37a46c;box-shadow:0 0 0 4px #37a46c20}
    .firebase-admin-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.firebase-admin-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:17px}.firebase-admin-kpi small{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.7px}.firebase-admin-kpi strong{display:block;margin-top:8px;font:800 24px Manrope;color:#203052}
    .firebase-analysis{background:#fff;border:1px solid var(--line);border-radius:16px;padding:19px;margin-bottom:16px}.firebase-analysis h2,.firebase-users h2{font:800 15px Manrope;margin:0}.firebase-analysis>p{font-size:11px;color:var(--muted);line-height:1.5}.firebase-day-chart{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:end;margin-top:16px}.firebase-day-bar{display:grid;gap:7px;text-align:center}.firebase-day-bar>div{height:88px;display:flex;align-items:flex-end;justify-content:center;background:#f4f6fa;border-radius:9px;overflow:hidden}.firebase-day-bar i{display:block;width:55%;min-height:4px;background:linear-gradient(#7590f5,#3e61dc);border-radius:8px 8px 0 0}.firebase-day-bar b{font:10px 'DM Mono';color:#35425d}.firebase-day-bar small{font-size:9px;color:var(--muted)}
    .firebase-users{background:#fff;border:1px solid var(--line);border-radius:16px;padding:19px}.firebase-users-toolbar{display:flex;align-items:center;gap:9px;margin:14px 0}.firebase-users-toolbar input{flex:1;min-width:120px;border:1px solid #dce1ea;border-radius:9px;padding:10px;font-size:11px}.firebase-users-toolbar button{white-space:nowrap}.firebase-table-wrap{overflow:auto;border:1px solid #e8ebf1;border-radius:11px}.firebase-table{width:100%;border-collapse:collapse;min-width:980px;text-align:left}.firebase-table th{position:sticky;top:0;background:#f7f8fb;color:#6b758a;font:10px 'DM Mono';text-transform:uppercase;letter-spacing:.3px;padding:11px 10px;border-bottom:1px solid #e6e9ef}.firebase-table td{padding:11px 10px;border-bottom:1px solid #edf0f4;color:#35415b;font-size:10px;vertical-align:top}.firebase-table tr:last-child td{border-bottom:0}.firebase-table .user-cell b,.firebase-table .user-cell span{display:block;max-width:180px;overflow-wrap:anywhere}.firebase-table .user-cell span{font-size:9px;color:#7c8699;margin-top:4px}.admin-detail-button{margin-top:8px!important;font-size:9px!important;padding:7px 8px!important}.firebase-detail{margin-top:16px;padding:19px;background:linear-gradient(145deg,#f8fbff,#fff);border:1px solid #d7e1f2;border-radius:16px}.firebase-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}.firebase-detail-head h2{margin:5px 0;font:800 20px Manrope;color:#213253}.firebase-detail-head p{margin:0;color:#69758b;font-size:11px}.firebase-detail-scroll{display:grid;gap:12px}.firebase-detail-scroll h3{font:800 13px Manrope;color:#2b3b5c;margin:5px 0 -3px}.firebase-error{padding:10px 12px;background:#fff1ef;color:#9b382e;border-radius:9px;font-size:11px}.firebase-empty{padding:28px;text-align:center;color:var(--muted);font-size:12px}.firebase-sync-note{font-size:10px;color:var(--muted);margin-top:10px}
    .notification-nav-count{float:right;min-width:18px;padding:2px 5px;border-radius:99px;background:#e8efff;color:#3d58be;font:9px 'DM Mono';text-align:center}.firebase-profile,.firebase-notifications{padding:26px 0 50px}.firebase-profile[hidden],.firebase-notifications[hidden]{display:none}.firebase-profile-head,.firebase-notifications-head,.firebase-comms-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:17px}.firebase-profile-head h1,.firebase-notifications-head h1{font:800 26px Manrope;margin:5px 0;color:#203052}.firebase-profile-head p,.firebase-notifications-head p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.firebase-profile-card{max-width:850px;padding:20px;background:#fff;border:1px solid var(--line);border-radius:16px}.firebase-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.firebase-profile-field{display:grid;gap:6px}.firebase-profile-field label{font-size:11px;font-weight:700;color:#43516d}.firebase-profile-field input{width:100%;border:1px solid #dce2ec;border-radius:9px;padding:10px 11px;color:#33415b;font-size:12px}.firebase-profile-field small{font-size:10px;color:#758096;line-height:1.45}.firebase-profile-field.wide{grid-column:1/-1}.firebase-profile-card .action{margin-top:17px}.firebase-profile-sync{margin:12px 0 0;color:#55708d;font-size:10px}.firebase-notification-list{display:grid;gap:11px;max-width:900px}.firebase-notification{padding:16px;border:1px solid #dfe5ee;border-radius:14px;background:#fff}.firebase-notification-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.firebase-notification h3{margin:0;font:800 14px Manrope;color:#253553}.firebase-notification p{margin:9px 0 0;color:#5f6b82;font-size:12px;line-height:1.65;white-space:pre-wrap}.firebase-notification time{font:10px 'DM Mono';color:#768197;white-space:nowrap}.firebase-comms{margin:0 0 16px;padding:19px;border:1px solid #d7e1f2;border-radius:16px;background:linear-gradient(145deg,#f6f9ff,#fff)}.firebase-comms h2{margin:0;font:800 16px Manrope;color:#243454}.firebase-comms p{font-size:11px;line-height:1.55;color:#67738a;margin:6px 0 0}.firebase-comms-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.firebase-comms-grid label{display:grid;gap:6px;color:#49566f;font-size:10px;font-weight:700}.firebase-comms-grid input,.firebase-comms-grid select,.firebase-comms-grid textarea{width:100%;border:1px solid #dce2ed;border-radius:9px;padding:10px;background:#fff;color:#35425d;font-size:11px}.firebase-comms-grid textarea{min-height:94px;resize:vertical}.firebase-comms-grid .wide{grid-column:1/-1}.firebase-comms-check{display:flex!important;grid-template-columns:auto 1fr;align-items:center;gap:8px!important;font-size:11px!important}.firebase-comms-check input{width:auto}.firebase-comms-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:13px}.firebase-comms-actions small{color:#69768d;font-size:10px;line-height:1.45}
    @media(max-width:800px){.firebase-admin-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.firebase-admin-head,.firebase-detail-head,.firebase-profile-head,.firebase-notifications-head,.firebase-comms-head{flex-direction:column}.firebase-users{padding:13px}.firebase-users-toolbar{flex-wrap:wrap}.firebase-users-toolbar input{flex-basis:100%}.firebase-profile-grid,.firebase-comms-grid{grid-template-columns:1fr}.firebase-profile-field.wide,.firebase-comms-grid .wide{grid-column:auto}.firebase-comms-actions{align-items:flex-start;flex-direction:column}}
  </style>`);

  window.showFirebaseAdminDashboard = function () {
    if (!window.firebaseIsAdmin) return;
    document.getElementById("overview")?.classList.add("hide");
    document.getElementById("dayview")?.classList.remove("show");
    hideWorkspacePanels();
    const panel = document.getElementById("firebaseAdminDashboard");
    if (panel) panel.hidden = false;
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = "Admin dashboard";
    document.querySelectorAll(".side .nav button").forEach(button => button.classList.toggle("active", button.id === "navAdmin"));
    startAdminListener();
  };
  function hideWorkspacePanels() {
    document.getElementById("firebaseAdminDashboard")?.setAttribute("hidden", "");
    document.getElementById("firebaseProfilePanel")?.setAttribute("hidden", "");
    document.getElementById("firebaseNotificationsPanel")?.setAttribute("hidden", "");
  }
  window.showFirebaseProfile = function () {
    document.getElementById("overview")?.classList.add("hide");
    document.getElementById("dayview")?.classList.remove("show");
    hideWorkspacePanels();
    const panel = document.getElementById("firebaseProfilePanel");
    if (panel) panel.hidden = false;
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = "My profile";
    document.querySelectorAll(".side .nav button").forEach(button => button.classList.toggle("active", button.id === "navProfile"));
    renderProfilePanel();
  };
  window.showFirebaseNotifications = function () {
    document.getElementById("overview")?.classList.add("hide");
    document.getElementById("dayview")?.classList.remove("show");
    hideWorkspacePanels();
    const panel = document.getElementById("firebaseNotificationsPanel");
    if (panel) panel.hidden = false;
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = "My Notifications and Actions Section";
    document.querySelectorAll(".side .nav button").forEach(button => button.classList.toggle("active", button.id === "navNotifications"));
    renderNotificationsPanel();
  };
  document.getElementById("navCert")?.addEventListener("click", () => { hideWorkspacePanels(); });
  const oldShowHome = window.showHome;
  if (oldShowHome) window.showHome = function () { hideWorkspacePanels(); oldShowHome(); };
  const oldOpenDay = window.openDay;
  if (oldOpenDay) window.openDay = function (...args) { hideWorkspacePanels(); oldOpenDay(...args); };
}

function loginMessage(message, isError = false) {
  const status = document.getElementById("firebaseLoginStatus");
  const error = document.getElementById("loginError");
  if (status) status.textContent = message;
  if (error && isError) {
    error.textContent = message;
    error.style.display = "block";
  }
}

function readableError(error) {
  const code = error?.code || "";
  if (code.includes("operation-not-allowed")) return "Google sign-in is not enabled yet in Firebase Authentication.";
  if (code.includes("unauthorized-domain")) return "Add sarlayash.github.io to Firebase Authentication’s authorized domains.";
  if (code.includes("popup-blocked")) return "Allow the Google sign-in pop-up, then try again.";
  if (code.includes("permission-denied")) return "Sign-in worked, but Firestore access is not configured. Deploy firestore.rules and create the database.";
  return error?.message || "Firebase could not complete that request. Please try again.";
}

function activeLearnerState() {
  return window.getLearnerStateForFirebase?.() || null;
}

function profileFromState(state) {
  const profile = state?.profile || {};
  return {
    fullName: String(profile.fullName || state?.profileName || state?.name || currentUser?.displayName || currentUser?.email || "").trim().slice(0, 120),
    linkedinUrl: String(profile.linkedinUrl || "").trim().slice(0, 300),
    githubUrl: String(profile.githubUrl || "").trim().slice(0, 300),
    domain: String(profile.domain || "").trim().slice(0, 120),
    collegeName: String(profile.collegeName || "").trim().slice(0, 180)
  };
}

function renderProfilePanel() {
  const root = document.getElementById("firebaseProfilePanel");
  if (!root) return;
  const profile = profileFromState(activeLearnerState());
  const signed = !!currentUser;
  root.innerHTML = `<header class="firebase-profile-head"><div><span class="eyebrow" style="color:#5368c9">LEARNER IDENTITY</span><h1 id="firebaseProfileTitle">My profile</h1><p>Use your correct professional name on badges and certificates. Add the links and details you want your course team to see.</p></div><span class="firebase-live-indicator">${signed ? "CLOUD SYNC ACTIVE" : "DEVICE PROFILE"}</span></header>
    <section class="firebase-profile-card"><div class="firebase-profile-grid"><div class="firebase-profile-field wide"><label for="profileFullName">Full name for badges and certificates</label><input id="profileFullName" maxlength="120" value="${escapeHTML(profile.fullName)}" placeholder="Your professional name"><small>This replaces the name shown on newly generated badges and certificates.</small></div><div class="firebase-profile-field"><label for="profileLinkedIn">LinkedIn profile</label><input id="profileLinkedIn" maxlength="300" value="${escapeHTML(profile.linkedinUrl)}" placeholder="linkedin.com/in/your-profile"></div><div class="firebase-profile-field"><label for="profileGitHub">GitHub profile</label><input id="profileGitHub" maxlength="300" value="${escapeHTML(profile.githubUrl)}" placeholder="github.com/your-handle"></div><div class="firebase-profile-field"><label for="profileDomain">Engineering domain</label><input id="profileDomain" maxlength="120" value="${escapeHTML(profile.domain)}" placeholder="e.g., Cloud, AI/ML, Cybersecurity"></div><div class="firebase-profile-field"><label for="profileCollege">College name</label><input id="profileCollege" maxlength="180" value="${escapeHTML(profile.collegeName)}" placeholder="Your college or university"></div></div><button class="action" id="saveLearnerProfile">Save profile</button><p class="firebase-profile-sync">${signed ? "Your profile is synced to the protected admin record and is available on your next device sign-in." : "Sign in with Google to sync this profile and make it available to the course team."}</p></section>`;
  document.getElementById("saveLearnerProfile")?.addEventListener("click", saveLearnerProfile);
}

function saveLearnerProfile() {
  const fullName = String(document.getElementById("profileFullName")?.value || "").trim();
  if (fullName.length < 2) {
    window.toast?.("Please enter your full professional name for certificates.");
    document.getElementById("profileFullName")?.focus();
    return;
  }
  const state = activeLearnerState();
  if (!state) return;
  state.profile = {
    fullName,
    linkedinUrl: String(document.getElementById("profileLinkedIn")?.value || "").trim(),
    githubUrl: String(document.getElementById("profileGitHub")?.value || "").trim(),
    domain: String(document.getElementById("profileDomain")?.value || "").trim(),
    collegeName: String(document.getElementById("profileCollege")?.value || "").trim()
  };
  state.profileName = fullName;
  state.name = fullName;
  if (typeof window.save === "function") window.save();
  else if (currentUser) window.firebaseQueueProgress?.(state);
  renderProfilePanel();
  window.toast?.(currentUser ? "Profile saved and synced to your course record." : "Profile saved on this device.");
}

async function hydrateProfileFromCloud(user) {
  if (!db || !window.firebaseGetDoc || !user?.uid) return;
  const snapshot = await window.firebaseGetDoc(window.firebaseDoc(db, "users", user.uid));
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  const fields = ["displayName", "linkedinUrl", "githubUrl", "domain", "collegeName"];
  if (!fields.some(field => String(data[field] || "").trim())) return;
  const state = activeLearnerState();
  if (!state) return;
  state.profile = {
    fullName: String(data.displayName || state.profile?.fullName || state.name || "").trim(),
    linkedinUrl: String(data.linkedinUrl || "").trim(),
    githubUrl: String(data.githubUrl || "").trim(),
    domain: String(data.domain || "").trim(),
    collegeName: String(data.collegeName || "").trim()
  };
  if (state.profile.fullName) {
    state.profileName = state.profile.fullName;
    state.name = state.profile.fullName;
  }
  if (typeof window.save === "function") window.save();
}

function updateNotificationBadge() {
  const badge = document.getElementById("notificationNavCount");
  if (!badge) return;
  const count = myNotifications.length;
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? "99+" : String(count);
}

function renderNotificationsPanel() {
  const root = document.getElementById("firebaseNotificationsPanel");
  if (!root) return;
  const cards = myNotifications.map(item => `<article class="firebase-notification"><div class="firebase-notification-head"><div><span class="eyebrow" style="color:#5368c9">${escapeHTML(String(item.kind || "Course notification").toUpperCase())}</span><h3>${escapeHTML(item.title || "Course notification")}</h3></div><time>${escapeHTML(formatDate(item.createdAt))}</time></div><p>${escapeHTML(item.message || "")}</p></article>`).join("");
  root.innerHTML = `<header class="firebase-notifications-head"><div><span class="eyebrow" style="color:#5368c9">MY NOTIFICATIONS &amp; ACTIONS</span><h1 id="firebaseNotificationsTitle">My Notifications and Actions Section</h1><p>Your course messages, reminders, and actions appear here.</p></div><span class="firebase-live-indicator">${currentUser ? "LIVE NOTIFICATIONS" : "SIGN IN TO SYNC"}</span></header><div class="firebase-notification-list">${cards || `<section class="panel"><p>${currentUser ? "No notifications yet. New messages and actions will appear here." : "Sign in with Google to receive course announcements and reminders."}</p></section>`}</div>`;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestAttempt(state) {
  const entries = [];
  const add = (value, label) => {
    const date = dateValue(value);
    if (date) entries.push({ date, label });
  };
  Object.entries(state?.assessments || {}).forEach(([day, phases]) => {
    ["pre", "post"].forEach(name => {
      const phase = phases?.[name];
      (phase?.attempts || []).forEach(attempt => add(attempt.at, `Day ${Number(day) + 1} ${name}`));
      if (phase?.active?.started) add(phase.active.started, `Day ${Number(day) + 1} ${name} in progress`);
    });
  });
  Object.entries(state?.mockTests || {}).forEach(([day, test]) => {
    (test?.attempts || []).forEach(attempt => add(attempt.at, `Day ${Number(day) + 1} mock`));
    if (test?.active?.startedAt) add(test.active.startedAt, `Day ${Number(day) + 1} mock in progress`);
  });
  const final = state?.finalAssessment;
  (final?.attempts || []).forEach(attempt => add(attempt.at, "Final assessment"));
  if (final?.active?.startedAt) add(final.active.startedAt, "Final assessment in progress");
  entries.sort((a, b) => b.date - a.date);
  return entries[0] || null;
}

function makeSummary(user, state, login = false) {
  const profile = state?.profile || {};
  const profileName = String(profile.fullName || state?.profileName || state?.name || user.displayName || user.email || "Learner").trim().slice(0, 120);
  const feedbackItems = Object.values(myFeedback);
  const attendanceItems = Object.values(myAttendance);
  const averageRating = field => feedbackItems.length ? Number((feedbackItems.reduce((sum, item) => sum + (Number(item[field]) || 0), 0) / feedbackItems.length).toFixed(2)) : 0;
  const days = Array.from({ length: 5 }, (_, day) => day);
  const completedDays = Object.entries(state?.dayAwards || {}).filter(([, completed]) => !!completed).map(([day]) => Number(day)).filter(day => Number.isInteger(day) && day >= 0 && day < 5);
  let sectionsCompleted = 0;
  let assessmentAttempts = 0;
  let assessmentPasses = 0;
  let mockTestsPassed = 0;
  days.forEach(day => {
    const sections = state?.dailySections?.[day] || {};
    sectionsCompleted += ["topics", "simulator", "notes", "placement", "assignment"].filter(key => !!sections[key]).length;
    const phases = state?.assessments?.[day] || {};
    ["pre", "post"].forEach(name => {
      const item = phases[name];
      assessmentAttempts += (item?.attempts || []).length + (item?.active ? 1 : 0);
      if (item?.passed) assessmentPasses++;
      if (item?.passed) sectionsCompleted++;
    });
    if ((state?.wheel?.[day]?.seen || []).length >= 25) sectionsCompleted++;
    const mock = state?.mockTests?.[day];
    (mock?.attempts || []).forEach(attempt => { assessmentAttempts++; if (attempt.passed) { mockTestsPassed++; assessmentPasses++; } });
    if (mock?.active) assessmentAttempts++;
  });
  assessmentAttempts += (state?.finalAssessment?.attempts || []).length + (state?.finalAssessment?.active ? 1 : 0);
  if (state?.finalAssessment?.passed) assessmentPasses++;
  const attempt = latestAttempt(state);
  const now = new Date();
  const result = {
    uid: user.uid,
    displayName: profileName,
    email: String(user.email || "").slice(0, 254),
    photoURL: String(user.photoURL || "").slice(0, 1000),
    linkedinUrl: String(profile.linkedinUrl || "").trim().slice(0, 300),
    githubUrl: String(profile.githubUrl || "").trim().slice(0, 300),
    domain: String(profile.domain || "").trim().slice(0, 120),
    collegeName: String(profile.collegeName || "").trim().slice(0, 180),
    feedbackCount: feedbackItems.length,
    attendanceCount: attendanceItems.length,
    averageContentRating: averageRating("contentRating"),
    averageDeliveryRating: averageRating("deliveryRating"),
    lastActivityAt: window.firebaseServerTimestamp(),
    lastAttemptAt: attempt ? window.firebaseTimestampFromDate(attempt.date) : null,
    lastAttemptLabel: attempt?.label || "No assessment attempts yet",
    xp: Math.max(0, Math.floor(Number(state?.xp) || 0)),
    completedDays,
    badges: (state?.dayBadges || []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day < 5),
    sectionsCompleted: Math.min(40, sectionsCompleted),
    sectionsTotal: 40,
    assessmentPasses,
    assessmentAttempts,
    mockTestsPassed,
    notesCount: Object.values(state?.notes || {}).filter(note => String(note || "").trim()).length,
    assignmentCount: Object.values(state?.answers || {}).filter(answer => String(answer || "").trim()).length,
    updatedAt: window.firebaseServerTimestamp()
  };
  if (login) result.lastLoginAt = window.firebaseServerTimestamp();
  if (user.metadata?.creationTime) result.createdAt = window.firebaseTimestampFromDate(new Date(user.metadata.creationTime));
  else if (login) result.createdAt = window.firebaseServerTimestamp();
  return result;
}

function makeDaySummary(state, day) {
  const phases=state?.assessments?.[day]||{},section=state?.dailySections?.[day]||{},pre=phases.pre||{},post=phases.post||{},mock=state?.mockTests?.[day]||{},final=day===4?(state?.finalAssessment||{}):{},wheelQuestions=Math.min(25,(state?.wheel?.[day]?.seen||[]).length);
  const completedSections=["topics","simulator","notes","placement","assignment"].filter(key=>!!section[key]).length+(pre.passed?1:0)+(post.passed?1:0)+(wheelQuestions>=25?1:0);
  const best=item=>(item?.attempts||[]).reduce((score,attempt)=>Math.max(score,Number(attempt.score)||0),0);
  const scores=item=>(item?.attempts||[]).map(x=>({score:Number(x.score)||0,passed:!!x.passed,at:x.at||null,answered:Number(x.answered)||0}));
  return {day:day+1,completedSections,sectionsTotal:8,preAttempts:(pre.attempts||[]).length+(pre.active?1:0),prePassed:!!pre.passed,preBest:best(pre),preScores:scores(pre),postAttempts:(post.attempts||[]).length+(post.active?1:0),postPassed:!!post.passed,postBest:best(post),postScores:scores(post),mockAttempts:(mock.attempts||[]).length+(mock.active?1:0),mockPassed:(mock.attempts||[]).some(x=>!!x.passed),mockBest:best(mock),mockScores:scores(mock),finalAttempts:(final.attempts||[]).length+(final.active?1:0),finalPassed:!!final.passed,finalBest:best(final),finalScores:scores(final),wheelQuestions,notesSaved:!!String(state?.notes?.[day]||"").trim(),assignmentSubmitted:!!String(state?.answers?.[day]||"").trim(),badgeEarned:(state?.dayBadges||[]).includes(day),dayComplete:!!state?.dayAwards?.[day]};
}

async function syncNow(login = false) {
  if (!currentUser || !latestState) return;
  const user = currentUser;
  const snapshot = latestState;
  syncInFlight = syncInFlight.then(async () => {
    const userDoc = window.firebaseDoc(db, "users", user.uid);
    const summary = makeSummary(user, snapshot, login);
    if (!login) {
      delete summary.lastLoginAt;
      delete summary.createdAt;
    }
    const writes = [window.firebaseSetDoc(userDoc, summary, { merge: true })];
    for (let day = 0; day < 5; day++) {
      const daily = makeDaySummary(snapshot, day);
      const key = `${user.uid}:${day + 1}`;
      const fingerprint = JSON.stringify(daily);
      if (login || syncedDayFingerprints.get(key) !== fingerprint) {
        const dayDoc = window.firebaseDoc(db, "users", user.uid, "days", `day-${day + 1}`);
        writes.push(window.firebaseSetDoc(dayDoc, { uid: user.uid, ...daily, updatedAt: window.firebaseServerTimestamp() }, { merge: true }));
        syncedDayFingerprints.set(key, fingerprint);
      }
    }
    await Promise.all(writes);
    if (currentUser?.uid === user.uid) window.firebaseSetCloudStatus("Synced to the course dashboard");
  }).catch(error => {
    console.error("Learner report sync failed", error);
    window.firebaseSetCloudStatus(readableError(error), true);
  });
  return syncInFlight;
}

function queueProgress(state) {
  if (!currentUser || !cloudReady || !state) return;
  try { latestState = JSON.parse(JSON.stringify(state)); } catch { latestState = state; }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 650);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function formatDate(value) {
  const date = dateValue(value);
  return date ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}


const COURSE_EMAIL_TEMPLATES = Object.freeze({
  welcome: {
    kind: "Welcome",
    subject: "Welcome to Digital Enablement Basics for Engineers | Phase 2",
    text: "Hello {{learner_name}},\n\nWelcome to Phase 2 of Digital Enablement Basics for Engineers. We are glad to have you with us.\n\nOver five learning days, you will explore cloud computing, information security, artificial intelligence, connected technologies, and future engineering applications. The portal is open daily from 8:00 AM to 8:00 PM local time. Complete the eight activities for each day to earn XP and your daily badge; completing all five days unlocks your course certificate.\n\nStart or continue your learning here:\nhttps://sarlayash.github.io/Digital-Enablement-Basics-for-Engineers/\n\nWarm regards,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
  },
  completion: {
    kind: "Completion",
    subject: "Congratulations, {{learner_name}} — You completed Phase 2",
    text: "Hello {{learner_name}},\n\nCongratulations on completing the five-day Digital Enablement Basics for Engineers programme. Your commitment to learning across cloud, security, AI, connected technologies, and future engineering applications is appreciated.\n\nYour course record shows {{completed_days}} of 5 days completed and {{xp}} XP earned. Your certificate is ready in the learner portal. Sign in, open Certificate, and choose Print / Save certificate to download or save it as a PDF.\n\nOpen the learner portal:\nhttps://sarlayash.github.io/Digital-Enablement-Basics-for-Engineers/\n\nWell done, and best wishes for applying these skills in your engineering work.\n\nWarm regards,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
  },
  appreciation: {
    kind: "Appreciation",
    subject: "Thank you for your participation — Digital Enablement Phase 2",
    text: "Hello {{learner_name}},\n\nThank you for your participation in Digital Enablement Basics for Engineers. Your time, questions, practice, and feedback help make the learning experience more useful for everyone.\n\nKeep building on what you learned, and continue to approach new tools with curiosity, care, and sound engineering judgement.\n\nWith appreciation,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
  },
  certificate: {
    kind: "Certificate",
    subject: "Your Digital Enablement certificate is ready, {{learner_name}}",
    text: "Hello {{learner_name}},\n\nCongratulations on completing the programme. Your Digital Enablement Basics for Engineers certificate is ready in the learner portal.\n\nYour course record shows {{completed_days}} of 5 days completed and {{xp}} XP earned. Sign in to the portal, open Certificate, and choose Print / Save certificate to download or save your certificate as a PDF.\n\nOpen the learner portal:\nhttps://sarlayash.github.io/Digital-Enablement-Basics-for-Engineers/\n\nCongratulations on your achievement.\n\nWarm regards,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
  },
  lor: {
    kind: "Letter of recommendation",
    subject: "Letter of recommendation draft for {{learner_name}}",
    text: "To the Selection Committee,\n\nI am writing in support of {{learner_name}}'s application for [opportunity or programme]. I mentored {{learner_name}} in Digital Enablement Basics for Engineers, Phase 2.\n\nCourse records confirm {{completed_days}} of 5 learning days completed and {{xp}} XP earned. The programme introduces cloud computing, information security, artificial intelligence, connected technologies, and future engineering applications.\n\n[Add a specific example you personally observed, such as a project contribution, problem-solving approach, collaboration, initiative, or learning growth.]\n\nBased on my direct experience, [add a factual assessment of strengths relevant to the opportunity]. Please contact me if further information would be useful.\n\nSincerely,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
  }
});

const MENTOR_FROM = "Mentor Kapil <kapilnarula27july@gmail.com>";

function personalizeCourseEmail(value, recipient) {
  const learnerName = String(recipient?.displayName || recipient?.email?.split("@")[0] || "Learner").trim();
  return String(value || "")
    .replace(/{{learner_name}}/g, learnerName)
    .replace(/{{completed_days}}/g, String((recipient?.completedDays || []).length))
    .replace(/{{xp}}/g, String(Number(recipient?.xp) || 0));
}

function brandedEmailHtml(subject, text) {
  const paragraphs = String(text || "").split(/\n\s*\n/).filter(Boolean).map(part => {
    const safe = escapeHTML(part).replace(/\n/g, "<br>").replace(/(https:\/\/[^\s<]+)/g, url => '<a href="' + url + '" style="color:#3159e8;text-decoration:underline">' + url + "</a>");
    return '<p style="margin:0 0 18px;color:#33415b;font:15px/1.7 Arial,sans-serif">' + safe + "</p>";
  }).join("");
  return '<!doctype html><html><body style="margin:0;background:#f3f5f8;padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e4e8ef;border-radius:14px;overflow:hidden"><tr><td style="background:#101a35;padding:26px 32px;border-bottom:5px solid #cfaa56"><div style="color:#fff;font:700 12px/1.5 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">Digital Enablement Basics for Engineers</div><div style="color:#dbe3f5;font:13px/1.5 Arial,sans-serif;margin-top:5px">Phase 2 · Galgotias University · L&amp;T EduTech</div></td></tr><tr><td style="padding:32px">' + paragraphs + '</td></tr><tr><td style="background:#f8f9fb;border-top:1px solid #e6e9ef;padding:17px 32px;color:#6d7890;font:11px/1.6 Arial,sans-serif">Mentor Kapil · Course Mentor<br>kapilnarula27july@gmail.com</td></tr></table></body></html>';
}

function bindEmailTemplateControls() {
  const select = document.getElementById("adminMessageTemplate");
  if (!select) return;
  select.addEventListener("change", () => {
    const template = COURSE_EMAIL_TEMPLATES[select.value];
    if (!template) return;
    const kind = document.getElementById("adminMessageKind");
    const subject = document.getElementById("adminMessageSubject");
    const body = document.getElementById("adminMessageBody");
    if (kind) kind.value = template.kind;
    if (subject) subject.value = template.subject;
    if (body) body.value = template.text;
  });
}

function renderAdminDashboard(fromCache = false) {
  const root = document.getElementById("firebaseAdminDashboard");
  if (!root) return;
  const activeSince = Date.now() - 24 * 60 * 60 * 1000;
  const active = adminUsers.filter(user => (dateValue(user.lastActivityAt)?.getTime() || 0) >= activeSince).length;
  const complete = adminUsers.filter(user => (user.completedDays || []).length >= 5).length;
  const attempts = adminUsers.reduce((sum, user) => sum + (Number(user.assessmentAttempts) || 0), 0);
  const passes = adminUsers.reduce((sum, user) => sum + (Number(user.assessmentPasses) || 0), 0);
  const avgXP = adminUsers.length ? Math.round(adminUsers.reduce((sum, user) => sum + (Number(user.xp) || 0), 0) / adminUsers.length) : 0;
  const ratingAverage = field => {
    const total = adminUsers.reduce((sum, user) => sum + (Number(user[field]) || 0), 0);
    const count = adminUsers.filter(user => Number(user[field]) > 0).length;
    return count ? (total / count).toFixed(1) : "—";
  };
  const query = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  const filtered = adminUsers.filter(user => `${user.displayName || ""} ${user.email || ""}`.toLowerCase().includes(query));
  const bars = Array.from({ length: 5 }, (_, day) => {
    const count = adminUsers.filter(user => (user.completedDays || []).includes(day)).length;
    const percent = adminUsers.length ? Math.round(count / adminUsers.length * 100) : 0;
    return `<div class="firebase-day-bar"><div><i style="height:${percent}%"></i></div><b>${count}</b><small>Day ${day + 1}</small></div>`;
  }).join("");
  const rows = filtered.map(user => {
    return `<tr>
    <td class="user-cell"><b>${escapeHTML(user.displayName || "Learner")}</b><span>${escapeHTML(user.email || "")}</span><button class="action secondary admin-detail-button" data-learner-uid="${escapeHTML(user.id)}">View individual detail</button></td>
    <td>${escapeHTML(formatDate(user.lastLoginAt))}</td><td>${escapeHTML(formatDate(user.lastAttemptAt))}<br><span style="color:#7b8498">${escapeHTML(user.lastAttemptLabel || "")}</span></td>
    <td>${escapeHTML(formatDate(user.createdAt))}</td><td>${(user.completedDays || []).length} / 5</td><td>${Number(user.sectionsCompleted) || 0} / 40</td>
    <td>${Number(user.assessmentPasses) || 0} / ${Number(user.assessmentAttempts) || 0}</td><td>${Number(user.mockTestsPassed) || 0}</td>
    <td>${Number(user.attendanceCount) || 0}</td><td>${Number(user.averageContentRating) ? `${Number(user.averageContentRating).toFixed(1)} / 5` : "—"}</td><td>${Number(user.averageDeliveryRating) ? `${Number(user.averageDeliveryRating).toFixed(1)} / 5` : "—"}</td>
    <td>${(user.badges || []).length}</td><td>${Number(user.xp) || 0}</td><td>${escapeHTML(formatDate(user.lastActivityAt))}</td></tr>`;
  }).join("");
  const selected = selectedAdminUid && adminUsers.find(user => user.id === selectedAdminUid);
  const scoreText = arr => Array.isArray(arr) && arr.length ? arr.map(x => Number(x.score)||0).join(", ") : "historical scores unavailable";
  const detailRows = adminDayRecords.slice().sort((a, b) => a.day - b.day).map(day => `<tr><td>Day ${day.day}</td><td>${day.completedSections || 0} / 8</td><td>${day.prePassed ? "Passed" : "Not passed"} · <b>Final score: ${escapeHTML(displayFinalAssessmentScore(day,"pre",50))}</b> · best ${day.preBest || 0}/50 · ${day.preAttempts || 0} tries<br><small>Attempt scores: ${escapeHTML(scoreText(day.preScores))}</small></td><td>${day.postPassed ? "Passed" : "Not passed"} · <b>Final score: ${escapeHTML(displayFinalAssessmentScore(day,"post",50))}</b> · best ${day.postBest || 0}/50 · ${day.postAttempts || 0} tries<br><small>Attempt scores: ${escapeHTML(scoreText(day.postScores))}</small></td><td>${day.mockPassed ? "Passed" : "Not passed"} · best ${day.mockBest || 0}/10 · ${day.mockAttempts || 0} tries<br><small>Scores: ${escapeHTML(scoreText(day.mockScores))}</small></td><td>${day.wheelQuestions || 0} / 25</td><td>${day.notesSaved ? "Saved" : "—"} · ${day.assignmentSubmitted ? "Submitted" : "—"}</td><td>${day.badgeEarned ? "Earned" : "—"}</td></tr>`).join("");
  const selectedFeedback = selected ? adminDetailFeedback.slice().sort((a, b) => (dateValue(b.submittedAt)?.getTime() || 0) - (dateValue(a.submittedAt)?.getTime() || 0)) : [];
  const selectedAttendance = selected ? adminDetailAttendance.slice().sort((a, b) => String(b.sessionDate || "").localeCompare(String(a.sessionDate || ""))) : [];
  const feedbackRows = selectedFeedback.map(item => `<tr><td>Day ${item.day}</td><td>${item.contentRating} / 5</td><td>${item.deliveryRating} / 5</td><td>${escapeHTML(item.comment || "—")}</td><td>${escapeHTML(formatDate(item.submittedAt))}</td></tr>`).join("");
  const attendanceRows = selectedAttendance.map(item => `<tr><td>${escapeHTML(item.sessionDate || "—")}</td><td>Day ${item.day}</td><td>${escapeHTML(formatDate(item.punchedInAt))}</td><td>${escapeHTML(formatDate(item.punchedOutAt))}</td><td>${item.punchedOutAt ? "Complete" : "In progress"}</td></tr>`).join("");
  const recipientOptions = filtered.map(user => `<option value="${escapeHTML(user.id)}">${escapeHTML(user.displayName || "Learner")} · ${escapeHTML(user.email || "No email")}</option>`).join("");
  const communications = `<section class="firebase-comms"><header class="firebase-comms-head"><div><span class="eyebrow" style="color:#5368c9">COURSE COMMUNICATIONS</span><h2>Notifications and Actions</h2><p>Send a live in-portal update and, when mail delivery is configured, a personalized email. Choose a polished template or write a custom message.</p></div><span class="firebase-live-indicator">ADMIN ONLY</span></header><div class="firebase-comms-grid"><label>Recipients<select id="adminMessageTarget"><option value="all">All current results · ${filtered.length} learner${filtered.length === 1 ? "" : "s"}</option>${recipientOptions}</select></label><label>Message type<select id="adminMessageKind"><option value="Reminder">Reminder</option><option value="Announcement">Announcement</option><option value="Session update">Session update</option><option value="Welcome">Welcome</option><option value="Completion">Completion</option><option value="Appreciation">Appreciation</option><option value="Certificate">Certificate</option><option value="Letter of recommendation">Letter of recommendation</option></select></label><label>Email template<select id="adminMessageTemplate"><option value="">Custom message</option><option value="welcome">Welcome</option><option value="completion">Completion</option><option value="appreciation">Appreciation</option><option value="certificate">Certificate ready</option><option value="lor">Letter of recommendation draft</option></select></label><label class="wide">Subject<input id="adminMessageSubject" maxlength="140" placeholder="Choose a template or write a subject"></label><label class="wide">Message<textarea id="adminMessageBody" maxlength="2000" placeholder="Choose a template or write the message learners should receive."></textarea><small class="firebase-template-note">Templates personalize learner name, course completion, and XP when queued.</small></label><label class="wide firebase-comms-check"><input id="adminMessageEmail" type="checkbox"><span>Also queue an email copy (requires configured mail delivery)</span></label></div><div class="firebase-comms-actions"><small>Emails use Mentor Kapil as sender through the configured mail provider. Certificate emails link to the portal; they do not attach a PDF. Review drafts before sending.</small><div class="firebase-comms-buttons"><button class="action secondary" id="testCourseEmail">Send test to Mentor Kapil</button><button class="action" id="sendCourseCommunication">Send to learners</button></div></div></section>`;
  const details = selected ? `<section class="firebase-detail"><header class="firebase-detail-head"><div><span class="eyebrow" style="color:#5368c9">INDIVIDUAL LEARNER RECORD</span><h2>${escapeHTML(selected.displayName || "Learner")}</h2><p>${escapeHTML(selected.email || "")} · ${Number(selected.xp) || 0} XP · ${(selected.completedDays || []).length}/5 days</p></div><button class="action secondary" id="closeAdminDetail">Close detail</button></header><div class="firebase-detail-scroll"><h3>Day-by-day performance &amp; final assessment scores</h3><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Day</th><th>Sections</th><th>Pre-assessment</th><th>Post-assessment</th><th>Mock assessment</th><th>Spin challenge</th><th>Notes / assignment</th><th>Badge</th></tr></thead><tbody>${detailRows || `<tr><td colspan="8" class="firebase-empty">Daily progress records are syncing. Refresh in a moment.</td></tr>`}</tbody></table></div><h3>Daily learner feedback</h3><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Day</th><th>Content</th><th>Delivery</th><th>Comment</th><th>Submitted</th></tr></thead><tbody>${feedbackRows || `<tr><td colspan="5" class="firebase-empty">No feedback submitted yet.</td></tr>`}</tbody></table></div><h3>Attendance punches</h3><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Date</th><th>Session</th><th>Punch in</th><th>Punch out</th><th>Status</th></tr></thead><tbody>${attendanceRows || `<tr><td colspan="5" class="firebase-empty">No attendance punches recorded yet.</td></tr>`}</tbody></table></div></div></section>` : "";
  root.innerHTML = `<header class="firebase-admin-head"><div><span class="eyebrow" style="color:#5368c9">ADMIN · LIVE LEARNER OPERATIONS</span><h1 id="firebaseAdminTitle">Learner performance</h1><p>Live individual progress, assessment outcomes, feedback and session attendance. Learner notes and assignment text remain private.</p></div><span class="firebase-live-indicator">${fromCache ? "CACHED SNAPSHOT" : "LIVE UPDATES"}</span></header>
    <div class="firebase-admin-kpis"><article class="firebase-admin-kpi"><small>Registered learners</small><strong>${adminUsers.length}</strong></article><article class="firebase-admin-kpi"><small>Active in last 24 hours</small><strong>${active}</strong></article><article class="firebase-admin-kpi"><small>Five-day completions</small><strong>${complete}</strong></article><article class="firebase-admin-kpi"><small>Average learner XP</small><strong>${avgXP}</strong></article><article class="firebase-admin-kpi"><small>Attendance sessions</small><strong>${adminUsers.reduce((sum, user) => sum + (Number(user.attendanceCount) || 0), 0)}</strong></article><article class="firebase-admin-kpi"><small>Daily feedback</small><strong>${adminUsers.reduce((sum, user) => sum + (Number(user.feedbackCount) || 0), 0)}</strong></article></div>
    <section class="firebase-analysis"><h2>Course pulse</h2><p>${attempts ? `${passes} passed tests out of ${attempts} recorded attempts (${Math.round(passes / attempts * 100)}% pass rate).` : "No assessment attempts have been recorded yet."} Average content rating: ${ratingAverage("averageContentRating")} / 5 · average delivery rating: ${ratingAverage("averageDeliveryRating")} / 5. Completion bars show learners who have finished each day.</p><div class="firebase-day-chart">${bars}</div></section>${communications}
    <section class="firebase-analysis"><h2>Assessment reports</h2><p>Download daily or consolidated pre, post, mock, and final assessment scores. PDF opens the print dialog; choose Save as PDF.</p><label>Daily report day <select id="assessmentDay"><option value="1">Day 1</option><option value="2">Day 2</option><option value="3">Day 3</option><option value="4">Day 4</option><option value="5">Day 5</option></select></label> <button class="action" id="dailyAssessCsv">Daily CSV</button> <button class="action secondary" id="dailyAssessPdf">Daily PDF</button> <button class="action" id="allAssessCsv">Consolidated CSV</button> <button class="action secondary" id="allAssessPdf">Consolidated PDF</button><p id="assessmentReportStatus" role="status"></p></section>
    <section class="firebase-users"><div class="panelhead"><div><h2>All learner records</h2><p class="assessment-sub">Open an individual profile for daily scores, notes/assignment completion, feedback, and attendance punches.</p></div></div><div class="firebase-users-toolbar"><input id="adminSearch" type="search" placeholder="Filter by learner name or email" aria-label="Filter learner records"><button class="action" id="downloadAdminCsv">Download performance CSV</button><button class="action secondary" id="downloadActivityCsv">Download feedback & attendance CSV</button></div><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Learner</th><th>Last sign-in</th><th>Last attempt</th><th>Registered</th><th>Days</th><th>Sections</th><th>Assessment pass / attempts</th><th>Mock passes</th><th>Attendance</th><th>Content rating</th><th>Delivery rating</th><th>Badges</th><th>XP</th><th>Last activity</th></tr></thead><tbody>${rows || `<tr><td colspan="14" class="firebase-empty">${adminUsers.length ? "No learners match this filter." : "No Google learner profiles are recorded yet."}</td></tr>`}</tbody></table></div><p class="firebase-sync-note">Live Firestore listeners · ${new Date().toLocaleTimeString()} · Learner progress, feedback and punches update as they are saved.</p></section>${details}`;
  document.getElementById("adminSearch")?.addEventListener("input", () => renderAdminDashboard(fromCache));
  ["dailyAssessCsv","dailyAssessPdf","allAssessCsv","allAssessPdf"].forEach(id=>document.getElementById(id)?.addEventListener("click",async()=>{const s=document.getElementById("assessmentReportStatus");if(s)s.textContent="Preparing report…";try{await assessmentReport(id.endsWith("Csv")?"csv":"pdf",id.startsWith("all"));if(s)s.textContent="Report ready.";}catch(e){if(s)s.textContent="Report failed: "+readableError(e);}}));
  document.getElementById("downloadAdminCsv")?.addEventListener("click", downloadAdminCSV);
  document.getElementById("downloadActivityCsv")?.addEventListener("click", downloadAdminActivityCSV);
  document.getElementById("sendCourseCommunication")?.addEventListener("click", sendCourseCommunication);
  document.getElementById("testCourseEmail")?.addEventListener("click", sendTestCourseEmail);
  bindEmailTemplateControls();
  document.getElementById("closeAdminDetail")?.addEventListener("click", () => { adminDetailUnsubscribes.forEach(unsubscribe => unsubscribe()); adminDetailUnsubscribes = []; selectedAdminUid = null; adminDayRecords = []; adminDetailFeedback = []; adminDetailAttendance = []; renderAdminDashboard(fromCache); });
  root.querySelectorAll("[data-learner-uid]").forEach(button => button.addEventListener("click", () => openAdminLearnerDetail(button.dataset.learnerUid)));
}

async function finalAssessmentScore(record, phase, scale) {
 const attempts=Array.isArray(record?.[phase+"Scores"])?record[phase+"Scores"]:[];
 if(attempts.length){const last=attempts[attempts.length-1];return {score:Number(last.score)||0,legacy:false,scale};}
 const count=Number(record?.[phase+"Attempts"])||0;
 const bestKey=phase+"Best";
 return count>0&&record?.[bestKey]!=null?{score:Number(record[bestKey])||0,legacy:true,scale}:null;
}
function displayFinalAssessmentScore(record, phase, scale) {
 const value=finalAssessmentScore(record,phase,scale);
 return value?value.score+"/"+scale+(value.legacy?" · best on record":""):"—";
}
function getAssessmentReportRows(dayFilter) {
 if(!window.firebaseGetDocs||!window.firebaseIsAdmin)throw new Error("Admin report access is unavailable.");
 const rows=[];
 for(let i=0;i<adminUsers.length;i+=20){const batch=await Promise.all(adminUsers.slice(i,i+20).map(async u=>{const s=await window.firebaseGetDocs(window.firebaseCollection(db,"users",u.id,"days"));return s.docs.map(d=>({u,d:d.data()}));}));
 batch.flat().forEach(({u,d})=>{if(dayFilter&&Number(d.day)!==dayFilter)return;const scores=(key,best,passed,scale)=>{const a=Array.isArray(d[key])?d[key]:(Number(d[best])>0?[{score:d[best],passed:d[passed]}]:[]);return a.length?a.map((x,n)=>(Number(x.score)||0)+"/"+scale+(x.passed?" pass":"") +" #"+(n+1)).join("; "):"No score recorded";};
 rows.push({name:u.displayName||"Learner",email:u.email||"",day:d.day,preFinal:displayFinalAssessmentScore(d,"pre",50),postFinal:displayFinalAssessmentScore(d,"post",50),pre:scores("preScores","preBest","prePassed",50),post:scores("postScores","postBest","postPassed",50),mock:scores("mockScores","mockBest","mockPassed",10),final:scores("finalScores","finalBest","finalPassed",25),xp:Number(u.xp)||0,badges:(u.badges||[]).length,complete:d.dayComplete?"Yes":"No",updated:formatDate(d.updatedAt)});
 });}
 return rows.sort((a,b)=>a.day-b.day||a.name.localeCompare(b.name));
}
function assessmentCSV(rows,label){const h=["Learner","Email","Day","Pre final score","Post final score","Pre scores/attempts","Post scores/attempts","Mock scores/attempts","Final assessment scores/attempts","XP","Badges","Day complete","Updated"];const cs=v=>csvCell(v);const body=rows.map(r=>[r.name,r.email,"Day "+r.day,r.preFinal,r.postFinal,r.pre,r.post,r.mock,r.final,r.xp,r.badges,r.complete,r.updated].map(cs).join(","));const blob=new Blob(["\\uFEFF"+[h.map(cs).join(","),...body].join("\\r\\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=label+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function assessmentReport(format,allDays){const day=allDays?null:Number(document.getElementById("assessmentDay")?.value||1);const rows=await getAssessmentReportRows(day);if(format==="csv")return assessmentCSV(rows,allDays?"consolidated-assessment-report":"daily-assessment-report-day-"+day);const w=window.open("","_blank");if(!w)throw new Error("Allow pop-ups to print or save PDF.");const h=["Learner","Email","Day","Pre final score","Post final score","Pre attempts","Post attempts","Mock scores","Final assessment scores","XP","Badges","Complete","Updated"];const esc=escapeHTML;const table="<table><thead><tr>"+h.map(x=>"<th>"+x+"</th>").join("")+"</tr></thead><tbody>"+rows.map(r=>"<tr>"+[r.name,r.email,r.day,r.preFinal,r.postFinal,r.pre,r.post,r.mock,r.final,r.xp,r.badges,r.complete,r.updated].map(x=>"<td>"+esc(x)+"</td>").join("")+"</tr>").join("")+"</tbody></table>";w.document.write("<!doctype html><html><head><title>Assessment report</title><style>body{font:12px Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3df;padding:6px;text-align:left}th{background:#eaf0ff}</style></head><body><h1>"+(allDays?"Consolidated":"Daily · Day "+day)+" Assessment Report</h1><p>Digital Enablement Basics for Engineers · "+esc(new Date().toLocaleString())+"</p>"+table+"<script>window.onload=function(){window.print()}<\\/script></body></html>");w.document.close();}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+@\-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadAdminCSV() {
  const query = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  const filtered = adminUsers.filter(user => `${user.displayName || ""} ${user.email || ""}`.toLowerCase().includes(query));
  const header = ["Name", "Email", "Last login", "Last attempt", "Last attempt type", "Registered", "Days completed", "Sections completed", "Assessment passes", "Assessment attempts", "Mock passes", "XP", "Badges earned", "Last activity"];
  const rows = filtered.map(user => [user.displayName, user.email, formatDate(user.lastLoginAt), formatDate(user.lastAttemptAt), user.lastAttemptLabel, formatDate(user.createdAt), (user.completedDays || []).length, user.sectionsCompleted, user.assessmentPasses, user.assessmentAttempts, user.mockTestsPassed, user.xp, (user.badges || []).length, formatDate(user.lastActivityAt)]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `digital-enablement-learner-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAdminActivityCSV() {
  const header = ["Learner", "Email", "Attendance sessions", "Feedback entries", "Average content rating", "Average delivery rating", "Last activity"];
  const rows = adminUsers.map(user => [user.displayName, user.email, user.attendanceCount || 0, user.feedbackCount || 0, user.averageContentRating || "", user.averageDeliveryRating || "", formatDate(user.lastActivityAt)]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `digital-enablement-engagement-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function sendCourseCommunication() {
  if (!window.firebaseIsAdmin || !currentUser || !db || !window.firebaseWriteBatch) return;
  const target = document.getElementById("adminMessageTarget")?.value || "all";
  const templateId = document.getElementById("adminMessageTemplate")?.value || "";
  const kind = String(document.getElementById("adminMessageKind")?.value || COURSE_EMAIL_TEMPLATES[templateId]?.kind || "Reminder").trim().slice(0, 80);
  const subject = String(document.getElementById("adminMessageSubject")?.value || "").trim().slice(0, 140);
  const message = String(document.getElementById("adminMessageBody")?.value || "").trim().slice(0, 2000);
  const includeEmail = !!document.getElementById("adminMessageEmail")?.checked;
  const query = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  const filtered = adminUsers.filter(user => (user.displayName || "").concat(" ", user.email || "").toLowerCase().includes(query));
  let recipients = target === "all" ? filtered : adminUsers.filter(user => user.id === target);
  if (!subject || !message) {
    window.toast?.("Add both a subject and a message before sending.");
    return;
  }
  if (!recipients.length) {
    window.toast?.("Choose at least one learner to receive this update.");
    return;
  }
  if (templateId === "lor" && target === "all") {
    window.toast?.("Choose one learner for a letter of recommendation draft.");
    return;
  }
  if (templateId === "lor" && /\[[^\]]+\]/.test(message)) {
    window.toast?.("Complete the bracketed recommendation fields before sending.");
    return;
  }
  if (templateId === "completion" || templateId === "certificate") {
    if (target === "all") recipients = recipients.filter(user => (user.completedDays || []).length >= 5);
    else if ((recipients[0].completedDays || []).length < 5) {
      window.toast?.("This learner has not completed all five days yet.");
      return;
    }
    if (!recipients.length) {
      window.toast?.("No completed learners in the current recipient list.");
      return;
    }
  }
  const button = document.getElementById("sendCourseCommunication");
  if (button) { button.disabled = true; button.textContent = "Sending…"; }
  try {
    const stamp = Date.now();
    const chunks = [];
    for (let offset = 0; offset < recipients.length; offset += 200) chunks.push(recipients.slice(offset, offset + 200));
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const batch = window.firebaseWriteBatch(db);
      chunks[chunkIndex].forEach((recipient, index) => {
        const id = stamp + "-" + chunkIndex + "-" + index;
        const finalSubject = personalizeCourseEmail(subject, recipient).slice(0, 140);
        const finalMessage = personalizeCourseEmail(message, recipient).slice(0, 2000);
        batch.set(window.firebaseDoc(db, "users", recipient.id, "notifications", "notice-" + id), {
          uid: recipient.id,
          title: finalSubject,
          message: finalMessage,
          kind,
          senderName: "Mentor Kapil",
          createdAt: window.firebaseServerTimestamp()
        });
        if (includeEmail && recipient.email) {
          batch.set(window.firebaseDoc(db, "mail", "course-" + id), {
            to: recipient.email,
            from: MENTOR_FROM,
            replyTo: "kapilnarula27july@gmail.com",
            recipientUid: recipient.id,
            source: "digital-enablement-admin",
            createdAt: window.firebaseServerTimestamp(),
            message: { subject: finalSubject, text: finalMessage, html: brandedEmailHtml(finalSubject, finalMessage) }
          });
        }
      });
      await batch.commit();
    }
    const queuedEmailCount = includeEmail ? recipients.filter(recipient => recipient.email).length : 0;
    window.toast?.("In-portal notification sent to " + recipients.length + " learner" + (recipients.length === 1 ? "" : "s") + (queuedEmailCount ? "; " + queuedEmailCount + " email " + (queuedEmailCount === 1 ? "copy queued" : "copies queued") + " for delivery." : "."));
    const body = document.getElementById("adminMessageBody");
    if (body) body.value = "";
  } catch (error) {
    console.error("Course communication failed", error);
    window.toast?.(readableError(error));
  } finally {
    if (button) { button.disabled = false; button.textContent = "Send to learners"; }
  }
}

async function sendTestCourseEmail() {
  if (!window.firebaseIsAdmin || !currentUser || !db || !window.firebaseWriteBatch) return;
  const button = document.getElementById("testCourseEmail");
  if (button) { button.disabled = true; button.textContent = "Queueing test…"; }
  try {
    const subject = String(document.getElementById("adminMessageSubject")?.value || "").trim().slice(0, 140);
    const body = String(document.getElementById("adminMessageBody")?.value || "").trim().slice(0, 2000);
    if (!subject || !body) {
      window.toast?.("Choose an email template or add a subject and message first.");
      return;
    }
    const recipient = { displayName: "Mentor Kapil", email: "kapilnarula27july@gmail.com", completedDays: [], xp: 0 };
    const finalSubject = personalizeCourseEmail(subject, recipient).slice(0, 140);
    const finalBody = personalizeCourseEmail(body, recipient).slice(0, 2000);
    const ref = window.firebaseDoc(db, "mail", "test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    const batch = window.firebaseWriteBatch(db);
    batch.set(ref, {
      to: recipient.email,
      from: MENTOR_FROM,
      replyTo: recipient.email,
      recipientUid: currentUser.uid,
      source: "digital-enablement-admin",
      createdAt: window.firebaseServerTimestamp(),
      message: { subject: finalSubject, text: finalBody, html: brandedEmailHtml(finalSubject, finalBody) }
    });
    await batch.commit();
    window.toast?.("Test email queued to " + recipient.email + "; checking delivery status…");
    await new Promise(resolve => {
      let unsubscribe = () => {};
      const timeout = window.setTimeout(() => {
        unsubscribe();
        window.toast?.("The test is queued, but no delivery confirmation arrived. Check Firebase Trigger Email and SMTP settings.");
        resolve();
      }, 20000);
      unsubscribe = window.firebaseOnSnapshot(ref, snapshot => {
        const state = snapshot.data()?.delivery?.state;
        if (state === "SUCCESS" || state === "ERROR") {
          clearTimeout(timeout);
          unsubscribe();
          window.toast?.(state === "SUCCESS" ? "Test email delivered to " + recipient.email + "." : "Test email failed. Check the Firebase mail delivery error.");
          resolve();
        }
      }, error => {
        clearTimeout(timeout);
        unsubscribe();
        window.toast?.(readableError(error));
        resolve();
      });
    });
  } catch (error) {
    console.error("Test email failed", error);
    window.toast?.(readableError(error));
  } finally {
    if (button) { button.disabled = false; button.textContent = "Send test to Mentor Kapil"; }
  }
}

function openAdminLearnerDetail(uid) {
  if (!uid || !db || !window.firebaseIsAdmin) return;
  selectedAdminUid = uid;
  adminDayRecords = [];
  adminDetailFeedback = [];
  adminDetailAttendance = [];
  adminDetailUnsubscribes.forEach(unsubscribe => unsubscribe());
  adminDetailUnsubscribes = [];
  const user = adminUsers.find(item => item.id === uid);
  if (user) renderAdminDashboard(false);
  const onDetailError = error => {
    adminDayRecords = [];
    const root = document.getElementById("firebaseAdminDashboard");
    const note = root?.querySelector(".firebase-detail-scroll");
    if (note) note.insertAdjacentHTML("afterbegin", `<p class="firebase-error">${escapeHTML(readableError(error))}</p>`);
  };
  adminDetailUnsubscribes = [
    window.firebaseOnSnapshot(window.firebaseCollection(db, "users", uid, "days"), snapshot => { adminDayRecords = snapshot.docs.map(item => item.data()); renderAdminDashboard(snapshot.metadata.fromCache); }, onDetailError),
    window.firebaseOnSnapshot(window.firebaseCollection(db, "users", uid, "feedback"), snapshot => { adminDetailFeedback = snapshot.docs.map(item => item.data()); renderAdminDashboard(snapshot.metadata.fromCache); }, onDetailError),
    window.firebaseOnSnapshot(window.firebaseCollection(db, "users", uid, "attendance"), snapshot => { adminDetailAttendance = snapshot.docs.map(item => item.data()); renderAdminDashboard(snapshot.metadata.fromCache); }, onDetailError)
  ];
}

function startAdminListener() {
  if (!window.firebaseIsAdmin || adminUnsubscribes.length || !db) return;
  const indicator = document.querySelector(".firebase-live-indicator");
  if (indicator) indicator.textContent = "CONNECTING…";
  const onError = error => {
    adminUnsubscribes.forEach(unsubscribe => unsubscribe());
    adminUnsubscribes = [];
    const root = document.getElementById("firebaseAdminDashboard");
    if (root) root.innerHTML = `<section class="panel"><h2>Admin report unavailable</h2><p>${escapeHTML(readableError(error))}</p><p>Confirm your admin claim and deploy the current Firestore rules.</p></section>`;
  };
  adminUnsubscribes = [window.firebaseOnSnapshot(window.firebaseCollection(db, "users"), snapshot => {
    adminUsers = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (dateValue(b.lastActivityAt)?.getTime() || 0) - (dateValue(a.lastActivityAt)?.getTime() || 0));
    renderAdminDashboard(snapshot.metadata.fromCache);
  }, onError)];
}

function setAdminAccess(enabled) {
  window.firebaseIsAdmin = enabled;
  const nav = document.getElementById("navAdmin");
  if (nav) nav.hidden = !enabled;
  if (!enabled) {
    adminUnsubscribes.forEach(unsubscribe => unsubscribe());
    adminUnsubscribes = [];
    adminDetailUnsubscribes.forEach(unsubscribe => unsubscribe());
    adminDetailUnsubscribes = [];
    selectedAdminUid = null;
    adminDayRecords = [];
    adminDetailFeedback = [];
    adminDetailAttendance = [];
    document.getElementById("firebaseAdminDashboard")?.setAttribute("hidden", "");
  }
}

function localSessionDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

window.firebaseGetDailyFeedback = day => myFeedback[`day-${day + 1}`] || null;
window.firebaseGetDailyAttendance = day => {
  const date = localSessionDate();
  return Object.values(myAttendance).find(record => record.day === day + 1 && record.sessionDate === date) || null;
};
window.firebaseSubmitDailyFeedback = async (day, feedback) => {
  if (!currentUser || !cloudReady) throw new Error("Sign in with Google to share feedback with the course team.");
  const ref = window.firebaseDoc(db, "users", currentUser.uid, "feedback", `day-${day + 1}`);
  await window.firebaseSetDoc(ref, {
    uid: currentUser.uid,
    learnerName: String(currentUser.displayName || currentUser.email || "Learner").slice(0, 120),
    email: String(currentUser.email || "").slice(0, 254),
    day: day + 1,
    contentRating: feedback.contentRating,
    deliveryRating: feedback.deliveryRating,
    comment: String(feedback.comment || "").trim().slice(0, 1000),
    submittedAt: window.firebaseServerTimestamp(),
    updatedAt: window.firebaseServerTimestamp()
  }, { merge: true });
};
window.firebasePunchAttendance = async (day, action) => {
  if (!currentUser || !cloudReady) throw new Error("Sign in with Google to record attendance for the course team.");
  const sessionDate = localSessionDate();
  const recordId = `day-${day + 1}-${sessionDate}`;
  const ref = window.firebaseDoc(db, "users", currentUser.uid, "attendance", recordId);
  if (action === "in") {
    const existing = myAttendance[recordId];
    if (existing?.punchedInAt) throw new Error("You have already punched in for this session.");
    await window.firebaseSetDoc(ref, {
      uid: currentUser.uid,
      learnerName: String(currentUser.displayName || currentUser.email || "Learner").slice(0, 120),
      email: String(currentUser.email || "").slice(0, 254),
      day: day + 1,
      sessionDate,
      punchedInAt: window.firebaseServerTimestamp(),
      punchedOutAt: null,
      updatedAt: window.firebaseServerTimestamp()
    });
    return;
  }
  const existing = myAttendance[recordId];
  if (!existing?.punchedInAt) throw new Error("Punch in before you punch out.");
  if (existing.punchedOutAt) throw new Error("You have already punched out for this session.");
  await window.firebaseSetDoc(ref, { punchedOutAt: window.firebaseServerTimestamp(), updatedAt: window.firebaseServerTimestamp() }, { merge: true });
};

function startLearnerActivityListeners(user) {
  myFeedbackUnsubscribe?.();
  myAttendanceUnsubscribe?.();
  myNotificationsUnsubscribe?.();
  myFeedback = {};
  myAttendance = {};
  myNotifications = [];
  myFeedbackUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users", user.uid, "feedback"), snapshot => {
    myFeedback = Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()]));
    for (let day = 0; day < 5; day++) window.refreshDailyFeedback?.(day);
    if (latestState) queueProgress(latestState);
  }, error => window.firebaseSetCloudStatus(readableError(error), true));
  myAttendanceUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users", user.uid, "attendance"), snapshot => {
    myAttendance = Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()]));
    for (let day = 0; day < 5; day++) window.refreshDailyAttendance?.(day);
    if (latestState) queueProgress(latestState);
  }, error => window.firebaseSetCloudStatus(readableError(error), true));
  myNotificationsUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users", user.uid, "notifications"), snapshot => {
    myNotifications = snapshot.docs.map(item => item.data()).sort((a, b) => (dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0));
    updateNotificationBadge();
    if (!document.getElementById("firebaseNotificationsPanel")?.hidden) renderNotificationsPanel();
  }, error => window.firebaseSetCloudStatus(readableError(error), true));
}

installPortalControls();
window.firebaseSetCloudStatus = (message, error = false) => {
  const status = document.getElementById("firebaseLoginStatus");
  const cloudStatus = document.getElementById("firebaseCloudStatus");
  if (status) status.textContent = message;
  if (cloudStatus) {
    cloudStatus.textContent = message;
    cloudStatus.style.color = error ? "#a1362c" : "";
  }
};
window.firebaseQueueProgress = queueProgress;
window.firebaseSetAdminAccess = setAdminAccess;

try {
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-firestore.js`)
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  auth = authSdk.getAuth(app);
  db = firestoreSdk.getFirestore(app);
  window.firebaseDoc = firestoreSdk.doc;
  window.firebaseGetDoc = firestoreSdk.getDoc;
  window.firebaseGetDocs = firestoreSdk.getDocs;
  window.firebaseSetDoc = firestoreSdk.setDoc;
  window.firebaseCollection = firestoreSdk.collection;
  window.firebaseCollectionGroup = firestoreSdk.collectionGroup;
  window.firebaseWriteBatch = firestoreSdk.writeBatch;
  window.firebaseOnSnapshot = firestoreSdk.onSnapshot;
  window.firebaseServerTimestamp = firestoreSdk.serverTimestamp;
  window.firebaseTimestampFromDate = firestoreSdk.Timestamp.fromDate;
  cloudReady = true;
  const googleButton = document.getElementById("googleSignInButton");
  if (googleButton) googleButton.disabled = false;

  window.firebaseSignInGoogle = async () => {
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const button = document.getElementById("googleSignInButton");
    if (button) button.disabled = true;
    loginMessage("Opening Google sign-in…");
    try {
      await authSdk.signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked") {
        try { await authSdk.signInWithRedirect(auth, provider); return; }
        catch (redirectError) { loginMessage(readableError(redirectError), true); return; }
      }
      loginMessage(readableError(error), true);
    } finally {
      if (button) button.disabled = false;
    }
  };
  window.firebaseSignOut = () => authSdk.signOut(auth).catch(error => loginMessage(readableError(error), true));

  authSdk.onAuthStateChanged(auth, async user => {
    const previous = currentUser;
    currentUser = user;
    window.firebaseCurrentUserUid = user?.uid || "";
    if (!user) {
      myFeedbackUnsubscribe?.();
      myAttendanceUnsubscribe?.();
      myNotificationsUnsubscribe?.();
      myFeedbackUnsubscribe = null;
      myAttendanceUnsubscribe = null;
      myNotificationsUnsubscribe = null;
      myFeedback = {};
      myAttendance = {};
      myNotifications = [];
      updateNotificationBadge();
      setAdminAccess(false);
      if (previous) window.deactivateFirebaseLearner?.(previous.uid);
      return;
    }
    try {
      const token = await authSdk.getIdTokenResult(user);
      const isAdmin = token.claims.admin === true;
      setAdminAccess(isAdmin);
      window.activateFirebaseLearner?.(user, isAdmin);
      await hydrateProfileFromCloud(user);
      startLearnerActivityListeners(user);
      latestState = window.getLearnerStateForFirebase?.() || {};
      await syncNow(true);
      loginMessage(isAdmin ? `Signed in as course admin · ${user.email}` : `Signed in as ${user.email}. Progress sync is active.`);
    } catch (error) {
      console.error("Firebase profile initialization failed", error);
      loginMessage(readableError(error), true);
    }
  });
} catch (error) {
  console.error("Firebase web SDK could not initialize", error);
  const button = document.getElementById("googleSignInButton");
  if (button) button.disabled = true;
  loginMessage("Google sign-in is temporarily unavailable. Check the connection and Firebase setup.", true);
}
