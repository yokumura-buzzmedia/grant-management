/**
 * アカウントを操作したあとの戻り先。
 *
 * 同じ操作をアカウント編集（G-02）と会社詳細（D-02）の両方から実行できるため、
 * 呼び出し元の画面へ戻す。会社詳細から来た場合は会社IDを受け取る。
 *
 * 戻り先はここで組み立てる。呼び出し側から URL 文字列を受け取ると、
 * サーバーアクションの引数はクライアントから任意の値を渡せるため、
 * 外部サイトへの誘導に使われる。
 */
export const accountReturnPath = (
  accountId: number,
  companyId: number | null,
  kind: "notice" | "error",
  value: string,
) =>
  companyId
    ? // 会社詳細は会社自身の通知も出すため、アカウントの通知だけ接頭辞で分ける
      `/companies/${companyId}?tab=accounts&${kind}=account-${value}`
    : `/accounts/${accountId}?${kind}=${value}`
