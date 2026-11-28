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
let adminRosterScores = new Map();
let adminRosterScoreLoad = 0;
let adminFeedback = [];
let adminAttendance = [];
let adminAllDayRecords = [];
let adminAnalyticsDay = "all";
let adminAnalyticsRange = "30";
let adminSearchTerm = "";
let adminAnalyticsReady = { users: false, days: false, feedback: false, attendance: false };
let adminAnalyticsCache = { users: false, days: false, feedback: false, attendance: false };
let adminAnalyticsErrors = {};
let selectedAdminUid = null;
let adminDayRecords = [];
let adminDetailFeedback = [];
let adminDetailAttendance = [];
let latestState = null;
let syncTimer = 0;
let syncRetryTimer = 0;
let syncRetryDelay = 1000;
let idleLogoutTimer = 0;
let attendanceAutoCloseTimer = 0;
const autoPunchOutInFlight = new Set();
const attendancePunchInFlight = new Set();
let syncInFlight = Promise.resolve();
let cloudReady = false;
const syncedDayFingerprints = new Map();
let myFeedback = {};
let myAttendance = {};
let myNotifications = [];
let myFeedbackServerReady = false;
let myAttendanceServerReady = false;
let leaderboardEntriesByDay = Array.from({ length: 5 }, () => []);
let activeLeaderboardDay = 0;
let leaderboardUnsubscribe = null;
let generatedNotifications = [];
let myFeedbackUnsubscribe = null;
let myAttendanceUnsubscribe = null;
let myNotificationsUnsubscribe = null;
let myProgressUnsubscribe = null;

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
    .firebase-notification-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}.firebase-notification-actions a{font-size:11px;font-weight:700;color:#3c59b7;text-decoration:none}.notification-open-day{padding:7px 10px!important;font-size:10px!important}.notification-nav-count{float:right;min-width:18px;padding:2px 5px;border-radius:99px;background:#e8efff;color:#3d58be;font:9px 'DM Mono';text-align:center}.firebase-profile,.firebase-notifications{padding:26px 0 50px}.firebase-profile[hidden],.firebase-notifications[hidden]{display:none}.firebase-profile-head,.firebase-notifications-head,.firebase-comms-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:17px}.firebase-profile-head h1,.firebase-notifications-head h1{font:800 26px Manrope;margin:5px 0;color:#203052}.firebase-profile-head p,.firebase-notifications-head p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.firebase-profile-card{max-width:850px;padding:20px;background:#fff;border:1px solid var(--line);border-radius:16px}.firebase-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.firebase-profile-field{display:grid;gap:6px}.firebase-profile-field label{font-size:11px;font-weight:700;color:#43516d}.firebase-profile-field input{width:100%;border:1px solid #dce2ec;border-radius:9px;padding:10px 11px;color:#33415b;font-size:12px}.firebase-profile-field small{font-size:10px;color:#758096;line-height:1.45}.firebase-profile-field.wide{grid-column:1/-1}.firebase-profile-card .action{margin-top:17px}.firebase-profile-sync{margin:12px 0 0;color:#55708d;font-size:10px}.firebase-notification-list{display:grid;gap:11px;max-width:900px}.firebase-notification{padding:16px;border:1px solid #dfe5ee;border-radius:14px;background:#fff}.firebase-notification-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.firebase-notification h3{margin:0;font:800 14px Manrope;color:#253553}.firebase-notification p{margin:9px 0 0;color:#5f6b82;font-size:12px;line-height:1.65;white-space:pre-wrap}.firebase-notification time{font:10px 'DM Mono';color:#768197;white-space:nowrap}.firebase-comms{margin:0 0 16px;padding:19px;border:1px solid #d7e1f2;border-radius:16px;background:linear-gradient(145deg,#f6f9ff,#fff)}.firebase-comms h2{margin:0;font:800 16px Manrope;color:#243454}.firebase-comms p{font-size:11px;line-height:1.55;color:#67738a;margin:6px 0 0}.firebase-comms-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.firebase-comms-grid label{display:grid;gap:6px;color:#49566f;font-size:10px;font-weight:700}.firebase-comms-grid input,.firebase-comms-grid select,.firebase-comms-grid textarea{width:100%;border:1px solid #dce2ed;border-radius:9px;padding:10px;background:#fff;color:#35425d;font-size:11px}.firebase-comms-grid textarea{min-height:94px;resize:vertical}.firebase-comms-grid .wide{grid-column:1/-1}.firebase-comms-check{display:flex!important;grid-template-columns:auto 1fr;align-items:center;gap:8px!important;font-size:11px!important}.firebase-comms-check input{width:auto}.firebase-comms-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:13px}.firebase-comms-actions small{color:#69768d;font-size:10px;line-height:1.45}
    @media(max-width:800px){.firebase-admin-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.firebase-admin-head,.firebase-detail-head,.firebase-profile-head,.firebase-notifications-head,.firebase-comms-head{flex-direction:column}.firebase-users{padding:13px}.firebase-users-toolbar{flex-wrap:wrap}.firebase-users-toolbar input{flex-basis:100%}.firebase-profile-grid,.firebase-comms-grid{grid-template-columns:1fr}.firebase-profile-field.wide,.firebase-comms-grid .wide{grid-column:auto}.firebase-comms-actions{align-items:flex-start;flex-direction:column}}

    .firebase-admin-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
    .firebase-admin-kpi span{display:block;margin-top:6px;color:#78839a;font-size:10px;line-height:1.45}
    .firebase-powerbi{margin:0 0 16px;padding:19px;background:linear-gradient(145deg,#f7f9ff,#fff 48%);border:1px solid #dfe5f0;border-radius:18px;box-shadow:0 10px 28px #15254a08}
    .firebase-powerbi-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}
    .firebase-powerbi-head h2{font:800 17px Manrope;margin:2px 0;color:#203052}
    .firebase-powerbi-head p{margin:5px 0 0;color:#718097;font-size:11px;line-height:1.5}
    .firebase-analytics-filters{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap}
    .firebase-analytics-filters label{display:grid;gap:5px;color:#657189;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.55px}
    .firebase-analytics-filters select{min-width:130px;border:1px solid #dce3ee;border-radius:9px;background:#fff;color:#30405e;padding:9px 11px;font:600 11px Manrope}
    .firebase-analytics-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
    .firebase-chart-card{grid-column:span 3;min-width:0;padding:15px;background:#fff;border:1px solid #e5eaf2;border-radius:14px;box-shadow:0 5px 16px #16274706}
    .firebase-chart-card--score{grid-column:span 7}
    .firebase-chart-card--activity{grid-column:span 5}
    .firebase-chart-card--donut{grid-column:span 3}
    .firebase-chart-title{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:7px}
    .firebase-chart-title h3{margin:0;color:#253653;font:800 12px Manrope}
    .firebase-chart-title p{margin:4px 0 0;color:#79859a;font-size:9px;line-height:1.45}
    .firebase-chart-tag{flex:none;border-radius:99px;padding:5px 7px;background:#f1f4fa;color:#697890;font:9px 'DM Mono'}
    .firebase-chart-svg{display:block;width:100%;height:auto;overflow:visible}
    .firebase-chart-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
    .firebase-chart-legend span{display:inline-flex;align-items:center;gap:5px;color:#64718a;font-size:9px}
    .firebase-chart-legend i{width:8px;height:8px;border-radius:3px;display:inline-block}
    .firebase-chart-empty{display:grid;place-items:center;min-height:150px;padding:15px;border:1px dashed #dce3ee;border-radius:10px;color:#8490a4;text-align:center;font-size:11px;line-height:1.5}
    .firebase-donut-layout{display:grid;grid-template-columns:116px minmax(0,1fr);align-items:center;gap:12px;min-height:150px}
    .firebase-donut{position:relative;width:112px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;margin:auto}
    .firebase-donut:before{content:'';position:absolute;inset:18px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1px #edf0f5}
    .firebase-donut-center{position:relative;z-index:1;text-align:center}
    .firebase-donut-center b{display:block;color:#243452;font:800 19px Manrope}
    .firebase-donut-center small{display:block;margin-top:2px;color:#7b879d;font-size:8px}
    .firebase-donut-legend{display:grid;gap:7px}
    .firebase-donut-legend span{display:grid;grid-template-columns:9px 1fr auto;gap:6px;align-items:center;color:#69758b;font-size:9px}
    .firebase-donut-legend i{width:8px;height:8px;border-radius:50%}
    .firebase-donut-legend b{color:#334360;font:700 9px 'DM Mono'}
    .firebase-analytics-warning{margin:12px 0 0;padding:9px 11px;border-radius:9px;background:#fff5e8;color:#865316;font-size:10px;line-height:1.5}
    .firebase-print-dashboard{white-space:nowrap}
    @media(max-width:1100px){.firebase-admin-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.firebase-chart-card--donut{grid-column:span 6}}
    @media(max-width:800px){.firebase-admin-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.firebase-powerbi{padding:14px}.firebase-powerbi-head{flex-direction:column}.firebase-chart-card--score,.firebase-chart-card--activity{grid-column:span 12}.firebase-chart-card--donut{grid-column:span 6}.firebase-donut-layout{grid-template-columns:100px minmax(0,1fr)}.firebase-donut{width:96px}}
    @media(max-width:560px){.firebase-chart-card--donut{grid-column:span 12}.firebase-analytics-filters{width:100%}.firebase-analytics-filters label{flex:1;min-width:135px}.firebase-analytics-filters select{width:100%}.firebase-donut-layout{grid-template-columns:112px minmax(0,1fr)}.firebase-donut{width:104px}}
    @media print{.firebase-admin-head,.firebase-analytics-filters,.firebase-users-toolbar,.admin-detail-button,.firebase-comms,.firebase-notification-actions,#navAdmin{display:none!important}.firebase-admin{padding:0!important}.firebase-chart-card,.firebase-powerbi,.firebase-analysis,.firebase-users{break-inside:avoid;box-shadow:none!important}}

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
  if (code.includes("permission-denied")) return "Firebase denied a Firestore read or write. Check that the latest rules are published and refresh; local progress remains saved on this device.";
  if (code.includes("failed-precondition")) return "Firestore needs setup or an index. Confirm the database is initialized and review Firebase Console for the required index.";
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) return "Firebase is temporarily unreachable. Progress is saved on this device and will retry when the connection returns.";
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

const DAILY_REFERENCE_LINKS = [
  { title: "AWS: What is cloud computing?", url: "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/what-is-cloud-computing.html" },
  { title: "CISA: Secure Our World", url: "https://www.cisa.gov/secure-our-world" },
  { title: "NIST: AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
  { title: "NIST: Internet of Things", url: "https://www.nist.gov/internet-things-iot" },
  { title: "NASA: Learning Resources", url: "https://www.nasa.gov/learning-resources/" }
];
function generatedNoticeKey(uid) { return "fieldGuideNotifications:" + uid; }
function addGeneratedNotification(item) {
  if (!currentUser) return;
  const notice = { ...item, createdAt: item.createdAt || new Date().toISOString(), localOnly: true };
  generatedNotifications.unshift(notice);
  generatedNotifications = generatedNotifications.slice(0, 100);
  try { localStorage.setItem(generatedNoticeKey(currentUser.uid), JSON.stringify(generatedNotifications)); } catch (_) {}
  updateNotificationBadge();
  if (!document.getElementById("firebaseNotificationsPanel")?.hidden) renderNotificationsPanel();
}
function loadGeneratedNotifications(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(generatedNoticeKey(user.uid)) || "[]");
    generatedNotifications = Array.isArray(saved) ? saved.slice(0, 100) : [];
  } catch (_) { generatedNotifications = []; }
}
function addDailyLearnerNotifications(user, state) {
  if (!user || window.firebaseIsAdmin) return;
  const today = localSessionDate(), key = "fieldGuideDailyWelcome:" + user.uid;
  try { if (localStorage.getItem(key) === today) return; localStorage.setItem(key, today); } catch (_) {}
  addGeneratedNotification({ kind: "Welcome", title: "Welcome back to your learning day", message: "Welcome back, " + String(state?.profile?.fullName || state?.name || user.displayName || "Learner") + ". Your five-day engineering journey is ready.", day: 0, referenceTitle: DAILY_REFERENCE_LINKS[0].title, referenceUrl: DAILY_REFERENCE_LINKS[0].url });
  const day = Array.from({ length: 5 }, (_, i) => i).find(i => !state?.dayAwards?.[i]);
  if (day !== undefined) {
    const daily = makeDaySummary(state || {}, day);
    addGeneratedNotification({ kind: "Reminder", title: "Continue Day " + (day + 1) + " · " + daily.completedSections + " of 8 sections", message: "Complete the remaining learning sections today to earn your XP, badge and certificate.", day, referenceTitle: DAILY_REFERENCE_LINKS[day].title, referenceUrl: DAILY_REFERENCE_LINKS[day].url });
    const pre = state?.assessments?.[day]?.pre;
    if (!pre?.passed) addGeneratedNotification({ kind: "Assessment reminder", title: "Day " + (day + 1) + " pre-assessment is pending", message: "Take the pre-assessment during the daily learning window, then continue the lesson.", day, referenceTitle: DAILY_REFERENCE_LINKS[day].title, referenceUrl: DAILY_REFERENCE_LINKS[day].url });
    const post = state?.assessments?.[day]?.post;
    if (!post?.passed) addGeneratedNotification({ kind: "Assessment reminder", title: "Day " + (day + 1) + " post-assessment is pending", message: "Finish the lesson and post-assessment to complete today’s checklist.", day, referenceTitle: DAILY_REFERENCE_LINKS[day].title, referenceUrl: DAILY_REFERENCE_LINKS[day].url });
  } else {
    const final = state?.finalAssessment;
    if (!final?.passed) addGeneratedNotification({ kind: "Certificate reminder", title: "Your course certificate is one step away", message: "Complete the final assessment to unlock and download your course certificate.", day: 4, referenceTitle: DAILY_REFERENCE_LINKS[4].title, referenceUrl: DAILY_REFERENCE_LINKS[4].url });
  }
  const badgeDay = (state?.dayBadges || []).find(i => !(state?.badgeDownloads || []).includes(i));
  if (badgeDay !== undefined) addGeneratedNotification({ kind: "Badge reminder", title: "Download your Day " + (badgeDay + 1) + " badge", message: "Your daily badge is ready in the Certificate area. Download it as PNG or PDF.", day: badgeDay, referenceTitle: DAILY_REFERENCE_LINKS[badgeDay].title, referenceUrl: DAILY_REFERENCE_LINKS[badgeDay].url });
  const certificateDay = (state?.dayBadges || []).find(i => !(state?.certificateDownloads || []).includes(i));
  if (certificateDay !== undefined) addGeneratedNotification({ kind: "Certificate reminder", title: "Download your Day " + (certificateDay + 1) + " certificate", message: "Your daily certificate is ready. Download it as PNG or PDF and save it with your badge.", day: certificateDay, referenceTitle: DAILY_REFERENCE_LINKS[certificateDay].title, referenceUrl: DAILY_REFERENCE_LINKS[certificateDay].url });
  const hasCourseCert = (state?.done || []).length === 5 && state?.finalAssessment?.passed;
  if (hasCourseCert && !(state?.certificateDownloads || []).includes("course")) addGeneratedNotification({ kind: "Certificate reminder", title: "Download your course certificate", message: "Your course certificate is ready. Download it as PNG or PDF and share your achievement.", day: 4, referenceTitle: DAILY_REFERENCE_LINKS[4].title, referenceUrl: DAILY_REFERENCE_LINKS[4].url });
  addGeneratedNotification({ kind: "Thank you", title: "Thank you for learning with us today", message: "We appreciate your effort. Keep your notes, badges and assessment feedback close as you move through the five-day sprint.", day: day === undefined ? 4 : day, referenceTitle: DAILY_REFERENCE_LINKS[day === undefined ? 4 : day].title, referenceUrl: DAILY_REFERENCE_LINKS[day === undefined ? 4 : day].url });
}
window.addEventListener("course:notification", event => {
  const item = event.detail || {};
  if (!item.title || !item.message) return;
  addGeneratedNotification(item);
});
function updateNotificationBadge() {
  const badge = document.getElementById("notificationNavCount");
  if (!badge) return;
  const count = myNotifications.length + generatedNotifications.length;
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? "99+" : String(count);
}
function notificationLink(item) {
  const day = Number(item.day);
  const open = Number.isInteger(day) && day >= 0 && day < 5 ? `<button class="action secondary notification-open-day" type="button" onclick="showHome();openDay(${day})">Open Day ${day + 1}</button>` : "";
  let reference = "";
  try {
    const url = new URL(item.referenceUrl || "");
    if (url.protocol === "https:") reference = `<a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.referenceTitle || "Learning reference")} ↗</a>`;
  } catch (_) {}
  return open || reference ? `<div class="firebase-notification-actions">${open}${reference ? `<span>${reference}</span>` : ""}</div>` : "";
}
function renderNotificationsPanel() {
  const root = document.getElementById("firebaseNotificationsPanel");
  if (!root) return;
  const items = [...myNotifications, ...generatedNotifications].sort((a, b) => (dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0));
  const cards = items.map(item => `<article class="firebase-notification"><div class="firebase-notification-head"><div><span class="eyebrow" style="color:#5368c9">${escapeHTML(String(item.kind || "Course notification").toUpperCase())}</span><h3>${escapeHTML(item.title || "Course notification")}</h3></div><time>${escapeHTML(formatDate(item.createdAt))}</time></div><p>${escapeHTML(item.message || "")}</p>${notificationLink(item)}</article>`).join("");
  root.innerHTML = `<header class="firebase-notifications-head"><div><span class="eyebrow" style="color:#5368c9">MY NOTIFICATIONS &amp; ACTIONS</span><h1 id="firebaseNotificationsTitle">My Notifications and Actions Section</h1><p>Daily welcome, learning reminders, assessment scores, downloads, and course references.</p></div><span class="firebase-live-indicator">${currentUser ? "DAILY REMINDERS ACTIVE" : "SIGN IN TO SYNC"}</span></header><div class="firebase-notification-list">${cards || `<section class="panel"><p>${currentUser ? "No notifications yet. New messages and actions will appear here." : "Sign in with Google to receive course announcements and reminders."}</p></section>`}</div>`;
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
  const legacy = state?._legacySummary || {};
  const legacyDays = state?._legacyDayRecords || {};
  const restoredCompletedDays = Object.entries(legacyDays).filter(([, record]) => !!record?.dayComplete).map(([day]) => Number(day) - 1);
  const mergedCompletedDays = Array.from(new Set(completedDays.concat((legacy.completedDays || []).map(Number), restoredCompletedDays))).filter(day => Number.isInteger(day) && day >= 0 && day < 5).sort((a, b) => a - b);
  sectionsCompleted = Math.max(sectionsCompleted, Number(legacy.sectionsCompleted) || 0);
  assessmentAttempts = Math.max(assessmentAttempts, Number(legacy.assessmentAttempts) || 0);
  assessmentPasses = Math.max(assessmentPasses, Number(legacy.assessmentPasses) || 0);
  mockTestsPassed = Math.max(mockTestsPassed, Number(legacy.mockTestsPassed) || 0);
  const attempt = latestAttempt(state);
  const legacyAttemptDate = dateValue(legacy.lastAttemptAt);
  const lastAttemptDate = attempt?.date || legacyAttemptDate;
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
    feedbackCount: Math.max(feedbackItems.length, Number(legacy.feedbackCount) || 0),
    attendanceCount: Math.max(attendanceItems.length, Number(legacy.attendanceCount) || 0),
    averageContentRating: myFeedbackServerReady && feedbackItems.length ? averageRating("contentRating") : Number(legacy.averageContentRating) || 0,
    averageDeliveryRating: myFeedbackServerReady && feedbackItems.length ? averageRating("deliveryRating") : Number(legacy.averageDeliveryRating) || 0,
    lastActivityAt: window.firebaseServerTimestamp(),
    lastAttemptAt: lastAttemptDate ? window.firebaseTimestampFromDate(lastAttemptDate) : null,
    lastAttemptLabel: attempt?.label || legacy.lastAttemptLabel || "No assessment attempts yet",
    xp: Math.max(0, Math.floor(Number(state?.xp) || 0), Number(legacy.xp) || 0),
    completedDays: mergedCompletedDays,
    badges: Array.from(new Set((state?.dayBadges || []).concat(legacy.badges || []).map(Number))).filter(day => Number.isInteger(day) && day >= 0 && day < 5),
    sectionsCompleted: Math.min(40, sectionsCompleted),
    sectionsTotal: 40,
    assessmentPasses,
    assessmentAttempts,
    mockTestsPassed,
    notesCount: Math.max(Object.values(state?.notes || {}).filter(note => String(note || "").trim()).length, Number(legacy.notesCount) || 0),
    assignmentCount: Math.max(Object.values(state?.answers || {}).filter(answer => String(answer || "").trim()).length, Number(legacy.assignmentCount) || 0),
    updatedAt: window.firebaseServerTimestamp()
  };
  if (login) result.lastLoginAt = window.firebaseServerTimestamp();
  if (user.metadata?.creationTime) result.createdAt = window.firebaseTimestampFromDate(new Date(user.metadata.creationTime));
  else if (login) result.createdAt = window.firebaseServerTimestamp();
  return result;
}

function makeDaySummary(state, day) {
  const phases=state?.assessments?.[day]||{},section=state?.dailySections?.[day]||{},pre=phases.pre||{},post=phases.post||{},mock=state?.mockTests?.[day]||{},final=day===4?(state?.finalAssessment||{}):{},wheelQuestions=Math.min(25,(state?.wheel?.[day]?.seen||[]).length);
  const legacy=state?._legacyDayRecords?.[day+1]||{};
  const completedSections=Math.max(["topics","simulator","notes","placement","assignment"].filter(key=>!!section[key]).length+(pre.passed?1:0)+(post.passed?1:0)+(wheelQuestions>=25?1:0),Number(legacy.completedSections)||0);
  const best=item=>(item?.attempts||[]).reduce((score,attempt)=>Math.max(score,Number(attempt.score)||0),0);
  const scores=item=>(item?.attempts||[]).map(x=>({score:Number(x.score)||0,passed:!!x.passed,at:x.at||null,answered:Number(x.answered)||0}));
  const mergeScores=(current,old)=>mergeLearnerProgress({values:current},{values:Array.isArray(old)?old:[]}).values||[];
  const preScores=mergeScores(scores(pre),legacy.preScores),postScores=mergeScores(scores(post),legacy.postScores),mockScores=mergeScores(scores(mock),legacy.mockScores),finalScores=mergeScores(scores(final),legacy.finalScores);
  return {
    day:day+1,completedSections,sectionsTotal:8,
    preAttempts:Math.max((pre.attempts||[]).length+(pre.active?1:0),Number(legacy.preAttempts)||0),
    prePassed:!!pre.passed||!!legacy.prePassed,preBest:Math.max(best(pre),Number(legacy.preBest)||0),preScores,
    postAttempts:Math.max((post.attempts||[]).length+(post.active?1:0),Number(legacy.postAttempts)||0),
    postPassed:!!post.passed||!!legacy.postPassed,postBest:Math.max(best(post),Number(legacy.postBest)||0),postScores,
    mockAttempts:Math.max((mock.attempts||[]).length+(mock.active?1:0),Number(legacy.mockAttempts)||0),
    mockPassed:(mock.attempts||[]).some(x=>!!x.passed)||!!legacy.mockPassed,mockBest:Math.max(best(mock),Number(legacy.mockBest)||0),mockScores,
    finalAttempts:Math.max((final.attempts||[]).length+(final.active?1:0),Number(legacy.finalAttempts)||0),
    finalPassed:!!final.passed||!!legacy.finalPassed,finalBest:Math.max(best(final),Number(legacy.finalBest)||0),finalScores,
    wheelQuestions:Math.max(wheelQuestions,Number(legacy.wheelQuestions)||0),
    notesSaved:!!String(state?.notes?.[day]||"").trim()||!!legacy.notesSaved,
    assignmentSubmitted:!!String(state?.answers?.[day]||"").trim()||!!legacy.assignmentSubmitted,
    badgeEarned:(state?.dayBadges||[]).includes(day)||!!legacy.badgeEarned,
    dayComplete:!!state?.dayAwards?.[day]||!!legacy.dayComplete
  };
}

function makePublicLeaderboardEntry(user, state) {
  const displayName = String(state?.profile?.fullName || state?.profileName || state?.name || user.displayName || "Learner").trim().slice(0, 48);
  const dailyXp = Array.from({ length: 5 }, (_, day) => {
    const phases = state?.assessments?.[day] || {};
    const pre = phases.pre || {}, post = phases.post || {};
    const mock = state?.mockTests?.[day] || {};
    const wheelCorrect = Number(state?.wheel?.[day]?.correct) || 0;
    const completionXp = state?.dayAwards?.[day]
      ? 300 + (Number(pre.xpEarned) || 0) + (Number(post.xpEarned) || 0) + wheelCorrect * 5
      : 0;
    const mockXp = mock.xpAwarded ? 20 : 0;
    const finalXp = day === 4 && state?.finalAssessment?.xpAwarded ? 50 : 0;
    return Math.max(0, Math.min(1000, Math.floor(completionXp + mockXp + finalXp)));
  });
  return { displayName, dailyXp };
}
function renderDailyLeaderboard(day = activeLeaderboardDay) {
  activeLeaderboardDay = Math.max(0, Math.min(4, Number(day) || 0));
  const root = document.getElementById("dailyLeaderboardRows");
  const status = document.getElementById("dailyLeaderboardStatus");
  if (!root || !status) return;
  document.querySelectorAll("[data-leaderboard-day]").forEach(button => {
    const selected = Number(button.dataset.leaderboardDay) === activeLeaderboardDay;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const ranked = leaderboardEntriesByDay[activeLeaderboardDay]
    .map(item => ({ name: String(item.displayName || "").trim(), xp: Number(item.xp) || 0 }))
    .filter(item => item.name && item.xp > 0)
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .slice(0, 10);
  root.innerHTML = ranked.length ? ranked.map((item, index) =>
    `<li class="daily-leaderboard-row"><span class="daily-leaderboard-rank">${index + 1}</span><strong>${escapeHTML(item.name)}</strong><span class="daily-leaderboard-xp">${item.xp} XP</span></li>`
  ).join("") : '<li class="daily-leaderboard-empty">Scores will appear here as learners complete a day.</li>';
  if (leaderboardUnsubscribe) status.textContent = ranked.length ? "Top 10 · XP earned for this day" : "No daily XP recorded yet.";
}
function startPublicLeaderboard() {
  leaderboardUnsubscribe?.forEach(unsubscribe => unsubscribe());
  const subscriptions = [];
  for (let day = 0; day < 5; day++) {
    const dayCollection = window.firebaseCollection(db, "publicLeaderboardDays", `day-${day + 1}`, "learners");
    const topTenQuery = window.firebaseQuery(dayCollection, window.firebaseOrderBy("xp", "desc"), window.firebaseLimit(10));
    subscriptions.push(window.firebaseOnSnapshot(topTenQuery, snapshot => {
      leaderboardEntriesByDay[day] = snapshot.docs.map(item => item.data());
      renderDailyLeaderboard();
    }, error => {
      console.warn("Public daily leaderboard is unavailable", error);
      const status = document.getElementById("dailyLeaderboardStatus");
      if (status) status.textContent = "Leaderboard is waiting for the Firebase read rule to be published.";
    }));
  }
  leaderboardUnsubscribe = subscriptions;
  document.getElementById("dailyLeaderboardTabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-leaderboard-day]");
    if (button) renderDailyLeaderboard(Number(button.dataset.leaderboardDay));
  });
}
function learnerProgressFingerprint(value) {
  const normalize = item => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      if (typeof item.toDate === "function") return item.toDate().toISOString();
      return Object.keys(item).sort().reduce((result, key) => { result[key] = normalize(item[key]); return result; }, {});
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}
function mergeLearnerProgress(localState, cloudState) {
  const local = localState && typeof localState === "object" && !Array.isArray(localState) ? localState : {};
  const cloud = cloudState && typeof cloudState === "object" && !Array.isArray(cloudState) ? cloudState : {};
  const localAt = Number(local._firebaseLocalUpdatedAt) || 0;
  const cloudAt = Number(cloud._firebaseLocalUpdatedAt) || 0;
  const preferLocal = !Object.keys(cloud).length || localAt >= cloudAt;
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const merge = (left, right) => {
    if (left === undefined) return clone(right);
    if (right === undefined) return clone(left);
    if (Array.isArray(left) && Array.isArray(right)) {
      const first = preferLocal ? left : right;
      const second = preferLocal ? right : left;
      const found = new Map();
      [...first, ...second].forEach(item => {
        const key = learnerProgressFingerprint(item);
        if (!found.has(key)) found.set(key, item);
      });
      return Array.from(found.values()).map(clone);
    }
    const leftObject = left && typeof left === "object" && !Array.isArray(left);
    const rightObject = right && typeof right === "object" && !Array.isArray(right);
    if (leftObject && rightObject) {
      const result = {};
      new Set([...Object.keys(left), ...Object.keys(right)]).forEach(key => {
        result[key] = merge(left[key], right[key]);
      });
      return result;
    }
    if (typeof left === "number" && typeof right === "number") return Math.max(left, right);
    if (typeof left === "boolean" && typeof right === "boolean") return left || right;
    if (left === null || right === null) {
      const selected = preferLocal ? left : right;
      const fallback = preferLocal ? right : left;
      return clone(selected === null && localAt === 0 && cloudAt === 0 ? fallback : selected);
    }
    return clone(preferLocal ? left : right);
  };
  const result = merge(local, cloud) || {};
  result._firebaseLocalUpdatedAt = Math.max(localAt, cloudAt);
  return result;
}
function applyLearnerProgress(progress) {
  const active = window.getLearnerStateForFirebase?.();
  if (!active || !progress) return;
  Object.keys(active).forEach(key => delete active[key]);
  Object.assign(active, JSON.parse(JSON.stringify(progress)));
  const wasHydrating = window.firebaseProgressHydrating;
  window.firebaseProgressHydrating = true;
  try { window.save?.(); }
  finally { window.firebaseProgressHydrating = wasHydrating; }
  try { latestState = JSON.parse(JSON.stringify(active)); }
  catch { latestState = active; }
}
function legacyProgressFromRecords(summary, records) {
  const restored = { name: "", profileName: "", profile: {}, xp: 0, dayAwards: {}, dayBadges: [], assessments: {}, mockTests: {}, wheel: {}, finalAssessment: {}, _legacySummary: {}, _legacyDayRecords: {} };
  if (summary) {
    restored.name = String(summary.displayName || "");
    restored.profileName = String(summary.displayName || "");
    restored.profile = {
      fullName: String(summary.displayName || ""),
      linkedinUrl: String(summary.linkedinUrl || ""),
      githubUrl: String(summary.githubUrl || ""),
      domain: String(summary.domain || ""),
      collegeName: String(summary.collegeName || "")
    };
    restored.xp = Number(summary.xp) || 0;
    restored._legacySummary = {
      xp: Number(summary.xp) || 0,
      completedDays: Array.isArray(summary.completedDays) ? summary.completedDays.slice() : [],
      badges: Array.isArray(summary.badges) ? summary.badges.slice() : [],
      sectionsCompleted: Number(summary.sectionsCompleted) || 0,
      assessmentAttempts: Number(summary.assessmentAttempts) || 0,
      assessmentPasses: Number(summary.assessmentPasses) || 0,
      mockTestsPassed: Number(summary.mockTestsPassed) || 0,
      feedbackCount: Number(summary.feedbackCount) || 0,
      attendanceCount: Number(summary.attendanceCount) || 0,
      averageContentRating: Number(summary.averageContentRating) || 0,
      averageDeliveryRating: Number(summary.averageDeliveryRating) || 0,
      notesCount: Number(summary.notesCount) || 0,
      assignmentCount: Number(summary.assignmentCount) || 0,
      lastAttemptAt: summary.lastAttemptAt || null,
      lastAttemptLabel: String(summary.lastAttemptLabel || "")
    };
    restored._legacySummary.completedDays.forEach(day => {
      const dayNumber = Number(day);
      if (Number.isInteger(dayNumber) && dayNumber >= 0 && dayNumber < 5) restored.dayAwards[dayNumber] = true;
    });
    restored.dayBadges = restored._legacySummary.badges.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day < 5);
  }
  const toIso = value => {
    const date = dateValue(value);
    return date ? date.toISOString() : (typeof value === "string" ? value : null);
  };
  (records || []).forEach(record => {
    const day = Number(record.day) - 1;
    if (!Number.isInteger(day) || day < 0 || day > 4) return;
    const legacy = {};
    ["completedSections", "sectionsTotal", "preAttempts", "prePassed", "preBest", "preScores", "postAttempts", "postPassed", "postBest", "postScores", "mockAttempts", "mockPassed", "mockBest", "mockScores", "finalAttempts", "finalPassed", "finalBest", "finalScores", "wheelQuestions", "notesSaved", "assignmentSubmitted", "badgeEarned", "dayComplete"].forEach(key => {
      if (record[key] !== undefined) legacy[key] = record[key];
    });
    ["preScores", "postScores", "mockScores", "finalScores"].forEach(key => {
      if (Array.isArray(legacy[key])) legacy[key] = legacy[key].map(item => ({ ...item, at: toIso(item.at) }));
    });
    restored._legacyDayRecords[day + 1] = legacy;
    if (record.dayComplete) restored.dayAwards[day] = true;
    if (record.badgeEarned && !restored.dayBadges.includes(day)) restored.dayBadges.push(day);
    const phases = restored.assessments[day] || {};
    ["pre", "post"].forEach(phase => {
      const scores = Array.isArray(legacy[phase + "Scores"]) ? legacy[phase + "Scores"] : [];
      if (scores.length || legacy[phase + "Passed"]) {
        phases[phase] = { attempts: scores.map(item => ({ score: Number(item.score) || 0, passed: !!item.passed, at: toIso(item.at), answered: Number(item.answered) || 0 })), passed: !!legacy[phase + "Passed"], active: null, xpEarned: 0 };
      }
    });
    restored.assessments[day] = phases;
    const mocks = Array.isArray(legacy.mockScores) ? legacy.mockScores : [];
    if (mocks.length || legacy.mockPassed) restored.mockTests[day] = { attempts: mocks.map(item => ({ score: Number(item.score) || 0, passed: !!item.passed, at: toIso(item.at), answered: Number(item.answered) || 0 })), active: null, xpAwarded: false };
    if (day === 4 && (Array.isArray(legacy.finalScores) || legacy.finalPassed)) restored.finalAssessment = { attempts: (legacy.finalScores || []).map(item => ({ score: Number(item.score) || 0, passed: !!item.passed, at: toIso(item.at), answered: Number(item.answered) || 0 })), passed: !!legacy.finalPassed, active: null, xpAwarded: false };
  });
  return restored;
}
async function hydrateProgressFromCloud(user) {
  if (!db || !user?.uid || !window.firebaseGetDoc || !window.firebaseGetDocs) return;
  try {
    const progressRef = window.firebaseDoc(db, "users", user.uid, "progress", "current");
    const summaryRef = window.firebaseDoc(db, "users", user.uid);
    const daysRef = window.firebaseCollection(db, "users", user.uid, "days");
    const [progressSnapshot, summarySnapshot, daysSnapshot] = await Promise.all([
      window.firebaseGetDoc(progressRef),
      window.firebaseGetDoc(summaryRef),
      window.firebaseGetDocs(daysRef)
    ]);
    const legacy = legacyProgressFromRecords(summarySnapshot.exists() ? summarySnapshot.data() : null, daysSnapshot.docs.map(item => item.data()));
    const storedState = progressSnapshot.exists() && progressSnapshot.data()?.state ? progressSnapshot.data().state : {};
    const cloud = mergeLearnerProgress(legacy, storedState);
    const local = window.getLearnerStateForFirebase?.() || {};
    const merged = mergeLearnerProgress(local, cloud);
    if (learnerProgressFingerprint(local) !== learnerProgressFingerprint(merged)) applyLearnerProgress(merged);
    else {
      const active = window.getLearnerStateForFirebase?.();
      if (active) Object.assign(active, merged);
    }
  } catch (error) {
    console.warn("Cloud progress could not be hydrated; retaining this device's local progress", error);
    window.firebaseSetCloudStatus(readableError(error) + " · local progress is retained and sync will retry", true);
  }
}
async function syncNow(login = false) {
  if (!currentUser || !latestState) return false;
  const user = currentUser;
  const snapshot = latestState;
  const run = syncInFlight.catch(() => false).then(async () => {
    const progressRef = window.firebaseDoc(db, "users", user.uid, "progress", "current");
    const userDoc = window.firebaseDoc(db, "users", user.uid);
    const pendingFingerprints = new Map();
    let mergedSnapshot;
    await window.firebaseRunTransaction(db, async transaction => {
      const storedProgress = await transaction.get(progressRef);
      const cloudState = storedProgress.exists() ? storedProgress.data()?.state || {} : {};
      mergedSnapshot = mergeLearnerProgress(snapshot, cloudState);
      const progressChanged = !storedProgress.exists() || learnerProgressFingerprint(cloudState) !== learnerProgressFingerprint(mergedSnapshot);
      if (progressChanged) transaction.set(progressRef, { state: mergedSnapshot, version: 1, updatedAt: window.firebaseServerTimestamp() }, { merge: true });
      const summary = makeSummary(user, mergedSnapshot, login);
      transaction.set(userDoc, summary, { merge: true });
      for (let day = 0; day < 5; day++) {
        const daily = makeDaySummary(mergedSnapshot, day);
        const key = `${user.uid}:${day + 1}`;
        const fingerprint = JSON.stringify(daily);
        if (login || syncedDayFingerprints.get(key) !== fingerprint) {
          const dayDoc = window.firebaseDoc(db, "users", user.uid, "days", `day-${day + 1}`);
          transaction.set(dayDoc, { uid: user.uid, ...daily, updatedAt: window.firebaseServerTimestamp() }, { merge: true });
          pendingFingerprints.set(key, fingerprint);
        }
      }
    });
    if (currentUser?.uid === user.uid) {
      try {
        const active = window.getLearnerStateForFirebase?.();
        const currentState = active || latestState || snapshot;
        const reconciled = mergeLearnerProgress(currentState, mergedSnapshot);
        if (learnerProgressFingerprint(currentState) !== learnerProgressFingerprint(reconciled)) applyLearnerProgress(reconciled);
        pendingFingerprints.forEach((fingerprint, key) => syncedDayFingerprints.set(key, fingerprint));
        try { latestState = JSON.parse(JSON.stringify(reconciled)); } catch { latestState = reconciled; }
        if (learnerProgressFingerprint(reconciled) !== learnerProgressFingerprint(mergedSnapshot)) queueProgress(reconciled);
        if (!window.firebaseIsAdmin) {
          const board = makePublicLeaderboardEntry(user, mergedSnapshot);
          await Promise.all(board.dailyXp.map((xp, day) => {
            const boardRef = window.firebaseDoc(db, "publicLeaderboardDays", `day-${day + 1}`, "learners", user.uid);
            return window.firebaseSetDoc(boardRef, { displayName: board.displayName, xp }, { merge: true });
          }));
        }
      } catch (leaderboardError) {
        console.warn("Daily leaderboard entry could not be updated", leaderboardError);
      }
      clearTimeout(syncRetryTimer);
      syncRetryTimer = 0;
      syncRetryDelay = 1000;
      window.firebaseSetCloudStatus("Saved to Firebase · synced across devices");
    }
    return true;
  }).catch(error => {
    console.error("Learner report sync failed", error);
    window.firebaseSetCloudStatus(readableError(error) + " · retrying automatically", true);
    if (currentUser?.uid === user.uid && latestState && !syncRetryTimer) {
      syncRetryTimer = setTimeout(() => {
        syncRetryTimer = 0;
        syncNow(false);
      }, syncRetryDelay);
      syncRetryDelay = Math.min(syncRetryDelay * 2, 30000);
    }
    return false;
  });
  syncInFlight = run;
  return run;
}

function queueProgress(state) {
  if (!state || window.firebaseProgressHydrating) return;
  const stamp = Date.now();
  state._firebaseLocalUpdatedAt = stamp;
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem("fieldGuideState", raw);
    const owner = localStorage.getItem("fieldGuideOwnerUid");
    if (owner) localStorage.setItem("fieldGuideState:" + owner, raw);
  } catch (error) { console.warn("Local progress timestamp could not be saved", error); }
  if (!currentUser || !cloudReady) return;
  try { latestState = JSON.parse(JSON.stringify(state)); } catch { latestState = state; }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = 0; syncNow(false); }, 650);
}
window.firebaseFlushLearnerProgress = async state => {
  if (!currentUser || !cloudReady || !state) return false;
  queueProgress(state);
  clearTimeout(syncTimer);
  syncTimer = 0;
  return syncNow(false);
};

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
    text: "Hello {{learner_name}},\n\nWelcome to Phase 2 of Digital Enablement Basics for Engineers. We are glad to have you with us.\n\nOver five learning days, you will explore cloud computing, information security, artificial intelligence, connected technologies, and future engineering applications. The portal is open daily from 8:00 AM to 11:00 PM IST. Complete the eight activities for each day to earn XP and your daily badge; completing all five days unlocks your course certificate.\n\nStart or continue your learning here:\nhttps://sarlayash.github.io/Digital-Enablement-Basics-for-Engineers/\n\nWarm regards,\nMentor Kapil\nCourse Mentor\nDigital Enablement Basics for Engineers\nkapilnarula27july@gmail.com"
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


function adminAnalyticsStart(range) {
  if (range === "all") return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(range) - 1));
  return start;
}
function adminAnalyticsDate(record, key) {
  if (["lastLoginAt", "submittedAt", "punchedInAt"].includes(key)) return dateValue(record?.[key]);
  return dateValue(record?.[key]) || dateValue(record?.updatedAt) ||
    (record?.sessionDate ? dateValue(String(record.sessionDate) + "T12:00:00") : null);
}
function adminAnalyticsInRange(record, key, start) {
  if (!start) return true;
  const date = adminAnalyticsDate(record, key);
  return !!date && date >= start;
}
function collectAdminScoreAttempts(records, selectedDay, start) {
  const phases = [{ key: "pre", scale: 50 }, { key: "post", scale: 50 }, { key: "mock", scale: 10 }, { key: "final", scale: 25 }];
  const output = [];
  records.forEach(record => {
    const day = Number(record.day) || 0;
    if (selectedDay && day !== selectedDay) return;
    phases.forEach(phase => {
      const scoreKey = phase.key + "Scores";
      let attempts = Array.isArray(record[scoreKey]) ? record[scoreKey] : [];
      if (!attempts.length && (Number(record[phase.key + "Attempts"]) || 0) > 0 && record[phase.key + "Best"] != null) {
        attempts = [{ score: record[phase.key + "Best"], passed: !!record[phase.key + "Passed"], at: record.updatedAt }];
      }
      attempts.forEach(attempt => {
        const at = dateValue(attempt.at) || dateValue(record.updatedAt);
        if (start && (!at || at < start)) return;
        const score = Math.max(0, Math.min(phase.scale, Number(attempt.score) || 0));
        output.push({ uid: record.uid || "", day, phase: phase.key, score, scale: phase.scale, percent: score / phase.scale * 100, passed: !!attempt.passed, at });
      });
    });
  });
  return output;
}
function renderAdminScoreSvg(scores, selectedDay) {
  const days = selectedDay ? [selectedDay] : [1, 2, 3, 4, 5];
  const phases = [
    { key: "pre", label: "Pre", color: "#526fe4" },
    { key: "post", label: "Post", color: "#1ca58b" },
    { key: "mock", label: "Mock", color: "#e4a43b" },
    { key: "final", label: "Final", color: "#8b69d5" }
  ];
  const width = 700, height = 220, left = 42, top = 16, plotW = 640, plotH = 158;
  const grid = [0, 25, 50, 75, 100].map(value => {
    const y = top + plotH - value / 100 * plotH;
    return '<line x1="' + left + '" y1="' + y + '" x2="' + (left + plotW) + '" y2="' + y + '" stroke="#edf0f5"/><text x="' + (left - 8) + '" y="' + (y + 3) + '" text-anchor="end" fill="#8490a3" font-size="9">' + value + '%</text>';
  }).join("");
  const groupW = plotW / days.length;
  let bars = "";
  days.forEach((day, dayIndex) => {
    const groupStart = left + dayIndex * groupW;
    const barW = Math.min(19, groupW / 7);
    const totalW = phases.length * barW + (phases.length - 1) * 5;
    const startX = groupStart + (groupW - totalW) / 2;
    phases.forEach((phase, phaseIndex) => {
      const values = scores.filter(item => item.day === day && item.phase === phase.key);
      if (!values.length) return;
      const average = values.reduce((sum, item) => sum + item.percent, 0) / values.length;
      const barH = Math.max(2, average / 100 * plotH);
      const x = startX + phaseIndex * (barW + 5);
      const y = top + plotH - barH;
      bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="4" fill="' + phase.color + '" opacity=".92"><title>Day ' + day + ' ' + phase.label + ': ' + average.toFixed(0) + '% average · ' + values.length + ' attempts</title></rect>';
    });
    bars += '<text x="' + (groupStart + groupW / 2) + '" y="' + (top + plotH + 20) + '" text-anchor="middle" fill="#596780" font-size="10">Day ' + day + '</text>';
  });
  return '<svg class="firebase-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Average pre, post, mock, and final assessment score percentages by day"><title>Assessment score trend by course day</title>' + grid + bars + '</svg>';
}
function makeAdminActivityBuckets(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (range === "all") {
    const first = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(first.getFullYear(), first.getMonth() + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start, end, label: start.toLocaleDateString(undefined, { month: "short" }) };
    });
  }
  const config = range === "7" ? { count: 7, step: 1 } : range === "30" ? { count: 15, step: 2 } : { count: 13, step: 7 };
  const first = new Date(today);
  first.setDate(first.getDate() - (config.count * config.step - 1));
  return Array.from({ length: config.count }, (_, index) => {
    const start = new Date(first);
    start.setDate(start.getDate() + index * config.step);
    const end = new Date(start);
    end.setDate(end.getDate() + config.step);
    return { start, end, label: start.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) };
  });
}
function renderAdminActivitySvg(users, attendance, feedback, range) {
  const buckets = makeAdminActivityBuckets(range);
  const series = [
    { label: "Latest sign-ins", color: "#526fe4", values: users.map(user => adminAnalyticsDate(user, "lastLoginAt")) },
    { label: "Attendance punches", color: "#1ca58b", values: attendance.map(item => adminAnalyticsDate(item, "punchedInAt")) },
    { label: "Feedback", color: "#e4a43b", values: feedback.map(item => adminAnalyticsDate(item, "submittedAt")) }
  ];
  const counts = series.map(item => buckets.map(bucket => item.values.filter(date => date && date >= bucket.start && date < bucket.end).length));
  const max = Math.max(1, ...counts.flat());
  const width = 700, height = 220, left = 36, top = 16, plotW = 650, plotH = 158;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(fraction => {
    const y = top + plotH - fraction * plotH;
    return '<line x1="' + left + '" y1="' + y + '" x2="' + (left + plotW) + '" y2="' + y + '" stroke="#edf0f5"/><text x="' + (left - 8) + '" y="' + (y + 3) + '" text-anchor="end" fill="#8490a3" font-size="9">' + Math.round(max * fraction) + '</text>';
  }).join("");
  const groupW = plotW / buckets.length;
  const barW = Math.min(10, Math.max(3, (groupW - 9) / 3));
  let bars = "";
  buckets.forEach((bucket, index) => {
    const groupStart = left + index * groupW;
    series.forEach((item, seriesIndex) => {
      const count = counts[seriesIndex][index];
      if (!count) return;
      const barH = Math.max(2, count / max * plotH);
      const x = groupStart + (groupW - (3 * barW + 4)) / 2 + seriesIndex * (barW + 2);
      const y = top + plotH - barH;
      bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="3" fill="' + item.color + '"><title>' + item.label + ' · ' + bucket.label + ': ' + count + '</title></rect>';
    });
    if (buckets.length <= 15 || index % 2 === 0) bars += '<text x="' + (groupStart + groupW / 2) + '" y="' + (top + plotH + 20) + '" text-anchor="middle" fill="#738097" font-size="8">' + bucket.label + '</text>';
  });
  return '<svg class="firebase-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Timeline comparing latest learner sign-ins, attendance punches, and feedback entries"><title>Learner activity timeline</title>' + grid + bars + '</svg>';
}
function renderAdminDonut(title, subtitle, values, labels, colors, centerValue, centerLabel) {
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
  let offset = 0;
  const segments = total ? values.map((value, index) => {
    const start = offset;
    offset += (Number(value) || 0) / total * 100;
    return colors[index] + " " + start.toFixed(2) + "% " + offset.toFixed(2) + "%";
  }) : ["#e9edf4 0% 100%"];
  const legend = labels.map((label, index) => '<span><i style="background:' + colors[index] + '"></i><span>' + label + '</span><b>' + (Number(values[index]) || 0) + '</b></span>').join("");
  return '<article class="firebase-chart-card firebase-chart-card--donut"><header class="firebase-chart-title"><div><h3>' + title + '</h3><p>' + subtitle + '</p></div></header><div class="firebase-donut-layout"><div class="firebase-donut" style="background:conic-gradient(' + segments.join(",") + ')" role="img" aria-label="' + title + '"><div class="firebase-donut-center"><b>' + centerValue + '</b><small>' + centerLabel + '</small></div></div><div class="firebase-donut-legend">' + legend + '</div></div></article>';
}
function buildAdminAnalytics(selectedDayValue, range) {
  const selectedDay = selectedDayValue === "all" ? null : Number(selectedDayValue);
  const start = adminAnalyticsStart(range);
  const dayRecords = adminAllDayRecords.filter(record => !selectedDay || Number(record.day) === selectedDay);
  const attendance = adminAttendance.filter(record => (!selectedDay || Number(record.day) === selectedDay) && adminAnalyticsInRange(record, "punchedInAt", start));
  const feedback = adminFeedback.filter(record => (!selectedDay || Number(record.day) === selectedDay) && adminAnalyticsInRange(record, "submittedAt", start));
  const signIns = adminUsers.filter(user => adminAnalyticsInRange(user, "lastLoginAt", start));
  const scores = collectAdminScoreAttempts(adminAllDayRecords, selectedDay, start);
  const participants = adminUsers;
  const scoreAverage = scores.length ? scores.reduce((sum, item) => sum + item.percent, 0) / scores.length : null;
  const passCount = scores.filter(item => item.passed).length;
  const passRate = scores.length ? Math.round(passCount / scores.length * 100) : null;
  const ratings = feedback.flatMap(item => [Number(item.contentRating), Number(item.deliveryRating)]).filter(value => value >= 1 && value <= 5);
  const feedbackAverage = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const averageXP = participants.length ? Math.round(participants.reduce((sum, user) => sum + (Number(user.xp) || 0), 0) / participants.length) : 0;
  const completeCount = selectedDay
    ? participants.filter(user => (user.completedDays || []).includes(selectedDay - 1) || dayRecords.some(record => record.uid === user.id && Number(record.day) === selectedDay && record.dayComplete)).length
    : participants.filter(user => (user.completedDays || []).length >= 5 || dayRecords.filter(record => record.uid === user.id).some(record => record.dayComplete)).length;
  const allDayActivity = adminAttendance.filter(record => !selectedDay || Number(record.day) === selectedDay)
    .concat(adminFeedback.filter(record => !selectedDay || Number(record.day) === selectedDay));
  const startedIds = new Set(dayRecords.filter(record => (!selectedDay || Number(record.day) === selectedDay) && (Number(record.completedSections) > 0 || Number(record.preAttempts) > 0 || Number(record.postAttempts) > 0 || Number(record.mockAttempts) > 0 || Number(record.wheelQuestions) > 0 || record.notesSaved || record.assignmentSubmitted)).map(record => record.uid).concat(allDayActivity.map(record => record.uid).filter(Boolean)));
  const startedCount = participants.filter(user => {
    const complete = selectedDay
      ? (user.completedDays || []).includes(selectedDay - 1) || dayRecords.some(record => record.uid === user.id && Number(record.day) === selectedDay && record.dayComplete)
      : (user.completedDays || []).length >= 5 || dayRecords.filter(record => record.uid === user.id).some(record => record.dayComplete);
    const hasDayActivity = startedIds.has(user.id);
    const hasCourseActivity = !selectedDay && (Number(user.sectionsCompleted) > 0 || (user.completedDays || []).length > 0);
    return !complete && (hasDayActivity || hasCourseActivity);
  }).length;
  const notStartedCount = Math.max(0, participants.length - completeCount - startedCount);
  const kpis = [
    ["Registered learners", adminUsers.length, "All Google-authenticated profiles"],
    ["Active · 24 hours", adminUsers.filter(user => (dateValue(user.lastActivityAt)?.getTime() || 0) >= Date.now() - 86400000).length, "Recent saved activity"],
    [selectedDay ? "Day " + selectedDay + " completed" : "Five-day completions", completeCount, selectedDay ? "Learners completing this day" : "Learners completing all five days"],
    ["Average learner XP", averageXP, "Across registered learners"],
    ["Learners signed in", signIns.length, "Latest sign-in in selected period"],
    ["Attendance sessions", attendance.length, "Filtered by day and date range"],
    ["Assessment attempts", scores.length, selectedDay ? "Day " + selectedDay + " attempts" : "Across all five days"],
    ["Average score", scoreAverage == null ? "—" : Math.round(scoreAverage) + "%", "Normalized across assessment types"],
    ["Feedback entries", feedback.length, "Filtered by day and date range"],
    ["Feedback rating", feedbackAverage == null ? "—" : feedbackAverage.toFixed(1) + " / 5", ratings.length + " individual ratings"]
  ].map(item => '<article class="firebase-admin-kpi"><small>' + item[0] + '</small><strong>' + item[1] + '</strong><span>' + item[2] + '</span></article>').join("");
  const dayOptions = ['<option value="all">All days</option>'].concat([1,2,3,4,5].map(day => '<option value="' + day + '">Day ' + day + '</option>')).join("");
  const rangeOptions = [
    '<option value="7">Last 7 days</option>',
    '<option value="30">Last 30 days</option>',
    '<option value="90">Last 90 days</option>',
    '<option value="all">All time</option>'
  ].join("");
  const scoreLegend = '<div class="firebase-chart-legend"><span><i style="background:#526fe4"></i>Pre</span><span><i style="background:#1ca58b"></i>Post</span><span><i style="background:#e4a43b"></i>Mock</span><span><i style="background:#8b69d5"></i>Final</span></div>';
  const scoreChart = scores.length
    ? renderAdminScoreSvg(scores, selectedDay)
    : '<div class="firebase-chart-empty">No assessment attempts match this day and date range yet.</div>';
  const activityChart = renderAdminActivitySvg(signIns, attendance, feedback, range);
  const completionValues = [completeCount, startedCount, notStartedCount];
  const completionDonut = renderAdminDonut("Learner progress", selectedDay ? "Completion status for Day " + selectedDay : "Five-day course completion status", completionValues, ["Complete", "In progress", "Not started"], ["#1ca58b", "#526fe4", "#e8edf4"], participants.length ? Math.round(completeCount / participants.length * 100) + "%" : "0%", "complete");
  const outcomeDonut = renderAdminDonut("Assessment outcomes", "Attempts in the selected period", [passCount, Math.max(0, scores.length - passCount)], ["Passed", "Retry needed"], ["#1ca58b", "#f1b65c"], passRate == null ? "—" : passRate + "%", "pass rate");
  const ratingCounts = [1,2,3,4,5].map(stars => ratings.filter(value => value === stars).length);
  const ratingColors = ["#df6f6f", "#ed9b55", "#e3bb53", "#5cae8c", "#5271df"];
  const feedbackDonut = renderAdminDonut("Feedback ratings", "Content and delivery ratings", ratingCounts, ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"], ratingColors, feedbackAverage == null ? "—" : feedbackAverage.toFixed(1), "avg / 5");
  const completedPunches = attendance.filter(item => !!item.punchedOutAt).length;
  const openPunches = Math.max(0, attendance.length - completedPunches);
  const attendanceDonut = renderAdminDonut("Attendance", "Punch-out completion", [completedPunches, openPunches], ["Punched out", "Still open"], ["#1ca58b", "#e4a43b"], attendance.length ? Math.round(completedPunches / attendance.length * 100) + "%" : "—", "closed");
  const dayLabel = selectedDay ? "Day " + selectedDay : "All days";
  const rangeLabel = range === "all" ? "All time · 12-month trend" : "Last " + range + " days";
  const errors = Object.entries(adminAnalyticsErrors).map(entry => '<div class="firebase-analytics-warning">' + entry[0] + ' analytics could not load: ' + escapeHTML(entry[1]) + '</div>').join("");
  const html = '<section class="firebase-powerbi"><header class="firebase-powerbi-head"><div><span class="eyebrow" style="color:#5368c9">COHORT ANALYTICS · REAL-TIME</span><h2>Learning performance overview</h2><p>Scores, participation, attendance, and learner feedback update from live Firestore records.</p></div><div class="firebase-analytics-filters"><label>Course day<select id="adminAnalyticsDay">' + dayOptions + '</select></label><label>Activity period<select id="adminAnalyticsRange">' + rangeOptions + '</select></label><button class="action secondary firebase-print-dashboard" id="printAdminDashboard">Print / Save PDF</button></div></header><div class="firebase-analytics-grid"><article class="firebase-chart-card firebase-chart-card--score"><header class="firebase-chart-title"><div><h3>Assessment score trends</h3><p>Average score by day, normalized to percent; hover bars for attempt counts.</p></div><span class="firebase-chart-tag">' + dayLabel + '</span></header>' + scoreChart + scoreLegend + '</article><article class="firebase-chart-card firebase-chart-card--activity"><header class="firebase-chart-title"><div><h3>Engagement over time</h3><p>Sign-ins, attendance, and feedback across the selected period.</p></div><span class="firebase-chart-tag">' + rangeLabel + '</span></header>' + activityChart + '<div class="firebase-chart-legend"><span><i style="background:#526fe4"></i>Latest sign-ins</span><span><i style="background:#1ca58b"></i>Attendance</span><span><i style="background:#e4a43b"></i>Feedback</span></div><p class="firebase-sync-note">Sign-ins represent each learner’s latest recorded login; attendance and feedback respond to the day filter.</p></article>' + completionDonut + outcomeDonut + feedbackDonut + attendanceDonut + '</div>' + errors + '</section>';
  return { kpis, html };
}
function rebuildAdminRosterScores() {
  const next = new Map();
  adminAllDayRecords.forEach(record => {
    const uid = String(record.uid || "");
    if (!uid) return;
    const result = next.get(uid) || { pre: null, post: null };
    ["pre", "post"].forEach(phase => {
      const scores = Array.isArray(record[phase + "Scores"]) ? record[phase + "Scores"] : [];
      const attempts = Number(record[phase + "Attempts"]) || 0;
      let candidate = null;
      if (scores.length) {
        candidate = scores.reduce((latest, item) => {
          const at = dateValue(item.at)?.getTime() || 0;
          return !latest || at >= latest.at ? { score: Number(item.score) || 0, at, day: Number(record.day) || null, legacy: false } : latest;
        }, null);
      } else if (attempts > 0 && record[phase + "Best"] != null) {
        candidate = { score: Number(record[phase + "Best"]) || 0, at: dateValue(record.updatedAt)?.getTime() || 0, day: Number(record.day) || null, legacy: true };
      }
      if (candidate && (!result[phase] || candidate.at >= result[phase].at)) result[phase] = candidate;
    });
    next.set(uid, result);
  });
  adminRosterScores = next;
}
function adminAnalyticsLiveLabel() {
  const keys = Object.keys(adminAnalyticsReady);
  if (!keys.every(key => adminAnalyticsReady[key])) return "CONNECTING…";
  if (Object.keys(adminAnalyticsErrors).length) return "PARTIAL DATA";
  if (Object.values(adminAnalyticsCache).some(Boolean)) return "CACHED SNAPSHOT";
  return "LIVE UPDATES";
}

function renderAdminDashboard(fromCache = false) {
  const root = document.getElementById("firebaseAdminDashboard");
  if (!root) return;
  const searchWasFocused = document.activeElement?.id === "adminSearch";
  if (document.getElementById("adminSearch")) adminSearchTerm = document.getElementById("adminSearch").value;
  if (document.getElementById("adminAnalyticsDay")) adminAnalyticsDay = document.getElementById("adminAnalyticsDay").value;
  if (document.getElementById("adminAnalyticsRange")) adminAnalyticsRange = document.getElementById("adminAnalyticsRange").value;
  const insights = buildAdminAnalytics(adminAnalyticsDay, adminAnalyticsRange);
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
  const query = adminSearchTerm.trim().toLowerCase();
  const filtered = adminUsers.filter(user => `${user.displayName || ""} ${user.email || ""}`.toLowerCase().includes(query));
  const bars = Array.from({ length: 5 }, (_, day) => {
    const count = adminUsers.filter(user => (user.completedDays || []).includes(day)).length;
    const percent = adminUsers.length ? Math.round(count / adminUsers.length * 100) : 0;
    return `<div class="firebase-day-bar"><div><i style="height:${percent}%"></i></div><b>${count}</b><small>Day ${day + 1}</small></div>`;
  }).join("");
  const rows = filtered.map(user => {
    const rosterScores = adminRosterScores.get(user.id) || {};
    const scoreCell = phase => { const entry = rosterScores[phase]; return entry ? `${entry.score}/50${entry.day ? ` · Day ${entry.day}` : ""}${entry.legacy ? " · best on record" : ""}` : "—"; };
    return `<tr>
    <td class="user-cell"><b>${escapeHTML(user.displayName || "Learner")}</b><span>${escapeHTML(user.email || "")}</span><button class="action secondary admin-detail-button" data-learner-uid="${escapeHTML(user.id)}">View individual detail</button></td>
    <td>${escapeHTML(formatDate(user.lastLoginAt))}</td><td>${escapeHTML(formatDate(user.lastAttemptAt))}<br><span style="color:#7b8498">${escapeHTML(user.lastAttemptLabel || "")}</span></td>
    <td>${escapeHTML(formatDate(user.createdAt))}</td><td>${(user.completedDays || []).length} / 5</td><td>${Number(user.sectionsCompleted) || 0} / 40</td>
    <td>${Number(user.assessmentPasses) || 0} / ${Number(user.assessmentAttempts) || 0}</td><td>${scoreCell("pre")}</td><td>${scoreCell("post")}</td><td>${Number(user.mockTestsPassed) || 0}</td>
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
  root.innerHTML = `<header class="firebase-admin-head"><div><span class="eyebrow" style="color:#5368c9">ADMIN · LIVE LEARNER OPERATIONS</span><h1 id="firebaseAdminTitle">Learner performance</h1><p>Live individual progress, assessment outcomes, feedback and session attendance. Learner notes and assignment text remain private.</p></div><span class="firebase-live-indicator">${adminAnalyticsLiveLabel()}</span></header>
    <div class="firebase-admin-kpis">${insights.kpis}</div>${insights.html}
    <section class="firebase-analysis"><h2>Course pulse</h2><p>${attempts ? `${passes} passed tests out of ${attempts} recorded attempts (${Math.round(passes / attempts * 100)}% pass rate).` : "No assessment attempts have been recorded yet."} Average content rating: ${ratingAverage("averageContentRating")} / 5 · average delivery rating: ${ratingAverage("averageDeliveryRating")} / 5. Completion bars show learners who have finished each day.</p><div class="firebase-day-chart">${bars}</div></section>${communications}
    <section class="firebase-analysis"><h2>Assessment reports</h2><p>Download daily or consolidated pre, post, mock, and final assessment scores. PDF opens the print dialog; choose Save as PDF.</p><label>Daily report day <select id="assessmentDay"><option value="1">Day 1</option><option value="2">Day 2</option><option value="3">Day 3</option><option value="4">Day 4</option><option value="5">Day 5</option></select></label> <button class="action" id="dailyAssessCsv">Daily CSV</button> <button class="action secondary" id="dailyAssessPdf">Daily PDF</button> <button class="action" id="allAssessCsv">Consolidated CSV</button> <button class="action secondary" id="allAssessPdf">Consolidated PDF</button><p id="assessmentReportStatus" role="status"></p></section>
    <section class="firebase-users"><div class="panelhead"><div><h2>All learner records</h2><p class="assessment-sub">Open an individual profile for daily scores, notes/assignment completion, feedback, and attendance punches.</p></div></div><div class="firebase-users-toolbar"><input id="adminSearch" type="search" placeholder="Filter by learner name or email" aria-label="Filter learner records"><button class="action" id="downloadAdminCsv">Download performance CSV</button><button class="action secondary" id="downloadActivityCsv">Download feedback & attendance CSV</button></div><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Learner</th><th>Last sign-in</th><th>Last attempt</th><th>Registered</th><th>Days</th><th>Sections</th><th>Assessment pass / attempts</th><th>Final pre score</th><th>Final post score</th><th>Mock passes</th><th>Attendance</th><th>Content rating</th><th>Delivery rating</th><th>Badges</th><th>XP</th><th>Last activity</th></tr></thead><tbody>${rows || `<tr><td colspan="16" class="firebase-empty">${adminUsers.length ? "No learners match this filter." : "No Google learner profiles are recorded yet."}</td></tr>`}</tbody></table></div><p class="firebase-sync-note">Live Firestore listeners · ${new Date().toLocaleTimeString()} · Learner progress, feedback and punches update as they are saved.</p></section>${details}`;
  document.getElementById("adminSearch")?.addEventListener("input", event => { adminSearchTerm = event.target.value; renderAdminDashboard(fromCache); });
  const dayFilter = document.getElementById("adminAnalyticsDay");
  if (dayFilter) { dayFilter.value = adminAnalyticsDay; dayFilter.addEventListener("change", event => { adminAnalyticsDay = event.target.value; renderAdminDashboard(fromCache); }); }
  const rangeFilter = document.getElementById("adminAnalyticsRange");
  if (rangeFilter) { rangeFilter.value = adminAnalyticsRange; rangeFilter.addEventListener("change", event => { adminAnalyticsRange = event.target.value; renderAdminDashboard(fromCache); }); }
  document.getElementById("printAdminDashboard")?.addEventListener("click", () => window.print());
  const searchInput = document.getElementById("adminSearch");
  if (searchInput) { searchInput.value = adminSearchTerm; if (searchWasFocused) { searchInput.focus(); try { searchInput.setSelectionRange(adminSearchTerm.length, adminSearchTerm.length); } catch {} } }
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
async function getAssessmentReportRows(dayFilter) {
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
  const rosterScoreText = (uid, phase) => { const value = adminRosterScores.get(uid)?.[phase]; return value ? `${value.score}/50${value.day ? ` (Day ${value.day})` : ""}${value.legacy ? " (best on record)" : ""}` : ""; };
  const header = ["Name", "Email", "Last login", "Last attempt", "Last attempt type", "Registered", "Days completed", "Sections completed", "Assessment passes", "Assessment attempts", "Final pre score", "Final post score", "Mock passes", "XP", "Badges earned", "Last activity"];
  const rows = filtered.map(user => [user.displayName, user.email, formatDate(user.lastLoginAt), formatDate(user.lastAttemptAt), user.lastAttemptLabel, formatDate(user.createdAt), (user.completedDays || []).length, user.sectionsCompleted, user.assessmentPasses, user.assessmentAttempts, rosterScoreText(user.id, "pre"), rosterScoreText(user.id, "post"), user.mockTestsPassed, user.xp, (user.badges || []).length, formatDate(user.lastActivityAt)]);
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

function watchMailDelivery(ref, timeoutMs = 20000) {
  return new Promise(resolve => {
    let unsubscribe = () => {};
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish({ state: "PENDING", error: "" }), timeoutMs);
    unsubscribe = window.firebaseOnSnapshot(ref, snapshot => {
      const delivery = snapshot.data()?.delivery || {};
      if (delivery.state === "SUCCESS" || delivery.state === "ERROR") {
        finish({ state: delivery.state, error: String(delivery.error || "") });
      }
    }, error => finish({ state: "ERROR", error: readableError(error) }));
  });
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
    const mailRefs = [];
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
          const mailRef = window.firebaseDoc(db, "mail", "course-" + id);
          mailRefs.push(mailRef);
          batch.set(mailRef, {
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
    const body = document.getElementById("adminMessageBody");
    if (body) body.value = "";
    if (mailRefs.length) {
      if (button) button.textContent = "Checking delivery…";
      const outcomes = await Promise.all(mailRefs.map(ref => watchMailDelivery(ref, 25000)));
      const sent = outcomes.filter(result => result.state === "SUCCESS").length;
      const failed = outcomes.filter(result => result.state === "ERROR").length;
      const pending = outcomes.length - sent - failed;
      const errorText = outcomes.find(result => result.state === "ERROR" && result.error)?.error;
      window.toast?.("Portal update sent to " + recipients.length + " learner" + (recipients.length === 1 ? "" : "s") + ". Email delivery: " + sent + " sent, " + failed + " failed, " + pending + " pending." + (errorText ? " Provider: " + errorText.slice(0, 220) : ""));
    } else {
      window.toast?.("In-portal notification sent to " + recipients.length + " learner" + (recipients.length === 1 ? "" : "s") + ".");
    }
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
          const delivery = snapshot.data()?.delivery || {};
          window.toast?.(state === "SUCCESS" ? "Firebase reports the test email sent to " + recipient.email + "." : "Test email failed: " + String(delivery.error || "mail provider returned ERROR").slice(0, 320));
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
  const onUsersError = error => {
    adminUnsubscribes.forEach(unsubscribe => unsubscribe());
    adminUnsubscribes = [];
    const root = document.getElementById("firebaseAdminDashboard");
    if (root) root.innerHTML = `<section class="panel"><h2>Admin report unavailable</h2><p>${escapeHTML(readableError(error))}</p><p>Confirm your admin claim and deploy the current Firestore rules.</p></section>`;
  };
  const watchGroup = (key, collectionName, assign) => window.firebaseOnSnapshot(window.firebaseCollectionGroup(db, collectionName), snapshot => {
    adminAnalyticsReady[key] = true;
    adminAnalyticsCache[key] = !!snapshot.metadata.fromCache;
    delete adminAnalyticsErrors[key];
    assign(snapshot.docs.map(item => ({ ...item.data(), uid: item.data().uid || item.ref?.parent?.parent?.id || "" })));
    if (key === "days") rebuildAdminRosterScores();
    renderAdminDashboard(snapshot.metadata.fromCache);
  }, error => {
    console.warn("Admin analytics collection unavailable: " + collectionName, error);
    adminAnalyticsReady[key] = true;
    adminAnalyticsErrors[key] = readableError(error);
    renderAdminDashboard();
  });
  adminUnsubscribes = [
    window.firebaseOnSnapshot(window.firebaseCollection(db, "users"), snapshot => {
      adminAnalyticsReady.users = true;
      adminAnalyticsCache.users = !!snapshot.metadata.fromCache;
      delete adminAnalyticsErrors.users;
      adminUsers = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (dateValue(b.lastActivityAt)?.getTime() || 0) - (dateValue(a.lastActivityAt)?.getTime() || 0));
      rebuildAdminRosterScores();
      renderAdminDashboard(snapshot.metadata.fromCache);
    }, onUsersError),
    watchGroup("days", "days", records => { adminAllDayRecords = records; }),
    watchGroup("feedback", "feedback", records => { adminFeedback = records; }),
    watchGroup("attendance", "attendance", records => { adminAttendance = records; })
  ];
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
    adminAllDayRecords = [];
    adminFeedback = [];
    adminAttendance = [];
    adminAnalyticsReady = { users: false, days: false, feedback: false, attendance: false };
    adminAnalyticsCache = { users: false, days: false, feedback: false, attendance: false };
    adminAnalyticsErrors = {};
    adminRosterScores = new Map();
    adminDayRecords = [];
    adminDetailFeedback = [];
    adminDetailAttendance = [];
    document.getElementById("firebaseAdminDashboard")?.setAttribute("hidden", "");
  }
}

function autoPunchOutExpiredAttendance(uid = currentUser?.uid) {
  if (!uid || currentUser?.uid !== uid || !cloudReady || !window.portalIndiaNow) return Promise.resolve();
  const now = window.portalIndiaNow();
  const jobs = [];
  Object.entries(myAttendance).forEach(([id, record]) => {
    if (!record?.punchedInAt || record.punchedOutAt || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.sessionDate || ""))) return;
    if (record.sessionDate > now.dateKey || (record.sessionDate === now.dateKey && now.minutes < 20 * 60)) return;
    if (autoPunchOutInFlight.has(id)) return;
    const cutoff = new Date(record.sessionDate + "T14:30:00.000Z");
    if (Number.isNaN(cutoff.getTime())) return;
    const punchedIn = dateValue(record.punchedInAt);
    if (punchedIn && punchedIn > cutoff) cutoff.setTime(punchedIn.getTime());
    autoPunchOutInFlight.add(id);
    const stamp = window.firebaseTimestampFromDate(cutoff);
    jobs.push(window.firebaseSetDoc(window.firebaseDoc(db, "users", uid, "attendance", id), {
      punchedOutAt: stamp, updatedAt: window.firebaseServerTimestamp()
    }, { merge: true }).then(() => {
      myAttendance[id] = { ...record, punchedOutAt: stamp };
      if (Number(record.day) > 0) window.refreshDailyAttendance?.(Number(record.day) - 1);
    }).catch(error => {
      console.warn("Automatic attendance punch-out could not be synced", error);
    }).finally(() => autoPunchOutInFlight.delete(id)));
  });
  return Promise.all(jobs);
}
function localSessionDate() {
  return window.portalIndiaNow ? window.portalIndiaNow().dateKey : new Date().toISOString().slice(0, 10);
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
  if (!Number.isInteger(day) || day < 0 || day > 4) throw new Error("Choose a valid learning day.");
  if (action !== "in" && action !== "out") throw new Error("Choose punch in or punch out.");
  if (typeof window.firebaseRunTransaction !== "function") throw new Error("Attendance service is still starting. Please wait a moment and try again.");
  const sessionDate = localSessionDate();
  const recordId = "day-" + (day + 1) + "-" + sessionDate;
  if (attendancePunchInFlight.has(recordId)) throw new Error("Your attendance update is saving. Please wait for confirmation.");
  const ref = window.firebaseDoc(db, "users", currentUser.uid, "attendance", recordId);
  const learnerName = String(currentUser.displayName || currentUser.email || "Learner").slice(0, 120);
  const email = String(currentUser.email || "").slice(0, 254);
  let optimisticRecord = null;
  attendancePunchInFlight.add(recordId);
  try {
    await window.firebaseRunTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const existing = snapshot.exists() ? snapshot.data() : null;
      if (action === "in") {
        if (existing?.punchedInAt) throw new Error("You have already punched in for this session.");
        optimisticRecord = {
          uid: currentUser.uid, learnerName, email, day: day + 1, sessionDate,
          punchedInAt: window.firebaseServerTimestamp(), punchedOutAt: null,
          updatedAt: window.firebaseServerTimestamp()
        };
        transaction.set(ref, optimisticRecord);
        return;
      }
      if (!existing?.punchedInAt) throw new Error("Punch in before you punch out.");
      if (existing.punchedOutAt) throw new Error("You have already punched out for this session.");
      transaction.update(ref, {
        punchedOutAt: window.firebaseServerTimestamp(),
        updatedAt: window.firebaseServerTimestamp()
      });
      optimisticRecord = { ...existing, punchedOutAt: new Date(), updatedAt: new Date() };
    });
    const updatedAt = new Date();
    myAttendance[recordId] = action === "in"
      ? { ...optimisticRecord, punchedInAt: updatedAt, punchedOutAt: null, updatedAt }
      : { ...optimisticRecord, punchedOutAt: updatedAt, updatedAt };
    window.refreshDailyAttendance?.(day);
    if (latestState) queueProgress(latestState);
  } finally {
    attendancePunchInFlight.delete(recordId);
  }
};

function startLearnerProgressListener(user) {
  myProgressUnsubscribe?.();
  const progressRef = window.firebaseDoc(db, "users", user.uid, "progress", "current");
  myProgressUnsubscribe = window.firebaseOnSnapshot(progressRef, snapshot => {
    if (!snapshot.exists()) return;
    const cloudState = snapshot.data()?.state;
    if (!cloudState) return;
    const localState = window.getLearnerStateForFirebase?.() || {};
    const merged = mergeLearnerProgress(localState, cloudState);
    if (learnerProgressFingerprint(localState) !== learnerProgressFingerprint(merged)) {
      applyLearnerProgress(merged);
      if (learnerProgressFingerprint(merged) !== learnerProgressFingerprint(cloudState)) queueProgress(merged);
      window.firebaseSetCloudStatus("Progress updated from your other signed-in device.");
    }
  }, error => {
    console.warn("Live learner progress listener failed", error);
    window.firebaseSetCloudStatus(readableError(error) + " · local progress is safe and will retry", true);
  });
}

function startLearnerActivityListeners(user) {
  myFeedbackUnsubscribe?.();
  myAttendanceUnsubscribe?.();
  myNotificationsUnsubscribe?.();
  myFeedback = {};
  myAttendance = {};
  myNotifications = [];
  myFeedbackServerReady = false;
  myAttendanceServerReady = false;
  myFeedbackUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users", user.uid, "feedback"), { includeMetadataChanges: true }, snapshot => {
    myFeedbackServerReady = !snapshot.metadata.fromCache;
    myFeedback = Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()]));
    for (let day = 0; day < 5; day++) window.refreshDailyFeedback?.(day);
    if (latestState) queueProgress(latestState);
  }, error => window.firebaseSetCloudStatus(readableError(error), true));
  myAttendanceUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users", user.uid, "attendance"), { includeMetadataChanges: true }, snapshot => {
    myAttendanceServerReady = !snapshot.metadata.fromCache;
    myAttendance = Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()]));
    for (let day = 0; day < 5; day++) window.refreshDailyAttendance?.(day);
    autoPunchOutExpiredAttendance(user.uid);
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
  window.firebaseQuery = firestoreSdk.query;
  window.firebaseOrderBy = firestoreSdk.orderBy;
  window.firebaseLimit = firestoreSdk.limit;
  window.firebaseRunTransaction = firestoreSdk.runTransaction;
  window.firebaseCollection = firestoreSdk.collection;
  window.firebaseCollectionGroup = firestoreSdk.collectionGroup;
  window.firebaseWriteBatch = firestoreSdk.writeBatch;
  window.firebaseOnSnapshot = firestoreSdk.onSnapshot;
  window.firebaseServerTimestamp = firestoreSdk.serverTimestamp;
  window.firebaseTimestampFromDate = firestoreSdk.Timestamp.fromDate;
  cloudReady = true;
  startPublicLeaderboard();
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
  const resetIdleLogoutTimer = () => {
    clearTimeout(idleLogoutTimer);
    if (!currentUser) return;
    idleLogoutTimer = setTimeout(async () => {
      const uid = currentUser?.uid;
      if (!uid) return;
      try {
        await syncNow();
        if (currentUser?.uid === uid) await authSdk.signOut(auth);
        loginMessage("Signed out after 10 minutes of inactivity. Progress sync was requested.");
      } catch (error) {
        loginMessage("Automatic sign-out failed: " + readableError(error), true);
      }
    }, 10 * 60 * 1000);
  };
  let lastActivitySignal = 0;
  const noteUserActivity = () => {
    const now = Date.now();
    if (now - lastActivitySignal < 750) return;
    lastActivitySignal = now;
    resetIdleLogoutTimer();
  };
  ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "click"].forEach(type => {
    document.addEventListener(type, noteUserActivity, { passive: true });
  });

  authSdk.getRedirectResult(auth).catch(error => loginMessage(readableError(error), true));
  authSdk.onAuthStateChanged(auth, async user => {
    const previous = currentUser;
    currentUser = user;
    window.firebaseCurrentUserUid = user?.uid || "";
    if (!user) {
      clearTimeout(idleLogoutTimer);
      clearInterval(attendanceAutoCloseTimer);
      clearTimeout(syncTimer);
      clearTimeout(syncRetryTimer);
      idleLogoutTimer = 0;
      attendanceAutoCloseTimer = 0;
      syncTimer = 0;
      syncRetryTimer = 0;
      syncRetryDelay = 1000;
      myFeedbackServerReady = false;
      myAttendanceServerReady = false;
      myFeedbackUnsubscribe?.();
      myAttendanceUnsubscribe?.();
      myNotificationsUnsubscribe?.();
      myProgressUnsubscribe?.();
      myFeedbackUnsubscribe = null;
      myAttendanceUnsubscribe = null;
      myNotificationsUnsubscribe = null;
      myProgressUnsubscribe = null;
      myFeedback = {};
      myAttendance = {};
      myNotifications = [];
      generatedNotifications = [];
      updateNotificationBadge();
      setAdminAccess(false);
      if (previous) window.deactivateFirebaseLearner?.(previous.uid);
      return;
    }
    try {
      const token = await authSdk.getIdTokenResult(user);
      const isAdmin = token.claims.admin === true || (token.claims.email_verified === true && String(token.claims.email || user.email || "").toLowerCase() === "kapilnarula27july@gmail.com");
      setAdminAccess(isAdmin);
      window.firebaseProgressHydrating = true;
      try {
        window.activateFirebaseLearner?.(user, isAdmin);
        await hydrateProgressFromCloud(user);
        await hydrateProfileFromCloud(user);
      } finally {
        window.firebaseProgressHydrating = false;
      }
      startLearnerActivityListeners(user);
      startLearnerProgressListener(user);
      latestState = window.getLearnerStateForFirebase?.() || {};
      loadGeneratedNotifications(user);
      addDailyLearnerNotifications(user, latestState);
      updateNotificationBadge();
      await syncNow(true);
      resetIdleLogoutTimer();
      clearInterval(attendanceAutoCloseTimer);
      attendanceAutoCloseTimer = setInterval(() => autoPunchOutExpiredAttendance(user.uid), 30000);
      autoPunchOutExpiredAttendance(user.uid);
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
