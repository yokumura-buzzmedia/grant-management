# 起動スケジュールが毎朝設定するタスク数にもそのまま使われる。
# ステージングは縮小版なので1（03_技術選定.md 5.5）。
desired_count = 1

# ゾーンは shared スタックが持つ（NS 委譲済み）。
zone_id = "Z04713861BXOX0SEERX5W"
fqdn    = "staging.grant-management.buzzmedia-app.com"

# module.dns が発行した証明書。同じ apply の中では ARN が確定しないため、
# 1回目で発行してからここに写して2回目で HTTPS を有効にする。
certificate_arn = "arn:aws:acm:ap-northeast-1:024430211741:certificate/2a875933-f7df-4fda-aad2-ae2d836d4c4e"

# freeeサイン（05_外部連携仕様.md 3）。
# ベースURLは疎通確認済み。他候補（api. / app.）は404で、ここだけがAPIを返す。
freee_sign_base_url    = "https://ninja-sign.com"
freee_sign_template_id = "403995"

# この環境の契約書の置き場。**本番とは必ず別のフォルダにする**（3.12）。
# 環境の分離を担保しているのはこの値だけ。
freee_sign_folder_id = "642129"

# 送信ユーザー。APIクライアントから送る場合は必須（3.6）。
freee_sign_sender_id = "1713140"

# 有効化は client_id / client_secret が通ってから。
# いまは POST /v1/token が 401 のため有効化できない。
# 手順は docs/手順書/ECRへのイメージ登録とデプロイ.md の
# 「freeeサイン連携を有効にする」を参照。
freee_sign_enabled = false
