terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# 環境をまたいで共有するものを置く。ECR とホストゾーンは
# 本番とステージングの両方が使うため、どちらかの state に持たせると
# その環境を作り直したときにもう一方が壊れる。

provider "aws" {
  region  = var.region
  profile = var.profile

  default_tags {
    tags = {
      Project     = "grant-management"
      Environment = "shared"
      ManagedBy   = "terraform"
    }
  }
}

# ドメインは組織の資産なので管理アカウントで登録する。
# サブドメインだけを NS 委譲で受け取り、証明書の検証と DKIM は
# こちらのアカウントで完結させる（03_技術選定.md 5.8）。
provider "aws" {
  alias   = "parent"
  region  = var.region
  profile = var.parent_profile
}
