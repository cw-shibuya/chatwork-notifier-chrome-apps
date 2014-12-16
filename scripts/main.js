'use strict';

// Listens for the app launching then creates the window
chrome.app.runtime.onLaunched.addListener(function() {
      var width  = 732;
      var height = 428
      var timer  = null;
      chrome.app.window.create('index.html', {
          id: 'main',
          bounds: {
              width: width,
              height: height,
              left: Math.round((screen.availWidth - width) / 2),
              top: Math.round((screen.availHeight - height)/2)
          }
      });

      // メイン処理
      chrome.storage.local.get(["token", "room_id_white_list"], function(result) {
          if (!result.token) {
             return;
          }

          setToken(result.token);
          setRoomIdWhiteList(result.room_id_white_list || "");

          // 開始
          run();
      });

      // 設定の変更を監視して、変更があれば通知設定の更新
      chrome.storage.onChanged.addListener(function(changes, namespace) {
          for (var key in changes) {

              if (key === "token") {
                  var token = changes[key].newValue;
                  setToken(token);

                  if (token === "" && timer) {
                      clearInterval(timer);
                  }

                  // まだ処理開始していなければ開始する
                  if (timer === null) {
                      run();
                  }
              }

              if (key === "room_id_white_list") {
                  setRoomIdWhiteList(changes[key].newValue || "");
              }
          }
      });

      // 10秒に1回新規メッセージをチェック
      // TODO メッセージチェックの間隔は設定で変更できるようにする
      // TODO 認証失敗（401）が返ってきていたら、タイマー止める
      var run = function() {
          updateLatestUpdateTime();

          timer = setInterval(function() {
              // TODO
              // 最終定期実行時間から5分以上経っていたら
              // 一旦現状の未読状況を通知して、そこからの通知を関しするようにする

              notifyNewMessages();

          }, 10000);
      };
});
