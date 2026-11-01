# block_illumination

Pico 2 HとLT-5016M1×3による48×16ドット・赤/黄緑LED表示器。

## Rev B 試作製作資料（2026-11-01）

- [配線図・全端子表・部品表・検証記録](simulation/ltspice/implementation.html)
- [試作配線図 SVG](simulation/ltspice/implementation.svg)
- [全IC・全LED接続図 SVG](simulation/ltspice/full_circuit.svg)
- [LTspice全体回路](simulation/ltspice/full_circuit.asc)
- [物理端子番号付き接続 CSV](simulation/ltspice/assembly-connections.csv)
- [部品表 CSV](simulation/ltspice/bom.csv)
- [検証範囲と再現手順](simulation/ltspice/FULL_CIRCUIT.md)

**Rev Bは試作版です。実部品の動作・温度を保証する量産確定図ではありません。**
LED実端子、AO3401A、IREF=10kΩ（約5.04mA）、初期消灯用GP10と2N3904を具体化しました。
元写真そのままの復元ではなく、試作向けに接続を定義し直した設計です。
旧版Rev Aの3.3kΩ/15.27mA・8信号・未確定端子の説明はRev Bには適用しません。
