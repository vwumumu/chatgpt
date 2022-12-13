// Import Key
const { CLIENT_CONFIG, API_KEY } = require("./constants");

// Import modules
const request = require("request");
const { MixinSocket } = require("mixin-node-sdk");
// const datetime = require("datetime");

// New object
const socketClient = new MixinSocket(CLIENT_CONFIG, true, true);

// Variables
const MODEL = "text-davinci-003";
// const MODEL = "text-curie-001";
const API_URL = "https://api.openai.com/v1/completions";
let counter = 300;
let requests = 0;

let workList = {};
const vipList = ["cbb20923-9020-490a-b8f6-e816883c9c99"];

// Message handling
socketClient.get_message_handler = async function (message) {
  // Read message
  await this.read_message(message);

  // Error handling
  if (
    !message.action ||
    message.action === "ACKNOWLEDGE_MESSAGE_RECEIPT" ||
    message.action === "LIST_PENDING_MESSAGES" ||
    !message.data ||
    !message.data.data
  ) {
    return;
  }

  if (message.error) return console.log(message.error);

  // console.log(message);
  // Get input
  const TEXT = message.data.parseData;
  if (TEXT) {
    requests += 1;
    console.log("收到用户查询次数：", requests);
  }

  const user_id = message.data.user_id;

  if (!workList.hasOwnProperty(user_id)) {
    workList[user_id] = 20;
    // console.log(workList);
    if (vipList.includes(user_id)) {
      workList[user_id] = 60;
    }
  }

  // console.log(workList);

  // Post input to OpenAI
  const options = {
    method: "POST",
    url: API_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    json: {
      prompt: TEXT,
      max_tokens: 1024,
      temperature: 0.6,
      model: MODEL,
      user: message.data.user_id,
    },
  };

  // Request and Output handling
  if (workList[user_id] > 0 && counter > 0) {
    if (message.data.category === "PLAIN_TEXT") {
      const self = this;
      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const q = message.data.parseData;
          const a = body.choices[0].text.replace(/\n[\n]+/g, "");
          // const result = "Q: " + q + "\n" + "A: " + a;
          const result = a + "\n" + "[" + workList[user_id] + "]";
          self.send_text(result, message);
        } else {
          console.error(error);
        }
      });
    } else {
      await this.send_text("Not text", message);
    }
    counter -= 1;
    console.log("总查询次数剩余：", counter);
    workList[user_id] -= 1;
    // this.send_text(
    //   "今日您的可用总查询次数还剩余: " + workList[user_id] + " 次。",
    //   message
    // );
  } else if (counter === 0) {
    await this.send_text("机器人总对话次数已用完，将在02：00重置。", message);
  } else {
    await this.send_text("每天只能和我对话20次，将在02：00重置。", message);
    console.log(user_id, "今日次数已用尽。");
  }
};

// 设置每天0点重置计数
setInterval(function () {
  // 获取当前时间
  let date = new Date();
  // 如果当前时间是0点
  if (
    date.getHours() === 2 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    // 重置计数
    console.log("今日用户统计");
    console.log(workList);
    counter = 300;
    requests = 0;
    workList = {};
    console.log("总可用次数已重置。");
  }
}, 1000);

socketClient.start();
