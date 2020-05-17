const express = require("express");
const boxSDK = require("box-node-sdk");
const config = require("./config.json");

const app = express();

app.set("views", ".");
app.set("view engine", "ejs");

/**
 * setup.jsで作成したファイルとユーザー
 */

const USER_ID = "12771965844";
const FILE_ID = "665319803554";

app.get("/", async (req, res) => {
  try {
    const sdk = await boxSDK.getPreconfiguredInstance(config);
    // AppUserの権限でClientオブジェクトを作成
    const auClient = await sdk.getAppAuthClient("user", USER_ID);

    // トークンをダウンスコープする
    // APIリファレンスには載っていないが、UI Elementsの説明には書いてあるAPI
    // ここでは、OpenWithで必要なものと、Previewで必要なものを両方スコープにいれてトークンをダウンスコープする
    const downToken = await auClient.exchangeToken(
      ["item_execute_integration", "item_readwrite", "item_preview"],
      `https://api.box.com/2.0/files/${FILE_ID}`
    );

    // テンプレートにパラメータを渡して、HTMLを返す
    res.render("index", {
      fileId: FILE_ID,
      token: downToken.accessToken,
    });
  } catch (e) {
    console.error(e.toString());
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`express started on port ${port}`);
});
