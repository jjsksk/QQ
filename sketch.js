let video;
let hands = [];      // 儲存手部偵測結果

// 遊戲狀態變數
let gameStarted = false; // 遊戲是否開始
let gameModelsLoaded = false; // 所有 AI 模型是否載入完成
let startTime;           // 遊戲開始時間
let timeLeft = 60;       // 剩餘時間 (秒)
let gameInterval;        // 倒數計時器的 interval ID

let nameList = [
  "顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴", // 老師們
  "馬嘉祺", "丁程鑫", "宋亞軒", "劉耀文", "張真源", "嚴浩翔", "賀峻霖"  // 非老師們
];
// 淡江教科的老師們 (請確認此列表包含所有老師的名字)
let teacherList = ["顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴"];
let currentName = "";      // 目前顯示的人名
let lastSwitchTime = 0;    // 上次切換人名的時間 (millis())
let switchInterval = 5000; // 每 5 秒切換一次人名 (5000 毫秒)
let feedback = "";         // 顯示給玩家的回饋訊息
let score = 0;             // 遊戲分數

let boxSize = 200;
let boxPulse = 0;          // 人名方塊的脈動效果

// 動作判斷狀態變數 (防止重複加減分)
let actionCheckedForCurrentName = false; // 當前人名是否已檢查過動作並給分/扣分
let actionWindowActive = false; // 是否處於等待玩家動作的窗口期

// 視覺回饋相關變數
let showCorrectionMark = false; // 是否顯示打勾或打叉
let correctionMarkType = '';    // 'check' 或 'cross'
let correctionMarkPosition;     // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255;  // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime;    // 打勾或打叉開始顯示的時間

// 偵測頻率控制變數
let lastHandDetectTime = 0;
let handDetectInterval = 50; // 更頻繁地偵測手勢 (約 20 FPS)


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

  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
    checkModelsLoaded();
  });
}

function checkModelsLoaded() {
  let handposeReady = handpose && handpose.ready;

  if (handposeReady) {
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
  pickNewName(); // 第一次選取名字並啟動動作偵測窗口
  
  // 遊戲進行 60 秒
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

      // ======== 為了更詳細的偵錯，可以在這裡添加以下內容 ========
      // if (hands.length > 0) {
      //   console.log("偵測到手部！數量:", hands.length);
      //   console.log("手勢判斷 - 握拳:", isFistClosed());
      //   console.log("手勢判斷 - 攤開:", isOpenHand());
      //   // 如果需要更詳細的關節點數據來調試，可以打開這行
      //   // console.log("手部關節點:", hands[0].landmarks);
      // } else {
      //   console.log("未偵測到手部。");
      // }
      // =======================================================


      // 在手部數據更新後立即嘗試檢查動作
      if (actionWindowActive && !actionCheckedForCurrentName && hands.length > 0) {
        checkAction();
      }
    });
    lastHandDetectTime = millis();
  } else if (hands.length === 0) {
    // 如果沒有偵測到手，提示用戶對準攝影機
    feedback = "偵測中...請對準攝影機！";
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

  // 時間到自動換名字，不再因為未回應而扣分
  if (millis() - lastSwitchTime > switchInterval) {
    // 這裡不進行未回應的扣分
    pickNewName();
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
  actionWindowActive = false; // 遊戲結束時重置

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
  actionWindowActive = true; // 新名字出現，動作窗口開啟
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  // 只有在動作窗口開啟且該名字的動作尚未被檢查過時才執行
  if (!actionWindowActive || actionCheckedForCurrentName || hands.length === 0) return;

  let actionMade = false; // 判斷是否做了"任何"有效手勢 (握拳或攤開)
  let correctAction = false;

  const isCurrentTeacher = teacherList.includes(currentName);

  if (isCurrentTeacher) {
    // 如果是教科老師，期望握拳
    if (isFistClosed()) {
      actionMade = true;
      correctAction = true;
      score += (currentName === "陳慶帆" ? 2 : 1); // 陳慶帆老師答對加2分，其他老師加1分
      feedback = (currentName === "陳慶帆") ? "👊 陳慶帆老師來了！握拳加倍加分！" : "👊 老師來了！握拳加分！";
    } else if (isOpenHand()) { // 錯誤動作（攤開）也算作一次嘗試
      actionMade = true;
      correctAction = false;
      score -= (currentName === "陳慶帆" ? 3 : 1); // 陳慶帆老師答錯扣3分，其他老師扣1分
      feedback = (currentName === "陳慶帆") ? "😐 對陳慶帆老師要握拳才能加分喔！扣3分！" : "😐 對老師要握拳才能加分喔！扣1分！";
    }
  } else {
    // 如果不是教科老師，期望攤開手
    if (isOpenHand()) {
      actionMade = true;
      correctAction = true;
      feedback = "🖐️ 這不是老師，給他攤開手！加1分！";
      score += 1;
    } else if (isFistClosed()) { // 錯誤動作（握拳）也算作一次嘗試
      actionMade = true;
      correctAction = false;
      feedback = "👊 這時候要攤開手啦～扣1分！";
      score -= 1;
    }
  }

  // 如果成功偵測到任何有效動作，就給予回饋並標記已檢查
  if (actionMade) {
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

      // 檢查食指、中指、無名指、小指尖是否低於各自的掌指關節 (MCP)
      // 增加一點裕度，讓判斷更寬鬆
      let indexCurled = indexTip[1] > landmarks[5][1] + 10;
      let middleCurled = middleTip[1] > landmarks[9][1] + 10;
      let ringCurled = ringTip[1] > landmarks[13][1] + 10;
      let pinkyCurled = pinkyTip[1] > landmarks[17][1] + 10;

      let allFingersCurled = indexCurled && middleCurled && ringCurled && pinkyCurled;

      // 檢查拇指尖是否靠近手掌或其他手指
      // 拇指尖 (4) 和手掌中心區域 (例如中指第二關節 9) 的距離
      let thumbCloseToPalm = dist(thumbTip[0], thumbTip[1], landmarks[9][0], landmarks[9][1]) < 80; // 稍微調整閾值

      return allFingersCurled && thumbCloseToPalm;
    }
  }
  return false;
}


// 判斷是否為攤開手掌的動作 (原先的 isOneFingerUp 改為 isOpenHand)
function isOpenHand() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      // 檢查所有手指的尖端是否都明顯高於其根部關節 (即手指伸直)
      // 使用 wrist (0) 或掌指關節 (5, 9, 13, 17) 作為參考
      let wrist = landmarks[0];
      let indexTip = landmarks[8];
      let middleTip = landmarks[12];
      let ringTip = landmarks[16];
      let pinkyTip = landmarks[20];
      let thumbTip = landmarks[4];

      // 判斷手指是否向上伸直（Y座標更小）
      let indexStraight = indexTip[1] < landmarks[5][1] - 30; // 食指尖明顯高於根部
      let middleStraight = middleTip[1] < landmarks[9][1] - 30;
      let ringStraight = ringTip[1] < landmarks[13][1] - 30;
      let pinkyStraight = pinkyTip[1] < landmarks[17][1] - 30;
      let thumbStraight = thumbTip[1] < landmarks[1][1] - 30; // 拇指尖高於第一個關節

      // 檢查手指是否張開（X座標間距）
      // 判斷食指和中指、中指和無名指、無名指和小指之間是否有足夠的橫向距離
      let fingersSpread = dist(indexTip[0], indexTip[0], middleTip[0], middleTip[1]) > 50 && // 確保不是比讚
                          dist(landmarks[8][0], landmarks[8][1], landmarks[12][0], landmarks[12][1]) > 30 &&
                          dist(landmarks[12][0], landmarks[12][1], landmarks[16][0], landmarks[16][1]) > 30 &&
                          dist(landmarks[16][0], landmarks[16][1], landmarks[20][0], landmarks[20][1]) > 30;


      // 綜合判斷：所有手指都伸直，且手指之間有一定間距
      return indexStraight && middleStraight && ringStraight && pinkyStraight && thumbStraight && fingersSpread;
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
