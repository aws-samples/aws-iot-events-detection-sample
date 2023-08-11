import boto3
import os
client = boto3.client('pinpoint-sms-voice')

def handler(event, context):
    print(event)
    event_vars = event.get('payload', {}).get('state', {}).get('variables', {})
    sensor = event_vars.get('sensor', 'None')
    store = event_vars.get('store', 'None')
    client.send_voice_message(
        Content={
            'SSMLMessage': {
                'LanguageCode': 'en-US',
                'Text': "<speak>This is a text from <emphasis>Event Monitor</emphasis>. There is an alarm on sensor <emphasis>{0}</emphasis> from store <emphasis>{1}</emphasis></speak>".format(sensor, store),
                'VoiceId': 'Joanna'
            }
        },
        DestinationPhoneNumber=os.environ.get('DESTINATION_NUMBER'),
        OriginationPhoneNumber=os.environ.get('ORIGINATION_NUMBER')
    )