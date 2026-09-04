# 👁️ Eye Tracker Studio

<div align="center">

![Eye Tracker Studio Logo](./public/icon.png)

**A 60 FPS AI-Powered Gaze Tracking Engine, Interactive Cursor FX & OS Desktop Companion**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![MediaPipe](https://img.shields.io/badge/Google_MediaPipe-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
[![TailwindCSS v4](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)

</div>

---

## ✨ Features Overview

Eye Tracker Studio turns your cursor and camera into a high-performance 60 FPS interactive companion. Designed for presentations, gaming, content creation, and accessibility.

```
       🎯 Cursor / Webcam Gaze Tracking
               │
      ┌────────┴────────┐
      ▼                 ▼
✨ Cute Eye Engine   🎮 Interactive FX & Tools
- Organic Blinking   - Laser Reticle
- Curved Eyelids     - Presenter Spotlight
- 7+ Eye Themes      - Particle Sprites & Trails
- Double Catchlight  - Odometer & AI Voice
```

---

## 🚀 Active Feature Modules (Live in App)

### 1. 🎯 AI Webcam Iris Accuracy & Blink Detection
- **MediaPipe 468-Point Face Mesh:** Real-time sub-millimeter iris coordinate tracking via local webcam.
- **Organic Curved Eyelids:** Bezier-curved top & bottom eyelids with eyelashes that adapt naturally to gaze direction.
- **Automatic Blinking Engine:** Periodic organic blinks (2.5s–4.8s intervals) with 20% double-blink playful patterns.

### 2. 💖 7 Eye Themes & Cute Anime Sparkle Mode
- **7 Themes:** `Cute Anime Sparkle`, `Cyberpunk Neon`, `Neeko Cat`, `Mecha Robot`, `3D Googly`, `Pixel Retro`.
- **Double Catchlight & Blush Aura:** Shiny double catchlight reflections and soft pink blush glow in Cute mode.

### 3. ✋ Draggable Floating Eyes Anywhere & 6 Position Presets
- **Direct Click & Drag:** Click and drag directly on the eyes to place them anywhere on your display!
- **6 Quick Position Presets:** `📌 Top Center`, `↖ Top-Left`, `↗ Top-Right`, `🎯 Center`, `↙ Bottom-Left`, `↘ Bottom-Right`.

### 4. 😭 Crying Tears & Dual Lock Mode Safety System
- **Animated Tear Physics:** Tears stream down from pupils when screen staring threshold is reached.
- **AI Voice Warning:** Speaks *"You've been staring at the screen for too long! Please take an eye break now."*
- **Dual Lock Mode Chooser:** Switch between **🖥️ Virtual Auto-Unlock** (2-minute auto countdown lock) or **🔒 Native OS Workstation Lock** (Ubuntu/Windows system lock).

### 5. 💡 Presenter Spotlight, Laser & Particle Art
- 💡 **Presenter Spotlight Mode:** Darkens the rest of your display while focusing a bright spotlight around your active cursor area.
- ✨ **Particle FX & Trails:** Glowing cursor particle trails with custom sprite shapes (Stars, Hearts, Bubbles, Neon Dust).
- 🔊 **Web Audio Synthesizer:** Real-time procedural audio pop, laser beam, and power-up sound effects.
- 🎙️ **AI Voice Command Recognition:** Voice-control themes and features (say `"laser"`, `"cyberpunk"`, `"game"`, `"trail"`, `"break"`).
- 📊 **Odometer Analytics:** Tracks distance traveled in meters, total clicks, and real-time mouse speed.
- 🎯 **Gaze Target Shooter Mini-Game:** Built-in interactive target popping game to test your gaze and cursor speed!

### 6. ✋ Air Touch — Hand-Tracking Cursor Control (V1, in-app)
Turns your webcam-tracked hand into a virtual pointer for Eye Tracker Studio's own UI —
an independent module from eye tracking, built so the two can later be combined. Off by
default (Studio Controls → Air Touch, or `Ctrl+Shift+H`).

- **Index finger pointer:** extend your index finger to move a smoothed virtual cursor.
- **Pinch = left click** (thumb + index): one click per pinch, not one per frame.
- **Pinch + move = drag:** holding a pinch while moving translates to a real drag on
  whatever's under the cursor.
- **Two fingers (index + middle) = right click.**
- **Open palm = pause:** stops cursor/input instantly, clears the moment you relax your hand.
- **Fist = emergency stop:** immediately releases any held button; you must explicitly
  re-enable Air Touch afterward (a safety button appears in the panel).
- **Its own 5-point calibration**, entirely separate from gaze calibration — never shares
  or overwrites eye-tracking calibration data.

**Important scope note — read before assuming more:** V1 controls a virtual cursor and
dispatches clicks *within Eye Tracker Studio's own window only*. It does **not** move
your real OS mouse cursor or click other applications yet — this repository has no
native OS input-injection capability at all today, on any platform. See
[PROJECT_STATUS.md](PROJECT_STATUS.md) → "Air Touch / Hand Control V1" for the full
architecture, an honest per-platform table (Windows/macOS/Linux X11/Linux Wayland — none
implemented in V1), and what a future system-wide backend would require. Processing is
fully local (MediaPipe HandLandmarker, same on-device model family as the existing eye
tracker) — no camera frames or hand landmarks ever leave your machine.

---

## 🔮 Master Feature & AI Roadmap

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the detailed status of every item below,
[ROADMAP.md](ROADMAP.md) for what's blocked and why, and [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
for caveats on a few "done" items that ship an honest, smaller version of what's described.

### 🤖 Multimodal Vision AI ("What Are You Looking At?")
- [ ] **AI Gaze Scene Explainer:** Hold your gaze on any code block, image, or chart on screen to get an instant AI vision summary! *(blocked — needs a hosted vision-LLM API, see ROADMAP.md)*
- [ ] **AI Reading Assistant:** Highlights and defines complex terms as your gaze scans text. *(blocked — same dependency, see ROADMAP.md)*

### 💖 Cute Emotion & Expression Engine
- [x] **😭 Crying Eyes & Eye Strain Safety Lock:** Eyes stream animated tear drops, trigger AI speech alert, and lock screen for 2-minute eye rest.
- [x] **Happy / Smiling Eyes (`^ ^`):** Eyes squint into cute curved arcs when clicking or moving in circles.
- [x] **Love / Heart Pupil Mode (`💖`):** Pupils morph into glowing pulsing hearts on double-click or webcam eye contact.
- [x] **Animated Eyebrows:** Expressive mini eyebrows for surprised, focused, and sleepy moods.
- [ ] **Gaze Eye-Contact Reaction:** Eyes blush and smile back when AI camera detects direct eye contact! *(partial — smile detection triggers Love mode; a distinct sustained-eye-contact detector wasn't built separately, see ROADMAP.md)*

### 🎨 Creative Eye Themes & Custom Designer
- [x] **Anime Heart Eyes:** Pulsing pink heart pupils with star catchlights.
- [x] **Dragon / Reptile Eyes:** Glowing golden scales with dynamic pupil slits.
- [x] **Cosmic Galaxy Eyes:** Rotating spiral galaxy iris with floating stardust.
- [x] **Matrix Code Rain Eyes:** Falling green matrix numbers inside the pupil.
- [x] **Fiery Flame Eyes:** Animated flickering flame aura around the iris.
- [x] **In-App Custom Eye Studio:** Customizer modal to tweak pupil color, iris gradient, and glow intensity.

### 🎵 Musical Eye Theremin & Audio Visualizer
- [x] **Musical Eye Theremin:** Play musical notes with your gaze (X-axis controls pitch, Y-axis controls vibrato).
- [x] **Music Reactive Pupil Pulse:** Pupils pulse dynamically to the bassline of playing music!

### 🌈 Mood-Adaptive Trails & Black Hole Physics
- [x] **Speed-Adaptive Particle Trails:** Trail colors shift from cyan to fiery orange based on cursor speed.
- [x] **Gravity Well Black Hole FX:** Click creates a mini black hole pulling screen particles inward!

### 📸 Gaze Screen Recorder & Multilingual Voice
- [x] **Gaze Overlay Screen Recorder:** Record quick screen clips with animated eyes overlay. *(exports WebM, not GIF/MP4 yet — see KNOWN_ISSUES.md)*
- [x] **Multilingual Voice Commands:** Support voice commands in English, Spanish, Japanese, French, German, and Hindi!

### 🧠 Emotion AI & Mood Synchronization
- [ ] **AI Mood & Facial Expression Sync:** Real-time facial sentiment analysis via webcam so the eyes mirror your exact mood (*Happy, Surprised, Confused, Focused, Tired*). *(partial — heuristic gesture detection ships now; full sentiment classification needs a trained model, see ROADMAP.md)*
- [x] **Drowsiness & Eye-Fatigue Guard:** Heuristic webcam-based reminder that detects prolonged eye closure, frequent/long blinking, and yawn-like mouth opening to suggest a break. *(a wellness/productivity heuristic, not a medical or sleep-diagnostic system — thresholds still need real-camera tuning; see KNOWN_ISSUES.md)*

### 🎯 AI Intent Pointer & Smart Gestures
- [ ] **AI Target Snap-to-Button:** Predicts intended click targets from gaze velocity and snaps the reticle smoothly to buttons. *(blocked — needs OS accessibility-tree access, see ROADMAP.md)*
- [x] **AI Camera Gestures:** Head Nod (Confirm), Head Shake (Cancel), Smile (Heart particles), Left/Right Winks.

### 🧠 Subconscious Pupillometry & Attention Analysis
- [x] **Cognitive Load & Focus Heatmap:** Maps high-focus zones from gaze dwell time. *(dwell-time proxy, not true pupil-dilation pupillometry — see KNOWN_ISSUES.md)*
- [ ] **Reading Speed & Dyslexia Assistance:** Auto-scrolls documents smoothly matching your eye reading speed. *(blocked — needs OS accessibility-tree or browser-extension-level DOM access, see ROADMAP.md)*

### 🔮 5-Year Vision Horizon (2031 Frontier)
- [ ] **Spatial 3D Holographic Eyes (AR/VR Ready):** Full WebXR 3D eye avatar projection into Apple Vision Pro & Meta Quest. *(blocked — needs AR/VR hardware, see ROADMAP.md)*
- [ ] **Brain-Computer Interface (BCI) Hybrid:** Neural-gaze hybrid intent recognition for ultra-fast zero-latency control. *(blocked — needs BCI hardware + vendor SDK, see ROADMAP.md)*
- [ ] **Autonomous AI Screen Companion:** Animated eye companion that watches your screen, provides contextual code refactoring tips, and interacts conversationally! *(future research — open-ended agent scope, see ROADMAP.md)*

---

## 🛠️ Tech Stack
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS v4 + Lucide Icons
- **AI Computer Vision:** `@mediapipe/face_mesh`
- **Desktop Runtime:** Electron 35
- **Audio:** Web Audio API + SpeechSynthesis API

---

## 💻 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone repository
git clone https://github.com/ripudamank2/eye_tracking_pain.git
cd eye_tracking_pain

# Install dependencies
npm install

# Run web development server
npm run dev
```

Open **`http://localhost:5173/`** in your browser!

### Desktop Application

```bash
# Run Electron desktop mode
npx electron electron/main.cjs --no-sandbox --ozone-platform=x11

# Build Linux AppImage / .deb package
npm run build:linux
```

---

## 📜 License
MIT License © 2026 Ripudaman
