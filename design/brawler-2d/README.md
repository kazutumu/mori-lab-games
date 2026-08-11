# ミナと夜の研究路・2D人物素材 v1

## 公開ゲーム用

- `public/game-assets/brawler-2d/mina-sprites-v1.png`：ミナ6動作の背景透過スプライト
- `public/game-assets/brawler-2d/guardians-sprites-v1.png`：四人の番人の背景透過スプライト
- `public/game-assets/brawler-2d/mina-0-v2.png`〜`mina-5-v2.png`：輪郭ごとに分離したミナの個別スプライト
- `public/game-assets/brawler-2d/guardian-0-v2.png`〜`guardian-3-v2.png`：輪郭ごとに分離した番人の個別スプライト
- `extract_individual_sprites.py`：隣接ポーズの手足が表示されないよう、元シートから人物単位で抽出する再生成スクリプト

## 生成元

- `mina-sprite-source-v1.png`：ミナのマゼンタ背景生成画像
- `guardians-sprite-source-v1.png`：四人の番人のマゼンタ背景生成画像

## プロンプト要旨

ミナは文庫版第1巻表紙と三面図を基準に、右向きの待機、歩行2枚、攻撃2枚、両手を上げる勝利の6動作を同じ人物・服装・縮尺で一列に生成。番人は同じ絵本調で、左向きの別人物4人を一列に生成。背景は均一な `#ff00ff` とし、生成後にローカル処理で透過した。
