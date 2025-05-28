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

// 動作判斷狀態變數 (已移除，但保留變數以防意外)
let actionCheckedForCurrentName = false; // 當前人名是否已檢查過動作並給分/扣分

// 視覺回饋相關變數 (已移除，但保留變數以防意外)
let showCorrectionMark = false; // 是否顯示打勾或打叉
let correctionMarkType = '';    // 'check' 或 'cross'
let correctionMarkPosition;     // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255;  // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime;    // 打勾或打叉開始顯示的時間

// 你提供的嘴巴點位索引 (現在僅用於繪圖)
const mouthPoints = [
  409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, // 上下唇外側
  76, 77, 90, 180, 85, 16, 315, 404, 320, 307, 306, 408, 304, 303, 302, 11, 72, 73, 74, 184  // 上下唇內側
];

// **** 新增：偵測頻率控制變數 ****
let lastFaceDetectTime = 0;
let faceDetectInterval = 200; // 每 200 毫秒進行一次人臉偵測 (約 5 FPS)

let lastHandDetectTime = 0;
let handDetectInterval = 100; // 每 100 毫秒進行一次手勢偵測 (約 10 FPS)


function setup() {
  createCanvas(640, 480); // 可以考慮降低解析度到 320x240 來提升效能
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
    checkModelsLoaded();
  });

  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
    checkModelsLoaded();
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
  
  // 遊戲啟動時不再檢查是否有偵測到物件，因為移除了動作偵測
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

  // 限制人臉偵測頻率
  if (faceapi && gameModelsLoaded && (millis() - lastFaceDetectTime > faceDetectInterval)) {
    faceapi.detect(gotFace);
    lastFaceDetectTime = millis();
  }

  // 限制手勢偵測頻率
  if (handpose && gameModelsLoaded && (millis() - lastHandDetectTime > handDetectInterval)) {
    handpose.predict(video).then(results => {
      hands = results;
    });
    lastHandDetectTime = millis();
  }

  // ** 移除了 checkAction() 的呼叫，因為不再偵測動作 **
  // if (!actionCheckedForCurrentName) {
  //   checkAction();
  // }

  // 繪製嘴巴和手部點位仍然保留，以便視覺化
  drawMouthPoints();
  drawHandLandmarks();

  // ** 移除了 correction mark 的顯示邏輯 **
  // if (showCorrectionMark) {
  //   let elapsed = millis() - correctionMarkStartTime;
  //   if (elapsed < correctionMarkDuration) {
  //     correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0);
  //     push();
  //     translate(correctionMarkPosition.x, correctionMarkPosition.y);
  //     noFill();
  //     strokeWeight(5);
  //     stroke(0, 0, 255, correctionMarkAlpha); // 藍色

  //     if (correctionMarkType === 'check') {
  //       line(-20, 0, 0, 20);
  //       line(0, 20, 40, -20);
  //     } else if (correctionMarkType === 'cross') {
  //       line(-20, -20, 20, 20);
  //       line(-20, 20, 20, -20);
  //     }
  //     pop();
  //   } else {
  //     showCorrectionMark = false;
  //   }
  // }

  if (millis() - lastSwitchTime > switchInterval) {
    pickNewName();
    // ** 動作檢查標誌現在沒有實際作用，但可保留以防未來需要 **
    actionCheckedForCurrentName = false; 
    
    // ** 自動加減分邏輯：當人名切換時，直接根據是否為老師進行加減分 **
    const isCurrentTeacher = teacherList.includes(currentName);
    if (isCurrentTeacher) {
        // 如果是老師，直接加分
        score += (currentName === "陳慶帆" ? 2 : 1);
        feedback = "老師來了！自動加分！";
    } else {
        // 如果不是老師，直接扣分
        score -= 1;
        feedback = "不是老師，自動扣分！";
    }
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
}

// ** 移除了 checkAction 函數及其內部所有邏輯，因為不再需要偵測動作 **
// function checkAction() { ... }

// ** 移除了 isOpenMouth 函數，因為不再需要偵測嘴巴動作 **
// function isOpenMouth() { ... }

// ** 移除了 isThumbsUp 函數，因為不再需要偵測手勢動作 **
// function isThumbsUp() { ... }

// 繪製嘴巴關鍵點和連線 (淺黃色)
function drawMouthPoints() {
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    
    noFill();
    stroke(255, 255, 0, 200); // 淺黃色，帶透明度
    strokeWeight(2);

    // 繪製上唇外側輪廓
    beginShape();
    vertex(mouth[409]._x, mouth[409]._y);
    vertex(mouth[270]._x, mouth[270]._y);
    vertex(mouth[269]._x, mouth[269]._y);
    vertex(mouth[267]._x, mouth[267]._y);
    vertex(mouth[0]._x, mouth[0]._y); // 唇峰
    vertex(mouth[37]._x, mouth[37]._y);
    vertex(mouth[39]._x, mouth[39]._y);
    vertex(mouth[40]._x, mouth[40]._y);
    vertex(mouth[185]._x, mouth[185]._y);
    vertex(mouth[61]._x, mouth[61]._y); // 左嘴角
    endShape();

    // 繪製下唇外側輪廓
    beginShape();
    vertex(mouth[61]._x, mouth[61]._y); // 從左嘴角開始
    vertex(mouth[146]._x, mouth[146]._y);
    vertex(mouth[91]._x, mouth[91]._y);
    vertex(mouth[181]._x, mouth[181]._y);
    vertex(mouth[84]._x, mouth[84]._y);
    vertex(mouth[17]._x, mouth[17]._y); // 唇底
    vertex(mouth[314]._x, mouth[314]._y);
    vertex(mouth[405]._x, mouth[405]._y);
    vertex(mouth[321]._x, mouth[321]._y);
    vertex(mouth[375]._x, mouth[375]._y);
    vertex(mouth[291]._x, mouth[291]._y); // 右嘴角
    endShape();
    
    // 繪製內唇輪廓 
    // 內上唇
    beginShape();
    vertex(mouth[76]._x, mouth[76]._y);
    vertex(mouth[77]._x, mouth[77]._y);
    vertex(mouth[90]._x, mouth[90]._y);
    vertex(mouth[180]._x, mouth[180]._y);
    vertex(mouth[85]._x, mouth[85]._y);
    vertex(mouth[16]._x, mouth[16]._y); // 內唇中點 (上)
    vertex(mouth[315]._x, mouth[315]._y);
    vertex(mouth[404]._x, mouth[404]._y);
    vertex(mouth[320]._x, mouth[320]._y);
    vertex(mouth[307]._x, mouth[307]._y);
    vertex(mouth[306]._x, mouth[306]._y);
    endShape(CLOSE); // 閉合形狀

    // 內下唇
    beginShape();
    vertex(mouth[408]._x, mouth[408]._y);
    vertex(mouth[304]._x, mouth[304]._y);
    vertex(mouth[303]._x, mouth[303]._y);
    vertex(mouth[302]._x, mouth[302]._y);
    vertex(mouth[11]._x, mouth[11]._y); // 內唇中點 (下)
    vertex(mouth[72]._x, mouth[72]._y);
    vertex(mouth[73]._x, mouth[73]._y);
    vertex(mouth[74]._x, mouth[74]._y);
    vertex(mouth[184]._x, mouth[184]._y);
    endShape(CLOSE); // 閉合形狀

    // 繪製點 (可選)
    fill(255, 255, 0);
    noStroke();
    for(let index of mouthPoints) {
        if(mouth[index]) {
            ellipse(mouth[index]._x, mouth[index]._y, 4, 4);
        }
    }
  }
}

// 繪製手部關節點和連線 (淺綠色)
function drawHandLandmarks() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.landmarks.length; j++) {
      let landmark = hand.landmarks[j];
      fill(100, 255, 100); // 淺綠色
      noStroke();
      ellipse(landmark[0], landmark[1], 8, 8); // 稍微大一點的點
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
