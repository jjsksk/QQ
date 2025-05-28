let video;
let faceapi;
let detections = [];
let handpose;
let hands = [];

let nameList = [
  "顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴",
  "馬嘉祺", "丁程鑫", "宋亞軒", "劉耀文", "張真源", "嚴浩翔", "賀峻霖"
];
let teacherList = ["顧大維", "何俐安", "黃琪芳", "林逸農", "徐唯芝", "陳慶帆", "賴婷鈴"];
let currentName = "";
let lastSwitchFrame = 0;
let feedback = "";
let score = 0;

let boxSize = 200;
let boxPulse = 0;

function setup() {
  createCanvas(640, 480);

  // 1. 先嘗試啟動攝影機
  video = createCapture(VIDEO, videoReady); // 當攝影機準備好時，會呼叫 videoReady 函數
  video.size(width, height);
  video.hide();

  // 2. 在 videoReady 函數中初始化 FaceAPI 和 Handpose
  // 這樣能確保模型在攝影機影像載入後才開始運作
  // pickNewName() 也會移動到 videoReady 中，確保遊戲在攝影機準備好後才開始
}

// 這個函數會在攝影機成功啟動時被呼叫
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

  // 攝影機和模型都準備好後，選擇第一個名字並開始遊戲
  pickNewName();
}


function draw() {
  background(250);
  image(video, 0, 0, width, height);

  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, height / 2, currentBoxSize, currentBoxSize / 2);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(28);
  text(currentName, width / 2, height / 2);

  fill(0, 200, 0);
  textSize(18);
  textAlign(LEFT);
  text("Score: " + score, 10, 25);

  fill(255, 0, 0);
  textAlign(CENTER);
  textSize(22);
  text(feedback, width / 2, height - 40);

  // 每隔 3 秒 (180 幀) 檢查一次動作並切換名字
  if (frameCount - lastSwitchFrame > 180) {
    checkAction();
    pickNewName();
  }
}

function pickNewName() {
  currentName = random(nameList);
  lastSwitchFrame = frameCount;
  feedback = ""; // 清空之前的提示訊息
}

function gotFace(err, result) {
  if (result) {
    detections = result;
  }
  // 每次偵測到臉部後，繼續下一輪偵測
  faceapi.detect(gotFace);
}

function checkAction() {
  if (teacherList.includes(currentName)) {
    // 如果是教科老師
    if (isPouting()) {
      feedback = "😘 成功親到老師！+1分";
      score++;
    } else {
      feedback = "😗 嘟嘴嘟嘴才是愛老師的方式！";
    }
  } else {
    // 如果不是教科老師
    if (isThumbsUp()) {
      feedback = "👍 這不是老師，給他個讚！+1分";
      score++;
    } else {
      feedback = "👎 這時候要比個讚啦～";
    }
  }
}

function isPouting() {
  // 檢查是否有臉部偵測結果且有嘴巴部位
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    // 嘴唇的上方點和下方點 (這些索引是根據 ml5.faceApi 返回的臉部關鍵點結構)
    let topLip = mouth[13]; // 通常是上唇中點偏上
    let bottomLip = mouth[19]; // 通常是下唇中點偏下
    
    if (topLip && bottomLip) {
      // 計算上唇和下唇之間的距離
      let d = dist(topLip._x, topLip._y, bottomLip._x, bottomLip._y);
      // 如果距離很小，表示嘴巴可能嘟起來了
      return d < 10; // 這個閾值可能需要根據實際測試調整
    }
  }
  return false;
}

function isThumbsUp() {
  // 檢查是否有手部偵測結果
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks; // 取第一隻手的手部關鍵點
    if (landmarks.length >= 21) { // 確保有完整 21 個關鍵點
      // 手指關鍵點的索引 (拇指指尖、食指指尖等)
      let thumbTip = landmarks[4];
      let indexTip = landmarks[8];
      let middleTip = landmarks[12];
      let ringTip = landmarks[16];
      let pinkyTip = landmarks[20];

      // 判斷是否為比讚手勢：
      // 拇指尖Y座標高於食指尖Y座標 (拇指向上)
      // 其他三指尖Y座標低於食指尖Y座標 (其他三指彎曲或向下)
      let thumbUp = thumbTip[1] < indexTip[1] &&  // 拇指尖 Y 座標小於食指尖 (表示拇指比食指高)
                      middleTip[1] > indexTip[1] && // 中指尖 Y 座標大於食指尖 (表示中指比食指低)
                      ringTip[1] > indexTip[1] &&   // 無名指尖 Y 座標大於食指尖
                      pinkyTip[1] > indexTip[1];    // 小指尖 Y 座標大於食指尖
      return thumbUp;
    }
  }
  return false;
}
