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

// 你提供的嘴巴點位索引
const mouthPoints = [
  409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, // 上下唇外側
  76, 77, 90, 180, 85, 16, 315, 404, 320, 307, 306, 408, 304, 303, 302, 11, 72, 73, 74, 184  // 上下唇內側 (內圈可能更適合判斷張嘴)
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
  text("（請允許攝影機權限並等待模型載入）", width / 2, height / 2);
  
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
  // 檢查所有模型是否都已載入
  if (faceapi && handpose && faceapi.ready && handpose.ready) {
    gameModelsLoaded = true;
    showStartScreen(); // 更新開始畫面以啟用按鈕
  }
}


function startGame() {
  // 只有當模型載入完成，並且偵測到臉或手時才允許開始
  if (!gameModelsLoaded) {
    feedback = "請等待 AI 模型載入完成！";
    return;
  }
  // 可以在這裡加入一個初始偵測的判斷，確保有人臉或手在畫面中
  // 目前是直接從 `checkAction` 中判斷

  console.log("遊戲開始！");
  gameStarted = true;
  startTime = millis();
  pickNewName();
  
  // 確保清除之前可能存在的計時器
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
    showStartScreen(); // 持續顯示開始畫面並更新按鈕狀態
    return;
  }

  // 遊戲進行時的繪製和邏輯
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

  // **** 新增：即時偵測與判斷 ****
  // 只有在當前人名還沒有進行過動作判斷時才執行 checkAction
  if (!actionCheckedForCurrentName) {
    checkAction();
  }

  // 繪製臉部嘴巴關鍵點和連線 (淺黃色)
  drawMouthPoints();
  // 繪製手部關節點和連線 (淺綠色)
  drawHandLandmarks();

  // 顯示打勾或打叉的視覺回饋
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

  // 每隔 N 秒切換人名
  if (millis() - lastSwitchTime > switchInterval) {
    pickNewName();
    actionCheckedForCurrentName = false; // 重置動作判斷狀態
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
    startButton.removeAttribute('disabled'); // 啟用按鈕
  }
}

function pickNewName() {
  currentName = random(nameList);
  lastSwitchTime = millis();
  feedback = "";
  actionCheckedForCurrentName = false; // 每次切換人名都重置動作判斷狀態
}

function gotFace(err, result) {
  if (result) {
    detections = result;
  }
  faceapi.detect(gotFace);
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  // 如果已經針對當前人名進行過評分，則直接返回
  if (actionCheckedForCurrentName) return;

  let correctAction = false; // 判斷玩家動作是否正確
  let actionDetected = false; // 判斷是否有偵測到有效的臉或手動作

  // 優先判斷臉部動作 (嘟嘴)
  if (detections.length > 0) {
      if (isPouting()) {
          actionDetected = true;
          const isCurrentTeacher = teacherList.includes(currentName);
          if (isCurrentTeacher) {
              feedback = "😘 成功親到老師！";
              correctAction = true;
              score += (currentName === "陳慶帆" ? 2 : 1);
          } else {
              feedback = "😗 對非老師不要嘟嘴喔！"; // 這是錯誤動作
              correctAction = false;
              score -= 1; // 非老師嘟嘴也扣分
          }
      }
  }

  // 如果臉部沒有偵測到特定動作，或者當前目標不是老師，則判斷手勢 (比讚)
  // 避免在嘟嘴正確時又判斷手勢
  if (!actionDetected && hands.length > 0) {
      if (isThumbsUp()) {
          actionDetected = true;
          const isCurrentTeacher = teacherList.includes(currentName);
          if (!isCurrentTeacher) { // 非老師才比讚
              feedback = "👍 這不是老師，給他個讚！";
              correctAction = true;
              score += 1;
          } else {
              feedback = "👎 對老師比讚是錯的喔！"; // 這是錯誤動作
              correctAction = false;
              score -= (currentName === "陳慶帆" ? 3 : 1); // 老師錯了要扣分
          }
      }
  }

  // 如果偵測到動作並給分/扣分了，就設置狀態為已檢查
  if (actionDetected) {
      actionCheckedForCurrentName = true;
      // 處理視覺回饋 (打勾或打叉)
      if (detections.length > 0) {
        let faceNose = detections[0].parts.nose[0]; 
        correctionMarkPosition = createVector(faceNose._x, faceNose._y - 50); 
      } else if (hands.length > 0) { 
        let wrist = hands[0].landmarks[0]; 
        correctionMarkPosition = createVector(wrist[0], wrist[1] - 50);
      }
      correctionMarkType = correctAction ? 'check' : 'cross';
      showCorrectionMark = true;
      correctionMarkStartTime = millis();
  } else {
      // 如果沒有偵測到有效動作 (但有人臉或手部數據)，可以給一個提示
      if (detections.length > 0 || hands.length > 0) {
          if (!actionCheckedForCurrentName) { // 避免重複提示
              feedback = "請做出正確的動作！";
          }
      } else {
          // 如果連臉和手都沒偵測到
          feedback = "偵測中...請對準攝影機！";
      }
  }
}

// 判斷是否為嘟嘴動作
function isPouting() {
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    // 使用你提供的嘴唇內外側關鍵點
    // 內圈的上下唇中點
    let innerTopLip = mouth[11];
    let innerBottomLip = mouth[16];

    // 外圈的上下唇中點
    let outerTopLip = mouth[13];
    let outerBottomLip = mouth[19];

    if (innerTopLip && innerBottomLip && outerTopLip && outerBottomLip) {
      // 判斷嘴唇內側垂直距離是否足夠小 (閉合或嘟起)
      let innerLipDist = dist(innerTopLip._x, innerTopLip._y, innerBottomLip._x, innerBottomLip._y);
      // 判斷嘴唇外側垂直距離是否也比較小 (表示嘟嘴)
      let outerLipDist = dist(outerTopLip._x, outerTopLip._y, outerBottomLip._x, outerBottomLip._y);

      // 嘟嘴判斷邏輯：
      // 1. 內唇距離很小 (嘴巴閉合或微張)
      // 2. 外唇距離也相對小 (不是大張嘴)
      // 3. 嘴巴的水平寬度相對變小 (可以加這個判斷，但更複雜)

      // 這裡僅用垂直距離判斷，可以根據實際測試調整閾值
      return innerLipDist < 8 && outerLipDist < 15; // 內唇非常接近，外唇也比較接近
    }
  }
  return false;
}

// 判斷是否為比讚動作
function isThumbsUp() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      let thumbTip = landmarks[4];    // 拇指尖
      let thumbMCP = landmarks[2];    // 拇指根部關節 (metacarpophalangeal joint)

      let indexTip = landmarks[8];    // 食指尖
      let middleTip = landmarks[12];  // 中指尖
      let ringTip = landmarks[16];    // 無名指尖
      let pinkyTip = landmarks[20];   // 小指尖

      // 1. 拇指向上 (拇指尖Y座標小於拇指根部Y座標)
      let thumbIsUp = thumbTip[1] < thumbMCP[1];

      // 2. 其他四指是彎曲狀態 (指尖Y座標大於相應指關節Y座標)
      let indexCurled = indexTip[1] > landmarks[6][1]; 
      let middleCurled = middleTip[1] > landmarks[10][1]; 
      let ringCurled = ringTip[1] > landmarks[14][1];   
      let pinkyCurled = pinkyTip[1] > landmarks[18][1]; 

      let allFingersCurled = indexCurled && middleCurled && ringCurled && pinkyCurled;
      
      // 3. 確保拇指和食指分開 (拇指的 X 座標小於食指的 X 座標，表示拇指在食指左側 - 右手)
      let thumbAsideIndex = thumbTip[0] < indexTip[0]; 

      return thumbIsUp && allFingersCurled && thumbAsideIndex;
    }
  }
  return false;
}

// 繪製嘴巴關鍵點和連線 (淺黃色)
function drawMouthPoints() {
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    
    noFill();
    stroke(255, 255, 0, 200); // 淺黃色，帶透明度
    strokeWeight(2);

    // 繪製你提供的點位連線
    // 這是一個簡化的連線方式，可以根據實際嘴巴形狀調整連接順序
    beginShape();
    // 上唇外側 (部分點位)
    vertex(mouth[409]._x, mouth[409]._y);
    vertex(mouth[270]._x, mouth[270]._y);
    vertex(mouth[269]._x, mouth[269]._y);
    vertex(mouth[267]._x, mouth[267]._y);
    vertex(mouth[0]._x, mouth[0]._y);
    vertex(mouth[37]._x, mouth[37]._y);
    vertex(mouth[39]._x, mouth[39]._y);
    vertex(mouth[40]._x, mouth[40]._y);
    vertex(mouth[185]._x, mouth[185]._y);
    vertex(mouth[61]._x, mouth[61]._y); // 連接到嘴角
    endShape();

    beginShape();
    // 下唇外側 (部分點位)
    vertex(mouth[61]._x, mouth[61]._y); // 從嘴角開始
    vertex(mouth[146]._x, mouth[146]._y);
    vertex(mouth[91]._x, mouth[91]._y);
    vertex(mouth[181]._x, mouth[181]._y);
    vertex(mouth[84]._x, mouth[84]._y);
    vertex(mouth[17]._x, mouth[17]._y);
    vertex(mouth[314]._x, mouth[314]._y);
    vertex(mouth[405]._x, mouth[405]._y);
    vertex(mouth[321]._x, mouth[321]._y);
    vertex(mouth[375]._x, mouth[375]._y);
    vertex(mouth[291]._x, mouth[291]._y); // 連接到另一個嘴角
    endShape();

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

    // 連接手部骨架
    // 拇指
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[1][0], hand.landmarks[1][1]);
    line(hand.landmarks[1][0], hand.landmarks[1][1], hand.landmarks[2][0], hand.landmarks[2][1]);
    line(hand.landmarks[2][0], hand.landmarks[2][1], hand.landmarks[3][0], hand.landmarks[3][1]);
    line(hand.landmarks[3][0], hand.landmarks[3][1], hand.landmarks[4][0], hand.landmarks[4][1]);
    // 食指
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[5][0], hand.landmarks[5][1]); // 腕部到食指根部
    line(hand.landmarks[5][0], hand.landmarks[5][1], hand.landmarks[6][0], hand.landmarks[6][1]);
    line(hand.landmarks[6][0], hand.landmarks[6][1], hand.landmarks[7][0], hand.landmarks[7][1]);
    line(hand.landmarks[7][0], hand.landmarks[7][1], hand.landmarks[8][0], hand.landmarks[8][1]);
    // 中指
    line(hand.landmarks[9][0], hand.landmarks[9][1], hand.landmarks[10][0], hand.landmarks[10][1]);
    line(hand.landmarks[10][0], hand.landmarks[10][1], hand.landmarks[11][0], hand.landmarks[11][1]);
    line(hand.landmarks[11][0], hand.landmarks[11][1], hand.landmarks[12][0], hand.landmarks[12][1]);
    // 無名指
    line(hand.landmarks[13][0], hand.landmarks[13][1], hand.landmarks[14][0], hand.landmarks[14][1]);
    line(hand.landmarks[14][0], hand.landmarks[14][1], hand.landmarks[15][0], hand.landmarks[15][1]);
    line(hand.landmarks[15][0], hand.landmarks[15][1], hand.landmarks[16][0], hand.landmarks[16][1]);
    // 小指
    line(hand.landmarks[17][0], hand.landmarks[17][1], hand.landmarks[18][0], hand.landmarks[18][1]);
    line(hand.landmarks[18][0], hand.landmarks[18][1], hand.landmarks[19][0], hand.landmarks[19][1]);
    line(hand.landmarks[19][0], hand.landmarks[19][1], hand.landmarks[20][0], hand.landmarks[20][1]);
    // 手掌連接
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[5][0], hand.landmarks[5][1]); // 腕部到食指根部
    line(hand.landmarks[5][0], hand.landmarks[5][1], hand.landmarks[9][0], hand.landmarks[9][1]); // 食指根部到中指根部
    line(hand.landmarks[9][0], hand.landmarks[9][1], hand.landmarks[13][0], hand.landmarks[13][1]);// 中指根部到無名指根部
    line(hand.landmarks[13][0], hand.landmarks[13][1], hand.landmarks[17][0], hand.landmarks[17][1]);// 無名指根部到小指根部
    line(hand.landmarks[17][0], hand.landmarks[17][1], hand.landmarks[0][0], hand.landmarks[0][1]);// 小指根部到腕部
  }
}
