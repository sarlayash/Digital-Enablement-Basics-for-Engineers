(function () {
  "use strict";

  var ENABLED_KEY = "fieldGuideHourlyReminders";
  var NEXT_KEY = "fieldGuideHourlyReminderNext";
  var LAST_KEY = "fieldGuideHourlyReminderLast";
  var timer = 0;
  var labels = {
    topics: "Learning topics",
    simulator: "Hands-on simulator",
    notes: "Field notes",
    placement: "Placement tips and FAQs",
    assignment: "Daily assignment",
    pre: "Pass the pre-assessment",
    post: "Pass the post-assessment",
    wheel: "Complete 25 wheel questions"
  };

  function savedState() {
    try { return JSON.parse(localStorage.getItem("fieldGuideState") || "{}"); }
    catch (_) { return {}; }
  }

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) === "1";
  }

  function nextAllowedHour(from) {
    var next = new Date(from.getTime());
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    if (next.getHours() >= 20) {
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
    } else if (next.getHours() < 8) {
      next.setHours(8, 0, 0, 0);
    }
    return next.getTime();
  }

  function eligibleDayLimit(state, now) {
    if (!state.start) return -1;
    var start = new Date(Number(state.start));
    if (!Number.isFinite(start.getTime())) return -1;
    var first = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    if (start.getHours() >= 20) first += 86400000;
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.min(4, Math.floor((today - first) / 86400000));
  }

  function pendingForToday(state, now) {
    var hour = now.getHours();
    if (!state.name || sessionStorage.getItem("fieldGuideLoggedOut") === "1" || hour < 8 || hour >= 20) return null;
    var limit = eligibleDayLimit(state, now);
    if (limit < 0) return null;

    for (var day = 0; day <= limit; day++) {
      if (state.dayAwards && state.dayAwards[day]) continue;
      var done = state.dailySections && state.dailySections[day] || {};
      var assessment = state.assessments && state.assessments[day] || {};
      var wheel = state.wheel && state.wheel[day] || {};
      var pending = [];
      if (!done.topics) pending.push(labels.topics);
      if (!done.simulator) pending.push(labels.simulator);
      if (!done.notes) pending.push(labels.notes);
      if (!done.placement) pending.push(labels.placement);
      if (!done.assignment) pending.push(labels.assignment);
      if (!(assessment.pre && assessment.pre.passed)) pending.push(labels.pre);
      if (!(assessment.post && assessment.post.passed)) pending.push(labels.post);
      if (!wheel.seen || wheel.seen.length < 25) pending.push(labels.wheel);
      if (pending.length) return { day: day + 1, pending: pending };
    }
    return null;
  }

  function updateControls() {
    var button = document.getElementById("hourlyReminderToggle");
    var status = document.getElementById("hourlyReminderStatus");
    if (!button || !status) return;
    var state = savedState();
    var signedIn = !!state.name && sessionStorage.getItem("fieldGuideLoggedOut") !== "1";
    var available = "Notification" in window && window.isSecureContext;
    button.hidden = !signedIn;
    status.hidden = !signedIn;
    button.disabled = !available;
    if (!available) {
      status.textContent = "Browser notifications are unavailable here. Open the secure site in a supported browser.";
      return;
    }
    if (Notification.permission === "denied") {
      button.textContent = "Notifications blocked";
      button.disabled = true;
      status.textContent = "Allow notifications in your browser’s site settings to turn on reminders.";
    } else if (isEnabled() && Notification.permission === "granted") {
      button.textContent = "Turn off hourly reminders";
      status.textContent = "On: reminders run from 8:00 AM to 8:00 PM while this portal stays open.";
    } else {
      button.textContent = "Enable hourly reminders";
      status.textContent = Notification.permission === "granted"
        ? "Browser notifications are allowed. Turn on hourly reminders for unfinished daily tasks."
        : "Get an hourly browser reminder when daily tasks remain.";
    }
  }

  async function sendReminder(pending) {
    var now = new Date();
    var hourKey = [now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()].join("-");
    if (localStorage.getItem(LAST_KEY) === hourKey) return;
    localStorage.setItem(LAST_KEY, hourKey);
    var tasks = pending.pending.slice(0, 3).join(", ");
    if (pending.pending.length > 3) tasks += " +" + (pending.pending.length - 3) + " more";
    var options = {
      body: "Day " + pending.day + ": " + tasks + ". Finish them to earn today’s XP and badge and move toward your course certificate.",
      icon: "./assets/pwa-icon-192.png",
      badge: "./assets/pwa-icon-192.png",
      tag: "daily-learning-task-reminder",
      renotify: true
    };
    try {
      var registration = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration("./") : null;
      if (registration && registration.showNotification) {
        await registration.showNotification("Your daily learning tasks are waiting", options);
      } else {
        new Notification("Your daily learning tasks are waiting", options);
      }
    } catch (error) {
      console.warn("Hourly learning reminder could not be shown:", error);
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!isEnabled() || !("Notification" in window) || Notification.permission !== "granted") return;
    var now = Date.now();
    var next = Number(localStorage.getItem(NEXT_KEY));
    if (!Number.isFinite(next) || next < 1) {
      next = nextAllowedHour(new Date(now));
      localStorage.setItem(NEXT_KEY, String(next));
    }
    timer = setTimeout(async function () {
      var current = new Date();
      var pending = pendingForToday(savedState(), current);
      if (pending) await sendReminder(pending);
      localStorage.setItem(NEXT_KEY, String(nextAllowedHour(current)));
      updateControls();
      schedule();
    }, Math.max(1000, next - now));
  }

  async function toggleReminders() {
    if (!("Notification" in window) || !window.isSecureContext) return;
    if (isEnabled()) {
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem(NEXT_KEY);
      clearTimeout(timer);
      updateControls();
      return;
    }
    var permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      updateControls();
      return;
    }
    localStorage.setItem(ENABLED_KEY, "1");
    localStorage.setItem(NEXT_KEY, String(nextAllowedHour(new Date())));
    updateControls();
    schedule();
  }

  function init() {
    var button = document.getElementById("hourlyReminderToggle");
    if (button) button.addEventListener("click", toggleReminders);
    updateControls();
    schedule();
    window.setInterval(updateControls, 60000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") schedule();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
