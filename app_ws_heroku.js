const express = require("express");
const http = require("http");
const boxSDK = require("box-node-sdk");
const config = require("./config.json");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set("views", ".");
app.set("view engine", "ejs");

const USER_ID = "12771965844";
const FILE_ID = "665684799499";
// file id=665319803554 name=Sample.docx
// file id=665684799499 name=Sample.pptx
// file id=665697846539 name=Sample.xlsx

const sdk = boxSDK.getPreconfiguredInstance(config);
const auClient = sdk.getAppAuthClient("user", USER_ID);

app.get("/", async (req, res) => {
  // トークンをダウンスコープする。
  // ここでは、OpenWithで必要なものと、Previewで必要なものを両方スコープにいれてトークンをダウンスコープする
  const downToken = await auClient.exchangeToken(
    [
      "item_execute_integration",
      "item_readwrite",
      "item_preview",
      "root_readwrite",
    ],
    `https://api.box.com/2.0/folders/0`
  );

  // テンプレートにパラメータを渡して、HTMLを返す
  res.render("index", {
    fileId: FILE_ID,
    token: downToken.accessToken,
  });
});

// Boxで、ファイルが変更されたことを、ロングポーリングを使って検知し、フロントエンドに通知する。
// 必ずしもそうする必要は無いが、ブラウザとHeroku間をWebsocketでつなぐ。
// Websocketの中で、Heroku ⇔ Box APIを、Long Pollingでつなぐ。
// ブラウザ ⇔ （Websocket）⇔ Heroku App ⇔ （Long Polling） ⇔ BOX API
wss.on("connection", async (ws) => {
  // ブラウザとHerokuの間のWebsocketのハンドリング
  // Herokuではロングポーリングは55秒で強制的に止められるので、setTimeoutをつかって45秒毎につなぎ直している。
  // 単純なポーティングよりマシだが、本当に更新検知が必要な場合は、インフラにHeorkuを使わないほうがいいと思う。
  let pollingTimer;
  async function longPolling() {
    // Boxのロングポーリングイベント監視
    // ロングポーリングはAppUserのトークンで行う必要がある
    const stream = await auClient.events.getEventStream();

    // ロングポーリングからデータを受け取ったときの処理
    stream.on("data", (event) => {
      // 更新されたことを、event_typeで判定（プレビューの場合などもイベントが来る）
      if (event.event_type && event.event_type === "ITEM_UPLOAD") {
        // クライアントに更新を通知。ここでは簡易的にupdatedという文字列を返している。
        wss.clients.forEach((client) => {
          client.send("updated");
        });
      }
    });

    // 45秒たったら、もう一度ロングポーリングをつなぎ直す
    pollingTimer = setTimeout(longPolling, 45000);
  }
  // setTimeoutは初回は即座に実行されないので、初回分だけ実行しておく。
  longPolling();

  // ブラウザとHerokuの間のWSも、Herokuは55秒でシャットダウンしてしまうので、pingだけ飛ばしておく。
  // Heorkuのようなインフラを使わないのであれば不要
  const pingTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      client.send("ping");
    });
  }, 45000);

  // ブラウザが閉じられたとき、無駄な再接続を止める
  ws.on("close", () => {
    // ブラウザへのpingを止める
    clearInterval(pingTimer);
    // Boxへのロングポーリングを止める
    clearTimeout(pollingTimer);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`express started on port ${server.address().port}`);
});
