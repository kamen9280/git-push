# Android実機確認メモ

## まずPCだけで確認する

```powershell
cd "C:\Users\banli\OneDrive - Kyushu Institute Of Technolgy\ドキュメント\Private\projects\bookmark-mobile-pwa"
npm run dev
```

PCのブラウザで `http://localhost:4173` を開きます。

## Android実機でPWAとして試す方法

Web Share Targetをスマホの共有先に出すには、基本的にHTTPSで配信されたPWAをAndroidにインストールする必要があります。

おすすめの流れ:

1. GitHubにこのフォルダを置く
2. Cloudflare Pages、Netlify、Vercelなどへデプロイする
3. AndroidのChromeでHTTPSのURLを開く
4. メニューから「ホーム画面に追加」または「アプリをインストール」
5. ChromeやBraveで適当なページを開く
6. 共有メニューから `Bookmark Vault` を選ぶ
7. アプリに戻って保存されているか確認する

## PCのlocalhostをスマホから開く場合

PCとスマホが同じWi-Fiにいるなら、PCのIPアドレスを調べて `http://PCのIP:4173` にアクセスできます。

ただし、この方法はHTTPなので、PWAインストールや共有先登録は制限されることがあります。画面確認には使えますが、共有先としての確認にはHTTPSデプロイが確実です。

## 確認する項目

- PINロックを設定できる
- 生体認証を有効化できる
- 検索欄で日本語を続けて入力できる
- 手動URL保存ができる
- 共有メニューからURL保存ができる
- 複数選択して同じフォルダへ移動できる
- Braveから共有しても保存できる
