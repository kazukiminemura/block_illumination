# LED表示器 Rev B

製作時は [implementation.html](ltspice/implementation.html) と [assembly-connections.csv](ltspice/assembly-connections.csv) を使用してください。
connections.csvは生成元の接続表（PicoのみGPIO名）。Rev BではLEDとMOSにも実端子番号があります。

model.cjsとtest.cjsはデータ順序と表示の補助論理試験。電気解析はLTspiceを使用します。
正式図面はltspice/implementation.svgとltspice/full_circuit.svgです。

生成・検証手順は [FULL_CIRCUIT.md](ltspice/FULL_CIRCUIT.md)。
