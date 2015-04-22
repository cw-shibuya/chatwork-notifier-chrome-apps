var Option = (function(self){
    var option = {};
    var id_list = ['token', 'room_id_white_list', 'only_mention'];
    var glue = ",";

    // 設定値の保存
    option.save = function() {
        var id, saved_value, new_value;

        var save_data = {};

        for (var i = 0, len = id_list.length; i < len; i++) {
            id = id_list[i];

            if (id === "only_mention") {
                new_value = $("#"+id).prop("checked") * 1;
            } else {
                new_value = $("#"+id).val();

                // カンマ区切りの文字列を配列にする
                if (id === "room_id_white_list" && new_value !== "") {
                    new_value = new_value.split(glue).map(function(val) {
                        return val * 1;
                    });
                }
            }

            save_data[id] = new_value;
        }

        // 保存
        chrome.storage.local.set(save_data);
    };

    // 保存されている設定値をフォームに入れる
    option.restore = function() {
        chrome.storage.local.get(id_list, function(result) {
            var val;
            for (var id in result) {
                val = result[id] || "";

                if (id === 'only_mention') {
                    $("#"+id).prop('checked', Boolean(val));
                    continue;
                }

                if (id === "room_id_white_list" && val !== "") {
                    // 配列で保存されているデータを、文字列に変換する
                    val = val.join(glue);
                }
                document.getElementById(id).value = val;
            }
        });
    };

    // optionページを開いた時の動作
    return {
        init: function() {
            option.restore();

            document.getElementById('save').onclick = function() {
                option.save();
            };

            chrome.storage.onChanged.addListener(function(changes, namespace) {
                var options = {
                    type: 'basic',
                    title: '通知設定',
                    message: "通知設定が保存されました",
                    iconUrl: chrome.runtime.getURL("/images/icon-128.png")
                };

                var creationCallback = function() {
                };

                chrome.notifications.create("", options, creationCallback);
            });
        }
    }

}(this));
