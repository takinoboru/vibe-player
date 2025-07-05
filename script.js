let audioBuffer = null;
let csvData = [];

const audioInput = document.getElementById("audioFile");
const csvInput = document.getElementById("csvFile");
const startButton = document.getElementById("startButton");

startButton.addEventListener("click", async () => {
  if (!audioInput.files[0] || !csvInput.files[0]) {
    alert("请先上传音频文件和 CSV 文件！");
    return;
  }

  await loadAudio(audioInput.files[0]);
  await loadCSV(csvInput.files[0]);
  playAudioWithVibration();
});

async function loadAudio(file) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 创建 source 并播放（稍后在播放函数中再用）
  window.audioCtx = audioCtx;
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

function playAudioWithVibration() {
  const source = window.audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(window.audioCtx.destination);
  source.start();

  const startTime = window.audioCtx.currentTime;

  function vibrateLoop() {
    const elapsed = window.audioCtx.currentTime - startTime;
    const row = csvData.find(d => Math.abs(d.time - elapsed) < 0.01); // 找到当前帧

    if (row && row.energy > -18 && "vibrate" in navigator) {
      navigator.vibrate(20); // 振动 20ms
    }

    if (elapsed < audioBuffer.duration) {
      requestAnimationFrame(vibrateLoop);
    }
  }

  vibrateLoop();
}
