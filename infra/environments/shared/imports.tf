# ECR はもともと staging スタックが持っていた。実リソースは壊さず、
# state 上の持ち主だけを shared へ移す。
#
# 取り込みが済んだらこのファイルは削除してよい。
# 履歴として残す意味はあるが、Terraform 側では不要になる。
import {
  to = module.registry.aws_ecr_repository.this
  id = "grant-management"
}

import {
  to = module.registry.aws_ecr_lifecycle_policy.this
  id = "grant-management"
}
