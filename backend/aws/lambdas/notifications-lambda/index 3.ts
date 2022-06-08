import type {
  APIGatewayProxyResult,
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  Context
} from "aws-lambda";
import { dbInfo } from "./constants";
import AWS from "aws-sdk";
import { DateTime, TimeUnit } from "timezonecomplete";

const dynamo = new AWS.DynamoDB.DocumentClient();
const eventBridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();
const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });

const sendResponse = async (id: any, data: any) => {
  return new Promise(async (resolve, reject) => { 
    try {
      await client.postToConnection({
          'ConnectionId': id,
          'Data': Buffer.from(JSON.stringify(data)),
      }).promise();
      resolve("Success");
    } catch (err) {
        console.log(err);
        reject(err);
    }
  });
}

const httpResponse = (status: number, body: any) => {
  return { statusCode: status,
            body: JSON.stringify(body)
            };
}

const getZoomMeetingData = (meetingId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    dynamo.query({
        TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
        KeyConditionExpression : "MeetingID = :id",
        ExpressionAttributeValues: {
          ":id": meetingId
        }
    }, function(error: any, data: any) {
      if(!error) {
        data.Items?.forEach(function(item: any) {
          if(item.MeetingID == meetingId) {
            // return the meeting
            resolve(item);
          }
        });
      } else {
        reject("No meeting found with MeetingId: " + meetingId);
      }
    });
  });
}

const getUser = (userId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    dynamo.query({
        TableName: 'UserData',
        KeyConditionExpression : "UserID = :id",
        ExpressionAttributeValues: {
          ":id": userId
        }
    }, function(error: any, data: any) {
      if(!error) {
        data.Items?.forEach(function(item: any) {
          if(item.UserID == userId) {
            // return the user
            resolve(item);
          }
        });
      }
      reject("No user found with UserId: " + userId);
    });
  });
}

const createEventBridgeRule = async (name: string, time: DateTime, data: object, context: any) => {
    const rule = await eventBridge.putRule({
        Name: name,
        ScheduleExpression: 'cron(' + time.utcMinute() + ' ' + time.utcHour() + ' ' + time.utcDay() + ' ' + 
        time.utcMonth() + ' ' + '?' + ' ' + time.utcYear() + ')'
    }).promise();

    await lambda.addPermission({
        Action: 'lambda:InvokeFunction',
        FunctionName: 'NotificationLambdaFunction',
        Principal: 'events.amazonaws.com',
        StatementId: name,
        SourceArn: rule.RuleArn,
    }).promise();

    return await eventBridge.putTargets({
        Rule: name,
        Targets: [
            {
                Id: `${name}-target`,
                Arn: context.invokedFunctionArn,
                Input: JSON.stringify(data),
            },
        ],
    }).promise();
}

const deleteEventBridgeRule = async(ruleName: string) => {
  try {
    await eventBridge.disableRule({
      Name: ruleName, 
      EventBusName: "default"
    }).promise();

    await eventBridge.removeTargets({
      Rule: ruleName, 
      EventBusName: "default",
      Ids: [`${ruleName}-target`]
    }).promise();

    await eventBridge.deleteRule({
      Name: ruleName, 
      EventBusName: "default"
    }).promise();

    // delete the policy 
    await lambda.removePermission({
        FunctionName: 'NotificationLambdaFunction',
        StatementId: ruleName
    }).promise();

  } catch (e) {
    console.log("Failed to delete event: " + e);
  }
}

export const handler: APIGatewayProxyHandler = async (
  event: any, context: Context): Promise<APIGatewayProxyResult> => {
  if (!event.data || !event.notificationType) {
      return httpResponse(400, "Missing event data");
  }
  try {
    const data = event.data;
    const meetingInfo = await getZoomMeetingData(data.id);

    // delete the event
    await deleteEventBridgeRule(event.ruleName);

    if(event.notificationType == "Now") {
      for (const participant of meetingInfo.participants) {
        const user = await getUser(participant.UserID);
          try {
            await sendResponse(user.connectionId, {
                incomingCall: { topic: data.topic, url: meetingInfo.link, host: user.zoomId == data.host_email ? true : false, scheduled: true }
            });
          } catch(e) {
              console.log("Failed to message host: " + user.name);
          }
      }
    } else { // send notification
      for (const participant of meetingInfo.participants) {
        const user = await getUser(participant.UserID);
        try {
          await sendResponse(user.connectionId, {
              meetingAlert: { topic: data.topic, url: meetingInfo.link, host: user.zoomId == data.host_email ? true : false, type: event.notificationType }
          });
        } catch(e) {
            console.log("Failed to message user: " + user.name);
        }
      }

      // create next event
      const startDate = new DateTime(data.start_time);
      const time15MinBefore = startDate.sub(15, TimeUnit.Minute);
      if(event.notificationType == "30Minute") {
        const name = "15MeetingNotification" + data.id;
        await createEventBridgeRule(name, time15MinBefore, { ruleName: name, data: data, notificationType: "15Minute"}, context);
      } else { // must be 15Minute
        const name = "MeetingNotification" + data.id;
        await createEventBridgeRule(name, startDate, { ruleName: name, data: data, notificationType: "Now" }, context);
      }

    }
    
    return httpResponse(200, "Finished sending notifications");
  } catch (e) {
      console.log("error: " + e);
      return httpResponse(500, e);
  }
};
