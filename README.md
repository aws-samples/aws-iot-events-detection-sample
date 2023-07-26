# IoT Event Monitor

This project involves collecting and monitoring sensor data from a freezer using AWS IoT Core, IoT Rules, and IoT Events. The freezer contains temperature sensors that measure and send data to the AWS IoT Core. The goal of the project is to monitor the freezer's conditions and take appropriate actions based on predefined rules and events.

To achieve this, AWS IoT Core is used to collect sensor data from the freezer, which is then processed by IoT Rules. The IoT Rules and IoT Events are configured to apply business logic to the data and trigger actions when certain conditions are met. The IoT Events detector model is created to detect specific patterns in the data, such as a sudden rise in temperature, which indicate that the freezer may be malfunctioning. IoT events also listens to commands such as ack, reset etc. from sensors when staff is working on fixing the problem.

When the IoT Events detector model identifies an issue with the freezer, it triggers an SMS alert, which is sent to the technicians via Amazon Pinpoint bidirectional SMS feature. If there is no acknowledgment received from technicians, then an escalation call is triggered using Amazon Pinpoint outbound call functionality. The alert contains details about the issue and any necessary action that needs to be taken. For example, if the temperature of the freezer rises above a certain threshold, the alert may instruct the technician to check the freezer and take corrective action.


## Architecture

![Alt text](images/iot-arch.png?raw=true)

## Detector Model

![Alt text](images/iot-event.png?raw=true)

## Deployment

* Add account id and region to `config/config.json` (`originationNumber` and `destinationNumber` can be changed after initial deployment)

* `npm install`   install dependencies
* `npm run build`   compile typescript to js
* `cdk deploy`      deploy this stack to your default AWS account/region

* Manually configure pinpoint voice channel
![Alt text](images/pinpoint-sms-voice.png?raw=true)
* Add destination phone number in pinpoint
* Request origination phone number in pinpoint
* Add originationNumber and destinationNumber to `config/config.json`
* Run `cdk deploy`  deploy changes

## Testing

1. Start sending sample data to a topic in AWS IoT Core endpoint

```bash
python src/test-scripts/iot-client.py -n "em2" -t 30

# Above command will send data to /eventmonitor/data/sensor/{name}

# Sample payload: '{'id': 'em1', 'name': 'em1', 'store': '1', 'room': '1', 'loc': 'TO', 'command': 'none', 'ack_status': 'none', 'temp': 27, 'hum': 41}'
```

2. Check of the detector appeared on IoT Events console with state `Normal`

![Alt text](images/detector-normal.png?raw=true)

![Alt text](images/detector-normal-detail.png?raw=true)

3. Start sending sample data to a topic in AWS IoT Core endpoint to trigger high temperature

```bash
python src/test-scripts/iot-client.py -n "em2" -t 40
```

4. Check the detector state changed to `HighTemp`

![Alt text](images/detector-high.png?raw=true)

5. After few minutes, detector model will send a text with sensor id and sore name to the destination phone number, REPLY '1' to acknowledge the alarm

6. Check the detector state changed to `Snooze` and `ack_status` set to `true`

![Alt text](images/detector-snooze.png?raw=true)

7. If you don't respond to text message in few minutes, IoT detector model will escalate it to a phone call action and you will receive a phone call with sensor id and sore name.

### Cleaning up
To avoid incurring future charges, delete the resources.
```
cdk destroy
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.