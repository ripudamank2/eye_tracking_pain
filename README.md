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

## 🚀 Active Feature Modules

### 1. 🎯 AI Webcam Iris Accuracy & Blink Detection
- **MediaPipe 468-Point Face Mesh:** Real-time sub-millimeter iris coordinate tracking via local webcam.
- **Smart Smoothing Filter:** Low-pass exponential smoothing to eliminate camera jitter while preserving fast saccadic gaze movements.
- **Real-time Blink & Wink Detection:** Detects single-eye winks and dual-eye blinks from video frames, triggering matching eyelid closures in the canvas.

---

### 2. 💖 Cute Eye Behaviors & Dynamic Expressions
- **Organic Eyelids & Automatic Blinking:** Natural periodic blinking cycle (2.5s–4.8s) with realistic Bezier curved eyelids and eyelash contours.
- **Double Blinks & Playful Expressions:** Occasional double-blinks and wink responses on fast cursor movements or mouse clicks.
- **Expressive States:**
  - **Sleepy Idle Mode:** Eyes droop gently when no motion is detected for >25 seconds.
  - **Dizzy Spin Mode:** Pupils spin in dizzy circles during rapid mouse flick movements (>1200 px/s).
  - **Surprised Dilated Pupils:** Pupils dilate when rapid mouse clicks occur.

---

### 3. 🎨 Custom Eye Themes & Visual Styles
- ✨ **Cute Sparkle (Default):** Anime-style large pupils with double glossy catchlight sparkles and soft pink blush highlights (`#f472b6`).
- 👁️ **Natural:** Classic human iris with gradient depth and soft lighting reflections.
- ⚡ **Cyberpunk:** Neon cyan/magenta HUD rings, rotating target arcs, and crosshair overlays.
- 🐱 **Cat Slit:** Golden amber sclera with dynamic vertical cat pupil slits.
- 👀 **Googly:** Spring-damper physics simulation for bouncy wobbly googly eyes.
- 👾 **Pixel:** 8-bit retro arcade pixelated eye blocks.
- 🤖 **Robot:** Metallic dark bezel with glowing red LED core.

---

### 4. 🎮 Interactive FX, Tools & Accessibility
- 🎯 **Laser Reticle Mode:** High-precision red targeting reticle with futuristic HUD crosshairs.
- 💡 **Presenter Spotlight Mode:** Darkens the rest of your display while focusing a bright spotlight around your active cursor area.
- ✨ **Particle FX & Trails:** Glowing cursor particle trails with custom sprite shapes (Stars, Hearts, Bubbles, Neon Dust).
- 🔊 **Web Audio Synthesizer:** Real-time procedural audio pop, laser beam, and power-up sound effects.
- 🎙️ **AI Voice Command Recognition:** Voice-control themes and features (say `"laser"`, `"cyberpunk"`, `"game"`, `"trail"`).
- 📊 **Odometer Analytics:** Tracks distance traveled in meters, total clicks, and real-time mouse speed.
- 🎯 **Gaze Target Shooter Mini-Game:** Built-in interactive target popping game to test your gaze and cursor speed!

---

## 🤖 Futuristic AI Features Roadmap

### 🤖 Multimodal Vision AI ("What Are You Looking At?")
- [ ] **AI Gaze Scene Explainer:** Hold your gaze on any code block, image, or chart on screen to get an instant AI vision summary!
- [ ] **AI Reading Assistant:** Highlights and defines complex terms as your gaze scans text.

### 🧠 Emotion AI & Mood Synchronization
- [ ] **AI Mood & Facial Expression Sync:** Real-time facial sentiment analysis via webcam so the eyes mirror your exact mood (Happy, Surprised, Confused, Focused, Tired).
- [ ] **AI Drowsiness & Yawn Safety Guard:** Detects eye strain, frequent blinks, or yawns to suggest 20-second eye relaxation breaks.

### 🎯 AI Intent Pointer & Smart Gestures
- [ ] **AI Target Snap-to-Button:** Predicts intended click targets from gaze trajectories and snaps the reticle smoothly to buttons.
- [ ] **AI Camera Gestures:**
  - **Head Nod:** Confirm / Select
  - **Head Shake:** Cancel / Back
  - **Smile:** Trigger heart burst particles!
  - **Left Wink:** Left-click | **Right Wink:** Right-click

### 🗣️ AI Voice & Audio Companion
- [ ] **Interactive AI Voice Personality:** Give the animated eyes a voice assistant persona that speaks back when you command them!
- [ ] **Adaptive Generative Audio:** Background ambient music tempo adapts to your mouse speed and focus state.

---

## 🛠️ Quick Start (Development)

### Prerequisites
- Node.js `v18+` or `v20+`
- npm `v9+`

### Installation & Local Run

```bash
# Clone repository
git clone https://github.com/ripudamank2/eye_tracking_pain.git
cd eye_tracking_pain

# Install dependencies
npm install

# Run local development server (60 FPS Web App)
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## ⌨️ Desktop Controls & Interactions

| Interaction | Action |
| :--- | :--- |
| **Mouse Move / Webcam Gaze** | Eyes follow target with spring physics |
| **Right-Click Anywhere** | Open Floating Studio Controls Context Menu |
| **Left Click** | Trigger click burst particles & sound FX |
| **Rapid Clicks** | Dilate pupils (Surprised state) |
| **Fast Mouse Flick** | Dizzy pupil spin animation |
| **Idle (>25s)** | Sleepy eyelids droop |

---

## 🤝 Contributing & License

Feel free to open issues, submit pull requests, or suggest new eye themes!

Distributed under the **MIT License**. Created with ❤️ by the VoltAI Team.
