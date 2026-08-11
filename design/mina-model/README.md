# ミナ専用3Dモデル v1

基準画像：`books/mina-bunko/01-kaze-no-toru-kyoshitsu/mina-bunko-01-kaze-no-toru-kyoshitsu-cover.jpg`

## 固定する外見

- 黒褐色の髪、薄い前髪、低い位置のポニーテール
- やわらかな丸顔、大きな暗色の目、薄いそばかす
- 生成り色のハイネックブラウスとふくらみのある袖
- 淡い花柄が入った青いロングスカート
- 生成り色の編み上げ靴

## ファイル

- `mina-character-turnaround-v1.png`：正面・左側面・背面の制作資料
- `public/models/mina/mina-game-model-v1.glb`：ゲームが読み込む専用3Dモデル
- `scripts/build-mina-model.mjs`：GLBを再生成するスクリプト

## 生成資料のプロンプト要旨

表紙中央のミナを同一人物として保ち、正面・左側面・背面を同じ縮尺のAポーズで描く。黒褐色の低いポニーテール、生成り色のブラウス、青い花柄のロングスカート、生成り色の靴を全方向で一致させる。バッグ、武器、文字、ロゴ、背景風景は含めない。
