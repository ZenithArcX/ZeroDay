# DayZero · Immersive Time Telemetry Dashboard

**DayZero** is a minimal, immersive countdown dashboard designed for software engineers. It makes time feel visible, tangible, and scarce, eliminating digital distractions and grounding your focus during deep coding sessions.

---

## 🚀 Quick Start Instructions

DayZero is built with high-performance Vanilla HTML5, CSS3, and modern JavaScript, with zero external production dependencies.

### Option 1: Start with Node.js
```bash
npm start
# or
node server.js
```
Then open your browser at:
```
http://localhost:3000
```

### Option 2: Start with Python
```bash
python -m http.server 3000
```

---

## 📱 How to Install on Android Devices (PWA)

DayZero is built as a **Progressive Web App (PWA)**, meaning you can install it directly onto any Android phone or tablet without needing Google Play Store:

1. Open **[https://zenitharcx.github.io/ZeroDay/](https://zenitharcx.github.io/ZeroDay/)** in **Google Chrome**, **Brave**, or **Samsung Internet** on your Android device.
2. Tap the **"📲 Install App on Device"** button on the landing screen, or tap the browser menu (**⋮**) in the top-right corner.
3. Select **"Install App"** (or **"Add to Home screen"**).
4. Tap **Install**.
5. DayZero will now appear directly in your Android app drawer and home screen with its custom icon!
6. When launched, it runs in standalone mode (no browser address bar), supports full screen, keeps your screen awake via Wake Lock, and works 100% offline via Service Worker.

## ⚡ Core Features & User Experience

1. **Lightweight Landing Screen & Instant Activation**
   - Clean landing screen featuring the live local clock, date, and product manifesto.
   - Dominant **"ACTIVATE DAYZERO"** button initiates browser APIs (`requestFullscreen` and `navigator.wakeLock.request`) directly within the user gesture event handler.
   - Also provides an *"Open in standard window mode"* option for dual-monitor or windowed setups.

2. **Zero-Drift Local Calendar Mathematics**
   - **TODAY**: Exact remaining time until midnight local time, with live hours, minutes, and seconds.
   - **THIS WEEK**: ISO standard workweek boundary (Monday 00:00 to next Monday 00:00).
   - **THIS MONTH**: Precise boundary to the 1st of next month (correctly handles 28, 29, 30, and 31-day months).
   - **THIS YEAR**: Exact countdown to January 1st of the next year (automatically accounts for leap years).
   - Real-time updates without timer drift, and auto-resynchronization when waking from computer sleep or background tab suspension.

3. **Prominent Radial Progress Ring**
   - Circular SVG gauge with glowing violet-to-cyan ambient gradient.
   - Displays real-time **Remaining %** and **Elapsed %**.
   - Click the ring to instantly flip between remaining and elapsed metrics.

4. **Screen Wake Lock API with Auto-Reacquire**
   - Keeps your screen awake when propped up on an Android phone, iPad, tablet, or secondary display.
   - Automatically re-acquires the wake lock if the tab is switched or restored from background suspension (addressing browser-level wake lock release behavior).

5. **Touch Protection Shield**
   - Protects touch screens and propped mobile devices from accidental taps while typing on your keyboard.
   - Features an intentional **press-and-hold unlock mechanism** (1.5 seconds) with a circular SVG progress feedback ring and optional haptic confirmation.

6. **Zen Focus Display**
   - Hides navigation bars, toolbars, and secondary labels so only the pure countdown digits and progress visualization remain.
   - Hover or tap the discrete floating pill or press `Esc` / `Z` to exit Focus Display.

7. **Orientation Control**
   - Automatically adapts when your physical device rotates (Mobile Portrait, Mobile Landscape, Tablet, and Desktop widescreen).
   - Includes **Auto**, **Portrait**, and **Landscape** preference controls. When selected, applies layout optimizations and requests `screen.orientation.lock()` where supported.

8. **Settings & Telemetry Diagnostics**
   - Accessible via the top-right gear icon.
   - Toggle Seconds (`HH:MM:SS` vs `HH:MM`).
   - Hourly soft sine chime (synthesized directly via the Web Audio API without external audio files).
   - Atmospheric aura animation toggle (respects `prefers-reduced-motion`).
   - Live hardware diagnostics for Wake Lock, Fullscreen API, Orientation API, and Timezone.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `F` | Toggle Fullscreen |
| `Z` | Toggle Zen Focus Display |
| `S` | Toggle Seconds On / Off |
| `Esc` | Close Settings / Exit Focus Display |

---

## 🌐 Browser Capabilities & Considerations

- **Screen Wake Lock API**: Supported in Chrome, Edge, Safari 16.4+, and Chromium Android. In unsupported browsers or insecure origins (non-HTTPS/non-localhost), the status indicator indicates availability without breaking the dashboard.
- **Screen Orientation Lock**: Standard desktop browsers and iOS Safari restrict programmatic orientation locking to physical device rotation; DayZero gracefully applies responsive CSS layout adaptation while clarifying device-level behavior.
