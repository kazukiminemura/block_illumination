# LTspice Rev B検証

[製作資料](implementation.html) と [全体回路の検証範囲](FULL_CIRCUIT.md) を参照。

row_handoff.ascは2行の電気試験、full_circuit.ascは全体回路です。
全96列負荷はfull_load.cir、初期消灯はstartup.cir。

Rev BはIREF=10kΩ、5.04mA/LED、GP10でバッファ有効化。
旧3.3kΩ/15.27mA版とは条件が異なります。

各回路をLTspiceでRun後、ログ更新を確認して検証スクリプトで判定。
results.jsonは行切替4条件をそのまま保存し、10usの不合格も残します。

定電流誤差±2%、旧行電流1mA未満、BLANK中電流1mA未満、電源4.5V以上が今回の仮定モデルの設計基準です。
実部品保証値ではありません。
