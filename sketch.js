let video;
let hands = []; // 儲存手部偵測結果

// 遊戲狀態變數
let gameStarted = false; // 遊戲是否開始
let gameModelsLoaded = false; // 所有 AI 模型是否載入完成
let startTime; // 遊戲開始時間
let timeLeft = 60; // 剩餘時間 (秒)
let gameInterval; // 倒數計時器的 interval ID

let nameList = [
  "顧大維",
  "何俐安",
  "黃琪芳",
  "林逸農",
  "徐唯芝",
  "陳慶帆",
  "賴婷鈴", // 老師們
  "馬嘉祺",
  "丁程鑫",
  "宋亞軒",
  "劉耀文",
  "張真源",
  "嚴浩翔",
  "賀峻霖", // 非老師們
];
// 淡江教科的老師們
let teacherList = [
  "顧大維",
  "何俐安",
  "黃琪芳",
  "林逸農",
  "徐唯芝",
  "陳慶帆",
  "賴婷鈴",
];
let currentName = ""; // 目前顯示的人名
let lastSwitchTime = 0; // 上次切換人名的時間 (millis())
let switchInterval = 5000; // 每 5 秒切換一次人名 (5000 毫秒)
let feedback = ""; // 顯示給玩家的回饋訊息
let score = 0; // 遊戲分數

let boxSize = 250; // 加大方塊尺寸以容納更清晰的字體
let boxPulse = 0; // 人名方塊的脈動效果

// 動作判斷狀態變數 (防止重複加減分)
let actionCheckedForCurrentName = false; // 當前人名是否已檢查過動作並給分/扣分
let actionWindowActive = false; // 是否處於等待玩家動作的窗口期

// 視覺回饋相關變數
let showCorrectionMark = false; // 是否顯示打勾或打叉
let correctionMarkType = ""; // 'check' 或 'cross'
let correctionMarkPosition; // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255; // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime; // 打勾或打叉開始顯示的時間

// 偵測頻率控制變數 (現在由 ml5 handpose.on 事件處理，這裡保留作為參考)
let lastHandDetectTime = 0;
let handDetectInterval = 100;

// 白線框的變數
let detectionBoxX;
let detectionBoxY;
let detectionBoxWidth = 450; // 偵測框寬度進一步增加
let detectionBoxHeight = 450; // 偵測框高度進一步增加

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, videoReady);
  video.size(width, height);
  video.hide();

  textAlign(CENTER, CENTER);
  // 調整字體大小，讓人名更清晰
  textSize(40);

  // 設定偵測框的中心位置
  detectionBoxX = width / 2;
  detectionBoxY = height / 2;

  showStartScreen();

  let startButton = select("#startButton");
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

  let startButton = select("#startButton");
  if (startButton) {
    startButton.style("display", "block");
    startButton.html("開始遊戲");
    startButton.attribute("disabled", "");
  }

  if (gameModelsLoaded) {
    if (startButton) {
      startButton.html("模型載入完成，點擊開始");
      startButton.removeAttribute("disabled");
    }
  } else {
    if (startButton) {
      startButton.html("載入 AI 模型中...");
    }
  }
}

function videoReady() {
  console.log("攝影機成功啟動！");

  // 初始化 handpose 模型
  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
    checkModelsLoaded();
  });

  // 設定模型載入成功後，開始持續偵測手部
  // 這是持續更新 `hands` 陣列的關鍵，避免手部沒偵測到
  handpose.on("hand", (results) => {
    hands = results;
  });
}

function checkModelsLoaded() {
  if (handpose && handpose.ready) {
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
  score = 0; // 遊戲開始時分數歸零
  timeLeft = 60; // 遊戲開始時時間重置
  pickNewName(); // 第一次選取名字並啟動動作偵測窗口

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      endGame();
    }
  }, 1000);

  let startButton = select("#startButton");
  if (startButton) {
    startButton.style("display", "none");
  }
}

function draw() {
  background(250);
  // 顯示攝影機畫面，並左右翻轉
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (!gameStarted) {
    showStartScreen();
    return;
  }

  // 繪製白色偵測線框
  noFill();
  stroke(255); // 白色
  strokeWeight(5); // 增加線條粗細
  drawingContext.setLineDash([10, 10]); // 設置虛線
  rectMode(CENTER);
  rect(detectionBoxX, detectionBoxY, detectionBoxWidth, detectionBoxHeight);
  drawingContext.setLineDash([]); // 重置為實線

  // 檢查手是否在框內
  let handInBox = false;
  if (hands.length > 0) {
    let wrist = hands[0].landmarks[0]; // 手腕關鍵點
    if (
      wrist[0] > detectionBoxX - detectionBoxWidth / 2 &&
      wrist[0] < detectionBoxX + detectionBoxWidth / 2 &&
      wrist[1] > detectionBoxY - detectionBoxHeight / 2 &&
      wrist[1] < detectionBoxY + detectionBoxHeight / 2
    ) {
      handInBox = true;
    }
  }

  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  let boxY = height * 0.8;
  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, boxY, currentBoxSize, currentBoxSize / 2);

  fill(0);
  // 使用先前設定的textSize(40)
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

  // 優化偵測提示邏輯
  if (gameStarted && hands.length === 0) {
    feedback = "🔍 請將手心完整地放入攝影機畫面中央！";
  } else if (gameStarted && hands.length > 0 && !handInBox) {
    feedback = "⚠️ 請將手移入白色框內！";
  } else if (gameStarted && hands.length > 0 && handInBox) {
    // 只有當手在框內且偵測到手時，才檢查動作
    if (actionWindowActive && !actionCheckedForCurrentName) {
      checkAction();
    }
    // 如果之前有提示，現在手已偵測到且在框內，就清除提示
    if (feedback.includes("請將手")) {
      feedback = "";
    }
  }

  text(feedback, width / 2, height - 10);

  drawHandLandmarks(); // 繪製手部關節點和連線

  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0);
      push();
      // 因為顯示畫面左右翻轉，所以這裡也需要翻轉
      translate(width - correctionMarkPosition.x, correctionMarkPosition.y);
      noFill();
      strokeWeight(5);
      stroke(0, 0, 255, correctionMarkAlpha);

      if (correctionMarkType === "check") {
        line(-20, 0, 0, 20);
        line(0, 20, 40, -20);
      } else if (correctionMarkType === "cross") {
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

  // 重置遊戲相關變數以便重新開始
  score = 0;
  timeLeft = 60;
  feedback = "";
  hands = [];
  currentName = ""; // 清空顯示的人名
  actionWindowActive = false; // 遊戲結束時重置
  actionCheckedForCurrentName = false; // 遊戲結束時重置

  let startButton = select("#startButton");
  if (startButton) {
    startButton.style("display", "block");
    startButton.html('重新開始遊戲');
    startButton.removeAttribute("disabled");
  }
}

function pickNewName() {
  currentName = random(nameList);
  lastSwitchTime = millis();
  feedback = ""; // 清空上次的回饋
  actionCheckedForCurrentName = false;
  actionWindowActive = true; // 新名字出現，動作窗口開啟
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  if (!actionWindowActive || actionCheckedForCurrentName || hands.length === 0)
    return false;

  let handInBox = false;
  if (hands.length > 0) {
    let wrist = hands[0].landmarks[0];
    if (
      wrist[0] > detectionBoxX - detectionBoxWidth / 2 &&
      wrist[0] < detectionBoxX + detectionBoxWidth / 2 &&
      wrist[1] > detectionBoxY - detectionBoxHeight / 2 &&
      wrist[1] < detectionBoxY + detectionBoxHeight / 2
    ) {
      handInBox = true;
    }
  }

  if (!handInBox) {
    feedback = "⚠️ 請將手移入白色框內！";
    return false;
  }

  let actionMade = false;
  let correctAction = false;

  const isCurrentTeacher = teacherList.includes(currentName);

  const hasFist = isFistClosed();
  const hasOpenHand = isOpenHand();

  // 如果兩種手勢同時被偵測到 (這不太可能在真實情況下發生，除非閾值非常寬鬆)，則認為不明確
  if (hasFist && hasOpenHand) {
    feedback = "手勢模糊，請明確動作！";
    return false;
  }

  if (isCurrentTeacher) {
    // 如果是教科老師，期望握拳
    if (hasFist) {
      actionMade = true;
      correctAction = true;
      score += currentName === "陳慶帆" ? 2 : 1;
      feedback =
        currentName === "陳慶帆"
          ? "👊 陳慶帆老師來了！握拳加倍加分！"
          : "👊 老師來了！握拳加分！";
    } else if (hasOpenHand) {
      actionMade = true;
      correctAction = false;
      score -= currentName === "陳慶帆" ? 3 : 1;
      feedback =
        currentName === "陳慶帆"
          ? "😐 對陳慶帆老師要握拳才能加分喔！扣3分！"
          : "😐 對老師要握拳才能加分喔！扣1分！";
    }
  } else {
    // 如果不是教科老師，期望攤開手
    if (hasOpenHand) {
      actionMade = true;
      correctAction = true;
      feedback = "🖐️ 這不是老師，給他攤開手！加1分！";
      score += 1;
    } else if (hasFist) {
      actionMade = true;
      correctAction = false;
      feedback = "👊 這時候要攤開手啦～扣1分！";
      score -= 1;
    }
  }

  if (actionMade) {
    actionCheckedForCurrentName = true;
    let wrist = hands[0].landmarks[0];
    correctionMarkPosition = createVector(wrist[0], wrist[1] - 50);
    correctionMarkType = correctAction ? "check" : "cross";
    showCorrectionMark = true;
    correctionMarkStartTime = millis();
  }
  return actionMade;
}

// 判斷是否為握拳動作 (手心朝攝影機)
function isFistClosed() {
  if (hands.length === 0 || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;

  // 手心朝攝影機時，握拳會讓指尖的 Y 座標相對**上升** (因為 Y 軸向下遞增)
  // 且指尖會**靠近**掌心 (即手腕)
  // 拇指會**靠近**食指或掌心

  // 設定非常寬鬆的閾值，以提高偵測率
  const FINGER_CURLED_Y_THRESHOLD = 20; // 指尖 Y 座標比其關節 Y 座標**小於**此值 (向上捲曲)
  const FINGER_CURLED_X_THRESHOLD = 20; // 指尖 X 座標與其關節 X 座標的絕對差值 (向內收縮)
  const THUMB_CLOSE_DISTANCE = 40; // 拇指尖到食指根部或掌心的距離

  let allFingersCurled = true;

  // 檢查食指、中指、無名指、小指是否彎曲且向內收縮
  // 食指 (8) 相對食指根部 (5)
  if (!(landmarks[8][1] > landmarks[5][1] - FINGER_CURLED_Y_THRESHOLD &&
        abs(landmarks[8][0] - landmarks[5][0]) < FINGER_CURLED_X_THRESHOLD)) {
    allFingersCurled = false;
  }
  // 中指 (12) 相對中指根部 (9)
  if (!(landmarks[12][1] > landmarks[9][1] - FINGER_CURLED_Y_THRESHOLD &&
        abs(landmarks[12][0] - landmarks[9][0]) < FINGER_CURLED_X_THRESHOLD)) {
    allFingersCurled = false;
  }
  // 無名指 (16) 相對無名指根部 (13)
  if (!(landmarks[16][1] > landmarks[13][1] - FINGER_CURLED_Y_THRESHOLD &&
        abs(landmarks[16][0] - landmarks[13][0]) < FINGER_CURLED_X_THRESHOLD)) {
    allFingersCurled = false;
  }
  // 小指 (20) 相對小指根部 (17)
  if (!(landmarks[20][1] > landmarks[17][1] - FINGER_CURLED_Y_THRESHOLD &&
        abs(landmarks[20][0] - landmarks[17][0]) < FINGER_CURLED_X_THRESHOLD)) {
    allFingersCurled = false;
  }

  // 檢查拇指是否收攏
  // 拇指尖 (4) 靠近食指根部 (5) 或掌心 (0)
  let thumbClose = dist(landmarks[4][0], landmarks[4][1], landmarks[5][0], landmarks[5][1]) < THUMB_CLOSE_DISTANCE ||
                   dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]) < THUMB_CLOSE_DISTANCE;

  return allFingersCurled && thumbClose;
}


// 判斷是否為攤開手掌的動作 (手心朝攝影機)
function isOpenHand() {
  if (hands.length === 0 || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;

  // 手心朝攝影機時，攤開手掌會讓指尖的 Y 座標相對**下降** (Y 軸向下遞增)
  // 且手指之間會**遠離**，X 座標會有明顯差異
  // 拇指會**遠離**掌心

  // 設定非常寬鬆的閾值，以提高偵測率
  const FINGER_STRAIGHT_Y_OFFSET = 30; // 指尖 Y 座標比其關節 Y 座標**大於**此值 (向下伸直)
  const FINGER_SPREAD_X_DISTANCE = 30; // 相鄰手指尖 X 座標間距
  const THUMB_AWAY_DISTANCE = 70; // 拇指尖到掌根的距離

  let allFingersStraight = true;

  // 檢查食指、中指、無名指、小指是否伸直
  // 食指 (8) 相對食指根部 (5)
  if (!(landmarks[8][1] > landmarks[5][1] + FINGER_STRAIGHT_Y_OFFSET)) {
    allFingersStraight = false;
  }
  // 中指 (12) 相對中指根部 (9)
  if (!(landmarks[12][1] > landmarks[9][1] + FINGER_STRAIGHT_Y_OFFSET)) {
    allFingersStraight = false;
  }
  // 無名指 (16) 相對無名指根部 (13)
  if (!(landmarks[16][1] > landmarks[13][1] + FINGER_STRAIGHT_Y_OFFSET)) {
    allFingersStraight = false;
  }
  // 小指 (20) 相對小指根部 (17)
  if (!(landmarks[20][1] > landmarks[17][1] + FINGER_STRAIGHT_Y_OFFSET)) {
    allFingersStraight = false;
  }

  // 檢查手指是否張開（橫向距離）
  let fingersSpread =
    abs(landmarks[8][0] - landmarks[12][0]) > FINGER_SPREAD_X_DISTANCE && // 食指 vs 中指
    abs(landmarks[12][0] - landmarks[16][0]) > FINGER_SPREAD_X_DISTANCE && // 中指 vs 無名指
    abs(landmarks[16][0] - landmarks[20][0]) > FINGER_SPREAD_X_DISTANCE; // 無名指 vs 小指

  // 檢查拇指是否張開並遠離掌心
  let thumbAway = dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]) > THUMB_AWAY_DISTANCE;

  // 綜合判斷
  return allFingersStraight && fingersSpread && thumbAway;
}


// 繪製手部關節點和連線 (淺綠色)
function drawHandLandmarks() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.landmarks.length; j++) {
      let landmark = hand.landmarks[j];
      fill(100, 255, 100); // 淺綠色
      noStroke();
      // 因為攝影機畫面左右翻轉，所以繪製手部關鍵點時也需要翻轉 X 座標
      ellipse(width - landmark[0], landmark[1], 8, 8);
    }
    stroke(100, 255, 100); // 淺綠色
    strokeWeight(2);

    // 連接手部骨架 (Handpose 的 landmark 索引有特定規則)
    // 由於畫面左右翻轉，繪製線條時也需要對 X 座標進行翻轉
    // 拇指 (0-4)
    line(
      width - hand.landmarks[0][0],
      hand.landmarks[0][1],
      width - hand.landmarks[1][0],
      hand.landmarks[1][1]
    );
    line(
      width - hand.landmarks[1][0],
      hand.landmarks[1][1],
      width - hand.landmarks[2][0],
      hand.landmarks[2][1]
    );
    line(
      width - hand.landmarks[2][0],
      hand.landmarks[2][1],
      width - hand.landmarks[3][0],
      hand.landmarks[3][1]
    );
    line(
      width - hand.landmarks[3][0],
      hand.landmarks[3][1],
      width - hand.landmarks[4][0],
      hand.landmarks[4][1]
    );
    // 食指 (5-8)
    line(
      width - hand.landmarks[0][0],
      hand.landmarks[0][1],
      width - hand.landmarks[5][0],
      hand.landmarks[5][1]
    ); // 腕部到食指根部
    line(
      width - hand.landmarks[5][0],
      hand.landmarks[5][1],
      width - hand.landmarks[6][0],
      hand.landmarks[6][1]
    );
    line(
      width - hand.landmarks[6][0],
      hand.landmarks[6][1],
      width - hand.landmarks[7][0],
      hand.landmarks[7][1]
    );
    line(
      width - hand.landmarks[7][0],
      hand.landmarks[7][1],
      width - hand.landmarks[8][0],
      hand.landmarks[8][1]
    );
    // 中指 (9-12)
    line(
      width - hand.landmarks[9][0],
      hand.landmarks[9][1],
      width - hand.landmarks[10][0],
      hand.landmarks[10][1]
    );
    line(
      width - hand.landmarks[10][0],
      hand.landmarks[10][1],
      width - hand.landmarks[11][0],
      hand.landmarks[11][1]
    );
    line(
      width - hand.landmarks[11][0],
      hand.landmarks[11][1],
      width - hand.landmarks[12][0],
      hand.landmarks[12][1]
    );
    // 無名指 (13-16)
    line(
      width - hand.landmarks[13][0],
      hand.landmarks[13][1],
      width - hand.landmarks[14][0],
      hand.landmarks[14][1]
    );
    line(
      width - hand.landmarks[14][0],
      hand.landmarks[14][1],
      width - hand.landmarks[15][0],
      hand.landmarks[15][1]
    );
    line(
      width - hand.landmarks[15][0],
      hand.landmarks[15][1],
      width - hand.landmarks[16][0],
      hand.landmarks[16][1]
    );
    // 小指 (17-20)
    line(
      width - hand.landmarks[17][0],
      hand.landmarks[17][1],
      width - hand.landmarks[18][0],
      hand.landmarks[18][1]
    );
    line(
      width - hand.landmarks[18][0],
      hand.landmarks[18][1],
      width - hand.landmarks[19][0],
      hand.landmarks[19][1]
    );
    line(
      width - hand.landmarks[19][0],
      hand.landmarks[19][1],
      width - hand.landmarks[20][0],
      hand.landmarks[20][1]
    );
    // 手掌連接 (基於腕部和指根的連接)
    line(
      width - hand.landmarks[0][0],
      hand.landmarks[0][1],
      width - hand.landmarks[5][0],
      hand.landmarks[5][1]
    );
    line(
      width - hand.landmarks[5][0],
      hand.landmarks[5][1],
      width - hand.landmarks[9][0],
      hand.landmarks[9][1]
    );
    line(
      width - hand.landmarks[9][0],
      hand.landmarks[9][1],
      width - hand.landmarks[13][0],
      hand.landmarks[13][1]
    );
    line(
      width - hand.landmarks[13][0],
      hand.landmarks[13][1],
      width - hand.landmarks[17][0],
      hand.landmarks[17][1]
    );
    line(
      width - hand.landmarks[17][0],
      hand.landmarks[17][1],
      width - hand.landmarks[0][0],
      hand.landmarks[0][1]
    );
  }
}
