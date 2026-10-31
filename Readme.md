# block_illumination

添付写真を基にした、3枚の16×16・2色LED表示器の暫定回路設計と論理シミュレーション。

電気特性の検証には **LTspice** を使用。最初に [LTspice回路図](simulation/ltspice/row_handoff.asc) と [検証条件・結果](simulation/ltspice/README.md) を参照。

- [全体回路図（LTspice）](simulation/ltspice/full_circuit.asc) / [閲覧用SVG](simulation/ltspice/full_circuit.svg)
- [全体版の構成・開き方・モデルの限界](simulation/ltspice/FULL_CIRCUIT.md)

- [回路図と動作プレビュー](simulation/preview.html) — ブラウザーで開く
- [回路図 SVG](simulation/schematic.svg)
- [設計条件・接続・検証範囲](simulation/README.md)
- [全端子接続表](simulation/connections.csv)

検証: `node simulation/test.cjs`

図面再生成: `node simulation/build.cjs`
