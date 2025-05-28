let video;
let faceapi;
let detections = []; // 儲存臉部偵測結果
let handpose;
let hands = [];     // 儲存手部偵測結果

// 遊戲狀態變數
let gameStarted = false; // 遊戲是否開始
let gameModelsLoaded = false; // 所有 AI 模型是否載入完成
let startTime;           // 遊戲開始時間
let timeLeft = 60;       // 剩餘時間 (秒)
let gameInterval;        // 倒數計時器的 interval ID

let nameList = [
  "顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴",
  "馬嘉祺", "丁程鑫", "宋亞軒", "劉耀文", "張真源", "嚴浩翔", "賀峻霖"
];
let teacherList = ["顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴"];
let currentName = "";      // 目前顯示的人名
let lastSwitchTime = 0;    // 上次切換人名的時間 (millis())
let switchInterval = 3000; // 每 3 秒切換一次人名 (3000 毫秒)
let feedback = "";         // 顯示給玩家的回饋訊息
let score = 0;             // 遊戲分數

let boxSize = 200;
let boxPulse = 0;          // 人名方塊的脈動效果

// 動作判斷狀態變數 (防止重複加減分)
let actionCheckedForCurrentName = false; // 當前人名是否已檢查過動作並給分/扣分

// 視覺回饋相關變數
let showCorrectionMark = false; // 是否顯示打勾或打叉
let correctionMarkType = '';    // 'check' 或 'cross'
let correctionMarkPosition;     // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255;  // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime;    // 打勾或打叉開始顯示的時間

// 你提供的嘴巴點位索引 (用於繪圖和判斷張大嘴巴)
const mouthPoints = [
  409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, // 上下唇外側
  76, 77, 90, 180, 85, 16, 315, 404, 320, 307, 306, 408, 304, 303, 302, 11, 72, 73, 74, 184  // 上下唇內側
];

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, videoReady);
  video.size(width, height);
  video.hide();

  textAlign(CENTER, CENTER);
  textSize(28);

  showStartScreen();

  let startButton = select('#startButton');
  if (startButton) {
    startButton.mousePressed(startGame);
  } else {
    console.error("錯誤：找不到 ID 為 'startButton' 的 HTML 按鈕！");
    console.error("請確認你的 index.html 檔案中有 <button id='startButton'>...</button>");
  }
}

function showStartScreen() {
  background(220);
  fill(0);
  textSize(32);
  text("準備開始...", width / 2, height / 2 - 50);
  textSize(20);
  text("（等待模型載入）", width / 2, height / 2); // 簡化提示
  
  let startButton = select('#startButton');
  if (startButton) {
    startButton.style('display', 'block');
    startButton.html('開始遊戲'); // 確保文字是開始遊戲
    startButton.attribute('disabled', ''); // 預設禁用按鈕
  }

  if (gameModelsLoaded) {
    if (startButton) {
      startButton.html('模型載入完成，點擊開始');
      startButton.removeAttribute('disabled'); // 啟用按鈕
    }
  } else {
    if (startButton) {
      startButton.html('載入 AI 模型中...'); // 載入時的提示
    }
  }
}

function videoReady() {
  console.log("攝影機成功啟動！");

  faceapi = ml5.faceApi(video, { withLandmarks: true, withDescriptors: false }, () => {
    console.log("FaceAPI ready!");
    faceapi.detect(gotFace);
    checkModelsLoaded();
  });

  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
    checkModelsLoaded();
  });
  handpose.on("predict", (results) => {
    hands = results;
  });
}

function checkModelsLoaded() {
  let faceApiReady = faceapi && faceapi.ready;
  let handposeReady = handpose && handpose.ready;

  if (faceApiReady && handposeReady) {
    gameModelsLoaded = true;
    showStartScreen(); // 更新開始畫面以啟用按鈕
  }
}


function startGame() {
  if (!gameModelsLoaded) {
    feedback = "請等待 AI 模型載入完成！";
    return;
  }
  if (detections.length === 0 && hands.length === 0) {
      feedback = "請將臉部或手部對準攝影機後再點擊開始！";
      return; // 如果沒有偵測到任何東西，不啟動遊戲
  }

  console.log("遊戲開始！");
  gameStarted = true;
  startTime = millis();
  pickNewName();
  
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      endGame();
    }
  }, 1000);

  let startButton = select('#startButton');
  if (startButton) {
    startButton.style('display', 'none');
  }
}

function draw() {
  background(250);
  image(video, 0, 0, width, height);

  if (!gameStarted) {
    showStartScreen();
    return;
  }

  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  let boxY = height * 0.8;
  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, boxY, currentBoxSize, currentBoxSize / 2);

  fill(0);
  textSize(28);
  text(currentName, width / 2, boxY);

  fill(0, 200, 0);
  textSize(24);
  textAlign(LEFT, TOP);
  text("分數: " + score, 10, 10);

  fill(0, 0, 200);
  textSize(24);
  textAlign(RIGHT, TOP);
  text("時間: " + max(0, timeLeft) + "s", width - 10, 10);

  fill(255, 0, 0);
  textAlign(CENTER, BOTTOM);
  textSize(22);
  text(feedback, width / 2, height - 10);

  if (!actionCheckedForCurrentName) {
    checkAction();
  }

  drawMouthPoints();
  drawHandLandmarks();

  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0);
      push();
      translate(correctionMarkPosition.x, correctionMarkPosition.y);
      noFill();
      strokeWeight(5);
      stroke(0, 0, 255, correctionMarkAlpha); // 藍色

      if (correctionMarkType === 'check') {
        line(-20, 0, 0, 20);
        line(0, 20, 40, -20);
      } else if (correctionMarkType === 'cross') {
        line(-20, -20, 20, 20);
        line(-20, 20, 20, -20);
      }
      pop();
    } else {
      showCorrectionMark = false;
    }
  }

  if (millis() - lastSwitchTime > switchInterval) {
    pickNewName();
    actionCheckedForCurrentName = false;
  }
}

function endGame() {
  gameStarted = false;
  background(50);
  fill(255);
  textSize(48);
  text("遊戲結束！", width / 2, height / 2 - 50);
  textSize(32);
  text("最終分數: " + score, width / 2, height / 2 + 20);
  textSize(20);
  text("點擊重新開始", width / 2, height / 2 + 80);
  
  score = 0;
  timeLeft = 60;
  feedback = "";
  detections = [];
  hands = [];

  let startButton = select('#startButton');
  if (startButton) {
    startButton.style('display', 'block');
    startButton.html('重新開始遊戲');
    startButton.removeAttribute('disabled');
  }
}

function pickNewName() {
  currentName = random(nameList);
  lastSwitchTime = millis();
  feedback = "";
  actionCheckedForCurrentName = false;
}

function gotFace(err, result) {
  if (result) {
    detections = result;
  }
  faceapi.detect(gotFace);
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  if (actionCheckedForCurrentName) return;

  let correctAction = false;
  let actionDetected = false;

  const isCurrentTeacher = teacherList.includes(currentName);

  if (isCurrentTeacher) {
    // 如果是教科老師，期望張大嘴巴
    if (isOpenMouth()) { // 判斷是否張大嘴巴
      actionDetected = true;
      feedback = "😁 成功張大嘴巴！";
      correctAction = true;
      score += (currentName === "陳慶帆" ? 2 : 1);
    } else {
      feedback = "😐 對老師要張大嘴巴才能加分喔！";
      correctAction = false;
      score -= (currentName === "陳慶帆" ? 3 : 1);
    }
  } else {
    // 如果不是教科老師，期望比讚
    if (isThumbsUp()) {
      actionDetected = true;
      feedback = "👍 這不是老師，給他個讚！";
      correctAction = true;
      score += 1;
    } else {
      feedback = "👎 這時候要比個讚啦～";
      correctAction = false;
      score -= 1;
    }
  }

  if (actionDetected) {
      actionCheckedForCurrentName = true;
      if (detections.length > 0) {
        let faceNose = detections
