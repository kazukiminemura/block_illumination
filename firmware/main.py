"""MicroPython on Pico 2: USB stdin accepts lines such as 30,60,100.

Copy this file and control.py to the Pico. This does not collect PC metrics.
On a 2 second input timeout, invalid line, or exit, drive all PWM outputs low.
"""
from machine import Pin, PWM
import sys
import select
import time
from control import PINS, PWM_HZ, REFERENCE_V, duty_u16, parse_values

pwms = []
for pin in PINS:
    Pin(pin, Pin.OUT, value=0)
    pwm = PWM(Pin(pin), freq=PWM_HZ, duty_u16=0)
    pwms.append(pwm)


def off():
    for pwm in pwms:
        pwm.duty_u16(0)


poller = select.poll()
poller.register(sys.stdin, select.POLLIN)
buffer = ''
discard = False
last_valid = time.ticks_ms()
try:
    while True:
        if poller.poll(10):
            char = sys.stdin.read(1)
            if char in ('\r', '\n'):
                if buffer and not discard:
                    try:
                        values = parse_values(buffer)
                        duties = [duty_u16(v, r) for v, r in zip(values, REFERENCE_V)]
                        for pwm, duty in zip(pwms, duties):
                            pwm.duty_u16(duty)
                        last_valid = time.ticks_ms()
                    except ValueError:
                        off()
                buffer = ''
                discard = False
            elif char:
                if len(buffer) >= 64:
                    off()
                    discard = True
                elif not discard:
                    buffer += char
        if time.ticks_diff(time.ticks_ms(), last_valid) >= 2000:
            off()
finally:
    off()
    for pwm, pin in zip(pwms, PINS):
        pwm.deinit()
        Pin(pin, Pin.OUT, value=0)
