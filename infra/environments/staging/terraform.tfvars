# ECR が空のうちは 0。イメージを push したら 1 にする。
# この値は起動スケジュールが設定するタスク数にもそのまま使われる。
desired_count = 0

# ALB の DNS 名が決まったら "http://<ALB の DNS 名>" を入れる。
cors_allowed_origins = []
