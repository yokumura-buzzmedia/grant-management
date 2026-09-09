terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "grant-management-tfstate-024430211741"
    key          = "shared/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
