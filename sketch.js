let video;
let hands = [];      // 儲存手部偵測結果

// 遊戲狀態變數
let gameStarted = false; // 遊戲是否開始
let gameModelsLoaded = false; // 所有 AI 模型是否載入完成
let startTime;               // 遊戲開始時間
let timeLeft = 60;         // 剩餘時間 (秒)
let gameInterval;          // 倒數計時器的 interval ID

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
let correctionMarkPosition;      // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255;  // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime;       // 打勾或打叉開始顯示的時間

// 偵測頻率控制變數
let lastHandDetectTime = 0;
let handDetectInterval = 50; // 更頻繁地偵測手勢 (約 20 FPS)

// 新增：白線框的變數
let detectionBoxX;
let detectionBoxY;
let detectionBoxWidth = 350; // 偵測框的寬度稍微增加
let detectionBoxHeight = 350; // 偵測框的高度稍微增加

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, videoReady);
  video.size(width, height);
  video.hide();

  textAlign(CENTER, CENTER);
  textSize(28);

  // 設定偵測框的中心位置
  detectionBoxX = width / 2;
  detectionBoxY = height / 2;

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
  score = 0; // 遊戲開始時分數歸零
  timeLeft = 60; // 遊戲開始時時間重置
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

  // 繪製白色偵測線框 - 讓它更明顯
  noFill();
  stroke(255); // 白色
  strokeWeight(5); // 增加線條粗細
  drawingContext.setLineDash([10, 10]); // 設置虛線，讓邊框更突出
  rectMode(CENTER);
  rect(detectionBoxX, detectionBoxY, detectionBoxWidth, detectionBoxHeight);
  drawingContext.setLineDash([]); // 重置為實線，避免影響其他繪圖

  // 檢查手是否在框內
  let handInBox = false;
  if (hands.length > 0) {
    let wrist = hands[0].landmarks[0]; // 手腕關鍵點
    // 由於攝影機畫面左右翻轉，手的座標也需要相對調整
    // 然而，handpose偵測到的landmarks座標是基於翻轉後的畫面的，所以直接使用即可
    if (wrist[0] > (detectionBoxX - detectionBoxWidth / 2) &&
        wrist[0] < (detectionBoxX + detectionBoxWidth / 2) &&
        wrist[1] > (detectionBoxY - detectionBoxHeight / 2) &&
        wrist[1] < (detectionBoxY + detectionBoxHeight / 2)) {
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

  // 優化偵測提示邏輯
  if (gameStarted && hands.length === 0) {
      feedback = "🔍 請將手背完整地放入攝影機畫面中央！";
  } else if (gameStarted && hands.length > 0 && !handInBox) {
      feedback = "⚠️ 請將手移入白色框內！";
  } else if (gameStarted && feedback.includes("偵測中...請對準攝影機！")) {
      // 如果之前顯示過「偵測中」且現在偵測到手了，就清除訊息，除非有其他訊息
      feedback = "";
  }
  text(feedback, width / 2, height - 10);

  // 限制手勢偵測頻率
  if (handpose && gameModelsLoaded && (millis() - lastHandDetectTime > handDetectInterval)) {
    handpose.predict(video).then(results => {
      hands = results;

      // 在手部數據更新後立即嘗試檢查動作
      // 只有當手在框內時才檢查動作
      if (actionWindowActive && !actionCheckedForCurrentName && hands.length > 0 && handInBox) {
        checkAction();
      }
    });
    lastHandDetectTime = millis();
  }


  drawHandLandmarks(); // 只繪製手部關節點

  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0);
      push();
      // correctionMarkPosition的座標是基於原本的影像，如果影像翻轉了，則mark也要翻轉
      // 因為drawHandLandmarks已經處理了翻轉，所以這裡直接使用即可
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

  // 重置遊戲相關變數以便重新開始
  score = 0;
  timeLeft = 60;
  feedback = "";
  hands = [];
  currentName = ""; // 清空顯示的人名
  actionWindowActive = false; // 遊戲結束時重置
  actionCheckedForCurrentName = false; // 遊戲結束時重置

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
  feedback = ""; // 清空上次的回饋
  actionCheckedForCurrentName = false;
  actionWindowActive = true; // 新名字出現，動作窗口開啟
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  // 只有在動作窗口開啟且該名字的動作尚未被檢查過時才執行
  if (!actionWindowActive || actionCheckedForCurrentName || hands.length === 0) return false;

  let handInBox = false;
  if (hands.length > 0) {
    let wrist = hands[0].landmarks[0];
    if (wrist[0] > (detectionBoxX - detectionBoxWidth / 2) &&
        wrist[0] < (detectionBoxX + detectionBoxWidth / 2) &&
        wrist[1] > (detectionBoxY - detectionBoxHeight / 2) &&
        wrist[1] < (detectionBoxY + detectionBoxHeight / 2)) {
      handInBox = true;
    }
  }

  // 如果手不在框內，則不進行手勢判斷
  if (!handInBox) {
      feedback = "⚠️ 請將手移入白色框內！";
      return false; // 不做任何判斷，等待手進入框內
  }


  let actionMade = false; // 判斷是否做了"任何"有效手勢 (握拳或攤開)
  let correctAction = false;

  const isCurrentTeacher = teacherList.includes(currentName);

  // 偵測兩種手勢
  const hasFist = isFistClosed();
  const hasOpenHand = isOpenHand();

  // 如果同時偵測到兩種手勢，這可能是模糊情況，或兩者都不是明確的動作，可以考慮不做判斷或視為無效
  // 減少同時判斷為真導致的誤判，優先判斷是否明確做出其中一種手勢
  if (hasFist && hasOpenHand) {
      feedback = "手勢模糊，請明確動作！";
      return false; // 不給分也不扣分，等待更明確的動作
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
  return actionMade;
}

// 判斷是否為握拳動作 (手背朝攝影機)
function isFistClosed() {
  if (hands.length === 0 || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;
  // 手背朝攝影機時，彎曲手指會讓指尖的 Y 座標相對**上升** (因為 Y 軸向下遞增)
  // 且指尖會更靠近手腕
  // 閾值已經設定得非常寬鬆，以便更容易偵測
  const THRESHOLD_CURLED_Y_OFFSET = -5; // 尖端 Y 座標比 MCP Y 座標**小於**此負值，表示彎曲向上 (極為寬鬆)
  const THUMB_CLOSE_DISTANCE = 60; // 拇指尖與食指根部距離，放寬以表示收攏

  // 檢查四個手指是否彎曲 (尖端 Y 座標相對 MCP 關節的 Y 座標更高，即 Y 值更小)
  let indexCurled = landmarks[8][1] < landmarks[5][1] + THRESHOLD_CURLED_Y_OFFSET;
  let middleCurled = landmarks[12][1] < landmarks[9][1] + THRESHOLD_CURLED_Y_OFFSET;
  let ringCurled = landmarks[16][1] < landmarks[13][1] + THRESHOLD_CURLED_Y_OFFSET;
  let pinkyCurled = landmarks[20][1] < landmarks[17][1] + THRESHOLD_CURLED_Y_OFFSET;

  // 檢查拇指是否收攏或彎曲
  // 拇指尖 (4) 應該靠近食指根部 (5) 或掌心 (0)
  let thumbClose = dist(landmarks[4][0], landmarks[4][1], landmarks[5][0], landmarks[5][1]) < THUMB_CLOSE_DISTANCE ||
                   dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]) < THUMB_CLOSE_DISTANCE;

  return indexCurled && middleCurled && ringCurled && pinkyCurled && thumbClose;
}


// 判斷是否為攤開手掌的動作 (張開五隻手指) (手背朝攝影機)
function isOpenHand() {
  if (hands.length === 0 || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;
  // 手背朝攝影機時，伸直手指會讓指尖的 Y 座標相對**下降** (Y 軸向下遞增)
  // 閾值已經設定得非常寬鬆，以便更容易偵測
  const THRESHOLD_STRAIGHT_Y_OFFSET = 5; // 尖端 Y 座標比 MCP Y 座標**大於**此值，表示伸直 (極為寬鬆)
  const MIN_SPREAD_X = 10;           // 相鄰手指尖 X 座標間距最小要求 (用於判斷張開，極度放寬)
  const MIN_FULL_SPREAD_X = 40;    // 食指尖到小指尖的總橫向距離 (判斷完全張開，極度放寬)
  const THUMB_AWAY_DISTANCE = 40; // 拇指尖到掌根距離，表示拇指張開 (極為寬鬆)

  // 1. 檢查所有手指（食指、中指、無名指、小指）是否伸直
  // 尖端 Y 座標必須明顯低於 MCP 關節 Y 座標 (Y 軸向下遞增，所以低表示 Y 值大)
  let indexStraight = landmarks[8][1] > landmarks[5][1] + THRESHOLD_STRAIGHT_Y_OFFSET;
  let middleStraight = landmarks[12][1] > landmarks[9][1] + THRESHOLD_STRAIGHT_Y_OFFSET;
  let ringStraight = landmarks[16][1] > landmarks[13][1] + THRESHOLD_STRAIGHT_Y_OFFSET;
  let pinkyStraight = landmarks[20][1] > landmarks[17][1] + THRESHOLD_STRAIGHT_Y_OFFSET;

  // 2. 檢查拇指是否伸直並遠離掌心
  // 拇指尖 (4) 的 Y 座標應明顯低於其根部 (1)
  // 且拇指尖 (4) 應與掌根 (0) 有足夠的距離
  let thumbStraightAndSpread = (landmarks[4][1] > landmarks[1][1] + THRESHOLD_STRAIGHT_Y_OFFSET) &&
                               (dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]) > THUMB_AWAY_DISTANCE);

  let allFingersStraight = indexStraight && middleStraight && ringStraight && pinkyStraight && thumbStraightAndSpread;

  // 3. 檢查手指是否張開（橫向距離）
  let fingersSpread = (abs(landmarks[8][0] - landmarks[12][0]) > MIN_SPREAD_X) && // 食指 vs 中指
                      (abs(landmarks[12][0] - landmarks[16][0]) > MIN_SPREAD_X) && // 中指 vs 無名指
                      (abs(landmarks[16][0] - landmarks[20][0]) > MIN_SPREAD_X); // 無名指 vs 小指

  // 4. 檢查食指到小指的總橫向距離是否達到完全張開的程度
  let fullSpreadX = abs(landmarks[8][0] - landmarks[20][0]) > MIN_FULL_SPREAD_X;

  // 綜合判斷：所有手指伸直 AND 手指之間有足夠的橫向張開距離
  return allFingersStraight && fingersSpread && fullSpreadX;
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
