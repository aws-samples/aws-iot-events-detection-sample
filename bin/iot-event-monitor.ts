#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EventBackendStack } from '../lib/event-backend-stack';
import { AppConfig } from '../config/config';

const app = new cdk.App();

const config_file = require(`../config/config.json`);
const config = <AppConfig>config_file;

new EventBackendStack(app, 'IoTEventStack', {
  config: config,
  env: {
    account:   config.appAccount,
    region:  config.region
  }
})