import boto3
import json
import os
import boto3
import uuid

ddb_client = boto3.client('dynamodb')
iot_client=boto3.client('iotevents-data')

def handler(event, context):
    print(event)
    for record in event['Records']:
        message = (str(json.loads(record['Sns']['Message'])['messageBody'])).strip()
        # origination_number = str(json.loads(record['Sns']['Message'])['originationNumber'])
        # destination_number = str(json.loads(record['Sns']['Message'])['destinationNumber'])
        previous_message_id = str(json.loads(record['Sns']['Message'])['previousPublishedMessageId']) 
    data = ddb_client.get_item(
        TableName=os.environ.get('DDB_NAME'),
        Key={
            'id': {
                'S': previous_message_id
            }
        }
    )
    sensor = data.get('Item').get('sensor').get('S')
    store = data.get('Item').get('store').get('S')
    payload = {
          'id': sensor,
          'store': store,
          'command': 'ack',
          'ack_status': 'true'
        }
    topic = "/eventmonitor/data/sensor/AnySens1"
    print(payload)
    #iot_response = iot_client.publish(topic=topic, payload=json.dumps(payload))
    message_id = str(uuid.uuid4().hex)
    iot_response = iot_client.batch_put_message(
        messages=[
            {
                'inputName': os.environ.get('EVENT_INPUT'),
                'messageId': message_id,
                'payload': json.dumps(payload)
            }
        ]
    )
    print(iot_response)
