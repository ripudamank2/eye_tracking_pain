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

## 🔮 The 10-Step Next-Gen AI Paradigm Roadmap

### Step 1: 🧠 Cognitive Pupillometry & Attention Analysis
- [ ] **Task-Evoked Pupil Dilations:** Measures cognitive load & micro-frustration in real-time to adjust UI legibility.
- [ ] **Foveal Speed Reading Mode:** Stream 1,000 WPM text directly into your gaze focus zone.

### Step 2: ⚡ Micro-Saccade Telepathy (Zero-Latency Intent)
- [ ] **Predictive Target Trajectory:** Detects 10ms micro-saccades before hand movement to snap cursor pre-emptively.

### Step 3: 🎭 Living AI Digital Companion (Autonomous Soul Engine)
- [ ] **Autonomous Behavior States:** Eyes explore screen, inspect open windows, and chase particles independently when idle.
- [ ] **Multimodal "Look & Command":** Look at *any* screen region and say *"Explain"*, *"Translate"*, or *"Summarize"*.

### Step 4: 🛡️ Continuous Biometric Iris Guard & Privacy Shield
- [ ] **Passive Eye-Reflection Security:** Continuous ocular reflection authentication; instant screen lock if looking away.
- [ ] **Peeping Guard:** Automatically blurs sensitive windows when an unknown face walks behind you.

### Step 5: 🌐 Spatial 3D Lighting & Multi-Monitor Teleportation
- [ ] **Webcam Ambient Relighting:** Eyes cast dynamic 3D shadows matching room lighting & desktop window colors.
- [ ] **Multi-Display Seamless Jump:** Eyes teleport smoothly across multi-monitor setups.

### Step 6: 🎥 Twitch / YouTube Streamer Overlay Suite
- [ ] **Live Gaze Heatmap Broadcast:** Overlay real-time gaze targeting on live game streams.
- [ ] **Twitch Chat Emoji Reaction System:** Eyes react dynamically to live chat emotes (`Pog`, `LUL`, `❤️`).

### Step 7: 🎨 Generative Prompt-to-Theme Engine
- [ ] **Text-to-Eye Theme Generation:** Type any prompt (*"Vaporwave Sunset"*, *"Cyber Dragon"*) to generate procedural themes.

---

## 🛠️ Quick Start (Development)

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

## 🤝 Contributing & License

Distributed under the **MIT License**. Created with ❤️ by the VoltAI Team.
