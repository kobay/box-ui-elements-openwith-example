const boxSDK = require("box-node-sdk");
const config = require("./config.json");
const axios = require("axios");
const fs = require("fs");

const USER_ID = "12771965844";

const main = async () => {
  const sdk = boxSDK.getPreconfiguredInstance(config);
  const saClient = sdk.getAppAuthClient("enterprise");

  // 前回作成したAppUserを更新
  // G Suiteを使いたい場合は、external_app_user_idに、G SuiteのE-mailアドレスを登録しておく必要がある。\
  const appUser = await saClient.users.update(USER_ID, {
    external_app_user_id: "yourname@example.com",
  });
  console.log(appUser);

  // ファイル追加
  saClient.asUser(appUser.id);
  {
    const stream = fs.createReadStream("./Sample.pptx");
    const files = await saClient.files.uploadFile("0", "Sample.pptx", stream);
    const file = files.entries[0];
    console.log(`file id=${file.id} name=${file.name}`);
  }
  {
    const stream = fs.createReadStream("./Sample.xlsx");
    const files = await saClient.files.uploadFile("0", "Sample.xlsx", stream);
    const file = files.entries[0];
    console.log(`file id=${file.id} name=${file.name}`);
  }
  saClient.asSelf();

  // 現在利用可能なWebApp統合を一覧する
  const appIntegs = await saClient.get("/app_integrations");
  console.log("利用可能なWebApp統合一覧", appIntegs.body);

  /*
    {
      next_marker: null,
      entries: [
        { type: "app_integration", id: "10897" }, // Edit with G Suite <= 今回、これをつかいたい
        { type: "app_integration", id: "1338" }, // Edit with desktop apps <= これなんだろ・・
        { type: "app_integration", id: "13418" }, // Edit with desktop apps (SFC)  <= 13418がBox Editの統合
        { type: "app_integration", id: "3282" }, // Sign with Adobe Sign
      ],
      limit: 100,
    };

    // 以下のようなパスで詳細情報確認可能
    await saClient.get("/app_integrations/13418");
    */
  // const info = await saClient.get("/app_integrations/1338");
  // console.log("1338", info.body);

  // 作成したAppUserに、BoxEditのアプリ統合を利用できるようにする。
  // clientオブジェクトから何故かpostの実行（client.post）がうまく機能しなかったので、axiosで実行する
  // Authorizationにつけるアクセストークンは、ServiceAccountのものを利用する必要がある。
  const saTokenInfo = await sdk.getEnterpriseAppAuthTokens();
  const saAxios = axios.create({
    baseURL: "https://api.box.com/2.0",
    headers: {
      Authorization: `Bearer ${saTokenInfo.accessToken}`,
    },
  });

  // 登録可能な統合は、全部登録する。
  for (const ai of appIntegs.body.entries) {
    // 個別の統合の情報を書き出してみる。
    {
      const info = await saClient.get(`/app_integrations/${ai.id}`);
      console.log(`/app_integrations/${ai.id}`);
      console.log(info.body);
    }

    await saAxios.post("/app_integration_assignments", {
      assignee: {
        type: "user",
        id: appUser.id,
      },
      app_integration: {
        type: "app_integration",
        id: ai.id,
      },
    });
  }
};

main();
