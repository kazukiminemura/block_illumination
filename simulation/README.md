# LTspice検証 Rev C

現行回路はPico 2 H・XD3914・OSX10201-GYR1の3チャンネル構成です。

- `ltspice/level_meter.asc`：PWM平滑化・独立表示・Picoリセット試験。
- `ltspice/levels.cir`：全11段階・2ストレス条件の試験。
- `ltspice/meter-results.json`：測定値・判定・入力ファイルのSHA256。
- `ltspice/verify-meter.cjs`：ログの完了、72件の判定、ASCの接続一致を確認。

モデルはメーカーのトランジスタモデルではありません。検証条件・限界・実行手順は [設計資料](../hardware/README.md) に記載しています。

## 保存証跡の状態

コミット済み `meter-results.json` は過去の72件の合格記録ですが、現在の `level_meter.log` と `levels.log` は保存SHA256に一致しません。既存の `.net` があっても、この不一致を回避して検証済みとは扱いません。ログや回路を変更してハッシュだけ更新せず、LTspiceで両試験を再実行してください。

通常の `node ltspice/verify-meter.cjs` は保存証跡の確認のみです。新しい実行結果を記録する手順は [設計資料](../hardware/README.md#7-再生成とltspice再実行) を参照してください。検証器自体の回帰テストはリポジトリルートで `node simulation/ltspice/test-verify-meter.cjs` を実行します。これはLTspiceの再実行ではありません。
