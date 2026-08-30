# PayLog

PayPayアプリからダウンロードした取引履歴CSVを、ブラウザ内だけで整理・集計するビューアーです。

## 公開サイト

https://pa314960-prog.github.io/codex.paypaykanri/

## 主な機能

- CSVのドラッグ＆ドロップ読み込み（UTF-8 / Shift_JIS）
- 支出・入金・差し引き・件数の自動集計
- 月別グラフと支出内訳
- 店名・取引内容の検索、月・入出金の絞り込み
- スマートフォン対応

CSVの内容はサーバーへ送信・保存されません。

## 開発

```bash
npm install
npm run dev
```

## GitHub Pages版

`docs/`には、npmビルドやサーバーを必要としないプレーンHTML・CSS・JavaScript版があります。GitHub Pagesは`main`ブランチの`/docs`を公開元に設定します。
