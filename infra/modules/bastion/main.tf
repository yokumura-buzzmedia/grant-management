# RDS はプライベートサブネットにあり、手元から直接つなげない。
# SSM Session Manager のポートフォワードで、手元の drizzle-kit や
# db:studio をそのまま使えるようにする。
#
# SSH は使わない。鍵も 22番ポートの開放も要らず、接続は CloudTrail に残る。
# 受信を一切許可しないため、インバウンドのルールは作っていない。

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.name}-bastion"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.name}-bastion"
  role = aws_iam_role.this.name
}

resource "aws_security_group" "this" {
  name        = "${var.name}-bastion"
  description = "Bastion for SSM port forwarding"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-bastion" }
}

# SSM エージェントが AWS の API へ出るため、外向きだけ許可する。
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_instance" "this" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.this.id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  # プライベートサブネットに置き、NAT 経由で SSM に接続させる。
  associate_public_ip_address = false

  # IMDSv2 を必須にする。
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = "${var.name}-bastion" }

  # AMI の更新で作り直されると、そのたびにインスタンスIDが変わる。
  # 踏み台に状態はないが、手順書に書いたIDが変わるのは煩わしいので追わない。
  lifecycle {
    ignore_changes = [ami]
  }
}
