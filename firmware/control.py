"""Pure control logic shared by the Pico firmware and host-side checks."""
PINS = (0, 2, 4)  # Different PWM slices, Pico physical pins 1 / 4 / 6.
PWM_HZ = 20000
# Replace these with measured pin7 voltages and measured GPIO high voltage.
REFERENCE_V = (1.28, 1.28, 1.28)
GPIO_HIGH_V = 3.30


def parse_values(line):
    parts = line.strip().split(',')
    if len(parts) != 3:
        raise ValueError('Expected CPU,GPU,NPU percentages')
    values = tuple(float(p) for p in parts)
    if not all(0 <= v <= 100 for v in values):
        raise ValueError('Percentages must be finite and within 0..100')
    return values


def target_voltage(percent, reference):
    if not 0 <= percent <= 100 or not 1.15 <= reference <= 1.40:
        raise ValueError('Invalid percentage or reference calibration')
    count = int(percent // 10)  # 0..9%=off; 10..19%=1; 100%=10.
    if count == 0:
        return 0.0
    if count == 10:
        return 1.08 * reference
    # Stay between comparator thresholds, rather than directly on a threshold.
    return (count + 0.5) * reference / 10


def duty_u16(percent, reference, gpio_high=GPIO_HIGH_V):
    if not 3.0 <= gpio_high <= 3.6:
        raise ValueError('Invalid GPIO calibration')
    return round(65535 * target_voltage(percent, reference) / gpio_high)


if __name__ == '__main__':
    assert parse_values('10,50,100\n') == (10.0, 50.0, 100.0)
    for line in ('1,2', 'nan,1,2', 'inf,1,2', '-1,0,1', '101,0,1'):
        try:
            parse_values(line)
        except ValueError:
            pass
        else:
            raise AssertionError('Accepted invalid input: ' + line)
    for ref in (1.20, 1.28, 1.34):
        duties = [duty_u16(n * 10, ref) for n in range(11)]
        assert duties == sorted(set(duties))
        for n in range(11):
            voltage = duties[n] * GPIO_HIGH_V / 65535
            actual = sum(voltage > ref * k / 10 for k in range(1, 11))
            assert actual == n, (ref, n, actual)
    print('PASS input validation and all 11 display levels at 3 reference voltages')
