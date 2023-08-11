import boto3
import sys
import time
import argparse
import random
import json




# create argument parser
parser = argparse.ArgumentParser(description='Publish message to an AWS IoT Core topic')
parser.add_argument('-n', '--name', help='Device name to publish the message to', required=True)
parser.add_argument('-t', '--temp', help='Maximum temperature to publish', required=True)
parser.add_argument('-c', '--command', help='Sensor command to publish, supported values: (reset, ack)', required=False)

args = parser.parse_args()

# Set up AWS IoT client
iot = boto3.client('iot-data')

topic_name = f"/eventmonitor/data/sensor/{args.name}"
if args.command:
    command = args.command
else:
    command = "none"
message ={
  'id': args.name,
  'name': args.name,
  'store': "1",
  'room': "1",
  'loc': "TO",
  'command': command,
  'ack_status': 'none'
}
# Publish messages continuously
while True:
    message['temp'] = random.randint(20, int(args.temp))
    message['hum'] = random.randint(40, 50)
    iot.publish(topic=topic_name, payload=json.dumps(message))
    print(f"Published message '{message}' to topic '{topic_name}'")
    time.sleep(1)