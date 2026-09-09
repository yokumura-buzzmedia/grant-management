# 起動スケジュールが毎朝設定するタスク数にもそのまま使われる。
# ステージングは縮小版なので1（03_技術選定.md 5.5）。
desired_count = 1

# ゾーンは shared スタックが持つ（NS 委譲済み）。
zone_id = "Z04713861BXOX0SEERX5W"
fqdn    = "staging.grant-management.buzzmedia-app.com"

# module.dns が発行した証明書。同じ apply の中では ARN が確定しないため、
# 1回目で発行してからここに写して2回目で HTTPS を有効にする。
certificate_arn = "arn:aws:acm:ap-northeast-1:024430211741:certificate/2a875933-f7df-4fda-aad2-ae2d836d4c4e"
