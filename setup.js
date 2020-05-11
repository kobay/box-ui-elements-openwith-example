const boxSDK = require("box-node-sdk");
const config = require("./config.json");
const axios = require("axios");
const fs = require("fs");

/**
 * app.jsで利用する、AppUserと、サンプルのWordファイルを予め登録する。
 * また、OpenWithを利用するために必要な、統合の設定も行う。
 */
const main = async () => {
  try {
    // 作成済みのJWT認証用のConfigファイルを読み込む
    const sdk = await boxSDK.getPreconfiguredInstance(config);
    // ServiceAccountのClientオブジェクトを作成
    const saClient = sdk.getAppAuthClient("enterprise");

    // app userを作成 (OpenWithはServiceAccountではつかえず、AppUserが必要なため)
    let appUser = await saClient.enterprise.addAppUser("Sample App User");

    // app userのホームフォルダに、サンプルとしてSample.docをアップロードする
    saClient.asUser(appUser.id);
    const stream = fs.createReadStream("./Sample.docx");
    const files = await saClient.files.uploadFile("0", "Sample.docx", stream);
    const file = files.entries[0];
    saClient.asSelf();

    // 念の為、現在利用可能なWebApp統合を一覧する
    // 13418が入っていないなら、設定がまちがっている
    const appIntegs = await saClient.get("/app_integrations");
    console.log("利用可能なWebApp統合一覧", appIntegs.body);
    /*
    {
      next_marker: null,
      entries: [
        { type: "app_integration", id: "10897" },
        { type: "app_integration", id: "1338" },
        { type: "app_integration", id: "13418" },  <= 13418がBox Editの統合
        { type: "app_integration", id: "3282" },
      ],
      limit: 100,
    };
    */

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

    // ここでは13418(BoxEdit)のみを登録するが、他のものも登録しておくと開くボタンから利用可能になる
    await saAxios.post("/app_integration_assignments", {
      assignee: {
        type: "user",
        id: appUser.id,
      },
      app_integration: {
        type: "app_integration",
        id: "13418",
      },
    });

    // 以下のAppUserとFileのIDをapp.jsで利用する
    console.log(
      "==================== 以下のIDをメモして、app.jsで利用する ===================="
    );
    console.log(`const USER_ID = "${appUser.id}"`);
    console.log(`const FILE_ID = "${file.id}"`);
  } catch (e) {
    console.error(e.toString());
  }
};

main();
