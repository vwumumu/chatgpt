const { CLIENT_CONFIG, API_KEY } = require("./constants");

const request = require("request");
const { MixinSocket } = require("mixin-node-sdk");

const socketClient = new MixinSocket(CLIENT_CONFIG, true, true);

const MODEL = "text-davinci-003";
const API_URL = "https://api.openai.com/v1/completions";

socketClient.get_message_handler = async function (message) {
  await this.read_message(message);

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

  const TEXT = message.data.parseData;

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
};

socketClient.start();
