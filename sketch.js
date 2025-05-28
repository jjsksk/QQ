let video;
let hands = [];      // 儲存手部偵測結果

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

// 偵測頻率控制變數
let lastHandDetectTime = 0;
let handDetectInterval = 100; // 每 100 毫秒進行一次手勢偵測 (約 10 FPS)


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

  let startButton = select('#startButton');
  if (startButton) {
    startButton.style('display', 'block');
    startButton.html('開始遊戲');
    startButton.attribute('disabled', '');
  }

  if (gameModelsLoaded) {
    if (startButton) {
      startButton.html('模型載入完成，點擊開始');
      startButton.removeAttribute('disabled');
    }
  } else {
    if (startButton) {
      startButton.html('載入 AI 模型中...');
    }
  }
}

function videoReady() {
  console.log("攝影機成功啟動！");

  // 僅初始化 Handpose
  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
    checkModelsLoaded(); // 現在只依賴 Handpose 載入完成
  });
}

function checkModelsLoaded() {
  let handposeReady = handpose && handpose.ready;

  if (handposeReady) { // 只依賴 Handpose 載入完成
    gameModelsLoaded = true;
    showStartScreen();
  }
}

function startGame() {
  if (!gameModelsLoaded) {
    feedback = "請等待 AI 模型載入完成！";
    return;
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

  // 限制手勢偵測頻率
  if (handpose && gameModelsLoaded && (millis() - lastHandDetectTime > handDetectInterval)) {
    handpose.predict(video).then(results => {
      hands = results;
    });
    lastHandDetectTime = millis();
  }

  // 動作偵測和判斷
  if (!actionCheckedForCurrentName && hands.length > 0) { // 只在手部有數據且未檢查過才檢查動作
    checkAction();
  }

  drawHandLandmarks(); // 只繪製手部關節點

  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0);
      push();
      translate(correctionMarkPosition.x, correctionMarkPosition.y);
      noFill();
      strokeWeight(5);
      stroke(0, 0, 255, correctionMarkAlpha);

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
  hands = [];
  currentName = ""; // 清空顯示的人名

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

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  if (actionCheckedForCurrentName || hands.length === 0) return; // 如果已檢查過或沒有手部數據，則不檢查

  let actionDetected = false; // 用於判斷是否有偵測到「有效」的動作嘗試 (無論對錯)
  let correctAction = false;

  const isCurrentTeacher = teacherList.includes(currentName);

  if (isCurrentTeacher) {
    // 如果是教科老師，期望握拳
    if (isFistClosed()) {
      actionDetected = true;
      correctAction = true;
      score += (currentName === "陳慶帆" ? 2 : 1);
      feedback = (currentName === "陳慶帆") ? "👊 陳慶帆老師來了！握拳加倍加分！" : "👊 老師來了！握拳加分！";
    } else if (isOneFingerUp()) { // 錯誤動作也算作一次嘗試
      actionDetected = true;
      feedback = "😐 對老師要握拳才能加分喔！";
      correctAction = false;
      score -= (currentName === "陳慶帆" ? 3 : 1);
    } else {
      // 老師出現但沒有明確的握拳或一根手指動作，不加減分，但仍視為已嘗試
      actionDetected = true;
      feedback = "請握拳！";
      correctAction = false; // 動作不正確
    }
  } else {
    // 如果不是教科老師，期望比一根手指
    if (isOneFingerUp()) {
      actionDetected = true;
      feedback = "👆 這不是老師，給他一根手指！";
      correctAction = true;
      score += 1;
    } else if (isFistClosed()) { // 錯誤動作也算作一次嘗試
      actionDetected = true;
      feedback = "🖐️ 這時候要比一根手指啦～";
      correctAction = false;
      score -= 1;
    } else {
      // 非老師出現但沒有明確的握拳或一根手指動作，不加減分，但仍視為已嘗試
      actionDetected = true;
      feedback = "請比一根手指！";
      correctAction = false; // 動作不正確
    }
  }

  // 顯示打勾或打叉的視覺回饋
  if (actionDetected) { // 只要有偵測到任一有效動作（握拳或一根手指），就顯示回饋
    actionCheckedForCurrentName = true; // 標記為已檢查，防止重複加減分
    let wrist = hands[0].landmarks[0];  // 使用手腕作為回饋位置參考
    correctionMarkPosition = createVector(wrist[0], wrist[1] - 50);
    correctionMarkType = correctAction ? 'check' : 'cross';
    showCorrectionMark = true;
    correctionMarkStartTime = millis();
  }
}

// 判斷是否為握拳動作
function isFistClosed() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      // 檢查所有手指尖端是否都靠近手掌中心或其根部關節
      let thumbTip = landmarks[4];
      let indexTip = landmarks[8];
      let middleTip = landmarks[12];
      let ringTip = landmarks[16];
      let pinkyTip = landmarks[20];

      let thumbClose = dist(thumbTip[0], thumbTip[1], landmarks[5][0], landmarks[5][1]) < 40; // 拇指尖靠近食指根部
      let indexClose = indexTip[1] > landmarks[5][1] + 20; // 食指尖在根部下方
      let middleClose = middleTip[1] > landmarks[9][1] + 20; // 中指尖在根部下方
      let ringClose = ringTip[1] > landmarks[13][1] + 20;    // 無名指尖在根部下方
      let pinkyClose = pinkyTip[1] > landmarks[17][1] + 20; // 小指尖在根部下方

      // 檢查手指尖端與手掌中心的距離，確保他們是彎曲的
      let palmBase = landmarks[0]; // 腕部作為手掌中心參考

      let allFingersCurled = indexClose && middleClose && ringClose && pinkyClose;

      // 此外，拇指尖通常會碰到或接近中指的第一個關節 (landmarks[10])
      let thumbToMiddleProximity = dist(thumbTip[0], thumbTip[1], landmarks[10][0], landmarks[10][1]) < 40;

      return allFingersCurled && thumbClose && thumbToMiddleProximity;
    }
  }
  return false;
}


// 判斷是否為比一根手指的動作 (食指朝上)
function isOneFingerUp() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      let indexTip = landmarks[8];     // 食指尖
      let indexPIP = landmarks[6];     // 食指中間關節
      let indexMCP = landmarks[5];     // 食指根部關節

      let thumbTip = landmarks[4];     // 拇指尖
      let middleTip = landmarks[12];   // 中指尖
      let ringTip = landmarks[16];     // 無名指尖
      let pinkyTip = landmarks[20];    // 小指尖
      let wrist = landmarks[0];        // 腕部

      // 1. 食指是直的且朝上 (相對腕部)
      // 檢查食指各關節點的 Y 座標是否遞減 (由下而上)
      let indexIsUpAndStraight = (indexTip[1] < indexPIP[1]) &&
                                 (indexPIP[1] < indexMCP[1]) &&
                                 (indexMCP[1] < wrist[1]);
      
      // 確保食指的尖端離腕部有足夠的距離，且食指X座標在一定範圍內，避免手部傾斜誤判
      let indexVerticalDist = dist(indexTip[0], indexTip[1], wrist[0], wrist[1]);
      const MIN_INDEX_VERTICAL_DIST = 50; // 食指和腕部最小垂直距離
      
      // 2. 其他手指都彎曲 (尖端低於各自的MCP關節 + 一些裕度)
      let thumbCurled = thumbTip[1] > landmarks[3][1] + 15; // 拇指尖低於拇指倒數第二個關節
      let middleCurled = middleTip[1] > landmarks[9][1] + 15;
      let ringCurled = ringTip[1] > landmarks[13][1] + 15;    
      let pinkyCurled = pinkyTip[1] > landmarks[17][1] + 15; 

      // 檢查其他手指的X座標是否靠近手掌中心，表示彎曲
      let middleXCheck = Math.abs(middleTip[0] - landmarks[9][0]) < 20;
      let ringXCheck = Math.abs(ringTip[0] - landmarks[13][0]) < 20;
      let pinkyXCheck = Math.abs(pinkyTip[0] - landmarks[17][0]) < 20;
      
      return indexIsUpAndStraight &&
             indexVerticalDist > MIN_INDEX_VERTICAL_DIST &&
             thumbCurled && middleCurled && ringCurled && pinkyCurled &&
             middleXCheck && ringXCheck && pinkyXCheck; // 增加X座標檢查
    }
  }
  return false;
}

// 繪製手部關節點和連線 (淺綠色)
function drawHandLandmarks() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.landmarks.length; j++) {
      let landmark = hand.landmarks[j];
      fill(100, 255, 100); // 淺綠色
      noStroke();
      ellipse(landmark[0], landmark[1], 8, 8);
    }
    stroke(100, 255, 100); // 淺綠色
    strokeWeight(2);

    // 連接手部骨架 (Handpose 的 landmark 索引有特定規則)
    // 拇指 (0-4)
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[1][0], hand.landmarks[1][1]);
    line(hand.landmarks[1][0], hand.landmarks[1][1], hand.landmarks[2][0], hand.landmarks[2][1]);
    line(hand.landmarks[2][0], hand.landmarks[2][1], hand.landmarks[3][0], hand.landmarks[3][1]);
    line(hand.landmarks[3][0], hand.landmarks[3][1], hand.landmarks[4][0], hand.landmarks[4][1]);
    // 食指 (5-8)
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[5][0], hand.landmarks[5][1]); // 腕部到食指根部
    line(hand.landmarks[5][0], hand.landmarks[5][1], hand.landmarks[6][0], hand.landmarks[6][1]);
    line(hand.landmarks[6][0], hand.landmarks[6][1], hand.landmarks[7][0], hand.landmarks[7][1]);
    line(hand.landmarks[7][0], hand.landmarks[7][1], hand.landmarks[8][0], hand.landmarks[8][1]);
    // 中指 (9-12)
    line(hand.landmarks[9][0], hand.landmarks[9][1], hand.landmarks[10][0], hand.landmarks[10][1]);
    line(hand.landmarks[10][0], hand.landmarks[10][1], hand.landmarks[11][0], hand.landmarks[11][1]);
    line(hand.landmarks[11][0], hand.landmarks[11][1], hand.landmarks[12][0], hand.landmarks[12][1]);
    // 無名指 (13-16)
    line(hand.landmarks[13][0], hand.landmarks[13][1], hand.landmarks[14][0], hand.landmarks[14][1]);
    line(hand.landmarks[14][0], hand.landmarks[14][1], hand.landmarks[15][0], hand.landmarks[15][1]);
    line(hand.landmarks[15][0], hand.landmarks[15][1], hand.landmarks[16][0], hand.landmarks[16][1]);
    // 小指 (17-20)
    line(hand.landmarks[17][0], hand.landmarks[17][1], hand.landmarks[18][0], hand.landmarks[18][1]);
    line(hand.landmarks[18][0], hand.landmarks[18][1], hand.landmarks[19][0], hand.landmarks[19][1]);
    line(hand.landmarks[19][0], hand.landmarks[19][1], hand.landmarks[20][0], hand.landmarks[20][1]);
    // 手掌連接 (基於腕部和指根的連接)
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[5][0], hand.landmarks[5][1]);
    line(hand.landmarks[5][0], hand.landmarks[5][1], hand.landmarks[9][0], hand.landmarks[9][1]);
    line(hand.landmarks[9][0], hand.landmarks[9][1], hand.landmarks[13][0], hand.landmarks[13][1]);
    line(hand.landmarks[13][0], hand.landmarks[13][1], hand.landmarks[17][0], hand.landmarks[17][1]);
    line(hand.landmarks[17][0], hand.landmarks[17][1], hand.landmarks[0][0], hand.landmarks[0][1]);
  }
}
