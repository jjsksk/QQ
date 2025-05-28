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

  // 初始化攝影機，只呼叫一次
  video = createCapture(VIDEO, () => {
    console.log("攝影機成功啟動！");
  });
  video.size(width, height);
  video.hide();

  // 初始化 FaceAPI
  faceapi = ml5.faceApi(video, { withLandmarks: true, withDescriptors: false }, () => {
    console.log("FaceAPI ready!");
    faceapi.detect(gotFace);
  });

  // 初始化 Handpose
  handpose = ml5.handpose(video, () => {
    console.log("Handpose model ready!");
  });
  handpose.on("predict", (results) => {
    hands = results;
  });

  pickNewName();
}

function draw() {
  image(video, 0, 0, width, height);

  // 動畫效果：名字方框跳動
  boxPulse = sin(frameCount * 0.05) * 10;
  let currentBoxSize = boxSize + boxPulse;

  // 顯示名字框
  fill(255);
  stroke(0);
  rectMode(CENTER);
  rect(width / 2, height / 2, currentBoxSize, currentBoxSize / 2);

  // 顯示名字文字
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(28);
  text(currentName, width / 2, height / 2);

  // 分數顯示
  fill(0, 200, 0);
  textSize(18);
  textAlign(LEFT);
  text("Score: " + score, 10, 25);

  // 回饋提示
  fill(255, 0, 0);
  textAlign(CENTER);
  textSize(22);
  text(feedback, width / 2, height - 40);

  // 每3秒切換題目並評分
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
  if (teacherList.includes(currentName)) {
    if (isPouting()) {
      feedback = "😘 成功親到老師！+1分";
      score++;
    } else {
      feedback = "😗 嘟嘴嘟嘴才是愛老師的方式！";
    }
  } else {
    if (isThumbsUp()) {
      feedback = "👍 這不是老師，給他個讚！+1分";
      score++;
    } else {
      feedback = "👎 這時候要比個讚啦～";
    }
  }
}

function isPouting() {
  if (detections.length > 0) {
    let mouth = detections[0].parts.mouth;
    let topLip = mouth[13];
    let bottomLip = mouth[19];
    let d = dist(topLip._x, topLip._y, bottomLip._x, bottomLip._y);
    return d < 10; // 嘟嘴嘴唇靠近
  }
  return false;
}

function isThumbsUp() {
  if (hands.length > 0) {
    let landmarks = hands[0].landmarks;
    let thumbTip = landmarks[4];
    let indexTip = landmarks[8];
    let middleTip = landmarks[12];
    let ringTip = landmarks[16];
    let pinkyTip = landmarks[20];

    let thumbUp = thumbTip[1] < indexTip[1] &&
                  middleTip[1] > indexTip[1] &&
                  ringTip[1] > indexTip[1] &&
                  pinkyTip[1] > indexTip[1];
    return thumbUp;
  }
  return false;
}
