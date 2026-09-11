# ステージングを業務時間だけ動かす（03_技術選定.md 5.5）。
# EventBridge Scheduler のユニバーサルターゲットから ECS と RDS の API を直接呼ぶ。
# Lambda を挟まないので、維持するコードが増えない。
#
# 祝日は判定しない。土日だけ止める。

locals {
  state = var.enabled ? "ENABLED" : "DISABLED"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy" "this" {
  name = "start-stop"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Ecs"
        Effect   = "Allow"
        Action   = ["ecs:UpdateService", "ecs:DescribeServices"]
        Resource = [var.service_arn]
      },
      {
        Sid    = "Rds"
        Effect = "Allow"
        Action = [
          "rds:StartDBInstance",
          "rds:StopDBInstance",
          "rds:DescribeDBInstances",
        ]
        Resource = [var.db_instance_arn]
      },
    ]
  })
}

# 定期ジョブを単発タスクとして起動するための権限（05_外部連携仕様.md 3.9）。
# RunTask には、タスクが使う実行ロールとタスクロールを渡す許可も要る。
resource "aws_iam_role_policy" "run_task" {
  count = var.poll_contracts_enabled ? 1 : 0

  name = "run-task"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RunTask"
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = ["${var.poll_contracts_task_arn}:*", var.poll_contracts_task_arn]
      },
      {
        Sid      = "PassRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = var.task_role_arns
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      },
    ]
  })
}

/**
 * 契約書の締結を検知するポーリング（05_外部連携仕様.md 3.9）。
 *
 * **業務時間内だけ回す。** 時間外は RDS も ECS も停止しているので、
 * 起動してもDBに繋がらず失敗するだけ。夜間に締結されても翌営業日の初回で拾える。
 */
resource "aws_scheduler_schedule" "poll_contracts" {
  count = var.poll_contracts_enabled ? 1 : 0

  name                         = "${var.name}-poll-contracts"
  group_name                   = "default"
  state                        = local.state
  schedule_expression          = var.poll_contracts_cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.cluster_arn
    role_arn = aws_iam_role.this.arn

    ecs_parameters {
      task_definition_arn = var.poll_contracts_task_arn
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = var.private_subnet_ids
        security_groups  = var.security_group_ids
        assign_public_ip = false
      }
    }

    # 失敗しても次の10分後に拾えるので、その場では追わない
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}

resource "aws_scheduler_schedule" "db_start" {
  name                         = "${var.name}-db-start"
  description                  = "Start staging RDS on weekday mornings"
  state                        = local.state
  schedule_expression          = var.db_start_cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:startDBInstance"
    role_arn = aws_iam_role.this.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}

resource "aws_scheduler_schedule" "ecs_start" {
  name                         = "${var.name}-ecs-start"
  description                  = "Scale staging ECS service up on weekday mornings"
  state                        = local.state
  schedule_expression          = var.ecs_start_cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ecs:updateService"
    role_arn = aws_iam_role.this.arn

    input = jsonencode({
      Cluster      = var.cluster_name
      Service      = var.service_name
      DesiredCount = var.desired_count
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}

resource "aws_scheduler_schedule" "ecs_stop" {
  name                         = "${var.name}-ecs-stop"
  description                  = "Scale staging ECS service down in the evening"
  state                        = local.state
  schedule_expression          = var.ecs_stop_cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ecs:updateService"
    role_arn = aws_iam_role.this.arn

    input = jsonencode({
      Cluster      = var.cluster_name
      Service      = var.service_name
      DesiredCount = 0
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}

resource "aws_scheduler_schedule" "db_stop" {
  name                         = "${var.name}-db-stop"
  description                  = "Stop staging RDS in the evening"
  state                        = local.state
  schedule_expression          = var.db_stop_cron
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.this.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })

    retry_policy {
      maximum_retry_attempts = 3
    }
  }
}
