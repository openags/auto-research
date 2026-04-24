---
name: ur5e-arm
description: Robot skill for hardware control
type: robot
roles: []
tools: []
triggers: []
version: 1.0.0
protocol: modbus
endpoint: ''
hardware:
  manufacturer: ''
  model: ''
  firmware: ''
commands: []
---

## Hardware Overview

Describe the hardware device this skill controls.

## Communication Protocol

Document the communication interface in detail:
- **Protocol**: (e.g. REST API, gRPC, MQTT, CAN bus, RS-232, RS-485, USB, Modbus, OPC-UA, SiLA 2, ROS 2, Industrial Ethernet)
- **Baud rate / port**: (for serial connections)
- **Endpoint / topic**: (for network protocols)
- **Authentication**: (if applicable)

## Command Reference

List all available commands and their parameters:

| Command | Parameters | Description | Response |
|---------|-----------|-------------|----------|
| example | `{param: value}` | Description | Expected response |

## Safety Constraints

Document any safety-critical limits or constraints:
- Emergency stop procedure
- Axis / range limits
- Speed limits
- Collision avoidance notes

## Setup Instructions

How to connect and initialize the hardware for the first time.
