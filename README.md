# MemoTask

Google Keep のようなカード型メモと、Google Tasks のようなタスク表示を一体化したメモアプリです。ローカル保存だけでも使えますし、Supabase を設定するとオンライン同期できます。

## 起動方法

ブラウザで次のファイルを開くだけで動きます。

```text
index.html
```

ローカルサーバーで確認する場合:

```bash
python3 -m http.server 4173
```

その後、ブラウザで `http://localhost:4173` を開きます。

## 実装済み

- メモ作成、編集、自動保存
- ゴミ箱への移動と復元
- PC 左サイドバー、スマホ用スライドメニュー
- スマホ 2 列、タブレット 3 列、PC 4 列のカード表示
- Masonry 風の可変高さカード
- 長文メモの省略表示
- ピン留め、アーカイブ、色分け
- ラベル追加、名前変更、非表示、ラベル別表示
- チェックリスト、日時、優先度、完了切り替え
- タスクの上下移動と、日時順・優先度順・メモ内順の並び替え
- 今日のタスク、近日中、期限なし、完了済みのタスクビュー
- タイトル、本文、ラベル、タスク本文の検索
- localStorage 保存
- Supabase Auth + JSON同期

## オンライン同期

1. Supabase でプロジェクトを作成します。
2. SQL Editor で `supabase-schema.sql` を実行します。
3. Authentication の Email provider を有効にします。
4. アプリ右上の「同期」から Supabase URL、publishable key、メールアドレスを入力します。
5. 「ログインリンク送信」を押し、届いたメールからログインします。
6. 「同期する」でクラウド保存・取得できます。

同期は `memotask_documents` テーブルにユーザーごとの JSON として保存します。RLS により、自分のデータだけ読み書きできます。

## GitHub Pages 公開

このアプリは静的ファイルだけで動くため、GitHub Pages にそのまま配置できます。

GitHub Free の場合、GitHub Pages は public repository で利用できます。GitHub Pro / Team 以上では private repository からも Pages を使えます。ただし、通常の GitHub Pages URL はインターネット上から到達可能です。メモデータは Supabase Auth と RLS で保護します。

公開後は Supabase の Authentication > URL Configuration に、GitHub Pages のURLを追加してください。

```text
https://<github-user>.github.io/<repository-name>/
```

公開URLでは、ログインしていない場合はメモ画面を表示せず、メールリンクログイン画面だけを表示します。

## 安全方針

プロジェクトの `AGENT.md` に従い、永久削除は実装していません。メモの削除操作は `trashed` フラグでゴミ箱へ移動するだけです。ラベル削除に相当する操作も `hidden` フラグで非表示にします。Supabase への通信は、ユーザーが同期画面で設定し、同期操作をした場合のみ行います。

## 次の段階

Next.js + TypeScript + Tailwind CSS 化、PWA 対応は次の段階で追加できます。
