# Rev C full circuit 3D view

Open index.html in Chrome or Edge. Internet access is required for Three.js 0.160.0 from jsDelivr.

The view includes Pico 2 H, three XD3914 drivers, three LED bars, resistors, filter capacitors, decoupling capacitors and external supply connector. Rounded wires use the connections from hardware/connections.csv. Component placement and package details are illustrative, not manufacturing dimensions or a verified PCB layout.

Drag to orbit; scroll to zoom. Use the explosion slider, channel selector, wiring filters and demo level controls. Click a component to inspect its pin connections. Floating labels are off initially; enable them with the labels checkbox. LED demo values are not live PC measurements.

Run node docs/3d/build.cjs after editing hardware/connections.csv. Run node docs/3d/build.cjs --check to check embedded netlist consistency, LED mapping, Pico supply separation and JavaScript syntax.

Physical appearance includes axial resistor color bands, cylindrical electrolytic capacitors, IC sockets and markings, Pico headers, copper pads, mounting hardware and shadows. This is an explanatory prototype view; actual assembly should follow the hardware documentation.
