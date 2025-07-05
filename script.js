let audioBuffer = null;
let csvData = [];
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
  csvData = lines.slice(1).map(line => {
    const [frameIndex, frameTime, energy] = line.split(";");
    return {
      time: parseFloat(frameTime),
      energy: parseFloat(energy)
    };
  });
}

function playAudio(offset = 0) {
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  startTime = audioCtx.currentTime - offset;
  source.start(0, offset);

  const duration = audioBuffer.duration;

  pauseButton.style.display = "inline-block";
  resumeButton.style.display = "inline-block";
  progressBar.style.display = "block";
  pauseButton.disabled = false;
  resumeButton.disabled = true;

  function vibrateLoop() {
    const elapsed = audioCtx.currentTime - startTime;
    const row = csvData.find(d => Math.abs(d.time - elapsed) < 0.01);
    if (row && row.energy > -18 && "vibrate" in navigator) {
      navigator.vibrate(20);
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
