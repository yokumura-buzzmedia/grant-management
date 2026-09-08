# RDS MySQL。照合順序は utf8mb4_ja_0900_as_cs を必ず使う。
# MySQL 8 の既定 utf8mb4_0900_ai_ci は濁点・半濁点を区別せず（「ハ」＝「バ」）、
# 氏名・会社名の検索と重複判定が壊れる。

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
  tags       = { Name = var.name }
}

# ECS からの 3306 は、循環参照を避けるため呼び出し側で許可ルールを足す。
resource "aws_security_group" "this" {
  name        = "${var.name}-db"
  description = "RDS MySQL"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-db" }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-mysql84"
  family = "mysql8.4"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_ja_0900_as_cs"
  }

  parameter {
    name  = "character_set_client"
    value = "utf8mb4"
  }

  parameter {
    name  = "character_set_connection"
    value = "utf8mb4"
  }

  parameter {
    name  = "character_set_database"
    value = "utf8mb4"
  }

  parameter {
    name  = "character_set_results"
    value = "utf8mb4"
  }

  # 日時はすべて UTC で保存し、表示時に JST へ変換する。
  parameter {
    name  = "time_zone"
    value = "UTC"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# パスワードは英数字のみ。DATABASE_URL に埋めるため、
# URL エンコードが要る記号を最初から含めない。
resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_db_instance" "this" {
  identifier = var.name

  engine                     = "mysql"
  engine_version             = var.engine_version
  auto_minor_version_upgrade = true
  instance_class             = var.instance_class

  storage_type          = "gp3"
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.username
  password = random_password.master.result
  port     = 3306

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  multi_az               = var.multi_az

  # 30日保持と削除保護は AWS Backup 側で担保する（03_技術選定.md 5.3）。
  # ここは日常の巻き戻し用。UTC 18:00 = JST 03:00。
  backup_retention_period = 7
  backup_window           = "18:00-19:00"
  maintenance_window      = "sun:19:00-sun:20:00"
  copy_tags_to_snapshot   = true

  enabled_cloudwatch_logs_exports = ["error", "slowquery"]

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = "${var.name}-final"

  tags = { Name = var.name }
}

# アプリは DATABASE_URL 1本で接続する。ECS のタスク定義から
# valueFrom で参照させるため、組み立て済みの文字列を保管する。
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.name}/database-url"
  description             = "アプリが使う MySQL 接続文字列"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "mysql://%s:%s@%s:%d/%s",
    var.username,
    random_password.master.result,
    aws_db_instance.this.address,
    aws_db_instance.this.port,
    var.db_name,
  )
}
