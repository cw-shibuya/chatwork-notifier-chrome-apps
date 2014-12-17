var CWNotification = (function() {
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

    /**
     * チャット情報の一覧取得
     * @param {function} success_callback
     */
    var getRooms = function(success_callback) {
        var request_url = url_base + '/rooms';

        var params = {
            url: request_url,
            headers: getRequestHeaders(),
            dataType: 'json',
            success: function(data, dataType) {
                success_callback(data);
            }
        };

        $.ajax(params);
    };

    /**
     * チャット情報から対象チャットのメッセージを取得する
     * @param {object} room チャット情報のオブジェクト
     * @param {Timestamp} before_latest_update_time 確認済みの最新更新時間
     * @param {Function} callback メッセージ取得出来た時、メッセージ情報を引数に実行する関数
     */
    var getMessages = function(room, before_latest_update_time, callback) {
        var request_url = url_base + '/rooms/' + room.room_id + '/messages';

        var params = {
            url: request_url,
            headers: getRequestHeaders(),
            dataType: 'json',
            success: function(data, dataType) {
                callback(data.map(function(message_obj) {
                    // 前回チェック時の最新日時よりもあとに発言されたメッセージ取得
                    // TODO 自分の発言は通知しないようにする
                    if (message_obj.send_time > before_latest_update_time) {
                        return message_obj;
                    }
                }).filter(function(item){
                    return item != undefined
                }));
            }
        };

        $.ajax(params);
    };

    var getRequestHeaders = function() {
        return {'X-ChatWorkToken': api_token};
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
    var notify = function(room_object, message_objects) {
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

                var room_obj = {};
                for (var i = 0, len = updated_rooms.length; i < len; i++) {
                    room_obj = updated_rooms[i];

                    // ホワイトリストが指定してある場合、
                    // 変更があったチャットがホワイトリストにある場合だけ通知する
                    if (room_id_white_list && room_id_white_list.indexOf(room_obj.room_id) === -1) {
                        continue;
                    }

                    // 非同期通信の後にroom_objを利用したいので無名関数で包む
                    (function(room_obj_clone) {
                        getMessages(room_obj_clone, latest_update_time, function(message_objects) {
                            notify(room_obj_clone, message_objects);
                        });
                    })(room_obj);
                }

                // 最新の更新時間を更新
                latest_update_time = getLatestUpdateTime(data)
            });
        }
    }

}(this));
