/**
 * DayZero · Immersive Time Telemetry Instrument
 * Core Controller & Accurate Calendar Countdown Engine
 */

(function () {
  'use strict';

  // --- Configuration & Local Storage ---
  const STORAGE_KEY = 'primemode_preferences_v1';
  const defaultPrefs = {
    showSeconds: true,
    orientation: 'auto', // 'auto', 'portrait', 'landscape'
    ringMetric: 'remaining', // 'remaining' or 'elapsed'
    hourlyChime: false,
    auraMotion: true,
    focusMessage: true
  };

  let prefs = { ...defaultPrefs };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      prefs = { ...defaultPrefs, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // --- State Variables ---
  let wakeLockSentinel = null;
  let wakeLockRequestedByUser = false;
  let isTouchLocked = false;
  let isFocusMode = false;
  let touchHoldTimer = null;
  let touchHoldStartTime = 0;
  const TOUCH_HOLD_DURATION_MS = 1500;
  let lastCheckedHour = new Date().getHours();
  let audioCtx = null;

  // --- DOM Elements ---
  const landingScreen = document.getElementById('landing-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const landingLiveTime = document.getElementById('landing-live-time');
  const landingLiveDate = document.getElementById('landing-live-date');
  const activateBtn = document.getElementById('activate-btn');
  const windowModeBtn = document.getElementById('window-mode-btn');

  // Dashboard Clock & Hero
  const todayCountdown = document.getElementById('today-countdown-time');
  const todayLabels = document.getElementById('today-time-labels');
  const todayRingProgress = document.getElementById('today-ring-progress');
  const todayRingPercent = document.getElementById('today-ring-percent');
  const todayRingLabel = document.getElementById('today-ring-label');
  const todayRingElapsed = document.getElementById('today-ring-elapsed');
  const focusReminderText = document.getElementById('focus-reminder-text');

  // Secondary Cards
  const weekTimeRem = document.getElementById('week-time-remaining');
  const weekProgressFill = document.getElementById('week-progress-fill');
  const weekPercentBadge = document.getElementById('week-percent-badge');
  const weekElapsedStat = document.getElementById('week-elapsed-stat');
  const weekRemainingStat = document.getElementById('week-remaining-stat');

  const monthTimeRem = document.getElementById('month-time-remaining');
  const monthProgressFill = document.getElementById('month-progress-fill');
  const monthPercentBadge = document.getElementById('month-percent-badge');
  const monthElapsedStat = document.getElementById('month-elapsed-stat');
  const monthRemainingStat = document.getElementById('month-remaining-stat');

  const yearTimeRem = document.getElementById('year-time-remaining');
  const yearProgressFill = document.getElementById('year-progress-fill');
  const yearPercentBadge = document.getElementById('year-percent-badge');
  const yearElapsedStat = document.getElementById('year-elapsed-stat');
  const yearRemainingStat = document.getElementById('year-remaining-stat');

  // Toolbars & Controls
  const toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn');
  const fullscreenBtnLabel = document.getElementById('fullscreen-btn-label');
  const toggleWakelockBtn = document.getElementById('toggle-wakelock-btn');
  const wakelockDot = document.getElementById('wakelock-dot');
  const wakelockBtnLabel = document.getElementById('wakelock-btn-label');
  const activateTouchlockBtn = document.getElementById('activate-touchlock-btn');
  const toggleFocusModeBtn = document.getElementById('toggle-focus-mode-btn');
  const quickFocusBtn = document.getElementById('quick-focus-btn');
  const exitFocusPill = document.getElementById('exit-focus-pill');
  const toggleSecondsBtn = document.getElementById('toggle-seconds-btn');
  const secondsBtnLabel = document.getElementById('seconds-btn-label');
  const toggleOrientationBtn = document.getElementById('toggle-orientation-btn');
  const orientationBtnLabel = document.getElementById('orientation-btn-label');

  // Touch Lock Overlay
  const touchOverlay = document.getElementById('touch-protection-overlay');
  const touchUnlockProgress = document.getElementById('touch-unlock-progress');
  const touchInstructionText = document.getElementById('touch-lock-instruction-text');

  // Settings Modal
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const exitToLandingBtn = document.getElementById('exit-to-landing-btn');
  const settingsModal = document.getElementById('settings-modal');
  const orientationSegGroup = document.getElementById('orientation-select-group');
  const ringMetricGroup = document.getElementById('ring-metric-group');
  const settingShowSeconds = document.getElementById('setting-show-seconds');
  const settingHourlyChime = document.getElementById('setting-hourly-chime');
  const settingAuraMotion = document.getElementById('setting-aura-motion');
  const settingFocusMessage = document.getElementById('setting-focus-message');

  // Diagnostics
  const diagWakelock = document.getElementById('diag-wakelock');
  const diagFullscreen = document.getElementById('diag-fullscreen');
  const diagOrientation = document.getElementById('diag-orientation');
  const diagTimezone = document.getElementById('diag-timezone');
  const diagPwa = document.getElementById('diag-pwa');
  const pwaInstallBtn = document.getElementById('pwa-install-btn');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // Constant constants for SVG circles
  const TODAY_CIRCUMFERENCE = 2 * Math.PI * 92; // 578.053
  const TOUCH_CIRCUMFERENCE = 2 * Math.PI * 42; // 263.89

  // Focus Quotes Pool
  const FOCUS_QUOTES = [
    "The clock won't wait. Make this hour count.",
    "Time is the scarcest currency of software engineering.",
    "Eliminate friction. Stay inside the zone.",
    "Build deliberately. Each minute matters.",
    "Deep work compounds. Protect your attention."
  ];
  let quoteIndex = 0;

  // ==========================================================================
  // TOAST NOTIFICATIONS
  // ==========================================================================
  function showToast(message, duration = 3000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  }

  // ==========================================================================
  // ACCURATE CALENDAR COUNTDOWNS (ZERO-DRIFT)
  // ==========================================================================
  function updateCountdowns() {
    const now = new Date();
    const currentHour = now.getHours();

    // Check for hour turn chime
    if (prefs.hourlyChime && currentHour !== lastCheckedHour && now.getMinutes() === 0 && now.getSeconds() === 0) {
      playHourlyChime();
    }
    lastCheckedHour = currentHour;

    // --- 0. Landing Screen Live Clock ---
    if (landingScreen && landingScreen.classList.contains('active')) {
      const timeStr = formatDigitalTime(now.getHours(), now.getMinutes(), now.getSeconds(), true);
      landingLiveTime.textContent = timeStr;
      landingLiveDate.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // --- 1. TODAY COUNTDOWN ---
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const totalDayMs = endOfDay.getTime() - startOfDay.getTime();
    const elapsedDayMs = now.getTime() - startOfDay.getTime();
    const remainingDayMs = Math.max(0, endOfDay.getTime() - now.getTime());

    const remHours = Math.floor(remainingDayMs / (1000 * 60 * 60));
    const remMins = Math.floor((remainingDayMs % (1000 * 60 * 60)) / (1000 * 60));
    const remSecs = Math.floor((remainingDayMs % (1000 * 60)) / 1000);

    todayCountdown.textContent = formatDigitalTime(remHours, remMins, remSecs, prefs.showSeconds);
    todayLabels.innerHTML = prefs.showSeconds
      ? '<span>Hours</span> : <span>Minutes</span> : <span>Seconds</span>'
      : '<span>Hours</span> : <span>Minutes</span>';

    const dayElapsedPct = Math.min(100, Math.max(0, (elapsedDayMs / totalDayMs) * 100));
    const dayRemainingPct = Math.min(100, Math.max(0, (remainingDayMs / totalDayMs) * 100));

    // Update Today Radial Ring
    const activePercent = prefs.ringMetric === 'remaining' ? dayRemainingPct : dayElapsedPct;
    const ringOffset = TODAY_CIRCUMFERENCE - (activePercent / 100) * TODAY_CIRCUMFERENCE;
    todayRingProgress.style.strokeDashoffset = ringOffset;
    todayRingPercent.textContent = `${Math.round(activePercent)}%`;

    if (prefs.ringMetric === 'remaining') {
      todayRingLabel.textContent = 'REMAINING';
      todayRingElapsed.textContent = `${Math.round(dayElapsedPct)}% ELAPSED`;
    } else {
      todayRingLabel.textContent = 'ELAPSED';
      todayRingElapsed.textContent = `${Math.round(dayRemainingPct)}% REMAINING`;
    }

    // --- 2. THIS WEEK (ISO Monday-Start) ---
    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
    const totalWeekMs = endOfWeek.getTime() - startOfWeek.getTime();
    const elapsedWeekMs = now.getTime() - startOfWeek.getTime();
    const remainingWeekMs = Math.max(0, endOfWeek.getTime() - now.getTime());

    const weekRemDays = Math.floor(remainingWeekMs / (1000 * 60 * 60 * 24));
    const weekRemHours = Math.floor((remainingWeekMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const weekRemMins = Math.floor((remainingWeekMs % (1000 * 60 * 60)) / (1000 * 60));

    weekTimeRem.textContent = prefs.showSeconds
      ? `${weekRemDays}d ${weekRemHours}h ${weekRemMins}m`
      : `${weekRemDays}d ${weekRemHours}h`;

    const weekElapsedPct = Math.min(100, Math.max(0, (elapsedWeekMs / totalWeekMs) * 100));
    const weekRemainingPct = Math.min(100, Math.max(0, (remainingWeekMs / totalWeekMs) * 100));

    weekProgressFill.style.width = `${weekRemainingPct}%`;
    weekPercentBadge.textContent = `${Math.round(weekRemainingPct)}% rem`;
    weekElapsedStat.textContent = `${Math.round(weekElapsedPct)}% elapsed`;
    weekRemainingStat.textContent = `${Math.round(weekRemainingPct)}% remaining`;

    // --- 3. THIS MONTH ---
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const totalMonthMs = endOfMonth.getTime() - startOfMonth.getTime();
    const elapsedMonthMs = now.getTime() - startOfMonth.getTime();
    const remainingMonthMs = Math.max(0, endOfMonth.getTime() - now.getTime());

    const monthRemDays = Math.floor(remainingMonthMs / (1000 * 60 * 60 * 24));
    const monthRemHours = Math.floor((remainingMonthMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    monthTimeRem.textContent = `${monthRemDays}d ${monthRemHours}h`;

    const monthElapsedPct = Math.min(100, Math.max(0, (elapsedMonthMs / totalMonthMs) * 100));
    const monthRemainingPct = Math.min(100, Math.max(0, (remainingMonthMs / totalMonthMs) * 100));

    monthProgressFill.style.width = `${monthRemainingPct}%`;
    monthPercentBadge.textContent = `${Math.round(monthRemainingPct)}% rem`;
    monthElapsedStat.textContent = `${Math.round(monthElapsedPct)}% elapsed`;
    monthRemainingStat.textContent = `${Math.round(monthRemainingPct)}% remaining`;

    // --- 4. THIS YEAR ---
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    const totalYearMs = endOfYear.getTime() - startOfYear.getTime();
    const elapsedYearMs = now.getTime() - startOfYear.getTime();
    const remainingYearMs = Math.max(0, endOfYear.getTime() - now.getTime());

    const yearRemDays = Math.floor(remainingYearMs / (1000 * 60 * 60 * 24));
    const yearRemHours = Math.floor((remainingYearMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    yearTimeRem.textContent = `${yearRemDays}d ${yearRemHours}h`;

    const yearElapsedPct = Math.min(100, Math.max(0, (elapsedYearMs / totalYearMs) * 100));
    const yearRemainingPct = Math.min(100, Math.max(0, (remainingYearMs / totalYearMs) * 100));

    yearProgressFill.style.width = `${yearRemainingPct}%`;
    yearPercentBadge.textContent = `${Math.round(yearRemainingPct)}% rem`;
    yearElapsedStat.textContent = `${Math.round(yearElapsedPct)}% elapsed`;
    yearRemainingStat.textContent = `${Math.round(yearRemainingPct)}% remaining`;
  }

  function formatDigitalTime(h, m, s, withSeconds) {
    const pad = (n) => String(n).padStart(2, '0');
    return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
  }

  // ==========================================================================
  // FULLSCREEN API (Direct User Gesture Safe)
  // ==========================================================================
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        showToast('Entered Fullscreen');
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        showToast('Exited Fullscreen');
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
      showToast('Fullscreen unavailable in this browser context');
    }
    syncFullscreenStatus();
  }

  function syncFullscreenStatus() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (fullscreenBtnLabel) {
      fullscreenBtnLabel.textContent = isFs ? 'Exit Fullscreen' : 'Fullscreen';
    }
    if (toggleFullscreenBtn) {
      toggleFullscreenBtn.classList.toggle('active', isFs);
    }
  }

  document.addEventListener('fullscreenchange', syncFullscreenStatus);
  document.addEventListener('webkitfullscreenchange', syncFullscreenStatus);

  // ==========================================================================
  // SCREEN WAKE LOCK API (With Visibility Auto-Reacquire)
  // ==========================================================================
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockRequestedByUser = true;
        updateWakeLockUI(true);

        wakeLockSentinel.addEventListener('release', () => {
          updateWakeLockUI(false);
        });
        showToast('Screen Wake Lock active');
      } catch (err) {
        console.warn('Wake Lock request error:', err);
        updateWakeLockUI(false);
      }
    } else {
      updateWakeLockUI(false, true);
    }
  }

  async function releaseWakeLock() {
    wakeLockRequestedByUser = false;
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      } catch (e) {
        console.warn('Error releasing wake lock:', e);
      }
    }
    updateWakeLockUI(false);
    showToast('Screen Wake Lock released');
  }

  async function toggleWakeLock() {
    if (wakeLockSentinel) {
      await releaseWakeLock();
    } else {
      await requestWakeLock();
    }
  }

  function updateWakeLockUI(isActive, isUnsupported = false) {
    if (isUnsupported) {
      wakelockDot.className = 'wakelock-status-dot unsupported';
      wakelockBtnLabel.textContent = 'Awake: N/A';
      toggleWakelockBtn.title = 'Screen Wake Lock is not supported on this browser';
      return;
    }

    if (isActive) {
      wakelockDot.className = 'wakelock-status-dot active';
      wakelockBtnLabel.textContent = 'Screen awake';
      toggleWakelockBtn.classList.add('active');
      toggleWakelockBtn.title = 'Keep Screen Awake is active (click to release)';
    } else {
      wakelockDot.className = 'wakelock-status-dot';
      wakelockBtnLabel.textContent = 'Screen sleepable';
      toggleWakelockBtn.classList.remove('active');
      toggleWakelockBtn.title = 'Click to keep screen awake';
    }
  }

  // Auto re-acquire wake lock when tab returns from background
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      updateCountdowns();
      if (wakeLockRequestedByUser && !wakeLockSentinel) {
        await requestWakeLock();
      }
    }
  });

  // ==========================================================================
  // TOUCH PROTECTION (Press & Hold for 1.5s Unlock)
  // ==========================================================================
  function activateTouchLock() {
    isTouchLocked = true;
    touchOverlay.classList.remove('hidden');
    touchOverlay.setAttribute('aria-hidden', 'false');
    touchUnlockProgress.style.strokeDashoffset = TOUCH_CIRCUMFERENCE;
    touchInstructionText.textContent = 'Press & hold for 1.5s to unlock';
    showToast('Touch Protection Active');
  }

  function startTouchHold(e) {
    if (e.cancelable) e.preventDefault();
    touchHoldStartTime = performance.now();

    if (touchHoldTimer) cancelAnimationFrame(touchHoldTimer);

    function step(now) {
      const elapsed = now - touchHoldStartTime;
      const progress = Math.min(1, elapsed / TOUCH_HOLD_DURATION_MS);

      const offset = TOUCH_CIRCUMFERENCE - progress * TOUCH_CIRCUMFERENCE;
      touchUnlockProgress.style.strokeDashoffset = offset;
      touchInstructionText.textContent = `Keep holding... ${Math.round(progress * 100)}%`;

      if (progress >= 1) {
        // Unlock trigger
        unlockTouch();
        if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
        return;
      }

      touchHoldTimer = requestAnimationFrame(step);
    }

    touchHoldTimer = requestAnimationFrame(step);
  }

  function cancelTouchHold() {
    if (touchHoldTimer) {
      cancelAnimationFrame(touchHoldTimer);
      touchHoldTimer = null;
    }
    // Smooth reset
    touchUnlockProgress.style.strokeDashoffset = TOUCH_CIRCUMFERENCE;
    touchInstructionText.textContent = 'Press & hold for 1.5s to unlock';
  }

  function unlockTouch() {
    if (touchHoldTimer) {
      cancelAnimationFrame(touchHoldTimer);
      touchHoldTimer = null;
    }
    isTouchLocked = false;
    touchOverlay.classList.add('hidden');
    touchOverlay.setAttribute('aria-hidden', 'true');
    showToast('Touch Protection Unlocked');
  }

  touchOverlay.addEventListener('mousedown', startTouchHold);
  window.addEventListener('mouseup', cancelTouchHold);
  touchOverlay.addEventListener('touchstart', startTouchHold, { passive: false });
  window.addEventListener('touchend', cancelTouchHold);
  window.addEventListener('touchcancel', cancelTouchHold);

  // ==========================================================================
  // FOCUS DISPLAY (ZEN VIEW)
  // ==========================================================================
  function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    document.body.classList.toggle('focus-mode-active', isFocusMode);
    if (exitFocusPill) {
      if (isFocusMode) {
        exitFocusPill.classList.remove('hidden');
      } else {
        exitFocusPill.classList.add('hidden');
      }
    }
    if (isFocusMode) {
      showToast('Focus Mode Active (Controls hidden)');
    } else {
      showToast('Focus Mode Exited');
    }
  }

  // ==========================================================================
  // ORIENTATION ADAPTATION
  // ==========================================================================
  async function applyOrientation(mode) {
    prefs.orientation = mode;
    savePrefs();

    document.body.classList.remove('orientation-force-portrait', 'orientation-force-landscape');

    if (mode === 'portrait') {
      document.body.classList.add('orientation-force-portrait');
      orientationBtnLabel.textContent = 'Portrait';
      attemptScreenOrientationLock('portrait');
    } else if (mode === 'landscape') {
      document.body.classList.add('orientation-force-landscape');
      orientationBtnLabel.textContent = 'Landscape';
      attemptScreenOrientationLock('landscape');
    } else {
      orientationBtnLabel.textContent = 'Auto';
      if (screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch (e) {}
      }
    }

    // Sync settings buttons
    orientationSegGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.orientation === mode);
    });
  }

  async function attemptScreenOrientationLock(type) {
    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock(type);
      } catch (err) {
        // Normal in browsers without fullscreen or mobile permission
        showToast(`Layout adapted for ${type}. Physical device controls screen orientation.`);
      }
    } else {
      showToast(`Layout adapted for ${type}.`);
    }
  }

  function cycleOrientation() {
    const sequence = ['auto', 'portrait', 'landscape'];
    const nextIdx = (sequence.indexOf(prefs.orientation) + 1) % sequence.length;
    applyOrientation(sequence[nextIdx]);
  }

  // ==========================================================================
  // HOURLY CHIME (Web Audio Synthesizer)
  // ==========================================================================
  function playHourlyChime() {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now); // A6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime could not play:', e);
    }
  }

  // ==========================================================================
  // SETTINGS & DIAGNOSTICS
  // ==========================================================================
  function openSettings() {
    // Populate diagnostics
    diagWakelock.textContent = 'wakeLock' in navigator ? 'Supported (Active: ' + Boolean(wakeLockSentinel) + ')' : 'Unsupported';
    diagFullscreen.textContent = document.fullscreenEnabled ? 'Supported' : 'Unsupported';
    diagOrientation.textContent = screen.orientation && screen.orientation.lock ? 'Supported' : 'Layout-Only (Desktop/iOS)';
    diagTimezone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (diagPwa) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
      diagPwa.textContent = isStandalone ? 'Installed (Standalone)' : 'Ready (Installable PWA)';
    }

    // Sync switches
    settingShowSeconds.checked = prefs.showSeconds;
    settingHourlyChime.checked = prefs.hourlyChime;
    settingAuraMotion.checked = prefs.auraMotion;
    settingFocusMessage.checked = prefs.focusMessage;

    ringMetricGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.metric === prefs.ringMetric);
    });

    orientationSegGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.orientation === prefs.orientation);
    });

    settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  // ==========================================================================
  // TRANSITION: LANDING TO DASHBOARD (Gesture Entry)
  // ==========================================================================
  async function activatePrimeMode(wantFullscreen = true) {
    // Direct user-gesture invocation
    if (wantFullscreen) {
      try {
        await toggleFullscreen();
      } catch (e) {
        console.warn('Fullscreen request failed:', e);
      }
    }

    try {
      await requestWakeLock();
    } catch (e) {
      console.warn('Wake lock error:', e);
    }

    // Switch views
    landingScreen.classList.remove('active');
    landingScreen.classList.add('hidden');

    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('active');

    updateCountdowns();
    showToast('DayZero Activated · Stay Focused');
  }

  function exitToLanding() {
    closeSettings();
    dashboardScreen.classList.remove('active');
    dashboardScreen.classList.add('hidden');

    landingScreen.classList.remove('hidden');
    landingScreen.classList.add('active');

    if (wakeLockSentinel) releaseWakeLock();
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {}
    }
    showToast('Returned to landing screen');
  }

  // ==========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // ==========================================================================
  function init() {
    // Apply initial preferences
    applyOrientation(prefs.orientation);
    secondsBtnLabel.textContent = prefs.showSeconds ? 'Seconds: On' : 'Seconds: Off';
    document.body.classList.toggle('reduce-motion', !prefs.auraMotion);
    focusReminderText.style.display = prefs.focusMessage ? 'block' : 'none';

    // Rotating focus reminder clicks
    focusReminderText.addEventListener('click', () => {
      quoteIndex = (quoteIndex + 1) % FOCUS_QUOTES.length;
      focusReminderText.textContent = FOCUS_QUOTES[quoteIndex];
    });

    // 1. Activation Buttons
    activateBtn.addEventListener('click', () => activatePrimeMode(true));
    windowModeBtn.addEventListener('click', () => activatePrimeMode(false));

    // 2. Toolbar Buttons
    toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
    toggleWakelockBtn.addEventListener('click', toggleWakeLock);
    activateTouchlockBtn.addEventListener('click', activateTouchLock);
    toggleFocusModeBtn.addEventListener('click', toggleFocusMode);
    quickFocusBtn.addEventListener('click', toggleFocusMode);
    exitFocusPill.addEventListener('click', toggleFocusMode);

    toggleSecondsBtn.addEventListener('click', () => {
      prefs.showSeconds = !prefs.showSeconds;
      savePrefs();
      secondsBtnLabel.textContent = prefs.showSeconds ? 'Seconds: On' : 'Seconds: Off';
      settingShowSeconds.checked = prefs.showSeconds;
      updateCountdowns();
      showToast(prefs.showSeconds ? 'Seconds Visible' : 'Seconds Hidden');
    });

    toggleOrientationBtn.addEventListener('click', cycleOrientation);

    // 3. Settings Modal
    openSettingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', closeSettings);
    exitToLandingBtn.addEventListener('click', exitToLanding);

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });

    settingShowSeconds.addEventListener('change', (e) => {
      prefs.showSeconds = e.target.checked;
      savePrefs();
      secondsBtnLabel.textContent = prefs.showSeconds ? 'Seconds: On' : 'Seconds: Off';
      updateCountdowns();
    });

    settingHourlyChime.addEventListener('change', (e) => {
      prefs.hourlyChime = e.target.checked;
      savePrefs();
      if (prefs.hourlyChime) playHourlyChime();
    });

    settingAuraMotion.addEventListener('change', (e) => {
      prefs.auraMotion = e.target.checked;
      savePrefs();
      document.body.classList.toggle('reduce-motion', !prefs.auraMotion);
    });

    settingFocusMessage.addEventListener('change', (e) => {
      prefs.focusMessage = e.target.checked;
      savePrefs();
      focusReminderText.style.display = prefs.focusMessage ? 'block' : 'none';
    });

    // Ring Metric Segmented Control
    ringMetricGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        ringMetricGroup.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        prefs.ringMetric = btn.dataset.metric;
        savePrefs();
        updateCountdowns();
      });
    });

    // Orientation Segmented Control
    orientationSegGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyOrientation(btn.dataset.orientation);
      });
    });

    // Ring click to toggle between remaining and elapsed
    const ringWrapper = document.getElementById('today-ring-wrapper');
    if (ringWrapper) {
      ringWrapper.style.cursor = 'pointer';
      ringWrapper.addEventListener('click', () => {
        prefs.ringMetric = prefs.ringMetric === 'remaining' ? 'elapsed' : 'remaining';
        savePrefs();
        updateCountdowns();
        showToast(`Displaying ${prefs.ringMetric.toUpperCase()} %`);
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (!settingsModal.classList.contains('hidden')) {
          closeSettings();
        } else if (isFocusMode) {
          toggleFocusMode();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'z' || e.key === 'Z') {
        toggleFocusMode();
      } else if (e.key === 's' || e.key === 'S') {
        toggleSecondsBtn.click();
      }
    });

    // --- PWA & Android Installation Lifecycle ---
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[DayZero PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.warn('[DayZero PWA] Service Worker failed:', err));
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaInstallBtn) {
        pwaInstallBtn.classList.remove('hidden');
      }
    });

    if (pwaInstallBtn) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
      if (!isStandalone) {
        pwaInstallBtn.classList.remove('hidden');
      }

      pwaInstallBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('Installing DayZero on device...');
          }
          deferredPrompt = null;
          pwaInstallBtn.classList.add('hidden');
        } else {
          showToast('Tap browser menu (⋮) -> "Install App" or "Add to Home screen"');
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      showToast('DayZero Installed Successfully!');
      if (pwaInstallBtn) pwaInstallBtn.classList.add('hidden');
    });

    // Start Clock Tick (zero timer drift, 250ms cadence)
    updateCountdowns();
    setInterval(updateCountdowns, 250);
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
