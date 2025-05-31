let video;
let handpose; // 宣告 handpose 變數，確保其為全域
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
  "賴婷鈴", // 淡江教科的老師們
  "馬嘉祺",
  "丁程鑫",
  "宋亞軒",
  "劉耀文",
  "張真源",
  "嚴浩翔",
  "賀峻霖", // 非老師們
];
// 淡江教科的老師們列表
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

// 白線框的變數
let detectionBoxX;
let detectionBoxY;
let detectionBoxWidth = 450; // 偵測框寬度進一步增加
let detectionBoxHeight = 450; // 偵測框高度進一步增加

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, videoReady); // 捕捉攝影機畫面
  video.size(width, height);
  video.hide(); // 隱藏原始影片元素

  textAlign(CENTER, CENTER);
  textSize(40); // 調整字體大小，讓人名更清晰

  detectionBoxX = width / 2; // 設定偵測框的中心 X 位置
  detectionBoxY = height / 2; // 設定偵測框的中心 Y 位置

  showStartScreen(); // 顯示開始畫面

  let startButton = select("#startButton");
  if (startButton) {
    startButton.mousePressed(startGame); // 綁定開始按鈕的點擊事件
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
    startButton.attribute("disabled", ""); // 初始禁用按鈕，等待模型載入
  }

  if (gameModelsLoaded) {
    if (startButton) {
      startButton.html("模型載入完成，點擊開始");
      startButton.removeAttribute("disabled"); // 模型載入完成後啟用按鈕
    }
  } else {
    if (startButton) {
      startButton.html("載入 AI 模型中..."); // 顯示模型載入狀態
    }
  }
}

function videoReady() {
  console.log("攝影機成功啟動！");
  // 初始化 ml5.handpose 模型，並指定回呼函數 modelReady
  handpose = ml5.handpose(video, modelReady);
}

function modelReady() {
  console.log("Handpose model ready!");
  gameModelsLoaded = true; // 將模型載入狀態設為 true
  showStartScreen(); // 更新開始畫面，啟用開始按鈕

  // 模型載入成功後，開始持續偵測手部，並將結果存入 hands 陣列
  handpose.on("hand", (results) => {
    hands = results;
  });
}

function startGame() {
  if (!gameModelsLoaded) {
    feedback = "請等待 AI 模型載入完成！";
    return; // 如果模型未載入，則不開始遊戲
  }

  console.log("遊戲開始！");
  gameStarted = true;
  startTime = millis();
  score = 0; // 遊戲開始時分數歸零
  timeLeft = 60; // 遊戲開始時時間重置
  pickNewName(); // 第一次選取名字並啟動動作偵測窗口

  // 清除舊的計時器，並設定新的遊戲時間倒數計時器
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      endGame(); // 時間到則結束遊戲
    }
  }, 1000);

  let startButton = select("#startButton");
  if (startButton) {
    startButton.style("display", "none"); // 遊戲開始後隱藏開始按鈕
  }
}

function draw() {
  background(250);
  // 顯示攝影機畫面，並左右翻轉以符合鏡像效果
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (!gameStarted) {
    showStartScreen(); // 如果遊戲未開始，則顯示開始畫面
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
  // 只有當偵測到手部且關鍵點完整時才進行判斷
  if (hands.length > 0 && hands[0].landmarks && hands[0].landmarks.length === 21) {
    let wrist = hands[0].landmarks[0]; // 手腕關鍵點 (索引 0)
    // 檢查手腕點是否在偵測框內
    if (
      wrist[0] > detectionBoxX - detectionBoxWidth / 2 &&
      wrist[0] < detectionBoxX + detectionBoxWidth / 2 &&
      wrist[1] > detectionBoxY - detectionBoxHeight / 2 &&
      wrist[1] < detectionBoxY + detectionBoxHeight / 2
    ) {
      handInBox = true;
    }
  }

  // 人名方塊的脈動效果
  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  let boxY = height * 0.8;
  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, boxY, currentBoxSize, currentBoxSize / 2);

  fill(0);
  text(currentName, width / 2, boxY); // 顯示目前的人名

  fill(0, 200, 0);
  textSize(24);
  textAlign(LEFT, TOP);
  text("分數: " + score, 10, 10); // 顯示分數

  fill(0, 0, 200);
  textSize(24);
  textAlign(RIGHT, TOP);
  text("時間: " + max(0, timeLeft) + "s", width - 10, 10); // 顯示剩餘時間

  fill(255, 0, 0);
  textAlign(CENTER, BOTTOM);
  textSize(22);

  // 優化偵測提示邏輯
  if (gameStarted && hands.length === 0) {
    feedback = "🔍 請將手心完整地放入攝影機畫面中央！";
  } else if (gameStarted && hands.length > 0 && (!hands[0].landmarks || hands[0].landmarks.length < 21)) {
    feedback = "🤔 請調整手部姿勢或光線，確保完整偵測！";
  } else if (gameStarted && hands.length > 0 && hands[0].landmarks && hands[0].landmarks.length === 21 && !handInBox) {
    feedback = "⚠️ 請將手移入白色框內！";
  } else if (gameStarted && hands.length > 0 && hands[0].landmarks && hands[0].landmarks.length === 21 && handInBox) {
    // 只有當手在框內且偵測到完整手部時，才檢查動作
    if (actionWindowActive && !actionCheckedForCurrentName) {
      checkAction();
    }
    // 如果之前有提示，現在手已偵測到且在框內，就清除提示
    // 只有在沒有其他更具體的提示時才清除
    if (feedback.includes("請將手") || feedback.includes("偵測！") || feedback.includes("手勢模糊")) {
      feedback = "";
    }
  }

  text(feedback, width / 2, height - 10); // 顯示回饋訊息

  drawHandLandmarks(); // 繪製手部關節點和連線

  // 顯示打勾或打叉的視覺回饋
  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0); // 透明度漸變
      push();
      translate(width - correctionMarkPosition.x, correctionMarkPosition.y); // 座標翻轉
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
      showCorrectionMark = false; // 超過顯示時間則隱藏
    }
  }

  // 時間到自動換名字
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
  actionWindowActive = false; // 遊戲結束時重置動作窗口
  actionCheckedForCurrentName = false; // 遊戲結束時重置動作檢查狀態

  let startButton = select("#startButton");
  if (startButton) {
    startButton.style("display", "block");
    startButton.html('重新開始遊戲');
    startButton.removeAttribute("disabled"); // 重新啟用開始按鈕
  }
}

function pickNewName() {
  currentName = random(nameList); // 從名字列表中隨機選取一個
  lastSwitchTime = millis();
  feedback = ""; // 清空上次的回饋
  actionCheckedForCurrentName = false; // 重置動作檢查狀態
  actionWindowActive = true; // 新名字出現，動作窗口開啟
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  // 只有當動作窗口活躍、尚未檢查過動作、有手部偵測結果且關鍵點完整時才進行判斷
  if (!actionWindowActive || actionCheckedForCurrentName || hands.length === 0 || !hands[0].landmarks || hands[0].landmarks.length !== 21) {
    return false;
  }

  let handInBox = false;
  let wrist = hands[0].landmarks[0];
  if (
    wrist[0] > detectionBoxX - detectionBoxWidth / 2 &&
    wrist[0] < detectionBoxX + detectionBoxWidth / 2 &&
    wrist[1] > detectionBoxY - detectionBoxHeight / 2 &&
    wrist[1] < detectionBoxY + detectionBoxHeight / 2
  ) {
    handInBox = true;
  }

  if (!handInBox) {
    feedback = "⚠️ 請將手移入白色框內！";
    return false; // 如果手不在框內，不進行動作判斷
  }

  let actionMade = false;
  let correctAction = false;

  const isCurrentTeacher = teacherList.includes(currentName); // 判斷當前名字是否為老師

  const hasFist = isFistClosed(); // 判斷是否為握拳
  const hasOpenHand = isOpenHand(); // 判斷是否為攤開手掌

  // 優先處理手勢模糊的情況（同時偵測到兩種手勢）
  if (hasFist && hasOpenHand) {
    feedback = "手勢模糊，請明確動作！";
    return false;
  }

  if (isCurrentTeacher) {
    // 如果是教科老師，期望握拳
    if (hasFist) {
      actionMade = true;
      correctAction = true;
      score += currentName === "陳慶帆" ? 2 : 1; // 陳慶帆老師加倍分數
      feedback =
        currentName === "陳慶帆"
          ? "👊 陳慶帆老師來了！握拳加倍加分！"
          : "👊 老師來了！握拳加分！";
    } else if (hasOpenHand) { // 錯誤動作：攤開手掌
      actionMade = true;
      correctAction = false;
      score -= currentName === "陳慶帆" ? 3 : 1; // 陳慶帆老師扣更多分
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
    } else if (hasFist) { // 錯誤動作：握拳
      actionMade = true;
      correctAction = false;
      feedback = "👊 這時候要攤開手啦～扣1分！";
      score -= 1;
    }
  }

  if (actionMade) {
    actionCheckedForCurrentName = true; // 標記為已檢查動作，防止重複計分
    let wrist = hands[0].landmarks[0]; // 獲取手腕位置作為視覺回饋的起點
    correctionMarkPosition = createVector(wrist[0], wrist[1] - 50);
    correctionMarkType = correctAction ? "check" : "cross"; // 根據動作是否正確顯示打勾或打叉
    showCorrectionMark = true;
    correctionMarkStartTime = millis();
  }
  return actionMade;
}

// 判斷是否為握拳動作 (手心朝攝影機)
function isFistClosed() {
  if (hands.length === 0 || !hands[0].landmarks || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;

  // 握拳判斷邏輯：
  // 檢查所有指尖點 (4, 8, 12, 16, 20) 是否都比對應的掌指關節 (MCP) 更靠近手腕 (Y 值更大)
  // 或指尖與掌指關節的水平距離非常近（向內彎曲）
  // 並確保拇指靠近掌心或食指根部。

  // 閾值設定，這些需要根據實際測試調整
  // 你的新閾值
  const FINGER_CURLED_Y_OFFSET = -5; // 指尖 Y 座標比其 MCP 關節 Y 座標**小於**此值 (向上彎曲)
  const FINGER_CURLED_X_OFFSET = 10; // 指尖 X 座標與其 MCP 關節 X 座標的最大絕對差值 (向內收縮)
  const THUMB_CLOSE_DISTANCE = 50; // 拇指尖到手腕或食指根部的距離

  let allFingersCurled = true;

  // 檢查食指、中指、無名指、小指
  // 遍歷食指(5-8)、中指(9-12)、無名指(13-16)、小指(17-20)
  // 關鍵點索引：MCP(5,9,13,17), TIP(8,12,16,20)
  for (let i = 0; i < 4; i++) {
    let mcpIndex = 5 + i * 4;
    let tipIndex = 8 + i * 4;

    // 判斷指尖是否向上彎曲（Y值較小）且水平距離不遠
    if (
      !(
        landmarks[tipIndex][1] < landmarks[mcpIndex][1] + FINGER_CURLED_Y_OFFSET && // 指尖Y比MCP的Y小（更上方）
        abs(landmarks[tipIndex][0] - landmarks[mcpIndex][0]) < FINGER_CURLED_X_OFFSET // 指尖X靠近MCP的X
      )
    ) {
      allFingersCurled = false;
      break; // 有一個手指不符合就不是握拳
    }
  }

  // 檢查拇指是否收攏靠近掌心
  let thumbToPalm = dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]);
  let thumbToIndexBase = dist(landmarks[4][0], landmarks[4][1], landmarks[5][0], landmarks[5][1]);
  let thumbClose = thumbToPalm < THUMB_CLOSE_DISTANCE || thumbToIndexBase < THUMB_CLOSE_DISTANCE;

  return allFingersCurled && thumbClose;
}


// 判斷是否為攤開手掌的動作 (手心朝攝影機)
function isOpenHand() {
  if (hands.length === 0 || !hands[0].landmarks || hands[0].landmarks.length < 21) return false;

  let landmarks = hands[0].landmarks;

  // 攤開手掌判斷邏輯：
  // 檢查是否每根手指都伸展 (TIP 的 Y 值小於 MCP，並且距離足夠遠)
  // 這裡假設手是直立的，指尖的 Y 值會比掌指關節小 (在畫面上更上方)
  // 並且指尖到掌指關節的距離要足夠長，表示伸直

  // 閾值需要根據實際測試調整
  const FINGER_STRAIGHT_Y_OFFSET = 50; // 指尖 Y 座標比其 MCP 關節 Y 座標**小於**此值 (向上伸直)
  const MIN_FINGER_TIP_DISTANCE = 40; // 指尖到其 MCP 關節的最小距離 (確保伸直)
  const THUMB_AWAY_FROM_PALM_DIST = 40; // 拇指尖到手腕的最小距離 (確保張開)

  let allFingersStraight = true;

  // 檢查食指、中指、無名指、小指
  for (let i = 0; i < 4; i++) {
    let mcpIndex = 5 + i * 4; // 掌指關節
    let tipIndex = 8 + i * 4; // 指尖

    // 判斷指尖是否向上伸直（Y值較小）且與MCP的距離足夠遠
    if (
      !(landmarks[tipIndex][1] < landmarks[mcpIndex][1] - FINGER_STRAIGHT_Y_OFFSET) || // 指尖Y明顯高於MCP的Y (向上伸直)
      !(dist(landmarks[tipIndex][0], landmarks[tipIndex][1], landmarks[mcpIndex][0], landmarks[mcpIndex][1]) >= MIN_FINGER_TIP_DISTANCE)
    ) {
      allFingersStraight = false;
      break;
    }
  }

  // 拇指應該遠離掌心
  let thumbAway = dist(landmarks[4][0], landmarks[4][1], landmarks[0][0], landmarks[0][1]) > THUMB_AWAY_FROM_PALM_DIST;

  return allFingersStraight && thumbAway;
}


// 繪製手部關節點和連線 (淺綠色)
function drawHandLandmarks() {
  // 只有當偵測到完整21個關鍵點時才繪製，避免繪製不完整的骨架
  if (hands.length === 0 || !hands[0].landmarks || hands[0].landmarks.length !== 21) return;

  let hand = hands[0]; // 假設只偵測一隻手

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
  line(width - hand.landmarks[0][0], hand.landmarks[0][1], width - hand.landmarks[1][0], hand.landmarks[1][1]);
  line(width - hand.landmarks[1][0], hand.landmarks[1][1], width - hand.landmarks[2][0], hand.landmarks[2][1]);
  line(width - hand.landmarks[2][0], hand.landmarks[2][1], width - hand.landmarks[3][0], hand.landmarks[3][1]);
  line(width - hand.landmarks[3][0], hand.landmarks[3][1], width - hand.landmarks[4][0], hand.landmarks[4][1]);

  // 食指 (0-5, 5-8)
  line(width - hand.landmarks[0][0], hand.landmarks[0][1], width - hand.landmarks[5][0], hand.landmarks[5][1]); // 腕部到食指根部
  line(width - hand.landmarks[5][0], hand.landmarks[5][1], width - hand.landmarks[6][0], hand.landmarks[6][1]);
  line(width - hand.landmarks[6][0], hand.landmarks[6][1], width - hand.landmarks[7][0], hand.landmarks[7][1]);
  line(width - hand.landmarks[7][0], hand.landmarks[7][1], width - hand.landmarks[8][0], hand.landmarks[8][1]);

  // 中指 (5-9, 9-12)
  line(width - hand.landmarks[5][0], hand.landmarks[5][1], width - hand.landmarks[9][0], hand.landmarks[9][1]); // 食指根部到中指根部
  line(width - hand.landmarks[9][0], hand.landmarks[9][1], width - hand.landmarks[10][0], hand.landmarks[10][1]);
  line(width - hand.landmarks[10][0], hand.landmarks[10][1], width - hand.landmarks[11][0], hand.landmarks[11][1]);
  line(width - hand.landmarks[11][0], hand.landmarks[11][1], width - hand.landmarks[12][0], hand.landmarks[12][1]);

  // 無名指 (9-13, 13-16)
  line(width - hand.landmarks[9][0], hand.landmarks[9][1], width - hand.landmarks[13][0], hand.landmarks[13][1]); // 中指根部到無名指根部
  line(width - hand.landmarks[13][0], hand.landmarks[13][1], width - hand.landmarks[14][0], hand.landmarks[14][1]);
  line(width - hand.landmarks[14][0], hand.landmarks[14][1], width - hand.landmarks[15][0], hand.landmarks[15][1]);
  line(width - hand.landmarks[15][0], hand.landmarks[15][1], width - hand.landmarks[16][0], hand.landmarks[16][1]);

  // 小指 (13-17, 17-20)
  line(width - hand.landmarks[13][0], hand.landmarks[13][1], width - hand.landmarks[17][0], hand.landmarks[17][1]); // 無名指根部到小指根部
  line(width - hand.landmarks[17][0], hand.landmarks[17][1], width - hand.landmarks[18][0], hand.landmarks[18][1]);
  line(width - hand.landmarks[18][0], hand.landmarks[18][1], width - hand.landmarks[19][0], hand.landmarks[19][1]);
  line(width - hand.landmarks[19][0], hand.landmarks[19][1], width - hand.landmarks[20][0], hand.landmarks[20][1]);

  // 手掌連接 (形成手掌輪廓)
  line(width - hand.landmarks[0][0], hand.landmarks[0][1], width - hand.landmarks[5][0], hand.landmarks[5][1]);
  line(width - hand.landmarks[5][0], hand.landmarks[5][1], width - hand.landmarks[9][0], hand.landmarks[9][1]);
  line(width - hand.landmarks[9][0], hand.landmarks[9][1], width - hand.landmarks[13][0], hand.landmarks[13][1]);
  line(width - hand.landmarks[13][0], hand.landmarks[13][1], width - hand.landmarks[17][0], hand.landmarks[17][1]);
  line(width - hand.landmarks[17][0], hand.landmarks[17][1], width - hand.landmarks[0][0], hand.landmarks[0][1]);
}
