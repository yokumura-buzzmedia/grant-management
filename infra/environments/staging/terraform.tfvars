# 起動スケジュールが毎朝設定するタスク数にもそのまま使われる。
# ステージングは縮小版なので1（03_技術選定.md 5.5）。
desired_count = 1

# shared スタックでゾーンを作ったら、次の2行のコメントを外して apply する。
# zone_id は `terraform -chdir=infra/environments/shared output zone_id` で取れる。
# 1回目の apply で証明書が発行・検証され、Route 53 のレコードができる。
# zone_id = "Z..."
# fqdn    = "staging.grant-management.buzzmedia-app.com"

# 2回目の apply で HTTPS リスナーを有効にする。
# 値は 1回目の apply 後に `terraform output certificate_arn` で取れる。
# certificate_arn = "arn:aws:acm:ap-northeast-1:024430211741:certificate/..."
