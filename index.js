// Import Key
const { CLIENT_CONFIG, API_KEY } = require("./constants");

// Import modules
const request = require("request");
const { MixinSocket } = require("mixin-node-sdk");

// New object
const socketClient = new MixinSocket(CLIENT_CONFIG, true, true);

// Variables
const MODEL = "text-davinci-003";
const API_URL = "https://api.openai.com/v1/completions";
let counter = 3000;

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

  // Get input
  const TEXT = message.data.parseData;

  // Handle input
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
  if (counter > 0) {
    if (message.data.category === "PLAIN_TEXT") {
      const self = this;
      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const q = message.data.parseData;
          const a = body.choices[0].text.replace(/\n[\n]+/g, "");
          const result = "Q: " + q + "\n" + "A: " + a;
          self.send_text(result, message);
        } else {
          console.error(error);
        }
      });
    } else {
      await this.send_text("Not text", message);
    }
    counter -= 1;
    this.send_text(
      "今日我的可用总查询次数还剩余 " + counter + " 次。",
      message
    );
  } else {
    await this.send_text(
      "感谢您的关注，今天的能源已经耗尽了，我们明天再见！Have a good day!",
      message
    );
  }
};

socketClient.start();
