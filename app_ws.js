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
const FILE_ID = "665319803554";

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
// 必ずしもそうする必要は無いが、ここではブラウザとHeroku間をWebsocketでつないでいる。
// Websocketの中で、Heroku ⇔ Box APIを、Long Pollingでつなぐ。
// ブラウザ ⇔ （Websocket）⇔ Heroku App ⇔ （Long Polling） ⇔ BOX API
wss.on("connection", async (ws) => {
  // ブラウザとHerokuの間のWebsocketのハンドリング

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
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`express started on port ${server.address().port}`);
});
