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
let score = 0; // 確保 score 初始值為 0

let boxSize = 200;
let boxPulse = 0;

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO, videoReady);
  video.size(width, height);
  video.hide();
}

function videoReady() {
  console.log("攝影機成功啟動！");

  faceapi = ml5.faceApi(video, { withLandmarks: true, withDescriptors: false }, () => {
    console.log("FaceAPI ready!");
    faceapi.detect(gotFace);
  });

  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
  });
  handpose.on("predict", (results) => {
    hands = results;
  });

  pickNewName();
}

function draw() {
  background(250);
  image(video, 0, 0, width, height);

  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  // 調整人名方塊的位置到畫面下方一些
  let boxY = height * 0.8; // 將方塊中心設置在畫面高度的 80% 處

  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, boxY, currentBoxSize, currentBoxSize / 2); // 方塊中心 Y 座標改為 boxY

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(28);
  text(currentName, width / 2, boxY); // 文字的 Y 座標也跟著方塊移動

  // 得分顯示
  fill(0, 200, 0); // 綠色
  textSize(24); // 調整文字大小，可能更容易看到
  textAlign(LEFT, TOP); // 文字對齊方式：左上角
  text("分數: " + score, 10, 10); // 顯示在畫布左上角，X=10, Y=10

  // 訊息回饋顯示
  fill(255, 0, 0); // 紅色
  textAlign(CENTER, BOTTOM); // 文字對齊方式：置中，靠下
  textSize(22);
  text(feedback, width / 2, height - 10); // 顯示在畫布底部，Y=height-10

  // 每隔 3 秒 (180 幀) 檢查一次動作並切換名字
  // (假設 frameRate 是 60 幀/秒，180 幀就是 3 秒)
  if (frameCount - lastSwitchFrame > 180) {
    checkAction();
    pickNewName();
  }
}

function pickNewName() {
  currentName = random(nameList);
  lastSwitchFrame = frameCount;
  feedback = "";
}

function gotFace(err, result) {
  if (result) {
    detections = result;
  }
  faceapi.detect(gotFace);
}

function checkAction() {
  // 檢查是否有足夠的偵測數據才進行判斷
  if (detections.length === 0 && hands.length === 0) {
      feedback = "偵測中...請對準攝影機！";
      return; // 如果沒有偵測到臉或手，不執行後續判斷
  }

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
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    let topLip = mouth[13];
    let bottomLip = mouth[19];
    if (topLip && bottomLip) {
      let d = dist(topLip._x, topLip._y, bottomLip._x, bottomLip._y);
      // 嘟嘴的距離判斷可能需要微調，這裡給一個參考值
      return d < 10;
    }
  }
  return false;
}

function isThumbsUp() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    if (landmarks.length >= 21) {
      let thumbTip = landmarks[4];
      let indexTip = landmarks[8];
      let middleTip = landmarks[12];
      let ringTip = landmarks[16];
      let pinkyTip = landmarks[20];

      // 判斷比讚手勢的邏輯 (拇指向上，其他手指彎曲)
      // 檢查拇指尖 Y 座標是否顯著低於其他指尖 Y 座標 (在圖片座標系中，Y 值越小越往上)
      let thumbUp = thumbTip[1] < indexTip[1] &&
                      thumbTip[1] < middleTip[1] &&
                      thumbTip[1] < ringTip[1] &&
                      thumbTip[1] < pinkyTip[1];
      
      // 並且確保其他四指是「彎曲」狀態 (例如，指尖Y座標大於指關節Y座標)
      // 這裡只做簡化判斷，更精確需要更多判斷，但這個應該能初步判斷
      let fingersCurled = indexTip[1] > landmarks[6][1] && // 食指尖 Y > 食指中關節 Y
                          middleTip[1] > landmarks[10][1] && // 中指尖 Y > 中指中關節 Y
                          ringTip[1] > landmarks[14][1] && // 無名指尖 Y > 無名指中關節 Y
                          pinkyTip[1] > landmarks[18][1]; // 小指尖 Y > 小指中關節 Y

      // 結合拇指向上和其他手指彎曲的判斷
      return thumbUp && fingersCurled;
    }
  }
  return false;
}
