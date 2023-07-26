import boto3
import os

pinpoint_client = boto3.client('pinpoint')
ddb_client = boto3.client('dynamodb')

def handler(event, context):
    print(event)
    event_vars = event.get('payload', {}).get('state', {}).get('variables', {})
    sensor = event_vars.get('sensor', 'None')
    store = event_vars.get('store', 'None')
    destination_number = os.environ.get('DESTINATION_NUMBER')
    response = pinpoint_client.send_messages(
        ApplicationId = os.environ.get('PINPOINT_APP_ID'),
        MessageRequest = {
            'Addresses': {
                destination_number: {
                    'ChannelType': 'SMS'
                }
            },
            'MessageConfiguration': {
                'SMSMessage': {
                    'Body': "This is an alarm from Event Monitor. Alarm triggered {0} from store {1}, REPLY 1 to acknowledge".format(sensor, store),
                    'MessageType': 'TRANSACTIONAL',
                    'OriginationNumber': os.environ.get('ORIGINATION_NUMBER'),
                }
            }
        }
    )
    status_code = response.get('MessageResponse').get('Result').get(destination_number).get('StatusCode')
    message_id = response.get('MessageResponse').get('Result').get(destination_number).get('MessageId')
    print( response.get('MessageResponse'))
    print(status_code)
    print(message_id)
    if status_code == 200:
        data = ddb_client.put_item(
            TableName=os.environ.get('DDB_NAME'),
            Item={
                'id': {
                  'S': message_id
                },
                'dest_number': {
                  'S': destination_number
                },
                'store': {
                  'S': store
                },
                'sensor': {
                  'S': sensor
                }
            }
        )
        print(data)
