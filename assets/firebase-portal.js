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
let adminUnsubscribe = null;
let adminUsers = [];
let latestState = null;
let syncTimer = 0;
let syncInFlight = Promise.resolve();
let cloudReady = false;

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

  if (!document.getElementById("navAdmin")) {
    const nav = document.querySelector(".side .nav");
    if (nav) {
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
    content?.insertAdjacentHTML("beforeend", '<section class="firebase-admin" id="firebaseAdminDashboard" hidden aria-labelledby="firebaseAdminTitle"></section>');
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
    .firebase-admin-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.firebase-admin-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:17px}.firebase-admin-kpi small{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.7px}.firebase-admin-kpi strong{display:block;margin-top:8px;font:800 24px Manrope;color:#203052}
    .firebase-analysis{background:#fff;border:1px solid var(--line);border-radius:16px;padding:19px;margin-bottom:16px}.firebase-analysis h2,.firebase-users h2{font:800 15px Manrope;margin:0}.firebase-analysis>p{font-size:11px;color:var(--muted);line-height:1.5}.firebase-day-chart{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:end;margin-top:16px}.firebase-day-bar{display:grid;gap:7px;text-align:center}.firebase-day-bar>div{height:88px;display:flex;align-items:flex-end;justify-content:center;background:#f4f6fa;border-radius:9px;overflow:hidden}.firebase-day-bar i{display:block;width:55%;min-height:4px;background:linear-gradient(#7590f5,#3e61dc);border-radius:8px 8px 0 0}.firebase-day-bar b{font:10px 'DM Mono';color:#35425d}.firebase-day-bar small{font-size:9px;color:var(--muted)}
    .firebase-users{background:#fff;border:1px solid var(--line);border-radius:16px;padding:19px}.firebase-users-toolbar{display:flex;align-items:center;gap:9px;margin:14px 0}.firebase-users-toolbar input{flex:1;min-width:120px;border:1px solid #dce1ea;border-radius:9px;padding:10px;font-size:11px}.firebase-users-toolbar button{white-space:nowrap}.firebase-table-wrap{overflow:auto;border:1px solid #e8ebf1;border-radius:11px}.firebase-table{width:100%;border-collapse:collapse;min-width:980px;text-align:left}.firebase-table th{position:sticky;top:0;background:#f7f8fb;color:#6b758a;font:10px 'DM Mono';text-transform:uppercase;letter-spacing:.3px;padding:11px 10px;border-bottom:1px solid #e6e9ef}.firebase-table td{padding:11px 10px;border-bottom:1px solid #edf0f4;color:#35415b;font-size:10px;vertical-align:top}.firebase-table tr:last-child td{border-bottom:0}.firebase-table .user-cell b,.firebase-table .user-cell span{display:block;max-width:180px;overflow-wrap:anywhere}.firebase-table .user-cell span{font-size:9px;color:#7c8699;margin-top:4px}.firebase-empty{padding:28px;text-align:center;color:var(--muted);font-size:12px}.firebase-sync-note{font-size:10px;color:var(--muted);margin-top:10px}
    @media(max-width:800px){.firebase-admin-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.firebase-admin-head{flex-direction:column}.firebase-users{padding:13px}.firebase-users-toolbar{flex-wrap:wrap}.firebase-users-toolbar input{flex-basis:100%}}
  </style>`);

  window.showFirebaseAdminDashboard = function () {
    if (!window.firebaseIsAdmin) return;
    document.getElementById("overview")?.classList.add("hide");
    document.getElementById("dayview")?.classList.remove("show");
    const panel = document.getElementById("firebaseAdminDashboard");
    if (panel) panel.hidden = false;
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = "Admin dashboard";
    document.querySelectorAll(".side .nav button").forEach(button => button.classList.toggle("active", button.id === "navAdmin"));
    startAdminListener();
  };
  document.getElementById("navCert")?.addEventListener("click", () => { document.getElementById("firebaseAdminDashboard").hidden = true; });
  const oldShowHome = window.showHome;
  if (oldShowHome) window.showHome = function () { document.getElementById("firebaseAdminDashboard").hidden = true; oldShowHome(); };
  const oldOpenDay = window.openDay;
  if (oldOpenDay) window.openDay = function (...args) { document.getElementById("firebaseAdminDashboard").hidden = true; oldOpenDay(...args); };
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
    displayName: String(user.displayName || user.email || "Learner").slice(0, 120),
    email: String(user.email || "").slice(0, 254),
    photoURL: String(user.photoURL || "").slice(0, 1000),
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
    await window.firebaseSetDoc(userDoc, summary, { merge: true });
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

function renderAdminDashboard(fromCache = false) {
  const root = document.getElementById("firebaseAdminDashboard");
  if (!root) return;
  const activeSince = Date.now() - 24 * 60 * 60 * 1000;
  const active = adminUsers.filter(user => (dateValue(user.lastActivityAt)?.getTime() || 0) >= activeSince).length;
  const complete = adminUsers.filter(user => (user.completedDays || []).length >= 5).length;
  const attempts = adminUsers.reduce((sum, user) => sum + (Number(user.assessmentAttempts) || 0), 0);
  const passes = adminUsers.reduce((sum, user) => sum + (Number(user.assessmentPasses) || 0), 0);
  const avgXP = adminUsers.length ? Math.round(adminUsers.reduce((sum, user) => sum + (Number(user.xp) || 0), 0) / adminUsers.length) : 0;
  const query = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  const filtered = adminUsers.filter(user => `${user.displayName || ""} ${user.email || ""}`.toLowerCase().includes(query));
  const bars = Array.from({ length: 5 }, (_, day) => {
    const count = adminUsers.filter(user => (user.completedDays || []).includes(day)).length;
    const percent = adminUsers.length ? Math.round(count / adminUsers.length * 100) : 0;
    return `<div class="firebase-day-bar"><div><i style="height:${percent}%"></i></div><b>${count}</b><small>Day ${day + 1}</small></div>`;
  }).join("");
  const rows = filtered.map(user => `<tr>
    <td class="user-cell"><b>${escapeHTML(user.displayName || "Learner")}</b><span>${escapeHTML(user.email || "")}</span></td>
    <td>${escapeHTML(formatDate(user.lastLoginAt))}</td><td>${escapeHTML(formatDate(user.lastAttemptAt))}<br><span style="color:#7b8498">${escapeHTML(user.lastAttemptLabel || "")}</span></td>
    <td>${escapeHTML(formatDate(user.createdAt))}</td><td>${(user.completedDays || []).length} / 5</td><td>${Number(user.sectionsCompleted) || 0} / 40</td>
    <td>${Number(user.assessmentPasses) || 0} / ${Number(user.assessmentAttempts) || 0}</td><td>${Number(user.mockTestsPassed) || 0}</td>
    <td>${(user.badges || []).length}</td><td>${Number(user.xp) || 0}</td><td>${escapeHTML(formatDate(user.lastActivityAt))}</td></tr>`).join("");
  root.innerHTML = `<header class="firebase-admin-head"><div><span class="eyebrow" style="color:#5368c9">ADMIN · LIVE LEARNER OPERATIONS</span><h1 id="firebaseAdminTitle">Learner performance</h1><p>Google-authenticated learner summaries. Notes and assignment text are never shown in this dashboard.</p></div><span class="firebase-live-indicator">${fromCache ? "CACHED SNAPSHOT" : "LIVE UPDATES"}</span></header>
    <div class="firebase-admin-kpis"><article class="firebase-admin-kpi"><small>Registered learners</small><strong>${adminUsers.length}</strong></article><article class="firebase-admin-kpi"><small>Active in last 24 hours</small><strong>${active}</strong></article><article class="firebase-admin-kpi"><small>Five-day completions</small><strong>${complete}</strong></article><article class="firebase-admin-kpi"><small>Average learner XP</small><strong>${avgXP}</strong></article></div>
    <section class="firebase-analysis"><h2>Progress and assessment analysis</h2><p>${attempts ? `${passes} passed tests out of ${attempts} recorded attempts (${Math.round(passes / attempts * 100)}% pass rate).` : "No assessment attempts have been recorded yet."} Completion bars show learners who have finished each day.</p><div class="firebase-day-chart">${bars}</div></section>
    <section class="firebase-users"><div class="panelhead"><div><h2>All learner records</h2><p class="assessment-sub">Registration, last sign-in, last assessment attempt, completion, assessment outcomes, badges, XP and recent activity.</p></div></div><div class="firebase-users-toolbar"><input id="adminSearch" type="search" placeholder="Filter by learner name or email" aria-label="Filter learner records"><button class="action" id="downloadAdminCsv">Download CSV</button></div><div class="firebase-table-wrap"><table class="firebase-table"><thead><tr><th>Learner</th><th>Last sign-in</th><th>Last attempt</th><th>Registered</th><th>Days</th><th>Sections</th><th>Assessment pass / attempts</th><th>Mock passes</th><th>Badges</th><th>XP</th><th>Last activity</th></tr></thead><tbody>${rows || `<tr><td colspan="11" class="firebase-empty">${adminUsers.length ? "No learners match this filter." : "No Google learner profiles are recorded yet."}</td></tr>`}</tbody></table></div><p class="firebase-sync-note">Live Firestore listener · ${new Date().toLocaleTimeString()} · Updates arrive as learner progress is saved.</p></section>`;
  document.getElementById("adminSearch")?.addEventListener("input", () => renderAdminDashboard(fromCache));
  document.getElementById("downloadAdminCsv")?.addEventListener("click", downloadAdminCSV);
}

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

function startAdminListener() {
  if (!window.firebaseIsAdmin || adminUnsubscribe || !db) return;
  const indicator = document.querySelector(".firebase-live-indicator");
  if (indicator) indicator.textContent = "CONNECTING…";
  adminUnsubscribe = window.firebaseOnSnapshot(window.firebaseCollection(db, "users"), snapshot => {
    adminUsers = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (dateValue(b.lastActivityAt)?.getTime() || 0) - (dateValue(a.lastActivityAt)?.getTime() || 0));
    renderAdminDashboard(snapshot.metadata.fromCache);
  }, error => {
    adminUnsubscribe = null;
    const root = document.getElementById("firebaseAdminDashboard");
    if (root) root.innerHTML = `<section class="panel"><h2>Admin report unavailable</h2><p>${escapeHTML(readableError(error))}</p><p>Confirm your admin claim and deploy firestore.rules to the Firebase project.</p></section>`;
  });
}

function setAdminAccess(enabled) {
  window.firebaseIsAdmin = enabled;
  const nav = document.getElementById("navAdmin");
  if (nav) nav.hidden = !enabled;
  if (!enabled) {
    adminUnsubscribe?.();
    adminUnsubscribe = null;
    document.getElementById("firebaseAdminDashboard")?.setAttribute("hidden", "");
  }
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
  window.firebaseSetDoc = firestoreSdk.setDoc;
  window.firebaseCollection = firestoreSdk.collection;
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
      setAdminAccess(false);
      if (previous) window.deactivateFirebaseLearner?.(previous.uid);
      return;
    }
    try {
      const token = await authSdk.getIdTokenResult(user);
      const isAdmin = token.claims.admin === true;
      setAdminAccess(isAdmin);
      window.activateFirebaseLearner?.(user, isAdmin);
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
