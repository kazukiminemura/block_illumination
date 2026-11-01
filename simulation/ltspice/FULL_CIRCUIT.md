# 全体回路 Rev B

製作資料はimplementation.html、概要図はimplementation.svg、全体図はfull_circuit.svg、LTspice編集用はfull_circuit.ascです。
全て同じ../connections.csvから生成します。元写真そのままの復元ではありません。

## 実端子

- LT-5016M1：前面上端Row1をA0、下端Row16をA15と定義。行アノードはpin16→1、赤列は17→32、黄緑列は33→48。販売元配布LT5016_pin.pdfの内部接続と照合済み。裏面配置は前面と左右が反転します。
- AO3401A：SOT-23、1=G、2=S、3=Dを採用。原写真のMOSを特定したわけではありません。
- 2N3904：onsemi TO-92、1=E、2=B、3=C。
- TLC5928PWはTSSOP-24、SN74HC595NとSN74AHCT125NはDIP、ULN2803AはST DIP-18。
- Picoの物理ヘッダー端子はassembly-connections.csv、GPIO名は../connections.csv。

## Rev B変更

IREFは6個とも10kΩ±1%、LED電流5.04mA typ。初回試作の電流・発熱を抑える設計選択です。旧3.3kΩ版の解析値は使用しません。

GP10 RUN_EN、2N3904、4.7kΩ/100kΩ/10kΩでAHCT125の/OEを制御します。
GPIOが未接続・リセットならバッファを無効化し、5V側BLANKプルアップで消灯。
他6出力に10kΩプルダウン。5VをPico GPIOへ直接接続しません。

PicoはUSB給電、外部5VのVBUS直結は禁止、GND共通。逆給電を含む全電源シーケンスの実測評価は別途必要です。

## LTspice検証

- full_circuit.asc：16行・3パネル・1536色LED経路、シリアルチェーン、1フレーム16.2ms、市松模様。
- full_load.cir：FLOOD=1で全96列シンクを強制ON、行は通常シリアル走査。最大列負荷の試験であり、全点灯データのシリアル転送試験ではありません。
- row_handoff.asc：隣接2行・各色48列、消灯待ち10/100us、追加ゲート容量1/4nFの4条件。不合格の10usも記録。
- startup.cir：5V定常時のPico未接続・リセット・有効化・表示中・表示後リセットの5ケース。900us時点のBLANKを評価。

生成：

~~~powershell
node simulation/build.cjs
node simulation/test.cjs
node simulation/ltspice/build-full.cjs
node simulation/ltspice/build.cjs
node simulation/ltspice/build-implementation.cjs
~~~

LTspiceで各回路を開きRun。ログの更新を確認後：

~~~powershell
node simulation/ltspice/verify-netlist.cjs
node simulation/ltspice/verify-full.cjs
node simulation/ltspice/verify-full.cjs --full-load
node simulation/ltspice/verify.cjs
node simulation/ltspice/verify-startup.cjs
node simulation/ltspice/build-implementation.cjs
~~~

verify-netlist.cjsはASCから実際に生成された.netとCIRの全120部品の端子リストを比較し、作図の線重なりによる短絡も検出します。
.net/.rawは再生成可能な中間ファイル。バッチ実行がログを更新しない環境ではGUIから実行してください。

## モデルと判定の限界

TLC/595はDFLOPによる機能近似。TLCの診断データ上書き・LOD/PTW、IC固有遅延、電源投入時の未知状態を完全再現しません。
補助論理試験は未知ラッチとLAT再入力による破損を別に確認します。転送後LATは各1回のみ。

AHCTのTTL判定・出力抵抗、ULNのLow=0.8V/Ron=20Ω、MOS、LED、QENは仮定モデル。
メーカー提供モデルによるスイッチング保証ではありません。追加4nFは試験負荷で、実装BOMに含めません。

100usはこのモデルで選んだ待機時間です。実機でゲート・旧行電流・電源を測定し調整してください。
1ms/行、785us点灯、62.5Hz、LED平均電流約0.247mA。明るさ・ちらつきの実用性は未評価です。

全96列電流は約0.484A（ロジック消費除外）。
TLCは全行にわたり使用されるので損失に1/16を掛けません。
Vf=0とする出力段の上限概算は0.317W/IC（VCC消費除外）。
接合温度、基板放熱、周囲温度、配線降下、部品公差、異常多重行、走査停止は実機評価対象。
現状は試作資料であり量産承認済みではありません。

資料URLと部品ごとの接続はimplementation.htmlに記載しています。
