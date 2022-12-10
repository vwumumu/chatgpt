const CLIENT_CONFIG = {
  client_id: "65334040-1fd0-4142-98ce-4fbd0e81aaab",
  client_secret: "d9dc58107xxxxxxxxxxxxxxxxxx",
  pin: "415447",
  session_id: "8ca9dc89-5d26-4dc4-8a35-5afdd027a4dc",
  pin_token: "tDs2MunwyNb8l_i9VDmSKgUIkIr69lIUPDgAgeUQxyA",
  private_key:
    "1TwZvIRmNGXW2wO92BoZaH5wcKMGzHcRBcOdYljP-6Biqes4_9ipMsN9v_kG2nmh-YGrxl53X2DlzcGA_4NLwQ",
};

const API_KEY = "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";

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
    },
  };

  if (message.data.category === "PLAIN_TEXT") {
    const self = this;
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        const result = body.choices[0].text.replace(/\n[\n]+/g, "");
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
