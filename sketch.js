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

      // ======== 為了更詳細的偵錯，取消註解以下內容 ========
      // if (hands.length > 0) {
      //   console.log("偵測到手部！數量:", hands.length);
      //   console.log("手勢判斷 - 握拳:", isFistClosed());
      //   console.log("手勢判斷 - 攤開:", isOpenHand());
      //   let landmarks = hands[0].landmarks;
      //   if(landmarks){
      //       console.log("食指尖 Y:", landmarks[8][1], "食指MCP Y:", landmarks[5][1]);
      //       console.log("中指尖 Y:", landmarks[12][1], "中指MCP Y:", landmarks[9][1]);
      //       console.log("拇指尖 Y:", landmarks[4][1], "拇指MCP Y:", landmarks[1][1]);
      //       console.log("食指X:", landmarks[8][0], "中指X:", landmarks[12][0], "無名指X:", landmarks[16][0], "小指X:", landmarks[20][0]);
      //   }
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

  // 偵測兩種手勢
  const hasFist = isFistClosed();
  const hasOpenHand = isOpenHand();

  // 如果同時偵測到兩種手勢，這可能是模糊情況，或兩者都不是明確的動作，可以考慮不做判斷或視為無效
  if (hasFist && hasOpenHand) {
      feedback = "手勢模糊，請明確動作！";
      // 這裡不給分也不扣分，等待更明確的動作
      return; 
  }

  if (isCurrentTeacher) {
    // 如果是教科老師，期望握拳
    if (hasFist) { // 正確動作：握拳
      actionMade = true;
      correctAction = true;
      score += (currentName === "陳慶帆" ? 2 : 1); // 陳慶帆老師答對加2分，其他老師加1分
      feedback = (currentName === "陳慶帆") ? "👊 陳慶帆老師來了！握拳加倍加分！" : "👊 老師來了！握拳加分！";
    } else if (hasOpenHand) { // 錯誤動作：攤開
      actionMade = true;
      correctAction = false;
      score -= (currentName === "陳慶帆" ? 3 : 1); // 陳慶帆老師答錯扣3分，其他老師扣1分
      feedback = (currentName === "陳慶帆") ? "😐 對陳慶帆老師要握拳才能加分喔！扣3分！" : "😐 對老師要握拳才能加分喔！扣1分！";
    }
  } else {
    // 如果不是教科老師，期望攤開手
    if (hasOpenHand) { // 正確動作：攤開
      actionMade = true;
      correctAction = true;
      feedback = "🖐️ 這不是老師，給他攤開手！加1分！";
      score += 1;
    } else if (hasFist) { // 錯誤動作：握拳
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
      // 檢查所有手指尖端是否都明顯低於其各自的掌指關節 (MCP) Y座標
      // 這個閾值可能需要微調，因為 Y 座標越「大」表示越下方
      const THRESHOLD_CURLED = 20; // 尖端 Y 座標比 MCP Y 座標大於此值，表示彎曲

      let indexCurled = landmarks[8][1] > landmarks[5][1] + THRESHOLD_CURLED;
      let middleCurled = landmarks[12][1] > landmarks[9][1] + THRESHOLD_CURLED;
      let ringCurled = landmarks[16][1] > landmarks[13][1] + THRESHOLD_CURLED;
      let pinkyCurled = landmarks[20][1] > landmarks[17][1] + THRESHOLD_CURLED;

      let allFingersCurled = indexCurled && middleCurled && ringCurled && pinkyCurled;

      // 檢查拇指是否收攏
      // 拇指尖 (4) 通常會靠近食指根部 (5) 或中指根部 (9)
      // 使用拇指尖到中指根部的距離，確保它不是伸直的
      let thumbToMiddleBaseDist = dist(landmarks[4][0], landmarks[4][1], landmarks[9][0], landmarks[9][1]);
      const THUMB_CLOSE_THRESHOLD = 80; // 拇指尖到中指根部距離小於此值，表示收攏

      return allFingersCurled && (thumbToMiddleBaseDist < THUMB_CLOSE_THRESHOLD);
    }
  }
  return false;
}


// 判斷是否為攤開手掌的動作 (原先的 isOneFingerUp 改為 isOpenHand)
function isOpenHand() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      // 檢查所有手指的尖端是否都明顯高於其各自的掌指關節 (MCP) Y座標
      // Y 座標越「小」表示越高
      const THRESHOLD_STRAIGHT = 30; // 尖端 Y 座標比 MCP Y 座標小於此值，表示伸直

      let indexStraight = landmarks[8][1] < landmarks[5][1] - THRESHOLD_STRAIGHT;
      let middleStraight = landmarks[12][1] < landmarks[9][1] - THRESHOLD_STRAIGHT;
      let ringStraight = landmarks[16][1] < landmarks[13][1] - THRESHOLD_STRAIGHT;
      let pinkyStraight = landmarks[20][1] < landmarks[17][1] - THRESHOLD_STRAIGHT;
      
      // 拇指判斷：拇指尖要比其第一關節高，且不應過於靠近其他手指
      let thumbStraight = landmarks[4][1] < landmarks[1][1] - THRESHOLD_STRAIGHT;


      // 檢查手指是否張開（X座標間距）
      // 判斷食指和中指、中指和無名指、無名指和小指之間是否有足夠的橫向距離
      // 確保各手指尖之間有一定距離，避免手掌側向面對時誤判
      const MIN_SPREAD_X = 25; // 相鄰手指尖 X 座標間距最小要求

      let fingersSpreadX = (abs(landmarks[8][0] - landmarks[12][0]) > MIN_SPREAD_X) &&
                           (abs(landmarks[12][0] - landmarks[16][0]) > MIN_SPREAD_X) &&
                           (abs(landmarks[16][0] - landmarks[20][0]) > MIN_SPREAD_X);
      
      // 綜合判斷：所有手指都伸直，且手指之間有一定間距
      return indexStraight && middleStraight && ringStraight && pinkyStraight && thumbStraight && fingersSpreadX;
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
