'use strict';

// Listens for the app launching then creates the window
chrome.app.runtime.onLaunched.addListener(function() {
      var width  = 732;
      var height = 460;
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
      chrome.storage.local.get(["token", "room_id_white_list", "only_mention"], function(result) {
          if (!result.token) {
             return;
          }

          CWNotification.setToken(result.token);
          CWNotification.setRoomIdWhiteList(result.room_id_white_list || "");
          CWNotification.setNotifyOnlyMention(result.only_mention || false);

          // 開始
          run();
      });

      // 設定の変更を監視して、変更があれば通知設定の更新
      chrome.storage.onChanged.addListener(function(changes, namespace) {
          for (var key in changes) {

              if (key === "token") {
                  var token = changes[key].newValue;
                  CWNotification.setToken(token);

                  if (token === "" && timer) {
                      clearInterval(timer);
                  }

                  // まだ処理開始していなければ開始する
                  if (timer === null) {
                      run();
                  }
              }

              if (key === "room_id_white_list") {
                  CWNotification.setRoomIdWhiteList(changes[key].newValue || "");
              }

              if (key === "only_mention") {
                  CWNotification.setNotifyOnlyMention(changes[key].newValue);
              }
          }
      });

      // 10秒に1回新規メッセージをチェック
      // TODO メッセージチェックの間隔は設定で変更できるようにする
      // TODO 認証失敗（401）が返ってきていたら、タイマー止める
      var run = function() {
          CWNotification.init();

          timer = setInterval(function() {
              // TODO
              // 最終定期実行時間から5分以上経っていたら
              // 一旦現状の未読状況を通知して、そこからの通知を関しするようにする

              CWNotification.notifyNewMessages();

          }, 10000);
      };
});
