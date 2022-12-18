//import module
const { BlazeClient } = require("mixin-node-sdk");
const { writeFile } = require("fs");
const request = require("request");
//import constants
const config = require("../config.json");

//new client
const client = new BlazeClient(config, { parse: true, syncAck: true });

//global constants
let totalLimit = 3;
let userLimit = 2;
let workList = {};

//ws
client.loopBlaze({
  onMessage(msg) {
    query(msg);
    sendHelpMsgWithInfo(msg);
    handleClaim(msg);
    handleDonate(msg);
  },
  onTransfer(msg) {
    // console.log(msg);
    if (msg.data.asset_id === config.cnb_asset_id && msg.data.amount >= 2.99) {
      addLifecycle(msg, 30);
    }
  },
  onAckReceipt() {},
});

setInterval(() => {
  reset();
}, 1000);

//funcionts
function updateLifecycle() {
  const vipList = require("../viplist.json");
  const vipList_path = "./viplist.json";
  console.log(vipList);
  for (let key in vipList) {
    let value = vipList[key];
    for (let innerKey in value) {
      let innerValue = value[innerKey];
      value[innerKey] = innerValue - 1;
    }
  }
  console.log(vipList);
  writeFile(vipList_path, JSON.stringify(vipList, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log(
      "updateLifecycle(): Lifecycle updated successfully to VIP List"
    );
  });
}

async function addLifecycle({ user_id }, lifeCycle) {
  const vipList = require("../viplist.json");
  let donateList = require("../donate.json");
  const vipList_path = "./viplist.json";
  const donate_path = "./donate.json";
  if (!vipList.hasOwnProperty(user_id)) {
    vipList[user_id] = { lifeCycle: 0 };
  }
  for (let key in vipList) {
    console.log(key);
    if (user_id === key) {
      // console.log(vipList[key]["lifeCycle"]);
      vipList[key]["lifeCycle"] += lifeCycle;
      // console.log(vipList[key]["lifeCycle"]);
    }
  }
  console.log(vipList);
  writeFile(vipList_path, JSON.stringify(vipList, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("addLifecycle(): Lifecycle updated successfully to VIP List");
  });

  console.log(donateList);
  donateList[new Date()] = user_id;
  console.log(donateList);
  writeFile(donate_path, JSON.stringify(donateList, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("DonateList updated successfully");
  });
  workList[user_id] = totalLimit;
  await client.sendMessageText(
    user_id,
    `感谢您的支持，您当前的无限制使用天数为：${vipList[user_id]["lifeCycle"]}天。`
  );
}

function generateWorkinglist(user_id) {
  const vipList = require("../viplist.json");
  if (!workList.hasOwnProperty(user_id)) {
    workList[user_id] = userLimit;
    // console.log(workList);
    for (let key in vipList) {
      if (vipList[key]["lifeCycle"] > 0 && user_id === key) {
        workList[user_id] = totalLimit;
      }
    }
  }
  console.log(workList);
  return workList;
}

function query({ user_id, data, category }) {
  const workList = generateWorkinglist(user_id);
  // console.log(user_id, data, category);
  // console.log(workList);
  const API_URL = "https://api.openai.com/v1/completions";
  const MODEL = "text-davinci-003";

  const options = {
    method: "POST",
    url: API_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.API_KEY}`,
    },
    json: {
      prompt: data,
      max_tokens: 1024,
      temperature: 0.6,
      model: MODEL,
      user: user_id,
    },
  };

  // Request and Output handling
  if (workList[user_id] > 0 && totalLimit > 0) {
    if (
      category === "PLAIN_TEXT" &&
      data !== "/?" &&
      data !== "/？" &&
      data !== "/donate" &&
      data !== "/claim"
    ) {
      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const a = body.choices[0].text.replace(/\n[\n]+/g, "");
          // const result = "Q: " + q + "\n" + "A: " + a;
          let result;
          if (workList[user_id] > userLimit) {
            result = a;
          } else {
            result = `${a}\n[${workList[user_id] - 1}]`;
          }
          client.sendMessageText(user_id, result);
          totalLimit -= 1;
          console.log("总查询次数剩余：", totalLimit);
          workList[user_id] -= 1;
        } else {
          console.error(error);
        }
      });
    } else if (
      category !== "PLAIN_TEXT" &&
      data !== "/?" &&
      data !== "/？" &&
      data !== "/donate" &&
      data !== "/claim"
    ) {
      client.sendMessageText(user_id, "仅支持文字内容，发送/?了解更多。");
    }

    console.log(workList);
  } else if (
    totalLimit === 0 &&
    data !== "/?" &&
    data !== "/？" &&
    data !== "/donate" &&
    data !== "/claim"
  ) {
    client.sendMessageText(user_id, "已达总次数限制，将在02：00重置。");
  } else if (
    workList[user_id] === 0 &&
    data !== "/?" &&
    data !== "/？" &&
    data !== "/donate" &&
    data !== "/claim"
  ) {
    client.sendMessageText(user_id, "已达次数限制，发送/?了解更多。");
    console.log(user_id, "今日次数已用尽。");
  }
}

async function handleClaim({ data, user_id }) {
  const trace_id = client.uniqueConversationID(
    user_id + config.client_id,
    new Date().toDateString()
  ); // 用户这个用户今天唯一的 trace_id
  const transfer = await client.readTransfer(trace_id); // 查询今天是否领取过
  if (data === "/claim") {
    if (transfer && transfer.snapshot_id) {
      // 已经领取
      await client.sendMessageText(user_id, "您今日已领取，请明日再来。");
    } else {
      // 否则的话给用户转 1 cnb
      await client.transfer({
        trace_id,
        asset_id: config.cnb_asset_id,
        amount: "1",
        opponent_id: user_id,
      });
    }
  }
}

async function handleDonate({ data, user_id }) {
  if (data === "/donate") {
    const uuid = client.newUUID();
    console.log(uuid);
    client.sendAppButtonMsg(
      // 给用户发送 donate 的 button
      user_id,
      [
        {
          label: `点击向我打赏`,
          action: `mixin://pay?asset=${config.cnb_asset_id}&amount=2.99&memo=%E5%90%91%E6%88%91%E6%89%93%E8%B5%8F&recipient=${config.client_id}&trace=${uuid}`,
          color: "#FF1493",
        },
      ]
    );
  }
}

async function sendHelpMsgWithInfo({ user_id, data }) {
  // 发送帮助消息
  const helpMsg = `
  首先，感谢您的支持，这个项目从一开始就可以确定是很难高付费的，贵了也就没人用了，所以出发点主要是为了方便大家在Mixin中使用ChatGPT方便。
  但是，ChatGPT在后台是按字数收费的，所以为了能够持续让运行下去让更多的人免费使用，做了一些限制，说明如下：

  1. 考虑到防止滥用、运行成本，每位用户24小时内限制使用15次，2：00重置使用次数，对于绝大部分用户不会天天超过15次查询；
  2. 如果您觉得本项目为您带来了方便，也愿意共担一些运行成本，欢迎打赏，请发送 /donate 或点击打赏；
  3. 打赏金额设置为了2.99 USDT，为了表示对您的感谢，打赏用户将获得30天内的24小时内无限次使用，但受总次数限制；
  4. 本应用总请求限制为每日1000次，2：00重置，根据目前的统计，可以满足大家使用；
  5. 为了维持一定的活跃度，本应用支持每日领取 1CNB 作为感谢，请发送 /claim 或点击签到；

  本人开发新手，程序如有不健壮之处，还请多多包涵，再次感谢大家的支持，如上述内容有调整，将对外公示。
  
  成本：
  1.调用OpenAI API是按问+答字数收费；
  2.运行程序需要的服务器费用；
  3.维护成本；
  `;
  if (data === "/?" || data === "/？") {
    await Promise.all([
      client.sendTextMsg(user_id, helpMsg),
      client.sendAppButtonMsg(user_id, [
        { label: "签到", action: "input:/claim", color: "#FF1493" },
        { label: "打赏", action: "input:/donate", color: "#FF1493" },
      ]),
    ]);
  }
}

function reset() {
  let date = new Date();
  if (
    date.getHours() === 2 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    console.log("今日用户统计:", workList);
    totalLimit = 1000;
    // userLimit = 0;
    workList = {};
    updateLifecycle();
    console.log("总可用次数已重置。");
  }
}
