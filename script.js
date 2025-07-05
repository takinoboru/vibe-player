let audioBuffer = null;
let vibrationSchedule = [];

let audioCtx = null;
let source = null;
let startTime = 0;
let pauseOffset = 0;
let animationFrame = null;

let selectedPreset = "letitgo";

const presetSelect = document.getElementById("presetSelect");
const audioInput = document.getElementById("audioFile");
const csvInput = document.getElementById("csvFile");
const uploadSection = document.getElementById("uploadSection");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const progressBar = document.getElementById("progress");

const vibeCanvas = document.getElementById("vibeCanvas");
const vibeCtx = vibeCanvas.getContext("2d");
let vibrationHistory = [];

pauseButton.style.display = "none";
resumeButton.style.display = "none";
progressBar.style.display = "none";

presetSelect.addEventListener("change", () => {
  selectedPreset = presetSelect.value;
  uploadSection.style.display = selectedPreset === "custom" ? "block" : "none";
});

startButton.addEventListener("click", async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (source) {
    source.stop();
    cancelAnimationFrame(animationFrame);
  }

  pauseOffset = 0;
  vibrationHistory = [];
  drawVibeTimeline();

  await loadAudioAndCSV();
  playAudio();
});

pauseButton.addEventListener("click", () => {
  if (audioCtx && audioCtx.state === "running") {
    pauseOffset = audioCtx.currentTime - startTime;
    source.stop();
    cancelAnimationFrame(animationFrame);
    pauseButton.disabled = true;
    resumeButton.disabled = false;
  }
});

resumeButton.addEventListener("click", () => {
  if (audioCtx && audioBuffer) {
    playAudio(pauseOffset);
    pauseButton.disabled = false;
    resumeButton.disabled = true;
  }
});

progressBar.addEventListener("input", () => {
  if (audioBuffer) {
    const percent = progressBar.value / 100;
    pauseOffset = audioBuffer.duration * percent;
    if (source) {
      source.stop();
      cancelAnimationFrame(animationFrame);
    }
    playAudio(pauseOffset);
    pauseButton.disabled = false;
    resumeButton.disabled = true;
  }
});

async function loadAudioAndCSV() {
  const fetchBinary = async (url) => await fetch(url).then(r => r.arrayBuffer());
  const fetchText = async (url) => await fetch(url).then(r => r.text());

  let audioBuf, csvText;

  if (selectedPreset === "letitgo") {
    audioBuf = await fetchBinary("let_it_go.wav");
    csvText = await fetchText("let_it_go_1.csv");
  } else if (selectedPreset === "demo2") {
    audioBuf = await fetchBinary("another_demo.wav");
    csvText = await fetchText("another_demo.csv");
  } else {
    audioBuf = await audioInput.files[0].arrayBuffer();
    csvText = await csvInput.files[0].text();
  }

  audioBuffer = await audioCtx.decodeAudioData(audioBuf);
  parseCSVText(csvText);
}

function parseCSVText(text) {
  const lines = text.trim().split("\n").slice(1);
  const raw = lines.map(line => {
    const [frameIndex, frameTime, energy] = line.split(";");
    return { time: parseFloat(frameTime), energy: parseFloat(energy) };
  });

  const MIN_ENERGY = -6.8;
  const MIN_RISE = 0.15;

  vibrationSchedule = raw
    .map((d, i, arr) => {
      if (i === 0) return null;
      const delta = d.energy - arr[i - 1].energy;
      if (d.energy > MIN_ENERGY && delta > MIN_RISE) {
        return {
          time: d.time,
          duration: energyToVibrationDuration(d.energy)
        };
      }
      return null;
    })
    .filter(Boolean);
}

function energyToVibrationDuration(energy) {
  const mapped = Math.max(0, 7 + energy);
  const logScale = Math.log10(1 + mapped);
  return Math.round(20 + logScale * 100);
}

function playAudio(offset = 0) {
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  startTime = audioCtx.currentTime - offset;
  source.start(0, offset);

  pauseButton.style.display = "inline-block";
  resumeButton.style.display = "inline-block";
  progressBar.style.display = "block";
  pauseButton.disabled = false;
  resumeButton.disabled = true;

  const duration = audioBuffer.duration;

  function vibrateLoop() {
    const elapsed = audioCtx.currentTime - startTime;
    const beat = vibrationSchedule.find(d => Math.abs(d.time - elapsed) < 0.01);
    if (beat && "vibrate" in navigator) {
      navigator.vibrate(beat.duration);
      logVibration(beat.duration);
    }

    const percent = Math.min(100, (elapsed / duration) * 100);
    progressBar.value = percent.toFixed(1);

    if (elapsed < duration) {
      animationFrame = requestAnimationFrame(vibrateLoop);
    } else {
      pauseButton.disabled = true;
      resumeButton.disabled = true;
    }
  }

  vibrateLoop();
}

function logVibration(duration) {
  if (vibrationHistory.length >= 100) vibrationHistory.shift();
  vibrationHistory.push(duration);
  drawVibeTimeline();
}

function drawVibeTimeline() {
  const width = vibeCanvas.width;
  const height = vibeCanvas.height;
  const barWidth = width / 100;
  vibeCtx.clearRect(0, 0, width, height);

  vibrationHistory.forEach((dur, i) => {
    let color = "#ffeb3b";
    if (dur > 70) color = "#f44336";
    else if (dur > 40) color = "#ff9800";

    const barHeight = (dur / 100) * height;
    vibeCtx.fillStyle = color;
    vibeCtx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
  });
}
