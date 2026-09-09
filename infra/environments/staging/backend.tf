terraform {
  required_version = ">= 1.11"

  # 排他制御は S3 のロックファイルで行う。DynamoDB テーブルは不要。
  backend "s3" {
    bucket       = "grant-management-tfstate-024430211741"
    key          = "staging/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
