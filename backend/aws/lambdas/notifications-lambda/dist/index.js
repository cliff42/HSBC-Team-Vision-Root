"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const constants_1 = require("./constants");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const timezonecomplete_1 = require("timezonecomplete");
const dynamo = new aws_sdk_1.default.DynamoDB.DocumentClient();
const eventBridge = new aws_sdk_1.default.EventBridge();
const lambda = new aws_sdk_1.default.Lambda();
const client = new aws_sdk_1.default.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const sendResponse = async (id, data) => {
    return new Promise(async (resolve, reject) => {
        try {
            await client.postToConnection({
                'ConnectionId': id,
                'Data': Buffer.from(JSON.stringify(data)),
            }).promise();
            resolve("Success");
        }
        catch (err) {
            console.log(err);
            reject(err);
        }
    });
};
const httpResponse = (status, body) => {
    return { statusCode: status,
        body: JSON.stringify(body)
    };
};
const getZoomMeetingData = (meetingId) => {
    return new Promise((resolve, reject) => {
        dynamo.query({
            TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
            KeyConditionExpression: "MeetingID = :id",
            ExpressionAttributeValues: {
                ":id": meetingId
            }
        }, function (error, data) {
            var _a;
            if (!error) {
                (_a = data.Items) === null || _a === void 0 ? void 0 : _a.forEach(function (item) {
                    if (item.MeetingID == meetingId) {
                        // return the meeting
                        resolve(item);
                    }
                });
            }
            else {
                reject("No meeting found with MeetingId: " + meetingId);
            }
        });
    });
};
const getUser = (userId) => {
    return new Promise((resolve, reject) => {
        dynamo.query({
            TableName: 'UserData',
            KeyConditionExpression: "UserID = :id",
            ExpressionAttributeValues: {
                ":id": userId
            }
        }, function (error, data) {
            var _a;
            if (!error) {
                (_a = data.Items) === null || _a === void 0 ? void 0 : _a.forEach(function (item) {
                    if (item.UserID == userId) {
                        // return the user
                        resolve(item);
                    }
                });
            }
            reject("No user found with UserId: " + userId);
        });
    });
};
const createEventBridgeRule = async (name, time, data, context) => {
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
};
const deleteEventBridgeRule = async (ruleName) => {
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
    }
    catch (e) {
        console.log("Failed to delete event: " + e);
    }
};
const handler = async (event, context) => {
    if (!event.data || !event.notificationType) {
        return httpResponse(400, "Missing event data");
    }
    try {
        const data = event.data;
        const meetingInfo = await getZoomMeetingData(data.id);
        // delete the event
        await deleteEventBridgeRule(event.ruleName);
        if (event.notificationType == "Now") {
            for (const participant of meetingInfo.participants) {
                const user = await getUser(participant.UserID);
                try {
                    await sendResponse(user.connectionId, {
                        incomingCall: { topic: data.topic, url: meetingInfo.link, host: user.zoomId == data.host_email ? true : false, scheduled: true }
                    });
                }
                catch (e) {
                    console.log("Failed to message host: " + user.name);
                }
            }
        }
        else { // send notification
            for (const participant of meetingInfo.participants) {
                const user = await getUser(participant.UserID);
                try {
                    await sendResponse(user.connectionId, {
                        meetingAlert: { topic: data.topic, url: meetingInfo.link, host: user.zoomId == data.host_email ? true : false, type: event.notificationType }
                    });
                }
                catch (e) {
                    console.log("Failed to message user: " + user.name);
                }
            }
            // create next event
            const startDate = new timezonecomplete_1.DateTime(data.start_time);
            const time15MinBefore = startDate.sub(15, timezonecomplete_1.TimeUnit.Minute);
            if (event.notificationType == "30Minute") {
                const name = "15MeetingNotification" + data.id;
                await createEventBridgeRule(name, time15MinBefore, { ruleName: name, data: data, notificationType: "15Minute" }, context);
            }
            else { // must be 15Minute
                const name = "MeetingNotification" + data.id;
                await createEventBridgeRule(name, startDate, { ruleName: name, data: data, notificationType: "Now" }, context);
            }
        }
        return httpResponse(200, "Finished sending notifications");
    }
    catch (e) {
        console.log("error: " + e);
        return httpResponse(500, e);
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFNQSwyQ0FBcUM7QUFDckMsc0RBQTBCO0FBQzFCLHVEQUFzRDtBQUV0RCxNQUFNLE1BQU0sR0FBRyxJQUFJLGlCQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQ2pELE1BQU0sV0FBVyxHQUFHLElBQUksaUJBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUMxQyxNQUFNLE1BQU0sR0FBRyxJQUFJLGlCQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDaEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBRyxDQUFDLHVCQUF1QixDQUFDLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBRTdGLE1BQU0sWUFBWSxHQUFHLEtBQUssRUFBRSxFQUFPLEVBQUUsSUFBUyxFQUFFLEVBQUU7SUFDaEQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzNDLElBQUk7WUFDRixNQUFNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDMUIsY0FBYyxFQUFFLEVBQUU7Z0JBQ2xCLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDNUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3BCO1FBQUMsT0FBTyxHQUFHLEVBQUU7WUFDVixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNmO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUE7QUFFRCxNQUFNLFlBQVksR0FBRyxDQUFDLE1BQWMsRUFBRSxJQUFTLEVBQUUsRUFBRTtJQUNqRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU07UUFDakIsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO0tBQ3pCLENBQUM7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNLGtCQUFrQixHQUFHLENBQUMsU0FBaUIsRUFBZ0IsRUFBRTtJQUM3RCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3JDLE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFDVCxTQUFTLEVBQUUsa0JBQU0sQ0FBQyw2QkFBNkI7WUFDL0Msc0JBQXNCLEVBQUcsaUJBQWlCO1lBQzFDLHlCQUF5QixFQUFFO2dCQUN6QixLQUFLLEVBQUUsU0FBUzthQUNqQjtTQUNKLEVBQUUsVUFBUyxLQUFVLEVBQUUsSUFBUzs7WUFDL0IsSUFBRyxDQUFDLEtBQUssRUFBRTtnQkFDVCxNQUFBLElBQUksQ0FBQyxLQUFLLDBDQUFFLE9BQU8sQ0FBQyxVQUFTLElBQVM7b0JBQ3BDLElBQUcsSUFBSSxDQUFDLFNBQVMsSUFBSSxTQUFTLEVBQUU7d0JBQzlCLHFCQUFxQjt3QkFDckIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUNmO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7aUJBQU07Z0JBQ0wsTUFBTSxDQUFDLG1DQUFtQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO2FBQ3pEO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQTtBQUVELE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBYyxFQUFnQixFQUFFO0lBQy9DLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDckMsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUNULFNBQVMsRUFBRSxVQUFVO1lBQ3JCLHNCQUFzQixFQUFHLGNBQWM7WUFDdkMseUJBQXlCLEVBQUU7Z0JBQ3pCLEtBQUssRUFBRSxNQUFNO2FBQ2Q7U0FDSixFQUFFLFVBQVMsS0FBVSxFQUFFLElBQVM7O1lBQy9CLElBQUcsQ0FBQyxLQUFLLEVBQUU7Z0JBQ1QsTUFBQSxJQUFJLENBQUMsS0FBSywwQ0FBRSxPQUFPLENBQUMsVUFBUyxJQUFTO29CQUNwQyxJQUFHLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxFQUFFO3dCQUN4QixrQkFBa0I7d0JBQ2xCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDZjtnQkFDSCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBQ0QsTUFBTSxDQUFDLDZCQUE2QixHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUE7QUFFRCxNQUFNLHFCQUFxQixHQUFHLEtBQUssRUFBRSxJQUFZLEVBQUUsSUFBYyxFQUFFLElBQVksRUFBRSxPQUFZLEVBQUUsRUFBRTtJQUM3RixNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFDbkMsSUFBSSxFQUFFLElBQUk7UUFDVixrQkFBa0IsRUFBRSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHO1lBQ2pHLElBQUksQ0FBQyxRQUFRLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsR0FBRztLQUMzRCxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFYixNQUFNLE1BQU0sQ0FBQyxhQUFhLENBQUM7UUFDdkIsTUFBTSxFQUFFLHVCQUF1QjtRQUMvQixZQUFZLEVBQUUsNEJBQTRCO1FBQzFDLFNBQVMsRUFBRSxzQkFBc0I7UUFDakMsV0FBVyxFQUFFLElBQUk7UUFDakIsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPO0tBQzFCLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUViLE9BQU8sTUFBTSxXQUFXLENBQUMsVUFBVSxDQUFDO1FBQ2hDLElBQUksRUFBRSxJQUFJO1FBQ1YsT0FBTyxFQUFFO1lBQ0w7Z0JBQ0ksRUFBRSxFQUFFLEdBQUcsSUFBSSxTQUFTO2dCQUNwQixHQUFHLEVBQUUsT0FBTyxDQUFDLGtCQUFrQjtnQkFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO2FBQzlCO1NBQ0o7S0FDSixDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakIsQ0FBQyxDQUFBO0FBRUQsTUFBTSxxQkFBcUIsR0FBRyxLQUFLLEVBQUMsUUFBZ0IsRUFBRSxFQUFFO0lBQ3RELElBQUk7UUFDRixNQUFNLFdBQVcsQ0FBQyxXQUFXLENBQUM7WUFDNUIsSUFBSSxFQUFFLFFBQVE7WUFDZCxZQUFZLEVBQUUsU0FBUztTQUN4QixDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFYixNQUFNLFdBQVcsQ0FBQyxhQUFhLENBQUM7WUFDOUIsSUFBSSxFQUFFLFFBQVE7WUFDZCxZQUFZLEVBQUUsU0FBUztZQUN2QixHQUFHLEVBQUUsQ0FBQyxHQUFHLFFBQVEsU0FBUyxDQUFDO1NBQzVCLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUViLE1BQU0sV0FBVyxDQUFDLFVBQVUsQ0FBQztZQUMzQixJQUFJLEVBQUUsUUFBUTtZQUNkLFlBQVksRUFBRSxTQUFTO1NBQ3hCLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUViLHFCQUFxQjtRQUNyQixNQUFNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxQixZQUFZLEVBQUUsNEJBQTRCO1lBQzFDLFdBQVcsRUFBRSxRQUFRO1NBQ3hCLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUVkO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQzdDO0FBQ0gsQ0FBQyxDQUFBO0FBRU0sTUFBTSxPQUFPLEdBQTJCLEtBQUssRUFDbEQsS0FBVSxFQUFFLE9BQWdCLEVBQWtDLEVBQUU7SUFDaEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUU7UUFDeEMsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLG9CQUFvQixDQUFDLENBQUM7S0FDbEQ7SUFDRCxJQUFJO1FBQ0YsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUN4QixNQUFNLFdBQVcsR0FBRyxNQUFNLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUV0RCxtQkFBbUI7UUFDbkIsTUFBTSxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFNUMsSUFBRyxLQUFLLENBQUMsZ0JBQWdCLElBQUksS0FBSyxFQUFFO1lBQ2xDLEtBQUssTUFBTSxXQUFXLElBQUksV0FBVyxDQUFDLFlBQVksRUFBRTtnQkFDbEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM3QyxJQUFJO29CQUNGLE1BQU0sWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7d0JBQ2xDLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7cUJBQ25JLENBQUMsQ0FBQztpQkFDSjtnQkFBQyxPQUFNLENBQUMsRUFBRTtvQkFDUCxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDdkQ7YUFDSjtTQUNGO2FBQU0sRUFBRSxvQkFBb0I7WUFDM0IsS0FBSyxNQUFNLFdBQVcsSUFBSSxXQUFXLENBQUMsWUFBWSxFQUFFO2dCQUNsRCxNQUFNLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQy9DLElBQUk7b0JBQ0YsTUFBTSxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRTt3QkFDbEMsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRTtxQkFDaEosQ0FBQyxDQUFDO2lCQUNKO2dCQUFDLE9BQU0sQ0FBQyxFQUFFO29CQUNQLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN2RDthQUNGO1lBRUQsb0JBQW9CO1lBQ3BCLE1BQU0sU0FBUyxHQUFHLElBQUksMkJBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDaEQsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsMkJBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzRCxJQUFHLEtBQUssQ0FBQyxnQkFBZ0IsSUFBSSxVQUFVLEVBQUU7Z0JBQ3ZDLE1BQU0sSUFBSSxHQUFHLHVCQUF1QixHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQy9DLE1BQU0scUJBQXFCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUMxSDtpQkFBTSxFQUFFLG1CQUFtQjtnQkFDMUIsTUFBTSxJQUFJLEdBQUcscUJBQXFCLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDN0MsTUFBTSxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ2hIO1NBRUY7UUFFRCxPQUFPLFlBQVksQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQztLQUM1RDtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0IsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQy9CO0FBQ0gsQ0FBQyxDQUFDO0FBckRXLFFBQUEsT0FBTyxXQXFEbEIifQ==