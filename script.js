let audioBuffer = null;
let csvData = [];
let vibrationSchedule = [];

let audioCtx = null;
let source = null;
let startTime = 0;
let pauseOffset = 0;
let animationFrame = null;

const audioInput = document.getElementById("audioFile");
const csvInput = document.getElementById("csvFile");
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

startButton.addEventListener("click", async () => {
  if (!audioInput.files[0] || !csvInput.files[0]) {
    alert("请先上传音频文件和 CSV 文件！");
    return;
  }

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (source) {
    source.stop();
    cancelAnimationFrame(animationFrame);
  }

  pauseOffset = 0;
  await loadAudio(audioInput.files[0]);
  await loadCSV(csvInput.files[0]);
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

async function loadAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
}

async function loadCSV(file) {
  const text = await file.text();
  const lines = text.trim().split("\n");

  const raw = lines.slice(1).map(line => {
    const [frameIndex, frameTime, energy] = line.split(";");
    return {
      time: parseFloat(frameTime),
      energy: parseFloat(energy)
    };
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

// ⬇️ 振动可视化逻辑
function logVibration(duration) {
  if (vibrationHistory.length >= 100) {
    vibrationHistory.shift();
  }
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
    if (dur > 70) {
      color = "#f44336"; // 高
    } else if (dur > 40) {
      color = "#ff9800"; // 中
    }

    const barHeight = (dur / 100) * height;
    vibeCtx.fillStyle = color;
    vibeCtx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
  });
}
