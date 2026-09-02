# ECC 利用ガイド

## 1. この文書について

本書は、本プロジェクトで Claude Code 拡張「ECC（Everything Claude Code）」を使うための基本ガイドです。
インストールは完了済みのため、日々の使い方に絞って記載します。

- 文書状態: 初版
- 作成日: 2026-09-02
- 対象: ECC v2.2.1（プラグイン `ecc@ecc`）
- 実体の場所: `~/.claude/plugins/marketplaces/ecc`

## 2. ECC とは

Claude Code に「作業手順・専門レビュー・安全装置」をまとめて追加するプラグインです。
インストール済みのチェックアウトには、スキル 286 件、コマンド 94 件、エージェント 68 件が含まれます。

すべてを覚える必要はありません。**目的に対応する入口を1つ選んで打つ**、が基本の使い方です。

## 3. 構成要素

| 要素 | 役割 | 使い方 |
| --- | --- | --- |
| Skills | 主役。作業手順書をその場で読み込ませる | `/ecc:plan` のように入力、または Claude が自動提案 |
| Commands | Skills への入口・互換用の短縮形 | 同上（`ecc:` 名前空間） |
| Agents | 別コンテキストで動く専門サブエージェント | Skill から自動的に委譲される |
| Hooks | ツール実行の前後で発火する安全装置 | 環境変数で有効/無効を制御 |
| Rules | 常時適用のコーディング指針 | 言語別ディレクトリに配置 |

新しい機能は Skills に集約される方針のため、迷ったら Skill 名で探すのが確実です。

## 4. 基本の使い方（目的別の入口）

| やりたいこと | 入力するもの |
| --- | --- |
| 機能を設計・計画する | `/ecc:plan "機能の説明"` |
| 要件から PRD を起こす | `/ecc:plan-prd` |
| 計画を視覚的にレビューする | `/ecc:plan-canvas` |
| 機能開発をガイド付きで進める | `/ecc:feature-dev` |
| テストファーストで実装する | `ecc:tdd-workflow` スキル |
| 書いたコードをレビューする | `/ecc:code-review` |
| ビルド・型エラーを直す | `/ecc:build-fix` |
| 不要コードを整理する | `/ecc:refactor-clean` |
| セキュリティ監査を行う | `/ecc:security-scan` |
| ドキュメントを実体に合わせる | `/ecc:update-docs` |
| コンテキスト残量を確認する | `ecc:context-budget` スキル |
| 作業を中断・再開する | `/ecc:save-session` → `/ecc:resume-session` |
| 機能を探す | `/ecc:ecc-guide find: <キーワード>` |

補足事項は次のとおりです。

- コマンドは名前空間付きの `/ecc:xxx` 形式で入力します。
- `/ecc:plan` は要件の再確認とリスク評価を行い、**ユーザーの確認があるまでコードに触れません**。
- `/ecc:code-review` は引数なしでローカルの未コミット差分、PR 番号を渡すと PR レビューになります。
- セッション状態は `~/.claude/session-data/` に日付付きで保存されます。

## 5. 代表的な作業の流れ

### 5.1 新しい機能をつくる

```text
/ecc:plan "○○機能を追加"     → 実装計画を作成（確認待ちで停止）
ecc:tdd-workflow スキル        → テストを先に書いて実装
/ecc:code-review               → 変更内容をレビュー
```

### 5.2 不具合を直す

```text
ecc:tdd-workflow スキル        → 再現する失敗テストを先に書く
                               → 修正し、テストが通ることを確認
/ecc:code-review               → 影響範囲・リグレッションを確認
```

### 5.3 リリース前の確認

```text
/ecc:security-scan             → 脆弱性の確認
ecc:e2e-testing スキル         → 主要な業務フローの通しテスト
/ecc:test-coverage             → カバレッジの確認
```

## 6. 本プロジェクトでの使いどころ

現時点の本プロジェクトは要件定義ドキュメントが中心のため、設計・計画系の機能が有効です。

- `/ecc:plan-prd` — `docs/設計/01_要件定義.md` を元に PRD を起こす
- `/ecc:plan-canvas` — 計画や構成案を視覚的に確認・承認する
- `/ecc:update-docs` — CSV やスキーマなど実体に合わせてドキュメントを更新する
- `/ecc:project-init` — 実装フェーズ開始時に、技術スタックを検出して初期設定案を出す（ドライラン）
- `ecc:deep-research` / `ecc:documentation-lookup` — 助成金制度や外部仕様の調査時

## 7. Hooks（安全装置）の制御

ECC の Hook は、ツール実行前に確認を挟むことがあります。
たとえば GateGuard は、最初の Bash 実行前に「何のための実行か」の明示を求めます。求められた内容を提示すれば処理は継続します。

不要な場合は、環境変数でセッション単位に調整できます。

```bash
export ECC_GATEGUARD=off          # GateGuard のみ無効化
export ECC_HOOK_PROFILE=minimal   # 必須の安全フックのみ（既定は standard）
export ECC_HOOKS_ENABLED=false    # すべての Hook を停止
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder"   # 個別 ID を指定して無効化
```

プロファイルは `minimal` / `standard` / `strict` の3種類です。

## 8. 困ったときの調べ方

- `/ecc:ecc-guide` — 全体のメニューを表示
- `/ecc:ecc-guide find: <キーワード>` — 該当する Skill / Command / Agent を横断検索
- `/plugin list ecc@ecc` — 実際にインストールされている内容を確認

## 9. 参考ファイル

インストール先 `~/.claude/plugins/marketplaces/ecc` 配下の主要ファイルです。

| ファイル | 内容 |
| --- | --- |
| `README.md` | 全体像・インストール・アンインストール |
| `COMMANDS-QUICK-REF.md` | コマンド早見表 |
| `docs/ja-JP/` | 日本語版ドキュメント一式 |
| `skills/<name>/SKILL.md` | 各スキルの手順定義 |
| `agents/<name>.md` | 各エージェントの役割定義 |
| `hooks/README.md` | Hook の一覧とカスタマイズ方法 |
| `TROUBLESHOOTING.md` | トラブルシューティング |
