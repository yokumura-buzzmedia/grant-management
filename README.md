# 助成金管理システム

助成金の申請案件・研修・書類を管理する社内システムです。
設計は `docs/設計/` を正とします。

## 実装の状況

| 範囲 | 状態 |
| --- | --- |
| 設計ドキュメント | 6文書（要件・技術選定・DB論理設計・外部連携・画面設計・各種図） |
| DBスキーマ | Drizzle 34テーブル |
| 認証（A-01〜A-04） | 実装済み |
| 業務機能 | 未着手 |

## ローカル開発

### 前提

- Node 22（`.nvmrc` で指定。fnm を使う場合はこのディレクトリで自動切替）
- Docker（ローカル MySQL 用）

fnm を使っていない場合は Node 22 を用意してください。Node 20 でも動きますが、
本番は Node 22 です（`docs/設計/03_技術選定.md`）。

### 起動

```bash
cp .env.example .env.local
npm install
npm run setup   # MySQL 起動 → マイグレーション → 初期管理者の作成
npm run dev
```

`npm run setup` の最後に、初期システム管理者のログインIDと**仮パスワード**が表示されます。
これで http://localhost:3000 からログインしてください。
仮パスワードでログインすると、必ずパスワード設定画面（A-02）を経由します。

### 動作確認の観点

| 確認すること | 期待する挙動 | 要件 |
| --- | --- | --- |
| ログインIDの大文字小文字 | `Admin001` では入れず、`admin001` でのみ入れる | 5.4 |
| 仮パスワードでのログイン | A-02 へ送られ、設定するまで他画面へ行けない | 5.4 |
| パスワードの条件 | 満たさない条件が画面に列挙される | 5.4 |
| パスワード変更 | 変更した端末を含む全端末がログアウトする | 5.19 |
| ログインID変更 | 現在のパスワードが必須。変更後はログアウトする | 5.4 |
| 権限の即時反映 | `user_roles` を直接変更すると、次のリクエストから反映される | 5.19 |
| アカウント無効化 | `users.is_active` を 0 にすると、次のリクエストでログアウトする | 5.19 |
| 初期表示画面 | 権限により `/dashboard` `/projects` `/schedule` へ振り分けられる | 5.14 |

### DB

ホスト側のポートは **3307** です（既存の MySQL と衝突させないため）。

```bash
npm run db:studio   # Drizzle Studio
npm run db:reset    # ボリュームごと作り直す
```

照合順序は本番と同じ `utf8mb4_ja_0900_as_cs` です。
MySQL 既定の `utf8mb4_0900_ai_ci` では濁点・半濁点が区別されず、
ログインIDの大文字小文字も区別されなくなるため、`npm run db:seed` が起動時に検証します。

mysql2 は接続時のハンドシェイクで照合順序ID 303 を送れないため、
接続確立時に `SET NAMES utf8mb4 COLLATE utf8mb4_ja_0900_as_cs` を実行しています
（`src/db/client.ts`）。

コンテナ内の `mysql` クライアントは既定が latin1 です。日本語を含む SQL を流すときは
`--default-character-set=utf8mb4` を付けてください。付け忘れると二重エンコードされて保存されます。

```bash
docker compose exec mysql mysql --default-character-set=utf8mb4 -ugrant -pgrant grant_management
```

`mysql:8.4` を取得できない環境では、`MYSQL_TAG` でイメージを差し替えられます。

```bash
MYSQL_TAG=8.0 docker compose up -d --wait
```
