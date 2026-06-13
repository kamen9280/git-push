# Bookmark Vault Mobile PWA

スマホ版の最初の形です。AndroidのChrome/Braveから共有されたURLを受け取り、ローカルのIndexedDBに保存します。

## できること

- 共有メニューからURLを保存するためのWeb Share Target
- 手動URL保存
- 一覧表示
- フォルダ作成、フォルダ移動
- タイトル、URL、共有本文検索
- PINロック
- 対応環境ではPasskey/生体認証風のロック解除
- PWAインストール

## 起動

```powershell
cd "C:\Users\banli\OneDrive - Kyushu Institute Of Technolgy\ドキュメント\Private\projects\bookmark-mobile-pwa"
npm run dev
```

ブラウザで `http://localhost:4173` を開きます。

## スマホで試す時の注意

Web Share Targetは、AndroidでPWAとしてインストールされた時に共有先として出ます。実機で試すにはHTTPS配信が必要です。ローカルPCの `localhost` はスマホから見るとスマホ自身を指すため、そのままでは共有先登録まで確認しにくいです。

実機検証するなら、後で以下のどれかにします。

- Cloudflare Pagesなどに一時デプロイ
- Android Studio + Capacitorでネイティブアプリ化
- Kotlin/Jetpack Compose版に作り替え

## PC拡張との統合予定

今は `syncStatus: "local-only"` です。次に同期APIを追加する場合、PC拡張とスマホアプリの両方から同じAPIに保存します。

```text
Chrome拡張 / Brave拡張 / Mobile PWA
  ↓
Sync API
  ↓
Cloud DB
```

データには `sourceBrowser` と `source` を持たせているため、Chrome、Brave、スマホ共有、手動保存を後から区別できます。

## 今後の改善候補

- Supabaseなどとの同期
- クライアント側暗号化
- PC拡張の同期対応
- OGP画像やfaviconの取得
- Capacitor/Androidアプリ化

## 実機確認

Android実機で共有メニューまで確認する場合は `docs/ANDROID_TEST.md` を見てください。
