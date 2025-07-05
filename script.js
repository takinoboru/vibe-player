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

// 新增视频元素引用
const videoContainer = document.getElementById("videoContainer");
const bgVideo = document.getElementById("bgVideo");

pauseButton.style.display = "none";
resumeButton.style.display = "none";
progressBar.style.display = "none";

presetSelect.addEventListener("change", () => {
  selectedPreset = presetSelect.value;
  uploadSection.style.display = selectedPreset === "custom" ? "block" : "none";
  
  // 根据选择显示/隐藏视频
  videoContainer.style.display = selectedPreset === "letitgo" ? "block" : "none";
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

  // 重置视频位置
  if (selectedPreset === "letitgo") {
    bgVideo.currentTime = 0;
  }
  
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
    
    // 暂停视频
    if (selectedPreset === "letitgo") {
      bgVideo.pause();
    }
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

  // 如果是 letitgo 预设，预加载视频
  if (selectedPreset === "letitgo") {
    bgVideo.load();
  }
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

  // 如果是 letitgo 预设，播放视频
  if (selectedPreset === "letitgo") {
    bgVideo.currentTime = offset;
    bgVideo.play().catch(e => console.error("视频播放失败:", e));
  }

  function vibrateLoop() {
    const elapsed = audioCtx.currentTime - startTime;
    const beat = vibrationSchedule.find(d => Math.abs(d.time - elapsed) < 0.01);
    if (beat && "vibrate" in navigator) {
      navigator.vibrate(beat.duration);
      logVibration(beat.duration);
    } 

    // 同步视频播放进度
    if (selectedPreset === "letitgo" && bgVideo) {
      const videoOffset = bgVideo.currentTime;
      // 如果视频和音频不同步超过0.1秒，重新同步
      if (Math.abs(videoOffset - elapsed) > 0.1) {
        bgVideo.currentTime = elapsed;
      }
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