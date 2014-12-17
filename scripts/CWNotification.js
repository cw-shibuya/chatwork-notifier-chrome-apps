var CWNotification = (function(self) {
    /**
     * 一度の通知でメッセージを取得する最大のチャット数
     * @type {Number}
     */
    var MAX_NOTIFY_ROOM_NUM = 5;

    /**
     * 今までチェックした中で一番最新の更新日時
     * @type {timestamp}
     */
    var latest_update_time = 0;

    /**
     * APIトークン
     * @type {string}
     */
    var api_token;

    /**
     * 通知する対象のチャット一覧（指定がない場合は全部が対象）
     * @type {Array}
     */
    var room_id_white_list;

    /**
     * チャットワークAPIのエンドポイントの起点URL
     * @type {String}
     */
    var url_base = 'https://api.chatwork.com/v1';

    var requestApi = function(endpoint, success_callback) {
        var request_url = url_base + endpoint;

        var params = {
            url: request_url,
            headers: {
                'X-ChatWorkToken': api_token
            },
            dataType: 'json',
            success: function(data, dataType) {
                success_callback(data);
            }
        };

        $.ajax(params);
    };

    /**
     * チャット情報の一覧取得
     * @param {function} success_callback
     */
    var getRooms = function(success_callback) {
        return requestApi('/rooms', success_callback);
    };

    /**
     * 自分の未読状況取得
     * @param {function} success_callback
     */
    var getMyStatus = function(success_callback) {
        return requestApi('/my/status', success_callback);
    };

    /**
     * チャット情報から対象チャットのメッセージを取得する
     * @param {object} room チャット情報のオブジェクト
     * @param {Timestamp} before_latest_update_time 確認済みの最新更新時間
     * @param {Function} callback メッセージ取得出来た時、メッセージ情報を引数に実行する関数
     *  ※ このコールバック関数の引数には、前回チェック時よりも新しく追加されたメッセージのみフィルタされた結果が渡される
     */
    var getMessages = function(room, before_latest_update_time, callback) {
        return requestApi('/rooms/' + room.room_id + '/messages', function (message_objects) {
            callback(message_objects.map(function(message_obj) {
                // 前回チェック時の最新日時よりもあとに発言されたメッセージ取得
                if (message_obj.send_time > before_latest_update_time) {
                    return message_obj;
                }
            }).filter(function(item){
                return item != undefined
            }));
        });
    };

    /**
     * チャットデータのうち一番最新の更新時間を取得
     * @param {Array} room_objs チャット情報のオブジェクト郡
     * @return {Timestamp}
     */
    var getLatestUpdateTime = function(room_objs) {
        return Math.max.apply(null, room_objs.map(function(obj) {
            return obj.last_update_time;
        }));
    };


    /**
     * メッセージ情報を受け取って、デスクトップ通知する
     * @param  {Object} room_object
     * @param  {Array} message_objects
     * private
     */
    var notifyMessage = function(room_object, message_objects) {
        var options = {
            type : "list",
            title: "「" + room_object.name + '」に新規メッセージが届きました',
            message: "新規メッセージが届きました",
            items: [],
            iconUrl: chrome.runtime.getURL("/images/icon-128.png")
        };

        for (var i = 0, len = message_objects.length; i < len; i++) {
            options.items.push({
                title:   'from ' + message_objects[i].account.name,
                message: message_objects[i].body
            });
        }

        var creationCallback = function() {
        };

        chrome.notifications.create("", options, creationCallback);
    };

    /**
     * チャット情報をもとに取得できたメッセージを通知する
     * @param {Array} room_objects
     */
    var notifyAllMessages = function(room_objects) {
        var room_obj;

        for (var i = 0, len = room_objects.length; i < len; i++) {
            room_obj = room_objects[i];

            // ホワイトリストが指定してある場合、
            // 変更があったチャットがホワイトリストにある場合だけ通知する
            if (room_id_white_list && room_id_white_list.indexOf(room_obj.room_id) === -1) {
                continue;
            }

            // 非同期通信の後にroom_objを利用したいので無名関数で包む
            (function(room_obj_clone) {
                getMessages(room_obj_clone, latest_update_time, function(message_objects) {
                    notifyMessage(room_obj_clone, message_objects);
                });
            })(room_obj);
        }
    };

    /**
     * 未読のサマリーを通知
     * @param {Array} updated_rooms 更新のあったチャットの情報一覧
     */
    var notifySummry = function(updated_rooms) {
        getMyStatus(function(status_object) {
            var options = {
                type : "list",
                title: MAX_NOTIFY_ROOM_NUM + 'つ以上のチャットに変更があったのでサマリーをお伝えします',
                message: "",
                priority: 1,
                items: [
                    {
                        title: '未読チャット数:',
                        message: status_object.unread_room_num + 'チャット'
                    },
                    {
                        title: '未読のメッセージ数:',
                        message: status_object.unread_num + 'メッセージ'
                    },
                    {
                        title: '未読のメンション数:',
                        message: status_object.mention_num + 'メッセージ'
                    }
                ],
                iconUrl: chrome.runtime.getURL("/images/icon-128.png")
            };

            var creationCallback = function() {
            };

            chrome.notifications.create("", options, creationCallback);
        });
    };

    return {
        /**
         * APIトークンのセット
         * @param {String} token
         */
        setToken: function(token) {
            api_token = token;
        },

        /**
         * 通知対象のチャット一覧のセット
         * @param {Array} white_list チャットIDの配列
         */
        setRoomIdWhiteList: function(white_list) {
            room_id_white_list = white_list;
        },

        /**
         * 現在一番更新時間が新しいチャットの更新時間の最新化
         * ※ 更新処理は非同期なので注意
         */
        updateLatestUpdateTime: function() {
            getRooms(function(data) {
                latest_update_time = getLatestUpdateTime(data)
            });
        },

        /**
         * 通知するメッセージを取得して通知する
         */
        notifyNewMessages: function() {
            getRooms(function(data) {
                // 前回チェック時から更新があったチャット一覧抽出
                var updated_rooms = data.map(function(obj) {
                    if (latest_update_time < obj.last_update_time) {
                        return obj
                    }
                }).filter(function(item){ return item != undefined });

                if (updated_rooms.length > MAX_NOTIFY_ROOM_NUM) {
                    // 通知する最大数のチャットが対象の場合は、
                    // サマリーだけを通知する
                    notifySummry(updated_rooms);

                } else {
                    // 取得したメッセージをすべて通知する
                    notifyAllMessages(updated_rooms);
                }

                // 最新の更新時間を更新
                latest_update_time = getLatestUpdateTime(data);
            });
        }
    }

}(this));
