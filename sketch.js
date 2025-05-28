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

  video = createCapture(VIDEO, () => {
    console.log("攝影機成功啟動！");
  });
  video.size(width, height);
  video.hide();

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
  if (detections.length > 0 && detections[0].parts && detections[0].parts.mouth) {
    let mouth = detections[0].parts.mouth;
    let topLip = mouth[13];
    let bottomLip = mouth[19];
    if (topLip && bottomLip) {
      let d = dist(topLip._x, topLip._y, bottomLip._x, bottomLip._y);
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

      let thumbUp = thumbTip[1] < indexTip[1] &&
                    middleTip[1] > indexTip[1] &&
                    ringTip[1] > indexTip[1] &&
                    pinkyTip[1] > indexTip[1];
      return thumbUp;
    }
  }
  return false;
}
