import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iot as iot } from 'aws-cdk-lib';
import { aws_iotevents as iotevents } from 'aws-cdk-lib';
import { aws_timestream } from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_pinpoint as pinpoint } from 'aws-cdk-lib';
import { Runtime, AssetCode } from 'aws-cdk-lib/aws-lambda';
import { aws_lambda } from 'aws-cdk-lib';
import { aws_events as events } from 'aws-cdk-lib';
import { aws_events_targets as targets } from 'aws-cdk-lib';
import { AppConfig } from '../config/config';



import { Construct } from 'constructs';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

interface StackConfigProps extends cdk.StackProps {
  config: AppConfig;
}
export class EventBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackConfigProps) {
    super(scope, id, props);

    const prefix = this.stackName

    const messageTable = new dynamodb.Table(this, prefix + "MessageTable", {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const iotRulesRole = new iam.Role(this, prefix + "IotRulesRole", {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });

    iotRulesRole.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [            
          "iotevents:BatchPutMessage"
        ]
      },
    ));

    const iotPinpointProject = new pinpoint.CfnApp(this, prefix + "IotEventsProject", {
      name: prefix + "IotEventsProject"
    });

    const iotPinpointVoiceChannel = new pinpoint.CfnVoiceChannel(this, prefix + "IotVoiceChannel", {
      applicationId: iotPinpointProject.ref,
      enabled: true,
    });

    const eventDetectorInput = new iotevents.CfnInput(this, prefix + "Input", {
      inputDefinition: {
        attributes: [
          {
            jsonPath: 'id'
          },
          {
            jsonPath: 'name'
          },
          {
            jsonPath: 'store'
          },
          {
            jsonPath: 'room'
          },
          {
            jsonPath: 'loc'
          },
          {
            jsonPath: 'command'
          },
          {
            jsonPath: 'ack_status'
          }
      ],
      },
      inputDescription: 'inputDescription',
      inputName: prefix + "Input",
    });

    const snsListenerFunction = new aws_lambda.Function(this, prefix + "SmsListener", {
      functionName: prefix + "SmsListener",
      handler: "handler.handler",
      runtime: Runtime.PYTHON_3_9,
      code: new AssetCode(`./src/lambdas/sms-listener`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        DDB_NAME: messageTable.tableName,
        EVENT_INPUT: eventDetectorInput.ref
      }
    });

    snsListenerFunction.addPermission(prefix + "EventsPerm", {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      action: "lambda:InvokeFunction",
      sourceArn: snsListenerFunction.functionArn
    });

    snsListenerFunction.addToRolePolicy(new iam.PolicyStatement({
         effect: iam.Effect.ALLOW,
         actions: [ 'sms-voice:SendVoiceMessage' ],
         resources: [ '*' ]
    }));

    snsListenerFunction.addToRolePolicy(new iam.PolicyStatement(
      {
         effect: iam.Effect.ALLOW,
         actions: [ 'dynamodb:PutItem', 'dynamodb:GetItem' ],
         resources: [ '*' ]
      }
    ));

    snsListenerFunction.addToRolePolicy(new iam.PolicyStatement(
      {
         effect: iam.Effect.ALLOW,
         actions: [ 'iot:Publish', 'iotevents:BatchPutMessage' ],
         resources: [ '*' ]
      }
    ));

    const pinpointSMSTopic = new sns.Topic(this, prefix + 'SMSTopic');
    pinpointSMSTopic.addSubscription(new LambdaSubscription(snsListenerFunction))

    const iotPinpointSmsFunction = new aws_lambda.Function(this, prefix + "SmsPinpoint", {
      functionName: prefix + "SmsPinpoint",
      handler: "handler.handler",
      runtime: Runtime.PYTHON_3_9,
      code: new AssetCode(`./src/lambdas/sms-pinpoint`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        DDB_NAME: messageTable.tableName,
        PINPOINT_APP_ID: iotPinpointProject.ref,
        ORIGINATION_NUMBER: props.config.originationNumber,
        DESTINATION_NUMBER: props.config.destinationNumber,
      }
    });

    iotPinpointSmsFunction.addPermission(prefix + "EventsPerm", {
      principal: new iam.ServicePrincipal('iotevents.amazonaws.com'),
      action: "lambda:InvokeFunction",
      sourceArn: iotPinpointSmsFunction.functionArn
    });

    iotPinpointSmsFunction.addToRolePolicy(new iam.PolicyStatement(
      {
         effect: iam.Effect.ALLOW,
         actions: [ 'mobiletargeting:SendMessages' ],
         resources: [ '*' ]
      }
    ));
    iotPinpointSmsFunction.addToRolePolicy(new iam.PolicyStatement(
      {
         effect: iam.Effect.ALLOW,
         actions: [ 'dynamodb:PutItem', 'dynamodb:GetItem' ],
         resources: [ '*' ]
      }
    ));

    const iotPinpointCallFunction = new aws_lambda.Function(this, prefix + "CallPinpoint", {
      functionName: prefix + "CallPinpoint",
      handler: "handler.handler",
      runtime: Runtime.PYTHON_3_9,
      code: new AssetCode(`./src/lambdas/call-pinpoint`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PINPOINT_APP_ID: iotPinpointProject.ref,
        ORIGINATION_NUMBER: props.config.originationNumber,
        DESTINATION_NUMBER: props.config.destinationNumber,
      }
    });

    iotPinpointCallFunction.addPermission(prefix + "EventsPerm", {
      principal: new iam.ServicePrincipal('iotevents.amazonaws.com'),
      action: "lambda:InvokeFunction",
      sourceArn: iotPinpointCallFunction.functionArn
    });

    iotPinpointCallFunction.addToRolePolicy(new iam.PolicyStatement({
         effect: iam.Effect.ALLOW,
         actions: [ 'sms-voice:SendVoiceMessage' ],
         resources: [ '*' ]
    }));

    const iotDetectorRole = new iam.Role(this, prefix + "EventRole", {
      assumedBy: new iam.ServicePrincipal('iotevents.amazonaws.com')
    });

    iotDetectorRole.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [            
          "sns:*",
          "lambda:*"
        ]
      },
    ));

    const eventDetectorModel = new iotevents.CfnDetectorModel(this, prefix + "DetectorModel", {
      roleArn: iotDetectorRole.roleArn,
      evaluationMethod: "SERIAL",
      detectorModelDefinition: {
  
        initialStateName: "Normal",
        states: [
          {
            stateName: "Normal",
            onEnter: {
              events: [
                {
                  eventName: "Init",
                  condition: "true",
                  actions: [
                    {
                      setVariable: {
                        variableName: "temp_breached_count",
                        value: "0"
                      }
                    },
                    {
                      setVariable: {
                        variableName: "threshold_value",
                        value: "29"
                      }
                    },
                    {
                      setVariable: {
                        variableName: "store",
                        value: "$input." + eventDetectorInput.inputName + ".store"
                      },
                    },
                    {
                      setVariable: {
                        variableName: "sensor",
                        value: "$input." + eventDetectorInput.inputName + ".id"
                      },
                    }
                  ]
                }
              ]
            },
            onInput: {
              events: [
                {
                  eventName: "CreateConfigVariables",
                  condition: "true",
                  actions: [
                  ],
                },
              ],
              transitionEvents: [
                {
                  eventName: "ChangeToWarning",
                  condition: "$input." + eventDetectorInput.inputName + ".temp > $variable.threshold_value",
                  actions: [
                  ],
                  nextState: "Warning"
                },
              ]
            }
          },
          {
            stateName: "Warning",
            onEnter: {
              events: [
                {
                  eventName: "HighTempCounter",
                  condition: "true",
                  actions: [
                    {
                      setTimer: {
                        timerName: "warningTime",
                        seconds: 600
                      }
                    }
                  ],
                },
              ]
            },
            onInput: {
              events: [
                {
                  eventName: "HighTempCounter",
                  condition: "$input." + eventDetectorInput.inputName + ".temp > $variable.threshold_value",
                  actions: [
                    {
                      setVariable: {
                        variableName: "temp_breached_count",
                        value: "$variable.temp_breached_count + 1"
                      }
                    }
                  ],
                },
              ],
              transitionEvents: [
                {
                  eventName: "WarnToHighTemp",
                  condition: "$variable.temp_breached_count >= 2",
                  nextState: "HighTemp",
                  actions: [
                    {
                      clearTimer: {
                        timerName: "warningTime"
                      }
                    }
                  ]
                },
                {
                  eventName: "WarnToNormal",
                  condition: "timeout(\"warningTime\") && $variable.temp_breached_count < 2",
                  nextState: "Normal"
                }
              ]
            }
          },
          {
            stateName: "HighTemp",
            onEnter: {
              events: [
                {
                  eventName: "AlarmSMS",
                  condition: "true",
                  actions: [
                    {
                      lambda: {
                        functionArn: iotPinpointSmsFunction.functionArn,
                      }
                    },
                    {
                      setTimer: {
                        timerName: "unacknowledgeTime",
                        seconds: 300
                      }
                    }
                  ]
                },
              ]
            },
            onInput: {
              events: [
                {
                  eventName: "SetAckStatus",
                  condition: "$input." + eventDetectorInput.inputName + ".ack_status == \"true\"",
                  actions:[
                    {
                      setVariable: {
                        variableName: "ack_status",
                        value: "$input." + eventDetectorInput.inputName + ".ack_status"
                      },
                    }
                  ]
                },
                {
                  eventName: "EscalatedOnCall",
                  condition: "timeout(\"unacknowledgeTime\")",
                  actions:[
                    {
                      lambda: {
                        functionArn: iotPinpointCallFunction.functionArn,
                      }
                    }
                  ]
                }
              ],
              transitionEvents: [
                {
                  eventName: "HighTempToResetNormal",
                  condition: "$input." + eventDetectorInput.inputName + ".command == \"reset\"",
                  nextState: "Normal",
                  actions: [
                    {
                      clearTimer: {
                        timerName: "unacknowledgeTime"
                      }
                    }
                  ]
                },
                {
                  eventName: "HighTempToAckSnooze",
                  condition: "$input." + eventDetectorInput.inputName + ".command == \"ack\" && $variable.ack_active != \"true\"",
                  nextState: "Snooze",
                  actions: [
                    {
                      clearTimer: {
                        timerName: "unacknowledgeTime"
                      }
                    }
                  ]
                }
              ]
            }
          },
          {
            stateName: "Snooze",
            onEnter: {
              events: [
                {
                  eventName: "SnoozeTimer",
                  condition: "true",
                  actions: [
                    {
                      setVariable: {
                        variableName: "ack_active",
                        value: "1"
                      }
                    },
                    {
                      setTimer: {
                        timerName: "snoozeTime",
                        seconds: 120
                      }
                    },
                  ]
                }
              ]
            },
            onInput: {
              events: [
                {
                  eventName: "SetSnoozeAck",
                  condition: "timeout(\"snoozeTime\")",
                  actions: [
                    {
                      setVariable: {
                        variableName: "ack_active",
                        value: "0"
                      }
                    },
                  ]
                }
              ],
              transitionEvents: [
                {
                  eventName: "SnoozeToResetNormal",
                  condition: "$input." + eventDetectorInput.inputName + ".command == \"reset\"",
                  nextState: "Normal",
                  actions: [
                    {
                      clearTimer: {
                        timerName: "snoozeTime"
                      }
                    },
                    {
                      setVariable: {
                        variableName: "ack_status",
                        value: "false"
                      }
                    },
                  ]
                },
                {
                  eventName: "SnoozeToNormal",
                  condition: "$input." + eventDetectorInput.inputName + ".temp < $variable.threshold_value && $variable.ack_active == 0",
                  nextState: "Normal",
                  actions: [
                    {
                      setVariable: {
                        variableName: "ack_status",
                        value: "false"
                      }
                    },
                  ]
                },
                {
                  eventName: "SnoozeToHighTemp",
                  condition: "timeout(\"snoozeTime\") && $variable.ack_active == 0",
                  nextState: "HighTemp",
                  actions: [
                    {
                      setVariable: {
                        variableName: "ack_status",
                        value: "false"
                      }
                    },
                  ]
                }
              ]
            }
          },
        ]
      },
      key: "id"
    });

    new iot.CfnTopicRule(this, prefix + "EventsFilter", {
      ruleName: prefix + "EventsFilter",
      topicRulePayload: {
        sql: "SELECT * FROM '/eventmonitor/data/sensor/#'",
        actions: [{
          iotEvents: {
            inputName: prefix + "Input",
            messageId: "id",
            roleArn: iotRulesRole.roleArn
          }
        }]
      }
    });
  }
}
