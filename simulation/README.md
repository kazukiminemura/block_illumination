# LTspice検証 Rev C

現行回路はPico 2 H・XD3914・OSX10201-GYR1の3チャンネル構成です。

- `ltspice/level_meter.asc`：PWM平滑化・独立表示・Picoリセット試験。
- `ltspice/levels.cir`：全11段階・2ストレス条件の試験。
- `ltspice/meter-results.json`：測定値・判定・入力ファイルのSHA256。
- `ltspice/verify-meter.cjs`：ログの完了、72件の判定、ASCの接続一致を確認。

モデルはメーカーのトランジスタモデルではありません。検証条件・限界・実行手順は [設計資料](../hardware/README.md) に記載しています。
