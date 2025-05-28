let video;
let faceapi;
let detections = []; // 儲存臉部偵測結果
let handpose;
let hands = [];     // 儲存手部偵測結果

// 遊戲狀態變數
let gameStarted = false; // 遊戲是否開始
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

// 視覺回饋相關變數
let showCorrectionMark = false; // 是否顯示打勾或打叉
let correctionMarkType = '';    // 'check' 或 'cross'
let correctionMarkPosition;     // 打勾或打叉的位置 (p5.Vector)
let correctionMarkAlpha = 255;  // 打勾或打叉的透明度
let correctionMarkDuration = 1000; // 打勾或打叉顯示時間 (毫秒)
let correctionMarkStartTime;    // 打勾或打叉開始顯示的時間

function setup() {
  createCanvas(640, 480);
  // 啟動攝影機，並在攝影機準備好後呼叫 videoReady 函數
  video = createCapture(VIDEO, videoReady);
  video.size(width, height);
  video.hide();

  // 設置文字對齊方式，全局應用
  textAlign(CENTER, CENTER);
  textSize(28);

  // 顯示開始遊戲按鈕或提示
  showStartScreen();
}

// 顯示遊戲開始畫面
function showStartScreen() {
  background(220);
  fill(0);
  textSize(32);
  text("點擊開始遊戲", width / 2, height / 2 - 50);
  textSize(20);
  text("（請允許攝影機權限）", width / 2, height / 2);
  
  // 在這裡可以加一個按鈕，讓玩家點擊後才開始遊戲
  // 為了簡化，目前設定成滑鼠點擊任意處開始
}

function mousePressed() {
  if (!gameStarted) {
    startGame();
  }
}


function videoReady() {
  console.log("攝影機成功啟動！");

  // 初始化 FaceAPI 模型
  faceapi = ml5.faceApi(video, { withLandmarks: true, withDescriptors: false }, () => {
    console.log("FaceAPI ready!");
    faceapi.detect(gotFace); // 開始偵測臉部
  });

  // 初始化 Handpose 模型
  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
  });
  handpose.on("predict", (results) => {
    hands = results; // 更新手部偵測結果
  });
}

function startGame() {
  gameStarted = true;
  startTime = millis(); // 記錄遊戲開始時間
  pickNewName();       // 選擇第一個名字

  // 啟動每秒更新一次的計時器
  gameInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(gameInterval); // 停止計時器
      endGame(); // 遊戲結束
    }
  }, 1000); // 每 1000 毫秒 (1 秒) 執行一次
}


function draw() {
  background(250); // 設定背景為淺色

  // 繪製攝影機影像
  image(video, 0, 0, width, height);

  // 如果遊戲還沒開始，只顯示開始畫面
  if (!gameStarted) {
    showStartScreen();
    return; // 不執行後續遊戲邏輯
  }

  // 計算方塊的脈動效果
  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  // 繪製人名方塊
  let boxY = height * 0.8; // 將方塊中心設置在畫面高度的 80% 處
  fill(255); // 白色背景
  stroke(0); // 黑色邊框
  rectMode(CENTER); // 矩形以中心點為準
  rect(width / 2, boxY, currentBoxSize, currentBoxSize / 2);

  // 繪製人名文字
  fill(0); // 黑色文字
  textSize(28);
  text(currentName, width / 2, boxY);

  // 繪製分數
  fill(0, 200, 0); // 綠色
  textSize(24);
  textAlign(LEFT, TOP); // 文字對齊方式：左上角
  text("分數: " + score, 10, 10);

  // 繪製計時器
  fill(0, 0, 200); // 藍色
  textSize(24);
  textAlign(RIGHT, TOP); // 文字對齊方式：右上角
  text("時間: " + max(0, timeLeft) + "s", width - 10, 10); // 確保時間不為負數

  // 繪製回饋訊息
  fill(255, 0, 0); // 紅色
  textAlign(CENTER, BOTTOM); // 文字對齊方式：置中，靠下
  textSize(22);
  text(feedback, width / 2, height - 10);

  // 繪製偵測到的臉部關鍵點 (用於除錯，可移除)
  // drawDetections();
  // 繪製偵測到的手部關鍵點 (用於除錯，可移除)
  // drawHands();

  // 顯示打勾或打叉的視覺回饋
  if (showCorrectionMark) {
    let elapsed = millis() - correctionMarkStartTime;
    if (elapsed < correctionMarkDuration) {
      correctionMarkAlpha = map(elapsed, 0, correctionMarkDuration, 255, 0); // 逐漸淡出
      push(); // 儲存當前繪圖設定
      translate(correctionMarkPosition.x, correctionMarkPosition.y);
      noFill();
      strokeWeight(5); // 粗一點的線條
      stroke(0, 0, 255, correctionMarkAlpha); // 藍色，帶透明度

      if (correctionMarkType === 'check') {
        // 繪製打勾
        line(-20, 0, 0, 20);
        line(0, 20, 40, -20);
      } else if (correctionMarkType === 'cross') {
        // 繪製打叉
        line(-20, -20, 20, 20);
        line(-20, 20, 20, -20);
      }
      pop(); // 恢復之前的繪圖設定
    } else {
      showCorrectionMark = false; // 隱藏標記
    }
  }

  // 判斷是否需要切換名字和檢查動作
  if (millis() - lastSwitchTime > switchInterval) {
    checkAction();
    pickNewName();
  }
}

// 遊戲結束函數
function endGame() {
  gameStarted = false; // 停止遊戲
  background(50); // 遊戲結束畫面背景
  fill(255);
  textSize(48);
  text("遊戲結束！", width / 2, height / 2 - 50);
  textSize(32);
  text("最終分數: " + score, width / 2, height / 2 + 20);
  textSize(20);
  text("點擊重新開始", width / 2, height / 2 + 80);
  
  // 重置遊戲狀態
  score = 0;
  timeLeft = 60;
  feedback = "";
  detections = [];
  hands = [];
}

// 選擇新名字
function pickNewName() {
  currentName = random(nameList);
  lastSwitchTime = millis(); // 更新切換時間
  feedback = ""; // 清空之前的提示訊息
}

// 處理臉部偵測結果
function gotFace(err, result) {
  if (result) {
    detections = result;
  }
  // 每次偵測到臉部後，繼續下一輪偵測
  faceapi.detect(gotFace);
}

// 檢查玩家動作並更新分數和回饋
function checkAction() {
  let correctAction = false; // 判斷玩家動作是否正確

  // 偵測到臉部或手部才進行判斷
  if (detections.length === 0 && hands.length === 0) {
      feedback = "偵測中...請對準攝影機！";
      return;
  }

  // 判斷是否為教科老師
  const isCurrentTeacher = teacherList.includes(currentName);

  if (isCurrentTeacher) {
    // 如果是教科老師，期望嘟嘴
    if (isPouting()) {
      feedback = "😘 成功親到老師！";
      correctAction = true;
      score += (currentName === "陳慶帆" ? 2 : 1); // 陳慶帆加2分，其他老師加1分
    } else {
      feedback = "😗 嘟嘴嘟嘴才是愛老師的方式！";
      score -= (currentName === "陳慶帆" ? 3 : 1); // 陳慶帆減3分，其他老師減1分
    }
  } else {
    // 如果不是教科老師，期望比讚
    if (isThumbsUp()) {
      feedback = "👍 這不是老師，給他個讚！";
      correctAction = true;
      score += 1; // 不是老師都加1分
    } else {
      feedback = "👎 這時候要比個讚啦～";
      score -= 1; // 不是老師都減1分
    }
  }

  // 處理視覺回饋 (打勾或打叉)
  if (detections.length > 0) {
    // 假設打勾打叉顯示在頭部上方
    let faceCenter = detections[0].parts.nose[0]; // 鼻子位置作為臉部中心參考
    correctionMarkPosition = createVector(faceCenter._x, faceCenter._y - 50); // 稍微往上移
    correctionMarkType = correctAction ? 'check' : 'cross';
    showCorrectionMark = true;
    correctionMarkStartTime = millis(); // 記錄開始顯示時間
  } else if (hands.length > 0) { // 如果只偵測到手，沒有臉
    let wrist = hands[0].landmarks[0]; // 手腕作為參考
    correctionMarkPosition = createVector(wrist[0], wrist[1] - 50);
    correctionMarkType = correctAction ? 'check' : 'cross';
    showCorrectionMark = true;
    correctionMarkStartTime = millis();
  }
}

// 判斷是否為嘟嘴動作
function isPouting() {
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    let topLip = mouth[13]; // 上唇中點偏上
    let bottomLip = mouth[19]; // 下唇中點偏下

    if (topLip && bottomLip) {
      let d = dist(topLip._x, topLip._y, bottomLip._x, bottomLip._y);
      // 嘟嘴的距離判斷可能需要微調，這裡給一個參考值
      // 通常嘴唇越嘟，上下唇的距離會越小
      return d < 12 && d > 3; // 避免距離為0 (嘴巴閉合) 和距離過大
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
      // 簡單判斷：指尖Y座標大於指關節Y座標，表示手指是彎曲的
      let indexCurled = indexTip[1] > landmarks[6][1]; // 食指
      let middleCurled = middleTip[1] > landmarks[10][1]; // 中指
      let ringCurled = ringTip[1] > landmarks[14][1];   // 無名指
      let pinkyCurled = pinkyTip[1] > landmarks[18][1]; // 小指

      let allFingersCurled = indexCurled && middleCurled && ringCurled && pinkyCurled;
      
      // 3. 確保拇指和食指之間有足夠的角度 (防止只是把手伸直)
      // 這可以用拇指和食指的向量點積來判斷，或者簡單判斷它們在X軸上的相對位置
      // 假設拇指在食指的左側 (對於右手)
      let thumbAsideIndex = thumbTip[0] < indexTip[0]; // 拇指X小於食指X

      return thumbIsUp && allFingersCurled && thumbAsideIndex;
    }
  }
  return false;
}

// 繪製臉部偵測結果 (用於除錯，可移除)
function drawDetections() {
  for (let i = 0; i < detections.length; i++) {
    const detection = detections[i];
    // 繪製臉部框
    noFill();
    stroke(161, 95, 251);
    strokeWeight(2);
    let box = detection.box;
    rect(box.x, box.y, box.width, box.height);

    // 繪製臉部關鍵點
    noStroke();
    fill(161, 95, 251);
    for (let j = 0; j < detection.landmarks.length; j++) {
      let p = detection.landmarks[j];
      ellipse(p._x, p._y, 5, 5);
    }
    // 繪製嘴巴關鍵點
    fill(255, 0, 0); // 紅色
    if (detection.parts && detection.parts.mouth) {
        for (let p of detection.parts.mouth) {
            ellipse(p._x, p._y, 5, 5);
        }
    }
  }
}

// 繪製手部偵測結果 (用於除錯，可移除)
function drawHands() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.landmarks.length; j++) {
      let landmark = hand.landmarks[j];
      fill(0, 255, 0); // 綠色
      noStroke();
      ellipse(landmark[0], landmark[1], 10, 10);
    }
    // 連接手部骨架 (可選)
    stroke(0, 255, 0);
    strokeWeight(2);
    // 拇指
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[1][0], hand.landmarks[1][1]);
    line(hand.landmarks[1][0], hand.landmarks[1][1], hand.landmarks[2][0], hand.landmarks[2][1]);
    line(hand.landmarks[2][0], hand.landmarks[2][1], hand.landmarks[3][0], hand.landmarks[3][1]);
    line(hand.landmarks[3][0], hand.landmarks[3][1], hand.landmarks[4][0], hand.landmarks[4][1]);
    // 食指
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[5][0], hand.landmarks[5][1]);
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
    line(hand.landmarks[0][0], hand.landmarks[0][1], hand.landmarks[9][0], hand.landmarks[9][1]);
    line(hand.landmarks[9][0], hand.landmarks[9][1], hand.landmarks[13][0], hand.landmarks[13][1]);
    line(hand.landmarks[13][0], hand.landmarks[13][1], hand.landmarks[17][0], hand.landmarks[17][1]);
    line(hand.landmarks[17][0], hand.landmarks[17][1], hand.landmarks[0][0], hand.landmarks[0][1]);
  }
}
