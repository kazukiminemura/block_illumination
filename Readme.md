# block_illumination

Pico 2 H・XD3914 ×3・OSX10201-GYR1 ×3を使うCPU/GPU/NPU使用率メーターの試作設計 Rev C。

- [概要図](docs/overview.svg)
- [実端子付き配線図](hardware/schematic.svg)
- [設計・組立・校正・検証手順](hardware/README.md)
- [全端子表](hardware/connections.csv) / [部品表](hardware/bom.csv)
- [LTspice回路](simulation/ltspice/level_meter.asc)
- [LTspice検証結果](simulation/ltspice/meter-results.json)
- [Pico用MicroPython](firmware/main.py)

LTspiceの保存レポートには72件の合格が記録されています。ただし、現在のコミット済みログは保存SHA256と一致せず、証跡の再確認は失敗します。LTspiceで再実行して証跡を更新するまでは、現行ファイルの検証完了として扱わないでください。実機検証は未実施です。基準電圧の実測校正が必要です。
PC側の使用率取得プログラムは含みません。旧LEDマトリクス設計は削除しました。

再生成：`node hardware/build.cjs`。詳細は設計資料を参照してください。
