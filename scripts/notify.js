var latest_update_time = 0;
var api_token, room_id_white_list;
var url_base = 'https://api.chatwork.com/v1';

var setToken = function(token) {
    api_token = token;
};

var setRoomIdWhiteList = function(white_list) {
    room_id_white_list = white_list;
};

var getRooms = function(success_callback) {
    var request_url = url_base + '/rooms';

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

var notifyNewMessages = function() {
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
};

var getMessages = function(room, before_latest_update_time, callback) {
    var request_url = url_base + '/rooms/' + room.room_id + '/messages';

    var params = {
        url: request_url,
        headers: {
            'X-ChatWorkToken': api_token
        },
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
}

// チャットデータのうち一番最新の更新時間を取得
var getLatestUpdateTime = function(data) {
    return Math.max.apply(null, data.map(function(obj) {
        return obj.last_update_time;
    }));
};

var updateLatestUpdateTime = function() {
    getRooms(function(data) {
        latest_update_time = getLatestUpdateTime(data)
    });
};

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
